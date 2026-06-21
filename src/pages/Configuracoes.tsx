import { useState, type FormEvent } from 'react'
import { User, KeyRound, LogOut, Info, ShieldCheck } from 'lucide-react'
import { Layout } from '@/components/Layout'
import { Spinner } from '@/components/ui/Spinner'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { useToast } from '@/components/ui/Toast'
import { useAuth } from '@/context/AuthContext'
import { supabase } from '@/lib/supabase'

export function Configuracoes() {
  const toast = useToast()
  const { user, signOut } = useAuth()
  const [senha, setSenha] = useState('')
  const [senha2, setSenha2] = useState('')
  const [saving, setSaving] = useState(false)
  const [confirmSair, setConfirmSair] = useState(false)

  async function trocarSenha(e: FormEvent) {
    e.preventDefault()
    if (senha.length < 6) {
      toast.error('A senha deve ter ao menos 6 caracteres.')
      return
    }
    if (senha !== senha2) {
      toast.error('As senhas não conferem.')
      return
    }
    setSaving(true)
    const { error } = await supabase.auth.updateUser({ password: senha })
    setSaving(false)
    if (error) toast.error(error.message)
    else {
      toast.success('Senha atualizada com sucesso!')
      setSenha('')
      setSenha2('')
    }
  }

  return (
    <Layout title="Configurações" subtitle="Conta, segurança e informações do sistema">
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        {/* Conta */}
        <div className="card p-5">
          <h3 className="mb-4 flex items-center gap-2 font-semibold text-slate-800">
            <User className="h-5 w-5 text-brand-600" /> Conta
          </h3>
          <div className="space-y-3 text-sm">
            <div className="flex justify-between border-b border-slate-100 pb-2">
              <span className="text-slate-500">E-mail</span>
              <span className="font-medium text-slate-700">{user?.email}</span>
            </div>
            <div className="flex justify-between border-b border-slate-100 pb-2">
              <span className="text-slate-500">ID do usuário</span>
              <span className="truncate font-mono text-xs text-slate-500">{user?.id}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Último acesso</span>
              <span className="font-medium text-slate-700">
                {user?.last_sign_in_at ? new Date(user.last_sign_in_at).toLocaleString('pt-BR') : '—'}
              </span>
            </div>
          </div>
          <button className="btn-secondary mt-5 w-full" onClick={() => setConfirmSair(true)}>
            <LogOut className="h-4 w-4" /> Sair da conta
          </button>
        </div>

        {/* Trocar senha */}
        <div className="card p-5">
          <h3 className="mb-4 flex items-center gap-2 font-semibold text-slate-800">
            <KeyRound className="h-5 w-5 text-brand-600" /> Alterar senha
          </h3>
          <form onSubmit={trocarSenha} className="space-y-4">
            <div>
              <label className="label">Nova senha</label>
              <input
                type="password"
                className="input"
                value={senha}
                onChange={(e) => setSenha(e.target.value)}
                placeholder="Mínimo 6 caracteres"
                autoComplete="new-password"
              />
            </div>
            <div>
              <label className="label">Confirmar nova senha</label>
              <input
                type="password"
                className="input"
                value={senha2}
                onChange={(e) => setSenha2(e.target.value)}
                autoComplete="new-password"
              />
            </div>
            <button type="submit" className="btn-primary w-full" disabled={saving}>
              {saving && <Spinner className="h-4 w-4" />}
              Atualizar senha
            </button>
          </form>
        </div>

        {/* Novos usuários */}
        <div className="card p-5">
          <h3 className="mb-3 flex items-center gap-2 font-semibold text-slate-800">
            <ShieldCheck className="h-5 w-5 text-brand-600" /> Usuários
          </h3>
          <p className="text-sm text-slate-600">
            O sistema suporta múltiplos usuários. Por segurança, novos usuários são criados no painel do
            Supabase em <strong>Authentication &gt; Users &gt; Add user</strong>. Cada usuário enxerga
            apenas os próprios dados (RLS por <code>user_id</code>).
          </p>
        </div>

        {/* Sobre */}
        <div className="card p-5">
          <h3 className="mb-3 flex items-center gap-2 font-semibold text-slate-800">
            <Info className="h-5 w-5 text-brand-600" /> Sobre as regras financeiras
          </h3>
          <ul className="space-y-1 text-sm text-slate-600">
            <li>• Faturamento = quantidade × preço de venda</li>
            <li>• Custo = quantidade × custo unitário</li>
            <li>• Lucro bruto = faturamento − custo − desconto</li>
            <li>• Repasse = lucro bruto × 10% (apenas se positivo)</li>
            <li>• Lucro líquido = lucro bruto − repasse</li>
          </ul>
        </div>
      </div>

      <ConfirmDialog
        open={confirmSair}
        title="Sair da conta"
        message="Deseja realmente encerrar a sessão?"
        confirmLabel="Sair"
        danger={false}
        onConfirm={() => signOut()}
        onCancel={() => setConfirmSair(false)}
      />
    </Layout>
  )
}
