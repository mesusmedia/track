import { createClient, createServiceClient } from "@/lib/supabase/server";
import { decryptSecret, maskSecret, byteaToBuffer } from "@/lib/crypto";

type Account = { id: string; label: string; masked: string; idValue: string };

export async function loadIntegrationAccounts(clientId: string) {
  const supabase = await createClient();
  // settings lida via serviceClient para não depender de RLS (bytea enc precisa
  // ser lido mesmo quando a política de tenant não inclui o admin corretamente)
  const serviceSupabase = createServiceClient();

  const [ga4, metaPixels, metaAds, googleAds, settings] = await Promise.all([
    supabase
      .from("ga4_accounts")
      .select("id, label, measurement_id, api_secret_enc")
      .eq("client_id", clientId),
    supabase
      .from("meta_pixels")
      .select("id, label, pixel_id, capi_token_enc")
      .eq("client_id", clientId),
    supabase
      .from("meta_ad_accounts")
      .select("id, label, ad_account_id, ads_token_enc")
      .eq("client_id", clientId),
    supabase
      .from("google_ads_accounts")
      .select("id, label, customer_id, refresh_token_enc")
      .eq("client_id", clientId),
    serviceSupabase
      .from("settings")
      .select(
        "webhook_token, whatsapp_number, landing_page_url, evolution_instance_apikey_enc, chatwoot_inbox_id, test_event_code, meta_waba_id, waba_phone_number_id",
      )
      .eq("client_id", clientId)
      .single(),
  ]);

  return {
    settings: settings.data ?? {
      webhook_token: "",
      whatsapp_number: "",
      landing_page_url: null,
      evolution_instance_apikey_enc: null,
      chatwoot_inbox_id: null,
      test_event_code: null,
      meta_waba_id: null,
      waba_phone_number_id: null,
    },
    ga4: (ga4.data ?? []).map(
      (a): Account => ({
        id: a.id,
        label: a.label,
        idValue: a.measurement_id,
        masked: maskSecret(decryptSecret(byteaToBuffer(a.api_secret_enc))),
      }),
    ),
    metaPixels: (metaPixels.data ?? []).map(
      (a): Account => ({
        id: a.id,
        label: a.label,
        idValue: a.pixel_id,
        masked: maskSecret(decryptSecret(byteaToBuffer(a.capi_token_enc))),
      }),
    ),
    metaAds: (metaAds.data ?? []).map(
      (a): Account => ({
        id: a.id,
        label: a.label,
        idValue: a.ad_account_id,
        masked: maskSecret(decryptSecret(byteaToBuffer(a.ads_token_enc))),
      }),
    ),
    googleAds: (googleAds.data ?? []).map(
      (a): Account => ({
        id: a.id,
        label: a.label,
        idValue: a.customer_id,
        // contas cadastradas pelo fluxo agencia-wide (gclid -> token unico da
        // agencia, ver CLAUDE.md) nao tem refresh_token_enc proprio -- so as
        // antigas, por-cliente, tem.
        masked: a.refresh_token_enc
          ? maskSecret(decryptSecret(byteaToBuffer(a.refresh_token_enc)))
          : "token da agência (MCC)",
      }),
    ),
  };
}
