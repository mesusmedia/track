"use server";

import { getProfile } from "@/lib/auth/profile";
import { createServiceClient } from "@/lib/supabase/server";
import { decryptSecret, byteaToBuffer } from "@/lib/crypto";
import { META_GRAPH_API_BASE } from "@/lib/meta/constants";

type Result = { ok: boolean; message: string };

async function canAccess(clientId: string) {
  const profile = await getProfile();
  return !!profile && (profile.role === "agency_admin" || profile.client_id === clientId);
}

export async function testGa4Connection(accountId: string, clientId: string): Promise<Result> {
  if (!(await canAccess(clientId))) return { ok: false, message: "Sem acesso" };

  const supabase = createServiceClient();
  const { data } = await supabase
    .from("ga4_accounts")
    .select("measurement_id, api_secret_enc")
    .eq("id", accountId)
    .single();
  if (!data) return { ok: false, message: "Conta não encontrada" };

  const apiSecret = decryptSecret(byteaToBuffer(data.api_secret_enc));
  const res = await fetch(
    `https://www.google-analytics.com/debug/mp/collect?measurement_id=${data.measurement_id}&api_secret=${apiSecret}`,
    {
      method: "POST",
      body: JSON.stringify({
        client_id: "test-connection.test",
        events: [{ name: "test_connection" }],
      }),
    },
  );
  const body = await res.json();
  const messages = body.validationMessages ?? [];
  if (messages.length === 0) return { ok: true, message: "Conexão válida" };
  return { ok: false, message: messages[0]?.description ?? "Erro de validação" };
}

export async function testMetaPixelConnection(
  accountId: string,
  clientId: string,
): Promise<Result> {
  if (!(await canAccess(clientId))) return { ok: false, message: "Sem acesso" };

  const supabase = createServiceClient();
  const { data } = await supabase
    .from("meta_pixels")
    .select("pixel_id, capi_token_enc")
    .eq("id", accountId)
    .single();
  if (!data) return { ok: false, message: "Conta não encontrada" };

  const token = decryptSecret(byteaToBuffer(data.capi_token_enc));
  const res = await fetch(`${META_GRAPH_API_BASE}/${data.pixel_id}?fields=id&access_token=${token}`);
  const body = await res.json();
  if (body.error) return { ok: false, message: body.error.message };
  return { ok: true, message: "Conexão válida" };
}

export async function testMetaAdAccountConnection(
  accountId: string,
  clientId: string,
): Promise<Result> {
  if (!(await canAccess(clientId))) return { ok: false, message: "Sem acesso" };

  const supabase = createServiceClient();
  const { data } = await supabase
    .from("meta_ad_accounts")
    .select("ad_account_id, ads_token_enc")
    .eq("id", accountId)
    .single();
  if (!data) return { ok: false, message: "Conta não encontrada" };

  const token = decryptSecret(byteaToBuffer(data.ads_token_enc));
  const res = await fetch(
    `${META_GRAPH_API_BASE}/${data.ad_account_id}?fields=id&access_token=${token}`,
  );
  const body = await res.json();
  if (body.error) return { ok: false, message: body.error.message };
  return { ok: true, message: "Conexão válida" };
}

// ponytail: Google Ads exige troca OAuth (refresh_token -> access_token) pra
// testar de verdade; isso entra junto com o client da Google Ads API na Fase 3/7.
export async function testGoogleAdsConnection(): Promise<Result> {
  return { ok: true, message: "Credenciais salvas (teste real chega na Fase 3/7)" };
}
