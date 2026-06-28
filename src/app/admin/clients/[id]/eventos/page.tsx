import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { loadEvents } from "@/lib/dashboard/load";
import { EventsTable } from "@/components/events-table";
import { ClientSubNav } from "@/components/client-subnav";

export default async function AdminClientEventosPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: client } = await supabase.from("clients").select("id, name").eq("id", id).single();
  if (!client) notFound();

  const events = await loadEvents(id);
  return (
    <div className="space-y-4">
      <ClientSubNav clientId={id} clientName={client.name} />
      <EventsTable events={events} />
    </div>
  );
}
