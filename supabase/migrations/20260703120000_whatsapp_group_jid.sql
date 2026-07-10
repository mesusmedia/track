-- coluna para armazenar o JID do grupo WhatsApp de cada cliente,
-- usada pelo fluxo n8n de resumo diário do CRM.
-- JID formato: 120363XXXXXXXXXXX@g.us (grupos sempre terminam em @g.us)
-- populate: ver scripts/populate_whatsapp_group_jid.sql (roda manualmente depois)
alter table settings
  add column if not exists whatsapp_group_jid text;
