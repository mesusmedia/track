import { notFound } from "next/navigation";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { loadIntegrationAccounts } from "@/lib/integrations/load";
import { IntegrationSettings } from "@/components/integration-settings";
import { ClientSubNav } from "@/components/client-subnav";
import { ClientLoginAccess } from "@/components/client-login-access";

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

  const serviceClient = createServiceClient();
  const { data: profiles } = await serviceClient
    .from("users_profile")
    .select("id, created_at")
    .eq("client_id", id);
  const logins = await Promise.all(
    (profiles ?? []).map(async (p) => {
      const { data } = await serviceClient.auth.admin.getUserById(p.id);
      return { email: data?.user?.email ?? "(e-mail indisponível)", role: "client", createdAt: p.created_at };
    }),
  );

  return (
    <div className="space-y-4">
      <ClientSubNav clientId={id} clientName={client.name} />
      <ClientLoginAccess clientId={id} logins={logins} />
      <IntegrationSettings clientId={id} clientSlug={client.slug} {...accounts} />
    </div>
  );
}
