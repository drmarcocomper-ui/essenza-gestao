-- =====================================================================
-- Essenza — Migration 008: de onde veio o serviço do catálogo
--
-- A tela de atendimento cadastra o serviço que a Kamylle digita na hora
-- (o item de atendimento exige `servico_id` — chk_item_referencia da
-- 001, não há caminho de texto solto). Esse serviço nasce sem preço, e
-- sem marca nenhuma ela não teria como achá-lo depois para precificar:
-- ficaria misturado com o catálogo montado com calma.
--
-- `origem_registro` é fato, não tarefa: descreve de onde a linha veio e
-- não precisa ser "resolvido" nem limpo depois. Mesmo nome e mesma ideia
-- da coluna que `lancamentos` já usa para separar o que veio da planilha
-- do que nasceu no app.
--
-- Para achar o que falta precificar:
--   select nome, criado_em from public.servicos
--   where origem_registro = 'atendimento' and preco_padrao = 0
--   order by criado_em desc;
-- =====================================================================

alter table public.servicos
  add column if not exists origem_registro text not null default 'catalogo';

alter table public.servicos
  drop constraint if exists chk_servicos_origem_registro;
alter table public.servicos
  add constraint chk_servicos_origem_registro
  check (origem_registro in ('catalogo','atendimento'));

comment on column public.servicos.origem_registro is
  'catalogo = cadastrado direto no catálogo; atendimento = criado no ato de um atendimento, com preço 0 à espera de preço.';
