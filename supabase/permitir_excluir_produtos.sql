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

-- =============================================================================
--  FIM
-- =============================================================================
