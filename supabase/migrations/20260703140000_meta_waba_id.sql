alter table settings
  add column if not exists meta_waba_id text;

-- Dr. Lucas Pitão confirmado em 2026-07-03
update settings set meta_waba_id = '1046532160642193'
  where client_id = (select id from clients where slug = 'C52-DrLucasPitao');
