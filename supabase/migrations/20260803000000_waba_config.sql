-- API Oficial WhatsApp (Meta Cloud API): Phone Number ID pra resolver client_id
-- no webhook /api/webhook/whatsapp. Coexiste com as colunas Evolution durante
-- o período de migração (clientes migram um a um).
alter table settings
  add column if not exists waba_phone_number_id text,
  add column if not exists waba_id text,
  add column if not exists waba_access_token_enc bytea,
  add column if not exists whatsapp_mode text not null default 'evolution'
    check (whatsapp_mode in ('evolution', 'official'));
