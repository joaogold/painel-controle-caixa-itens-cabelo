-- =============================================================================
--  ROW LEVEL SECURITY (RLS) — MODELO COMPARTILHADO
--
--  Execute este arquivo DEPOIS de "schema.sql".
--
--  Regras aplicadas:
--    - RLS habilitado em TODAS as tabelas.
--    - Apenas usuários AUTENTICADOS acessam os dados.
--    - Acervo ÚNICO/COMPARTILHADO: todo usuário autenticado enxerga e opera
--      todos os registros (estoque, vendas, repasses) — ideal para uma loja
--      com vários operadores. O campo user_id apenas registra QUEM fez.
--    - Usuários não autenticados (anon) não têm nenhum acesso.
--
--  Também habilita o Supabase Realtime (atualização em tempo real).
--  NUNCA desabilite o RLS para "facilitar" o desenvolvimento.
-- =============================================================================

alter table public.produtos               enable row level security;
alter table public.vendas                 enable row level security;
alter table public.itens_venda            enable row level security;
alter table public.movimentacoes_estoque  enable row level security;
alter table public.repasses               enable row level security;
alter table public.vendas_repasses        enable row level security;

revoke all on public.produtos              from anon;
revoke all on public.vendas                from anon;
revoke all on public.itens_venda           from anon;
revoke all on public.movimentacoes_estoque from anon;
revoke all on public.repasses              from anon;
revoke all on public.vendas_repasses       from anon;

-- PRODUTOS ---------------------------------------------------------------
drop policy if exists "produtos_select" on public.produtos;
create policy "produtos_select" on public.produtos
  for select to authenticated using (true);

drop policy if exists "produtos_insert" on public.produtos;
create policy "produtos_insert" on public.produtos
  for insert to authenticated with check (auth.uid() = user_id);

drop policy if exists "produtos_update" on public.produtos;
create policy "produtos_update" on public.produtos
  for update to authenticated using (true) with check (true);

drop policy if exists "produtos_delete" on public.produtos;
create policy "produtos_delete" on public.produtos
  for delete to authenticated using (true);

-- VENDAS -----------------------------------------------------------------
drop policy if exists "vendas_select" on public.vendas;
create policy "vendas_select" on public.vendas
  for select to authenticated using (true);

drop policy if exists "vendas_insert" on public.vendas;
create policy "vendas_insert" on public.vendas
  for insert to authenticated with check (auth.uid() = user_id);

drop policy if exists "vendas_update" on public.vendas;
create policy "vendas_update" on public.vendas
  for update to authenticated using (true) with check (true);

-- Vendas NÃO podem ser excluídas pela interface (preserva o histórico).

-- ITENS_VENDA ------------------------------------------------------------
drop policy if exists "itens_venda_select" on public.itens_venda;
create policy "itens_venda_select" on public.itens_venda
  for select to authenticated using (true);

drop policy if exists "itens_venda_insert" on public.itens_venda;
create policy "itens_venda_insert" on public.itens_venda
  for insert to authenticated
  with check (exists (select 1 from public.vendas v where v.id = itens_venda.venda_id));

-- MOVIMENTACOES_ESTOQUE (histórico imutável: sem UPDATE/DELETE) -----------
drop policy if exists "mov_select" on public.movimentacoes_estoque;
create policy "mov_select" on public.movimentacoes_estoque
  for select to authenticated using (true);

drop policy if exists "mov_insert" on public.movimentacoes_estoque;
create policy "mov_insert" on public.movimentacoes_estoque
  for insert to authenticated with check (auth.uid() = user_id);

-- REPASSES ---------------------------------------------------------------
drop policy if exists "repasses_select" on public.repasses;
create policy "repasses_select" on public.repasses
  for select to authenticated using (true);

drop policy if exists "repasses_insert" on public.repasses;
create policy "repasses_insert" on public.repasses
  for insert to authenticated with check (auth.uid() = user_id);

drop policy if exists "repasses_update" on public.repasses;
create policy "repasses_update" on public.repasses
  for update to authenticated using (true) with check (true);

-- VENDAS_REPASSES --------------------------------------------------------
drop policy if exists "vr_select" on public.vendas_repasses;
create policy "vr_select" on public.vendas_repasses
  for select to authenticated using (true);

drop policy if exists "vr_insert" on public.vendas_repasses;
create policy "vr_insert" on public.vendas_repasses
  for insert to authenticated
  with check (exists (select 1 from public.repasses r where r.id = vendas_repasses.repasse_id));


-- =============================================================================
--  STORAGE — bucket de imagens de produtos
-- =============================================================================
insert into storage.buckets (id, name, public)
values ('produtos', 'produtos', true)
on conflict (id) do nothing;

drop policy if exists "produtos_storage_read" on storage.objects;
create policy "produtos_storage_read" on storage.objects
  for select using (bucket_id = 'produtos');

drop policy if exists "produtos_storage_insert" on storage.objects;
create policy "produtos_storage_insert" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'produtos' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "produtos_storage_update" on storage.objects;
create policy "produtos_storage_update" on storage.objects
  for update to authenticated
  using (bucket_id = 'produtos' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "produtos_storage_delete" on storage.objects;
create policy "produtos_storage_delete" on storage.objects
  for delete to authenticated
  using (bucket_id = 'produtos' and (storage.foldername(name))[1] = auth.uid()::text);


-- =============================================================================
--  REALTIME — adiciona as tabelas à publicação do Supabase (idempotente)
-- =============================================================================
do $$
declare
  t text;
  tabelas text[] := array[
    'produtos','movimentacoes_estoque','vendas','itens_venda','repasses','vendas_repasses'
  ];
begin
  if not exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    create publication supabase_realtime;
  end if;
  foreach t in array tabelas loop
    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = t
    ) then
      execute format('alter publication supabase_realtime add table public.%I', t);
    end if;
  end loop;
end $$;

-- =============================================================================
--  FIM DO RLS
-- =============================================================================
