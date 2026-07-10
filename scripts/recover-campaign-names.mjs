/**
 * Recupera campaign_name / ad_name / adset_name para leads que têm source_id
 * mas campaign_name NULL (período pré-staging, antes de 2026-07-07).
 *
 * Uso:
 *   node scripts/recover-campaign-names.mjs           # dry-run (só mostra o que faria)
 *   node scripts/recover-campaign-names.mjs --apply   # aplica os updates
 */

import { createClient } from "@supabase/supabase-js";

const DRY_RUN = !process.argv.includes("--apply");

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
);

async function getToken() {
  const { data } = await supabase
    .from("meta_app_token")
    .select("access_token_enc")
    .eq("id", 1)
    .maybeSingle();
  if (!data) throw new Error("Meta App Token não encontrado no banco.");

  // layout: [iv(12) | authTag(16) | ciphertext] — igual lib/crypto.ts
  const { createDecipheriv } = await import("crypto");
  const key = Buffer.from(process.env.SECRETS_ENCRYPTION_KEY, "hex");
  const raw = Buffer.from(
    typeof data.access_token_enc === "string"
      ? data.access_token_enc.replace(/^\\x/, "")
      : data.access_token_enc.toString("hex"),
    "hex",
  );
  const iv = raw.subarray(0, 12);
  const authTag = raw.subarray(12, 28);
  const ciphertext = raw.subarray(28);
  const decipher = createDecipheriv("aes-256-gcm", key, iv);
  decipher.setAuthTag(authTag);
  return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString("utf8");
}

async function resolveSourceId(sourceId, token) {
  const url = `https://graph.facebook.com/v21.0/${sourceId}/insights?fields=campaign_name,adset_name,ad_name,ad_id,account_id,account_name&access_token=${token}`;
  const res = await fetch(url);
  const body = await res.json().catch(() => null);
  if (!res.ok || !body?.data?.[0]) return null;
  const row = body.data[0];
  return {
    campaign_name: row.campaign_name ?? null,
    adset_name: row.adset_name ?? null,
    ad_name: row.ad_name ?? null,
    ad_id: row.ad_id ?? null,
    account_name: row.account_name ?? null,
  };
}

async function main() {
  console.log(DRY_RUN ? "🔍 DRY RUN — nenhuma alteração será feita\n" : "✅ APPLY MODE — atualizando banco\n");

  const token = await getToken();
  console.log("Token Meta OK\n");

  // busca todos leads com source_id mas sem campaign_name
  const { data: leads, error } = await supabase
    .from("leads")
    .select("id, source_id, phone, client_id")
    .not("source_id", "is", null)
    .is("campaign_name", null)
    .not("ctwa_clid", "is", null);

  if (error) throw error;
  console.log(`Leads para processar: ${leads.length}\n`);

  // agrupa por source_id para não chamar a API repetido para o mesmo anúncio
  const bySourceId = {};
  for (const lead of leads) {
    if (!bySourceId[lead.source_id]) bySourceId[lead.source_id] = [];
    bySourceId[lead.source_id].push(lead.id);
  }

  const sourceIds = Object.keys(bySourceId);
  console.log(`source_ids únicos: ${sourceIds.length}\n`);

  let resolved = 0;
  let failed = 0;

  for (const sourceId of sourceIds) {
    const result = await resolveSourceId(sourceId, token);
    const leadIds = bySourceId[sourceId];

    if (!result) {
      console.log(`❌ ${sourceId} → sem dados (anúncio deletado ou sem permissão)`);
      failed++;
      continue;
    }

    console.log(`✓  ${sourceId} → ${result.campaign_name} / ${result.ad_name}`);

    if (!DRY_RUN) {
      const { error: upErr } = await supabase
        .from("leads")
        .update({ ...result, updated_at: new Date().toISOString() })
        .in("id", leadIds);
      if (upErr) console.error(`   UPDATE error: ${upErr.message}`);
    } else {
      console.log(`   afeta ${leadIds.length} lead(s)`);
    }

    resolved++;
    // pausa breve para não estourar rate limit da Graph API
    await new Promise((r) => setTimeout(r, 150));
  }

  console.log(`\n--- Resumo ---`);
  console.log(`Resolvidos: ${resolved} source_ids (${leads.length - bySourceId[Object.keys(bySourceId).find(k => !bySourceId[k])] ?? leads.length} leads)`);
  console.log(`Falhou/sem dados: ${failed} source_ids`);
  if (DRY_RUN) console.log("\nRode com --apply para aplicar.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
