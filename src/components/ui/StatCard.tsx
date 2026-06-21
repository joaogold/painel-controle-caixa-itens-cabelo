import type { ReactNode } from 'react'

interface StatCardProps {
  label: string
  value: string
  icon?: ReactNode
  hint?: string
  tone?: 'default' | 'positive' | 'negative' | 'warning' | 'brand'
}

const tones: Record<NonNullable<StatCardProps['tone']>, string> = {
  default: 'text-slate-800',
  positive: 'text-green-600',
  negative: 'text-red-600',
  warning: 'text-amber-600',
  brand: 'text-brand-600',
}

const iconTones: Record<NonNullable<StatCardProps['tone']>, string> = {
  default: 'bg-slate-100 text-slate-500',
  positive: 'bg-green-100 text-green-600',
  negative: 'bg-red-100 text-red-600',
  warning: 'bg-amber-100 text-amber-600',
  brand: 'bg-brand-100 text-brand-600',
}

export function StatCard({ label, value, icon, hint, tone = 'default' }: StatCardProps) {
  return (
    <div className="card p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-xs font-medium uppercase tracking-wide text-slate-500">
            {label}
          </p>
          <p className={`mt-1 truncate text-2xl font-bold ${tones[tone]}`}>{value}</p>
          {hint && <p className="mt-1 truncate text-xs text-slate-400">{hint}</p>}
        </div>
        {icon && (
          <div
            className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${iconTones[tone]}`}
          >
            {icon}
          </div>
        )}
      </div>
    </div>
  )
}
