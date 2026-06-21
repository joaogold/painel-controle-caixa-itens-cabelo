import { useMemo, useState, type ReactNode } from 'react'
import { ChevronLeft, ChevronRight, Search } from 'lucide-react'
import { EmptyState } from './EmptyState'

export interface TableColumn<T> {
  key: string
  header: string
  render: (row: T) => ReactNode
  /** texto usado na busca/ordenação (opcional) */
  searchText?: (row: T) => string
  className?: string
  align?: 'left' | 'right' | 'center'
}

interface DataTableProps<T> {
  rows: T[]
  columns: TableColumn<T>[]
  rowKey: (row: T) => string
  searchPlaceholder?: string
  pageSize?: number
  toolbar?: ReactNode
  emptyTitle?: string
  emptyDescription?: string
}

export function DataTable<T>({
  rows,
  columns,
  rowKey,
  searchPlaceholder = 'Buscar…',
  pageSize = 10,
  toolbar,
  emptyTitle = 'Nenhum registro encontrado',
  emptyDescription,
}: DataTableProps<T>) {
  const [query, setQuery] = useState('')
  const [page, setPage] = useState(1)

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return rows
    return rows.filter((row) =>
      columns.some((c) => {
        const text = c.searchText ? c.searchText(row) : ''
        return text.toLowerCase().includes(q)
      }),
    )
  }, [rows, columns, query])

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize))
  const current = Math.min(page, totalPages)
  const slice = filtered.slice((current - 1) * pageSize, current * pageSize)

  const align = (a?: 'left' | 'right' | 'center') =>
    a === 'right' ? 'text-right' : a === 'center' ? 'text-center' : 'text-left'

  return (
    <div className="card overflow-hidden">
      <div className="flex flex-col gap-3 border-b border-slate-200 p-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative max-w-xs flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            value={query}
            onChange={(e) => {
              setQuery(e.target.value)
              setPage(1)
            }}
            placeholder={searchPlaceholder}
            className="input pl-9"
          />
        </div>
        {toolbar && <div className="flex flex-wrap items-center gap-2">{toolbar}</div>}
      </div>

      {slice.length === 0 ? (
        <EmptyState title={emptyTitle} description={emptyDescription} />
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                {columns.map((c) => (
                  <th key={c.key} className={`px-4 py-3 font-semibold ${align(c.align)}`}>
                    {c.header}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {slice.map((row) => (
                <tr key={rowKey(row)} className="border-b border-slate-100 last:border-0 hover:bg-slate-50">
                  {columns.map((c) => (
                    <td key={c.key} className={`px-4 py-3 ${align(c.align)} ${c.className ?? ''}`}>
                      {c.render(row)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {filtered.length > pageSize && (
        <div className="flex items-center justify-between border-t border-slate-200 px-4 py-3 text-sm text-slate-500">
          <span>
            {(current - 1) * pageSize + 1}–{Math.min(current * pageSize, filtered.length)} de{' '}
            {filtered.length}
          </span>
          <div className="flex items-center gap-1">
            <button
              className="rounded-lg border border-slate-300 p-1.5 disabled:opacity-40 hover:bg-slate-50"
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={current === 1}
              aria-label="Página anterior"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <span className="px-2">
              {current} / {totalPages}
            </span>
            <button
              className="rounded-lg border border-slate-300 p-1.5 disabled:opacity-40 hover:bg-slate-50"
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={current === totalPages}
              aria-label="Próxima página"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
