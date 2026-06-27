-- Fase 4: webhook de compra (identificacao do cliente pelo token) + retencao de logs

alter table settings add constraint settings_webhook_token_key unique (webhook_token);

create extension if not exists pg_cron;

-- ponytail: um UPDATE so (sem lotes) -- revisar se o volume de events_log
-- crescer o suficiente pra essa query travar por muito tempo.
create or replace function purge_old_event_payloads()
returns void
language sql
as $$
  update events_log
  set payload_meta = null, response_meta = null, payload_ga4 = null, response_ga4 = null
  where created_at < now() - interval '14 days'
    and (payload_meta is not null or response_meta is not null
         or payload_ga4 is not null or response_ga4 is not null)
$$;

select cron.schedule('purge_old_event_payloads_daily', '0 3 * * *', 'select purge_old_event_payloads()');
