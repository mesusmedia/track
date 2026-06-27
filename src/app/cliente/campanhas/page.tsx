import { getProfile } from "@/lib/auth/profile";
import { loadCampaigns } from "@/lib/dashboard/load";
import { CampaignsView } from "@/components/campaigns-view";

export default async function ClienteCampanhasPage() {
  const profile = await getProfile();
  const data = await loadCampaigns(profile!.client_id!);
  return <CampaignsView data={data} />;
}
