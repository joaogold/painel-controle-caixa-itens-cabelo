-- =============================================================================
--  PAINEL DE CONTROLE DE CAIXA, ESTOQUE E VENDAS — ITENS DE CABELO
--  Script de criação do schema (tabelas, constraints, índices e funções)
--  Banco: PostgreSQL (Supabase)
--
--  Como usar:
--    1. Abra o Supabase Dashboard > SQL Editor.
--    2. Cole e execute este arquivo INTEIRO.
--    3. Em seguida execute o arquivo "rls.sql".
--
--  Observação: este script é idempotente o suficiente para reexecução em
--  ambiente de desenvolvimento, mas em produção use migrações versionadas.
-- =============================================================================

-- Extensão para gen_random_uuid() (disponível por padrão no Supabase).
create extension if not exists pgcrypto;

-- -----------------------------------------------------------------------------
-- Função utilitária: mantém o campo updated_at sempre atualizado.
-- -----------------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- =============================================================================
-- TABELA: produtos
-- =============================================================================
create table if not exists public.produtos (
  id                  uuid primary key default gen_random_uuid(),
  nome                text        not null check (length(trim(nome)) > 0),
  categoria           text        not null default 'Geral',
  descricao           text,
  quantidade_estoque  integer     not null default 0 check (quantidade_estoque >= 0),
  estoque_minimo      integer     not null default 0 check (estoque_minimo >= 0),
  custo_unitario      numeric(12,2) not null default 0 check (custo_unitario >= 0),
  preco_venda         numeric(12,2) not null default 0 check (preco_venda >= 0),
  imagem_url          text,
  ativo               boolean     not null default true,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  user_id             uuid        not null default auth.uid() references auth.users(id) on delete cascade
);

create index if not exists idx_produtos_user        on public.produtos(user_id);
create index if not exists idx_produtos_categoria    on public.produtos(categoria);
create index if not exists idx_produtos_ativo        on public.produtos(ativo);
create index if not exists idx_produtos_nome         on public.produtos(lower(nome));

drop trigger if exists trg_produtos_updated_at on public.produtos;
create trigger trg_produtos_updated_at
  before update on public.produtos
  for each row execute function public.set_updated_at();

-- =============================================================================
-- TABELA: vendas
-- =============================================================================
create table if not exists public.vendas (
  id                  uuid primary key default gen_random_uuid(),
  data_venda          timestamptz not null default now(),
  nome_cliente        text,
  forma_pagamento     text        not null default 'dinheiro',
  observacao          text,
  faturamento_total   numeric(12,2) not null default 0 check (faturamento_total >= 0),
  custo_total         numeric(12,2) not null default 0 check (custo_total >= 0),
  desconto_total      numeric(12,2) not null default 0 check (desconto_total >= 0),
  lucro_bruto         numeric(12,2) not null default 0,
  percentual_repasse  numeric(5,2)  not null default 10 check (percentual_repasse >= 0 and percentual_repasse <= 100),
  valor_repasse       numeric(12,2) not null default 0 check (valor_repasse >= 0),
  lucro_liquido       numeric(12,2) not null default 0,
  created_at          timestamptz not null default now(),
  user_id             uuid        not null default auth.uid() references auth.users(id) on delete cascade
);

create index if not exists idx_vendas_user        on public.vendas(user_id);
create index if not exists idx_vendas_data         on public.vendas(data_venda);
create index if not exists idx_vendas_pagamento     on public.vendas(forma_pagamento);

-- =============================================================================
-- TABELA: itens_venda
-- =============================================================================
create table if not exists public.itens_venda (
  id                uuid primary key default gen_random_uuid(),
  venda_id          uuid not null references public.vendas(id) on delete cascade,
  -- on delete set null: permite excluir o produto preservando a venda no histórico.
  produto_id        uuid references public.produtos(id) on delete set null,
  quantidade        integer not null check (quantidade > 0),
  custo_unitario    numeric(12,2) not null default 0 check (custo_unitario >= 0),
  preco_unitario    numeric(12,2) not null default 0 check (preco_unitario >= 0),
  desconto          numeric(12,2) not null default 0 check (desconto >= 0),
  faturamento       numeric(12,2) not null default 0 check (faturamento >= 0),
  custo_total       numeric(12,2) not null default 0 check (custo_total >= 0),
  lucro_bruto       numeric(12,2) not null default 0,
  valor_repasse     numeric(12,2) not null default 0 check (valor_repasse >= 0),
  lucro_liquido     numeric(12,2) not null default 0,
  created_at        timestamptz not null default now()
);

create index if not exists idx_itens_venda_venda    on public.itens_venda(venda_id);
create index if not exists idx_itens_venda_produto  on public.itens_venda(produto_id);

-- =============================================================================
-- TABELA: movimentacoes_estoque
-- =============================================================================
create table if not exists public.movimentacoes_estoque (
  id                uuid primary key default gen_random_uuid(),
  produto_id        uuid not null references public.produtos(id) on delete cascade,
  tipo              text not null check (tipo in
                      ('entrada','saida','venda','perda','danificado','devolucao','ajuste')),
  quantidade        integer not null,
  estoque_anterior  integer not null check (estoque_anterior >= 0),
  estoque_atual     integer not null check (estoque_atual >= 0),
  motivo            text,
  observacao        text,
  venda_id          uuid references public.vendas(id) on delete set null,
  created_at        timestamptz not null default now(),
  user_id           uuid not null default auth.uid() references auth.users(id) on delete cascade
);

create index if not exists idx_mov_user      on public.movimentacoes_estoque(user_id);
create index if not exists idx_mov_produto    on public.movimentacoes_estoque(produto_id);
create index if not exists idx_mov_tipo       on public.movimentacoes_estoque(tipo);
create index if not exists idx_mov_data       on public.movimentacoes_estoque(created_at);
create index if not exists idx_mov_venda      on public.movimentacoes_estoque(venda_id);

-- =============================================================================
-- TABELA: repasses
-- =============================================================================
create table if not exists public.repasses (
  id                    uuid primary key default gen_random_uuid(),
  data_inicial          date not null,
  data_final            date not null,
  lucro_bruto_periodo   numeric(12,2) not null default 0,
  percentual            numeric(5,2)  not null default 10 check (percentual >= 0 and percentual <= 100),
  valor_repasse         numeric(12,2) not null default 0 check (valor_repasse >= 0),
  status                text not null default 'pendente' check (status in ('pendente','pago')),
  data_pagamento        timestamptz,
  observacao            text,
  created_at            timestamptz not null default now(),
  user_id               uuid not null default auth.uid() references auth.users(id) on delete cascade,
  check (data_final >= data_inicial)
);

create index if not exists idx_repasses_user    on public.repasses(user_id);
create index if not exists idx_repasses_status  on public.repasses(status);
create index if not exists idx_repasses_periodo on public.repasses(data_inicial, data_final);

-- =============================================================================
-- TABELA: vendas_repasses  (associação venda <-> repasse)
--   Garante que uma venda NÃO entre em mais de um repasse (unique em venda_id).
-- =============================================================================
create table if not exists public.vendas_repasses (
  id          uuid primary key default gen_random_uuid(),
  venda_id    uuid not null references public.vendas(id) on delete cascade,
  repasse_id  uuid not null references public.repasses(id) on delete cascade,
  created_at  timestamptz not null default now(),
  constraint uq_vendas_repasses_venda unique (venda_id)
);

create index if not exists idx_vr_repasse on public.vendas_repasses(repasse_id);
create index if not exists idx_vr_venda   on public.vendas_repasses(venda_id);


-- =============================================================================
--  FUNÇÕES DE NEGÓCIO (executadas de forma ATÔMICA / transacional)
--  Todas usam SECURITY DEFINER e validam auth.uid() para respeitar o RLS,
--  garantindo que ou TUDO é gravado, ou NADA é gravado.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- registrar_movimentacao: movimentação manual de estoque.
--   tipos que SOMAM:   entrada, devolucao
--   tipos que SUBTRAEM: saida, venda, perda, danificado
--   ajuste: define o estoque para a contagem física informada (p_quantidade).
--   O estoque nunca pode ficar negativo.
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
  v_uid         uuid := auth.uid();
  v_anterior    integer;
  v_atual       integer;
  v_delta       integer;
  v_mov         public.movimentacoes_estoque;
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

  -- Bloqueia a linha do produto durante a transação (evita corrida).
  -- Acervo compartilhado: qualquer usuário autenticado pode movimentar.
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
    -- saida, venda, perda, danificado
    v_delta := -p_quantidade;
    v_atual := v_anterior + v_delta;
  end if;

  if v_atual < 0 then
    raise exception 'Estoque insuficiente. Disponível: %, solicitado: %', v_anterior, p_quantidade
      using errcode = '23514';
  end if;

  update public.produtos
  set quantidade_estoque = v_atual
  where id = p_produto_id;

  insert into public.movimentacoes_estoque
    (produto_id, tipo, quantidade, estoque_anterior, estoque_atual, motivo, observacao, user_id)
  values
    (p_produto_id, p_tipo, abs(v_delta), v_anterior, v_atual, p_motivo, p_observacao, v_uid)
  returning * into v_mov;

  return v_mov;
end;
$$;

-- -----------------------------------------------------------------------------
-- registrar_venda: registra uma venda com 1+ itens de forma atômica.
--   - Valida estoque de cada item (bloqueando as linhas dos produtos).
--   - Deduz o estoque e cria a movimentação tipo 'venda' para cada item.
--   - Calcula faturamento, custo, lucro bruto, repasse e lucro líquido.
--   - Se qualquer item falhar, NADA é gravado (rollback automático).
--
--   p_itens: jsonb no formato
--     [{"produto_id":"...", "quantidade":2, "preco_unitario":50.0, "desconto":0}]
-- -----------------------------------------------------------------------------
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
  v_uid             uuid := auth.uid();
  v_pct             numeric := coalesce(p_percentual_repasse, 10);
  v_item            jsonb;
  v_produto         public.produtos;
  v_qtd             integer;
  v_preco           numeric(12,2);
  v_desc            numeric(12,2);
  v_item_fat        numeric(12,2);
  v_item_custo      numeric(12,2);
  v_item_lucro      numeric(12,2);
  v_item_repasse    numeric(12,2);
  v_anterior        integer;
  v_atual           integer;
  v_venda           public.vendas;
  v_tot_fat         numeric(12,2) := 0;
  v_tot_custo       numeric(12,2) := 0;
  v_tot_desc        numeric(12,2) := 0;
  v_tot_lucro       numeric(12,2) := 0;
  v_tot_repasse     numeric(12,2) := 0;
  v_count           integer := 0;
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

  -- Cabeçalho da venda (totais preenchidos no final).
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

    -- Bloqueia e valida o produto (acervo compartilhado).
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

    -- Preço: usa o informado ou o preço de venda cadastrado.
    v_preco := round(coalesce(nullif((v_item->>'preco_unitario'),'')::numeric, v_produto.preco_venda), 2);

    v_item_fat   := round(v_qtd * v_preco, 2);
    v_item_custo := round(v_qtd * v_produto.custo_unitario, 2);
    v_item_lucro := round(v_item_fat - v_item_custo - v_desc, 2);
    -- Repasse só sobre lucro positivo.
    v_item_repasse := round(greatest(v_item_lucro, 0) * v_pct / 100.0, 2);

    insert into public.itens_venda
      (venda_id, produto_id, quantidade, custo_unitario, preco_unitario, desconto,
       faturamento, custo_total, lucro_bruto, valor_repasse, lucro_liquido)
    values
      (v_venda.id, v_produto.id, v_qtd, v_produto.custo_unitario, v_preco, v_desc,
       v_item_fat, v_item_custo, v_item_lucro, v_item_repasse, v_item_lucro - v_item_repasse);

    -- Baixa de estoque + histórico.
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

-- -----------------------------------------------------------------------------
-- gerar_repasse: cria um repasse com base nas vendas do período que ainda
--   NÃO foram incluídas em nenhum outro repasse. Vincula as vendas e impede
--   dupla inclusão (constraint unique em vendas_repasses.venda_id).
-- -----------------------------------------------------------------------------
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
  v_uid       uuid := auth.uid();
  v_repasse   public.repasses;
  v_lucro     numeric(12,2) := 0;
  v_valor     numeric(12,2) := 0;
  v_qtd       integer := 0;
begin
  if v_uid is null then
    raise exception 'Usuário não autenticado.' using errcode = '28000';
  end if;
  if p_data_final < p_data_inicial then
    raise exception 'Data final menor que a data inicial.' using errcode = '22023';
  end if;

  -- Vendas elegíveis (acervo compartilhado): no período, ainda não vinculadas.
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

-- -----------------------------------------------------------------------------
-- marcar_repasse_pago: marca um repasse como pago sem alterar as vendas.
-- -----------------------------------------------------------------------------
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
  set status = 'pago',
      data_pagamento = coalesce(p_data_pagamento, now())
  where id = p_repasse_id
  returning * into v_repasse;

  if not found then
    raise exception 'Repasse não encontrado.' using errcode = 'P0002';
  end if;

  return v_repasse;
end;
$$;

-- Permissões de execução das funções para usuários autenticados.
grant execute on function public.registrar_movimentacao(uuid, text, integer, text, text) to authenticated;
grant execute on function public.registrar_venda(timestamptz, text, text, text, numeric, jsonb) to authenticated;
grant execute on function public.gerar_repasse(date, date, numeric, text) to authenticated;
grant execute on function public.marcar_repasse_pago(uuid, timestamptz) to authenticated;

-- =============================================================================
--  FIM DO SCHEMA — agora execute o arquivo rls.sql
-- =============================================================================
