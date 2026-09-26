-- =====================================================================
-- Essenza — Migration 020: peça de extensão vendida na conta
--
-- POR QUE AGORA:
--   a 018 criou `pecas_extensao` e deixou "o vínculo da peça com a
--   conta é assunto de uma migration futura". É esta. A peça passa a
--   entrar na conta do atendimento como item, ao lado de serviço e
--   produto, e é esse item que diz que ela foi vendida.
--
-- POR QUE UM TERCEIRO `tipo` E NÃO UM `produto`:
--   `produtos` é estoque de quantidade; a peça é única (ver 018). O
--   item de peça aponta para a PEÇA (`peca_extensao_id`), não para o
--   produto de catálogo "Extensão capilar do Sul do Brasil" (015), que
--   continua lá, intocado.
--
-- O QUE MUDA EM `atendimento_itens` (definida na 001):
--   1. coluna `peca_extensao_id`, nullable, FK para `pecas_extensao`
--      `on delete restrict` — mesma política de `servico_id` e
--      `produto_id`: peça vendida não some do cadastro.
--   2. o check de `tipo` aceita 'peca_extensao'. Na 001 ele é inline e
--      SEM nome (`check (tipo in ('servico','produto'))`), então o nome
--      real é o que o Postgres gerou: `atendimento_itens_tipo_check`.
--      A conferência antes do COMANDO 2 prova isso no banco; o `drop`
--      vai sem `if exists` para falhar alto se o nome não for esse. O
--      check é recriado com o MESMO nome, agora explícito.
--   3. `chk_item_referencia` ganha o terceiro ramo, e cada ramo passa a
--      exigir as OUTRAS DUAS referências nulas. Os itens existentes
--      continuam passando: são todos 'servico' ou 'produto' e a coluna
--      nova nasce nula neles.
--   4. item de peça tem `quantidade` = 1: uma peça é uma unidade.
--   5. índice único PARCIAL em `peca_extensao_id`: uma peça, um item.
--      Parcial porque todo item de serviço e de produto tem a coluna
--      nula, e esses nulos não são "a mesma peça".
--      Este índice também serve à FK: o `on delete restrict` de uma
--      peça procura `peca_extensao_id = $1`, que o planner casa com o
--      `where peca_extensao_id is not null`. Nenhum índice extra.
--
-- POR QUE NÃO HÁ COLUNA DE STATUS:
--   mesma regra da 018. vendida = existe item com
--   `peca_extensao_id` = esta peça. É consulta, não campo — como "conta
--   fechada" é "existe lançamento com o atendimento_id".
--
-- DROP E ADD NO MESMO `alter table` (COMANDOS 2 e 3):
--   um `alter table` com as duas ações é um comando só e atômico: não
--   existe instante em que a tabela fique sem o check, e se o `add`
--   falhar o `drop` é desfeito junto.
--
-- SEGURANÇA:
--   nenhuma tabela nova e nenhuma view. A coluna nova herda a RLS e a
--   policy única de `atendimento_itens` (001). Sondagem anônima no fim.
--
-- APLICAÇÃO:
--   à mão, no SQL Editor, UM COMANDO DE CADA VEZ, na ordem numerada
--   abaixo. O SQL Editor só mostra o resultado da última query quando se
--   cola várias juntas. Sem `if not exists`/`if exists` de propósito:
--   rodar duas vezes tem que falhar alto ("already exists" / "does not
--   exist"), e não passar em silêncio.
--   Depois, as CONSULTAS DE PROVA e a SONDAGEM ANÔNIMA do fim do
--   arquivo, também uma por vez.
-- =====================================================================

-- ---------------------------------------------------------------------
-- COMANDO 1 — coluna + FK
-- ---------------------------------------------------------------------
alter table public.atendimento_itens
  add column peca_extensao_id uuid
  references public.pecas_extensao(id) on delete restrict;

-- ---------------------------------------------------------------------
-- CONFERÊNCIA ANTES DO COMANDO 2 (só leitura)
--
-- Tem que voltar UMA linha, `atendimento_itens_tipo_check`, com
-- CHECK ((tipo = ANY (ARRAY['servico'::text, 'produto'::text]))).
-- Se voltar outro nome, ou nenhum: PARE e não rode o COMANDO 2.
--
--   select conname, pg_get_constraintdef(oid)
--   from pg_constraint
--   where conrelid = 'public.atendimento_itens'::regclass
--     and contype = 'c'
--     and pg_get_constraintdef(oid) ilike '%tipo = any%'
--     and conname <> 'chk_item_referencia';
-- ---------------------------------------------------------------------

-- ---------------------------------------------------------------------
-- COMANDO 2 — check de tipo com o valor novo
-- ---------------------------------------------------------------------
alter table public.atendimento_itens
  drop constraint atendimento_itens_tipo_check,
  add constraint atendimento_itens_tipo_check
    check (tipo in ('servico','produto','peca_extensao'));

-- ---------------------------------------------------------------------
-- COMANDO 3 — referência do lado certo, três ramos
-- ---------------------------------------------------------------------
alter table public.atendimento_itens
  drop constraint chk_item_referencia,
  add constraint chk_item_referencia check (
    (tipo = 'servico'
      and servico_id is not null and produto_id is null and peca_extensao_id is null) or
    (tipo = 'produto'
      and produto_id is not null and servico_id is null and peca_extensao_id is null) or
    (tipo = 'peca_extensao'
      and peca_extensao_id is not null and servico_id is null and produto_id is null)
  );

-- ---------------------------------------------------------------------
-- COMANDO 4 — item de peça é uma unidade
--
-- Serviço e produto ficam livres (o ramo `tipo <> ...` passa). Nenhum
-- item existente é de peça, então nenhum é recusado.
-- ---------------------------------------------------------------------
alter table public.atendimento_itens
  add constraint chk_item_peca_quantidade
  check (tipo <> 'peca_extensao' or quantidade = 1);

-- ---------------------------------------------------------------------
-- COMANDO 5 — uma peça, um item (ver item 5 do cabeçalho)
-- ---------------------------------------------------------------------
create unique index uq_atendimento_itens_peca_extensao
  on public.atendimento_itens (peca_extensao_id)
  where peca_extensao_id is not null;

-- ---------------------------------------------------------------------
-- COMANDO 6 — documentação no próprio banco
-- ---------------------------------------------------------------------
comment on column public.atendimento_itens.peca_extensao_id is
  'Preenchido só no item de tipo peca_extensao. Uma peça, um item (uq_atendimento_itens_peca_extensao): é este vínculo que diz que a peça foi vendida — não há coluna de status (ver 018 e 020).';


-- =====================================================================
-- CONSULTAS DE PROVA — depois dos 6 comandos, uma por vez
-- =====================================================================
--
-- P1 — contagem ANTES do P5. Anote o número.
--
--   select count(*) from public.atendimento_itens;
--
-- P2 — a coluna nova: uma linha, uuid, is_nullable = YES.
--
--   select column_name, data_type, is_nullable, column_default
--   from information_schema.columns
--   where table_schema = 'public'
--     and table_name = 'atendimento_itens'
--     and column_name = 'peca_extensao_id';
--
-- P3 — checks e FKs de atendimento_itens, com a definição. Tem que
-- aparecer: atendimento_itens_tipo_check com os três valores;
-- chk_item_referencia com os três ramos; chk_item_peca_quantidade;
-- atendimento_itens_peca_extensao_id_fkey com ON DELETE RESTRICT (ao
-- lado das FKs antigas de atendimento_id, servico_id e produto_id).
--
--   select conname, contype, pg_get_constraintdef(oid) as definicao
--   from pg_constraint
--   where conrelid = 'public.atendimento_itens'::regclass
--     and contype in ('c','f')
--   order by contype, conname;
--
-- P4 — índices: uq_atendimento_itens_peca_extensao com
-- "WHERE (peca_extensao_id IS NOT NULL)", ao lado de
-- idx_itens_atendimento e da pkey.
--
--   select indexname, indexdef
--   from pg_indexes
--   where schemaname = 'public' and tablename = 'atendimento_itens'
--   order by indexname;
--
-- P5 — as travas recusam o que devem, SEM GRAVAR NADA.
--
--   O bloco precisa de um atendimento, uma peça ainda não vendida e um
--   serviço que JÁ EXISTEM: pega cada um com `select ... limit 1`. Os
--   inserts de teste vão para esse atendimento real, mas o bloco
--   inteiro termina em `raise exception`, e exceção num DO desfaz TUDO
--   o que ele fez — inclusive o item válido do teste 3. Por isso o
--   resultado esperado é um ERRO:
--
--     ERROR: P0001: OK: quantidade 2, servico_id preenchido e peça
--     repetida recusados; nada gravado
--
--   Qualquer outra mensagem (começando com FALHA ou SEM DADO) é
--   problema: leia o texto. Cada recusa confere também QUAL trava
--   recusou, para não aprovar por engano uma recusa vinda de outra.
--
--   do $$
--   declare
--     v_atendimento uuid;
--     v_peca        uuid;
--     v_servico     uuid;
--     v_trava       text;
--   begin
--     select id into v_atendimento from public.atendimentos limit 1;
--     select p.id into v_peca
--       from public.pecas_extensao p
--      where not exists (select 1 from public.atendimento_itens i
--                         where i.peca_extensao_id = p.id)
--      limit 1;
--     select id into v_servico from public.servicos limit 1;
--
--     if v_atendimento is null or v_peca is null or v_servico is null then
--       raise exception 'SEM DADO: atendimento %, peça livre %, serviço %',
--         v_atendimento, v_peca, v_servico;
--     end if;
--
--     -- Teste 1: peça com quantidade 2.
--     begin
--       insert into public.atendimento_itens
--         (atendimento_id, tipo, peca_extensao_id, descricao, quantidade, valor_unitario)
--       values (v_atendimento, 'peca_extensao', v_peca, 'prova 020', 2, 0);
--       raise exception 'FALHA: peça com quantidade 2 foi aceita';
--     exception when check_violation then
--       get stacked diagnostics v_trava = constraint_name;
--       if v_trava <> 'chk_item_peca_quantidade' then
--         raise exception 'FALHA: quantidade 2 recusada por % (esperado chk_item_peca_quantidade)', v_trava;
--       end if;
--     end;
--
--     -- Teste 2: peça com servico_id preenchido.
--     begin
--       insert into public.atendimento_itens
--         (atendimento_id, tipo, peca_extensao_id, servico_id, descricao, quantidade, valor_unitario)
--       values (v_atendimento, 'peca_extensao', v_peca, v_servico, 'prova 020', 1, 0);
--       raise exception 'FALHA: peça com servico_id foi aceita';
--     exception when check_violation then
--       get stacked diagnostics v_trava = constraint_name;
--       if v_trava <> 'chk_item_referencia' then
--         raise exception 'FALHA: servico_id recusado por % (esperado chk_item_referencia)', v_trava;
--       end if;
--     end;
--
--     -- Teste 3: a mesma peça em dois itens. O primeiro é válido e TEM
--     -- que entrar (controle positivo: sem ele, uma trava errada que
--     -- recusasse todo item de peça passaria nos testes 1 e 2).
--     insert into public.atendimento_itens
--       (atendimento_id, tipo, peca_extensao_id, descricao, quantidade, valor_unitario)
--     values (v_atendimento, 'peca_extensao', v_peca, 'prova 020', 1, 0);
--
--     begin
--       insert into public.atendimento_itens
--         (atendimento_id, tipo, peca_extensao_id, descricao, quantidade, valor_unitario)
--       values (v_atendimento, 'peca_extensao', v_peca, 'prova 020', 1, 0);
--       raise exception 'FALHA: a mesma peça entrou em dois itens';
--     exception when unique_violation then
--       get stacked diagnostics v_trava = constraint_name;
--       if v_trava <> 'uq_atendimento_itens_peca_extensao' then
--         raise exception 'FALHA: peça repetida recusada por % (esperado uq_atendimento_itens_peca_extensao)', v_trava;
--       end if;
--     end;
--
--     raise exception 'OK: quantidade 2, servico_id preenchido e peça repetida recusados; nada gravado';
--   end
--   $$;
--
-- P6 — contagem DEPOIS do P5: tem que ser IGUAL à do P1, e nenhum item
-- de prova pode ter sobrado (segunda consulta → 0).
--
--   select count(*) from public.atendimento_itens;
--
--   select count(*) from public.atendimento_itens where descricao = 'prova 020';
--
-- =====================================================================
-- SONDAGEM ANÔNIMA — só a anon key, sem sessão (aba anônima / terminal)
-- =====================================================================
--
-- S1 — controle positivo: a sondagem está chegando ao banco e a RLS
-- responde. Esperado: 200 e [].
--
--   curl -s -w "\n%{http_code}\n" "$URL/rest/v1/clientes?select=id" \
--        -H "apikey: $ANON"
--
-- S2 — a coluna nova existe e a RLS esconde as linhas. Esperado: 200
-- e []. (Um 400 aqui quer dizer que a coluna não existe, ou que o
-- schema cache do PostgREST ainda não recarregou.)
--
--   curl -s -w "\n%{http_code}\n" "$URL/rest/v1/atendimento_itens?select=peca_extensao_id" \
--        -H "apikey: $ANON"
--
-- S3 — controle negativo: coluna inexistente. Esperado: 400 com
-- "code":"42703". Prova que o 200 do S2 não é resposta genérica.
--
--   curl -s -w "\n%{http_code}\n" "$URL/rest/v1/atendimento_itens?select=nao_existe" \
--        -H "apikey: $ANON"
-- =====================================================================
