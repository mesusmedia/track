import { createServiceClient } from "@/lib/supabase/server";
import { encryptSecret, decryptSecret, bufferToBytea, byteaToBuffer } from "@/lib/crypto";
import { META_GRAPH_API_BASE } from "./constants";

export async function getMetaAppToken(): Promise<string | null> {
  const supabase = createServiceClient();
  const { data } = await supabase.from("meta_app_token").select("access_token_enc").eq("id", 1).maybeSingle();
  if (!data) return null;
  return decryptSecret(byteaToBuffer(data.access_token_enc));
}

// troca o token atual por um novo de longa duracao (mesmo mecanismo do
// fb_exchange_token) -- precisa rodar periodicamente (antes de expirar)
// via cron, ja que o token de longa duracao da Meta tem prazo de validade.
export async function refreshMetaAppToken() {
  const current = await getMetaAppToken();
  if (!current) throw new Error("Nenhum token Meta cadastrado ainda (meta_app_token vazio)");

  const url = `${META_GRAPH_API_BASE}/oauth/access_token?grant_type=fb_exchange_token&client_id=${process.env.META_APP_ID}&client_secret=${process.env.META_APP_SECRET}&fb_exchange_token=${current}`;
  const res = await fetch(url);
  const body = await res.json();
  if (!res.ok || !body.access_token) {
    throw new Error(body?.error?.message ?? "Falha ao renovar token do Meta");
  }

  const supabase = createServiceClient();
  const { error } = await supabase
    .from("meta_app_token")
    .upsert({ id: 1, access_token_enc: bufferToBytea(encryptSecret(body.access_token)), updated_at: new Date().toISOString() });
  if (error) throw error;

  return body.access_token as string;
}
