import { getUser, signOut } from './auth.js'
import { refreshIcons, escapeHtml } from './ui.js'

const NAV = [
  { path: '#/', label: 'Dashboard', icon: 'layout-dashboard' },
  { path: '#/produtos', label: 'Produtos', icon: 'package' },
  { path: '#/vendas/nova', label: 'Nova venda', icon: 'shopping-cart' },
  { path: '#/movimentacoes', label: 'Movimentações', icon: 'arrow-left-right' },
  { path: '#/repasses', label: 'Repasses', icon: 'hand-coins' },
  { path: '#/relatorios', label: 'Relatórios', icon: 'file-bar-chart' },
  { path: '#/configuracoes', label: 'Configurações', icon: 'settings' },
]

function navHTML(activePath) {
  return NAV.map((item) => {
    const active = item.path === activePath
    return `
      <a href="${item.path}" data-nav class="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
        active ? 'bg-brand-600 text-white' : 'text-slate-300 hover:bg-slate-800 hover:text-white'
      }">
        <i data-lucide="${item.icon}" class="h-5 w-5"></i>
        ${item.label}
      </a>`
  }).join('')
}

function sidebarHTML(activePath) {
  const email = getUser()?.email ?? ''
  return `
    <aside class="flex h-full w-64 flex-col bg-slate-900 text-slate-300">
      <div class="flex items-center gap-2 px-5 py-5">
        <div class="flex h-9 w-9 items-center justify-center rounded-lg bg-brand-600 text-white">
          <i data-lucide="scissors" class="h-5 w-5"></i>
        </div>
        <div class="leading-tight">
          <p class="text-sm font-bold text-white">Caixa &amp; Estoque</p>
          <p class="text-xs text-slate-400">Itens de cabelo</p>
        </div>
      </div>
      <nav class="flex-1 space-y-1 px-3 py-2">${navHTML(activePath)}</nav>
      <div class="border-t border-slate-800 px-3 py-3">
        <p class="truncate px-3 pb-2 text-xs text-slate-500" title="${escapeHtml(email)}">${escapeHtml(email)}</p>
        <button data-logout class="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-slate-300 hover:bg-slate-800 hover:text-white">
          <i data-lucide="log-out" class="h-5 w-5"></i> Sair
        </button>
      </div>
    </aside>`
}

/**
 * Monta o layout (sidebar + cabeçalho) em #app e devolve o elemento de conteúdo.
 */
export function mountLayout({ activePath, title, subtitle = '', actionsHTML = '' }) {
  const app = document.getElementById('app')
  app.innerHTML = `
    <div class="flex h-screen overflow-hidden bg-slate-100">
      <div class="hidden lg:block">${sidebarHTML(activePath)}</div>

      <div id="mobile-drawer" class="fixed inset-0 z-40 hidden lg:hidden">
        <div data-drawer-overlay class="absolute inset-0 bg-slate-900/50"></div>
        <div class="absolute left-0 top-0 h-full">${sidebarHTML(activePath)}</div>
      </div>

      <div class="flex min-w-0 flex-1 flex-col">
        <header class="flex items-center gap-3 border-b border-slate-200 bg-white px-4 py-3 lg:px-6">
          <button data-menu class="rounded-lg p-2 text-slate-500 hover:bg-slate-100 lg:hidden" aria-label="Menu">
            <i data-lucide="menu" class="h-5 w-5"></i>
          </button>
          <div class="min-w-0 flex-1">
            <h1 class="truncate text-lg font-bold text-slate-800 lg:text-xl">${escapeHtml(title)}</h1>
            ${subtitle ? `<p class="truncate text-sm text-slate-500">${escapeHtml(subtitle)}</p>` : ''}
          </div>
          <div class="flex shrink-0 items-center gap-2">${actionsHTML}</div>
        </header>
        <main id="content" class="flex-1 overflow-y-auto p-4 lg:p-6"></main>
      </div>
    </div>`

  // Drawer mobile
  const drawer = app.querySelector('#mobile-drawer')
  app.querySelector('[data-menu]')?.addEventListener('click', () => drawer.classList.toggle('hidden'))
  drawer.querySelector('[data-drawer-overlay]')?.addEventListener('click', () => drawer.classList.add('hidden'))

  // Logout (pode haver dois botões: desktop e drawer)
  app.querySelectorAll('[data-logout]').forEach((b) =>
    b.addEventListener('click', async () => {
      await signOut()
      // o onAuthChange no main.js redireciona para o login
    }),
  )

  refreshIcons()
  return app.querySelector('#content')
}
