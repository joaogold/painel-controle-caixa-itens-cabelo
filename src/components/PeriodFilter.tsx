import { PERIODO_OPCOES, type PeriodoPreset } from '@/lib/filters'

interface PeriodFilterProps {
  preset: PeriodoPreset
  onPreset: (p: PeriodoPreset) => void
  inicio: string
  fim: string
  onInicio: (v: string) => void
  onFim: (v: string) => void
}

export function PeriodFilter({
  preset,
  onPreset,
  inicio,
  fim,
  onInicio,
  onFim,
}: PeriodFilterProps) {
  return (
    <div className="flex flex-wrap items-end gap-3">
      <div>
        <label className="label">Período</label>
        <select
          className="input min-w-[10rem]"
          value={preset}
          onChange={(e) => onPreset(e.target.value as PeriodoPreset)}
        >
          {PERIODO_OPCOES.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      </div>

      {preset === 'personalizado' && (
        <>
          <div>
            <label className="label">De</label>
            <input
              type="date"
              className="input"
              value={inicio}
              onChange={(e) => onInicio(e.target.value)}
            />
          </div>
          <div>
            <label className="label">Até</label>
            <input
              type="date"
              className="input"
              value={fim}
              onChange={(e) => onFim(e.target.value)}
            />
          </div>
        </>
      )}
    </div>
  )
}
