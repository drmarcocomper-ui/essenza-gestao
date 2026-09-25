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
--
-- ORDEM: (c) pode rodar a qualquer momento. (a) e (b) só depois da
-- migration 017 — sem ela a coluna `data_prevista` não existe.
-- =====================================================================


-- ---------------------------------------------------------------------
-- (a) Previsão que cada parcela de crédito pendente receberia
--
-- Só parcelas vindas de fechamento de conta (`atendimento_id`
-- preenchido), crédito, Pendentes. Regra: data do atendimento +
-- n × 30 dias, com n tirado de `parcelamento` ("2/3" → 2). Parcelamento
-- nulo é crédito em 1x: n = 1. Texto que não é n/N também cai em 1
-- (não deve existir em linha de atendimento — conferir se aparecer).
--
-- Usa `atendimentos.data`, não `data_competencia`: é o dia da venda
-- mesmo nas duas linhas cuja competência foi editada (bloco c).
-- ---------------------------------------------------------------------

select l.id,
       c.nome                     as cliente,
       l.parcelamento,
       a.data                     as data_atendimento,
       l.data_competencia,
       l.valor,
       l.data_prevista            as prevista_atual,
       a.data + 30 * (case
                        when l.parcelamento ~ '^\d+/\d+$'
                          then split_part(l.parcelamento, '/', 1)::int
                        else 1
                      end)        as prevista_nova
from public.lancamentos l
join public.atendimentos a on a.id = l.atendimento_id
left join public.clientes c on c.id = l.cliente_id
where l.forma_pagamento = 'Cartão de crédito'
  and l.status = 'Pendente'
order by prevista_nova, cliente;


-- ---------------------------------------------------------------------
-- (b) Preenche a previsão dessas parcelas pela mesma regra
--
-- Mesmo filtro do (a), mais `data_prevista is null`: não sobrescreve
-- previsão que já exista, e rodar de novo dá `update 0`. O número de
-- linhas do `update` tem que bater com o do SELECT (a) na primeira vez.
-- ---------------------------------------------------------------------

update public.lancamentos l
set data_prevista = a.data + 30 * (case
                                     when l.parcelamento ~ '^\d+/\d+$'
                                       then split_part(l.parcelamento, '/', 1)::int
                                     else 1
                                   end)
from public.atendimentos a
where a.id = l.atendimento_id
  and l.forma_pagamento = 'Cartão de crédito'
  and l.status = 'Pendente'
  and l.data_prevista is null;


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
