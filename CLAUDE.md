# Essenza — app de gestão

App de uso pessoal de uma cabeleireira autônoma (Kamylle). NÃO é SaaS,
não será comercializado.

## Regras invioláveis
- Single-tenant, usuária única. Nunca criar tenant_id, roles, perfis
  de acesso, convites, billing ou onboarding.
- Sem dark mode.
- Mobile-first sempre. A usuária opera de celular, em pé, entre
  atendimentos, com uma mão. Alvo de toque mínimo 44px.
- Português do Brasil em toda a UI. Moeda R$, datas dd/MM/yyyy.
- Escopo congelado na Fase 1. Não implementar despesas, comissões,
  NF-e, notificação push ou API do WhatsApp.

## Stack
Next.js 16 (App Router, Turbopack) + TypeScript + Tailwind 4 + Supabase.
@supabase/ssr 0.12.x — usar SEMPRE o padrão getAll/setAll nos cookies.
O padrão antigo get/set/remove está deprecado e quebra em silêncio.
No proxy, setAll recebe (cookiesToSet, headers) — o segundo argumento
existe a partir da 0.11 e carrega os headers de no-cache.
Next 16: middleware.ts foi substituído por src/proxy.ts. Não recriar
middleware.ts.

## Banco
Schema em supabase/migrations/. Aplicado manualmente pelo SQL Editor.
Toda alteração de schema vira um arquivo numerado novo, nunca edição
de migration já aplicada.
RLS ligada em todas as tabelas, com policy única para `authenticated`.

## Auth
Login com email e senha via signInWithPassword. Signup desabilitado
no Supabase; usuários são criados manualmente no painel. Não existe
fluxo de "esqueci minha senha" no app — reset é feito pelo painel.
Não há SMTP configurado: nenhuma feature pode depender de envio de
email.

## Validação antes de todo commit
npx tsc --noEmit && npx vitest run && npm run build

## Commits
O agente faz `git add` e `git commit`. O push é sempre manual, feito
pelo Marco após revisar com `git log` e `git show HEAD`.

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

## Dados
O banco já contém 123 clientes e 413 lançamentos de 2026 importados
da planilha (origem_registro = 'planilha'). Não gerar seed, não criar
dados de teste, não truncar tabela. Use os dados reais para
desenvolver e testar.

## Segurança
Toda view criada em migration DEVE ter `with (security_invoker = true)`.
Sem isso a view roda como o dono e ignora a RLS, expondo dados à chave
anônima que vai no bundle do navegador.
Após criar ou alterar view/tabela, sondar com a anon key numa aba
anônima e confirmar que retorna [].