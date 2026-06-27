-- Fase 2: modelo de dados de tracking + captura

alter table clients add column slug text unique;
update clients set slug = lower(regexp_replace(name, '[^a-zA-Z0-9]+', '-', 'g')) where slug is null;
alter table clients alter column slug set not null;

-- 1 linha por cliente: webhook_token, moeda, test_event_code
create table settings (
  client_id uuid primary key references clients(id) on delete cascade,
  webhook_token text not null,
  currency text not null default 'BRL',
  test_event_code text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- contas de integracao: N por cliente, todas opcionais.
-- segredos vao cifrados em *_enc (bytea) via AES-256-GCM em codigo de servidor
-- (src/lib/crypto.ts), nao via pgcrypto no Postgres -- evita precisar expor a
-- chave de cifragem como GUC de sessao. Ver CLAUDE.md.
create table ga4_accounts (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references clients(id) on delete cascade,
  label text not null,
  measurement_id text not null,
  api_secret_enc bytea not null,
  active boolean not null default true,
  created_at timestamptz not null default now()
);
create index ga4_accounts_client_id_idx on ga4_accounts(client_id);

create table meta_pixels (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references clients(id) on delete cascade,
  label text not null,
  pixel_id text not null,
  capi_token_enc bytea not null,
  active boolean not null default true,
  created_at timestamptz not null default now()
);
create index meta_pixels_client_id_idx on meta_pixels(client_id);

create table meta_ad_accounts (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references clients(id) on delete cascade,
  label text not null,
  ad_account_id text not null,
  ads_token_enc bytea not null,
  active boolean not null default true,
  created_at timestamptz not null default now()
);
create index meta_ad_accounts_client_id_idx on meta_ad_accounts(client_id);

create table google_ads_accounts (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references clients(id) on delete cascade,
  label text not null,
  customer_id text not null,
  login_customer_id text,
  refresh_token_enc bytea not null,
  developer_token_enc bytea not null,
  active boolean not null default true,
  created_at timestamptz not null default now()
);
create index google_ads_accounts_client_id_idx on google_ads_accounts(client_id);

-- visitante identificado (site ou redirecionamento pro WhatsApp)
create table visitors (
  trck_user_id uuid primary key default gen_random_uuid(),
  client_id uuid not null references clients(id) on delete cascade,
  email_hash text,
  phone_hash text,
  fbp text,
  fbc text,
  fbclid text,
  gclid text,
  ctwa_clid text,
  ga_client_id text,
  ga_session_id text,
  utm_source text,
  utm_medium text,
  utm_campaign text,
  utm_term text,
  utm_content text,
  referrer text,
  ip text,
  user_agent text,
  geo_country text,
  geo_state text,
  geo_city text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index visitors_client_id_idx on visitors(client_id);

create table events_log (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references clients(id) on delete cascade,
  trck_user_id uuid references visitors(trck_user_id) on delete set null,
  event_name text not null,
  event_id text not null,
  utm_source text,
  utm_medium text,
  utm_campaign text,
  payload_meta jsonb,
  response_meta jsonb,
  payload_ga4 jsonb,
  response_ga4 jsonb,
  ip text,
  geo_country text,
  geo_city text,
  created_at timestamptz not null default now(),
  unique (client_id, event_id)
);
create index events_log_client_id_idx on events_log(client_id);
create index events_log_event_name_idx on events_log(event_name);
create index events_log_created_at_idx on events_log(created_at);

create table purchases (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references clients(id) on delete cascade,
  transaction_id text not null,
  trck_user_id uuid references visitors(trck_user_id) on delete set null,
  email_hash text,
  phone_hash text,
  produto text,
  valor numeric(12, 2),
  moeda text not null default 'BRL',
  status text not null default 'paid',
  utm_source text,
  utm_medium text,
  utm_campaign text,
  fbp text,
  fbc text,
  geo_country text,
  geo_city text,
  match_method text,
  meta_event_id text,
  response_meta jsonb,
  ga_client_id text,
  webhook_raw jsonb,
  created_at timestamptz not null default now(),
  unique (client_id, transaction_id)
);
create index purchases_client_id_idx on purchases(client_id);

alter table settings enable row level security;
alter table ga4_accounts enable row level security;
alter table meta_pixels enable row level security;
alter table meta_ad_accounts enable row level security;
alter table google_ads_accounts enable row level security;
alter table visitors enable row level security;
alter table events_log enable row level security;
alter table purchases enable row level security;

-- leitura escopada ao tenant; escrita so via service_role (sem policy de
-- insert/update/delete para authenticated/anon)
create policy "settings_select_scoped" on settings for select to authenticated
  using (client_id in (
    select id from clients where agency_id = current_agency_id()
      and (current_user_role() = 'agency_admin' or id = current_client_id())
  ));

create policy "ga4_accounts_select_scoped" on ga4_accounts for select to authenticated
  using (client_id in (
    select id from clients where agency_id = current_agency_id()
      and (current_user_role() = 'agency_admin' or id = current_client_id())
  ));

create policy "meta_pixels_select_scoped" on meta_pixels for select to authenticated
  using (client_id in (
    select id from clients where agency_id = current_agency_id()
      and (current_user_role() = 'agency_admin' or id = current_client_id())
  ));

create policy "meta_ad_accounts_select_scoped" on meta_ad_accounts for select to authenticated
  using (client_id in (
    select id from clients where agency_id = current_agency_id()
      and (current_user_role() = 'agency_admin' or id = current_client_id())
  ));

create policy "google_ads_accounts_select_scoped" on google_ads_accounts for select to authenticated
  using (client_id in (
    select id from clients where agency_id = current_agency_id()
      and (current_user_role() = 'agency_admin' or id = current_client_id())
  ));

create policy "visitors_select_scoped" on visitors for select to authenticated
  using (client_id in (
    select id from clients where agency_id = current_agency_id()
      and (current_user_role() = 'agency_admin' or id = current_client_id())
  ));

create policy "events_log_select_scoped" on events_log for select to authenticated
  using (client_id in (
    select id from clients where agency_id = current_agency_id()
      and (current_user_role() = 'agency_admin' or id = current_client_id())
  ));

create policy "purchases_select_scoped" on purchases for select to authenticated
  using (client_id in (
    select id from clients where agency_id = current_agency_id()
      and (current_user_role() = 'agency_admin' or id = current_client_id())
  ));
