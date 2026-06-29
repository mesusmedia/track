import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { RecentLeadsTable } from "@/components/recent-leads-table";
import { PeriodFilter } from "@/components/period-filter";
import type { loadOverview } from "@/lib/dashboard/load";

function formatBRL(value: number) {
  return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function MiniBars({ values }: { values: number[] }) {
  const max = Math.max(1, ...values);
  return (
    <div className="flex items-end gap-[3px] h-8">
      {values.map((value, i) => (
        <div
          key={i}
          className={i === values.length - 1 ? "w-2 bg-primary rounded-t-sm" : "w-2 bg-primary/40 rounded-t-sm"}
          style={{ height: `${Math.max(8, (value / max) * 100)}%` }}
        />
      ))}
    </div>
  );
}

export function DashboardOverview({ data }: { data: Awaited<ReturnType<typeof loadOverview>> }) {
  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <PeriodFilter />
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Receita ({data.periodDays}d)</CardDescription>
          </CardHeader>
          <CardContent className="flex items-end justify-between">
            <span className="font-mono text-2xl tabular-nums">{formatBRL(data.revenuePeriod)}</span>
            <MiniBars values={data.weekBuckets.map((b) => b.revenue)} />
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Vendas ({data.periodDays}d)</CardDescription>
          </CardHeader>
          <CardContent className="flex items-end justify-between">
            <span className="font-mono text-2xl tabular-nums">{data.purchasesPeriod}</span>
            <MiniBars values={data.weekBuckets.map((b) => b.sales)} />
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Eventos ({data.periodDays}d)</CardDescription>
          </CardHeader>
          <CardContent className="flex items-end justify-between">
            <span className="font-mono text-2xl tabular-nums">{data.eventsPeriod}</span>
            <MiniBars values={data.weekBuckets.map((b) => b.events)} />
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Leads totais</CardDescription>
          </CardHeader>
          <CardContent className="flex items-end justify-between">
            <span className="font-mono text-2xl tabular-nums">{data.leadsTotal}</span>
            <MiniBars values={data.weekBuckets.map((b) => b.leads)} />
          </CardContent>
        </Card>
      </div>

      <RecentLeadsTable
        leads={data.leadRows}
        title="Funil (CRM)"
        subtitle={`Leads recebidos nos últimos ${data.periodDays} dias`}
      />

      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Origem geográfica (eventos, {data.periodDays}d)</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {data.topGeo.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Sem dados de geolocalização ainda (só disponível em produção).
            </p>
          ) : (
            data.topGeo.map((g) => (
              <div key={g.place} className="flex items-center justify-between text-sm">
                <span>{g.place}</span>
                <span className="font-mono tabular-nums">{g.count}</span>
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}
