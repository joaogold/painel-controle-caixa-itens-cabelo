import { useEffect, useMemo, useState, type FormEvent } from 'react'
import {
  HandCoins,
  Clock,
  CheckCircle2,
  Plus,
  Eye,
  CircleDollarSign,
} from 'lucide-react'
import { Layout } from '@/components/Layout'
import { StatCard } from '@/components/ui/StatCard'
import { DataTable, type TableColumn } from '@/components/ui/DataTable'
import { Modal } from '@/components/ui/Modal'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { LoadingState, Spinner } from '@/components/ui/Spinner'
import { EmptyState } from '@/components/ui/EmptyState'
import { useToast } from '@/components/ui/Toast'
import { supabase } from '@/lib/supabase'
import { formatBRL, formatDate, formatPercent, toISODate } from '@/lib/format'
import { startOfMonth } from 'date-fns'
import { labelFormaPagamento } from '@/lib/labels'
import type { Repasse, Venda } from '@/types'

export function Repasses() {
  const toast = useToast()
  const [repasses, setRepasses] = useState<Repasse[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  const [dataInicial, setDataInicial] = useState(toISODate(startOfMonth(new Date())))
  const [dataFinal, setDataFinal] = useState(toISODate(new Date()))
  const [percentual, setPercentual] = useState('10')
  const [observacao, setObservacao] = useState('')

  const [verRepasse, setVerRepasse] = useState<Repasse | null>(null)
  const [vendasIncluidas, setVendasIncluidas] = useState<Venda[]>([])
  const [loadingVendas, setLoadingVendas] = useState(false)

  const [pagar, setPagar] = useState<Repasse | null>(null)
  const [pagando, setPagando] = useState(false)

  async function load() {
    setLoading(true)
    const { data, error } = await supabase
      .from('repasses')
      .select('*')
      .order('created_at', { ascending: false })
    if (error) toast.error(error.message)
    else setRepasses((data ?? []) as Repasse[])
    setLoading(false)
  }

  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const totais = useMemo(() => {
    const pendente = repasses.filter((r) => r.status === 'pendente').reduce((s, r) => s + r.valor_repasse, 0)
    const pago = repasses.filter((r) => r.status === 'pago').reduce((s, r) => s + r.valor_repasse, 0)
    return { pendente, pago, total: pendente + pago }
  }, [repasses])

  async function gerar(e: FormEvent) {
    e.preventDefault()
    if (!dataInicial || !dataFinal) {
      toast.error('Informe data inicial e final.')
      return
    }
    if (dataFinal < dataInicial) {
      toast.error('Data final menor que a inicial.')
      return
    }
    setSaving(true)
    try {
      const { error } = await supabase.rpc('gerar_repasse', {
        p_data_inicial: dataInicial,
        p_data_final: dataFinal,
        p_percentual: Number(percentual) || 10,
        p_observacao: observacao.trim() || null,
      })
      if (error) throw error
      toast.success('Repasse gerado a partir das vendas do período.')
      setObservacao('')
      await load()
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Erro ao gerar repasse.'
      toast.error(
        /Nenhuma venda pendente/i.test(msg)
          ? 'Nenhuma venda pendente de repasse nesse período.'
          : msg,
      )
    } finally {
      setSaving(false)
    }
  }

  async function abrirVendas(r: Repasse) {
    setVerRepasse(r)
    setLoadingVendas(true)
    const { data, error } = await supabase
      .from('vendas_repasses')
      .select('vendas(*)')
      .eq('repasse_id', r.id)
    if (error) toast.error(error.message)
    else {
      const linhas = (data ?? []) as unknown as { vendas: Venda | null }[]
      setVendasIncluidas(linhas.map((x) => x.vendas).filter((v): v is Venda => v !== null))
    }
    setLoadingVendas(false)
  }

  async function confirmarPagamento() {
    if (!pagar) return
    setPagando(true)
    const { error } = await supabase.rpc('marcar_repasse_pago', {
      p_repasse_id: pagar.id,
      p_data_pagamento: new Date().toISOString(),
    })
    setPagando(false)
    if (error) toast.error(error.message)
    else {
      toast.success('Repasse marcado como pago.')
      setPagar(null)
      load()
    }
  }

  const columns: TableColumn<Repasse>[] = [
    {
      key: 'periodo',
      header: 'Período',
      searchText: (r) => `${formatDate(r.data_inicial)} ${formatDate(r.data_final)}`,
      render: (r) => (
        <span className="whitespace-nowrap text-slate-700">
          {formatDate(r.data_inicial)} – {formatDate(r.data_final)}
        </span>
      ),
    },
    { key: 'lucro', header: 'Lucro bruto', align: 'right', render: (r) => formatBRL(r.lucro_bruto_periodo) },
    { key: 'pct', header: '%', align: 'right', render: (r) => formatPercent(r.percentual) },
    {
      key: 'valor',
      header: 'Valor repasse',
      align: 'right',
      render: (r) => <span className="font-semibold text-brand-600">{formatBRL(r.valor_repasse)}</span>,
    },
    {
      key: 'status',
      header: 'Status',
      align: 'center',
      searchText: (r) => r.status,
      render: (r) => (
        <span
          className={`badge ${r.status === 'pago' ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'}`}
        >
          {r.status === 'pago' ? 'Pago' : 'Pendente'}
        </span>
      ),
    },
    { key: 'pagamento', header: 'Pago em', render: (r) => formatDate(r.data_pagamento) },
    {
      key: 'acoes',
      header: 'Ações',
      align: 'right',
      render: (r) => (
        <div className="flex justify-end gap-1">
          <button className="rounded-lg p-2 text-slate-500 hover:bg-slate-100" title="Ver vendas" onClick={() => abrirVendas(r)}>
            <Eye className="h-4 w-4" />
          </button>
          {r.status === 'pendente' && (
            <button
              className="rounded-lg p-2 text-green-600 hover:bg-green-50"
              title="Marcar como pago"
              onClick={() => setPagar(r)}
            >
              <CheckCircle2 className="h-4 w-4" />
            </button>
          )}
        </div>
      ),
    },
  ]

  return (
    <Layout title="Repasses" subtitle="Controle dos 10% destinados ao dono do ambiente">
      <div className="mb-5 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard label="Total pendente" value={formatBRL(totais.pendente)} icon={<Clock className="h-5 w-5" />} tone="warning" />
        <StatCard label="Total pago" value={formatBRL(totais.pago)} icon={<CheckCircle2 className="h-5 w-5" />} tone="positive" />
        <StatCard label="Total geral" value={formatBRL(totais.total)} icon={<CircleDollarSign className="h-5 w-5" />} tone="brand" />
      </div>

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-3">
        <div className="xl:col-span-1">
          <form onSubmit={gerar} className="card sticky top-4 space-y-4 p-4">
            <h3 className="flex items-center gap-2 font-semibold text-slate-800">
              <HandCoins className="h-5 w-5 text-brand-600" /> Gerar repasse
            </h3>
            <p className="text-xs text-slate-500">
              Inclui as vendas do período que ainda não fazem parte de outro repasse.
            </p>
            <div>
              <label className="label">Data inicial *</label>
              <input type="date" className="input" value={dataInicial} onChange={(e) => setDataInicial(e.target.value)} required />
            </div>
            <div>
              <label className="label">Data final *</label>
              <input type="date" className="input" value={dataFinal} onChange={(e) => setDataFinal(e.target.value)} required />
            </div>
            <div>
              <label className="label">Percentual (%)</label>
              <input type="number" min="0" max="100" step="0.01" className="input" value={percentual} onChange={(e) => setPercentual(e.target.value)} />
            </div>
            <div>
              <label className="label">Observação</label>
              <textarea className="input min-h-[60px]" value={observacao} onChange={(e) => setObservacao(e.target.value)} />
            </div>
            <button type="submit" className="btn-primary w-full" disabled={saving}>
              {saving ? <Spinner className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
              Gerar repasse
            </button>
          </form>
        </div>

        <div className="xl:col-span-2">
          {loading ? (
            <LoadingState label="Carregando repasses…" />
          ) : (
            <DataTable
              rows={repasses}
              columns={columns}
              rowKey={(r) => r.id}
              searchPlaceholder="Buscar por período ou status…"
              emptyTitle="Nenhum repasse gerado"
              emptyDescription="Gere o primeiro repasse a partir das vendas de um período."
            />
          )}
        </div>
      </div>

      {/* Modal vendas incluídas */}
      <Modal
        open={!!verRepasse}
        onClose={() => setVerRepasse(null)}
        title="Vendas incluídas no repasse"
        size="xl"
      >
        {verRepasse && (
          <div className="mb-3 grid grid-cols-2 gap-3 rounded-lg bg-slate-50 p-3 text-sm sm:grid-cols-4">
            <Info label="Período" value={`${formatDate(verRepasse.data_inicial)} – ${formatDate(verRepasse.data_final)}`} />
            <Info label="Lucro bruto" value={formatBRL(verRepasse.lucro_bruto_periodo)} />
            <Info label="Percentual" value={formatPercent(verRepasse.percentual)} />
            <Info label="Valor" value={formatBRL(verRepasse.valor_repasse)} />
          </div>
        )}
        {loadingVendas ? (
          <LoadingState />
        ) : vendasIncluidas.length === 0 ? (
          <EmptyState title="Nenhuma venda vinculada" />
        ) : (
          <div className="max-h-[50vh] overflow-auto">
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-white">
                <tr className="border-b border-slate-200 text-xs uppercase text-slate-500">
                  <th className="px-3 py-2 text-left font-semibold">Data</th>
                  <th className="px-3 py-2 text-left font-semibold">Cliente</th>
                  <th className="px-3 py-2 text-left font-semibold">Pagamento</th>
                  <th className="px-3 py-2 text-right font-semibold">Faturamento</th>
                  <th className="px-3 py-2 text-right font-semibold">Lucro bruto</th>
                  <th className="px-3 py-2 text-right font-semibold">Repasse</th>
                </tr>
              </thead>
              <tbody>
                {vendasIncluidas.map((v) => (
                  <tr key={v.id} className="border-b border-slate-100 last:border-0">
                    <td className="px-3 py-2 text-slate-600">{formatDate(v.data_venda)}</td>
                    <td className="px-3 py-2 text-slate-600">{v.nome_cliente ?? '—'}</td>
                    <td className="px-3 py-2 text-slate-600">{labelFormaPagamento(v.forma_pagamento)}</td>
                    <td className="px-3 py-2 text-right">{formatBRL(v.faturamento_total)}</td>
                    <td className="px-3 py-2 text-right">{formatBRL(v.lucro_bruto)}</td>
                    <td className="px-3 py-2 text-right font-semibold text-brand-600">{formatBRL(v.valor_repasse)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Modal>

      <ConfirmDialog
        open={!!pagar}
        title="Marcar repasse como pago"
        message={`Confirmar o pagamento de ${formatBRL(pagar?.valor_repasse ?? 0)}? Isso não altera o histórico das vendas.`}
        confirmLabel="Confirmar pagamento"
        danger={false}
        loading={pagando}
        onConfirm={confirmarPagamento}
        onCancel={() => setPagar(null)}
      />
    </Layout>
  )
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs text-slate-500">{label}</p>
      <p className="font-semibold text-slate-700">{value}</p>
    </div>
  )
}
