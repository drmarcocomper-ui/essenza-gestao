-- =====================================================================
-- Essenza — Migration 017: previsão de recebimento das parcelas
--
-- Regra registrada em 25/09/2026, e que substitui "o app nunca prevê
-- data de compensação": parcela de crédito ganha uma PREVISÃO de quando
-- cai. A maquininha não tem antecipação; a parcela n (1..N) é prevista
-- para a data do atendimento + n × 30 dias. 23/09 em 3x → 23/10, 22/11,
-- 22/12. Quem calcula é a aplicação (`calcularDatasPrevistas`,
-- src/lib/atendimentos/conta.ts), no fechamento de conta.
--
-- O QUE NÃO MUDA:
--   `data_competencia` continua sendo a data do atendimento, em todas as
--   parcelas. `data_caixa` continua nula enquanto Pendente e só é
--   preenchida quando ela confirma o recebimento. A previsão é uma
--   coluna à parte justamente para não mexer no significado dessas duas.
--   Por isso a trigger da 016 não olha `data_prevista`: previsão no
--   futuro é o normal.
--
-- `data_prevista` é nula no histórico da planilha, em tudo que não é
-- crédito e em lançamento manual sem previsão informada. O preenchimento
-- das parcelas já gravadas fica em supabase/scripts/
-- correcao_parcelas_cartao.sql, aplicado à parte.
--
-- A VIEW:
--   `vw_a_receber` passa a expor `data_prevista` e a ordenar por ela,
--   nulas no fim. A coluna entra no FIM da lista pelo mesmo motivo da
--   014 (`create or replace view` só aceita coluna nova no fim).
--   `with (security_invoker = true)` é obrigatório: sem ele a view roda
--   como o dono, ignora a RLS e abre nome de cliente e valor a receber
--   para a anon key (ver 005).
--
-- DOIS COMANDOS: a coluna e depois a view. No SQL Editor, colar e rodar
-- um de cada vez. Depois, sondar `vw_a_receber` com a anon key numa aba
-- anônima e confirmar que volta [].
-- =====================================================================

-- ---------------------------------------------------------------------
-- COMANDO 1 — coluna
-- ---------------------------------------------------------------------
alter table public.lancamentos
  add column data_prevista date;

comment on column public.lancamentos.data_prevista is
  'Previsão de recebimento (parcela de crédito: atendimento + n × 30 dias). Informativa: não é data de caixa.';

-- ---------------------------------------------------------------------
-- COMANDO 2 — view
-- ---------------------------------------------------------------------
create or replace view public.vw_a_receber
with (security_invoker = true) as
select l.id,
       l.data_competencia,
       l.descricao,
       l.valor,
       c.nome as cliente,
       l.parcelamento,
       l.data_prevista
from public.lancamentos l
left join public.clientes c on c.id = l.cliente_id
where l.tipo = 'Entrada'
  and l.status = 'Pendente'
order by l.data_prevista nulls last, l.data_competencia;
