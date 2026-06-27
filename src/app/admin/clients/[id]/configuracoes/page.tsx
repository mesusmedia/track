import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { loadIntegrationAccounts } from "@/lib/integrations/load";
import { IntegrationSettings } from "@/components/integration-settings";

export default async function AdminClientConfigPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: client } = await supabase.from("clients").select("id, name, slug").eq("id", id).single();
  if (!client) notFound();

  const accounts = await loadIntegrationAccounts(id);

  return (
    <div className="space-y-4">
      <Link href="/admin" className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="size-4" /> Voltar
      </Link>
      <h1 className="text-lg font-semibold">{client.name} — Configurações</h1>
      <IntegrationSettings clientId={id} clientSlug={client.slug} {...accounts} />
    </div>
  );
}
