create table if not exists goals (
  id            uuid primary key default gen_random_uuid(),
  client_id     uuid not null references clients(id) on delete cascade,
  year          smallint not null,
  month         smallint not null check (month between 1 and 12),
  -- funil
  meta_agendamentos  integer default 0,
  meta_consultas     integer default 0,
  meta_vendas        integer default 0,
  -- financeiro
  meta_faturamento   numeric(12,2) default 0,
  orcamento_midia    numeric(12,2) default 0,
  created_at    timestamptz default now(),
  updated_at    timestamptz default now(),
  unique (client_id, year, month)
);

alter table goals enable row level security;

create policy "agency admin gerencia metas"
  on goals for all
  using (
    exists (
      select 1 from users_profile up
      where up.id = auth.uid()
        and up.role = 'agency_admin'
    )
  );

create policy "cliente le proprias metas"
  on goals for select
  using (
    exists (
      select 1 from users_profile up
      where up.id = auth.uid()
        and up.client_id = goals.client_id
    )
  );
