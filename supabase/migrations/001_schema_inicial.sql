-- =====================================================================
-- Essenza Hair Concept — app de gestão (single-tenant, usuária única)
-- Migration 001: schema inicial (Fase 1)
--
-- Premissas:
--   - Um único usuário autenticado (Kamylle). Sem tenant_id, sem roles.
--   - RLS ligada em tudo, com policy única para `authenticated`.
--   - Signup desabilitado no painel do Supabase.
-- =====================================================================

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------
-- CLIENTES
-- ---------------------------------------------------------------------
create table public.clientes (
  id            uuid primary key default gen_random_uuid(),
  nome          text not null,
  telefone      text,                      -- somente dígitos, ex: 27999998888
  data_nascimento date,
  observacoes   text,                      -- preferências, sensibilidades relatadas
  ativo         boolean not null default true,
  criado_em     timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);

create index idx_clientes_nome on public.clientes using gin (to_tsvector('portuguese', nome));
create index idx_clientes_telefone on public.clientes (telefone);

-- ---------------------------------------------------------------------
-- SERVIÇOS (catálogo)
-- ---------------------------------------------------------------------
create table public.servicos (
  id            uuid primary key default gen_random_uuid(),
  nome          text not null,
  preco_padrao  numeric(10,2) not null default 0,
  duracao_min   integer not null default 60,
  ativo         boolean not null default true,
  criado_em     timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- PRODUTOS (insumo de coloração e revenda)
-- ---------------------------------------------------------------------
create table public.produtos (
  id              uuid primary key default gen_random_uuid(),
  nome            text not null,
  marca           text,
  tipo            text not null check (tipo in ('coloracao','oxidante','po_descolorante','tratamento','revenda','outro')),
  unidade         text not null default 'g' check (unidade in ('g','ml','un')),
  -- tom/altura só fazem sentido para coloração; ficam null nos demais
  codigo_tom      text,                    -- ex: '7.1', '9.34'
  volume_oxidante integer,                 -- ex: 10, 20, 30, 40
  preco_venda     numeric(10,2),           -- preenchido quando tipo = 'revenda'
  estoque_atual   numeric(10,2) not null default 0,
  estoque_minimo  numeric(10,2) not null default 0,
  ativo           boolean not null default true,
  criado_em       timestamptz not null default now()
);

create index idx_produtos_tipo on public.produtos (tipo) where ativo;

-- ---------------------------------------------------------------------
-- AGENDAMENTOS
-- ---------------------------------------------------------------------
create table public.agendamentos (
  id          uuid primary key default gen_random_uuid(),
  cliente_id  uuid not null references public.clientes(id) on delete restrict,
  inicio      timestamptz not null,
  fim         timestamptz not null,
  status      text not null default 'agendado'
              check (status in ('agendado','confirmado','atendido','faltou','cancelado')),
  observacao  text,
  criado_em   timestamptz not null default now(),
  constraint chk_agendamento_intervalo check (fim > inicio)
);

create index idx_agendamentos_inicio on public.agendamentos (inicio);
create index idx_agendamentos_cliente on public.agendamentos (cliente_id, inicio desc);

-- ---------------------------------------------------------------------
-- ATENDIMENTOS (a comanda fechada)
-- ---------------------------------------------------------------------
create table public.atendimentos (
  id             uuid primary key default gen_random_uuid(),
  cliente_id     uuid not null references public.clientes(id) on delete restrict,
  agendamento_id uuid unique references public.agendamentos(id) on delete set null,
  data           date not null default current_date,
  desconto       numeric(10,2) not null default 0,
  valor_total    numeric(10,2) not null default 0,  -- soma dos itens - desconto
  observacao     text,
  criado_em      timestamptz not null default now()
);

create index idx_atendimentos_data on public.atendimentos (data desc);
create index idx_atendimentos_cliente on public.atendimentos (cliente_id, data desc);

create table public.atendimento_itens (
  id             uuid primary key default gen_random_uuid(),
  atendimento_id uuid not null references public.atendimentos(id) on delete cascade,
  tipo           text not null check (tipo in ('servico','produto')),
  servico_id     uuid references public.servicos(id) on delete restrict,
  produto_id     uuid references public.produtos(id) on delete restrict,
  descricao      text not null,             -- snapshot do nome no momento da venda
  quantidade     numeric(10,2) not null default 1,
  valor_unitario numeric(10,2) not null default 0,
  constraint chk_item_referencia check (
    (tipo = 'servico' and servico_id is not null and produto_id is null) or
    (tipo = 'produto' and produto_id is not null and servico_id is null)
  )
);

create index idx_itens_atendimento on public.atendimento_itens (atendimento_id);

-- ---------------------------------------------------------------------
-- PAGAMENTOS (N por atendimento — cobre venda dividida)
-- ---------------------------------------------------------------------
create table public.pagamentos (
  id             uuid primary key default gen_random_uuid(),
  atendimento_id uuid not null references public.atendimentos(id) on delete cascade,
  forma          text not null check (forma in ('dinheiro','pix','debito','credito','credito_parcelado','transferencia','cortesia')),
  valor          numeric(10,2) not null,
  parcelas       integer not null default 1,
  taxa_estimada  numeric(10,2) not null default 0,  -- taxa da maquininha, informativa
  criado_em      timestamptz not null default now(),
  constraint chk_pagamento_valor check (valor > 0)
);

create index idx_pagamentos_atendimento on public.pagamentos (atendimento_id);

-- ---------------------------------------------------------------------
-- FÓRMULAS — o núcleo do app
-- ---------------------------------------------------------------------
create table public.formulas (
  id              uuid primary key default gen_random_uuid(),
  cliente_id      uuid not null references public.clientes(id) on delete cascade,
  atendimento_id  uuid references public.atendimentos(id) on delete set null,
  data            date not null default current_date,
  tipo            text not null check (tipo in ('coloracao','retoque_raiz','mechas','tonalizante','descoloracao','alisamento','tratamento','outro')),
  base_natural    text,                    -- altura natural observada, ex: '5'
  resultado_alvo  text,                    -- ex: '7.1 loiro médio acinzentado'
  tempo_pausa_min integer,
  tecnica         text,                    -- ex: 'babyliss', 'papel alumínio', 'touca'
  resultado       text,                    -- como saiu de fato
  observacao      text,                    -- ajustes para a próxima vez
  criado_em       timestamptz not null default now()
);

create index idx_formulas_cliente on public.formulas (cliente_id, data desc);

-- Composição da mistura: o que foi usado e quanto
create table public.formula_itens (
  id          uuid primary key default gen_random_uuid(),
  formula_id  uuid not null references public.formulas(id) on delete cascade,
  produto_id  uuid references public.produtos(id) on delete set null,
  descricao   text not null,               -- snapshot, sobrevive à exclusão do produto
  quantidade  numeric(10,2) not null,
  unidade     text not null default 'g' check (unidade in ('g','ml','un')),
  ordem       integer not null default 0
);

create index idx_formula_itens_formula on public.formula_itens (formula_id, ordem);

-- Fotos antes/depois (arquivo no Supabase Storage, bucket privado 'formulas')
create table public.formula_fotos (
  id          uuid primary key default gen_random_uuid(),
  formula_id  uuid not null references public.formulas(id) on delete cascade,
  storage_path text not null,
  momento     text not null check (momento in ('antes','durante','depois')),
  criado_em   timestamptz not null default now()
);

create index idx_formula_fotos_formula on public.formula_fotos (formula_id);

-- ---------------------------------------------------------------------
-- TRIGGER: atualizado_em
-- ---------------------------------------------------------------------
create or replace function public.set_atualizado_em()
returns trigger
language plpgsql
as $$
begin
  new.atualizado_em = now();
  return new;
end;
$$;

create trigger trg_clientes_atualizado_em
  before update on public.clientes
  for each row execute function public.set_atualizado_em();

-- ---------------------------------------------------------------------
-- VIEW: fechamento diário
-- ---------------------------------------------------------------------
create or replace view public.vw_faturamento_diario as
select
  a.data,
  count(distinct a.id)                              as atendimentos,
  sum(a.valor_total)                                as bruto,
  sum(coalesce(p.taxa_total, 0))                    as taxas,
  sum(a.valor_total) - sum(coalesce(p.taxa_total,0)) as liquido_estimado
from public.atendimentos a
left join lateral (
  select sum(taxa_estimada) as taxa_total
  from public.pagamentos
  where atendimento_id = a.id
) p on true
group by a.data;

-- ---------------------------------------------------------------------
-- RLS — usuária única
-- ---------------------------------------------------------------------
alter table public.clientes          enable row level security;
alter table public.servicos          enable row level security;
alter table public.produtos          enable row level security;
alter table public.agendamentos      enable row level security;
alter table public.atendimentos      enable row level security;
alter table public.atendimento_itens enable row level security;
alter table public.pagamentos        enable row level security;
alter table public.formulas          enable row level security;
alter table public.formula_itens     enable row level security;
alter table public.formula_fotos     enable row level security;

do $$
declare t text;
begin
  foreach t in array array[
    'clientes','servicos','produtos','agendamentos','atendimentos',
    'atendimento_itens','pagamentos','formulas','formula_itens','formula_fotos'
  ]
  loop
    execute format(
      'create policy %I on public.%I for all to authenticated using (true) with check (true)',
      'p_' || t || '_authenticated', t
    );
  end loop;
end $$;

-- =====================================================================
-- FASE 2 — só depois de 30 dias de uso real. Não criar agora.
--   despesas            (data, categoria, descricao, valor, forma)
--   movimentos_estoque  (produto_id, tipo, quantidade, custo, atendimento_id)
-- =====================================================================