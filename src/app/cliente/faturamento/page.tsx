import { getProfile } from "@/lib/auth/profile";
import { loadBilling } from "@/lib/dashboard/load";
import { BillingView } from "@/components/billing-view";

export default async function ClienteFaturamentoPage() {
  const profile = await getProfile();
  const data = await loadBilling(profile!.client_id!);
  return <BillingView data={data} />;
}
