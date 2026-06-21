// Presets de período (sem dependências externas).

export const PERIODO_OPCOES = [
  { value: 'hoje', label: 'Hoje' },
  { value: 'semana', label: 'Semana atual' },
  { value: 'mes', label: 'Mês atual' },
  { value: 'mes_anterior', label: 'Mês anterior' },
  { value: 'personalizado', label: 'Período personalizado' },
]

function startOfDay(d) {
  const x = new Date(d)
  x.setHours(0, 0, 0, 0)
  return x
}
function endOfDay(d) {
  const x = new Date(d)
  x.setHours(23, 59, 59, 999)
  return x
}
function startOfWeek(d) {
  // Semana começando na segunda-feira.
  const x = startOfDay(d)
  const day = x.getDay() // 0=dom, 1=seg...
  const diff = (day + 6) % 7
  x.setDate(x.getDate() - diff)
  return x
}
function endOfWeek(d) {
  const s = startOfWeek(d)
  const e = new Date(s)
  e.setDate(s.getDate() + 6)
  return endOfDay(e)
}
function startOfMonth(d) {
  return startOfDay(new Date(d.getFullYear(), d.getMonth(), 1))
}
function endOfMonth(d) {
  return endOfDay(new Date(d.getFullYear(), d.getMonth() + 1, 0))
}

export function intervaloDoPreset(preset, custom = {}) {
  const hoje = new Date()
  switch (preset) {
    case 'hoje':
      return { inicio: startOfDay(hoje), fim: endOfDay(hoje) }
    case 'semana':
      return { inicio: startOfWeek(hoje), fim: endOfWeek(hoje) }
    case 'mes':
      return { inicio: startOfMonth(hoje), fim: endOfMonth(hoje) }
    case 'mes_anterior': {
      const ant = new Date(hoje.getFullYear(), hoje.getMonth() - 1, 1)
      return { inicio: startOfMonth(ant), fim: endOfMonth(ant) }
    }
    case 'personalizado': {
      const inicio = custom.inicio ? startOfDay(new Date(custom.inicio + 'T00:00:00')) : startOfMonth(hoje)
      const fim = custom.fim ? endOfDay(new Date(custom.fim + 'T00:00:00')) : endOfDay(hoje)
      return { inicio, fim }
    }
    default:
      return { inicio: startOfMonth(hoje), fim: endOfDay(hoje) }
  }
}

export { startOfMonth }
