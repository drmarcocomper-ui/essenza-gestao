-- =====================================================================
-- Essenza — Migration 015: o catálogo de serviços e produtos
--
-- Em 14/09/2026 o catálogo da Kamylle foi importado para o banco por um
-- script aplicado à mão no SQL Editor, e esse script nunca virou arquivo
-- no repo. As 24 linhas de `servicos` e as 9 de `produtos` existem no
-- banco em uso e não existem em migration nenhuma: rodar 001 a 014 num
-- banco limpo sobe o esquema com o catálogo vazio, e as telas 4A e 4B
-- abrem sem nada para mostrar. Este arquivo fecha esse buraco.
--
-- POR QUE 015 E NÃO 004:
--   o número da importação original seria o 004, e ele já está ocupado
--   pela `004_valor_zero.sql`, aplicada e imutável. As migrations vão de
--   001 a 014 sem buraco — o buraco não é de numeração, é de conteúdo.
--   Mesmo defeito do `003_importacao.sql`, que também não existe.
--
-- Os dados abaixo foram extraídos do banco em 20/09/2026, e reproduzem o
-- estado de 14/09/2026.
--
-- SEM `on conflict do nothing`, DE PROPÓSITO:
--   rodar este arquivo duas vezes TEM de parar com `duplicate key
--   value`, pelas travas da 010 (`uq_servicos_nome`) e da 011
--   (`uq_produtos_nome_marca`). Num script aplicado à mão, o silêncio
--   faria acreditar que rodou.
--
-- DOIS INSERTS, NÃO 33:
--   cada insert multi-linha é uma transação — ou entra o catálogo
--   inteiro, ou não entra nada. Além disso o SQL Editor só mostra o
--   resultado da última query quando se roda várias juntas, e 33
--   comandos esconderiam 32 resultados.
--
-- COLUNAS OMITIDAS, E POR QUÊ:
--   `duracao_min` — 60 em todas as 24 linhas, que é o default da coluna
--     e não dado dela: a Kamylle disse que o tempo é "muito relativo" e
--     a importação nunca preencheu. Sem Agenda, ninguém lê o campo.
--     Gravar 60 faria esta migration afirmar uma duração que ela nunca
--     informou.
--   `estoque_atual` / `estoque_minimo` — 0.00 nas nove, também o
--     default. Movimentação de estoque está fora da Fase 1: ninguém
--     contou frasco nenhum. Ela tem produto na prateleira, então zero
--     explícito seria afirmação falsa, não dado.
--   `criado_em` — o default `now()` registra quando o banco foi
--     semeado. A data real da importação está neste cabeçalho, que é
--     onde ela significa alguma coisa.
--
--   `tipo` e `unidade` em `produtos` são o caso oposto e entram
--   EXPLÍCITOS: `tipo` não tem default e `unidade` nasce 'g'. 'revenda'
--   e 'un' são dado dela. Não uniformizar com as colunas acima.
--
-- `marca` fica NULL nos 9 produtos, inclusive onde a marca aparece
-- dentro do nome ("Ultimate Luxe Oil — 100 ml — Wella"). A Kamylle vai
-- mandar as 9 marcas depois; até lá, NULL é o que o banco tem. Ver a
-- 011: marca nula conta como marca vazia no índice único, então dois
-- produtos sem marca e de mesmo nome colidem, que é o que se quer.
--
-- Nomes exatamente como ela escreveu, inclusive grafia que parece
-- errada e travessão longo (—) onde há travessão. Não corrigir: o
-- catálogo é dela, e mudar um caractere faz o índice da 010/011 tratar
-- como outro serviço, quebrando o casamento com os lançamentos antigos.
-- =====================================================================

-- ---------------------------------------------------------------------
-- SERVIÇOS — 24 linhas
--
-- `origem_registro` e `ativo` vão explícitos, ao contrário das colunas
-- omitidas acima: 'catalogo' e true não coincidem com o default por
-- acaso, são o que estas linhas são. E `ativo` é load-bearing — o índice
-- único da 010 é parcial (`where ativo`), então é ele que faz a segunda
-- execução deste arquivo estourar.
--
-- `categoria` é NULL em "Revisão". É válido (ver 012) e é o que está no
-- banco.
--
-- Preço 0,00 nas duas finalizações é preço dela, não ausência de preço.
-- Não confundir com o serviço que nasce a 0 no ato do atendimento (008),
-- que tem `origem_registro = 'atendimento'` e aqui não existe.
-- ---------------------------------------------------------------------
insert into public.servicos (nome, preco_padrao, categoria, origem_registro, ativo) values
  ('Correção de cor',                          480.00, 'coloracao',  'catalogo', true),
  ('Protocolo Cuidado com os Brancos',         350.00, 'coloracao',  'catalogo', true),
  ('Protocolo lumiére Essenza — Mechas',      1200.00, 'coloracao',  'catalogo', true),
  ('Teste de Mechas',                          150.00, 'coloracao',  'catalogo', true),
  ('Tonalização',                              380.00, 'coloracao',  'catalogo', true),
  ('Essenza Cut Hair',                         350.00, 'corte',      'catalogo', true),
  ('Aplicação Extension',                      650.00, 'extensao',   'catalogo', true),
  ('Protocolo de Personalização Extensão',    1200.00, 'extensao',   'catalogo', true),
  ('Protocolo Manutenção com Queratinização',  730.00, 'extensao',   'catalogo', true),
  ('Protocolo manutenção Extensão',            550.00, 'extensao',   'catalogo', true),
  ('Retirada Extension Capilar',               150.00, 'extensao',   'catalogo', true),
  ('Finalização com Babyliss',                   0.00, 'servico',    'catalogo', true),
  ('Finalização com Escova',                     0.00, 'servico',    'catalogo', true),
  ('Alinhamento Seal Aligner Truss',           480.00, 'tratamento', 'catalogo', true),
  ('Nutritive Kerastase',                      380.00, 'tratamento', 'catalogo', true),
  ('Protocolo de Hidratação',                  380.00, 'tratamento', 'catalogo', true),
  ('Protocolo de Nutrição',                    380.00, 'tratamento', 'catalogo', true),
  ('Protocolo Lissage',                        480.00, 'tratamento', 'catalogo', true),
  ('Protocolo Nutrição Luxe Oil Wella',        350.00, 'tratamento', 'catalogo', true),
  ('Ritual Crhonologist Kerastase',            380.00, 'tratamento', 'catalogo', true),
  ('Ritual Gloss Absolut',                     380.00, 'tratamento', 'catalogo', true),
  ('Ritual reconstrução Premiere Kerastase',   480.00, 'tratamento', 'catalogo', true),
  ('Ritual Reconstrução Terrapiste Kerastase', 380.00, 'tratamento', 'catalogo', true),
  ('Revisão',                                  150.00, null,         'catalogo', true);

-- ---------------------------------------------------------------------
-- PRODUTOS — 9 linhas
--
-- `preco_venda` é NULL em 6 das 9, e NULL aqui é "ela ainda não mandou o
-- preço", não zero. A coluna é nullable justamente para isso (001).
-- Gravar 0,00 faria a tela de venda oferecer produto de graça.
--
-- `codigo_tom` e `volume_oxidante` são NULL nas nove: só fazem sentido
-- para coloração (001), e estes são todos de revenda. Vão explícitos
-- para deixar claro que o NULL é a resposta, não esquecimento.
--
-- `ativo` explícito pelo mesmo motivo dos serviços: o índice único da
-- 011 é parcial (`where ativo`).
-- ---------------------------------------------------------------------
insert into public.produtos (nome, marca, tipo, unidade, codigo_tom, volume_oxidante, preco_venda, ativo) values
  ('Bain Terrapist',                         null, 'revenda', 'un', null, null,   null, true),
  ('Extensão capilar do Sul do Brasil',      null, 'revenda', 'un', null, null,   null, true),
  ('Finalizador Bead Head',                  null, 'revenda', 'un', null, null,   null, true),
  ('Fondant Terrapist',                      null, 'revenda', 'un', null, null,   null, true),
  ('Gloss Absolu Glaze drops',               null, 'revenda', 'un', null, null, 399.00, true),
  ('Kit 3 produtos Ultimate Luxe Oil Wella', null, 'revenda', 'un', null, null, 650.00, true),
  ('Masque Terrapist',                       null, 'revenda', 'un', null, null,   null, true),
  ('The One Redken — protetor térmico',      null, 'revenda', 'un', null, null,   null, true),
  ('Ultimate Luxe Oil — 100 ml — Wella',     null, 'revenda', 'un', null, null, 229.90, true);
