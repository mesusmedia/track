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
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
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

  // ponytail: passa um codigo de referencia (8 primeiros chars do
  // trck_user_id) na mensagem prefilled; o webhook do WhatsApp (Fase 5/6)
  // le esse codigo na primeira mensagem pra linkar o lead ao visitante.
  // Upgrade futuro: usar o ctwa_clid nativo do Meta quando disponivel.
  const ref = visitor.trck_user_id.slice(0, 8);
  const text = encodeURIComponent(`(ref:${ref})`);
  const waUrl = `https://wa.me/${settings.whatsapp_number}?text=${text}`;

  return NextResponse.redirect(waUrl, 302);
}
