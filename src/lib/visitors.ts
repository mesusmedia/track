import { createServiceClient } from "@/lib/supabase/server";

const VISITOR_FIELDS = "trck_user_id, fbp, fbc, ctwa_clid, utm_source, utm_medium, utm_campaign";

export async function findVisitorById(
  supabase: ReturnType<typeof createServiceClient>,
  clientId: string,
  trckUserId: string,
) {
  const isFullUuid = trckUserId.length === 36;
  const query = supabase.from("visitors").select(VISITOR_FIELDS).eq("client_id", clientId);
  if (isFullUuid) {
    const { data } = await query.eq("trck_user_id", trckUserId).maybeSingle();
    return data;
  }
  // trck_user_id e uuid (nao texto) -- nao da pra usar ilike; o prefixo de 8
  // chars do /api/go vira os 4 primeiros bytes do uuid, comparados por faixa.
  const { data } = await query
    .gte("trck_user_id", `${trckUserId}-0000-0000-0000-000000000000`)
    .lte("trck_user_id", `${trckUserId}-ffff-ffff-ffff-ffffffffffff`)
    .limit(1)
    .maybeSingle();
  return data;
}

export async function findVisitorByHash(
  supabase: ReturnType<typeof createServiceClient>,
  clientId: string,
  field: "email_hash" | "phone_hash",
  hash: string,
) {
  const { data } = await supabase
    .from("visitors")
    .select(VISITOR_FIELDS)
    .eq("client_id", clientId)
    .eq(field, hash)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  return data;
}

// extrai o ref code de 8 chars deixado na mensagem prefilled pelo /api/go
export function extractRefCode(text: string): string | null {
  const match = text.match(/\(ref:([0-9a-f]{8})\)/i);
  return match ? match[1] : null;
}
