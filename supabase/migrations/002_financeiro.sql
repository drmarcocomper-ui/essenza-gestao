-- =====================================================================
-- Essenza — Migration 002: modelo financeiro
--
-- Contexto: a Kamylle vai abandonar a planilha Google Sheets e usar só
-- o app. O modelo financeiro dela (competência separada de caixa,
-- instituição, titularidade, parcelamento, status) é mais completo que
-- o desenhado na 001, então `pagamentos` é substituída por `lancamentos`.
--
-- Decisão de arquitetura: atendimento e lançamento são tabelas
-- separadas e ligadas. Ao fechar um atendimento, o app cria o(s)
-- lançamento(s) correspondente(s). Despesa é lançamento sem atendimento.
-- Um atendimento com pagamento dividido gera N lançamentos.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. CLIENTES — campos vindos da aba Cadastro
-- ---------------------------------------------------------------------
alter table public.clientes
  add column id_externo    text unique,   -- ID da planilha (hex8 ou CL-...)
  add column municipio     text,
  add column bairro        text,
  add column profissao     text,
  add column preferencias  text,          -- "água com gás, capuccino"
  add column origem        text,          -- Instagram, indicação...
  add column data_cadastro date;

comment on column public.clientes.id_externo is
  'ID de origem na planilha. Usado só para casar a importação; not null após o import.';

create index idx_clientes_id_externo on public.clientes (id_externo);

-- ---------------------------------------------------------------------
-- 2. CATEGORIAS DE LANÇAMENTO
-- ---------------------------------------------------------------------
create table public.categorias_lancamento (
  id        uuid primary key default gen_random_uuid(),
  tipo      text not null check (tipo in ('Entrada','Saída')),
  nome      text not null,
  ativo     boolean not null default true,
  ordem     integer not null default 0,
  criado_em timestamptz not null default now(),
  unique (tipo, nome)
);

insert into public.categorias_lancamento (tipo, nome, ordem) values
  ('Entrada','Serviço',1),
  ('Entrada','Coloração',2),
  ('Entrada','Corte',3),
  ('Entrada','Tratamento',4),
  ('Entrada','Manutenção Extensão',5),
  ('Entrada','Produto',6),
  ('Saída','Custo Fixo',1),
  ('Saída','Custo Variável',2),
  ('Saída','Participação Lucros',3),
  ('Saída','Curso',4);

-- ---------------------------------------------------------------------
-- 3. LANÇAMENTOS
-- ---------------------------------------------------------------------
create table public.lancamentos (
  id                uuid primary key default gen_random_uuid(),

  -- competência: quando o fato aconteceu. caixa: quando o dinheiro andou.
  data_competencia  date not null,
  data_caixa        date,                 -- null enquanto pendente

  tipo              text not null check (tipo in ('Entrada','Saída')),
  categoria         text not null,        -- snapshot; FK lógica com categorias_lancamento
  descricao         text not null,

  -- Entrada: cliente. Saída: fornecedor em texto livre (ela não cadastra
  -- fornecedor; identifica pela descrição: "Boleto WELLA", "EDP").
  cliente_id        uuid references public.clientes(id) on delete restrict,
  fornecedor        text,

  atendimento_id    uuid references public.atendimentos(id) on delete set null,

  forma_pagamento   text check (forma_pagamento in (
                      'Pix','Dinheiro','Cartão de crédito','Cartão de débito',
                      'Boleto','Transferência','Cortesia','Confiança')),
  instituicao       text,                 -- Nubank, SumUp, Stone...
  titularidade      text check (titularidade in ('PF','PJ','Terceiro')),
  parcelamento      text,                 -- "1/3", "2/3" — texto, como na planilha

  valor             numeric(10,2) not null check (valor > 0),
  status            text not null default 'Pago' check (status in ('Pago','Pendente')),

  mes_competencia   text,                 -- 'AAAA-MM', como ela usa hoje
  observacoes       text,

  -- Origem do registro: 'planilha' para o histórico importado, 'app' para
  -- o que nasce aqui. Serve para auditar e para excluir o import em bloco
  -- se algo vier errado.
  origem_registro   text not null default 'app' check (origem_registro in ('app','planilha')),
  linha_planilha    integer,              -- linha do CSV original, só no import

  criado_em         timestamptz not null default now(),
  atualizado_em     timestamptz not null default now(),

  -- Entrada é de cliente, saída é de fornecedor. Nunca os dois.
  constraint chk_lancamento_contraparte check (
    (tipo = 'Entrada' and fornecedor is null) or
    (tipo = 'Saída'   and cliente_id is null)
  ),
  -- Pago exige data de caixa.
  constraint chk_lancamento_caixa check (
    status <> 'Pago' or data_caixa is not null
  )
);

create index idx_lancamentos_competencia on public.lancamentos (data_competencia desc);
create index idx_lancamentos_caixa       on public.lancamentos (data_caixa desc);
create index idx_lancamentos_cliente     on public.lancamentos (cliente_id, data_competencia desc);
create index idx_lancamentos_atendimento on public.lancamentos (atendimento_id);
create index idx_lancamentos_pendentes   on public.lancamentos (status) where status = 'Pendente';

create trigger trg_lancamentos_atualizado_em
  before update on public.lancamentos
  for each row execute function public.set_atualizado_em();

-- ---------------------------------------------------------------------
-- 4. REMOVE `pagamentos` — substituída por `lancamentos`
-- ---------------------------------------------------------------------
drop view if exists public.vw_faturamento_diario;
drop table if exists public.pagamentos;

-- ---------------------------------------------------------------------
-- 5. VIEWS DE FECHAMENTO
-- ---------------------------------------------------------------------

-- Regime de competência: o que foi faturado no mês, pago ou não.
create or replace view public.vw_resumo_competencia as
select
  to_char(data_competencia,'YYYY-MM')                              as mes,
  sum(valor) filter (where tipo = 'Entrada')                       as entradas,
  sum(valor) filter (where tipo = 'Saída')                         as saidas,
  sum(valor) filter (where tipo = 'Entrada')
    - coalesce(sum(valor) filter (where tipo = 'Saída'), 0)         as resultado
from public.lancamentos
group by 1;

-- Regime de caixa: o que efetivamente entrou e saiu.
create or replace view public.vw_resumo_caixa as
select
  to_char(data_caixa,'YYYY-MM')                                    as mes,
  sum(valor) filter (where tipo = 'Entrada')                       as recebido,
  sum(valor) filter (where tipo = 'Saída')                         as pago,
  sum(valor) filter (where tipo = 'Entrada')
    - coalesce(sum(valor) filter (where tipo = 'Saída'), 0)         as saldo
from public.lancamentos
where data_caixa is not null
group by 1;

-- A receber: pendências em aberto.
create or replace view public.vw_a_receber as
select l.id, l.data_competencia, l.descricao, l.valor, c.nome as cliente
from public.lancamentos l
left join public.clientes c on c.id = l.cliente_id
where l.tipo = 'Entrada' and l.status = 'Pendente'
order by l.data_competencia;

-- ---------------------------------------------------------------------
-- 6. RLS
-- ---------------------------------------------------------------------
alter table public.lancamentos            enable row level security;
alter table public.categorias_lancamento  enable row level security;

create policy p_lancamentos_authenticated
  on public.lancamentos for all to authenticated using (true) with check (true);

create policy p_categorias_lancamento_authenticated
  on public.categorias_lancamento for all to authenticated using (true) with check (true);