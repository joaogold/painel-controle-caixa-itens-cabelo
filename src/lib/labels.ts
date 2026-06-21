import type { FormaPagamento, TipoMovimentacao } from '@/types'

export const FORMAS_PAGAMENTO: { value: FormaPagamento; label: string }[] = [
  { value: 'dinheiro', label: 'Dinheiro' },
  { value: 'pix', label: 'PIX' },
  { value: 'debito', label: 'Cartão de débito' },
  { value: 'credito', label: 'Cartão de crédito' },
  { value: 'transferencia', label: 'Transferência' },
  { value: 'outro', label: 'Outro' },
]

export function labelFormaPagamento(v: string): string {
  return FORMAS_PAGAMENTO.find((f) => f.value === v)?.label ?? v
}

export const TIPOS_MOVIMENTACAO: {
  value: TipoMovimentacao
  label: string
  sentido: 'entrada' | 'saida' | 'neutro'
}[] = [
  { value: 'entrada', label: 'Entrada de mercadoria', sentido: 'entrada' },
  { value: 'saida', label: 'Saída manual', sentido: 'saida' },
  { value: 'venda', label: 'Venda', sentido: 'saida' },
  { value: 'perda', label: 'Perda', sentido: 'saida' },
  { value: 'danificado', label: 'Produto danificado', sentido: 'saida' },
  { value: 'devolucao', label: 'Devolução', sentido: 'entrada' },
  { value: 'ajuste', label: 'Ajuste de inventário', sentido: 'neutro' },
]

export function labelTipoMov(v: string): string {
  return TIPOS_MOVIMENTACAO.find((t) => t.value === v)?.label ?? v
}

export function sentidoTipoMov(v: string): 'entrada' | 'saida' | 'neutro' {
  return TIPOS_MOVIMENTACAO.find((t) => t.value === v)?.sentido ?? 'neutro'
}

// Tipos disponíveis para movimentação MANUAL (venda é feita pela tela de vendas).
export const TIPOS_MOVIMENTACAO_MANUAL = TIPOS_MOVIMENTACAO.filter((t) => t.value !== 'venda')

export const CATEGORIAS_SUGERIDAS = [
  'Shampoo',
  'Condicionador',
  'Máscara',
  'Finalizador',
  'Coloração',
  'Tratamento',
  'Acessório',
  'Geral',
]
