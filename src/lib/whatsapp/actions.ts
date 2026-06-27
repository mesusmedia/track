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

async function getInstanceNameAndApiKey(clientId: string) {
  const supabase = createServiceClient();
  const [{ data: client }, { data: settings }] = await Promise.all([
    supabase.from("clients").select("slug").eq("id", clientId).single(),
    supabase
      .from("settings")
      .select("evolution_instance_name, evolution_instance_apikey_enc")
      .eq("client_id", clientId)
      .single(),
  ]);
  const apiKey = settings?.evolution_instance_apikey_enc
    ? decryptSecret(byteaToBuffer(settings.evolution_instance_apikey_enc))
    : null;
  // clientes criados do zero na plataforma usam o slug como nome da
  // instancia; clientes vinculados (linkExistingInstance) tem o nome real
  // guardado em evolution_instance_name.
  const instanceName = settings?.evolution_instance_name ?? (client?.slug as string);
  return { instanceName, apiKey };
}

export async function connectWhatsapp(clientId: string) {
  await assertAccess(clientId);
  const { instanceName, apiKey: existingKey } = await getInstanceNameAndApiKey(clientId);

  if (existingKey) {
    const qrcodeBase64 = await evolution.getQrCode(instanceName, existingKey);
    return { qrcodeBase64 };
  }

  const { apikey, qrcodeBase64 } = await evolution.createInstance(instanceName);
  await evolution.setChatwootIntegration(instanceName, apikey);

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

// pra clientes que ja tinham WhatsApp conectado no servidor Evolution antes
// dessa plataforma existir -- so le o que ja existe (apikey + inbox do
// Chatwoot ja configurada) e grava no nosso banco. Nao reconecta nada, nao
// gera QR code, nao toca na instancia real.
export async function linkExistingInstance(clientId: string, instanceName: string) {
  await assertAccess(clientId);

  const name = instanceName.trim();
  const found = await evolution.findInstanceByName(name);
  if (!found) throw new Error(`Instância "${name}" não encontrada no servidor Evolution`);

  const inboxId = found.chatwootInboxName ? await findInboxIdByName(found.chatwootInboxName) : null;

  const supabase = createServiceClient();
  const { error } = await supabase
    .from("settings")
    .update({
      evolution_instance_name: name,
      evolution_instance_apikey_enc: bufferToBytea(encryptSecret(found.apikey)),
      chatwoot_inbox_id: inboxId,
    })
    .eq("client_id", clientId);
  if (error) throw error;

  revalidatePath(`/admin/clients/${clientId}/configuracoes`);
  revalidatePath("/cliente/configuracoes");
  return { linked: true, inboxLinked: !!inboxId, chatwootInboxName: found.chatwootInboxName };
}

export async function getWhatsappStatus(clientId: string) {
  await assertAccess(clientId);
  const { instanceName, apiKey } = await getInstanceNameAndApiKey(clientId);
  if (!apiKey) return { state: "not_created" };
  const state = await evolution.getConnectionState(instanceName, apiKey);
  return { state };
}

export async function syncChatwootInbox(clientId: string) {
  await assertAccess(clientId);
  const { instanceName } = await getInstanceNameAndApiKey(clientId);

  const inboxId = await findInboxIdByName(instanceName);
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
