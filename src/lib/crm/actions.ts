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

  const { data: stage } = await supabase
    .from("pipeline_stages")
    .select("position, name")
    .eq("id", stageId)
    .single();

  const { data: lead } = await supabase
    .from("leads")
    .select("max_position")
    .eq("id", leadId)
    .single();

  // Perdido e Faltou são estágios que não avançam max_position: Perdido é saída
  // definitiva, Faltou é falha de comparecimento — se avançassem, inflavam a
  // contagem de comparecimentos (Faltou tem posição > Compareceu).
  const stageLower = stage?.name?.toLowerCase() ?? "";
  const isPerdido = stageLower.includes("perdido");
  const isFaltou = stageLower.includes("faltou");
  const newMaxPosition = isPerdido || isFaltou
    ? (lead?.max_position ?? null)
    : Math.max(stage?.position ?? 0, lead?.max_position ?? 0);

  const { error } = await supabase
    .from("leads")
    .update({ stage_id: stageId, max_position: newMaxPosition, updated_at: new Date().toISOString() })
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

export async function updateLeadNotes(leadId: string, notes: string, clientId: string) {
  await assertAccess(clientId);
  const supabase = createServiceClient();
  const { error } = await supabase
    .from("leads")
    .update({ notes: notes.trim() || null, updated_at: new Date().toISOString() })
    .eq("id", leadId);
  if (error) throw error;
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

export async function createLeadManual(formData: FormData) {
  const clientId = String(formData.get("client_id"));
  await assertAccess(clientId);

  const name  = String(formData.get("name") ?? "").trim() || null;
  const phone = String(formData.get("phone") ?? "").trim() || null;
  const stageId = String(formData.get("stage_id") ?? "").trim() || null;
  const notes = String(formData.get("notes") ?? "").trim() || null;

  const supabase = createServiceClient();
  const { error } = await supabase.from("leads").insert({
    client_id: clientId,
    name,
    phone,
    stage_id: stageId,
    notes,
    utm_source: "manual",
  });
  if (error) throw error;
  revalidateCrmPaths(clientId);
}

export async function deleteLeadAction(clientId: string, leadId: string) {
  await assertAccess(clientId);
  const supabase = createServiceClient();
  const { error } = await supabase.from("leads").delete().eq("id", leadId).eq("client_id", clientId);
  if (error) throw error;
  revalidateCrmPaths(clientId);
}

export async function toggleClientActive(clientId: string, active: boolean) {
  const profile = await getProfile();
  if (!profile || profile.role !== "agency_admin") throw new Error("Sem acesso");
  const supabase = createServiceClient();
  const { error } = await supabase.from("clients").update({ active }).eq("id", clientId);
  if (error) throw error;
  revalidatePath("/admin/clients");
}
