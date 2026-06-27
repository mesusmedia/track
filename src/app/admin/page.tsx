import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
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

      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold tracking-tight">Clientes</h2>
          <p className="text-sm text-muted-foreground">Todos os clientes da agência</p>
        </div>
        <NewClientDialog />
      </div>

      {!clients || clients.length === 0 ? (
        <p className="text-sm text-muted-foreground">Nenhum cliente cadastrado ainda.</p>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {clients.map((c) => (
            <Card key={c.id} className="hover:border-primary/50 transition-colors">
              <CardHeader className="flex items-start justify-between pb-2">
                <div>
                  <CardTitle className="text-base">
                    <Link href={`/admin/clients/${c.id}/visao-geral`} className="hover:text-primary">
                      {c.name}
                    </Link>
                  </CardTitle>
                  <CardDescription className="font-mono text-xs tabular-nums">
                    desde {new Date(c.created_at).toLocaleDateString("pt-BR")}
                  </CardDescription>
                </div>
                <Badge variant="secondary">Ativo</Badge>
              </CardHeader>
              <CardContent className="flex gap-1 pt-2 border-t">
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
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
