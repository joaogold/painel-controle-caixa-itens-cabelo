-- =============================================================================
--  MIGRAÇÃO: estoque/dados COMPARTILHADOS entre todos os usuários + REALTIME
--
--  O que este script faz:
--    1. Troca as políticas de RLS: qualquer usuário AUTENTICADO passa a
--       enxergar e operar TODOS os registros (acervo único da loja).
--       Usuários anônimos continuam sem acesso.
--    2. Atualiza as funções de venda/movimentação/repasse para não filtrarem
--       por dono — o campo user_id continua registrando QUEM fez a operação.
--    3. Habilita o Supabase Realtime nas tabelas (atualização em tempo real).
--
--  Como usar:
--    - Abra o Supabase Dashboard > SQL Editor.
--    - Cole e execute este arquivo INTEIRO (pode rodar mais de uma vez).
--
--  Pré-requisito: você já deve ter rodado schema.sql e rls.sql antes.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1) POLÍTICAS DE RLS COMPARTILHADAS
--    SELECT/UPDATE/DELETE liberados para qualquer autenticado (using true).
--    No INSERT, exigimos user_id = auth.uid() para registrar o responsável.
-- -----------------------------------------------------------------------------

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

-- ITENS_VENDA ------------------------------------------------------------
drop policy if exists "itens_venda_select" on public.itens_venda;
create policy "itens_venda_select" on public.itens_venda
  for select to authenticated using (true);

drop policy if exists "itens_venda_insert" on public.itens_venda;
create policy "itens_venda_insert" on public.itens_venda
  for insert to authenticated
  with check (exists (select 1 from public.vendas v where v.id = itens_venda.venda_id));

-- MOVIMENTACOES_ESTOQUE --------------------------------------------------
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


-- -----------------------------------------------------------------------------
-- 2) FUNÇÕES SEM FILTRO POR DONO (operam sobre o acervo compartilhado)
-- -----------------------------------------------------------------------------

create or replace function public.registrar_movimentacao(
  p_produto_id  uuid,
  p_tipo        text,
  p_quantidade  integer,
  p_motivo      text default null,
  p_observacao  text default null
)
returns public.movimentacoes_estoque
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid       uuid := auth.uid();
  v_anterior  integer;
  v_atual     integer;
  v_delta     integer;
  v_mov       public.movimentacoes_estoque;
begin
  if v_uid is null then
    raise exception 'Usuário não autenticado.' using errcode = '28000';
  end if;
  if p_tipo not in ('entrada','saida','venda','perda','danificado','devolucao','ajuste') then
    raise exception 'Tipo de movimentação inválido: %', p_tipo using errcode = '22023';
  end if;
  if p_tipo = 'ajuste' then
    if p_quantidade < 0 then
      raise exception 'A contagem do ajuste não pode ser negativa.' using errcode = '22023';
    end if;
  elsif p_quantidade <= 0 then
    raise exception 'A quantidade deve ser maior que zero.' using errcode = '22023';
  end if;

  select quantidade_estoque into v_anterior
  from public.produtos
  where id = p_produto_id
  for update;

  if not found then
    raise exception 'Produto não encontrado.' using errcode = 'P0002';
  end if;

  if p_tipo in ('entrada','devolucao') then
    v_delta := p_quantidade;
    v_atual := v_anterior + v_delta;
  elsif p_tipo = 'ajuste' then
    v_atual := p_quantidade;
    v_delta := v_atual - v_anterior;
  else
    v_delta := -p_quantidade;
    v_atual := v_anterior + v_delta;
  end if;

  if v_atual < 0 then
    raise exception 'Estoque insuficiente. Disponível: %, solicitado: %', v_anterior, p_quantidade
      using errcode = '23514';
  end if;

  update public.produtos set quantidade_estoque = v_atual where id = p_produto_id;

  insert into public.movimentacoes_estoque
    (produto_id, tipo, quantidade, estoque_anterior, estoque_atual, motivo, observacao, user_id)
  values
    (p_produto_id, p_tipo, abs(v_delta), v_anterior, v_atual, p_motivo, p_observacao, v_uid)
  returning * into v_mov;

  return v_mov;
end;
$$;

create or replace function public.registrar_venda(
  p_data_venda        timestamptz,
  p_nome_cliente      text,
  p_forma_pagamento   text,
  p_observacao        text,
  p_percentual_repasse numeric,
  p_itens             jsonb
)
returns public.vendas
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid           uuid := auth.uid();
  v_pct           numeric := coalesce(p_percentual_repasse, 10);
  v_item          jsonb;
  v_produto       public.produtos;
  v_qtd           integer;
  v_preco         numeric(12,2);
  v_desc          numeric(12,2);
  v_item_fat      numeric(12,2);
  v_item_custo    numeric(12,2);
  v_item_lucro    numeric(12,2);
  v_item_repasse  numeric(12,2);
  v_anterior      integer;
  v_atual         integer;
  v_venda         public.vendas;
  v_tot_fat       numeric(12,2) := 0;
  v_tot_custo     numeric(12,2) := 0;
  v_tot_desc      numeric(12,2) := 0;
  v_tot_lucro     numeric(12,2) := 0;
  v_tot_repasse   numeric(12,2) := 0;
  v_count         integer := 0;
begin
  if v_uid is null then
    raise exception 'Usuário não autenticado.' using errcode = '28000';
  end if;
  if p_itens is null or jsonb_typeof(p_itens) <> 'array' or jsonb_array_length(p_itens) = 0 then
    raise exception 'A venda deve conter pelo menos um item.' using errcode = '22023';
  end if;
  if v_pct < 0 or v_pct > 100 then
    raise exception 'Percentual de repasse inválido.' using errcode = '22023';
  end if;

  insert into public.vendas
    (data_venda, nome_cliente, forma_pagamento, observacao, percentual_repasse, user_id)
  values
    (coalesce(p_data_venda, now()), nullif(trim(coalesce(p_nome_cliente,'')),''),
     coalesce(nullif(trim(p_forma_pagamento),''),'dinheiro'),
     nullif(trim(coalesce(p_observacao,'')),''), v_pct, v_uid)
  returning * into v_venda;

  for v_item in select * from jsonb_array_elements(p_itens)
  loop
    v_qtd  := coalesce((v_item->>'quantidade')::integer, 0);
    v_desc := round(coalesce((v_item->>'desconto')::numeric, 0), 2);
    if v_qtd <= 0 then
      raise exception 'Quantidade inválida em um dos itens.' using errcode = '22023';
    end if;
    if v_desc < 0 then
      raise exception 'Desconto não pode ser negativo.' using errcode = '22023';
    end if;

    select * into v_produto
    from public.produtos
    where id = (v_item->>'produto_id')::uuid
    for update;

    if not found then
      raise exception 'Produto não encontrado em um dos itens.' using errcode = 'P0002';
    end if;

    v_anterior := v_produto.quantidade_estoque;
    if v_qtd > v_anterior then
      raise exception 'Estoque insuficiente para o produto "%". Disponível: %, solicitado: %',
        v_produto.nome, v_anterior, v_qtd using errcode = '23514';
    end if;

    v_preco := round(coalesce(nullif((v_item->>'preco_unitario'),'')::numeric, v_produto.preco_venda), 2);
    v_item_fat   := round(v_qtd * v_preco, 2);
    v_item_custo := round(v_qtd * v_produto.custo_unitario, 2);
    v_item_lucro := round(v_item_fat - v_item_custo - v_desc, 2);
    v_item_repasse := round(greatest(v_item_lucro, 0) * v_pct / 100.0, 2);

    insert into public.itens_venda
      (venda_id, produto_id, quantidade, custo_unitario, preco_unitario, desconto,
       faturamento, custo_total, lucro_bruto, valor_repasse, lucro_liquido)
    values
      (v_venda.id, v_produto.id, v_qtd, v_produto.custo_unitario, v_preco, v_desc,
       v_item_fat, v_item_custo, v_item_lucro, v_item_repasse, v_item_lucro - v_item_repasse);

    v_atual := v_anterior - v_qtd;
    update public.produtos set quantidade_estoque = v_atual where id = v_produto.id;

    insert into public.movimentacoes_estoque
      (produto_id, tipo, quantidade, estoque_anterior, estoque_atual, motivo, venda_id, user_id)
    values
      (v_produto.id, 'venda', v_qtd, v_anterior, v_atual, 'Venda registrada', v_venda.id, v_uid);

    v_tot_fat     := v_tot_fat + v_item_fat;
    v_tot_custo   := v_tot_custo + v_item_custo;
    v_tot_desc    := v_tot_desc + v_desc;
    v_tot_lucro   := v_tot_lucro + v_item_lucro;
    v_tot_repasse := v_tot_repasse + v_item_repasse;
    v_count       := v_count + 1;
  end loop;

  if v_count = 0 then
    raise exception 'A venda deve conter pelo menos um item.' using errcode = '22023';
  end if;

  update public.vendas
  set faturamento_total = v_tot_fat,
      custo_total       = v_tot_custo,
      desconto_total    = v_tot_desc,
      lucro_bruto       = v_tot_lucro,
      valor_repasse     = v_tot_repasse,
      lucro_liquido     = v_tot_lucro - v_tot_repasse
  where id = v_venda.id
  returning * into v_venda;

  return v_venda;
end;
$$;

create or replace function public.gerar_repasse(
  p_data_inicial date,
  p_data_final   date,
  p_percentual   numeric default 10,
  p_observacao   text default null
)
returns public.repasses
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid     uuid := auth.uid();
  v_repasse public.repasses;
  v_lucro   numeric(12,2) := 0;
  v_valor   numeric(12,2) := 0;
  v_qtd     integer := 0;
begin
  if v_uid is null then
    raise exception 'Usuário não autenticado.' using errcode = '28000';
  end if;
  if p_data_final < p_data_inicial then
    raise exception 'Data final menor que a data inicial.' using errcode = '22023';
  end if;

  -- Considera as vendas de TODOS os usuários no período, ainda não vinculadas.
  create temporary table _vendas_eleg on commit drop as
  select v.id, v.lucro_bruto, v.valor_repasse
  from public.vendas v
  where v.data_venda::date between p_data_inicial and p_data_final
    and not exists (select 1 from public.vendas_repasses vr where vr.venda_id = v.id);

  select count(*), coalesce(sum(lucro_bruto),0), coalesce(sum(valor_repasse),0)
    into v_qtd, v_lucro, v_valor
  from _vendas_eleg;

  if v_qtd = 0 then
    raise exception 'Nenhuma venda pendente de repasse no período informado.' using errcode = 'P0002';
  end if;

  insert into public.repasses
    (data_inicial, data_final, lucro_bruto_periodo, percentual, valor_repasse, status, observacao, user_id)
  values
    (p_data_inicial, p_data_final, v_lucro, coalesce(p_percentual,10), v_valor, 'pendente',
     nullif(trim(coalesce(p_observacao,'')),''), v_uid)
  returning * into v_repasse;

  insert into public.vendas_repasses (venda_id, repasse_id)
  select id, v_repasse.id from _vendas_eleg;

  return v_repasse;
end;
$$;

create or replace function public.marcar_repasse_pago(
  p_repasse_id     uuid,
  p_data_pagamento timestamptz default now()
)
returns public.repasses
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid     uuid := auth.uid();
  v_repasse public.repasses;
begin
  if v_uid is null then
    raise exception 'Usuário não autenticado.' using errcode = '28000';
  end if;

  update public.repasses
  set status = 'pago', data_pagamento = coalesce(p_data_pagamento, now())
  where id = p_repasse_id
  returning * into v_repasse;

  if not found then
    raise exception 'Repasse não encontrado.' using errcode = 'P0002';
  end if;

  return v_repasse;
end;
$$;


-- -----------------------------------------------------------------------------
-- 3) REALTIME — adiciona as tabelas à publicação do Supabase (idempotente)
-- -----------------------------------------------------------------------------
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
--  FIM DA MIGRAÇÃO
-- =============================================================================
