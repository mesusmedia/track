import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { loadOverview } from "@/lib/dashboard/load";

function formatBRL(value: number) {
  return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export function DashboardOverview({ data }: { data: Awaited<ReturnType<typeof loadOverview>> }) {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Receita (30d)</CardDescription>
          </CardHeader>
          <CardContent className="font-mono text-2xl tabular-nums">
            {formatBRL(data.revenue30d)}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Vendas (30d)</CardDescription>
          </CardHeader>
          <CardContent className="font-mono text-2xl tabular-nums">{data.purchases30d}</CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Eventos (30d)</CardDescription>
          </CardHeader>
          <CardContent className="font-mono text-2xl tabular-nums">{data.events30d}</CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Leads totais</CardDescription>
          </CardHeader>
          <CardContent className="font-mono text-2xl tabular-nums">{data.leadsTotal}</CardContent>
        </Card>
      </div>

      <div className="grid lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Funil (CRM)</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {data.leadsByStage.length === 0 ? (
              <p className="text-sm text-muted-foreground">Sem etapas configuradas.</p>
            ) : (
              data.leadsByStage.map((s) => (
                <div key={s.name} className="flex items-center justify-between text-sm">
                  <span>{s.name}</span>
                  <span className="font-mono tabular-nums">{s.count}</span>
                </div>
              ))
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Origem geográfica (eventos, 30d)</CardTitle>
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
    </div>
  );
}
