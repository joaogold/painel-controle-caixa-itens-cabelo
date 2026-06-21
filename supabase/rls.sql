-- =============================================================================
--  ROW LEVEL SECURITY (RLS) — Painel de Controle de Caixa / Estoque
--
--  Execute este arquivo DEPOIS de "schema.sql".
--
--  Regras aplicadas:
--    - RLS habilitado em TODAS as tabelas.
--    - Apenas usuários autenticados acessam os dados.
--    - Cada usuário enxerga e altera SOMENTE os próprios registros (user_id).
--    - Usuários não autenticados não têm nenhum acesso.
--
--  NUNCA desabilite o RLS para "facilitar" o desenvolvimento.
-- =============================================================================

-- Habilita RLS
alter table public.produtos               enable row level security;
alter table public.vendas                 enable row level security;
alter table public.itens_venda            enable row level security;
alter table public.movimentacoes_estoque  enable row level security;
alter table public.repasses               enable row level security;
alter table public.vendas_repasses        enable row level security;

-- (Reforço) revoga acesso anônimo direto às tabelas.
revoke all on public.produtos              from anon;
revoke all on public.vendas                from anon;
revoke all on public.itens_venda           from anon;
revoke all on public.movimentacoes_estoque from anon;
revoke all on public.repasses              from anon;
revoke all on public.vendas_repasses       from anon;

-- -----------------------------------------------------------------------------
-- PRODUTOS
-- -----------------------------------------------------------------------------
drop policy if exists "produtos_select" on public.produtos;
create policy "produtos_select" on public.produtos
  for select to authenticated
  using (auth.uid() = user_id);

drop policy if exists "produtos_insert" on public.produtos;
create policy "produtos_insert" on public.produtos
  for insert to authenticated
  with check (auth.uid() = user_id);

drop policy if exists "produtos_update" on public.produtos;
create policy "produtos_update" on public.produtos
  for update to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "produtos_delete" on public.produtos;
create policy "produtos_delete" on public.produtos
  for delete to authenticated
  using (auth.uid() = user_id);

-- -----------------------------------------------------------------------------
-- VENDAS
-- -----------------------------------------------------------------------------
drop policy if exists "vendas_select" on public.vendas;
create policy "vendas_select" on public.vendas
  for select to authenticated
  using (auth.uid() = user_id);

drop policy if exists "vendas_insert" on public.vendas;
create policy "vendas_insert" on public.vendas
  for insert to authenticated
  with check (auth.uid() = user_id);

drop policy if exists "vendas_update" on public.vendas;
create policy "vendas_update" on public.vendas
  for update to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- Vendas NÃO podem ser excluídas pela interface (preserva o histórico).
-- (Nenhuma policy de DELETE é criada de propósito.)

-- -----------------------------------------------------------------------------
-- ITENS_VENDA  (segue o dono da venda-pai)
-- -----------------------------------------------------------------------------
drop policy if exists "itens_venda_select" on public.itens_venda;
create policy "itens_venda_select" on public.itens_venda
  for select to authenticated
  using (exists (
    select 1 from public.vendas v
    where v.id = itens_venda.venda_id and v.user_id = auth.uid()
  ));

drop policy if exists "itens_venda_insert" on public.itens_venda;
create policy "itens_venda_insert" on public.itens_venda
  for insert to authenticated
  with check (exists (
    select 1 from public.vendas v
    where v.id = itens_venda.venda_id and v.user_id = auth.uid()
  ));

-- -----------------------------------------------------------------------------
-- MOVIMENTACOES_ESTOQUE
--   SELECT/INSERT permitidos ao dono. UPDATE/DELETE NÃO são permitidos
--   (histórico imutável; não pode ser editado nem excluído pela interface).
-- -----------------------------------------------------------------------------
drop policy if exists "mov_select" on public.movimentacoes_estoque;
create policy "mov_select" on public.movimentacoes_estoque
  for select to authenticated
  using (auth.uid() = user_id);

drop policy if exists "mov_insert" on public.movimentacoes_estoque;
create policy "mov_insert" on public.movimentacoes_estoque
  for insert to authenticated
  with check (auth.uid() = user_id);

-- -----------------------------------------------------------------------------
-- REPASSES
-- -----------------------------------------------------------------------------
drop policy if exists "repasses_select" on public.repasses;
create policy "repasses_select" on public.repasses
  for select to authenticated
  using (auth.uid() = user_id);

drop policy if exists "repasses_insert" on public.repasses;
create policy "repasses_insert" on public.repasses
  for insert to authenticated
  with check (auth.uid() = user_id);

drop policy if exists "repasses_update" on public.repasses;
create policy "repasses_update" on public.repasses
  for update to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- -----------------------------------------------------------------------------
-- VENDAS_REPASSES  (segue o dono do repasse-pai)
-- -----------------------------------------------------------------------------
drop policy if exists "vr_select" on public.vendas_repasses;
create policy "vr_select" on public.vendas_repasses
  for select to authenticated
  using (exists (
    select 1 from public.repasses r
    where r.id = vendas_repasses.repasse_id and r.user_id = auth.uid()
  ));

drop policy if exists "vr_insert" on public.vendas_repasses;
create policy "vr_insert" on public.vendas_repasses
  for insert to authenticated
  with check (exists (
    select 1 from public.repasses r
    where r.id = vendas_repasses.repasse_id and r.user_id = auth.uid()
  ));

-- =============================================================================
--  STORAGE — bucket de imagens de produtos
--  Cria o bucket "produtos" (público para leitura) e políticas de upload.
--  Caso prefira criar o bucket pela interface, veja o README.
-- =============================================================================
insert into storage.buckets (id, name, public)
values ('produtos', 'produtos', true)
on conflict (id) do nothing;

-- Leitura pública das imagens (URLs públicas funcionam sem login).
drop policy if exists "produtos_storage_read" on storage.objects;
create policy "produtos_storage_read" on storage.objects
  for select
  using (bucket_id = 'produtos');

-- Upload / atualização / exclusão somente para usuários autenticados,
-- restrito à "pasta" do próprio usuário (prefixo = auth.uid()).
drop policy if exists "produtos_storage_insert" on storage.objects;
create policy "produtos_storage_insert" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'produtos'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "produtos_storage_update" on storage.objects;
create policy "produtos_storage_update" on storage.objects
  for update to authenticated
  using (
    bucket_id = 'produtos'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "produtos_storage_delete" on storage.objects;
create policy "produtos_storage_delete" on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'produtos'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- =============================================================================
--  FIM DO RLS
-- =============================================================================
