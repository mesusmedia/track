import { createClient } from "@/lib/supabase/server";

export async function loadCrmData(clientId: string) {
  const supabase = await createClient();

  const [stages, leads, rules] = await Promise.all([
    supabase
      .from("pipeline_stages")
      .select("id, name, position")
      .eq("client_id", clientId)
      .order("position", { ascending: true }),
    supabase
      .from("leads")
      .select("id, name, phone, stage_id, revenue, utm_source")
      .eq("client_id", clientId)
      .order("created_at", { ascending: false }),
    supabase
      .from("automation_rules")
      .select("id, keyword, stage_id")
      .eq("client_id", clientId)
      .eq("active", true),
  ]);

  return {
    stages: stages.data ?? [],
    leads: leads.data ?? [],
    rules: rules.data ?? [],
  };
}
