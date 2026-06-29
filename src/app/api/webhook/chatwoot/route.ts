import { NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { createServiceClient } from "@/lib/supabase/server";
import { isRateLimited } from "@/lib/rate-limit";
import { findVisitorById, extractRefCode } from "@/lib/visitors";
import { resolveAdFromGclid } from "@/lib/google-ads/client";
import { maybeDispatchPurchaseForLead } from "@/lib/crm/dispatch-purchase";
import { matchesGoogleMarker } from "@/lib/ad-attribution";
import { dispatchEvent } from "@/lib/dispatch";
import { hashPhone } from "@/lib/hash";

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
  if (token !== process.env.CHATWOOT_WEBHOOK_SECRET) {
    return NextResponse.json({ error: "token inválido" }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  if (!body || body.event !== "message_created") {
    return NextResponse.json({ ignored: true });
  }

  // todos os clientes compartilham a mesma conta Chatwoot (varias inboxes) --
  // um unico webhook de conta cobre todo mundo; o inbox.id resolve o cliente.
  const inboxId = String(body.inbox?.id ?? "");
  if (!inboxId) return NextResponse.json({ error: "inbox.id ausente" }, { status: 400 });

  const supabase = createServiceClient();
  const { data: settings } = await supabase
    .from("settings")
    .select("client_id")
    .eq("chatwoot_inbox_id", inboxId)
    .maybeSingle();
  if (!settings) {
    return NextResponse.json({ error: "inbox não vinculada a nenhum cliente" }, { status: 404 });
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
    // so cria lead a partir de mensagem real do cliente (incoming) -- o
    // Chatwoot tambem dispara message_created pra eventos de "activity"
    // (ex: "conversa atribuida ao agente X"), que costumam chegar ANTES da
    // primeira mensagem de verdade. Sem esse filtro, o lead nascia com o
    // nome do agente atribuido em vez do nome do cliente (visto em produção:
    // varios leads de clientes/telefones diferentes todos com o mesmo nome
    // de agente).
    if (messageType !== "incoming") {
      return NextResponse.json({ ignored: true, reason: "nao e mensagem incoming" });
    }

    // filtra mensagens de sistema -- o proprio Evolution manda uma
    // notificacao de "instancia conectada"/config de webhook por um contato
    // fake chamado "EvolutionAPI" com numero curto (+123456), nao e lead de
    // verdade. Mesmo filtro que o n8n antigo fazia.
    const contactName = String(body.contact?.name ?? body.sender?.name ?? "").trim();
    const rawPhone = String(body.contact?.phone_number ?? body.conversation?.meta?.sender?.phone_number ?? "");
    const phoneDigits = rawPhone.replace(/\D/g, "");
    if (contactName.toLowerCase() === "evolutionapi" || phoneDigits.length < 8) {
      return NextResponse.json({ ignored: true, reason: "mensagem de sistema" });
    }

    // dedup por telefone+nome nos ultimos 15 dias -- mesmo cliente clicando
    // de novo num anuncio (ou conversa nova com o mesmo contato) dentro da
    // janela nao conta como lead novo nem dispara evento "Lead" outra vez.
    // So 1 captura por lead a cada 15 dias.
    const dedupSince = new Date(Date.now() - 15 * 24 * 60 * 60 * 1000).toISOString();
    const { data: recentDuplicate } = await supabase
      .from("leads")
      .select("id")
      .eq("client_id", settings.client_id)
      .ilike("phone", `%${phoneDigits}%`)
      .ilike("name", contactName)
      .gte("created_at", dedupSince)
      .limit(1)
      .maybeSingle();
    if (recentDuplicate) {
      return NextResponse.json({ ignored: true, reason: "lead duplicado (mesmo telefone+nome, <15 dias)" });
    }

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

    // dados de anuncio resolvidos pelo webhook nativo do Evolution
    // (messages.upsert), que chega antes deste -- busca por telefone, janela
    // de 30min (tempo de sobra entre a 1a mensagem chegar no Evolution e o
    // Chatwoot processar e disparar esse webhook).
    const phone = (body.contact?.phone_number ?? body.conversation?.meta?.sender?.phone_number ?? "")
      .replace(/\D/g, "");
    const since = new Date(Date.now() - 30 * 60 * 1000).toISOString();
    const { data: adData } = phone
      ? await supabase
          .from("ad_attribution_staging")
          .select("source_id, ctwa_clid, ad_id, ad_name, adset_name, campaign_name, account_name")
          .eq("client_id", settings.client_id)
          .ilike("phone", `%${phone}%`)
          .gte("created_at", since)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle()
      : { data: null };

    // sem dado de anuncio do Meta (staging) mas com gclid -- tenta resolver
    // via Google Ads API (click_view). Token de agencia, conta do cliente
    // precisa estar cadastrada em google_ads_accounts.customer_id. Falha
    // graciosamente (ex: Acesso Basico ainda nao aprovado pelo Google).
    let googleAdData: Awaited<ReturnType<typeof resolveAdFromGclid>> = null;
    if (!adData?.campaign_name && visitor?.gclid) {
      const { data: googleAccount } = await supabase
        .from("google_ads_accounts")
        .select("customer_id")
        .eq("client_id", settings.client_id)
        .eq("active", true)
        .limit(1)
        .maybeSingle();
      if (googleAccount) {
        googleAdData = await resolveAdFromGclid(googleAccount.customer_id, visitor.gclid).catch(
          () => null,
        );
      }
    }

    // so registra no CRM conversa com atribuicao real de campanha -- Meta
    // (ctwa_clid/source_id, capturado pelo webhook nativo do Evolution),
    // Google resolvido via Ads API (gclid -> click_view), ou a frase-
    // marcador "vim pelo site" digitada na primeira mensagem (cliques do
    // Google sem app/script proprio). Sem isso e conversa organica direta
    // (numero salvo, indicacao, etc) -- fora do escopo desse tracking.
    const googleMarkerMatched = matchesGoogleMarker(content);
    const hasAttribution =
      Boolean(adData?.source_id || adData?.ctwa_clid || googleAdData?.campaignName || visitor) ||
      googleMarkerMatched;
    if (!hasAttribution) {
      return NextResponse.json({ ignored: true, reason: "sem atribuicao de campanha" });
    }

    const leadPhone = body.contact?.phone_number ?? body.conversation?.meta?.sender?.phone_number ?? null;
    // foto de perfil do contato no WhatsApp -- o Chatwoot ja manda isso no
    // payload (contact.thumbnail), sem precisar de chamada extra a API.
    const avatarUrl =
      body.contact?.thumbnail ?? body.conversation?.meta?.sender?.thumbnail ?? null;

    await supabase.from("leads").insert({
      client_id: settings.client_id,
      conversation_external_id: conversationId,
      stage_id: firstStage?.id ?? null,
      name: body.contact?.name ?? body.sender?.name ?? null,
      phone: leadPhone,
      avatar_url: avatarUrl,
      trck_user_id: visitor?.trck_user_id ?? null,
      // a frase-marcador so identifica a ORIGEM (Google) -- sem campanha
      // resolvida (ex: sem app/script proprio), nao tem outro campo onde
      // guardar isso. utm_source aqui e o que alimenta a coluna "Origem".
      utm_source: visitor?.utm_source ?? (googleMarkerMatched ? "google" : null),
      utm_medium: visitor?.utm_medium ?? null,
      utm_campaign: visitor?.utm_campaign ?? null,
      source_id: adData?.source_id ?? null,
      ctwa_clid: adData?.ctwa_clid ?? null,
      ad_id: adData?.ad_id ?? googleAdData?.adId ?? null,
      ad_name: adData?.ad_name ?? null,
      adset_name: adData?.adset_name ?? googleAdData?.adGroupName ?? null,
      campaign_name: adData?.campaign_name ?? googleAdData?.campaignName ?? null,
      account_name: adData?.account_name ?? null,
    });

    // dispara evento "Lead" pro Pixel/CAPI e GA4 do cliente, se tiverem
    // cadastrados (dispatchEvent ja resolve isso e nao faz nada, sem erro,
    // se o cliente nao tiver pixel/ga4 configurado). So o Purchase (no
    // fechamento, ver dispatch-purchase.ts) disparava antes -- isso aqui
    // cobre o evento de topo de funil, importante pra otimizacao de
    // campanha no Ads Manager.
    if (leadPhone) {
      const eventId = randomUUID();
      const result = await dispatchEvent({
        clientId: settings.client_id,
        eventName: "Lead",
        eventId,
        ip,
        userAgent: request.headers.get("user-agent"),
        visitor: { ctwa_clid: adData?.ctwa_clid ?? null },
        phoneHash: hashPhone(leadPhone),
      });
      await supabase.from("events_log").insert({
        client_id: settings.client_id,
        event_name: "Lead",
        event_id: eventId,
        payload_meta: result.payloadMeta,
        response_meta: result.responseMeta,
      });
    }

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
      await maybeDispatchPurchaseForLead(lead.id, settings.client_id);
      return NextResponse.json({ lead: "moved", stage_id: match.stage_id });
    }
  }

  return NextResponse.json({ lead: "unchanged" });
}
