import { createClient } from "@/lib/supabase/server";
import { decryptSecret, maskSecret, byteaToBuffer } from "@/lib/crypto";

type Account = { id: string; label: string; masked: string; idValue: string };

export async function loadIntegrationAccounts(clientId: string) {
  const supabase = await createClient();

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
    supabase
      .from("settings")
      .select("webhook_token, whatsapp_number")
      .eq("client_id", clientId)
      .single(),
  ]);

  return {
    settings: settings.data ?? { webhook_token: "", whatsapp_number: "" },
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
        masked: maskSecret(decryptSecret(byteaToBuffer(a.refresh_token_enc))),
      }),
    ),
  };
}
