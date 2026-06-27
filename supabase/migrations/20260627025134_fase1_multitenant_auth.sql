-- Fase 1: multi-tenant base (agencies, clients, users_profile) + RLS

create extension if not exists pgcrypto;

create type user_role as enum ('agency_admin', 'client');

create table agencies (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_at timestamptz not null default now()
);

create table clients (
  id uuid primary key default gen_random_uuid(),
  agency_id uuid not null references agencies(id) on delete cascade,
  name text not null,
  created_at timestamptz not null default now()
);
create index clients_agency_id_idx on clients(agency_id);

create table users_profile (
  id uuid primary key references auth.users(id) on delete cascade,
  agency_id uuid not null references agencies(id) on delete cascade,
  role user_role not null,
  client_id uuid references clients(id) on delete set null,
  created_at timestamptz not null default now()
);
create index users_profile_agency_id_idx on users_profile(agency_id);

alter table agencies enable row level security;
alter table clients enable row level security;
alter table users_profile enable row level security;

-- funcoes security definer: leem users_profile sem reacionar as proprias
-- policies de users_profile (evita recursao infinita no RLS)
create or replace function current_agency_id()
returns uuid
language sql security definer stable
set search_path = public
as $$
  select agency_id from users_profile where id = auth.uid()
$$;

create or replace function current_user_role()
returns user_role
language sql security definer stable
set search_path = public
as $$
  select role from users_profile where id = auth.uid()
$$;

create or replace function current_client_id()
returns uuid
language sql security definer stable
set search_path = public
as $$
  select client_id from users_profile where id = auth.uid()
$$;

-- leitura: somente autenticado, escopada ao proprio tenant.
-- nenhuma policy de insert/update/delete para authenticated/anon -> escrita
-- so acontece via service_role (que ignora RLS), conforme exigido.
create policy "agencies_select_own" on agencies for select to authenticated
  using (id = current_agency_id());

create policy "clients_select_scoped" on clients for select to authenticated
  using (
    agency_id = current_agency_id()
    and (current_user_role() = 'agency_admin' or id = current_client_id())
  );

create policy "users_profile_select_scoped" on users_profile for select to authenticated
  using (
    agency_id = current_agency_id()
    and (current_user_role() = 'agency_admin' or id = auth.uid())
  );
