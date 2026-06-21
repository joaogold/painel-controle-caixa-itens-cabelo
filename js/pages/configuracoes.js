import { supabase } from '../supabaseClient.js'
import { getUser, signOut } from '../auth.js'
import { mountLayout } from '../layout.js'
import { refreshIcons, confirmDialog, showSuccess, showError, errMessage, escapeHtml } from '../ui.js'

export async function render() {
  const content = mountLayout({ activePath: '#/configuracoes', title: 'Configurações', subtitle: 'Conta, segurança e informações do sistema' })
  const user = getUser()

  content.innerHTML = `
    <div class="grid grid-cols-1 gap-5 lg:grid-cols-2">
      <div class="card p-5">
        <h3 class="mb-4 flex items-center gap-2 font-semibold text-slate-800"><i data-lucide="user" class="h-5 w-5 text-brand-600"></i> Conta</h3>
        <div class="space-y-3 text-sm">
          <div class="flex justify-between border-b border-slate-100 pb-2"><span class="text-slate-500">E-mail</span><span class="font-medium text-slate-700">${escapeHtml(user?.email ?? '')}</span></div>
          <div class="flex justify-between border-b border-slate-100 pb-2"><span class="text-slate-500">ID do usuário</span><span class="truncate font-mono text-xs text-slate-500">${escapeHtml(user?.id ?? '')}</span></div>
          <div class="flex justify-between"><span class="text-slate-500">Último acesso</span><span class="font-medium text-slate-700">${user?.last_sign_in_at ? new Date(user.last_sign_in_at).toLocaleString('pt-BR') : '—'}</span></div>
        </div>
        <button id="sair" class="btn btn-secondary mt-5 w-full"><i data-lucide="log-out" class="h-4 w-4"></i> Sair da conta</button>
      </div>

      <div class="card p-5">
        <h3 class="mb-4 flex items-center gap-2 font-semibold text-slate-800"><i data-lucide="key-round" class="h-5 w-5 text-brand-600"></i> Alterar senha</h3>
        <form id="senha-form" class="space-y-4">
          <div><label class="label">Nova senha</label><input id="senha" type="password" class="input" placeholder="Mínimo 6 caracteres" autocomplete="new-password" /></div>
          <div><label class="label">Confirmar nova senha</label><input id="senha2" type="password" class="input" autocomplete="new-password" /></div>
          <button type="submit" id="btn-senha" class="btn btn-primary w-full">Atualizar senha</button>
        </form>
      </div>

      <div class="card p-5">
        <h3 class="mb-3 flex items-center gap-2 font-semibold text-slate-800"><i data-lucide="shield-check" class="h-5 w-5 text-brand-600"></i> Usuários</h3>
        <p class="text-sm text-slate-600">O sistema suporta múltiplos usuários. Por segurança, novos usuários são criados no painel do Supabase em <strong>Authentication &gt; Users &gt; Add user</strong>. Cada usuário enxerga apenas os próprios dados (RLS por <code>user_id</code>).</p>
      </div>

      <div class="card p-5">
        <h3 class="mb-3 flex items-center gap-2 font-semibold text-slate-800"><i data-lucide="info" class="h-5 w-5 text-brand-600"></i> Regras financeiras</h3>
        <ul class="space-y-1 text-sm text-slate-600">
          <li>• Faturamento = quantidade × preço de venda</li>
          <li>• Custo = quantidade × custo unitário</li>
          <li>• Lucro bruto = faturamento − custo − desconto</li>
          <li>• Repasse = lucro bruto × 10% (apenas se positivo)</li>
          <li>• Lucro líquido = lucro bruto − repasse</li>
        </ul>
      </div>
    </div>`

  refreshIcons()

  content.querySelector('#sair').addEventListener('click', async () => {
    const ok = await confirmDialog({ title: 'Sair da conta', message: 'Deseja realmente encerrar a sessão?', confirmLabel: 'Sair', danger: false })
    if (ok) await signOut()
  })

  content.querySelector('#senha-form').addEventListener('submit', async (e) => {
    e.preventDefault()
    const senha = content.querySelector('#senha').value
    const senha2 = content.querySelector('#senha2').value
    if (senha.length < 6) return showError('A senha deve ter ao menos 6 caracteres.')
    if (senha !== senha2) return showError('As senhas não conferem.')
    const btn = content.querySelector('#btn-senha')
    btn.disabled = true
    btn.innerHTML = '<span class="spinner h-4 w-4"></span> Atualizando…'
    const { error } = await supabase.auth.updateUser({ password: senha })
    btn.disabled = false
    btn.innerHTML = 'Atualizar senha'
    if (error) showError(errMessage(error))
    else {
      showSuccess('Senha atualizada com sucesso!')
      content.querySelector('#senha').value = ''
      content.querySelector('#senha2').value = ''
    }
  })
}
