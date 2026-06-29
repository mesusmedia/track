import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { loadOverview } from "@/lib/dashboard/load";
import { DashboardOverview } from "@/components/dashboard-overview";
import { ClientSubNav } from "@/components/client-subnav";

export default async function AdminClientVisaoGeralPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ period?: string }>;
}) {
  const { id } = await params;
  const { period } = await searchParams;
  const periodDays = Number(period) > 0 ? Number(period) : 30;
  const supabase = await createClient();
  const { data: client } = await supabase.from("clients").select("id, name").eq("id", id).single();
  if (!client) notFound();

  const data = await loadOverview(id, periodDays);
  return (
    <div className="space-y-4">
      <ClientSubNav clientId={id} clientName={client.name} />
      <DashboardOverview data={data} />
    </div>
  );
}
