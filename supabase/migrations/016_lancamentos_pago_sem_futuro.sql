-- =====================================================================
-- Essenza — Migration 016: lançamento Pago não tem data de caixa futura
--
-- Regra registrada em 20/09/2026: nenhum lançamento pode estar `Pago`
-- com `data_caixa` depois de hoje. Pago quer dizer que o dinheiro já
-- andou; data de caixa futura é dinheiro que ainda não entrou, e isso
-- é `Pendente`. Até aqui a regra só existia na aplicação
-- (`lancamentoSchema`, schema do fechamento de conta, confirmação de
-- parcela). Em 20/09 apareceram 23 lançamentos importados violando a
-- regra: entraram por um caminho que a aplicação não vê (import, SQL
-- Editor). Esta migration leva a regra para o banco.
--
-- POR QUE TRIGGER, E NÃO `check`:
--   a regra depende de "hoje", e o Postgres só aceita em `check`
--   expressão imutável. `current_date` e `now()` não são — mudam a cada
--   dia — e o `create`/`alter table` recusa a constraint. Além disso um
--   `check` seria reavaliado só quando a linha muda, então nem faria
--   sentido como garantia sobre o tempo. Trigger BEFORE INSERT OR UPDATE
--   é o lugar certo: confere a linha no momento em que ela é gravada.
--   A trigger NÃO revalida linhas antigas — por isso o roteiro de
--   aplicação conta as violações antes (esperado 0).
--
-- POR QUE O FUSO EXPLÍCITO, e não `current_date`:
--   o banco roda em UTC. Das 21h à meia-noite em São Paulo a data UTC
--   já é amanhã, e uma trava com `current_date` deixaria passar o dia
--   seguinte por três horas toda noite. "Hoje" aqui é
--   `(now() at time zone 'America/Sao_Paulo')::date`, o mesmo dia que a
--   aplicação calcula em `hoje()` (src/lib/caixa/mes.ts). Banco e
--   aplicação precisam concordar sobre que dia é hoje.
--
-- AS DUAS CAMADAS SÃO DE PROPÓSITO:
--   a aplicação continua validando e dando mensagem amigável no
--   formulário; o banco é a rede de baixo, para o que a aplicação não
--   vê. Não remover nenhuma das duas achando que a outra basta.
--
-- SEGURANÇA:
--   segue o precedente de `public.set_atualizado_em()` (001): função
--   plpgsql comum, SECURITY INVOKER (o padrão), sem `security definer`.
--   Ela não lê tabela nenhuma — só `new` e o relógio —, então não há
--   privilégio a emprestar. Sem `set search_path`, como a precedente:
--   só chama `now()` e `to_char()`, que moram em `pg_catalog`, sempre
--   consultado primeiro.
--
-- DOIS COMANDOS: a função e depois a trigger. No SQL Editor, colar e
-- rodar um de cada vez.
--
-- `create trigger` sem `if not exists` e sem `drop` antes, de propósito:
-- rodar esta migration uma segunda vez tem que falhar alto
-- ("trigger ... already exists"), e não passar em silêncio.
-- =====================================================================

-- ---------------------------------------------------------------------
-- COMANDO 1 — função
-- ---------------------------------------------------------------------
create or replace function public.impedir_pago_com_caixa_futura()
returns trigger
language plpgsql
as $$
declare
  hoje_sp date := (now() at time zone 'America/Sao_Paulo')::date;
begin
  if new.status = 'Pago' and new.data_caixa > hoje_sp then
    raise exception
      'Lançamento % recusado: status Pago com data de caixa %, depois de hoje (% em São Paulo). Regra: lançamento com data de caixa futura fica Pendente até o dinheiro entrar.',
      new.id,
      to_char(new.data_caixa, 'DD/MM/YYYY'),
      to_char(hoje_sp, 'DD/MM/YYYY')
      using errcode = 'check_violation';
  end if;
  return new;
end;
$$;

-- ---------------------------------------------------------------------
-- COMANDO 2 — trigger
-- ---------------------------------------------------------------------
create trigger trg_lancamentos_pago_sem_futuro
  before insert or update on public.lancamentos
  for each row execute function public.impedir_pago_com_caixa_futura();
