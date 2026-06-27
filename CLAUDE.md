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
- Segredos de integração (tokens GA4/Meta/Evolution) ficam em tabelas no
  Postgres, cifrados via `pgcrypto`, nunca em variáveis de ambiente.
- Comentários `ponytail: ...` marcam simplificações deliberadas com teto
  conhecido — ver o comentário para o caminho de upgrade.

## Comandos

```bash
npm run dev      # dev server
npm run build    # build de produção (rodar ao fim de cada fase)
npm run lint
```

## Versões de API externas (constantes únicas, fáceis de atualizar)

- Meta Graph API (CAPI): constante a definir em `src/lib/meta/constants.ts`
  na Fase 3 — conferir a versão mais recente em
  https://developers.facebook.com/docs/graph-api/changelog antes de integrar.
- GA4 Measurement Protocol: sem versão na URL, mas conferir doc oficial antes
  da Fase 3.

## Estado das fases

- [x] Fase 0 — Setup do projeto, design system, Supabase clients, CLAUDE.md
- [ ] Fase 1 — Auth + multi-tenant + painéis base
- [ ] Fase 2 — Modelo de dados de tracking + captura
- [ ] Fase 3 — Integração Meta CAPI + GA4
- [ ] Fase 4 — Webhook de compra + vinculação
- [ ] Fase 5 — CRM kanban + automação por palavra-chave
- [ ] Fase 6 — WhatsApp (Evolution API) + Chatwoot
- [ ] Fase 7 — Dashboards finais
- [ ] Fase 8 — Auditoria de segurança + publicação

@AGENTS.md
