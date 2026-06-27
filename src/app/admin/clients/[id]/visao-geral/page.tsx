import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { loadOverview } from "@/lib/dashboard/load";
import { DashboardOverview } from "@/components/dashboard-overview";

export default async function AdminClientVisaoGeralPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: client } = await supabase.from("clients").select("id, name").eq("id", id).single();
  if (!client) notFound();

  const data = await loadOverview(id);
  return (
    <div className="space-y-4">
      <h1 className="text-lg font-semibold">{client.name} — Visão geral</h1>
      <DashboardOverview data={data} />
    </div>
  );
}
