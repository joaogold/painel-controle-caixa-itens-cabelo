// Tipos do domínio — espelham as tabelas do Supabase.

export type TipoMovimentacao =
  | 'entrada'
  | 'saida'
  | 'venda'
  | 'perda'
  | 'danificado'
  | 'devolucao'
  | 'ajuste'

export type FormaPagamento =
  | 'dinheiro'
  | 'pix'
  | 'debito'
  | 'credito'
  | 'transferencia'
  | 'outro'

export type StatusRepasse = 'pendente' | 'pago'

export interface Produto {
  id: string
  nome: string
  categoria: string
  descricao: string | null
  quantidade_estoque: number
  estoque_minimo: number
  custo_unitario: number
  preco_venda: number
  imagem_url: string | null
  ativo: boolean
  created_at: string
  updated_at: string
  user_id: string
}

export interface MovimentacaoEstoque {
  id: string
  produto_id: string
  tipo: TipoMovimentacao
  quantidade: number
  estoque_anterior: number
  estoque_atual: number
  motivo: string | null
  observacao: string | null
  venda_id: string | null
  created_at: string
  user_id: string
  // join opcional
  produtos?: Pick<Produto, 'nome' | 'categoria'> | null
}

export interface Venda {
  id: string
  data_venda: string
  nome_cliente: string | null
  forma_pagamento: string
  observacao: string | null
  faturamento_total: number
  custo_total: number
  desconto_total: number
  lucro_bruto: number
  percentual_repasse: number
  valor_repasse: number
  lucro_liquido: number
  created_at: string
  user_id: string
  itens_venda?: ItemVenda[]
}

export interface ItemVenda {
  id: string
  venda_id: string
  produto_id: string
  quantidade: number
  custo_unitario: number
  preco_unitario: number
  desconto: number
  faturamento: number
  custo_total: number
  lucro_bruto: number
  valor_repasse: number
  lucro_liquido: number
  created_at: string
  produtos?: Pick<Produto, 'nome' | 'categoria'> | null
}

export interface Repasse {
  id: string
  data_inicial: string
  data_final: string
  lucro_bruto_periodo: number
  percentual: number
  valor_repasse: number
  status: StatusRepasse
  data_pagamento: string | null
  observacao: string | null
  created_at: string
  user_id: string
}

export interface VendaRepasse {
  id: string
  venda_id: string
  repasse_id: string
  created_at: string
}

// Item enviado ao RPC registrar_venda.
export interface ItemVendaInput {
  produto_id: string
  quantidade: number
  preco_unitario: number
  desconto: number
}
