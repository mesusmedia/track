import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { decryptSecret, byteaToBuffer } from "@/lib/crypto";
import { getConnectionState } from "@/lib/evolution/client";

// Incidente real que motivou essa feature: a instancia Evolution de um
// cliente ficou desconectada ~46h (zero leads, estado real "close") sem
// ninguem notar -- o `connectionStatus` cacheado do fetchInstances mostrava
// "open" (desatualizado), so o connectionState ao vivo mostrava o estado
// certo. Por isso aqui sempre chama connectionState por instancia, nunca
// confia em cache.
const DOWN_THRESHOLD_MINUTES = 90;

export async function GET(request: Request) {
  const auth = request.headers.get("authorization");
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const supabase = createServiceClient();
  const { data: clients } = await supabase
    .from("settings")
    .select("client_id, evolution_instance_name, evolution_instance_apikey_enc")
    .not("evolution_instance_name", "is", null);

  const results = await Promise.all(
    (clients ?? []).map(async (row) => {
      if (!row.evolution_instance_apikey_enc) return null;
      try {
        const apikey = decryptSecret(byteaToBuffer(row.evolution_instance_apikey_enc));
        const state = await getConnectionState(row.evolution_instance_name!, apikey);
        const now = new Date();

        const { data: previous } = await supabase
          .from("instance_health")
          .select("last_open_at")
          .eq("client_id", row.client_id)
          .maybeSingle();

        await supabase.from("instance_health").upsert({
          client_id: row.client_id,
          connection_state: state,
          checked_at: now.toISOString(),
          last_open_at: state === "open" ? now.toISOString() : previous?.last_open_at ?? null,
        });

        if (state !== "open") {
          const lastOpenAt = previous?.last_open_at ? new Date(previous.last_open_at) : null;
          const minutesSinceOpen = lastOpenAt ? (now.getTime() - lastOpenAt.getTime()) / 60000 : Infinity;

          // so abre alerta se ja faz mais de DOWN_THRESHOLD_MINUTES desde a
          // ultima vez que essa instancia esteve "open" -- Baileys oscila
          // entre connecting/close por minutos o tempo todo, nao e incidente
          // de verdade. lastOpenAt null (nunca viu "open") conta como caido.
          if (minutesSinceOpen > DOWN_THRESHOLD_MINUTES) {
            const { data: openAlert } = await supabase
              .from("alerts")
              .select("id")
              .eq("client_id", row.client_id)
              .eq("type", "instance_down")
              .is("resolved_at", null)
              .maybeSingle();
            if (!openAlert) {
              await supabase.from("alerts").insert({
                client_id: row.client_id,
                type: "instance_down",
                message: `Instância "${row.evolution_instance_name}" sem conexão (estado: ${state}) há mais de ${DOWN_THRESHOLD_MINUTES}min.`,
              });
            }
          }
        } else {
          // reconectou -- resolve qualquer alerta de instance_down aberto
          await supabase
            .from("alerts")
            .update({ resolved_at: new Date().toISOString() })
            .eq("client_id", row.client_id)
            .eq("type", "instance_down")
            .is("resolved_at", null);
        }

        return { client_id: row.client_id, state };
      } catch (err) {
        console.error(`[instance-health] client=${row.client_id}`, err);
        return null;
      }
    }),
  );

  return NextResponse.json({ checked: results.filter(Boolean).length });
}
