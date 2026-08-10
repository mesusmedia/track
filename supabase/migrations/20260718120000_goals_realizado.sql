-- Só o investimento realizado é manual; o resto vem do CRM automaticamente.
alter table goals
  add column if not exists real_investimento numeric(12,2) default null;
