import { getProfile } from "@/lib/auth/profile";
import { loadEvents } from "@/lib/dashboard/load";
import { EventsTable } from "@/components/events-table";

export default async function ClienteEventosPage() {
  const profile = await getProfile();
  const events = await loadEvents(profile!.client_id!);
  return <EventsTable events={events} />;
}
