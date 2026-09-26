-- =====================================================================
-- Essenza — Migration 018: peças de extensão capilar
--
-- Primeira tabela do módulo de estoque, liberado em 26/09/2026. Começa
-- pela extensão capilar porque ela é ~78% da venda de produto da
-- Kamylle.
--
-- O QUE A TABELA É:
--   uma linha por PEÇA física de extensão. Cada peça chega do
--   fornecedor ("Sul do Brasil") com lacre e número individual de
--   origem, e recebe um código criado por ela ("1254"). As peças não têm
--   padrão — cor, textura, gramas e comprimento variam de uma para
--   outra —, e é por peça que ela quer registrar custo e preço.
--
-- POR QUE NÃO É `produtos`:
--   `produtos` (001) é estoque de QUANTIDADE: "Masque Terrapist" é um
--   item de catálogo, e dez frascos iguais são a mesma linha com
--   quantidade 10. Extensão é o contrário: não existem duas peças
--   iguais, e cada uma tem preço de compra e de venda próprios. Enfiar
--   isso em `produtos` exigiria uma linha de catálogo por peça,
--   `estoque_atual` sempre 0 ou 1, e colunas de cor/gramas/comprimento
--   que não fazem sentido para frasco nenhum. O produto de catálogo
--   "Extensão capilar do Sul do Brasil" (015) continua lá, intocado; o
--   vínculo da peça com a conta é assunto de uma migration futura.
--
-- DESMEMBRAMENTO:
--   peça grande pode ser dividida: 1254 vira 1254-a, 1254-b, 1254-c.
--   Cada parte é uma linha nova com `peca_mae_id` apontando para a
--   1254, e custo decidido por ela, sem fórmula — o banco não reparte
--   `preco_compra` da mãe entre as filhas. `on delete restrict`: a mãe
--   não some enquanto houver parte apontando para ela.
--   Parte de parte (1254-a → 1254-a1) é permitida. Ciclo entre peças
--   (A→B, B→A) NÃO é barrado no banco, de propósito: só nasce de update
--   em `peca_mae_id`, e a aplicação nunca atualiza essa coluna — só cria
--   partes novas.
--
-- POR QUE NÃO HÁ COLUNA DE STATUS, "vendida" OU "desmembrada":
--   as duas coisas são fatos que moram em outro lugar, e uma coluna que
--   os repetisse poderia discordar deles.
--     - desmembrada = existe peça com `peca_mae_id` = esta. É consulta,
--       não campo.
--     - vendida = vai sair do vínculo com a conta do atendimento, numa
--       migration futura. Mesmo raciocínio de "conta fechada", que é
--       "existe lançamento com o atendimento_id" e nunca teve coluna.
--
-- CÓDIGO ÚNICO PARA SEMPRE:
--   o índice único é TOTAL, não parcial — diferente da 010 e da 011. Lá
--   o `where ativo` existe para permitir recadastrar um nome desativado;
--   aqui o código identifica uma peça física, e reaproveitar o código de
--   uma peça já vendida misturaria o histórico de duas peças. Por isso
--   também não há `ativo`. `lower(trim(...))` pelo mesmo motivo da
--   010: "1254-B", "1254-b" e " 1254-b" são a mesma peça para quem
--   digita.
--
-- NULL É "NÃO INFORMADO", NÃO ZERO:
--   todas as medidas e os dois preços são nullable. Mesma regra de
--   `produtos.preco_venda` (015): gravar 0,00 onde ela não informou
--   faria a tela oferecer peça de graça. Os `check` recusam zero em
--   gramas e comprimento (peça de 0 g não existe) e aceitam zero em
--   preço (cortesia é dado).
--
-- `cor` E `textura` SEM `check`:
--   o vocabulário dela ainda não é conhecido. Mesma lógica da 012: a
--   lista, quando existir, mora na aplicação.
--
-- SEGURANÇA:
--   RLS ligada, com a policy única para `authenticated` no mesmo padrão
--   de todas as tabelas (001, 002). Nada para `anon`: a chave pública
--   que vai no bundle do navegador tem que receber [].
--   A RLS é ligada logo depois da tabela, antes de índice e trigger:
--   RLS sem policy nega tudo, então ligar primeiro não quebra nada e
--   fecha o intervalo em que a anon key enxergaria a tabela.
--
-- APLICAÇÃO:
--   à mão, no SQL Editor, UM COMANDO DE CADA VEZ, na ordem numerada
--   abaixo. O SQL Editor só mostra o resultado da última query quando se
--   cola várias juntas.
--   `create table` e `create trigger` sem `if not exists`, de propósito:
--   rodar esta migration uma segunda vez tem que falhar alto ("already
--   exists"), e não passar em silêncio.
-- =====================================================================

-- ---------------------------------------------------------------------
-- COMANDO 1 — tabela
-- ---------------------------------------------------------------------
create table public.pecas_extensao (
  id              uuid primary key default gen_random_uuid(),
  codigo          text not null,             -- como ela escreve: '1254', '1254-b'
  peca_mae_id     uuid references public.pecas_extensao(id) on delete restrict,
  numero_origem   text,                      -- lacre / número individual do fornecedor
  origem          text,                      -- fornecedor, texto livre
  cor             text,
  textura         text,
  gramas          numeric(10,2),
  comprimento_cm  numeric(6,1),
  preco_compra    numeric(10,2),
  preco_venda     numeric(10,2),
  data_entrada    date,
  observacoes     text,
  criado_em       timestamptz not null default now(),
  atualizado_em   timestamptz not null default now(),

  -- `not null` não recusa string vazia: '' e '   ' passariam.
  constraint chk_pecas_extensao_codigo       check (trim(codigo) <> ''),
  constraint chk_pecas_extensao_gramas       check (gramas > 0),
  constraint chk_pecas_extensao_comprimento  check (comprimento_cm > 0),
  constraint chk_pecas_extensao_preco_compra check (preco_compra >= 0),
  constraint chk_pecas_extensao_preco_venda  check (preco_venda >= 0),
  -- Peça não é mãe de si mesma. Com `peca_mae_id` nulo a comparação dá
  -- NULL, e `check` com NULL passa — a peça inteira fica livre, como os
  -- `check` acima deixam passar a medida não informada.
  constraint chk_pecas_extensao_mae check (peca_mae_id <> id)
);

-- ---------------------------------------------------------------------
-- COMANDO 2 — RLS (logo depois da tabela; ver SEGURANÇA no cabeçalho)
-- ---------------------------------------------------------------------
alter table public.pecas_extensao enable row level security;

-- ---------------------------------------------------------------------
-- COMANDO 3 — policy única para `authenticated`
--
-- Mesmo nome e mesma forma de p_lancamentos_authenticated (002) e das
-- policies geradas em laço na 001.
-- ---------------------------------------------------------------------
create policy p_pecas_extensao_authenticated
  on public.pecas_extensao for all to authenticated using (true) with check (true);

-- ---------------------------------------------------------------------
-- COMANDO 4 — código único, para sempre (ver cabeçalho)
-- ---------------------------------------------------------------------
create unique index uq_pecas_extensao_codigo
  on public.pecas_extensao (lower(trim(codigo)));

-- ---------------------------------------------------------------------
-- COMANDO 5 — partes de uma peça desmembrada
--
-- Postgres não indexa FK sozinho. Sem este índice, "quais são as partes
-- da 1254" e o `on delete restrict` da mãe varrem a tabela inteira.
-- ---------------------------------------------------------------------
create index idx_pecas_extensao_peca_mae
  on public.pecas_extensao (peca_mae_id);

-- ---------------------------------------------------------------------
-- COMANDO 6 — atualizado_em
--
-- Reaproveita `public.set_atualizado_em()` (001), como `lancamentos`
-- (002) e `agendamentos` (009). Nenhuma função nova.
-- ---------------------------------------------------------------------
create trigger trg_pecas_extensao_atualizado_em
  before update on public.pecas_extensao
  for each row execute function public.set_atualizado_em();

-- ---------------------------------------------------------------------
-- COMANDOS 7 A 9 — documentação no próprio banco
-- ---------------------------------------------------------------------
comment on table public.pecas_extensao is
  'Uma linha por peça física de extensão capilar. Peça única, não quantidade: por isso não está em produtos. Sem status: desmembrada = tem filhas; vendida virá do vínculo com a conta (ver 018).';

comment on column public.pecas_extensao.codigo is
  'Código criado pela Kamylle (1254, 1254-b). Único para sempre, ignorando caixa e espaço nas pontas: nunca se reutiliza, nem de peça vendida.';

comment on column public.pecas_extensao.peca_mae_id is
  'Preenchido só nas partes de um desmembramento (1254-a aponta para 1254). O custo de cada parte é decidido por ela, sem fórmula.';
