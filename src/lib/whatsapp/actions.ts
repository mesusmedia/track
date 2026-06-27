"use server";

import { getProfile } from "@/lib/auth/profile";
import { createServiceClient } from "@/lib/supabase/server";
import { encryptSecret, decryptSecret, bufferToBytea, byteaToBuffer } from "@/lib/crypto";
import * as evolution from "@/lib/evolution/client";
import { findInboxIdByName } from "@/lib/chatwoot/client";
import { revalidatePath } from "next/cache";

async function assertAccess(clientId: string) {
  const profile = await getProfile();
  if (!profile) throw new Error("Não autenticado");
  if (profile.role !== "agency_admin" && profile.client_id !== clientId) {
    throw new Error("Sem acesso a esse cliente");
  }
}

async function getClientSlugAndApiKey(clientId: string) {
  const supabase = createServiceClient();
  const [{ data: client }, { data: settings }] = await Promise.all([
    supabase.from("clients").select("slug").eq("id", clientId).single(),
    supabase.from("settings").select("evolution_instance_apikey_enc").eq("client_id", clientId).single(),
  ]);
  const apiKey = settings?.evolution_instance_apikey_enc
    ? decryptSecret(byteaToBuffer(settings.evolution_instance_apikey_enc))
    : null;
  return { slug: client?.slug as string, apiKey };
}

export async function connectWhatsapp(clientId: string) {
  await assertAccess(clientId);
  const { slug, apiKey: existingKey } = await getClientSlugAndApiKey(clientId);

  if (existingKey) {
    const qrcodeBase64 = await evolution.getQrCode(slug, existingKey);
    return { qrcodeBase64 };
  }

  const { apikey, qrcodeBase64 } = await evolution.createInstance(slug);
  await evolution.setChatwootIntegration(slug, apikey);

  const supabase = createServiceClient();
  const { error } = await supabase
    .from("settings")
    .update({ evolution_instance_apikey_enc: bufferToBytea(encryptSecret(apikey)) })
    .eq("client_id", clientId);
  if (error) throw error;

  revalidatePath(`/admin/clients/${clientId}/configuracoes`);
  revalidatePath("/cliente/configuracoes");
  return { qrcodeBase64 };
}

export async function getWhatsappStatus(clientId: string) {
  await assertAccess(clientId);
  const { slug, apiKey } = await getClientSlugAndApiKey(clientId);
  if (!apiKey) return { state: "not_created" };
  const state = await evolution.getConnectionState(slug, apiKey);
  return { state };
}

export async function syncChatwootInbox(clientId: string) {
  await assertAccess(clientId);
  const { slug } = await getClientSlugAndApiKey(clientId);

  const inboxId = await findInboxIdByName(slug);
  if (!inboxId) return { linked: false };

  const supabase = createServiceClient();
  const { error } = await supabase
    .from("settings")
    .update({ chatwoot_inbox_id: inboxId })
    .eq("client_id", clientId);
  if (error) throw error;

  revalidatePath(`/admin/clients/${clientId}/configuracoes`);
  revalidatePath("/cliente/configuracoes");
  return { linked: true, inboxId };
}
