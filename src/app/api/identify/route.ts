import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { isRateLimited } from "@/lib/rate-limit";
import { hashPii, hashPhone } from "@/lib/hash";

export async function POST(request: Request) {
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  if (isRateLimited(`identify:${ip}`)) {
    return NextResponse.json({ error: "rate_limited" }, { status: 429 });
  }

  const body = await request.json().catch(() => null);
  if (!body || typeof body.client_slug !== "string") {
    return NextResponse.json({ error: "client_slug é obrigatório" }, { status: 400 });
  }

  const supabase = createServiceClient();
  const { data: client } = await supabase
    .from("clients")
    .select("id")
    .eq("slug", body.client_slug)
    .single();
  if (!client) {
    return NextResponse.json({ error: "cliente não encontrado" }, { status: 404 });
  }

  const userAgent = request.headers.get("user-agent") ?? null;
  const fields = [
    "fbp",
    "fbc",
    "fbclid",
    "gclid",
    "ctwa_clid",
    "ga_client_id",
    "ga_session_id",
    "utm_source",
    "utm_medium",
    "utm_campaign",
    "utm_term",
    "utm_content",
    "referrer",
  ] as const;
  const visitorData: Record<string, unknown> = { client_id: client.id, ip, user_agent: userAgent };
  for (const field of fields) {
    if (typeof body[field] === "string") visitorData[field] = body[field];
  }
  // email/telefone nunca sao guardados em texto puro -- so o hash chega ao banco.
  if (typeof body.email === "string" && body.email) visitorData.email_hash = hashPii(body.email);
  if (typeof body.phone === "string" && body.phone) visitorData.phone_hash = hashPhone(body.phone);

  if (typeof body.trck_user_id === "string") {
    const { error } = await supabase
      .from("visitors")
      .update({ ...visitorData, updated_at: new Date().toISOString() })
      .eq("trck_user_id", body.trck_user_id)
      .eq("client_id", client.id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ trck_user_id: body.trck_user_id });
  }

  const { data: visitor, error } = await supabase
    .from("visitors")
    .insert(visitorData)
    .select("trck_user_id")
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ trck_user_id: visitor.trck_user_id });
}
