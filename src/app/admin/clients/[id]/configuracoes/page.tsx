import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { loadIntegrationAccounts } from "@/lib/integrations/load";
import { IntegrationSettings } from "@/components/integration-settings";
import { ClientSubNav } from "@/components/client-subnav";

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
      <ClientSubNav clientId={id} clientName={client.name} />
      <IntegrationSettings clientId={id} clientSlug={client.slug} {...accounts} />
    </div>
  );
}
