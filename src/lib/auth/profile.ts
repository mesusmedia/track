import { createClient } from "@/lib/supabase/server";

export type Profile = {
  id: string;
  agency_id: string;
  role: "agency_admin" | "client";
  client_id: string | null;
};

export async function getProfile(): Promise<Profile | null> {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return null;

  const { data: profile } = await supabase
    .from("users_profile")
    .select("id, agency_id, role, client_id")
    .eq("id", auth.user.id)
    .single();

  return profile ?? null;
}
