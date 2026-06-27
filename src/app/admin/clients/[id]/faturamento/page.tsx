import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { loadBilling } from "@/lib/dashboard/load";
import { BillingView } from "@/components/billing-view";

export default async function AdminClientFaturamentoPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: client } = await supabase.from("clients").select("id, name").eq("id", id).single();
  if (!client) notFound();

  const data = await loadBilling(id);
  return (
    <div className="space-y-4">
      <h1 className="text-lg font-semibold">{client.name} — Faturamento</h1>
      <BillingView data={data} />
    </div>
  );
}
