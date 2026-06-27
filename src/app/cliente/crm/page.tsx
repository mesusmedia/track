import { redirect } from "next/navigation";
import { getProfile } from "@/lib/auth/profile";
import { loadCrmData } from "@/lib/crm/load";
import { CrmBoard } from "@/components/crm-board";

export default async function ClienteCrmPage() {
  const profile = await getProfile();
  if (!profile?.client_id) redirect("/cliente");

  const { stages, leads, rules } = await loadCrmData(profile.client_id);

  return (
    <div className="space-y-4">
      <h1 className="text-lg font-semibold">CRM</h1>
      <CrmBoard clientId={profile.client_id} stages={stages} leads={leads} rules={rules} />
    </div>
  );
}
