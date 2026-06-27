"use server";

import { getProfile } from "@/lib/auth/profile";
import { createServiceClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { maybeDispatchPurchaseForLead } from "@/lib/crm/dispatch-purchase";

async function assertAccess(clientId: string) {
  const profile = await getProfile();
  if (!profile) throw new Error("Não autenticado");
  if (profile.role !== "agency_admin" && profile.client_id !== clientId) {
    throw new Error("Sem acesso a esse cliente");
  }
}

function revalidateCrmPaths(clientId: string) {
  revalidatePath(`/admin/clients/${clientId}/crm`);
  revalidatePath("/cliente/crm");
}

export async function moveLeadStage(leadId: string, stageId: string, clientId: string) {
  await assertAccess(clientId);
  const supabase = createServiceClient();
  const { error } = await supabase
    .from("leads")
    .update({ stage_id: stageId, updated_at: new Date().toISOString() })
    .eq("id", leadId);
  if (error) throw error;
  await maybeDispatchPurchaseForLead(leadId, clientId);
  revalidateCrmPaths(clientId);
}

export async function updateLeadRevenue(formData: FormData) {
  const leadId = String(formData.get("lead_id"));
  const clientId = String(formData.get("client_id"));
  await assertAccess(clientId);

  const revenue = Number(formData.get("revenue"));
  const supabase = createServiceClient();
  const { error } = await supabase
    .from("leads")
    .update({ revenue: Number.isFinite(revenue) ? revenue : null, updated_at: new Date().toISOString() })
    .eq("id", leadId);
  if (error) throw error;
  // valor pode ter sido preenchido depois do lead ja estar em "Vendido"
  await maybeDispatchPurchaseForLead(leadId, clientId);
  revalidateCrmPaths(clientId);
}

export async function addAutomationRule(formData: FormData) {
  const clientId = String(formData.get("client_id"));
  await assertAccess(clientId);

  const keyword = String(formData.get("keyword") ?? "").trim();
  const stageId = String(formData.get("stage_id") ?? "");
  if (!keyword || !stageId) throw new Error("Palavra-chave e etapa são obrigatórias");

  const supabase = createServiceClient();
  const { error } = await supabase
    .from("automation_rules")
    .insert({ client_id: clientId, keyword, stage_id: stageId });
  if (error) throw error;
  revalidateCrmPaths(clientId);
}

export async function removeAutomationRule(ruleId: string, clientId: string) {
  await assertAccess(clientId);
  const supabase = createServiceClient();
  const { error } = await supabase.from("automation_rules").delete().eq("id", ruleId);
  if (error) throw error;
  revalidateCrmPaths(clientId);
}
