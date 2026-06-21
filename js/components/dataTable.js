import { refreshIcons, emptyState } from '../ui.js'

/**
 * Renderiza uma tabela com busca e paginação dentro de `container`.
 *
 * options = {
 *   columns: [{ header, cell:(row)=>html, align?, search?:(row)=>string }],
 *   rows, rowKey:(row)=>string,
 *   searchPlaceholder, pageSize=10, toolbarHTML='',
 *   emptyTitle, emptyDescription,
 *   onAction:(action, id, row)=>void   // de elementos [data-action][data-id]
 * }
 * Retorna { setRows, refresh }.
 */
export function createDataTable(container, options) {
  const {
    columns,
    rowKey,
    searchPlaceholder = 'Buscar…',
    pageSize = 10,
    toolbarHTML = '',
    emptyTitle = 'Nenhum registro encontrado',
    emptyDescription = '',
    onAction,
  } = options

  let rows = options.rows || []
  let query = ''
  let page = 1
  const byKey = new Map()

  const align = (a) => (a === 'right' ? 'text-right' : a === 'center' ? 'text-center' : 'text-left')

  function filtered() {
    const q = query.trim().toLowerCase()
    if (!q) return rows
    return rows.filter((row) =>
      columns.some((c) => (c.search ? String(c.search(row)).toLowerCase().includes(q) : false)),
    )
  }

  function render() {
    byKey.clear()
    const data = filtered()
    const totalPages = Math.max(1, Math.ceil(data.length / pageSize))
    if (page > totalPages) page = totalPages
    const slice = data.slice((page - 1) * pageSize, page * pageSize)
    slice.forEach((r) => byKey.set(String(rowKey(r)), r))

    const headHTML = columns
      .map((c) => `<th class="${align(c.align)}">${c.header}</th>`)
      .join('')

    const bodyHTML = slice
      .map((row) => {
        const id = String(rowKey(row))
        const tds = columns
          .map((c) => `<td class="${align(c.align)}">${c.cell(row)}</td>`)
          .join('')
        return `<tr data-row="${id}">${tds}</tr>`
      })
      .join('')

    const pagination =
      data.length > pageSize
        ? `<div class="flex items-center justify-between border-t border-slate-200 px-4 py-3 text-sm text-slate-500">
            <span>${(page - 1) * pageSize + 1}–${Math.min(page * pageSize, data.length)} de ${data.length}</span>
            <div class="flex items-center gap-1">
              <button data-page="prev" class="rounded-lg border border-slate-300 p-1.5 hover:bg-slate-50 ${page === 1 ? 'opacity-40' : ''}" ${page === 1 ? 'disabled' : ''} aria-label="Anterior"><i data-lucide="chevron-left" class="h-4 w-4"></i></button>
              <span class="px-2">${page} / ${totalPages}</span>
              <button data-page="next" class="rounded-lg border border-slate-300 p-1.5 hover:bg-slate-50 ${page === totalPages ? 'opacity-40' : ''}" ${page === totalPages ? 'disabled' : ''} aria-label="Próxima"><i data-lucide="chevron-right" class="h-4 w-4"></i></button>
            </div>
          </div>`
        : ''

    container.innerHTML = `
      <div class="card overflow-hidden">
        <div class="flex flex-col gap-3 border-b border-slate-200 p-4 sm:flex-row sm:items-center sm:justify-between">
          <div class="relative max-w-xs flex-1">
            <i data-lucide="search" class="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"></i>
            <input data-search class="input pl-9" placeholder="${searchPlaceholder}" value="${query.replace(/"/g, '&quot;')}" />
          </div>
          <div class="flex flex-wrap items-center gap-2">${toolbarHTML}</div>
        </div>
        ${
          slice.length === 0
            ? emptyState({ title: emptyTitle, description: emptyDescription })
            : `<div class="overflow-x-auto"><table class="tbl"><thead><tr>${headHTML}</tr></thead><tbody>${bodyHTML}</tbody></table></div>`
        }
        ${pagination}
      </div>`

    // Busca
    const searchEl = container.querySelector('[data-search]')
    if (searchEl) {
      searchEl.addEventListener('input', (e) => {
        query = e.target.value
        page = 1
        render()
        // mantém o foco no campo de busca
        const el = container.querySelector('[data-search]')
        if (el) {
          el.focus()
          el.setSelectionRange(el.value.length, el.value.length)
        }
      })
    }

    // Paginação
    container.querySelector('[data-page="prev"]')?.addEventListener('click', () => {
      if (page > 1) {
        page--
        render()
      }
    })
    container.querySelector('[data-page="next"]')?.addEventListener('click', () => {
      if (page < totalPages) {
        page++
        render()
      }
    })

    // Ações (delegação)
    if (onAction) {
      container.querySelectorAll('[data-action]').forEach((btn) => {
        btn.addEventListener('click', () => {
          const id = btn.getAttribute('data-id')
          onAction(btn.getAttribute('data-action'), id, byKey.get(String(id)))
        })
      })
    }

    refreshIcons()
  }

  render()

  return {
    setRows(newRows) {
      rows = newRows || []
      render()
    },
    refresh: render,
  }
}
