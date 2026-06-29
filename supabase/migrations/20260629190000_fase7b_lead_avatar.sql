-- foto do contato no WhatsApp (Chatwoot contact.thumbnail), capturada na
-- criacao do lead -- nao precisa de chamada extra a API, o webhook ja
-- manda esse campo no payload.
alter table leads add column avatar_url text;
