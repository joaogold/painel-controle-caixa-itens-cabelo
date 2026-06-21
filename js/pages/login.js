import { signIn } from '../auth.js'
import { isConfigured } from '../supabaseClient.js'
import { refreshIcons, showSuccess, showError, errMessage } from '../ui.js'

export async function render() {
  const app = document.getElementById('app')
  app.innerHTML = `
    <div class="flex min-h-screen items-center justify-center bg-gradient-to-br from-brand-700 via-brand-600 to-slate-900 p-4">
      <div class="w-full max-w-md">
        <div class="mb-6 flex flex-col items-center text-white">
          <div class="mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-white/15 backdrop-blur">
            <i data-lucide="scissors" class="h-7 w-7"></i>
          </div>
          <h1 class="text-2xl font-bold">Caixa &amp; Estoque</h1>
          <p class="text-sm text-white/80">Controle de itens de cabelo</p>
        </div>

        <div class="card p-6">
          ${
            !isConfigured
              ? `<div class="mb-4 flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
                  <i data-lucide="alert-triangle" class="mt-0.5 h-4 w-4 shrink-0"></i>
                  <span>Supabase não configurado. Copie <code>config.example.js</code> para <code>config.js</code> e preencha a URL e a anon key.</span>
                </div>`
              : ''
          }
          <form id="login-form" class="space-y-4">
            <div>
              <label class="label" for="email">E-mail</label>
              <div class="relative">
                <i data-lucide="mail" class="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"></i>
                <input id="email" type="email" autocomplete="email" class="input pl-9" placeholder="voce@exemplo.com" required />
              </div>
            </div>
            <div>
              <label class="label" for="password">Senha</label>
              <div class="relative">
                <i data-lucide="lock" class="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"></i>
                <input id="password" type="password" autocomplete="current-password" class="input pl-9 pr-9" placeholder="••••••••" required />
                <button type="button" id="toggle-pass" class="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600" aria-label="Mostrar senha">
                  <i data-lucide="eye" class="h-4 w-4"></i>
                </button>
              </div>
            </div>
            <button type="submit" id="login-btn" class="btn btn-primary w-full">Entrar</button>
          </form>
        </div>
        <p class="mt-4 text-center text-xs text-white/70">
          Acesso restrito. Cadastre o usuário no Supabase &gt; Authentication.
        </p>
      </div>
    </div>`

  refreshIcons()

  const form = app.querySelector('#login-form')
  const emailEl = app.querySelector('#email')
  const passEl = app.querySelector('#password')
  const btn = app.querySelector('#login-btn')
  const toggle = app.querySelector('#toggle-pass')

  toggle.addEventListener('click', () => {
    const isPass = passEl.type === 'password'
    passEl.type = isPass ? 'text' : 'password'
    toggle.innerHTML = `<i data-lucide="${isPass ? 'eye-off' : 'eye'}" class="h-4 w-4"></i>`
    refreshIcons()
  })

  form.addEventListener('submit', async (e) => {
    e.preventDefault()
    const email = emailEl.value.trim()
    const password = passEl.value
    if (!email || !password) {
      showError('Informe e-mail e senha.')
      return
    }
    btn.disabled = true
    btn.innerHTML = '<span class="spinner h-4 w-4"></span> Entrando…'
    try {
      await signIn(email, password)
      showSuccess('Login realizado com sucesso!')
      // onAuthChange (main.js) redireciona para o dashboard
    } catch (err) {
      const msg = errMessage(err, 'Falha ao entrar.')
      showError(/invalid login credentials/i.test(msg) ? 'E-mail ou senha inválidos.' : msg)
      btn.disabled = false
      btn.innerHTML = 'Entrar'
    }
  })
}
