import { createClient } from "@/lib/supabase/server";
import { MoreHorizontal } from "lucide-react";

function formatBRL(value: number) {
  return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function relativeTime(iso: string) {
  const diffMin = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (diffMin < 1) return "agora";
  if (diffMin < 60) return `${diffMin} min`;
  const diffH = Math.round(diffMin / 60);
  if (diffH < 24) return `${diffH}h`;
  return `${Math.round(diffH / 24)}d`;
}

const STAGE_COLORS: Record<string, string> = {
  vendido: "bg-[#4ade80]/10 border-[#4ade80]/20 text-[#4ade80] [&_div]:bg-[#4ade80]",
  perdido: "bg-[#f87171]/10 border-[#f87171]/20 text-[#f87171] [&_div]:bg-[#f87171]",
};
const DEFAULT_STAGE_COLOR = "bg-[#fbbf24]/10 border-[#fbbf24]/20 text-[#fbbf24] [&_div]:bg-[#fbbf24]";

function StagePill({ name }: { name: string }) {
  const color = STAGE_COLORS[name.trim().toLowerCase()] ?? DEFAULT_STAGE_COLOR;
  return (
    <div className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border ${color}`}>
      <div className="size-1.5 rounded-full" />
      <span className="text-[10px] font-bold uppercase">{name}</span>
    </div>
  );
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
        .limit(8),
    ]);

  const totalRevenue = (purchases ?? []).reduce((sum, p) => sum + Number(p.valor ?? 0), 0);

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

      <div className="bg-card border rounded-xl overflow-hidden">
        <div className="p-5 border-b">
          <h2 className="text-base font-semibold">Leads recentes</h2>
          <p className="text-xs text-muted-foreground mt-0.5">Últimos leads recebidos, todos os clientes</p>
        </div>
        {!recentLeads || recentLeads.length === 0 ? (
          <p className="text-sm text-muted-foreground p-5">Nenhum lead ainda.</p>
        ) : (
          <table className="w-full">
            <thead>
              <tr className="bg-accent/40">
                <th className="px-5 py-3 text-left text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                  Lead
                </th>
                <th className="px-4 py-3 text-left text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                  Cliente
                </th>
                <th className="px-4 py-3 text-left text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                  Etapa
                </th>
                <th className="px-4 py-3 text-left text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                  Quando
                </th>
                <th className="px-5 py-3 text-right text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                  Receita
                </th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {recentLeads.map((lead) => {
                const clientName = (lead.clients as unknown as { name: string } | null)?.name ?? "—";
                const stageName = (lead.pipeline_stages as unknown as { name: string } | null)?.name;
                return (
                  <tr key={lead.id} className="hover:bg-accent/30 transition-colors">
                    <td className="px-5 py-3 text-sm font-medium">{lead.name ?? lead.phone ?? "Sem nome"}</td>
                    <td className="px-4 py-3 text-xs text-muted-foreground">{clientName}</td>
                    <td className="px-4 py-3">{stageName ? <StagePill name={stageName} /> : "—"}</td>
                    <td className="px-4 py-3 text-xs text-muted-foreground">{relativeTime(lead.created_at)}</td>
                    <td className="px-5 py-3 text-right text-xs font-semibold tabular-nums">
                      {lead.revenue ? formatBRL(Number(lead.revenue)) : "—"}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
