-- =====================================================================
-- Essenza — importação das peças de extensão EM ESTOQUE
-- Origem: planilha "Cabelos_estoque_ESSENZA_HAIR_CONCEPT.xlsx" (Kamylle, 26/09/2026)
--
-- 29 peças. Só as marcadas "Em estoque"; as vendidas ficam na planilha como histórico.
-- Fora da importação (respostas da Kamylle em 26/09/2026):
--   1161 (linha 16): Uso Kamylle (tem dono)
--   1393 (linha 19): Cecília (tem dono)
--   1415 (linha 27): Virou o 1426, já vendido
--   2013 (linha 69): Juntada com a 1903
--
-- Decisões:
--   * Código: sem ".0" do Excel e partes no formato do app (1250 b → 1250-b, 1422- a → 1422-a).
--   * Cor: 17 células da planilha tinham virado data no Excel (7/3 → 07/03/2024); recuperadas pelo dia/mês.
--   * Custo: só o que a planilha registra. Lote de R$ 15.000 dividido por 5 (2025 e 2027 → 3.000,00).
--     1600 (R$ 10.000) sem custo até confirmar. Nenhum custo foi calculado a partir do "Cod. 2".
--   * 1903 + 2013 viraram uma peça só, com o código 1903: custo somado, gramas/comprimento/preço em branco.
--   * 1427 do estoque vira 1427-b.
--   * Origem: as grafias de "Zara hair - Lucas" unificadas; o resto como ela escreveu.
--   * data_entrada em branco (a planilha não tem). Tudo o mais que não cabe nas colunas vai em observacoes.
--
-- APLICAÇÃO: no SQL Editor, UMA consulta por vez, na ordem. Sem "on conflict": se um código já existir,
-- o insert inteiro falha e nada entra.
-- =====================================================================

-- ANTES 1 — contagem atual (anote):
--   select count(*) from public.pecas_extensao;

-- ANTES 2 — códigos que já existem e colidiriam (tem que voltar VAZIO; se voltar algo, pare):
--   select codigo from public.pecas_extensao
--   where lower(trim(codigo)) in ('1052', '1103', '1250-b', '1251', '1410', '1412', '1413', '1421-a', '1422-a', '1422-b', '1425', '1427-b', '1428', '1429', '1430', '1500', '1501', '1600', '1602', '1603', '1608', '1900', '1903', '1904', '2010', '2011', '2012', '2025', '2027');

-- IMPORTAÇÃO — um único insert (atômico):
insert into public.pecas_extensao
  (codigo, cor, textura, gramas, comprimento_cm, preco_compra, preco_venda, origem, observacoes)
values
  ('1052', '3.5', 'Médio sul - liso', 113.00, 60.00, 1391.03, 3299.00, 'RS Cabelos', 'Importada da planilha de estoque (linha 2) em 26/09/2026. Cod. 2 na planilha: 12/31 - 28. Coluna ao lado do tamanho: 12,31.'),
  ('1103', '3.0', 'X fino sul liso', 87.00, 63.00, 1392.00, 2499.00, 'RS Cabelos', 'Importada da planilha de estoque (linha 8) em 26/09/2026. Cod. 2 na planilha: 16/00 - 28. Coluna ao lado do tamanho: 16,00.'),
  ('1250-b', null, 'X fino brasileiro descolorido', 50.00, null, null, 1799.00, 'ECPrime', 'Importada da planilha de estoque (linha 10) em 26/09/2026. Cod. 2 na planilha: 22/50 - 30. Na planilha há uma fração de 18 g desta peça vendida a Cida Marçal; conferir as gramas.'),
  ('1251', '6.7/ 7.3', 'Médio - grosso ondulado natural', 80.00, 50.00, 2420.00, 3299.00, 'MClara', 'Importada da planilha de estoque (linha 12) em 26/09/2026. Cod. 2 na planilha: 22/50 - 30. Coluna ao lado do tamanho: 22,50.'),
  ('1410', '3/0', 'Liso do sul', 105.00, 65.00, 1400.00, 3360.00, 'Zara Hair - Lucas', 'Importada da planilha de estoque (linha 20) em 26/09/2026. Cod. 2 na planilha: 14-32. Coluna ao lado do tamanho: 32,00. A planilha tem também a versão descolorida e personalizada a R$ 4.200,00.'),
  ('1412', '3/0', 'Ondulado do sul', 119.00, 65.00, 1785.00, 3899.00, 'Zara Hair - Lucas', 'Importada da planilha de estoque (linha 24) em 26/09/2026. Cod. 2 na planilha: 15-32/76. Coluna ao lado do tamanho: 32,76.'),
  ('1413', null, null, 50.00, null, null, 2299.00, null, 'Importada da planilha de estoque (linha 25) em 26/09/2026. Cod. 2 na planilha: 14-28. Coluna ao lado do tamanho: 28,00.'),
  ('1421-a', '4/0', 'Liso x fino do sul', 50.00, 50.00, 2000.00, 2499.00, 'Zara Hair - Lucas', 'Importada da planilha de estoque (linha 30) em 26/09/2026. Cod. 2 na planilha: 14-. Coluna ao lado do tamanho: 53,00.'),
  ('1422-a', '4/0', 'Pontas Onduladas x fino do sul', 80.00, 60.00, 1375.00, 2599.00, 'Zara Hair - Lucas', 'Importada da planilha de estoque (linha 32) em 26/09/2026.'),
  ('1422-b', '4/0', 'Pontas Onduladas x fino do sul', 83.00, 60.00, 1427.00, 2699.00, 'Zara Hair - Lucas', 'Importada da planilha de estoque (linha 33) em 26/09/2026.'),
  ('1425', '3/0', 'Ondulado fino sul', 189.00, 64.00, 1300.00, 4099.00, 'Zara Hair - Lucas', 'Importada da planilha de estoque (linha 36) em 26/09/2026. Cod. 2 na planilha: 6-48. Coluna ao lado do tamanho: 21,00.'),
  ('1427-b', '6/0', 'Fino Ondulado', 105.00, 53.00, 1470.00, 4800.00, 'Zara Hair - Lucas', 'Importada da planilha de estoque (linha 41) em 26/09/2026. Cod. 2 na planilha: 1470.0. Coluna ao lado do tamanho: 45,70. Na planilha era 1427; a de 81 g, vendida, passa a ser 1427-a (pedido da Kamylle). Anotação da planilha: Kamylle cachos de luxo.'),
  ('1428', '3/0', 'Fino levemente ondulado do sul', 90.00, 55.00, null, 3299.00, 'Zara Hair - Lucas', 'Importada da planilha de estoque (linha 42) em 26/09/2026. Cod. 2 na planilha: 1530.0. Coluna ao lado do tamanho: 35,00.'),
  ('1429', '3/0', 'X fino liso', 80.00, 53.00, 2086.00, 3599.00, 'Zara Hair - Lucas', 'Importada da planilha de estoque (linha 43) em 26/09/2026. Cod. 2 na planilha: 1360.0. Coluna ao lado do tamanho: 35,00.'),
  ('1430', '3/0', 'Xfino liso do sul', 138.00, 55.00, null, 4499.00, 'Zara Hair - Lucas', 'Importada da planilha de estoque (linha 44) em 26/09/2026. Cod. 2 na planilha: 1932.0. Coluna ao lado do tamanho: 32,00.'),
  ('1500', '5/0', 'X fino cachos luxo kamylle', 65.00, 40.00, null, 1499.00, 'Kamylle', 'Importada da planilha de estoque (linha 45) em 26/09/2026. Coluna ao lado do tamanho: 20,00.'),
  ('1501', '4/0+7/7', 'X fino cachos luxo Kamylle', 95.00, 43.00, null, 1999.00, 'Kamylle', 'Importada da planilha de estoque (linha 46) em 26/09/2026. Coluna ao lado do tamanho: 20,00.'),
  ('1600', '5/0', 'X fino ondulado sul', 170.00, 70.00, null, 6990.00, 'Sif cabelos do Sul', 'Importada da planilha de estoque (linha 47) em 26/09/2026. Cod. 2 na planilha: 36.0. Compra registrada na planilha: R$ 10.000,00 — não confirmado se é lote; custo deixado em branco.'),
  ('1602', '6/3', 'X fino levemente ondulado sul', 72.00, 60.00, null, 2499.00, 'Sif cabelos do Sul', 'Importada da planilha de estoque (linha 49) em 26/09/2026. Cod. 2 na planilha: 30.0.'),
  ('1603', '5/3', 'X fino ondulado sul', 86.00, 55.00, null, 3890.00, 'Sif cabelos do Sul', 'Importada da planilha de estoque (linha 50) em 26/09/2026. Cod. 2 na planilha: 33.0.'),
  ('1608', '4/0', 'X fino liso Sul', null, 45.00, null, 3899.00, 'Sif cabelos do Sul', 'Importada da planilha de estoque (linha 55) em 26/09/2026. Cod. 2 na planilha: 25.0. Gramas na planilha: ''b'' — a informar.'),
  ('1900', '7/3 + 8/33', 'X fino loiro natural do sul - raro', 60.00, 45.00, 1200.00, 4499.00, 'Sif cabelos do Sul', 'Importada da planilha de estoque (linha 60) em 26/09/2026. Cod. 2 na planilha: 75.0.'),
  ('1903', '7/3', 'X fino loiro natural sul - raro', null, null, 2750.00, null, 'Sif cabelos do Sul', 'Importada da planilha de estoque (linha 63) em 26/09/2026. Cod. 2 na planilha: 80.0. Juntada com a 2013 (Kamylle, 26/09/2026): custo somado 2.000,00 + 750,00. Gramas, comprimento e preço de venda a informar.'),
  ('1904', '5/3', 'X fino natural levemente ondulado sul', 80.00, null, 1000.00, 3799.00, 'Zara Hair', 'Importada da planilha de estoque (linha 64) em 26/09/2026.'),
  ('2010', null, 'X fino liso Natural castanho', 100.00, 60.00, 750.00, 3599.00, 'Zara Hair', 'Importada da planilha de estoque (linha 66) em 26/09/2026. Cod. 2 na planilha: 7.5. Coluna ao lado do tamanho: 35,00.'),
  ('2011', '5/3', 'X fino liso Natural castanho', 66.00, 51.00, 750.00, 2799.00, 'Zara Hair', 'Importada da planilha de estoque (linha 67) em 26/09/2026. Cod. 2 na planilha: 11.36. Coluna ao lado do tamanho: 42,00.'),
  ('2012', '4/3', 'X fino liso Natural castanho criaça', 62.00, 45.00, 750.00, 1990.00, 'Zara Hair', 'Importada da planilha de estoque (linha 68) em 26/09/2026. Cod. 2 na planilha: 12.09. Coluna ao lado do tamanho: 30,00.'),
  ('2025', null, 'X fino natural castanho claro', 58.00, 55.00, 3000.00, 3500.00, 'Sif cabelos do Sul', 'Importada da planilha de estoque (linha 72) em 26/09/2026. Custo: lote de R$ 15.000,00 dividido igualmente pelas 5 peças 2024 a 2028 (orientação da Kamylle).'),
  ('2027', '7/7-8/33', 'X fino natural levemente ondulado sul', 123.00, 60.00, 3000.00, 6899.00, 'Sif cabelos do Sul', 'Importada da planilha de estoque (linha 74) em 26/09/2026. Custo: lote de R$ 15.000,00 dividido igualmente pelas 5 peças 2024 a 2028 (orientação da Kamylle).');

-- DEPOIS 1 — contagem: tem que ser a de ANTES 1 + 29.
--   select count(*) from public.pecas_extensao;

-- DEPOIS 2 — as importadas, para conferir:
--   select codigo, cor, textura, gramas, comprimento_cm, preco_compra, preco_venda, origem
--   from public.pecas_extensao
--   where observacoes like 'Importada da planilha%'
--   order by codigo;
