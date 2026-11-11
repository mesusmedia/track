import { createServiceClient } from "@/lib/supabase/server";
import { getProfile } from "@/lib/auth/profile";
import { Badge } from "@/components/ui/badge";

// Painel de saude das instancias + alertas (Feature D). Existe por causa de
// um incidente real: a instancia de um cliente ficou ~46h desconectada,
// zero leads, e ninguem percebeu ate o cliente reclamar. O cron em
// /api/cron/instance-health alimenta instance_health/alerts; esta pagina
// so le.
export default async function AdminSaudePage() {
  const profile = await getProfile();
  const service = createServiceClient();

  const { data: clients } = await service
    .from("clients")
    .select("id, name")
    .eq("agency_id", profile!.agency_id)
    .order("name", { ascending: true });

  const clientIds = (clients ?? []).map((c) => c.id);

  const [healthRes, alertsRes, leadsRes] = await Promise.all([
    service.from("instance_health").select("client_id, connection_state, checked_at, last_open_at").in("client_id", clientIds),
    service.from("alerts").select("id, client_id, type, message, created_at").in("client_id", clientIds).is("resolved_at", null),
    service
      .from("leads")
      .select("client_id, created_at, campaign_name, source_id, ctwa_clid")
      .in("client_id", clientIds)
      .gte("created_at", new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()),
  ]);

  const healthByClient = new Map((healthRes.data ?? []).map((h) => [h.client_id, h]));
  const alertsByClient = new Map<string, typeof alertsRes.data>();
  for (const a of alertsRes.data ?? []) {
    alertsByClient.set(a.client_id, [...(alertsByClient.get(a.client_id) ?? []), a]);
  }
  const leadsByClient = new Map<string, typeof leadsRes.data>();
  for (const l of leadsRes.data ?? []) {
    leadsByClient.set(l.client_id, [...(leadsByClient.get(l.client_id) ?? []), l]);
  }

  const rows = (clients ?? []).map((client) => {
    const health = healthByClient.get(client.id);
    const leads24h = leadsByClient.get(client.id) ?? [];
    const attributed = leads24h.filter((l) => l.campaign_name || l.source_id || l.ctwa_clid);
    const alerts = alertsByClient.get(client.id) ?? [];
    return {
      client,
      state: health?.connection_state ?? "sem dados",
      lastOpenAt: health?.last_open_at ?? null,
      leads24h: leads24h.length,
      attributionRate: leads24h.length > 0 ? Math.round((attributed.length / leads24h.length) * 100) : null,
      alerts,
    };
  });

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold tracking-tight">Saúde das instâncias</h2>
        <p className="text-sm text-muted-foreground">
          Conexão WhatsApp (Evolution), leads nas últimas 24h e taxa de atribuição por cliente
        </p>
      </div>

      <div className="bg-card border rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-muted/40 text-xs text-muted-foreground uppercase tracking-wide">
            <tr>
              <th className="text-left px-5 py-3">Cliente</th>
              <th className="text-left px-5 py-3">Instância</th>
              <th className="text-left px-5 py-3">Leads 24h</th>
              <th className="text-left px-5 py-3">Atribuição 24h</th>
              <th className="text-left px-5 py-3">Alertas</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {rows.map((row) => (
              <tr key={row.client.id}>
                <td className="px-5 py-3 font-medium">{row.client.name}</td>
                <td className="px-5 py-3">
                  <Badge variant={row.state === "open" ? "default" : "destructive"}>
                    {row.state === "open" ? "🟢 conectado" : row.state === "sem dados" ? "— sem dados" : `🔴 ${row.state}`}
                  </Badge>
                </td>
                <td className="px-5 py-3 font-mono tabular-nums">{row.leads24h}</td>
                <td className="px-5 py-3 font-mono tabular-nums">
                  {row.attributionRate === null ? "—" : `${row.attributionRate}%`}
                </td>
                <td className="px-5 py-3">
                  {row.alerts.length === 0 ? (
                    <span className="text-muted-foreground">—</span>
                  ) : (
                    <div className="space-y-1">
                      {row.alerts.map((a) => (
                        <p key={a.id} className="text-xs text-destructive">
                          {a.message}
                        </p>
                      ))}
                    </div>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
