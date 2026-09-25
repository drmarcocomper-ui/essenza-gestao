-- =====================================================================
-- Essenza — Script: correção das parcelas de cartão
--
-- NÃO é migration. Não altera schema; só corrige dados. Aplicado à mão
-- no SQL Editor do Supabase, depois de revisado. Nada aqui roda sozinho.
--
-- COMO RODAR:
--   um bloco de cada vez, e o SELECT de conferência de cada bloco ANTES
--   do UPDATE. O SQL Editor só mostra o resultado da última query quando
--   se cola várias juntas.
-- =====================================================================


-- ---------------------------------------------------------------------
-- (c) Competência das duas parcelas editadas à mão pelo Caixa
--
-- As linhas adf18b9f… e 00e8944a… vieram do fechamento de conta e
-- tiveram `data_competencia` trocada na tela de edição do Caixa. A
-- competência de parcela é a data do atendimento; `mes_competencia`
-- acompanha, porque os relatórios por mês leem essa coluna.
--
-- Esperado: 2 linhas no SELECT, `update 2` no UPDATE. Qualquer outro
-- número, parar e investigar.
-- ---------------------------------------------------------------------

-- Conferência: como está e como vai ficar.
select l.id,
       l.parcelamento,
       l.data_competencia        as competencia_atual,
       a.data                    as competencia_correta,
       l.mes_competencia         as mes_atual,
       to_char(a.data, 'YYYY-MM') as mes_correto
from public.lancamentos l
join public.atendimentos a on a.id = l.atendimento_id
where l.id in ('adf18b9f-7d54-4a60-8685-643a996018b1',
               '00e8944a-829e-4918-8d6a-7dc421beed1a');

-- Correção.
update public.lancamentos l
set data_competencia = a.data,
    mes_competencia  = to_char(a.data, 'YYYY-MM')
from public.atendimentos a
where a.id = l.atendimento_id
  and l.id in ('adf18b9f-7d54-4a60-8685-643a996018b1',
               '00e8944a-829e-4918-8d6a-7dc421beed1a');
