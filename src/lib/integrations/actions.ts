"use server";

import { getProfile } from "@/lib/auth/profile";
import { createServiceClient } from "@/lib/supabase/server";
import { encryptSecret } from "@/lib/crypto";
import { revalidatePath } from "next/cache";

const TABLES = {
  ga4: { table: "ga4_accounts", idField: "measurement_id", secretField: "api_secret_enc" },
  meta_pixel: { table: "meta_pixels", idField: "pixel_id", secretField: "capi_token_enc" },
  meta_ads: { table: "meta_ad_accounts", idField: "ad_account_id", secretField: "ads_token_enc" },
} as const;

type IntegrationType = keyof typeof TABLES;

async function assertAccess(clientId: string) {
  const profile = await getProfile();
  if (!profile) throw new Error("Não autenticado");
  if (profile.role !== "agency_admin" && profile.client_id !== clientId) {
    throw new Error("Sem acesso a esse cliente");
  }
  return profile;
}

export async function addIntegrationAccount(type: IntegrationType, formData: FormData) {
  const clientId = String(formData.get("client_id"));
  await assertAccess(clientId);
  const { table, idField, secretField } = TABLES[type];

  const label = String(formData.get("label") ?? "").trim();
  const idValue = String(formData.get(idField) ?? "").trim();
  const secret = String(formData.get("secret") ?? "").trim();
  if (!label || !idValue || !secret) throw new Error("Preencha todos os campos");

  const supabase = createServiceClient();
  const { error } = await supabase.from(table).insert({
    client_id: clientId,
    label,
    [idField]: idValue,
    [secretField]: encryptSecret(secret),
  });
  if (error) throw error;

  revalidateConfigPaths(clientId);
}

export async function removeIntegrationAccount(
  type: IntegrationType,
  accountId: string,
  clientId: string,
) {
  await assertAccess(clientId);
  const supabase = createServiceClient();
  const { error } = await supabase.from(TABLES[type].table).delete().eq("id", accountId);
  if (error) throw error;
  revalidateConfigPaths(clientId);
}

export async function addGoogleAdsAccount(formData: FormData) {
  const clientId = String(formData.get("client_id"));
  await assertAccess(clientId);

  const label = String(formData.get("label") ?? "").trim();
  const customerId = String(formData.get("customer_id") ?? "").trim();
  const loginCustomerId = String(formData.get("login_customer_id") ?? "").trim() || null;
  const refreshToken = String(formData.get("refresh_token") ?? "").trim();
  const developerToken = String(formData.get("developer_token") ?? "").trim();
  if (!label || !customerId || !refreshToken || !developerToken) {
    throw new Error("Preencha todos os campos obrigatórios");
  }

  const supabase = createServiceClient();
  const { error } = await supabase.from("google_ads_accounts").insert({
    client_id: clientId,
    label,
    customer_id: customerId,
    login_customer_id: loginCustomerId,
    refresh_token_enc: encryptSecret(refreshToken),
    developer_token_enc: encryptSecret(developerToken),
  });
  if (error) throw error;
  revalidateConfigPaths(clientId);
}

export async function removeGoogleAdsAccount(accountId: string, clientId: string) {
  await assertAccess(clientId);
  const supabase = createServiceClient();
  const { error } = await supabase.from("google_ads_accounts").delete().eq("id", accountId);
  if (error) throw error;
  revalidateConfigPaths(clientId);
}

export async function updateWhatsappNumber(formData: FormData) {
  const clientId = String(formData.get("client_id"));
  await assertAccess(clientId);

  const whatsappNumber = String(formData.get("whatsapp_number") ?? "").trim();
  const supabase = createServiceClient();
  const { error } = await supabase
    .from("settings")
    .update({ whatsapp_number: whatsappNumber, updated_at: new Date().toISOString() })
    .eq("client_id", clientId);
  if (error) throw error;
  revalidateConfigPaths(clientId);
}

function revalidateConfigPaths(clientId: string) {
  revalidatePath(`/admin/clients/${clientId}/configuracoes`);
  revalidatePath("/cliente/configuracoes");
}
