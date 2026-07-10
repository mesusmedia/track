import { redirect } from "next/navigation";
import { getProfile } from "@/lib/auth/profile";
import { loadCrmData } from "@/lib/crm/load";
import { CrmBoard } from "@/components/crm-board";
import { CrmStats } from "@/components/crm-stats";

export default async function ClienteCrmPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; to?: string }>;
}) {
  const profile = await getProfile();
  if (!profile?.client_id) redirect("/cliente");

  const params = await searchParams;
  const now = new Date();
  const from = params.from ?? `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;
  const to = params.to ?? now.toISOString().slice(0, 10);

  const { stages, leads, rules } = await loadCrmData(profile.client_id, from, `${to}T23:59:59`);

  return (
    <div className="space-y-4">
      <CrmStats stages={stages} leads={leads} />
      <CrmBoard clientId={profile.client_id} stages={stages} leads={leads} rules={rules} from={from} to={to} />
    </div>
  );
}
