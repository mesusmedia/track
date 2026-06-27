import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { isRateLimited } from "@/lib/rate-limit";
import { findVisitorById, extractRefCode } from "@/lib/visitors";

// ponytail: campos seguem o formato publicamente documentado do webhook
// "message_created" do Chatwoot -- conferir com um payload real do Chatwoot
// hospedado pela agencia antes de depender disso em produção.
export async function POST(request: Request) {
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  if (isRateLimited(`webhook:${ip}`)) {
    return NextResponse.json({ error: "rate_limited" }, { status: 429 });
  }

  const url = new URL(request.url);
  const token = url.searchParams.get("token");
  if (!token) return NextResponse.json({ error: "token é obrigatório" }, { status: 401 });

  const supabase = createServiceClient();
  const { data: settings } = await supabase
    .from("settings")
    .select("client_id")
    .eq("webhook_token", token)
    .maybeSingle();
  if (!settings) return NextResponse.json({ error: "token inválido" }, { status: 401 });

  const body = await request.json().catch(() => null);
  if (!body || body.event !== "message_created") {
    return NextResponse.json({ ignored: true });
  }

  const conversationId = String(body.conversation?.id ?? "");
  const messageType = body.message_type as string | undefined;
  const content = String(body.content ?? "");
  if (!conversationId) return NextResponse.json({ error: "conversation.id ausente" }, { status: 400 });

  const { data: lead } = await supabase
    .from("leads")
    .select("id, stage_id")
    .eq("client_id", settings.client_id)
    .eq("conversation_external_id", conversationId)
    .maybeSingle();

  if (!lead) {
    // primeira mensagem dessa conversa -- cria o lead na primeira etapa do funil
    const { data: firstStage } = await supabase
      .from("pipeline_stages")
      .select("id")
      .eq("client_id", settings.client_id)
      .order("position", { ascending: true })
      .limit(1)
      .maybeSingle();

    const refCode = extractRefCode(content);
    const visitor = refCode ? await findVisitorById(supabase, settings.client_id, refCode) : null;

    await supabase.from("leads").insert({
      client_id: settings.client_id,
      conversation_external_id: conversationId,
      stage_id: firstStage?.id ?? null,
      name: body.contact?.name ?? body.sender?.name ?? null,
      phone: body.contact?.phone_number ?? body.conversation?.meta?.sender?.phone_number ?? null,
      trck_user_id: visitor?.trck_user_id ?? null,
      utm_source: visitor?.utm_source ?? null,
      utm_medium: visitor?.utm_medium ?? null,
      utm_campaign: visitor?.utm_campaign ?? null,
    });
    return NextResponse.json({ lead: "created" });
  }

  // automacao por palavra-chave: so em mensagens enviadas pela equipe (outgoing)
  if (messageType === "outgoing" && content) {
    const { data: rules } = await supabase
      .from("automation_rules")
      .select("keyword, stage_id")
      .eq("client_id", settings.client_id)
      .eq("active", true);

    const match = (rules ?? []).find((rule) =>
      content.toLowerCase().includes(rule.keyword.toLowerCase()),
    );
    if (match && match.stage_id !== lead.stage_id) {
      await supabase
        .from("leads")
        .update({ stage_id: match.stage_id, updated_at: new Date().toISOString() })
        .eq("id", lead.id);
      return NextResponse.json({ lead: "moved", stage_id: match.stage_id });
    }
  }

  return NextResponse.json({ lead: "unchanged" });
}
