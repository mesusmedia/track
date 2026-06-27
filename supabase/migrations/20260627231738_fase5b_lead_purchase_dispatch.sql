-- evita reenviar Purchase pro Meta se o lead sair e voltar pra etapa
-- "Vendido" (ex: movido por engano e corrigido).
alter table leads add column capi_purchase_sent_at timestamptz;
