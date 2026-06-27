-- Fase 5: CRM kanban + automacao por palavra-chave

create table pipeline_stages (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references clients(id) on delete cascade,
  name text not null,
  position int not null,
  created_at timestamptz not null default now()
);
create index pipeline_stages_client_id_idx on pipeline_stages(client_id);

create table leads (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references clients(id) on delete cascade,
  trck_user_id uuid references visitors(trck_user_id) on delete set null,
  stage_id uuid references pipeline_stages(id) on delete set null,
  name text,
  phone text,
  conversation_external_id text,
  revenue numeric(12, 2),
  utm_source text,
  utm_medium text,
  utm_campaign text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (client_id, conversation_external_id)
);
create index leads_client_id_idx on leads(client_id);
create index leads_stage_id_idx on leads(stage_id);

create table automation_rules (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references clients(id) on delete cascade,
  keyword text not null,
  stage_id uuid not null references pipeline_stages(id) on delete cascade,
  active boolean not null default true,
  created_at timestamptz not null default now()
);
create index automation_rules_client_id_idx on automation_rules(client_id);

alter table pipeline_stages enable row level security;
alter table leads enable row level security;
alter table automation_rules enable row level security;

create policy "pipeline_stages_select_scoped" on pipeline_stages for select to authenticated
  using (client_id in (
    select id from clients where agency_id = current_agency_id()
      and (current_user_role() = 'agency_admin' or id = current_client_id())
  ));

create policy "leads_select_scoped" on leads for select to authenticated
  using (client_id in (
    select id from clients where agency_id = current_agency_id()
      and (current_user_role() = 'agency_admin' or id = current_client_id())
  ));

create policy "automation_rules_select_scoped" on automation_rules for select to authenticated
  using (client_id in (
    select id from clients where agency_id = current_agency_id()
      and (current_user_role() = 'agency_admin' or id = current_client_id())
  ));
