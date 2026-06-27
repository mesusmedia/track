"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";
import type { loadBilling } from "@/lib/dashboard/load";

function formatBRL(value: number) {
  return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export function BillingView({ data }: { data: Awaited<ReturnType<typeof loadBilling>> }) {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Receita total (pago)</CardDescription>
          </CardHeader>
          <CardContent className="font-mono text-2xl tabular-nums">
            {formatBRL(data.totalRevenue)}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Vendas pagas</CardDescription>
          </CardHeader>
          <CardContent className="font-mono text-2xl tabular-nums">{data.paidCount}</CardContent>
        </Card>
      </div>

      {data.chartData.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Receita por dia</CardTitle>
          </CardHeader>
          <CardContent className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={data.chartData}>
                <XAxis dataKey="day" fontSize={12} />
                <YAxis fontSize={12} />
                <Tooltip formatter={(v) => formatBRL(Number(v))} />
                <Line type="monotone" dataKey="total" stroke="hsl(var(--primary))" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Transações</CardTitle>
        </CardHeader>
        <CardContent>
          {data.purchases.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhuma compra registrada ainda.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Produto</TableHead>
                  <TableHead>Valor</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Campanha</TableHead>
                  <TableHead className="text-right">Data</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.purchases.map((p) => (
                  <TableRow key={p.id}>
                    <TableCell className="font-medium">{p.produto ?? "—"}</TableCell>
                    <TableCell className="font-mono tabular-nums">
                      {formatBRL(Number(p.valor ?? 0))}
                    </TableCell>
                    <TableCell>
                      <Badge variant={p.status === "paid" ? "default" : "secondary"}>{p.status}</Badge>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {p.utm_campaign ?? "—"}
                    </TableCell>
                    <TableCell className="text-right font-mono text-xs tabular-nums text-muted-foreground">
                      {new Date(p.created_at).toLocaleString("pt-BR")}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
