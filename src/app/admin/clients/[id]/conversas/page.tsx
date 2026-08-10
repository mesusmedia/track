import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { ClientSubNav } from "@/components/client-subnav";

export default async function AdminClientConversasPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: client } = await supabase.from("clients").select("id, name").eq("id", id).single();
  if (!client) notFound();

  const chatwootUrl = process.env.CHATWOOT_BASE_URL;

  return (
    <div className="space-y-4">
      <ClientSubNav clientId={id} clientName={client.name} />
      {chatwootUrl ? (
        // Cancela padding do layout; header admin é h-16 + subnav ~90px ≈ 10rem
        <div className="-mx-6 -mb-6" style={{ height: "calc(100vh - 10rem)" }}>
          <iframe
            src={chatwootUrl}
            className="w-full h-full border-0"
            allow="microphone; camera"
            title="Central de Conversas"
          />
        </div>
      ) : (
        <div className="flex items-center justify-center h-64 text-muted-foreground text-sm">
          Central de conversas não configurada. Adicione CHATWOOT_BASE_URL nas variáveis de ambiente.
        </div>
      )}
    </div>
  );
}
