-- Feature A: backup em Google Sheets por cliente
alter table settings
  add column sheet_id text,
  add column sheet_gid text not null default '1048674045';

-- Feature B: dual-write Kommo pros clientes que usam Kommo como CRM externo
-- (em vez do kanban interno desta plataforma). Token cifrado igual aos
-- outros segredos de integracao (src/lib/crypto.ts).
alter table settings
  add column kommo_subdomain text,
  add column kommo_token_enc bytea;

-- Feature D: saude das instancias Evolution + alertas. Tabela separada de
-- settings (atualizada com alta frequencia pelo cron, nao precisa do resto
-- das colunas de settings por perto).
-- last_open_at e atualizado SO quando o estado checado e "open" -- fica
-- parado no ultimo momento em que a instancia esteve de fato conectada,
-- mesmo que checked_at avance a cada rodada do cron. E contra esse campo
-- que o alerta de "caiu ha mais de N min" e calculado (ve route.ts).
create table instance_health (
  client_id uuid primary key references clients(id) on delete cascade,
  connection_state text not null,
  checked_at timestamptz not null default now(),
  last_open_at timestamptz
);

create table alerts (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references clients(id) on delete cascade,
  type text not null, -- 'instance_down' | 'attribution_broken'
  message text not null,
  created_at timestamptz not null default now(),
  resolved_at timestamptz
);
create index alerts_client_id_idx on alerts(client_id);
create index alerts_open_idx on alerts(client_id, type) where resolved_at is null;

alter table instance_health enable row level security;
alter table alerts enable row level security;

create policy "instance_health_select_scoped" on instance_health for select to authenticated
  using (client_id in (
    select id from clients where agency_id = current_agency_id()
      and (current_user_role() = 'agency_admin' or id = current_client_id())
  ));

create policy "alerts_select_scoped" on alerts for select to authenticated
  using (client_id in (
    select id from clients where agency_id = current_agency_id()
      and (current_user_role() = 'agency_admin' or id = current_client_id())
  ));
