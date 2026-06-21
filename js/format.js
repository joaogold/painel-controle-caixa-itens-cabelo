// Utilidades de formatação no padrão brasileiro.

const brl = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' })
const intFmt = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 0 })
const decFmt = new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

/** R$ 1.250,50 */
export function formatBRL(value) {
  return brl.format(Number(value ?? 0))
}

/** 1.250 (inteiro) */
export function formatInt(value) {
  return intFmt.format(Number(value ?? 0))
}

/** 1.250,50 (decimal sem símbolo) */
export function formatDecimal(value) {
  return decFmt.format(Number(value ?? 0))
}

/** 12,50% */
export function formatPercent(value) {
  return `${decFmt.format(Number(value ?? 0))}%`
}

/** DD/MM/AAAA */
export function formatDate(value) {
  if (!value) return '—'
  const d = typeof value === 'string' ? new Date(value) : value
  if (Number.isNaN(d.getTime())) return '—'
  return d.toLocaleDateString('pt-BR')
}

/** DD/MM/AAAA HH:mm */
export function formatDateTime(value) {
  if (!value) return '—'
  const d = typeof value === 'string' ? new Date(value) : value
  if (Number.isNaN(d.getTime())) return '—'
  return d.toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

/** YYYY-MM-DD para inputs do tipo date */
export function toISODate(d) {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

/** Converte o valor de um input numérico em número (aceita vírgula). */
export function parseNumber(v) {
  if (typeof v === 'number') return v
  const n = Number(String(v ?? '').trim().replace(',', '.'))
  return Number.isFinite(n) ? n : 0
}
