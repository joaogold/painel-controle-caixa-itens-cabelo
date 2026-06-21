-- =============================================================================
--  MIGRAÇÃO: permitir EXCLUIR produtos a qualquer momento
--
--  Antes: produtos com vendas não podiam ser excluídos (FK "on delete restrict").
--  Agora: ao excluir um produto, o vínculo nos itens de venda vira NULO
--         (on delete set null). Os valores financeiros da venda (faturamento,
--         custo, lucro, repasse) JÁ ficam gravados no próprio item, então o
--         histórico e os totais continuam corretos — apenas o nome do produto
--         deixa de aparecer naquelas vendas (fica em branco).
--
--  As movimentações de estoque do produto são removidas junto (eram o registro
--  de estoque daquele produto, que deixa de existir).
--
--  Como usar: Supabase Dashboard > SQL Editor > cole e execute.
-- =============================================================================

-- Torna a coluna opcional e troca a regra da chave estrangeira.
alter table public.itens_venda alter column produto_id drop not null;

alter table public.itens_venda drop constraint if exists itens_venda_produto_id_fkey;

alter table public.itens_venda
  add constraint itens_venda_produto_id_fkey
  foreign key (produto_id) references public.produtos(id) on delete set null;

-- -----------------------------------------------------------------------------
-- Garante a PERMISSÃO de exclusão no RLS.
-- Sem isto, o banco recusa o DELETE e devolve 0 linhas SEM erro (falha calada):
-- o produto "some" da requisição mas continua na tabela.
-- -----------------------------------------------------------------------------
drop policy if exists "produtos_delete" on public.produtos;
create policy "produtos_delete" on public.produtos
  for delete to authenticated using (true);

-- Função única usada pelo site. Ela evita a "falha silenciosa" do DELETE
-- direto sob RLS e preserva os itens das vendas antigas.
create or replace function public.excluir_produto(p_produto_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_excluidos integer;
begin
  if auth.uid() is null then
    raise exception 'Usuário não autenticado';
  end if;

  update public.itens_venda
     set produto_id = null
   where produto_id = p_produto_id;

  -- Redundante com ON DELETE CASCADE, mas deixa a migração compatível com
  -- bancos antigos em que a constraint possa ter outro nome/configuração.
  delete from public.movimentacoes_estoque
   where produto_id = p_produto_id;

  delete from public.produtos
   where id = p_produto_id;

  get diagnostics v_excluidos = row_count;
  return v_excluidos > 0;
end;
$$;

revoke all on function public.excluir_produto(uuid) from public;
grant execute on function public.excluir_produto(uuid) to authenticated;

-- =============================================================================
--  FIM
-- =============================================================================
