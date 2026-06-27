alter table leads
  add column source_id text,
  add column ctwa_clid text,
  add column ad_id text,
  add column ad_name text,
  add column adset_name text,
  add column campaign_name text,
  add column account_name text;

-- staging: dados de anuncio resolvidos a partir do webhook nativo do
-- Evolution (messages.upsert), antes da conversa existir no Chatwoot. O
-- webhook do Chatwoot busca aqui por telefone+cliente (janela de tempo) pra
-- anexar ao lead quando ele for criado.
create table ad_attribution_staging (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references clients(id) on delete cascade,
  phone text not null,
  source_id text,
  ctwa_clid text,
  ad_id text,
  ad_name text,
  adset_name text,
  campaign_name text,
  account_name text,
  origin text not null default 'meta',
  created_at timestamptz not null default now()
);
create index ad_attribution_staging_lookup on ad_attribution_staging (client_id, phone, created_at desc);

alter table ad_attribution_staging enable row level security;
create policy "service role only" on ad_attribution_staging for all using (false);

-- token de app Meta compartilhado da agencia (renovado por cron) -- usado
-- so pra resolver sourceId->anuncio via Graph API Insights, nao e o mesmo
-- token de CAPI por pixel/conta de anuncio.
create table meta_app_token (
  id int primary key default 1,
  access_token_enc bytea not null,
  updated_at timestamptz not null default now(),
  constraint singleton check (id = 1)
);
alter table meta_app_token enable row level security;
create policy "service role only" on meta_app_token for all using (false);
