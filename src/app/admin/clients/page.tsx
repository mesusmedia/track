import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { NewClientDialog } from "./new-client-dialog";
import { Settings, KanbanSquare, LayoutDashboard, Activity, Wallet, Megaphone } from "lucide-react";

export default async function AdminClientsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q } = await searchParams;
  const supabase = await createClient();
  let query = supabase.from("clients").select("id, name, created_at").order("created_at", { ascending: false });
  if (q) query = query.ilike("name", `%${q}%`);
  const { data: clients } = await query;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold tracking-tight">Clientes</h2>
          <p className="text-sm text-muted-foreground">
            {q ? `Resultados para "${q}"` : "Todos os clientes da agência"}
          </p>
        </div>
        <NewClientDialog />
      </div>

      {!clients || clients.length === 0 ? (
        <p className="text-sm text-muted-foreground">Nenhum cliente encontrado.</p>
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
