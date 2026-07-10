import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { isRateLimited } from "@/lib/rate-limit";

// Link de redirecionamento inteligente: o anuncio (Meta ou Google) usa esta
// rota como destino em vez de ir direto pro wa.me. Isso permite capturar
// fbclid/gclid/UTMs antes de abrir o WhatsApp -- sem isso, cliques direto pro
// WhatsApp nao deixam rastro nenhum do lado do Google Ads.
export async function GET(
  request: Request,
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug } = await params;
  const ip = request.headers.get("x-forwarded-for")?.split(",").at(-1)?.trim() ?? "unknown";
  if (isRateLimited(`go:${ip}`)) {
    return NextResponse.json({ error: "rate_limited" }, { status: 429 });
  }

  const supabase = createServiceClient();
  const { data: client } = await supabase
    .from("clients")
    .select("id")
    .eq("slug", slug)
    .single();
  if (!client) return NextResponse.json({ error: "cliente não encontrado" }, { status: 404 });

  const { data: settings } = await supabase
    .from("settings")
    .select("whatsapp_number")
    .eq("client_id", client.id)
    .single();
  if (!settings?.whatsapp_number) {
    return NextResponse.json({ error: "número de WhatsApp não configurado" }, { status: 500 });
  }

  const url = new URL(request.url);
  const utmFields = ["utm_source", "utm_medium", "utm_campaign", "utm_term", "utm_content"];
  const visitorData: Record<string, unknown> = {
    client_id: client.id,
    ip,
    user_agent: request.headers.get("user-agent") ?? null,
    referrer: request.headers.get("referer") ?? null,
    fbclid: url.searchParams.get("fbclid"),
    gclid: url.searchParams.get("gclid"),
  };
  for (const field of utmFields) {
    visitorData[field] = url.searchParams.get(field);
  }

  const { data: visitor, error } = await supabase
    .from("visitors")
    .insert(visitorData)
    .select("trck_user_id")
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // injeta (ref:XXXXXXXX) no texto pra o webhook Chatwoot conseguir ligar
  // a mensagem ao visitor (que tem gclid/utm) sem depender de janela de tempo.
  const refSuffix = visitor?.trck_user_id
    ? ` (ref:${visitor.trck_user_id.slice(0, 8)})`
    : "";
  const baseText = url.searchParams.get("text") ?? "";
  const waText = (baseText + refSuffix).trim() || null;
  const waUrl = waText
    ? `https://wa.me/${settings.whatsapp_number}?text=${encodeURIComponent(waText)}`
    : `https://wa.me/${settings.whatsapp_number}`;

  return NextResponse.redirect(waUrl, 302);
}
