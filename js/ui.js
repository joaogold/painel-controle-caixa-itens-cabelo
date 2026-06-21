// Helpers de interface: ícones, toast, modal, confirmação e estados.

/** Re-renderiza os ícones Lucide presentes no DOM. */
export function refreshIcons() {
  if (window.lucide && typeof window.lucide.createIcons === 'function') {
    window.lucide.createIcons()
  }
}

/** Escapa texto para uso seguro em innerHTML. */
export function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;')
}

/* ----------------------------- TOAST ----------------------------- */

const TOAST_STYLES = {
  success: 'border-green-200 bg-green-50 text-green-800',
  error: 'border-red-200 bg-red-50 text-red-800',
  info: 'border-blue-200 bg-blue-50 text-blue-800',
}
const TOAST_ICON = { success: 'check-circle-2', error: 'alert-circle', info: 'info' }

export function toast(message, type = 'info') {
  const root = document.getElementById('toast-root')
  if (!root) return
  const item = document.createElement('div')
  item.className = `pointer-events-auto flex w-full max-w-md items-start gap-3 rounded-lg border px-4 py-3 shadow-md animate-fade ${TOAST_STYLES[type]}`
  item.setAttribute('role', 'alert')
  item.innerHTML = `
    <i data-lucide="${TOAST_ICON[type]}" class="mt-0.5 h-5 w-5 shrink-0"></i>
    <p class="flex-1 text-sm font-medium">${escapeHtml(message)}</p>
    <button class="shrink-0 opacity-60 hover:opacity-100" aria-label="Fechar"><i data-lucide="x" class="h-4 w-4"></i></button>
  `
  root.appendChild(item)
  refreshIcons()
  const remove = () => {
    item.style.transition = 'opacity .2s'
    item.style.opacity = '0'
    setTimeout(() => item.remove(), 200)
  }
  item.querySelector('button').addEventListener('click', remove)
  setTimeout(remove, 4500)
}

export const showSuccess = (m) => toast(m, 'success')
export const showError = (m) => toast(m, 'error')
export const showInfo = (m) => toast(m, 'info')

/* ----------------------------- MODAL ----------------------------- */

const MODAL_SIZES = { sm: 'max-w-md', md: 'max-w-lg', lg: 'max-w-2xl', xl: 'max-w-4xl' }

/**
 * Abre um modal. `body` e `footer` podem ser string (HTML) ou HTMLElement.
 * Retorna { close, root, body: bodyEl }.
 */
export function openModal({ title, body, footer, size = 'md', onClose }) {
  const root = document.getElementById('modal-root')
  const overlay = document.createElement('div')
  overlay.className =
    'fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-slate-900/50 p-4 sm:items-center'

  const card = document.createElement('div')
  card.className = `card my-8 w-full ${MODAL_SIZES[size] || MODAL_SIZES.md} animate-fade`
  card.setAttribute('role', 'dialog')
  card.setAttribute('aria-modal', 'true')

  const header = document.createElement('div')
  header.className = 'flex items-center justify-between border-b border-slate-200 px-5 py-4'
  header.innerHTML = `
    <h3 class="text-lg font-semibold text-slate-800">${escapeHtml(title)}</h3>
    <button data-close class="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600" aria-label="Fechar">
      <i data-lucide="x" class="h-5 w-5"></i>
    </button>`

  const bodyEl = document.createElement('div')
  bodyEl.className = 'px-5 py-4'
  if (typeof body === 'string') bodyEl.innerHTML = body
  else if (body) bodyEl.appendChild(body)

  card.appendChild(header)
  card.appendChild(bodyEl)

  let footerEl = null
  if (footer) {
    footerEl = document.createElement('div')
    footerEl.className = 'flex justify-end gap-3 border-t border-slate-200 px-5 py-4'
    if (typeof footer === 'string') footerEl.innerHTML = footer
    else footerEl.appendChild(footer)
    card.appendChild(footerEl)
  }

  overlay.appendChild(card)
  root.appendChild(overlay)
  document.body.style.overflow = 'hidden'
  refreshIcons()

  const close = () => {
    overlay.remove()
    document.body.style.overflow = ''
    window.removeEventListener('keydown', onKey)
    if (onClose) onClose()
  }
  const onKey = (e) => {
    if (e.key === 'Escape') close()
  }
  window.addEventListener('keydown', onKey)
  overlay.addEventListener('mousedown', (e) => {
    if (e.target === overlay) close()
  })
  header.querySelector('[data-close]').addEventListener('click', close)

  return { close, root: overlay, body: bodyEl, footer: footerEl }
}

/** Diálogo de confirmação. Retorna uma Promise<boolean>. */
export function confirmDialog({ title, message, confirmLabel = 'Confirmar', cancelLabel = 'Cancelar', danger = true }) {
  return new Promise((resolve) => {
    const footer = document.createElement('div')
    footer.className = 'flex gap-3'
    footer.innerHTML = `
      <button data-cancel class="btn btn-secondary">${escapeHtml(cancelLabel)}</button>
      <button data-ok class="btn ${danger ? 'btn-danger' : 'btn-primary'}">${escapeHtml(confirmLabel)}</button>`

    const body = `
      <div class="flex gap-3">
        <div class="flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${
          danger ? 'bg-red-100 text-red-600' : 'bg-brand-100 text-brand-600'
        }">
          <i data-lucide="alert-triangle" class="h-5 w-5"></i>
        </div>
        <p class="pt-1 text-sm text-slate-600">${escapeHtml(message)}</p>
      </div>`

    const modal = openModal({ title, body, footer, size: 'sm', onClose: () => resolve(false) })
    let settled = false
    const done = (val) => {
      if (settled) return
      settled = true
      modal.close()
      resolve(val)
    }
    footer.querySelector('[data-cancel]').addEventListener('click', () => done(false))
    footer.querySelector('[data-ok]').addEventListener('click', () => done(true))
  })
}

/* -------------------------- ESTADOS DE TELA -------------------------- */

export function loadingState(label = 'Carregando…') {
  return `
    <div class="flex flex-col items-center justify-center gap-3 py-16 text-slate-500">
      <span class="spinner h-8 w-8 text-brand-600"></span>
      <p class="text-sm">${escapeHtml(label)}</p>
    </div>`
}

export function emptyState({ title, description = '', icon = 'inbox' }) {
  return `
    <div class="flex flex-col items-center justify-center gap-3 px-6 py-16 text-center">
      <div class="flex h-14 w-14 items-center justify-center rounded-full bg-slate-100 text-slate-400">
        <i data-lucide="${icon}" class="h-7 w-7"></i>
      </div>
      <div>
        <p class="font-semibold text-slate-700">${escapeHtml(title)}</p>
        ${description ? `<p class="mt-1 text-sm text-slate-500">${escapeHtml(description)}</p>` : ''}
      </div>
    </div>`
}

/** Atalho para mensagens de erro vindas do Supabase. */
export function errMessage(err, fallback = 'Ocorreu um erro.') {
  if (!err) return fallback
  if (typeof err === 'string') return err
  return err.message || fallback
}
