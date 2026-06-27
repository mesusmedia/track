import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import type { loadEvents } from "@/lib/dashboard/load";

function StatusBadge({ ok }: { ok: boolean | null }) {
  if (ok === null) return <span className="text-muted-foreground text-xs">—</span>;
  return <Badge variant={ok ? "default" : "destructive"}>{ok ? "ok" : "erro"}</Badge>;
}

export function EventsTable({ events }: { events: Awaited<ReturnType<typeof loadEvents>> }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Eventos</CardTitle>
        <CardDescription>Últimos 100 eventos disparados (Meta CAPI + GA4)</CardDescription>
      </CardHeader>
      <CardContent>
        {events.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhum evento registrado ainda.</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Evento</TableHead>
                <TableHead>Campanha (UTM)</TableHead>
                <TableHead>Meta CAPI</TableHead>
                <TableHead>GA4</TableHead>
                <TableHead className="text-right">Data</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {events.map((e) => (
                <TableRow key={e.id}>
                  <TableCell className="font-medium">{e.event_name}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {e.utm_campaign ?? "—"}
                  </TableCell>
                  <TableCell>
                    <StatusBadge ok={e.metaOk} />
                  </TableCell>
                  <TableCell>
                    <StatusBadge ok={e.ga4Ok} />
                  </TableCell>
                  <TableCell className="text-right font-mono text-xs tabular-nums text-muted-foreground">
                    {new Date(e.created_at).toLocaleString("pt-BR")}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}
