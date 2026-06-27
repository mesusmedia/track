import { META_GRAPH_API_BASE } from "./constants";

// sourceId vem de contextInfo.externalAdReply.sourceId na mensagem nativa do
// WhatsApp -- e o id do objeto do anuncio no Graph API, dá pra consultar
// /insights direto pra pegar os nomes de campanha/conjunto/anuncio/conta.
// Confirmado contra o pipeline n8n existente da agencia (que já faz exatamente isso).
export async function resolveAdFromSourceId(sourceId: string, accessToken: string) {
  const url = `${META_GRAPH_API_BASE}/${sourceId}/insights?fields=campaign_name,adset_name,ad_name,ad_id,account_id,account_name&access_token=${accessToken}`;
  const res = await fetch(url);
  const body = await res.json().catch(() => null);
  const row = body?.data?.[0];
  if (!res.ok || !row) return null;

  return {
    adId: row.ad_id as string | undefined,
    adName: row.ad_name as string | undefined,
    adsetName: row.adset_name as string | undefined,
    campaignName: row.campaign_name as string | undefined,
    accountName: row.account_name as string | undefined,
  };
}
