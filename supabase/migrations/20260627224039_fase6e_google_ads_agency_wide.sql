-- Atribuicao de anuncio Google Ads passou a usar token unico da agencia
-- (MCC, env vars), nao mais OAuth por cliente -- ver CLAUDE.md. So o
-- customer_id de cada conta ainda e necessario por cliente.
alter table google_ads_accounts alter column refresh_token_enc drop not null;
alter table google_ads_accounts alter column developer_token_enc drop not null;
