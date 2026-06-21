import { useEffect, useMemo, useState, type FormEvent } from 'react'
import {
  Plus,
  Pencil,
  Trash2,
  Power,
  ImageOff,
  Package,
  AlertTriangle,
} from 'lucide-react'
import { Layout } from '@/components/Layout'
import { DataTable, type TableColumn } from '@/components/ui/DataTable'
import { Modal } from '@/components/ui/Modal'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { LoadingState, Spinner } from '@/components/ui/Spinner'
import { useToast } from '@/components/ui/Toast'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/context/AuthContext'
import { formatBRL, formatInt, formatPercent } from '@/lib/format'
import { metricasProduto } from '@/lib/finance'
import { CATEGORIAS_SUGERIDAS } from '@/lib/labels'
import type { Produto } from '@/types'

interface FormState {
  nome: string
  categoria: string
  descricao: string
  quantidade_inicial: string
  estoque_minimo: string
  custo_unitario: string
  preco_venda: string
  ativo: boolean
}

const emptyForm: FormState = {
  nome: '',
  categoria: 'Geral',
  descricao: '',
  quantidade_inicial: '0',
  estoque_minimo: '0',
  custo_unitario: '0',
  preco_venda: '0',
  ativo: true,
}

export function Produtos() {
  const toast = useToast()
  const { user } = useAuth()
  const [produtos, setProdutos] = useState<Produto[]>([])
  const [loading, setLoading] = useState(true)
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<Produto | null>(null)
  const [form, setForm] = useState<FormState>(emptyForm)
  const [file, setFile] = useState<File | null>(null)
  const [saving, setSaving] = useState(false)
  const [toDelete, setToDelete] = useState<Produto | null>(null)
  const [deleting, setDeleting] = useState(false)

  async function load() {
    setLoading(true)
    const { data, error } = await supabase.from('produtos').select('*').order('nome')
    if (error) toast.error(error.message)
    else setProdutos((data ?? []) as Produto[])
    setLoading(false)
  }

  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function openCreate() {
    setEditing(null)
    setForm(emptyForm)
    setFile(null)
    setModalOpen(true)
  }

  function openEdit(p: Produto) {
    setEditing(p)
    setForm({
      nome: p.nome,
      categoria: p.categoria,
      descricao: p.descricao ?? '',
      quantidade_inicial: String(p.quantidade_estoque),
      estoque_minimo: String(p.estoque_minimo),
      custo_unitario: String(p.custo_unitario),
      preco_venda: String(p.preco_venda),
      ativo: p.ativo,
    })
    setFile(null)
    setModalOpen(true)
  }

  function num(v: string): number {
    const n = Number(String(v).replace(',', '.'))
    return Number.isFinite(n) ? n : 0
  }

  function validate(): string | null {
    if (!form.nome.trim()) return 'Informe o nome do produto.'
    if (num(form.custo_unitario) < 0) return 'Custo não pode ser negativo.'
    if (num(form.preco_venda) < 0) return 'Preço de venda não pode ser negativo.'
    if (num(form.estoque_minimo) < 0) return 'Estoque mínimo não pode ser negativo.'
    if (!editing && num(form.quantidade_inicial) < 0) return 'Quantidade inicial não pode ser negativa.'
    return null
  }

  async function uploadImagem(produtoId: string): Promise<string | null> {
    if (!file || !user) return null
    const ext = file.name.split('.').pop() ?? 'jpg'
    const path = `${user.id}/${produtoId}-${Date.now()}.${ext}`
    const { error } = await supabase.storage
      .from('produtos')
      .upload(path, file, { upsert: true, contentType: file.type })
    if (error) throw error
    const { data } = supabase.storage.from('produtos').getPublicUrl(path)
    return data.publicUrl
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    const err = validate()
    if (err) {
      toast.error(err)
      return
    }
    if (!user) return
    setSaving(true)
    try {
      if (editing) {
        // Atualiza dados do produto (estoque é controlado por movimentações).
        let imagem_url = editing.imagem_url
        if (file) imagem_url = await uploadImagem(editing.id)
        const { error } = await supabase
          .from('produtos')
          .update({
            nome: form.nome.trim(),
            categoria: form.categoria.trim() || 'Geral',
            descricao: form.descricao.trim() || null,
            estoque_minimo: Math.trunc(num(form.estoque_minimo)),
            custo_unitario: num(form.custo_unitario),
            preco_venda: num(form.preco_venda),
            ativo: form.ativo,
            imagem_url,
          })
          .eq('id', editing.id)
        if (error) throw error
        toast.success('Produto atualizado com sucesso!')
      } else {
        // Cria com estoque 0 e registra a entrada inicial (gera histórico).
        const { data: created, error } = await supabase
          .from('produtos')
          .insert({
            nome: form.nome.trim(),
            categoria: form.categoria.trim() || 'Geral',
            descricao: form.descricao.trim() || null,
            quantidade_estoque: 0,
            estoque_minimo: Math.trunc(num(form.estoque_minimo)),
            custo_unitario: num(form.custo_unitario),
            preco_venda: num(form.preco_venda),
            ativo: form.ativo,
            user_id: user.id,
          })
          .select()
          .single()
        if (error) throw error

        const inicial = Math.trunc(num(form.quantidade_inicial))
        if (inicial > 0) {
          const { error: movErr } = await supabase.rpc('registrar_movimentacao', {
            p_produto_id: created.id,
            p_tipo: 'entrada',
            p_quantidade: inicial,
            p_motivo: 'Estoque inicial (cadastro)',
            p_observacao: null,
          })
          if (movErr) throw movErr
        }
        if (file) {
          const imagem_url = await uploadImagem(created.id)
          if (imagem_url) {
            await supabase.from('produtos').update({ imagem_url }).eq('id', created.id)
          }
        }
        toast.success('Produto cadastrado com sucesso!')
      }
      setModalOpen(false)
      await load()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao salvar produto.')
    } finally {
      setSaving(false)
    }
  }

  async function toggleAtivo(p: Produto) {
    const { error } = await supabase.from('produtos').update({ ativo: !p.ativo }).eq('id', p.id)
    if (error) toast.error(error.message)
    else {
      toast.success(p.ativo ? 'Produto inativado.' : 'Produto ativado.')
      load()
    }
  }

  async function confirmDelete() {
    if (!toDelete) return
    setDeleting(true)
    const { error } = await supabase.from('produtos').delete().eq('id', toDelete.id)
    setDeleting(false)
    if (error) {
      toast.error(
        'Não foi possível excluir (o produto possui vendas/movimentações). Inative-o em vez de excluir.',
      )
    } else {
      toast.success('Produto excluído.')
      setToDelete(null)
      load()
    }
  }

  const previewMetrics = useMemo(
    () =>
      metricasProduto({
        quantidade_estoque: editing
          ? editing.quantidade_estoque
          : Math.trunc(num(form.quantidade_inicial)),
        custo_unitario: num(form.custo_unitario),
        preco_venda: num(form.preco_venda),
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [form.quantidade_inicial, form.custo_unitario, form.preco_venda, editing],
  )

  const columns: TableColumn<Produto>[] = [
    {
      key: 'nome',
      header: 'Produto',
      searchText: (p) => `${p.nome} ${p.categoria}`,
      render: (p) => (
        <div className="flex items-center gap-3">
          {p.imagem_url ? (
            <img src={p.imagem_url} alt={p.nome} className="h-10 w-10 rounded-lg object-cover" />
          ) : (
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-slate-100 text-slate-400">
              <ImageOff className="h-4 w-4" />
            </div>
          )}
          <div className="min-w-0">
            <p className="truncate font-medium text-slate-700">{p.nome}</p>
            <p className="truncate text-xs text-slate-400">{p.categoria}</p>
          </div>
        </div>
      ),
    },
    {
      key: 'estoque',
      header: 'Estoque',
      align: 'right',
      render: (p) => {
        const baixo = p.quantidade_estoque <= p.estoque_minimo
        return (
          <span
            className={`badge ${baixo ? 'bg-red-100 text-red-700' : 'bg-slate-100 text-slate-600'}`}
            title={baixo ? `Abaixo/no mínimo (${p.estoque_minimo})` : undefined}
          >
            {baixo && <AlertTriangle className="mr-1 h-3 w-3" />}
            {formatInt(p.quantidade_estoque)}
          </span>
        )
      },
    },
    { key: 'custo', header: 'Custo', align: 'right', render: (p) => formatBRL(p.custo_unitario) },
    { key: 'preco', header: 'Preço', align: 'right', render: (p) => formatBRL(p.preco_venda) },
    {
      key: 'margem',
      header: 'Margem',
      align: 'right',
      render: (p) => formatPercent(metricasProduto(p).margem),
    },
    {
      key: 'invest',
      header: 'Investido',
      align: 'right',
      render: (p) => formatBRL(metricasProduto(p).investidoTotal),
    },
    {
      key: 'status',
      header: 'Status',
      align: 'center',
      render: (p) => (
        <span className={`badge ${p.ativo ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-500'}`}>
          {p.ativo ? 'Ativo' : 'Inativo'}
        </span>
      ),
    },
    {
      key: 'acoes',
      header: 'Ações',
      align: 'right',
      render: (p) => (
        <div className="flex justify-end gap-1">
          <button className="rounded-lg p-2 text-slate-500 hover:bg-slate-100" title="Editar" onClick={() => openEdit(p)}>
            <Pencil className="h-4 w-4" />
          </button>
          <button
            className="rounded-lg p-2 text-slate-500 hover:bg-slate-100"
            title={p.ativo ? 'Inativar' : 'Ativar'}
            onClick={() => toggleAtivo(p)}
          >
            <Power className="h-4 w-4" />
          </button>
          <button className="rounded-lg p-2 text-red-500 hover:bg-red-50" title="Excluir" onClick={() => setToDelete(p)}>
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      ),
    },
  ]

  return (
    <Layout
      title="Produtos"
      subtitle={`${produtos.length} produto(s) cadastrado(s)`}
      actions={
        <button className="btn-primary" onClick={openCreate}>
          <Plus className="h-4 w-4" /> Novo produto
        </button>
      }
    >
      {loading ? (
        <LoadingState label="Carregando produtos…" />
      ) : (
        <DataTable
          rows={produtos}
          columns={columns}
          rowKey={(p) => p.id}
          searchPlaceholder="Buscar por nome ou categoria…"
          emptyTitle="Nenhum produto cadastrado"
          emptyDescription="Clique em “Novo produto” para começar."
        />
      )}

      {/* Modal de cadastro/edição */}
      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editing ? 'Editar produto' : 'Novo produto'}
        size="lg"
        footer={
          <>
            <button className="btn-secondary" onClick={() => setModalOpen(false)} disabled={saving}>
              Cancelar
            </button>
            <button type="button" className="btn-primary" onClick={handleSubmit} disabled={saving}>
              {saving && <Spinner className="h-4 w-4" />}
              {editing ? 'Salvar alterações' : 'Cadastrar'}
            </button>
          </>
        }
      >
        <form id="produto-form" onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <label className="label">Nome do produto *</label>
              <input className="input" value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} required />
            </div>
            <div>
              <label className="label">Categoria</label>
              <input
                className="input"
                list="categorias"
                value={form.categoria}
                onChange={(e) => setForm({ ...form, categoria: e.target.value })}
              />
              <datalist id="categorias">
                {CATEGORIAS_SUGERIDAS.map((c) => (
                  <option key={c} value={c} />
                ))}
              </datalist>
            </div>
            <div>
              <label className="label">Status</label>
              <select
                className="input"
                value={form.ativo ? 'ativo' : 'inativo'}
                onChange={(e) => setForm({ ...form, ativo: e.target.value === 'ativo' })}
              >
                <option value="ativo">Ativo</option>
                <option value="inativo">Inativo</option>
              </select>
            </div>
            <div className="sm:col-span-2">
              <label className="label">Descrição</label>
              <textarea
                className="input min-h-[70px]"
                value={form.descricao}
                onChange={(e) => setForm({ ...form, descricao: e.target.value })}
              />
            </div>
            <div>
              <label className="label">Custo de compra (un.) *</label>
              <input
                type="number"
                step="0.01"
                min="0"
                className="input"
                value={form.custo_unitario}
                onChange={(e) => setForm({ ...form, custo_unitario: e.target.value })}
              />
            </div>
            <div>
              <label className="label">Preço de venda (un.) *</label>
              <input
                type="number"
                step="0.01"
                min="0"
                className="input"
                value={form.preco_venda}
                onChange={(e) => setForm({ ...form, preco_venda: e.target.value })}
              />
            </div>
            {!editing && (
              <div>
                <label className="label">Quantidade inicial</label>
                <input
                  type="number"
                  step="1"
                  min="0"
                  className="input"
                  value={form.quantidade_inicial}
                  onChange={(e) => setForm({ ...form, quantidade_inicial: e.target.value })}
                />
              </div>
            )}
            <div>
              <label className="label">Estoque mínimo</label>
              <input
                type="number"
                step="1"
                min="0"
                className="input"
                value={form.estoque_minimo}
                onChange={(e) => setForm({ ...form, estoque_minimo: e.target.value })}
              />
            </div>
            {editing && (
              <div>
                <label className="label">Estoque atual</label>
                <input className="input bg-slate-50" value={formatInt(editing.quantidade_estoque)} disabled />
                <p className="mt-1 text-xs text-slate-400">Ajuste pelo módulo de Movimentações.</p>
              </div>
            )}
            <div className="sm:col-span-2">
              <label className="label">Foto do produto (opcional)</label>
              <input
                type="file"
                accept="image/*"
                className="input"
                onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              />
              {editing?.imagem_url && !file && (
                <div className="mt-2 flex items-center gap-2 text-xs text-slate-500">
                  <img src={editing.imagem_url} alt="" className="h-12 w-12 rounded object-cover" />
                  Imagem atual
                </div>
              )}
            </div>
          </div>

          {/* Cálculos automáticos */}
          <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
            <p className="mb-2 flex items-center gap-1 text-xs font-semibold uppercase text-slate-500">
              <Package className="h-3.5 w-3.5" /> Cálculos automáticos
            </p>
            <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm sm:grid-cols-3">
              <Calc label="Lucro / unidade" value={formatBRL(previewMetrics.lucroUnidade)} />
              <Calc label="Margem" value={formatPercent(previewMetrics.margem)} />
              <Calc label="Investido no estoque" value={formatBRL(previewMetrics.investidoTotal)} />
              <Calc label="Potencial de venda" value={formatBRL(previewMetrics.potencialVenda)} />
              <Calc label="Lucro potencial" value={formatBRL(previewMetrics.lucroPotencial)} />
            </div>
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        open={!!toDelete}
        title="Excluir produto"
        message={`Tem certeza que deseja excluir “${toDelete?.nome}”? Produtos com vendas não podem ser excluídos — nesse caso, inative-o.`}
        confirmLabel="Excluir"
        loading={deleting}
        onConfirm={confirmDelete}
        onCancel={() => setToDelete(null)}
      />
    </Layout>
  )
}

function Calc({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-2 sm:block">
      <span className="text-slate-500">{label}</span>
      <span className="font-semibold text-slate-700">{value}</span>
    </div>
  )
}
