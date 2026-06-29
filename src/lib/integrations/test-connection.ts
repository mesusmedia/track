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
  const [{ data }, { data: settings }] = await Promise.all([
    supabase.from("meta_pixels").select("pixel_id, capi_token_enc").eq("id", accountId).single(),
    supabase.from("settings").select("test_event_code").eq("client_id", clientId).maybeSingle(),
  ]);
  if (!data) return { ok: false, message: "Conta não encontrada" };

  const token = decryptSecret(byteaToBuffer(data.capi_token_enc));
  // ponytail: nao usa GET /{pixel_id}?fields=id -- token gerado pela tela
  // "API de Conversões" do Gerenciador de Eventos costuma ser escopado SO
  // pra enviar evento (POST .../events), sem permissao de leitura no objeto
  // pixel. Testar enviando um evento de teste (test_event_code, se a
  // agencia ja tiver cadastrado em "Configuracoes" -> sem isso o evento
  // ainda vai, so nao some sozinho da aba "Eventos de teste" do Meta) e o
  // jeito que reflete o uso real, sem dar falso "Missing Permission".
  const res = await fetch(`${META_GRAPH_API_BASE}/${data.pixel_id}/events`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      access_token: token,
      ...(settings?.test_event_code ? { test_event_code: settings.test_event_code } : {}),
      data: [
        {
          event_name: "TestConnection",
          event_time: Math.floor(Date.now() / 1000),
          action_source: "system_generated",
          user_data: { client_ip_address: "127.0.0.1", client_user_agent: "mesus-track-test" },
        },
      ],
    }),
  });
  const body = await res.json();
  if (body.error) return { ok: false, message: body.error.message };
  return { ok: true, message: "Conexão válida (evento de teste enviado)" };
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
