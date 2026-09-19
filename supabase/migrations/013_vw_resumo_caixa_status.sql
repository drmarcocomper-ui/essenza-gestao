-- =====================================================================
-- Essenza — Migration 013: vw_resumo_caixa só soma lançamentos pagos
--
-- Aplicada à mão no SQL Editor em 14/09/2026; este arquivo registra o
-- que já está em produção.
--
-- Motivo: a view somava por data_caixa sem filtrar status. Um lançamento
-- Pendente com data prevista preenchida entraria no mês como dinheiro
-- recebido — uma parcela ainda não paga apareceria como entrada no caixa.
-- Agora só entram lançamentos com status = 'Pago'.
--
-- ATENÇÃO: `with (security_invoker = true)` é obrigatório. A view ganhou
-- essa cláusula na 005; um `create or replace` sem ela volta a rodar com
-- os privilégios do dono, ignora a RLS e reabre o vazamento para a anon
-- key que a 005 fechou.
-- =====================================================================

create or replace view public.vw_resumo_caixa
with (security_invoker = true) as
select to_char(data_caixa::timestamptz, 'YYYY-MM') as mes,
       sum(valor) filter (where tipo = 'Entrada') as recebido,
       sum(valor) filter (where tipo = 'Saída')   as pago,
       sum(valor) filter (where tipo = 'Entrada')
         - coalesce(sum(valor) filter (where tipo = 'Saída'), 0) as saldo
from lancamentos
where data_caixa is not null
  and status = 'Pago'
group by to_char(data_caixa::timestamptz, 'YYYY-MM');
