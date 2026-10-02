-- =====================================================================
-- Essenza — Migration 021: estoque de frascos de revenda
--
-- POR QUE AGORA:
--   segundo passo do módulo de estoque (o primeiro foi a peça de
--   extensão, 018/020). Agora os frascos: produtos de `produtos` com
--   `tipo = 'revenda'`, que são estoque de QUANTIDADE (ver 018).
--   Decidido em 26/09 e 01/10/2026.
--
-- TRÊS TABELAS:
--   compras            — uma ENTRADA de compra: fornecedor, data e,
--                        opcionalmente, a nota fiscal.
--   compra_itens       — os produtos daquela entrada, com quantidade e
--                        custo unitário.
--   estoque_contagens  — "contei e tinha N" num dia: o ponto de partida
--                        do saldo.
--
-- A NOTA PERTENCE À COMPRA, NÃO AO PRODUTO:
--   cada nota traz uma quantidade variável de produtos, e vem em papel
--   (foto) ou PDF. Por isso o arquivo fica em `compras.nota_path`, um por
--   entrada, e é opcional (NULL = compra sem nota). O arquivo mora no
--   bucket privado `notas-fiscais` (COMANDOS 15 a 18), no caminho
--     {compra_id}/nota.<ext>
--   — o `notas-fiscais/` da frente é o bucket, não faz parte da chave.
--
-- CUSTO MORA NA LINHA DA COMPRA:
--   `compra_itens.custo_unitario`. Não existe coluna de "último custo"
--   em `produtos`: seria uma cópia do que está na compra mais recente e
--   poderia discordar dela. "Quanto paguei da última vez" é consulta.
--
-- O MESMO PRODUTO DUAS VEZES NA MESMA NOTA:
--   vira UMA linha, com a quantidade somada (uq_compra_itens_compra_
--   produto). Sem isso, "quanto entrou de Masque nesta compra" teria de
--   somar linhas e a tela de edição teria duas linhas para o mesmo
--   frasco. Se as duas linhas da nota tiverem custos diferentes, a
--   aplicação decide o custo da linha somada (média ponderada).
--
-- SALDO É CALCULADO, NUNCA GRAVADO:
--   saldo = última contagem
--         + compras com data depois dela
--         − itens de produto em contas FECHADAS depois dela.
--   Não há coluna de saldo em lugar nenhum, pelo mesmo motivo da 018:
--   um número gravado poderia discordar dos fatos que o produzem.
--   `produtos.estoque_atual` e `produtos.estoque_minimo` (001) ficam
--   INTOCADOS — nem lidos, nem escritos por este módulo.
--   "Conta fechada" continua sendo "existe lançamento com o
--   atendimento_id" (sem coluna, ver 018/020).
--   Nenhuma view: a conta é feita na aplicação.
--
-- CONTAGEM NÃO É ÚNICA POR (produto, data):
--   duas contagens no mesmo dia são legítimas (contou de manhã, achou
--   mais uma caixa à tarde). Vale a de `criado_em` mais recente — é o
--   que o índice idx_estoque_contagens_produto_data entrega na ordem
--   certa.
--
-- COMPRA NÃO GERA LANÇAMENTO:
--   o boleto já é lançado no Caixa. Nenhuma FK, nenhum trigger entre
--   `compras` e `lancamentos`.
--
-- "SÓ REVENDA" FICA NA APLICAÇÃO, NÃO NO BANCO:
--   um `check` não enxerga outra tabela; a trava exigiria trigger em
--   `compra_itens` e `estoque_contagens` olhando `produtos.tipo`, e outro
--   em `produtos` para impedir trocar o tipo de um produto que já tem
--   compra. É o mesmo raciocínio da 012: regra de vocabulário mora na
--   aplicação, que já filtra `tipo = 'revenda'` em src/lib/produtos.
--
-- `on delete restrict` NO PRODUTO, `cascade` NA COMPRA:
--   produto com compra ou contagem não some do cadastro (mesma política
--   de `atendimento_itens.produto_id`); produto sai de linha por
--   `ativo = false`. Apagar uma compra lançada errado leva as linhas
--   dela junto.
--
-- NULL É "NÃO INFORMADO":
--   `nota_path`, `observacoes`/`observacao` são nullable. Quantidade de
--   compra tem que ser > 0 (linha com zero não é compra); contagem
--   aceita 0 (acabou é dado); custo aceita 0 (brinde do fornecedor é
--   dado).
--
-- SEGURANÇA:
--   RLS ligada em cada tabela LOGO DEPOIS do `create table`, antes de
--   índice e trigger, como na 018: RLS sem policy nega tudo, então ligar
--   primeiro não quebra nada e fecha o intervalo em que a anon key
--   enxergaria a tabela. Uma policy única para `authenticated` por
--   tabela; nada para `anon`. Nenhuma view.
--   Bucket `notas-fiscais`: quatro policies só para `authenticated`, no
--   padrão da 006. Exibição sempre por URL assinada (createSignedUrl),
--   nunca getPublicUrl.
--
-- O BUCKET É CRIADO NO PAINEL, ANTES DO COMANDO 15:
--   Storage → New bucket
--     Name: notas-fiscais
--     Public bucket: DESLIGADO (privado)
--     Restrict file size: 10 MB
--     Allowed MIME types: application/pdf, image/jpeg, image/png,
--                         image/webp, image/heic
--
-- APLICAÇÃO:
--   à mão, no SQL Editor, UM COMANDO DE CADA VEZ, na ordem numerada
--   abaixo. O SQL Editor só mostra o resultado da última query quando se
--   cola várias juntas.
--   `create table`, `create index` e `create trigger` sem
--   `if not exists`, de propósito: rodar duas vezes tem que falhar alto
--   ("already exists"), e não passar em silêncio. As policies de storage
--   seguem a 006 (`drop policy if exists` + `create`).
--   Depois, as CONSULTAS DE PROVA e a SONDAGEM ANÔNIMA do fim do
--   arquivo, também uma por vez.
-- =====================================================================


-- =====================================================================
-- COMPRAS
-- =====================================================================

-- ---------------------------------------------------------------------
-- COMANDO 1 — tabela
-- ---------------------------------------------------------------------
create table public.compras (
  id             uuid primary key default gen_random_uuid(),
  fornecedor     text not null,
  data           date not null,
  nota_path      text,                      -- {compra_id}/nota.<ext> no bucket notas-fiscais
  observacoes    text,
  criado_em      timestamptz not null default now(),
  atualizado_em  timestamptz not null default now(),

  -- `not null` não recusa string vazia: '' e '   ' passariam.
  constraint chk_compras_fornecedor check (trim(fornecedor) <> '')
);

-- ---------------------------------------------------------------------
-- COMANDO 2 — RLS (logo depois da tabela; ver SEGURANÇA no cabeçalho)
-- ---------------------------------------------------------------------
alter table public.compras enable row level security;

-- ---------------------------------------------------------------------
-- COMANDO 3 — policy única para `authenticated`
-- ---------------------------------------------------------------------
create policy p_compras_authenticated
  on public.compras for all to authenticated using (true) with check (true);

-- ---------------------------------------------------------------------
-- COMANDO 4 — atualizado_em
--
-- Reaproveita `public.set_atualizado_em()` (001). Nenhuma função nova.
-- ---------------------------------------------------------------------
create trigger trg_compras_atualizado_em
  before update on public.compras
  for each row execute function public.set_atualizado_em();


-- =====================================================================
-- COMPRA_ITENS
-- =====================================================================

-- ---------------------------------------------------------------------
-- COMANDO 5 — tabela
-- ---------------------------------------------------------------------
create table public.compra_itens (
  id              uuid primary key default gen_random_uuid(),
  compra_id       uuid not null references public.compras(id) on delete cascade,
  produto_id      uuid not null references public.produtos(id) on delete restrict,
  quantidade      numeric not null,
  custo_unitario  numeric(12,2) not null,
  criado_em       timestamptz not null default now(),

  constraint chk_compra_itens_quantidade check (quantidade > 0),
  constraint chk_compra_itens_custo      check (custo_unitario >= 0),
  -- O mesmo produto duas vezes na mesma nota é uma linha só (cabeçalho).
  constraint uq_compra_itens_compra_produto unique (compra_id, produto_id)
);

-- ---------------------------------------------------------------------
-- COMANDO 6 — RLS
-- ---------------------------------------------------------------------
alter table public.compra_itens enable row level security;

-- ---------------------------------------------------------------------
-- COMANDO 7 — policy única para `authenticated`
-- ---------------------------------------------------------------------
create policy p_compra_itens_authenticated
  on public.compra_itens for all to authenticated using (true) with check (true);

-- ---------------------------------------------------------------------
-- COMANDO 8 — índice em produto_id
--
-- Postgres não indexa FK sozinho. Sem este índice, "todas as compras da
-- Masque" (o saldo) e o `on delete restrict` do produto varrem a tabela.
--
-- NÃO HÁ índice separado em compra_id: o índice que sustenta
-- uq_compra_itens_compra_produto começa por compra_id e já atende "as
-- linhas desta compra" e o `on delete cascade` da compra. Um segundo
-- índice só em compra_id seria cópia (mesmo raciocínio da 020).
-- ---------------------------------------------------------------------
create index idx_compra_itens_produto
  on public.compra_itens (produto_id);


-- =====================================================================
-- ESTOQUE_CONTAGENS
-- =====================================================================

-- ---------------------------------------------------------------------
-- COMANDO 9 — tabela
-- ---------------------------------------------------------------------
create table public.estoque_contagens (
  id          uuid primary key default gen_random_uuid(),
  produto_id  uuid not null references public.produtos(id) on delete restrict,
  data        date not null,
  quantidade  numeric not null,
  observacao  text,
  criado_em   timestamptz not null default now(),

  constraint chk_estoque_contagens_quantidade check (quantidade >= 0)
);

-- ---------------------------------------------------------------------
-- COMANDO 10 — RLS
-- ---------------------------------------------------------------------
alter table public.estoque_contagens enable row level security;

-- ---------------------------------------------------------------------
-- COMANDO 11 — policy única para `authenticated`
-- ---------------------------------------------------------------------
create policy p_estoque_contagens_authenticated
  on public.estoque_contagens for all to authenticated using (true) with check (true);

-- ---------------------------------------------------------------------
-- COMANDO 12 — "a última contagem deste produto"
--
-- Na ordem exata da pergunta: produto, data mais recente, e no empate
-- de data o `criado_em` mais recente. Também serve à FK de produto_id
-- (começa por ela).
-- ---------------------------------------------------------------------
create index idx_estoque_contagens_produto_data
  on public.estoque_contagens (produto_id, data desc, criado_em desc);


-- =====================================================================
-- COMANDOS 13 E 14 — documentação no próprio banco
-- =====================================================================
comment on table public.compras is
  'Entrada de compra de produtos de revenda. A nota fiscal (opcional) é da compra, não do produto: nota_path no bucket notas-fiscais, {compra_id}/nota.<ext>. Não gera lançamento: o boleto já vai ao Caixa (ver 021).';

comment on table public.estoque_contagens is
  'Contagem física de um produto num dia. Não é única por (produto, data): vale a de criado_em mais recente. Saldo = última contagem + compras depois − itens em contas fechadas depois; calculado, nunca gravado (ver 021).';


-- =====================================================================
-- STORAGE — bucket `notas-fiscais` (criado no painel; ver cabeçalho)
-- =====================================================================

-- ---------------------------------------------------------------------
-- COMANDO 15 — leitura: é o que permite createSignedUrl
-- ---------------------------------------------------------------------
drop policy if exists "notas_fiscais_select_authenticated" on storage.objects;
create policy "notas_fiscais_select_authenticated"
  on storage.objects for select to authenticated
  using (bucket_id = 'notas-fiscais');

-- ---------------------------------------------------------------------
-- COMANDO 16 — envio da foto ou do PDF
-- ---------------------------------------------------------------------
drop policy if exists "notas_fiscais_insert_authenticated" on storage.objects;
create policy "notas_fiscais_insert_authenticated"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'notas-fiscais');

-- ---------------------------------------------------------------------
-- COMANDO 17 — trocar a nota (upsert no mesmo caminho)
--
-- `using` acha a linha; `with check` impede mover o objeto para fora do
-- bucket na mesma operação (ver 006).
-- ---------------------------------------------------------------------
drop policy if exists "notas_fiscais_update_authenticated" on storage.objects;
create policy "notas_fiscais_update_authenticated"
  on storage.objects for update to authenticated
  using (bucket_id = 'notas-fiscais')
  with check (bucket_id = 'notas-fiscais');

-- ---------------------------------------------------------------------
-- COMANDO 18 — remover a nota errada
-- ---------------------------------------------------------------------
drop policy if exists "notas_fiscais_delete_authenticated" on storage.objects;
create policy "notas_fiscais_delete_authenticated"
  on storage.objects for delete to authenticated
  using (bucket_id = 'notas-fiscais');


-- =====================================================================
-- CONSULTAS DE PROVA — depois dos 18 comandos, uma por vez
-- =====================================================================
--
-- P1 — contagem ANTES do P7. Tem que ser 0 | 0 | 0 (tabelas novas).
--
--   select (select count(*) from public.compras)           as compras,
--          (select count(*) from public.compra_itens)      as compra_itens,
--          (select count(*) from public.estoque_contagens) as estoque_contagens;
--
-- P2 — RLS ligada: três linhas, relrowsecurity = true em todas.
--
--   select relname, relrowsecurity
--   from pg_class
--   where relnamespace = 'public'::regnamespace
--     and relname in ('compras','compra_itens','estoque_contagens')
--   order by relname;
--
-- P3 — policies. Três em public (p_<tabela>_authenticated, cmd ALL,
-- roles {authenticated}, qual e with_check = true) e quatro em
-- storage.objects (notas_fiscais_*, roles {authenticated}, todas com
-- bucket_id = 'notas-fiscais'). Nenhuma com anon ou public em roles.
--
--   select schemaname, tablename, policyname, cmd, roles, qual, with_check
--   from pg_policies
--   where (schemaname = 'public'
--          and tablename in ('compras','compra_itens','estoque_contagens'))
--      or (schemaname = 'storage' and policyname like 'notas_fiscais_%')
--   order by schemaname, tablename, policyname;
--
-- P4 — trigger: uma linha, trg_compras_atualizado_em, chamando
-- set_atualizado_em, BEFORE UPDATE FOR EACH ROW.
--
--   select tgrelid::regclass as tabela, tgname, pg_get_triggerdef(oid)
--   from pg_trigger
--   where not tgisinternal
--     and tgrelid in ('public.compras'::regclass,
--                     'public.compra_itens'::regclass,
--                     'public.estoque_contagens'::regclass);
--
-- P5 — índices. Tem que aparecer:
--   compras: compras_pkey
--   compra_itens: compra_itens_pkey, uq_compra_itens_compra_produto
--     (compra_id, produto_id), idx_compra_itens_produto
--   estoque_contagens: estoque_contagens_pkey,
--     idx_estoque_contagens_produto_data
--     (produto_id, data DESC, criado_em DESC)
--
--   select tablename, indexname, indexdef
--   from pg_indexes
--   where schemaname = 'public'
--     and tablename in ('compras','compra_itens','estoque_contagens')
--   order by tablename, indexname;
--
-- P6 — constraints com a definição. Tem que aparecer:
--   chk_compras_fornecedor, chk_compra_itens_quantidade,
--   chk_compra_itens_custo, uq_compra_itens_compra_produto,
--   chk_estoque_contagens_quantidade;
--   compra_itens_compra_id_fkey ON DELETE CASCADE;
--   compra_itens_produto_id_fkey e estoque_contagens_produto_id_fkey
--   ON DELETE RESTRICT.
--
--   select conrelid::regclass as tabela, conname, contype,
--          pg_get_constraintdef(oid) as definicao
--   from pg_constraint
--   where conrelid in ('public.compras'::regclass,
--                      'public.compra_itens'::regclass,
--                      'public.estoque_contagens'::regclass)
--     and contype in ('c','f','u')
--   order by tabela, contype, conname;
--
-- P7 — as travas recusam o que devem, SEM GRAVAR NADA.
--
--   Precisa de um produto de revenda que JÁ EXISTE (`limit 1`). A
--   compra e a linha válidas do controle positivo são criadas de
--   verdade, mas o bloco inteiro termina em `raise exception`, e exceção
--   num DO desfaz TUDO o que ele fez. Por isso o resultado esperado é um
--   ERRO:
--
--     ERROR: P0001: OK: fornecedor em branco, quantidade 0, custo
--     negativo, produto repetido e contagem negativa recusados; nada
--     gravado
--
--   Qualquer outra mensagem (começando com FALHA ou SEM DADO) é
--   problema: leia o texto. Cada recusa confere QUAL trava recusou.
--
--   do $$
--   declare
--     v_produto uuid;
--     v_compra  uuid;
--     v_trava   text;
--   begin
--     select id into v_produto from public.produtos
--      where tipo = 'revenda' limit 1;
--     if v_produto is null then
--       raise exception 'SEM DADO: nenhum produto de revenda';
--     end if;
--
--     -- Teste 1: fornecedor só com espaços.
--     begin
--       insert into public.compras (fornecedor, data) values ('  ', current_date);
--       raise exception 'FALHA: fornecedor em branco foi aceito';
--     exception when check_violation then
--       get stacked diagnostics v_trava = constraint_name;
--       if v_trava <> 'chk_compras_fornecedor' then
--         raise exception 'FALHA: fornecedor recusado por % (esperado chk_compras_fornecedor)', v_trava;
--       end if;
--     end;
--
--     -- Controle positivo: compra válida e linha válida TÊM que entrar.
--     -- Sem isso, uma trava errada que recusasse tudo passaria nos
--     -- testes abaixo.
--     insert into public.compras (fornecedor, data, observacoes)
--     values ('prova 021', current_date, 'prova 021')
--     returning id into v_compra;
--
--     insert into public.compra_itens (compra_id, produto_id, quantidade, custo_unitario)
--     values (v_compra, v_produto, 1, 0);
--
--     insert into public.estoque_contagens (produto_id, data, quantidade, observacao)
--     values (v_produto, current_date, 0, 'prova 021');
--
--     -- Teste 2: quantidade 0 na compra. (Outro produto não é preciso:
--     -- o check é avaliado antes do índice único.)
--     begin
--       insert into public.compra_itens (compra_id, produto_id, quantidade, custo_unitario)
--       values (v_compra, v_produto, 0, 10);
--       raise exception 'FALHA: quantidade 0 foi aceita';
--     exception when check_violation then
--       get stacked diagnostics v_trava = constraint_name;
--       if v_trava <> 'chk_compra_itens_quantidade' then
--         raise exception 'FALHA: quantidade 0 recusada por % (esperado chk_compra_itens_quantidade)', v_trava;
--       end if;
--     end;
--
--     -- Teste 3: custo negativo.
--     begin
--       insert into public.compra_itens (compra_id, produto_id, quantidade, custo_unitario)
--       values (v_compra, v_produto, 1, -0.01);
--       raise exception 'FALHA: custo negativo foi aceito';
--     exception when check_violation then
--       get stacked diagnostics v_trava = constraint_name;
--       if v_trava <> 'chk_compra_itens_custo' then
--         raise exception 'FALHA: custo negativo recusado por % (esperado chk_compra_itens_custo)', v_trava;
--       end if;
--     end;
--
--     -- Teste 4: o mesmo produto de novo na mesma compra, linha válida.
--     begin
--       insert into public.compra_itens (compra_id, produto_id, quantidade, custo_unitario)
--       values (v_compra, v_produto, 2, 5);
--       raise exception 'FALHA: produto repetido na mesma compra foi aceito';
--     exception when unique_violation then
--       get stacked diagnostics v_trava = constraint_name;
--       if v_trava <> 'uq_compra_itens_compra_produto' then
--         raise exception 'FALHA: produto repetido recusado por % (esperado uq_compra_itens_compra_produto)', v_trava;
--       end if;
--     end;
--
--     -- Teste 5: contagem negativa.
--     begin
--       insert into public.estoque_contagens (produto_id, data, quantidade)
--       values (v_produto, current_date, -1);
--       raise exception 'FALHA: contagem negativa foi aceita';
--     exception when check_violation then
--       get stacked diagnostics v_trava = constraint_name;
--       if v_trava <> 'chk_estoque_contagens_quantidade' then
--         raise exception 'FALHA: contagem negativa recusada por % (esperado chk_estoque_contagens_quantidade)', v_trava;
--       end if;
--     end;
--
--     raise exception 'OK: fornecedor em branco, quantidade 0, custo negativo, produto repetido e contagem negativa recusados; nada gravado';
--   end
--   $$;
--
-- P8 — contagem DEPOIS do P7: tem que ser 0 | 0 | 0, igual ao P1.
--
--   select (select count(*) from public.compras)           as compras,
--          (select count(*) from public.compra_itens)      as compra_itens,
--          (select count(*) from public.estoque_contagens) as estoque_contagens;
--
-- =====================================================================
-- SONDAGEM ANÔNIMA — só a anon key, sem sessão (aba anônima / terminal)
-- =====================================================================
--
-- S1 — controle positivo: a sondagem chega ao banco e a RLS responde.
-- Esperado: 200 e [].
--
--   curl -s -w "\n%{http_code}\n" "$URL/rest/v1/clientes?select=id" \
--        -H "apikey: $ANON"
--
-- S2 — controle negativo: coluna inexistente numa tabela nova.
-- Esperado: 400 com "code":"42703". Prova que a tabela está no schema
-- cache e que os 200 abaixo não são resposta genérica.
--
--   curl -s -w "\n%{http_code}\n" "$URL/rest/v1/compras?select=nao_existe" \
--        -H "apikey: $ANON"
--
-- S3 a S5 — as três tabelas novas. Esperado: 200 e [] em cada.
--
--   curl -s -w "\n%{http_code}\n" "$URL/rest/v1/compras?select=*" \
--        -H "apikey: $ANON"
--
--   curl -s -w "\n%{http_code}\n" "$URL/rest/v1/compra_itens?select=*" \
--        -H "apikey: $ANON"
--
--   curl -s -w "\n%{http_code}\n" "$URL/rest/v1/estoque_contagens?select=*" \
--        -H "apikey: $ANON"
--
-- S6 — bucket: a anon key não lista notas. Esperado: [] ou erro de
-- autorização.
--
--   curl -s -w "\n%{http_code}\n" "$URL/storage/v1/object/list/notas-fiscais" \
--        -H "apikey: $ANON" -H "Content-Type: application/json" \
--        -d '{"prefix":""}'
-- =====================================================================
