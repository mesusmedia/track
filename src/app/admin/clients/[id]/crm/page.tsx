import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { loadCrmData } from "@/lib/crm/load";
import { CrmBoard } from "@/components/crm-board";
import { CrmStats } from "@/components/crm-stats";
import { ClientSubNav } from "@/components/client-subnav";

export default async function AdminClientCrmPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ from?: string; to?: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: client } = await supabase.from("clients").select("id, name").eq("id", id).single();
  if (!client) notFound();

  const sp = await searchParams;
  const now = new Date();
  const from = sp.from ?? `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;
  const to = sp.to ?? now.toISOString().slice(0, 10);

  const { stages, leads, rules } = await loadCrmData(id, from, `${to}T23:59:59`);

  return (
    <div className="space-y-4">
      <ClientSubNav clientId={id} clientName={client.name} />
      <CrmStats stages={stages} leads={leads} />
      <CrmBoard clientId={id} clientName={client.name} stages={stages} leads={leads} rules={rules} from={from} to={to} isAdmin />
    </div>
  );
}
