-- =====================================================================
-- Essenza — Migration 004: permite lançamento com valor zero
--
-- Cortesias e atendimentos em confiança são registrados com valor 0,00
-- para manter o histórico do cliente. A constraint original exigia
-- valor > 0 e rejeitava 9 linhas da importação.
-- =====================================================================

alter table public.lancamentos drop constraint if exists lancamentos_valor_check;
alter table public.lancamentos add constraint lancamentos_valor_check check (valor >= 0);