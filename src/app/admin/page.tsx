import { createClient } from "@/lib/supabase/server";
import { MoreHorizontal } from "lucide-react";
import { RecentLeadsTable } from "@/components/recent-leads-table";

function formatBRL(value: number) {
  return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export default async function AdminHomePage() {
  const supabase = await createClient();
  const since30d = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

  // ponytail: 5 queries de count em sequencia de semanas pra montar a
  // sparkline de leads -- sem tabela de agregacao, ok pro volume atual.
  const weekBuckets = await Promise.all(
    [4, 3, 2, 1, 0].map(async (weeksAgo) => {
      const from = new Date(Date.now() - (weeksAgo + 1) * 7 * 24 * 60 * 60 * 1000).toISOString();
      const to = new Date(Date.now() - weeksAgo * 7 * 24 * 60 * 60 * 1000).toISOString();
      const { count } = await supabase
        .from("leads")
        .select("id", { count: "exact", head: true })
        .gte("created_at", from)
        .lt("created_at", to);
      return count ?? 0;
    }),
  );
  const maxBucket = Math.max(1, ...weekBuckets);

  const [{ count: totalClients }, { data: purchases }, { count: leads30d }, { data: recentLeads }] =
    await Promise.all([
      supabase.from("clients").select("id", { count: "exact", head: true }),
      supabase.from("purchases").select("valor").eq("status", "paid"),
      supabase.from("leads").select("id", { count: "exact", head: true }).gte("created_at", since30d),
      supabase
        .from("leads")
        .select("id, name, phone, revenue, created_at, clients(name), pipeline_stages(name)")
        .order("created_at", { ascending: false })
        .limit(30),
    ]);

  const totalRevenue = (purchases ?? []).reduce((sum, p) => sum + Number(p.valor ?? 0), 0);

  const leadRows = (recentLeads ?? []).map((lead) => ({
    id: lead.id as string,
    name: (lead.name as string | null) ?? (lead.phone as string | null) ?? "Sem nome",
    clientName: (lead.clients as unknown as { name: string } | null)?.name ?? "—",
    stageName: (lead.pipeline_stages as unknown as { name: string } | null)?.name ?? null,
    createdAt: lead.created_at as string,
    revenue: lead.revenue as number | null,
  }));

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-card border rounded-xl p-4">
          <div className="flex justify-between items-start">
            <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
              Leads (5 semanas)
            </span>
            <MoreHorizontal className="size-4 text-muted-foreground/60" />
          </div>
          <div className="flex items-end justify-between mt-2">
            <div className="text-2xl font-semibold">{leads30d ?? 0}</div>
            <div className="flex items-end gap-[3px] h-10">
              {weekBuckets.map((value, i) => (
                <div
                  key={i}
                  className={i === weekBuckets.length - 1 ? "w-2 bg-primary rounded-t-sm" : "w-2 bg-primary/40 rounded-t-sm"}
                  style={{ height: `${Math.max(8, (value / maxBucket) * 100)}%` }}
                />
              ))}
            </div>
          </div>
          <div className="mt-4 pt-4 border-t flex items-center justify-between">
            <span className="text-[10px] text-muted-foreground">últimos 30 dias</span>
          </div>
        </div>

        <div className="bg-card border rounded-xl p-4">
          <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
            Faturamento (pago)
          </span>
          <div className="text-2xl font-semibold mt-2">{formatBRL(totalRevenue)}</div>
          <div className="mt-4 pt-4 border-t flex items-center justify-between">
            <span className="text-[10px] text-muted-foreground">todas as contas de pagamento</span>
          </div>
        </div>

        <div className="bg-card border rounded-xl p-4">
          <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
            Clientes ativos
          </span>
          <div className="text-2xl font-semibold mt-2">{totalClients ?? 0}</div>
          <div className="mt-4 pt-4 border-t flex items-center justify-between">
            <span className="text-[10px] text-muted-foreground">cadastrados na agência</span>
          </div>
        </div>
      </div>

      <RecentLeadsTable leads={leadRows} />
    </div>
  );
}
