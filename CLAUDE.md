# Plataforma de Tracking + CRM + Multi-tenant

SaaS de agência: tracking server-side (Meta CAPI + GA4), CRM kanban alimentado por
webhooks do Chatwoot/Evolution API (WhatsApp), painel admin (agência) e painel
cliente, multi-tenant via RLS (sem subdomínios — o login define o tenant).

Plano completo de fases: `C:\Users\oluca\.claude\plans\cl-udio-eu-vou-te-spicy-candy.md`

## Stack

- Next.js 15 (App Router) + React 19 + TypeScript
- Tailwind CSS v4 + shadcn/ui (Radix)
- Supabase (Postgres + Auth + RLS), `@supabase/ssr`
- Recharts (gráficos). `react-simple-maps` ainda não suporta React 19 —
  decidir alternativa na Fase 7 (mapa geo).
- Deploy: Vercel. Repo: GitHub.

## Convenções

- Fontes: Manrope (`--font-sans`) e JetBrains Mono (`--font-mono`, usado em
  números/JSON via `font-mono tabular-nums`).
- Cores em HSL puras nas variáveis (`--primary: 142 76% 58%` etc), compostas
  com `hsl(var(--x))` em `src/app/globals.css`. Tema escuro é o padrão
  (`defaultTheme="dark"` em `next-themes`), toggle em `theme-toggle.tsx`.
- Cliente Supabase: `src/lib/supabase/client.ts` (browser), `server.ts`
  (Server Components/Route Handlers, com cookies), `createServiceClient()`
  (service_role — **só** em código server-only, nunca em Client Components).
- Multi-tenant: toda tabela de dados tem `agency_id` (e `client_id` quando
  aplicável). RLS sempre filtra por esses campos via `auth.uid()` →
  `users_profile`. Nenhuma tabela de dados é gravável pelo client; escrita
  sensível passa por Route Handler usando `createServiceClient()`.
- Segredos de integração (tokens GA4/Meta/Google Ads/Evolution) ficam em
  tabelas no Postgres, cifrados com AES-256-GCM em código de servidor
  (`src/lib/crypto.ts`, chave em `SECRETS_ENCRYPTION_KEY`) — nunca em texto
  puro nem em colunas legíveis pelo client. Ao escrever um Buffer cifrado numa
  coluna `bytea` via supabase-js, sempre converter com `bufferToBytea()`
  primeiro — passar o Buffer direto serializa como
  `{"type":"Buffer","data":[...]}` no JSON (bug já visto, corrigido na Fase 3).
- Campanhas reais são de clique-pra-WhatsApp (não venda em site). GA4/Pixel
  são opcionais por cliente (só fazem sentido pra quem tem landing page).
  Clique direto pro WhatsApp é rastreado via `ctwa_clid` (Meta, capturado no
  webhook da Fase 5/6) e `gclid` (Google, capturado em `/api/go/[clientSlug]`,
  o link de redirecionamento que o anúncio usa como destino antes do `wa.me`).
- Comentários `ponytail: ...` marcam simplificações deliberadas com teto
  conhecido — ver o comentário para o caminho de upgrade.

## Comandos

```bash
npm run dev      # dev server
npm run build    # build de produção (rodar ao fim de cada fase)
npm run lint
```

## Webhook de compra (Fase 4)

- `/api/webhook/compra?token=...&platform=hotmart|kiwify|eduzz|generic` —
  identifica o cliente pelo `webhook_token` (único, ver `settings`).
  Normalização por plataforma em `src/lib/webhooks/normalize.ts` —
  **os campos de Hotmart/Kiwify/Eduzz seguem o formato publicamente
  documentado (a doc oficial estava bloqueada por CloudFront ao implementar).
  Confirmar com um payload real de cada plataforma antes de ligar em
  produção.**
- Vinculação: `trck_user_id` completo ou só os 8 chars do ref code do
  `/api/go` (faixa de UUID por prefixo, já que a coluna é `uuid` e não aceita
  `ilike`) → fallback por hash de e-mail → hash de telefone.
- Idempotência: reenvio do mesmo `transaction_id` com status já `paid` não
  redispara pra Meta/GA4.
- Dispatch de evento (Meta CAPI + GA4) extraído pra `src/lib/dispatch.ts`,
  compartilhado entre `/api/event` e o webhook de compra.

## CRM kanban (Fase 5)

- `pipeline_stages`/`leads`/`automation_rules`, todas por `client_id`. 5 estágios
  padrão (Novo, Em atendimento, Agendado, Vendido, Perdido) semeados na criação
  do cliente (`src/app/admin/clients/actions.ts`).
- `/api/webhook/chatwoot?token=...` (mesmo `webhook_token` do webhook de
  compra) — evento `message_created`: primeira mensagem da conversa cria o
  lead na 1ª etapa e tenta linkar `trck_user_id` pelo ref code de 8 chars
  (`src/lib/visitors.ts#extractRefCode`); mensagens `outgoing` (da equipe) são
  comparadas contra `automation_rules` (substring case-insensitive) e movem o
  lead de etapa automaticamente. **Campos seguem o formato publicamente
  documentado do Chatwoot — confirmar com payload real antes de produção.**
- UI: `src/components/crm-board.tsx` — board simples (sem drag-and-drop, troca
  de etapa por `<Select>`) + gestão de regras de automação. Página em
  `/admin/clients/[id]/crm` e `/cliente/crm`.
- Gotcha do Base UI `Select`: `SelectValue` mostra o **valor bruto** quando o
  valor não é a label diretamente — para mostrar o nome da etapa em vez do
  `uuid`, passar uma função em `children`: `<SelectValue>{(id) => label(id)}</SelectValue>`.

## WhatsApp: Evolution API + Chatwoot (Fase 6)

- Infra agência-wide (1 servidor Evolution + 1 conta Chatwoot pra todos os
  clientes, várias inboxes): `EVOLUTION_BASE_URL`, `EVOLUTION_GLOBAL_API_KEY`,
  `CHATWOOT_BASE_URL`, `CHATWOOT_ACCOUNT_ID`, `CHATWOOT_API_ACCESS_TOKEN`,
  `CHATWOOT_WEBHOOK_SECRET` — todas em env (infra compartilhada, não por
  cliente, diferente das contas de integração que ficam no banco).
- Fluxo de conexão (`src/lib/whatsapp/actions.ts`): `connectWhatsapp` ->
  `POST /instance/create` (apikey global) retorna `hash.apikey` (chave da
  própria instância, cifrada e salva em `settings.evolution_instance_apikey_enc`)
  + QR code (`qrcode.base64`) já na criação -> `POST /chatwoot/set/{instance}`
  (apikey da instância) liga a integração nativa Evolution↔Chatwoot.
  **A inbox só é criada no Chatwoot depois que o WhatsApp conectar de verdade**
  (scan do QR) — por isso `syncChatwootInbox` (busca a inbox por nome e salva
  `settings.chatwoot_inbox_id`) só funciona depois disso, com erro claro se
  chamado antes.
- Webhook: como **todos os clientes compartilham a mesma conta Chatwoot**
  (várias inboxes, não uma conta por cliente), o webhook é **um só pra conta
  inteira** (registrado uma vez via API do Chatwoot, não por cliente) — em vez
  do padrão "um `webhook_token` por cliente" usado no webhook de compra.
  `/api/webhook/chatwoot` autentica por `CHATWOOT_WEBHOOK_SECRET` (compartilhado)
  e resolve o cliente por `settings.chatwoot_inbox_id = body.inbox.id`.
- Confirmado contra o servidor real da agência (não é só doc): `apikey` do
  servidor Evolution vai no header `apikey`; do Chatwoot vai no header
  `api-access-token` (com hífen, não underscore).
- **Vincular instância existente** (`linkExistingInstance` em
  `src/lib/whatsapp/actions.ts`): pros ~25 clientes que já estavam conectados
  no servidor Evolution/Chatwoot da agência antes dessa plataforma existir —
  só lê o que já existe (`GET /instance/fetchInstances?instanceName=X` com a
  apikey global, que já retorna a apikey da instância e o nome da inbox do
  Chatwoot configurada) e grava no nosso banco. Não cria nada, não gera QR
  code, não toca na instância real. O nome da instância real **não é igual
  ao slug do cliente** (ex: `C52-DrLucasPitao`) — por isso existe a coluna
  `settings.evolution_instance_name`, separada do slug.
- **Atenção a versões diferentes do Evolution**: o formato de resposta do
  `fetchInstances` varia — a v1 usada nos testes iniciais retorna
  `{"instance": {...}}` com `apikey`/`chatwoot.name_inbox` (snake_case); o
  servidor real da agência (mais novo) retorna um **array direto** com
  `token`/`Chatwoot.nameInbox` (camelCase). `findInstanceByName` em
  `src/lib/evolution/client.ts` trata os dois formatos.

## Dashboards finais (Fase 7)

- `src/lib/dashboard/load.ts`: `loadOverview`/`loadEvents`/`loadBilling`/`loadCampaigns`
  (queries diretas, sem agregação no banco — ok pro volume atual; revisar com
  `count`/views materializadas se a base crescer muito).
- Geo: **sem lib de mapa** (`react-simple-maps` não suporta React 19, e
  construir um mapa SVG próprio seria over-engineering pro que a agência
  precisa). Em vez disso, tabela "país/cidade" simples, alimentada pelos
  headers gratuitos da Vercel (`x-vercel-ip-country`/`x-vercel-ip-city`,
  populados em `/api/event`) — só funciona em produção (Vercel), fica vazio
  em dev local.
- Campanhas: receita por `utm_campaign` a partir de `purchases` (dado real).
  **ROAS/CPA cruzando gasto do Meta Ads não foi implementado** — exigiria
  capturar o `campaign_id` real do clique (não só o nome da UTM, que pode
  divergir do nome da campanha no Meta) para casar com o Ads Insights API.
  Ver `hasMetaAdsConfigured` em `loadCampaigns` — sinaliza quando o cliente
  tem conta Meta Ads cadastrada, mas a página ainda não cruza com gasto.

## Atribuição de anúncio (Fase 6c — substitui pipeline n8n)

- A agência já tinha um pipeline próprio (n8n + RabbitMQ + Google Sheets +
  CRM externo) que resolve qual anúncio/conjunto/campanha gerou um clique-
  pra-WhatsApp. Essa plataforma absorve essa lógica.
- **Achado importante**: o campo `contextInfo.externalAdReply.sourceId` (não
  o `ctwa_clid`) é o ID do objeto do anúncio no Graph API — dá pra consultar
  `GET /{sourceId}/insights?fields=campaign_name,adset_name,ad_name,ad_id,account_name`
  e pegar os nomes direto (`src/lib/meta/ads-insights.ts`). O `ctwa_clid` é
  outro campo, usado só pra mandar de volta pro Meta via CAPI (atribuição
  dentro do Ads Manager) — os dois aparecem juntos no mesmo `externalAdReply`.
- **Esse dado não sobrevive no Chatwoot** — o Chatwoot normaliza a mensagem
  pro formato dele e não repassa esse contexto nativo do WhatsApp. Por isso
  existe um **segundo webhook**, `/api/webhook/evolution` (evento nativo
  `messages.upsert`, registrado em paralelo ao que já existe pro RabbitMQ —
  os dois canais coexistem sem conflito), que captura isso antes do Chatwoot
  processar.
- Fluxo: `/api/webhook/evolution` resolve o anúncio e grava em
  `ad_attribution_staging` (por telefone+cliente) → `/api/webhook/chatwoot`,
  ao criar o lead na primeira mensagem, busca esse staging por telefone numa
  janela de 30min e anexa os campos em `leads` (`source_id`, `ctwa_clid`,
  `ad_id`, `ad_name`, `adset_name`, `campaign_name`, `account_name`).
- Pra cliques vindos do Google (sem `externalAdReply`), não tem parâmetro
  equivalente — a origem é inferida por uma frase-marcador fixa no texto da
  primeira mensagem (`"vim pelo site"`, configurada em
  `src/app/api/webhook/evolution/route.ts`), mesmo padrão que o n8n usava.
- Token do Meta pra resolver anúncios é **um só, da agência** (não por
  cliente) — `meta_app_token` (singleton, cifrado), renovado diariamente via
  Vercel Cron (`vercel.json` → `/api/cron/refresh-meta-token`, protegido por
  `CRON_SECRET`). Reaproveitado o Client ID/Secret do app Meta que a agência
  já usava no n8n.
- **Rollout em piloto**: o webhook novo no Evolution foi registrado só numa
  instância de teste antes de aplicar nas ~33 reais — checar se já foi
  expandido pra todas antes de assumir que está ativo em produção pra todo
  cliente.

## Versões de API externas (constantes únicas, fáceis de atualizar)

- Meta Graph API (CAPI): constante a definir em `src/lib/meta/constants.ts`
  na Fase 3 — conferir a versão mais recente em
  https://developers.facebook.com/docs/graph-api/changelog antes de integrar.
- GA4 Measurement Protocol: sem versão na URL, mas conferir doc oficial antes
  da Fase 3.

## Estado das fases

- [x] Fase 0 — Setup do projeto, design system, Supabase clients, CLAUDE.md
- [x] Fase 1 — Auth + multi-tenant + painéis base
- [x] Fase 2 — Modelo de dados de tracking + captura
- [x] Fase 3 — Integração Meta CAPI + GA4
- [x] Fase 4 — Webhook de compra + vinculação
- [x] Fase 5 — CRM kanban + automação por palavra-chave
- [x] Fase 6 — WhatsApp (Evolution API) + Chatwoot
- [x] Fase 7 — Dashboards finais
- [ ] Fase 8 — Auditoria de segurança + publicação

## Deploy (Vercel)

- O autor do commit precisa bater com um e-mail verificado na conta GitHub
  conectada ao projeto (`luhsdm`) — senão o Vercel bloqueia o deploy em
  produção mesmo com push normal ("Deployment Blocked: commit author did not
  have contributing access"). Git local configurado com `luh.sdm@gmail.com`.

@AGENTS.md
