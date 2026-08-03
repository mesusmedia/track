import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { isRateLimited } from "@/lib/rate-limit";

// Link de rastreamento universal: usado como URL final em anúncios Meta e Google.
// Captura UTMs + fbclid/gclid, registra o visitor e redireciona para:
//   - landing_page_url (se configurado) — passa UTMs/clids para a LP também
//   - wa.me (fallback) — injeta ref para vincular a conversa ao visitor
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
    .select("whatsapp_number, landing_page_url")
    .eq("client_id", client.id)
    .single();

  const inUrl = new URL(request.url);
  const utmFields = ["utm_source", "utm_medium", "utm_campaign", "utm_term", "utm_content"] as const;
  const visitorData: Record<string, unknown> = {
    client_id: client.id,
    ip,
    user_agent: request.headers.get("user-agent") ?? null,
    referrer: request.headers.get("referer") ?? null,
    fbclid: inUrl.searchParams.get("fbclid"),
    gclid: inUrl.searchParams.get("gclid"),
  };
  for (const field of utmFields) {
    visitorData[field] = inUrl.searchParams.get(field);
  }

  const { data: visitor } = await supabase
    .from("visitors")
    .insert(visitorData)
    .select("trck_user_id")
    .single();

  // ── redireciona para landing page ──────────────────────────────────────
  // dest=wa: vem do snippet da LP (botão de WhatsApp reescrito) — vai direto
  // pro WhatsApp independente de landing_page_url, senão seria loop infinito.
  if (settings?.landing_page_url && inUrl.searchParams.get("dest") !== "wa") {
    const dest = new URL(settings.landing_page_url);

    // repassa UTMs para a LP para que o pixel instalado nela também os capture
    for (const field of utmFields) {
      const v = inUrl.searchParams.get(field);
      if (v) dest.searchParams.set(field, v);
    }
    const fbclid = inUrl.searchParams.get("fbclid");
    const gclid  = inUrl.searchParams.get("gclid");
    if (fbclid) dest.searchParams.set("fbclid", fbclid);
    if (gclid)  dest.searchParams.set("gclid",  gclid);

    // trck_id permite que o snippet da LP resolva o visitor já registrado
    if (visitor?.trck_user_id) dest.searchParams.set("trck_id", visitor.trck_user_id);

    return NextResponse.redirect(dest.toString(), 302);
  }

  // ── fallback: redireciona para WhatsApp ───────────────────────────────
  // phone da query string (extraído do wa.me original pelo tag script) serve
  // como fallback quando o cliente não tem whatsapp_number no settings.
  const waNumber = settings?.whatsapp_number || inUrl.searchParams.get("phone");
  if (!waNumber) {
    return NextResponse.json({ error: "nenhum destino configurado" }, { status: 500 });
  }

  const destWa = inUrl.searchParams.get("dest") === "wa";
  const refSuffix =
    !destWa && visitor?.trck_user_id
      ? ` (ref:${visitor.trck_user_id.slice(0, 8)})`
      : "";
  const baseText = inUrl.searchParams.get("text") ?? "";
  const waText = (baseText + refSuffix).trim() || null;
  const waUrl = waText
    ? `https://wa.me/${waNumber}?text=${encodeURIComponent(waText)}`
    : `https://wa.me/${waNumber}`;

  return NextResponse.redirect(waUrl, 302);
}
