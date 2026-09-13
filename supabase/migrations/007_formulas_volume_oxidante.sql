-- =====================================================================
-- Essenza — Migration 007: o que faltava na ficha de coloração
--
-- 1) VOLUME DO OXIDANTE
-- A ficha de papel da Kamylle tem cinco campos: base, tom, volume do
-- oxidante, tempo de pausa e resultado. Quatro já existem em `formulas`
-- (base_natural, resultado_alvo, tempo_pausa_min, resultado). O volume
-- do oxidante não: a 001 só o colocou em `produtos.volume_oxidante`,
-- que descreve o frasco no estoque, não a mistura daquele atendimento.
-- Sem esta coluna a fórmula fica irrepetível — 7.1 com 20 volumes e 7.1
-- com 30 volumes são dois resultados diferentes.
--
-- 2) UMA FOTO POR MOMENTO
-- O app anexa no máximo duas fotos por fórmula (antes e depois), no
-- caminho fixo {cliente_id}/{formula_id}/{momento}.jpg. Reenviar uma
-- foto sobrescreve o arquivo; o índice único faz `formula_fotos`
-- acompanhar isso por upsert em vez de acumular linha órfã apontando
-- para o mesmo caminho.
-- =====================================================================

alter table public.formulas
  add column if not exists volume_oxidante integer;

comment on column public.formulas.volume_oxidante is
  'Volume do oxidante usado NESTA mistura (10, 20, 30, 40). Não confundir com produtos.volume_oxidante, que descreve o frasco.';

-- Volume é sempre positivo, e acima de 40 não existe no mercado — 60 dá
-- folga sem deixar passar o erro de digitação (200 em vez de 20).
alter table public.formulas
  drop constraint if exists chk_formulas_volume_oxidante;
alter table public.formulas
  add constraint chk_formulas_volume_oxidante
  check (volume_oxidante is null or (volume_oxidante > 0 and volume_oxidante <= 60));

-- Tempo de pausa em minutos: idem, positivo e com teto folgado.
alter table public.formulas
  drop constraint if exists chk_formulas_tempo_pausa;
alter table public.formulas
  add constraint chk_formulas_tempo_pausa
  check (tempo_pausa_min is null or (tempo_pausa_min > 0 and tempo_pausa_min <= 600));

create unique index if not exists uq_formula_fotos_momento
  on public.formula_fotos (formula_id, momento);
