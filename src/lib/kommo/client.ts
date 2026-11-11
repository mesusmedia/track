// Dual-write pros 2 clientes que usam Kommo como CRM externo (em vez do
// kanban interno desta plataforma pra esses dois). Kommo API v4,
// subdominio + token por cliente (settings.kommo_subdomain/kommo_token_enc).
//
// Bug real visto hoje no pipeline n8n antigo: ele mandava texto cru pra
// campos customizados do tipo "select" do Kommo e recebia 400
// NotSupportedChoice em TODA escrita, silenciosamente, durante meses.
// Aqui: sempre busca a definicao dos campos antes e so manda enum_id pra
// campos select/multiselect -- nunca texto cru nesse tipo. Campo que nao
// acha enum compativel e simplesmente omitido (melhor faltar um campo do
// que quebrar a chamada inteira).

type KommoCustomField = {
  id: number;
  type: string;
  enums?: { id: number; value: string }[];
};

type FieldMap = Record<string, number>; // nome logico -> custom_field id

export async function fetchCustomFields(subdomain: string, token: string): Promise<KommoCustomField[]> {
  const res = await fetch(`https://${subdomain}.kommo.com/api/v4/leads/custom_fields?limit=250`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error(`Falha ao buscar custom fields do Kommo (${subdomain}): ${res.status}`);
  const body = await res.json();
  return (body._embedded?.custom_fields ?? []) as KommoCustomField[];
}

// so inclui um campo no payload final se: (a) existir na definicao real da
// conta, e (b) se for select/multiselect, o valor bater (case-insensitive)
// com uma opcao enum existente -- senao omite o campo, nunca manda texto
// cru num tipo fechado.
export function buildSafeCustomFieldsValues(
  fieldMap: FieldMap,
  values: Record<string, string | null | undefined>,
  fieldDefs: KommoCustomField[],
) {
  const defsById = new Map(fieldDefs.map((f) => [f.id, f]));
  const result: { field_id: number; values: { value: string | number }[] }[] = [];

  for (const [name, rawValue] of Object.entries(values)) {
    const fieldId = fieldMap[name];
    const value = rawValue?.trim();
    if (!fieldId || !value) continue;

    const def = defsById.get(fieldId);
    if (!def) continue; // id da planilha antiga pode ter mudado/sido removido na conta real

    if (def.type === "select" || def.type === "multiselect") {
      const enumMatch = def.enums?.find((e) => e.value.toLowerCase() === value.toLowerCase());
      if (!enumMatch) continue; // sem opcao compativel -- omite, nao inventa
      result.push({ field_id: fieldId, values: [{ value: enumMatch.id }] });
    } else {
      result.push({ field_id: fieldId, values: [{ value }] });
    }
  }
  return result;
}

export async function findLeadIdByPhone(subdomain: string, token: string, phone: string) {
  const digits = phone.replace(/\D/g, "");
  const res = await fetch(
    `https://${subdomain}.kommo.com/api/v4/leads?query=${encodeURIComponent(digits)}&limit=1`,
    { headers: { Authorization: `Bearer ${token}` } },
  );
  if (res.status === 204) return null;
  if (!res.ok) throw new Error(`Falha ao buscar lead no Kommo (${subdomain}): ${res.status}`);
  const body = await res.json();
  return (body._embedded?.leads?.[0]?.id as number | undefined) ?? null;
}

export async function updateLeadCustomFields(
  subdomain: string,
  token: string,
  leadId: number,
  customFieldsValues: { field_id: number; values: { value: string | number }[] }[],
) {
  if (customFieldsValues.length === 0) return;
  const res = await fetch(`https://${subdomain}.kommo.com/api/v4/leads/${leadId}`, {
    method: "PATCH",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ custom_fields_values: customFieldsValues }),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => null);
    throw new Error(`Falha ao atualizar lead ${leadId} no Kommo (${subdomain}): ${JSON.stringify(body)}`);
  }
}
