-- =====================================================================
-- Essenza — Migration 014: vw_a_receber ganha o parcelamento
--
-- Motivo: a tela "A receber" passa a ser o lugar onde a Kamylle confirma
-- que uma parcela caiu. Hoje a carga real da view é de 23 lançamentos de
-- Entrada pendentes, R$ 10.206,93, quase tudo parcela de cartão — sem o
-- `parcelamento` na lista ela não distingue a 2/3 da 3/3 da mesma venda,
-- que têm cliente, descrição e valor iguais.
--
-- `id` e `data_competencia` já estavam na definição da 002; ficam como
-- estão. A única coluna nova é `parcelamento`.
--
-- ATENÇÃO 1: `with (security_invoker = true)` é obrigatório. A view ganhou
-- essa propriedade na 005; um `create or replace` sem ela volta a rodar
-- com os privilégios do dono, ignora a RLS de `lancamentos` e reabre para
-- a anon key (que vai no bundle do navegador) o vazamento que a 005
-- fechou — nome de cliente e valor a receber.
--
-- ATENÇÃO 2: `create or replace view` não reordena nem renomeia coluna
-- existente; só aceita coluna nova no FIM da lista. Por isso
-- `parcelamento` entra depois de `cliente`, fora da ordem em que se
-- leria. Trocar a posição exige `drop view` — e aí a policy e a
-- propriedade `security_invoker` teriam de ser refeitas à mão.
-- =====================================================================

create or replace view public.vw_a_receber
with (security_invoker = true) as
select l.id,
       l.data_competencia,
       l.descricao,
       l.valor,
       c.nome as cliente,
       l.parcelamento
from public.lancamentos l
left join public.clientes c on c.id = l.cliente_id
where l.tipo = 'Entrada'
  and l.status = 'Pendente'
order by l.data_competencia;
