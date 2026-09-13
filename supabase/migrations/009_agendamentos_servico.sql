-- =====================================================================
-- Essenza — Migration 009: serviço marcado e atualizado_em na agenda
--
-- `agendamentos` nasceu na 001 e nunca foi usada. Antes da tela da
-- Agenda, faltam duas coisas:
--
-- 1. `servico_id` — o que foi marcado. NULLABLE de propósito: o horário
--    pode ser bloqueado antes de saber o que será feito, e a Kamylle
--    marca no WhatsApp sem fechar o serviço. `on delete restrict` é a
--    mesma política que `atendimento_itens.servico_id` já usa para o
--    catálogo (001): serviço com histórico não some por acidente.
--
-- 2. `atualizado_em` + trigger — mesmo par que `clientes` (001) e
--    `lancamentos` (002) já têm. Reaproveita `public.set_atualizado_em()`,
--    que já existe; nenhuma função nova.
--
-- Não mexe em `chk_agendamento_intervalo`: `fim` continua obrigatório.
-- A trava contra horário sobreposto é aviso de tela, não regra de banco.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. SERVIÇO MARCADO
-- ---------------------------------------------------------------------
alter table public.agendamentos
  add column if not exists servico_id uuid
  references public.servicos(id) on delete restrict;

comment on column public.agendamentos.servico_id is
  'O serviço marcado para o horário. Null enquanto o horário estiver reservado sem serviço definido.';

create index if not exists idx_agendamentos_servico
  on public.agendamentos (servico_id);

-- ---------------------------------------------------------------------
-- 2. ATUALIZADO_EM
-- ---------------------------------------------------------------------
alter table public.agendamentos
  add column if not exists atualizado_em timestamptz not null default now();

drop trigger if exists trg_agendamentos_atualizado_em on public.agendamentos;
create trigger trg_agendamentos_atualizado_em
  before update on public.agendamentos
  for each row execute function public.set_atualizado_em();
