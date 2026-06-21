import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { ArrowDownCircle, ArrowUpCircle, RefreshCw, AlertTriangle, History } from 'lucide-react'
import { Layout } from '@/components/Layout'
import { DataTable, type TableColumn } from '@/components/ui/DataTable'
import { LoadingState, Spinner } from '@/components/ui/Spinner'
import { useToast } from '@/components/ui/Toast'
import { supabase } from '@/lib/supabase'
import { formatInt, formatDateTime } from '@/lib/format'
import {
  TIPOS_MOVIMENTACAO_MANUAL,
  labelTipoMov,
  sentidoTipoMov,
} from '@/lib/labels'
import type { Produto, MovimentacaoEstoque, TipoMovimentacao } from '@/types'

export function Movimentacoes() {
  const toast = useToast()
  const [produtos, setProdutos] = useState<Produto[]>([])
  const [movs, setMovs] = useState<MovimentacaoEstoque[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  const [produtoId, setProdutoId] = useState('')
  const [tipo, setTipo] = useState<TipoMovimentacao>('entrada')
  const [quantidade, setQuantidade] = useState('1')
  const [motivo, setMotivo] = useState('')
  const [observacao, setObservacao] = useState('')

  async function load() {
    setLoading(true)
    const [pRes, mRes] = await Promise.all([
      supabase.from('produtos').select('*').order('nome'),
      supabase
        .from('movimentacoes_estoque')
        .select('*, produtos(nome, categoria)')
        .order('created_at', { ascending: false })
        .limit(500),
    ])
    if (pRes.error) toast.error(pRes.error.message)
    else setProdutos((pRes.data ?? []) as Produto[])
    if (mRes.error) toast.error(mRes.error.message)
    else setMovs((mRes.data ?? []) as MovimentacaoEstoque[])
    setLoading(false)
  }

  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const produtoSel = useMemo(
    () => produtos.find((p) => p.id === produtoId),
    [produtos, produtoId],
  )

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (!produtoId) {
      toast.error('Selecione um produto.')
      return
    }
    const qtd = Math.trunc(Number(quantidade) || 0)
    if (tipo !== 'ajuste' && qtd <= 0) {
      toast.error('Informe uma quantidade maior que zero.')
      return
    }
    if (tipo === 'ajuste' && qtd < 0) {
      toast.error('A contagem do ajuste não pode ser negativa.')
      return
    }
    setSaving(true)
    try {
      const { error } = await supabase.rpc('registrar_movimentacao', {
        p_produto_id: produtoId,
        p_tipo: tipo,
        p_quantidade: qtd,
        p_motivo: motivo.trim() || null,
        p_observacao: observacao.trim() || null,
      })
      if (error) throw error
      toast.success('Movimentação registrada e estoque atualizado.')
      setQuantidade('1')
      setMotivo('')
      setObservacao('')
      await load()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao registrar movimentação.')
    } finally {
      setSaving(false)
    }
  }

  const estoqueBaixo = produtoSel && produtoSel.quantidade_estoque <= produtoSel.estoque_minimo

  const columns: TableColumn<MovimentacaoEstoque>[] = [
    {
      key: 'data',
      header: 'Data/Hora',
      searchText: (m) => formatDateTime(m.created_at),
      render: (m) => <span className="whitespace-nowrap text-slate-600">{formatDateTime(m.created_at)}</span>,
    },
    {
      key: 'produto',
      header: 'Produto',
      searchText: (m) => m.produtos?.nome ?? '',
      render: (m) => <span className="font-medium text-slate-700">{m.produtos?.nome ?? '—'}</span>,
    },
    {
      key: 'tipo',
      header: 'Tipo',
      searchText: (m) => labelTipoMov(m.tipo),
      render: (m) => {
        const s = sentidoTipoMov(m.tipo)
        const cls =
          s === 'entrada'
            ? 'bg-green-100 text-green-700'
            : s === 'saida'
            ? 'bg-red-100 text-red-700'
            : 'bg-slate-100 text-slate-600'
        return <span className={`badge ${cls}`}>{labelTipoMov(m.tipo)}</span>
      },
    },
    {
      key: 'qtd',
      header: 'Qtd.',
      align: 'right',
      render: (m) => {
        const s = sentidoTipoMov(m.tipo)
        const sign = s === 'entrada' ? '+' : s === 'saida' ? '−' : '±'
        return (
          <span className={s === 'entrada' ? 'text-green-600' : s === 'saida' ? 'text-red-600' : 'text-slate-600'}>
            {sign}
            {formatInt(m.quantidade)}
          </span>
        )
      },
    },
    {
      key: 'estoque',
      header: 'Estoque (ant. → atual)',
      align: 'center',
      render: (m) => (
        <span className="whitespace-nowrap text-slate-500">
          {formatInt(m.estoque_anterior)} → <strong className="text-slate-700">{formatInt(m.estoque_atual)}</strong>
        </span>
      ),
    },
    {
      key: 'motivo',
      header: 'Motivo / Obs.',
      searchText: (m) => `${m.motivo ?? ''} ${m.observacao ?? ''}`,
      render: (m) => (
        <div className="max-w-[16rem]">
          <p className="truncate text-slate-600">{m.motivo ?? '—'}</p>
          {m.observacao && <p className="truncate text-xs text-slate-400">{m.observacao}</p>}
        </div>
      ),
    },
  ]

  return (
    <Layout title="Movimentações de estoque" subtitle="Entradas, saídas, perdas, ajustes e histórico">
      <div className="grid grid-cols-1 gap-5 xl:grid-cols-3">
        {/* Formulário */}
        <div className="xl:col-span-1">
          <form onSubmit={handleSubmit} className="card sticky top-4 space-y-4 p-4">
            <h3 className="font-semibold text-slate-800">Nova movimentação</h3>

            <div>
              <label className="label">Produto *</label>
              <select className="input" value={produtoId} onChange={(e) => setProdutoId(e.target.value)} required>
                <option value="">Selecione…</option>
                {produtos.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.nome} (estoque {formatInt(p.quantidade_estoque)})
                  </option>
                ))}
              </select>
            </div>

            {produtoSel && (
              <div
                className={`flex items-center justify-between rounded-lg border p-3 text-sm ${
                  estoqueBaixo ? 'border-amber-200 bg-amber-50 text-amber-700' : 'border-slate-200 bg-slate-50 text-slate-600'
                }`}
              >
                <span>Estoque atual</span>
                <span className="flex items-center gap-1 font-semibold">
                  {estoqueBaixo && <AlertTriangle className="h-4 w-4" />}
                  {formatInt(produtoSel.quantidade_estoque)}
                </span>
              </div>
            )}

            <div>
              <label className="label">Tipo de movimentação *</label>
              <select className="input" value={tipo} onChange={(e) => setTipo(e.target.value as TipoMovimentacao)}>
                {TIPOS_MOVIMENTACAO_MANUAL.map((t) => (
                  <option key={t.value} value={t.value}>
                    {t.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="label">
                {tipo === 'ajuste' ? 'Nova contagem (estoque real)' : 'Quantidade'} *
              </label>
              <input
                type="number"
                min="0"
                step="1"
                className="input"
                value={quantidade}
                onChange={(e) => setQuantidade(e.target.value)}
                required
              />
              {tipo === 'ajuste' && (
                <p className="mt-1 text-xs text-slate-400">
                  O sistema calcula a diferença e ajusta o estoque para esse valor.
                </p>
              )}
            </div>

            <div>
              <label className="label">Motivo</label>
              <input className="input" value={motivo} onChange={(e) => setMotivo(e.target.value)} placeholder="Ex.: reposição, quebra…" />
            </div>
            <div>
              <label className="label">Observação</label>
              <textarea className="input min-h-[60px]" value={observacao} onChange={(e) => setObservacao(e.target.value)} />
            </div>

            <button type="submit" className="btn-primary w-full" disabled={saving}>
              {saving ? <Spinner className="h-4 w-4" /> : <RefreshCw className="h-4 w-4" />}
              Registrar movimentação
            </button>
            <p className="text-center text-xs text-slate-400">O histórico não pode ser excluído ou editado.</p>
          </form>
        </div>

        {/* Histórico */}
        <div className="xl:col-span-2">
          <div className="mb-3 flex items-center gap-2 text-slate-700">
            <History className="h-5 w-5 text-brand-600" />
            <h3 className="font-semibold">Histórico de movimentações</h3>
            <div className="ml-auto flex gap-3 text-xs text-slate-400">
              <span className="flex items-center gap-1">
                <ArrowUpCircle className="h-3.5 w-3.5 text-green-500" /> Entrada
              </span>
              <span className="flex items-center gap-1">
                <ArrowDownCircle className="h-3.5 w-3.5 text-red-500" /> Saída
              </span>
            </div>
          </div>
          {loading ? (
            <LoadingState label="Carregando movimentações…" />
          ) : (
            <DataTable
              rows={movs}
              columns={columns}
              rowKey={(m) => m.id}
              searchPlaceholder="Buscar por produto, tipo ou motivo…"
              pageSize={12}
              emptyTitle="Nenhuma movimentação registrada"
              emptyDescription="As movimentações de estoque aparecerão aqui."
            />
          )}
        </div>
      </div>
    </Layout>
  )
}
