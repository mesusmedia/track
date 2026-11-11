import { createServiceClient } from "@/lib/supabase/server";
import { decryptSecret, byteaToBuffer } from "@/lib/crypto";
import { appendSheetBackupRow } from "@/lib/google-sheets/client";
import { buildSafeCustomFieldsValues, fetchCustomFields, findLeadIdByPhone, updateLeadCustomFields } from "@/lib/kommo/client";

// IDs de custom field extraidos do pipeline n8n antigo (workflow Kommo) --
// servem de ponto de partida, mas buildSafeCustomFieldsValues sempre
// confere contra a definicao real da conta antes de usar qualquer um.
const KOMMO_FIELD_MAPS: Record<string, Record<string, number>> = {
  clinicagoesearaujo: {
    utm_source: 3725144,
    utm_medium: 3725140,
    utm_campaign: 3725142,
    utm_content: 3725138,
    origem: 3727490,
    suborigem: 3727548,
    meta_ad_id: 3841588,
    meta_adset_id: 3841590,
    meta_campaign_id: 3841592,
    nome_anuncio: 3841586,
    nome_conjunto: 3841584,
    nome_campanha: 3841582,
  },
  efitapetininga: {
    utm_source: 1016388,
    utm_medium: 1016384,
    utm_campaign: 1016386,
    utm_content: 1016382,
    origem: 2000794,
    suborigem: 2000796,
    meta_ad_id: 2004612,
    meta_adset_id: 2004614,
    meta_campaign_id: 2004616,
    nome_anuncio: 2004618,
    nome_conjunto: 2004620,
    nome_campanha: 2004622,
  },
};

export type FinishedLead = {
  clientId: string;
  nome: string | null;
  numero: string | null;
  mensagem?: string | null;
  campanha?: string | null;
  conjunto?: string | null; // adset_name
  anuncio?: string | null; // ad_name
  adId?: string | null;
  sourceId?: string | null;
  ctwaClid?: string | null;
  origem?: string | null; // "Meta" | "Google" | etc, so pra exibicao
};

function suborigemOf(lead: FinishedLead) {
  if (lead.sourceId || lead.ctwaClid) return "[MP] Meta";
  if (lead.campanha) return "[MP] Google";
  return "Orgânico";
}

// Feature A -- backup em Google Sheets. Nunca lanca: falha de rede/planilha
// nao pode derrubar a criacao do lead no Supabase (fonte de verdade).
export async function backupToSheet(lead: FinishedLead) {
  const supabase = createServiceClient();
  const { data: settings } = await supabase
    .from("settings")
    .select("sheet_id, sheet_gid")
    .eq("client_id", lead.clientId)
    .maybeSingle();
  if (!settings?.sheet_id) return;

  try {
    await appendSheetBackupRow(settings.sheet_id, settings.sheet_gid ?? "1048674045", {
      nome: lead.nome,
      numero: lead.numero,
      mensagem: lead.mensagem,
      origem: lead.sourceId || lead.ctwaClid ? "Mídia Paga" : lead.campanha ? "Mídia Paga" : "Orgânico",
      suborigem: suborigemOf(lead),
      campanha: lead.campanha,
      conjunto: lead.conjunto,
      anuncio: lead.anuncio,
      adId: lead.adId,
      plataforma: lead.sourceId || lead.ctwaClid ? "meta" : lead.campanha ? "google" : "whatsapp",
      sourceId: lead.sourceId,
      ctwaClid: lead.ctwaClid,
    });
  } catch (err) {
    console.error(`[sheets-backup] client=${lead.clientId}`, err);
  }
}

// Feature B -- dual-write Kommo pros 2 clientes que usam Kommo em vez do
// kanban interno. So roda se settings.kommo_subdomain/kommo_token_enc
// estiverem preenchidos (clientes sem Kommo simplesmente nao tem essas
// colunas setadas e esta funcao vira no-op). Nunca lanca.
export async function syncToKommo(lead: FinishedLead) {
  if (!lead.numero) return;
  const supabase = createServiceClient();
  const { data: settings } = await supabase
    .from("settings")
    .select("kommo_subdomain, kommo_token_enc")
    .eq("client_id", lead.clientId)
    .maybeSingle();
  if (!settings?.kommo_subdomain || !settings.kommo_token_enc) return;

  const subdomain = settings.kommo_subdomain;
  const fieldMap = KOMMO_FIELD_MAPS[subdomain];
  if (!fieldMap) {
    console.error(`[kommo-sync] sem field map conhecido para subdomain=${subdomain}`);
    return;
  }

  try {
    const token = decryptSecret(byteaToBuffer(settings.kommo_token_enc));
    const leadId = await findLeadIdByPhone(subdomain, token, lead.numero);
    if (!leadId) {
      console.error(`[kommo-sync] nenhum lead encontrado no Kommo pra ${lead.numero} (${subdomain})`);
      return;
    }

    const fieldDefs = await fetchCustomFields(subdomain, token);
    const values = buildSafeCustomFieldsValues(
      fieldMap,
      {
        utm_source: lead.sourceId || lead.ctwaClid ? "meta" : lead.campanha ? "google" : null,
        origem: lead.campanha ? "Mídia Paga" : "Orgânico",
        suborigem: suborigemOf(lead),
        nome_campanha: lead.campanha,
        nome_conjunto: lead.conjunto,
        nome_anuncio: lead.anuncio,
        meta_ad_id: lead.adId,
      },
      fieldDefs,
    );
    await updateLeadCustomFields(subdomain, token, leadId, values);
  } catch (err) {
    console.error(`[kommo-sync] client=${lead.clientId}`, err);
  }
}
