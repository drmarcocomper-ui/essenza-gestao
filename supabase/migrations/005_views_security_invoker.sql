-- =====================================================================
-- Essenza — Migration 005: views de fechamento respeitam a RLS
--
-- Descoberto ao conferir as consultas do módulo de caixa: uma chamada
-- anônima (só com a NEXT_PUBLIC_SUPABASE_ANON_KEY, que vai no bundle do
-- navegador e é pública) recebia os dados das views:
--
--   GET /rest/v1/lancamentos          → []          (RLS barrou, correto)
--   GET /rest/v1/vw_a_receber         → 200 com nome da cliente e valor
--   GET /rest/v1/vw_resumo_competencia→ 200 com o faturamento do mês
--
-- Motivo: no Postgres, view criada sem `security_invoker` roda com os
-- privilégios do dono (postgres), e por isso não passa pela RLS das
-- tabelas de baixo. A policy de `lancamentos` existe e está certa — ela
-- simplesmente não era consultada por esse caminho.
--
-- Com `security_invoker = on` a view roda como quem chamou:
--   - `authenticated` continua vendo tudo (policy `using (true)`);
--   - `anon` passa a ver [], como já acontece nas tabelas.
-- =====================================================================

alter view public.vw_resumo_competencia set (security_invoker = on);
alter view public.vw_resumo_caixa       set (security_invoker = on);
alter view public.vw_a_receber          set (security_invoker = on);
