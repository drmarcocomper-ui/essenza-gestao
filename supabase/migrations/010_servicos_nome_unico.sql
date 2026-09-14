-- =====================================================================
-- Essenza — Migration 010: nome de serviço não duplica no catálogo
--
-- `servicos` está vazia e o único índice é a PK: hoje nada impede duas
-- linhas com o mesmo nome. O catálogo da Kamylle vai ser importado por
-- um script aplicado à mão, query por query, no SQL Editor. Se ele rodar
-- duas vezes — e mão em celular roda — o catálogo inteiro duplica em
-- silêncio, e só se descobre quando a tela de atendimento mostra
-- "Escova" duas vezes. A trava tem que estar no banco ANTES da
-- importação, não depois.
--
-- POR QUE `lower(trim(nome))`, e não `nome` puro:
--   o inimigo real é digitação. "Escova" / "escova" / "Escova " são o
--   mesmo serviço para quem trabalha, e um índice sobre `nome` cru
--   deixaria os três passarem.
--
-- POR QUE PARCIAL (`where ativo`):
--   `ativo` é soft delete — o repo nunca apaga serviço (`servicos` é
--   referenciada por `atendimento_itens` e por `agendamentos.servico_id`,
--   ambas `on delete restrict`, então a linha antiga fica para sempre).
--   Um índice total condenaria a Kamylle: desativado "Coloração" de 2025
--   com preço velho, ela nunca mais poderia cadastrar "Coloração" de
--   novo — o histórico bloquearia o presente. Parcial mantém a trava
--   onde ela importa (o catálogo em uso) e deixa o arquivo morto quieto.
--   Efeito colateral aceito: dá para ter N "Escova" inativas. É lixo
--   invisível, não erro.
--
-- POR QUE SEM `unaccent` — decisão, não esquecimento:
--   "Coloração" e "Coloracao" passam os dois por este índice. Sabemos.
--   Pegar isso exigiria a extensão `unaccent`, e `unaccent()` é STABLE,
--   não IMMUTABLE (depende de dicionário), então nem dá para botar
--   direto na expressão do índice: precisaria de uma função wrapper
--   marcada immutable à força — mentir para o planner — e de mais uma
--   extensão viva no banco. Para um catálogo de dezenas de linhas,
--   digitado por uma pessoa só, o preço não paga o ganho. Se um dia
--   doer, o conserto é editar o nome na tela, não instalar extensão.
--
-- Também não pega "Escova" vs "Escova Modelada". Isso é serviço
-- diferente, e ninguém deveria querer que o banco opine.
-- =====================================================================

create unique index if not exists uq_servicos_nome
  on public.servicos (lower(trim(nome)))
  where ativo;

comment on index public.uq_servicos_nome is
  'Impede dois serviços ativos com o mesmo nome ignorando caixa e espaço nas pontas. Não ignora acento: "Coloração" e "Coloracao" convivem (ver 010).';
