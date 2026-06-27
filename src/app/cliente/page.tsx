import { getProfile } from "@/lib/auth/profile";
import { loadOverview } from "@/lib/dashboard/load";
import { DashboardOverview } from "@/components/dashboard-overview";

export default async function ClienteHomePage() {
  const profile = await getProfile();
  const data = await loadOverview(profile!.client_id!);
  return <DashboardOverview data={data} />;
}
