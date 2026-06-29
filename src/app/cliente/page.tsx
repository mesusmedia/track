import { getProfile } from "@/lib/auth/profile";
import { loadOverview } from "@/lib/dashboard/load";
import { DashboardOverview } from "@/components/dashboard-overview";

export default async function ClienteHomePage({
  searchParams,
}: {
  searchParams: Promise<{ period?: string }>;
}) {
  const { period } = await searchParams;
  const periodDays = Number(period) > 0 ? Number(period) : 30;
  const profile = await getProfile();
  const data = await loadOverview(profile!.client_id!, periodDays);
  return <DashboardOverview data={data} />;
}
