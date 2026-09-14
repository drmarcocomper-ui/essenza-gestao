-- =====================================================================
-- Essenza — Migration 011: nome de produto não duplica no catálogo
--
-- Mesmo buraco que a 010 fechou em `servicos`, e que `produtos` ficou de
-- fora. `produtos` está vazia e só tem `produtos_pkey` e
-- `idx_produtos_tipo`: hoje nada impede duas linhas com o mesmo nome. O
-- catálogo de revenda da Kamylle vai ser importado por um script
-- aplicado à mão, query por query, no SQL Editor. Se ele rodar duas
-- vezes — e mão em celular roda — o catálogo inteiro duplica em
-- silêncio, e só se descobre quando a tela de venda mostra o mesmo
-- shampoo duas vezes. A trava tem que estar no banco ANTES da
-- importação, não depois.
--
-- POR QUE DUAS EXPRESSÕES (`nome` E `marca`), e não só o nome:
--   diferente de `servicos`, aqui o nome sozinho não identifica nada.
--   "Máscara" da Kerastase e "Máscara" da Wella são dois produtos, com
--   preço e estoque próprios, e a tabela tem `marca` exatamente para
--   isso. Um índice só sobre o nome mandaria a Kamylle inventar
--   "Máscara Wella" no campo nome para conseguir cadastrar o segundo —
--   ou seja, o banco estragaria o dado para se defender.
--
-- POR QUE `lower(trim(...))` nas duas:
--   mesmo inimigo da 010 — digitação. "Kerastase" / "kerastase" /
--   "Kerastase " são a mesma marca para quem trabalha, e um índice
--   sobre as colunas cruas deixaria as três passarem.
--
-- POR QUE `coalesce(marca, '')`:
--   `marca` é nullable — produto de granel, oxidante sem rótulo, o que
--   ela anotar sem marca. Em índice único NULL não conflita com NULL,
--   então dois produtos "Água oxigenada" sem marca passariam batido,
--   que é justamente o caso mais provável de duplicar na importação.
--   O `coalesce` transforma o ausente em string vazia, e aí os dois
--   colidem como devem. Efeito colateral aceito: uma marca gravada
--   literalmente como '' é tratada como "sem marca". Não é dado que
--   alguém produza de propósito.
--
-- POR QUE PARCIAL (`where ativo`):
--   mesma razão da 010. `ativo` é soft delete — o repo nunca apaga
--   produto (`produtos` é referenciada por `atendimento_itens.produto_id`
--   com `on delete restrict`, então a linha antiga fica para sempre).
--   Um índice total condenaria a Kamylle: desativou um shampoo que ela
--   parou de revender, voltou a revender um ano depois, e o histórico
--   bloquearia o cadastro. Parcial mantém a trava onde ela importa (o
--   catálogo em uso) e deixa o arquivo morto quieto. Efeito colateral
--   aceito: dá para ter N linhas iguais inativas. É lixo invisível,
--   não erro.
--
-- POR QUE SEM `unaccent` — decisão, não esquecimento:
--   igual à 010, e pelo mesmo motivo registrado lá: "Máscara" e
--   "Mascara" passam as duas por este índice. Pegar isso exigiria a
--   extensão `unaccent`, e `unaccent()` é STABLE, não IMMUTABLE
--   (depende de dicionário), então nem dá para botar direto na
--   expressão do índice: precisaria de uma função wrapper marcada
--   immutable à força — mentir para o planner — e de mais uma extensão
--   viva no banco. Para um catálogo de dezenas de linhas, digitado por
--   uma pessoa só, o preço não paga o ganho. Se um dia doer, o conserto
--   é editar o nome na tela, não instalar extensão.
--
-- Também não pega "Shampoo" vs "Shampoo 250ml" da mesma marca. Isso
-- pode ser embalagem diferente, e ninguém deveria querer que o banco
-- opine.
-- =====================================================================

create unique index if not exists uq_produtos_nome_marca
  on public.produtos (lower(trim(nome)), lower(trim(coalesce(marca, ''))))
  where ativo;

comment on index public.uq_produtos_nome_marca is
  'Impede dois produtos ativos com o mesmo nome E mesma marca, ignorando caixa e espaço nas pontas. Marca nula conta como marca vazia, então dois produtos sem marca e de mesmo nome colidem. Não ignora acento: "Máscara" e "Mascara" convivem (ver 011).';
