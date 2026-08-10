import { NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { createServiceClient } from "@/lib/supabase/server";
import { resolveAdFromSourceId } from "@/lib/meta/ads-insights";
import { getMetaAppToken } from "@/lib/meta/token";
import { dispatchEvent } from "@/lib/dispatch";
import { hashPhone } from "@/lib/hash";

// Webhook da API Oficial do WhatsApp (Meta Cloud API).
//
// Cria o lead DIRETO no CRM sem passar pelo Chatwoot nem pelo Evolution.
// O Chatwoot pode ainda ser usado para atendimento, mas nao e mais o
// intermediario obrigatorio do tracking -- esse webhook e o unico ponto
// de captura.
//
// Payload da Meta por mensagem:
//   entry[].changes[].value.metadata.phone_number_id → identifica o cliente
//   entry[].changes[].value.contacts[].profile.name  → nome do contato
//   entry[].changes[].value.messages[].from          → telefone
//   entry[].changes[].value.messages[].referral      → dados do anuncio CTWA
//     .source_id   equivale ao externalAdReply.sourceId do Evolution
//     .ctwa_clid   equivale ao externalAdReply.ctwaClid do Evolution
//     .source_type "ad" = veio de anuncio

export async function GET(request: Request) {
  const url = new URL(request.url);
  const mode = url.searchParams.get("hub.mode");
  const token = url.searchParams.get("hub.verify_token");
  const challenge = url.searchParams.get("hub.challenge");

  if (mode === "subscribe" && token === process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN) {
    return new Response(challenge ?? "", { status: 200 });
  }
  return NextResponse.json({ error: "forbidden" }, { status: 403 });
}

export async function POST(request: Request) {
  const ip =
    request.headers.get("x-forwarded-for")?.split(",").at(-1)?.trim() ?? "unknown";

  const body = await request.json().catch(() => null);
  if (!body || body.object !== "whatsapp_business_account") {
    return NextResponse.json({ ignored: true });
  }

  const supabase = createServiceClient();

  for (const entry of body.entry ?? []) {
    for (const change of entry.changes ?? []) {
      if (change.field !== "messages") continue;
      const value = change.value;

      const phoneNumberId = value?.metadata?.phone_number_id as string | undefined;
      if (!phoneNumberId) continue;

      // index de nome por wa_id -- contacts vem junto com messages no mesmo payload
      const contactNames: Record<string, string> = {};
      for (const contact of value?.contacts ?? []) {
        if (contact.wa_id && contact.profile?.name) {
          contactNames[contact.wa_id] = contact.profile.name;
        }
      }

      for (const msg of value?.messages ?? []) {
        // so mensagens recebidas (do contato); ignorar status e mensagens proprias
        if (msg.from_me) continue;

        const phone = String(msg.from ?? "").replace(/\D/g, "");
        if (!phone) continue;

        const referral = msg.referral;

        // so rastreia quem veio de anuncio Meta (source_id presente)
        if (!referral?.source_id) continue;

        // resolve o cliente pelo phone_number_id
        const { data: settings } = await supabase
          .from("settings")
          .select("client_id")
          .eq("waba_phone_number_id", phoneNumberId)
          .maybeSingle();
        if (!settings) continue;

        const clientId = settings.client_id;

        // dedup: mesmo telefone nos ultimos 15 dias nao gera lead novo
        const dedupSince = new Date(Date.now() - 15 * 24 * 60 * 60 * 1000).toISOString();
        const { data: existing } = await supabase
          .from("leads")
          .select("id")
          .eq("client_id", clientId)
          .ilike("phone", `%${phone}%`)
          .gte("created_at", dedupSince)
          .limit(1)
          .maybeSingle();
        if (existing) continue;

        // nome do contato (vem no contacts[] do payload)
        const rawName = contactNames[phone] ?? contactNames[msg.from] ?? "";
        const nameIsPhone = /^\+?[\d\s\-().]{7,}$/.test(rawName);
        const contactName = nameIsPhone ? "" : rawName;

        // primeira etapa do funil desse cliente
        const { data: firstStage } = await supabase
          .from("pipeline_stages")
          .select("id")
          .eq("client_id", clientId)
          .order("position", { ascending: true })
          .limit(1)
          .maybeSingle();

        // resolve nome de campanha/anuncio via Graph API
        // ponytail: resolve antes de inserir para nao ter lead sem campanha
        let adFields: {
          ad_id?: string | null;
          ad_name?: string | null;
          adset_name?: string | null;
          campaign_name?: string | null;
          account_name?: string | null;
        } = {};

        const metaToken = await getMetaAppToken();
        if (metaToken && referral.source_id) {
          const resolved = await resolveAdFromSourceId(referral.source_id, metaToken).catch(
            (err) => {
              console.error(
                "[whatsapp/webhook] resolveAdFromSourceId:",
                err?.message,
                "source_id:",
                referral.source_id,
              );
              return null;
            },
          );
          if (resolved) {
            adFields = {
              ad_id: resolved.adId,
              ad_name: resolved.adName,
              adset_name: resolved.adsetName,
              campaign_name: resolved.campaignName,
              account_name: resolved.accountName,
            };
          }
        }

        const leadPhone = `+${phone}`;
        await supabase.from("leads").insert({
          client_id: clientId,
          stage_id: firstStage?.id ?? null,
          name: contactName || null,
          phone: leadPhone,
          source_id: referral.source_id,
          ctwa_clid: referral.ctwa_clid ?? null,
          utm_source: "meta",
          ...adFields,
        });

        // dispara evento Lead no Pixel/CAPI do cliente
        const eventId = randomUUID();
        const result = await dispatchEvent({
          clientId,
          eventName: "Lead",
          eventId,
          ip,
          userAgent: request.headers.get("user-agent"),
          visitor: { ctwa_clid: referral.ctwa_clid ?? null },
          phoneHash: hashPhone(leadPhone),
        });
        await supabase.from("events_log").insert({
          client_id: clientId,
          event_name: "Lead",
          event_id: eventId,
          payload_meta: result.payloadMeta,
          response_meta: result.responseMeta,
        });
      }
    }
  }

  // Meta exige 200 rapido; todo o processamento acima e sincrono mas leve
  return NextResponse.json({ ok: true });
}
