import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { loadCampaigns } from "@/lib/dashboard/load";
import { CampaignsView } from "@/components/campaigns-view";

export default async function AdminClientCampanhasPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: client } = await supabase.from("clients").select("id, name").eq("id", id).single();
  if (!client) notFound();

  const data = await loadCampaigns(id);
  return (
    <div className="space-y-4">
      <h1 className="text-lg font-semibold">{client.name} — Campanhas</h1>
      <CampaignsView data={data} />
    </div>
  );
}
