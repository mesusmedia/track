alter table goals
  add column if not exists real_cpl numeric(12,2) default null;
