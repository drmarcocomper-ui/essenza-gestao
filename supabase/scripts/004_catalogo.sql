-- =====================================================================
-- Essenza — Script 004: catálogo confirmado pela Kamylle
--
-- NÃO é migration. Não altera schema; só popula `servicos` e `produtos`,
-- que estão vazias. Aplicado à mão no SQL Editor do Supabase.
--
-- COMO RODAR:
--   uma query de cada vez. O SQL Editor só mostra o resultado da última
--   query quando se cola várias juntas, e aqui o resultado de cada uma
--   é a única confirmação de que ela entrou.
--
-- POR QUE DOIS INSERT E NÃO 33:
--   um INSERT com várias linhas é uma transação: ou entram as 24 linhas
--   de serviço, ou não entra nenhuma. Em 24 comandos soltos, uma falha
--   no meio deixaria o catálogo pela metade e sem sinal de onde parou.
--
-- POR QUE SEM `on conflict do nothing`:
--   de propósito. Se este script rodar duas vezes — e mão em celular
--   roda — os índices únicos da 010 (`uq_servicos_nome`) e da 011
--   (`uq_produtos_nome_marca`) têm que estourar com `duplicate key
--   value`. Num script aplicado à mão, erro visível vale mais que
--   silêncio: `do nothing` devolveria "Success" tanto na primeira
--   quanto na segunda passada, e o segundo "Success" é justamente o
--   que precisaria gritar.
--
-- POR QUE OS NOMES SAEM COMO ESTÃO:
--   grafia, acento, espaçamento e travessão vêm do catálogo da Kamylle
--   e não foram corrigidos. "Crhonologist", "Terrapiste", "lumiére" e
--   "Bead Head" estão assim de propósito. Quem quiser mudar, muda na
--   tela, com ela junto — não aqui.
--
-- `origem_registro` (008) fica OMITIDO no INSERT de serviços: o default
-- da coluna já é 'catalogo', que é exatamente o que estas 24 linhas são.
-- =====================================================================


-- ---------------------------------------------------------------------
-- QUERY 1 — SERVIÇOS (24 linhas)
--
-- `categoria` (012) grava o valor cru, minúsculo e sem acento, como
-- definido em src/lib/servicos/schema.ts. Não há `check` no banco: a
-- lista mora na aplicação. As cinco usadas aqui — coloracao, corte,
-- tratamento, extensao, servico — são as cinco de lá.
--
-- "Revisão" entra com categoria null. Null é estado válido e previsto
-- (ver 012), não buraco a preencher.
--
-- "Finalização com Escova" e "Finalização com Babyliss" entram com
-- preco_padrao 0. `preco_padrao` é `not null default 0`, então aqui o
-- zero é o próprio dado.
-- ---------------------------------------------------------------------
insert into public.servicos (nome, preco_padrao, categoria) values
  ('Protocolo Cuidado com os Brancos',          350.00, 'coloracao'),
  ('Essenza Cut Hair',                          350.00, 'corte'),
  ('Protocolo manutenção Extensão',             550.00, 'extensao'),
  ('Aplicação Extension',                       650.00, 'extensao'),
  ('Retirada Extension Capilar',                150.00, 'extensao'),
  ('Teste de Mechas',                           150.00, 'coloracao'),
  ('Protocolo lumiére Essenza — Mechas',       1200.00, 'coloracao'),
  ('Ritual reconstrução Premiere Kerastase',    480.00, 'tratamento'),
  ('Ritual Gloss Absolut',                      380.00, 'tratamento'),
  ('Ritual Crhonologist Kerastase',             380.00, 'tratamento'),
  ('Ritual Reconstrução Terrapiste Kerastase',  380.00, 'tratamento'),
  ('Nutritive Kerastase',                       380.00, 'tratamento'),
  ('Protocolo Nutrição Luxe Oil Wella',         350.00, 'tratamento'),
  ('Alinhamento Seal Aligner Truss',            480.00, 'tratamento'),
  ('Correção de cor',                           480.00, 'coloracao'),
  ('Protocolo Lissage',                         480.00, 'tratamento'),
  ('Tonalização',                               380.00, 'coloracao'),
  ('Revisão',                                   150.00, null),
  ('Protocolo de Nutrição',                     380.00, 'tratamento'),
  ('Protocolo de Hidratação',                   380.00, 'tratamento'),
  ('Finalização com Escova',                      0.00, 'servico'),
  ('Finalização com Babyliss',                    0.00, 'servico'),
  ('Protocolo Manutenção com Queratinização',   730.00, 'extensao'),
  ('Protocolo de Personalização Extensão',     1200.00, 'extensao');


-- ---------------------------------------------------------------------
-- QUERY 2 — PRODUTOS (9 linhas)
--
-- `tipo` e `unidade` vão EXPLÍCITOS nas nove linhas, e nenhum dos dois
-- é o default da tabela. `unidade` nasce 'g' (001) porque `produtos`
-- também guarda insumo de coloração medido em grama; um frasco de
-- revenda gravado em grama seria mentira silenciosa. `tipo` é
-- `not null` sem default, então teria que vir de qualquer forma.
--
-- `marca` fica null nas nove: a Kamylle ainda não mandou as marcas.
-- O índice da 011 é sobre (nome, coalesce(marca,'')), então marca nula
-- não afrouxa a trava — e os nove nomes são distintos entre si.
--
-- `preco_venda` é nullable (001) e fica null onde ela ainda não definiu
-- preço de revenda. Null é "sem preço definido"; 0 seria "de graça",
-- que é outra coisa.
-- ---------------------------------------------------------------------
insert into public.produtos (nome, marca, tipo, unidade, preco_venda) values
  ('Extensão capilar do Sul do Brasil',      null, 'revenda', 'un',   null),
  ('Ultimate Luxe Oil — 100 ml — Wella',     null, 'revenda', 'un', 229.90),
  ('Kit 3 produtos Ultimate Luxe Oil Wella', null, 'revenda', 'un', 650.00),
  ('Bain Terrapist',                         null, 'revenda', 'un',   null),
  ('Fondant Terrapist',                      null, 'revenda', 'un',   null),
  ('Masque Terrapist',                       null, 'revenda', 'un',   null),
  ('Gloss Absolu Glaze drops',               null, 'revenda', 'un', 399.00),
  ('The One Redken — protetor térmico',      null, 'revenda', 'un',   null),
  ('Finalizador Bead Head',                  null, 'revenda', 'un',   null);


-- =====================================================================
-- CONFERÊNCIA — rodar separado, depois dos dois INSERT.
-- Comentadas de propósito: não fazem parte da importação, e colar o
-- arquivo inteiro não deve disparar nada além dos dois INSERT.
-- =====================================================================

-- --- contagem por tabela (esperado: servicos 24, produtos 9) ----------
-- select 'servicos' as tabela, count(*) as linhas from public.servicos
-- union all
-- select 'produtos', count(*) from public.produtos;

-- --- serviços por categoria -------------------------------------------
-- esperado: tratamento 10, coloracao 5, extensao 5, servico 2, corte 1,
-- e 1 linha sem categoria ("Revisão").
-- select coalesce(categoria, '(sem categoria)') as categoria,
--        count(*) as linhas
-- from public.servicos
-- group by categoria
-- order by linhas desc, categoria;

-- --- sem preço ---------------------------------------------------------
-- serviço: preco_padrao é not null, então "sem preço" é o zero.
-- esperado: as duas finalizações.
-- select nome, preco_padrao from public.servicos
-- where preco_padrao = 0
-- order by nome;

-- produto: preco_venda é nullable, então "sem preço" é null.
-- esperado: 6 linhas.
-- select nome, preco_venda from public.produtos
-- where preco_venda is null
-- order by nome;
