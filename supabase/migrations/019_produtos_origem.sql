-- =====================================================================
-- Essenza — Migration 019: de onde veio o produto do catálogo
--
-- POR QUE AGORA:
--   em 21/09/2026 esta coluna foi descartada para `produtos` com a
--   condição "reabrir se surgir cadastro de produto no ato do
--   atendimento". Surgiu: a Kamylle vende na conta produtos que não
--   estão no catálogo (Color Spectrum, Vitaamino, Absolut Repair...), e
--   pediu para lançá-los na hora, como já faz com serviço desde a 008.
--
-- A mesma ideia da 008, na mesma forma: o fechamento da conta cadastra
-- o produto que ela digita (o item de atendimento exige `produto_id` —
-- chk_item_referencia da 001, não há caminho de texto solto). Esse
-- produto nasce sem preço (`preco_venda` NULL) e sem marca, e sem esta
-- coluna ficaria misturado com o catálogo montado com calma.
--
-- `origem_registro` é fato, não tarefa: descreve de onde a linha veio e
-- não precisa ser "resolvido" nem limpo depois.
--
-- Os 9 produtos existentes (015) ficam 'catalogo' pelo default, que é
-- a verdade para eles. Nenhum update.
--
-- Aplicada à mão, uma vez, pelo SQL Editor. Sem `if not exists` de
-- propósito: rodar duas vezes deve falhar alto, não passar calado.
--
-- Para achar o que falta precificar:
--   select nome, criado_em from public.produtos
--   where origem_registro = 'atendimento' and preco_venda is null
--   order by criado_em desc;
-- =====================================================================

alter table public.produtos
  add column origem_registro text not null default 'catalogo';

alter table public.produtos
  add constraint chk_produtos_origem_registro
  check (origem_registro in ('catalogo','atendimento'));

comment on column public.produtos.origem_registro is
  'catalogo = cadastrado direto no catálogo; atendimento = criado no ato do fechamento da conta, com preco_venda NULL à espera de preço.';
