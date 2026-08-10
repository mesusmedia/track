import { createClient } from "@/lib/supabase/server";

export async function loadCrmData(clientId: string, from?: string, to?: string) {
  const supabase = await createClient();

  let leadsQuery = supabase
    .from("leads")
    .select("id, name, phone, stage_id, max_position, revenue, utm_source, utm_campaign, campaign_name, adset_name, ad_name, notes, created_at")
    .eq("client_id", clientId)
    .order("created_at", { ascending: false });
  if (from) leadsQuery = leadsQuery.gte("created_at", from);
  if (to) leadsQuery = leadsQuery.lte("created_at", to);

  const [stages, leads, rules] = await Promise.all([
    supabase
      .from("pipeline_stages")
      .select("id, name, position")
      .eq("client_id", clientId)
      .order("position", { ascending: true }),
    leadsQuery,
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
