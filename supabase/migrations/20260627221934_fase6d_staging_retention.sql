-- ad_attribution_staging so serve pra ponte entre o webhook do Evolution e o
-- do Chatwoot (janela de 30min, ver route.ts) -- depois disso nao tem mais
-- utilidade, diferente de events_log que mantem o registro e so limpa o
-- payload pesado.
create or replace function purge_old_ad_attribution_staging()
returns void
language sql
as $$
  delete from ad_attribution_staging where created_at < now() - interval '2 days'
$$;

select cron.schedule('purge_old_ad_attribution_staging_daily', '0 3 * * *', 'select purge_old_ad_attribution_staging()');
