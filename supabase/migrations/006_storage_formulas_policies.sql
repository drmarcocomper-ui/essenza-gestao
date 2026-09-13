-- =====================================================================
-- Essenza — Migration 006: policies de storage do bucket `formulas`
--
-- O bucket `formulas` foi criado pelo painel (privado, 10 MB, só
-- imagens) e ficou SEM NENHUMA POLICY. RLS está ligada em
-- storage.objects por padrão no Supabase, então "sem policy" hoje
-- significa "ninguém lê e ninguém escreve" — nem a usuária logada.
--
-- Estas quatro policies abrem o bucket para `authenticated` e só para
-- ele. `to authenticated` é a forma moderna (e mais forte) de escrever
-- `auth.role() = 'authenticated'`: o papel é conferido antes da
-- expressão, então a chave anônima — que vai no bundle do navegador e
-- chega ao Postgres como `anon` — não entra em nenhuma delas.
--
-- Sem policy para `anon` em lugar nenhum, a chave pública não lista,
-- não baixa e não escreve. Exibição é sempre por URL assinada
-- (createSignedUrl, validade curta). Nunca getPublicUrl: o bucket é
-- privado e getPublicUrl devolveria uma URL que só retorna 400.
--
-- Convenção de caminho DENTRO do bucket (o `formulas/` da frente é o
-- próprio bucket, não faz parte da chave do objeto):
--   {cliente_id}/{formula_id}/{antes|depois}.jpg
--
-- Conferência depois de aplicar (aba anônima, só com a anon key):
--   curl "$URL/storage/v1/object/list/formulas" -H "apikey: $ANON" \
--        -H "Content-Type: application/json" -d '{"prefix":""}'
--   -> tem que voltar [] ou erro de autorização.
-- =====================================================================

-- Leitura: é o que permite createSignedUrl e o download por trás dela.
drop policy if exists "formulas_select_authenticated" on storage.objects;
create policy "formulas_select_authenticated"
  on storage.objects for select to authenticated
  using (bucket_id = 'formulas');

-- Envio da foto antes/depois.
drop policy if exists "formulas_insert_authenticated" on storage.objects;
create policy "formulas_insert_authenticated"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'formulas');

-- Trocar a foto reusa o mesmo caminho (upsert): o update precisa do
-- `using` para achar a linha e do `with check` para não permitir mover o
-- objeto para fora do bucket na mesma operação.
drop policy if exists "formulas_update_authenticated" on storage.objects;
create policy "formulas_update_authenticated"
  on storage.objects for update to authenticated
  using (bucket_id = 'formulas')
  with check (bucket_id = 'formulas');

-- Remover a foto errada.
drop policy if exists "formulas_delete_authenticated" on storage.objects;
create policy "formulas_delete_authenticated"
  on storage.objects for delete to authenticated
  using (bucket_id = 'formulas');
