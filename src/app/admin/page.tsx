import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { NewClientDialog } from "./clients/new-client-dialog";
import { Settings, KanbanSquare, LayoutDashboard, Activity, Wallet, Megaphone } from "lucide-react";

function formatBRL(value: number) {
  return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export default async function AdminHomePage() {
  const supabase = await createClient();
  const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

  const [{ data: clients }, { data: purchases }, { count: events30d }] = await Promise.all([
    supabase.from("clients").select("id, name, created_at").order("created_at", { ascending: false }),
    supabase.from("purchases").select("valor").eq("status", "paid"),
    supabase.from("events_log").select("id", { count: "exact", head: true }).gte("created_at", since),
  ]);

  const totalRevenue = (purchases ?? []).reduce((sum, p) => sum + Number(p.valor ?? 0), 0);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Clientes</CardDescription>
          </CardHeader>
          <CardContent className="font-mono text-2xl tabular-nums">{clients?.length ?? 0}</CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Receita total (paga)</CardDescription>
          </CardHeader>
          <CardContent className="font-mono text-2xl tabular-nums">{formatBRL(totalRevenue)}</CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Eventos (30d, todos clientes)</CardDescription>
          </CardHeader>
          <CardContent className="font-mono text-2xl tabular-nums">{events30d ?? 0}</CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="flex items-center justify-between">
          <div>
            <CardTitle>Clientes</CardTitle>
            <CardDescription>Todos os clientes da agência</CardDescription>
          </div>
          <NewClientDialog />
        </CardHeader>
        <CardContent>
          {!clients || clients.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhum cliente cadastrado ainda.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nome</TableHead>
                  <TableHead>Criado em</TableHead>
                  <TableHead className="text-right">Status</TableHead>
                  <TableHead className="w-32" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {clients.map((c) => (
                  <TableRow key={c.id}>
                    <TableCell className="font-medium">{c.name}</TableCell>
                    <TableCell className="font-mono text-sm tabular-nums text-muted-foreground">
                      {new Date(c.created_at).toLocaleDateString("pt-BR")}
                    </TableCell>
                    <TableCell className="text-right">
                      <Badge variant="secondary">Ativo</Badge>
                    </TableCell>
                    <TableCell className="flex gap-1 justify-end">
                      <Button
                        variant="ghost"
                        size="icon"
                        nativeButton={false}
                        render={<Link href={`/admin/clients/${c.id}/visao-geral`} />}
                        title="Visão geral"
                      >
                        <LayoutDashboard className="size-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        nativeButton={false}
                        render={<Link href={`/admin/clients/${c.id}/crm`} />}
                        title="CRM"
                      >
                        <KanbanSquare className="size-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        nativeButton={false}
                        render={<Link href={`/admin/clients/${c.id}/eventos`} />}
                        title="Eventos"
                      >
                        <Activity className="size-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        nativeButton={false}
                        render={<Link href={`/admin/clients/${c.id}/faturamento`} />}
                        title="Faturamento"
                      >
                        <Wallet className="size-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        nativeButton={false}
                        render={<Link href={`/admin/clients/${c.id}/campanhas`} />}
                        title="Campanhas"
                      >
                        <Megaphone className="size-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        nativeButton={false}
                        render={<Link href={`/admin/clients/${c.id}/configuracoes`} />}
                        title="Configurações"
                      >
                        <Settings className="size-4" />
                      </Button>
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
