import {
  startOfDay,
  endOfDay,
  startOfWeek,
  endOfWeek,
  startOfMonth,
  endOfMonth,
  subMonths,
} from 'date-fns'

export type PeriodoPreset =
  | 'hoje'
  | 'semana'
  | 'mes'
  | 'mes_anterior'
  | 'personalizado'

export interface Intervalo {
  inicio: Date
  fim: Date
}

export const PERIODO_OPCOES: { value: PeriodoPreset; label: string }[] = [
  { value: 'hoje', label: 'Hoje' },
  { value: 'semana', label: 'Semana atual' },
  { value: 'mes', label: 'Mês atual' },
  { value: 'mes_anterior', label: 'Mês anterior' },
  { value: 'personalizado', label: 'Período personalizado' },
]

export function intervaloDoPreset(
  preset: PeriodoPreset,
  custom?: { inicio?: string; fim?: string },
): Intervalo {
  const hoje = new Date()
  switch (preset) {
    case 'hoje':
      return { inicio: startOfDay(hoje), fim: endOfDay(hoje) }
    case 'semana':
      return {
        inicio: startOfWeek(hoje, { weekStartsOn: 1 }),
        fim: endOfWeek(hoje, { weekStartsOn: 1 }),
      }
    case 'mes':
      return { inicio: startOfMonth(hoje), fim: endOfMonth(hoje) }
    case 'mes_anterior': {
      const anterior = subMonths(hoje, 1)
      return { inicio: startOfMonth(anterior), fim: endOfMonth(anterior) }
    }
    case 'personalizado': {
      const inicio = custom?.inicio ? startOfDay(new Date(custom.inicio)) : startOfMonth(hoje)
      const fim = custom?.fim ? endOfDay(new Date(custom.fim)) : endOfDay(hoje)
      return { inicio, fim }
    }
  }
}
