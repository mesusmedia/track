import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { resolveAdFromSourceId } from "@/lib/meta/ads-insights";
import { getMetaAppToken } from "@/lib/meta/token";
import { matchesGoogleMarker } from "@/lib/ad-attribution";

// webhook nativo do Evolution (messages.upsert) -- diferente do webhook do
// Chatwoot (Fase 5/6): esse chega ANTES do Chatwoot processar a mensagem e
// preserva o contexto nativo do WhatsApp (externalAdReply com sourceId/
// ctwaClid), que o Chatwoot normaliza e descarta. So a primeira mensagem de
// cada conversa importa -- o resto e ignorado (dedup fica por conta do lead
// ja existir quando o Chatwoot processar).
// ponytail: sem rate-limit aqui (fonte confiavel, servidor proprio da
// agencia, volume de todas as 33 instancias passa por um IP so).
export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  if (!body || body.event !== "messages.upsert") return NextResponse.json({ ignored: true });
  if (body.data?.key?.fromMe) return NextResponse.json({ ignored: true });

  const instanceName = body.instance as string | undefined;
  const remoteJid = body.data?.key?.remoteJid as string | undefined;
  if (!instanceName || !remoteJid) return NextResponse.json({ error: "payload incompleto" }, { status: 400 });

  const phone = remoteJid.match(/\d+/g)?.[0];
  if (!phone) return NextResponse.json({ ignored: true });

  const supabase = createServiceClient();
  const { data: settings } = await supabase
    .from("settings")
    .select("client_id")
    .eq("evolution_instance_name", instanceName)
    .maybeSingle();

  // clientes criados do zero usam o slug como nome de instancia, nao tem
  // evolution_instance_name preenchido.
  let clientId = settings?.client_id as string | undefined;
  if (!clientId) {
    const { data: client } = await supabase.from("clients").select("id").eq("slug", instanceName).maybeSingle();
    clientId = client?.id;
  }
  if (!clientId) return NextResponse.json({ ignored: true });

  const message = body.data?.message ?? {};
  const contextInfo = message.extendedTextMessage?.contextInfo ?? body.data?.contextInfo ?? {};
  const adReply = contextInfo.externalAdReply;
  const text = message.conversation ?? message.extendedTextMessage?.text ?? "";

  const staging: Record<string, unknown> = { client_id: clientId, phone };

  if (adReply?.sourceId) {
    staging.source_id = adReply.sourceId;
    staging.ctwa_clid = adReply.ctwaClid ?? null;
    staging.origin = "meta";
  } else if (matchesGoogleMarker(text)) {
    staging.origin = "google";
  } else {
    return NextResponse.json({ ignored: true });
  }

  // grava AGORA, antes de chamar a Graph API -- e o sinal minimo (source_id/
  // ctwa_clid/origin) que o webhook do Chatwoot precisa pra nao descartar o
  // lead. Resolver o nome da campanha pode demorar mais que o Chatwoot levar
  // pra processar a mensagem; se isso acontecesse ANTES de gravar (jeito
  // antigo), o lead inteiro era perdido, nao so a atribuicao -- visto em
  // producao (lead "Ademir Pereira Moura" nunca chegou no CRM apesar do
  // clique de anuncio real).
  const { data: inserted, error } = await supabase
    .from("ad_attribution_staging")
    .insert(staging)
    .select("id")
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  if (adReply?.sourceId) {
    const token = await getMetaAppToken();
    if (token) {
      const resolved = await resolveAdFromSourceId(adReply.sourceId, token);
      if (resolved) {
        const resolvedFields = {
          ad_id: resolved.adId,
          ad_name: resolved.adName,
          adset_name: resolved.adsetName,
          campaign_name: resolved.campaignName,
          account_name: resolved.accountName,
        };
        await supabase.from("ad_attribution_staging").update(resolvedFields).eq("id", inserted.id);
        Object.assign(staging, resolvedFields);
      }
    }
  }

  // corrida residual: o NOME da campanha (Graph API) ainda pode chegar
  // depois do lead ja criado (sem source_id/ctwa_clid faltando mais, so o
  // nome) -- atualiza retroativamente em vez de deixar "Origem" incompleta.
  const since = new Date(Date.now() - 10 * 60 * 1000).toISOString();
  await supabase
    .from("leads")
    .update({
      source_id: staging.source_id ?? null,
      ctwa_clid: staging.ctwa_clid ?? null,
      ad_id: staging.ad_id ?? null,
      ad_name: staging.ad_name ?? null,
      adset_name: staging.adset_name ?? null,
      campaign_name: staging.campaign_name ?? null,
      account_name: staging.account_name ?? null,
    })
    .eq("client_id", clientId)
    .ilike("phone", `%${phone}%`)
    .is("campaign_name", null)
    .is("ctwa_clid", null)
    .gte("created_at", since);

  return NextResponse.json({ staged: true });
}
