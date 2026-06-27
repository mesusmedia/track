import { NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { createServiceClient } from "@/lib/supabase/server";
import { isRateLimited } from "@/lib/rate-limit";

export async function POST(request: Request) {
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  if (isRateLimited(`event:${ip}`)) {
    return NextResponse.json({ error: "rate_limited" }, { status: 429 });
  }

  const body = await request.json().catch(() => null);
  if (!body || typeof body.client_slug !== "string" || typeof body.event_name !== "string") {
    return NextResponse.json(
      { error: "client_slug e event_name são obrigatórios" },
      { status: 400 },
    );
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

  const eventId = typeof body.event_id === "string" ? body.event_id : randomUUID();

  // dispatch real pra Meta/GA4 chega na Fase 3 -- aqui so registra o evento,
  // que ja e o suficiente pra dedup (event_id) e pro funil dos dashboards.
  const { error } = await supabase.from("events_log").upsert(
    {
      client_id: client.id,
      trck_user_id: body.trck_user_id ?? null,
      event_name: body.event_name,
      event_id: eventId,
      utm_source: body.utm_source ?? null,
      utm_medium: body.utm_medium ?? null,
      utm_campaign: body.utm_campaign ?? null,
      ip,
    },
    { onConflict: "client_id,event_id", ignoreDuplicates: true },
  );
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ event_id: eventId });
}
