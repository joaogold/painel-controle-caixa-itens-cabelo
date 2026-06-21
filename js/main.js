import { loadSession, getSession, onAuthChange } from './auth.js'
import { refreshIcons } from './ui.js'

const routes = {
  '#/login': { loader: () => import('./pages/login.js'), public: true },
  '#/': { loader: () => import('./pages/dashboard.js') },
  '#/produtos': { loader: () => import('./pages/produtos.js') },
  '#/vendas/nova': { loader: () => import('./pages/novaVenda.js') },
  '#/movimentacoes': { loader: () => import('./pages/movimentacoes.js') },
  '#/repasses': { loader: () => import('./pages/repasses.js') },
  '#/relatorios': { loader: () => import('./pages/relatorios.js') },
  '#/configuracoes': { loader: () => import('./pages/configuracoes.js') },
}

function currentPath() {
  const h = window.location.hash || '#/'
  return h.split('?')[0]
}

let rendering = false

async function handleRoute() {
  if (rendering) return
  const path = currentPath()
  const session = getSession()
  const route = routes[path]

  if (!route) {
    window.location.hash = '#/'
    return
  }
  if (route.public && session) {
    window.location.hash = '#/'
    return
  }
  if (!route.public && !session) {
    window.location.hash = '#/login'
    return
  }

  rendering = true
  try {
    const mod = await route.loader()
    await mod.render()
    refreshIcons()
  } catch (err) {
    console.error('Erro ao renderizar a rota', err)
    document.getElementById('app').innerHTML = `
      <div class="flex h-screen items-center justify-center p-6 text-center text-slate-600">
        <div>
          <p class="text-lg font-semibold">Erro ao carregar a tela</p>
          <p class="mt-1 text-sm">${(err && err.message) || err}</p>
        </div>
      </div>`
  } finally {
    rendering = false
  }
}

async function boot() {
  await loadSession()

  onAuthChange((session) => {
    const path = currentPath()
    const route = routes[path]
    if (!session && route && !route.public) {
      if (path !== '#/login') window.location.hash = '#/login'
      else handleRoute()
    } else if (session && route && route.public) {
      window.location.hash = '#/'
    } else {
      handleRoute()
    }
  })

  window.addEventListener('hashchange', handleRoute)

  if (!window.location.hash) {
    window.location.hash = getSession() ? '#/' : '#/login'
  } else {
    handleRoute()
  }
}

boot()
