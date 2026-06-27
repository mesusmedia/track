import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { loadCrmData } from "@/lib/crm/load";
import { CrmBoard } from "@/components/crm-board";

export default async function AdminClientCrmPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: client } = await supabase.from("clients").select("id, name").eq("id", id).single();
  if (!client) notFound();

  const { stages, leads, rules } = await loadCrmData(id);

  return (
    <div className="space-y-4">
      <Link href="/admin" className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="size-4" /> Voltar
      </Link>
      <h1 className="text-lg font-semibold">{client.name} — CRM</h1>
      <CrmBoard clientId={id} stages={stages} leads={leads} rules={rules} />
    </div>
  );
}
