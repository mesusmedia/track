alter table clients add column if not exists active boolean not null default true;
create index if not exists clients_active_idx on clients (active);
