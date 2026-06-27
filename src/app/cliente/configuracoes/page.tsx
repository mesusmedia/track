import { redirect } from "next/navigation";
import { getProfile } from "@/lib/auth/profile";
import { createClient } from "@/lib/supabase/server";
import { loadIntegrationAccounts } from "@/lib/integrations/load";
import { IntegrationSettings } from "@/components/integration-settings";

export default async function ClienteConfigPage() {
  const profile = await getProfile();
  if (!profile?.client_id) redirect("/cliente");

  const supabase = await createClient();
  const [{ data: client }, accounts] = await Promise.all([
    supabase.from("clients").select("slug").eq("id", profile.client_id).single(),
    loadIntegrationAccounts(profile.client_id),
  ]);

  return (
    <div className="space-y-4">
      <h1 className="text-lg font-semibold">Configurações</h1>
      <IntegrationSettings clientId={profile.client_id} clientSlug={client!.slug} {...accounts} />
    </div>
  );
}
