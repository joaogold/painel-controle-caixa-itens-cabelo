// Rótulos e listas auxiliares.

export const FORMAS_PAGAMENTO = [
  { value: 'dinheiro', label: 'Dinheiro' },
  { value: 'pix', label: 'PIX' },
  { value: 'debito', label: 'Cartão de débito' },
  { value: 'credito', label: 'Cartão de crédito' },
  { value: 'transferencia', label: 'Transferência' },
  { value: 'outro', label: 'Outro' },
]

export function labelFormaPagamento(v) {
  return FORMAS_PAGAMENTO.find((f) => f.value === v)?.label ?? v
}

export const TIPOS_MOVIMENTACAO = [
  { value: 'entrada', label: 'Entrada de mercadoria', sentido: 'entrada' },
  { value: 'saida', label: 'Saída manual', sentido: 'saida' },
  { value: 'venda', label: 'Venda', sentido: 'saida' },
  { value: 'perda', label: 'Perda', sentido: 'saida' },
  { value: 'danificado', label: 'Produto danificado', sentido: 'saida' },
  { value: 'devolucao', label: 'Devolução', sentido: 'entrada' },
  { value: 'ajuste', label: 'Ajuste de inventário', sentido: 'neutro' },
]

export function labelTipoMov(v) {
  return TIPOS_MOVIMENTACAO.find((t) => t.value === v)?.label ?? v
}

export function sentidoTipoMov(v) {
  return TIPOS_MOVIMENTACAO.find((t) => t.value === v)?.sentido ?? 'neutro'
}

// Movimentações manuais (venda é feita pela tela de vendas).
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
