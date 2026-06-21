import { useEffect, useMemo, useState } from 'react'
import { FileSpreadsheet, FileText, FileDown, Table2 } from 'lucide-react'
import { Layout } from '@/components/Layout'
import { LoadingState } from '@/components/ui/Spinner'
import { EmptyState } from '@/components/ui/EmptyState'
import { PeriodFilter } from '@/components/PeriodFilter'
import { useToast } from '@/components/ui/Toast'
import { supabase } from '@/lib/supabase'
import { formatBRL, formatInt, formatDate, formatDateTime, formatPercent, toISODate } from '@/lib/format'
import { metricasProduto } from '@/lib/finance'
import { intervaloDoPreset, type PeriodoPreset } from '@/lib/filters'
import { labelFormaPagamento, labelTipoMov } from '@/lib/labels'
import { exportCSV, exportXLSX, exportPDF, type Column } from '@/lib/export'
import type { Produto, Venda, ItemVenda, MovimentacaoEstoque, Repasse } from '@/types'

type ReportId =
  | 'produtos'
  | 'estoque'
  | 'movimentacoes'
  | 'vendas'
  | 'mais_vendidos'
  | 'faturamento_periodo'
  | 'lucro_produto'
  | 'lucro_periodo'
  | 'pagamentos'
  | 'repasses_pagos'
  | 'repasses_pendentes'
  | 'estoque_baixo'

const REPORTS: { id: ReportId; label: string; usaPeriodo: boolean }[] = [
  { id: 'produtos', label: 'Produtos cadastrados', usaPeriodo: false },
  { id: 'estoque', label: 'Estoque atual', usaPeriodo: false },
  { id: 'estoque_baixo', label: 'Produtos abaixo do mínimo', usaPeriodo: false },
  { id: 'movimentacoes', label: 'Histórico de movimentações', usaPeriodo: true },
  { id: 'vendas', label: 'Histórico de vendas', usaPeriodo: true },
  { id: 'mais_vendidos', label: 'Produtos mais vendidos', usaPeriodo: true },
  { id: 'faturamento_periodo', label: 'Faturamento por período', usaPeriodo: true },
  { id: 'lucro_produto', label: 'Lucro por produto', usaPeriodo: true },
  { id: 'lucro_periodo', label: 'Lucro por período (dia)', usaPeriodo: true },
  { id: 'pagamentos', label: 'Formas de pagamento', usaPeriodo: true },
  { id: 'repasses_pagos', label: 'Repasses pagos', usaPeriodo: false },
  { id: 'repasses_pendentes', label: 'Repasses pendentes', usaPeriodo: false },
]

interface VendaComItens extends Venda {
  itens_venda: (ItemVenda & { produtos: { nome: string; categoria: string } | null })[]
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Row = Record<string, any>

export function Relatorios() {
  const toast = useToast()
  const [loading, setLoading] = useState(true)
  const [produtos, setProdutos] = useState<Produto[]>([])
  const [vendas, setVendas] = useState<VendaComItens[]>([])
  const [movs, setMovs] = useState<MovimentacaoEstoque[]>([])
  const [repasses, setRepasses] = useState<Repasse[]>([])

  const [report, setReport] = useState<ReportId>('vendas')
  const [preset, setPreset] = useState<PeriodoPreset>('mes')
  const [inicio, setInicio] = useState(toISODate(new Date()))
  const [fim, setFim] = useState(toISODate(new Date()))

  const intervalo = useMemo(() => intervaloDoPreset(preset, { inicio, fim }), [preset, inicio, fim])
  const usaPeriodo = REPORTS.find((r) => r.id === report)?.usaPeriodo ?? false

  useEffect(() => {
    let active = true
    async function load() {
      setLoading(true)
      try {
        const [p, v, m, r] = await Promise.all([
          supabase.from('produtos').select('*').order('nome'),
          supabase.from('vendas').select('*, itens_venda(*, produtos(nome, categoria))').order('data_venda', { ascending: false }),
          supabase.from('movimentacoes_estoque').select('*, produtos(nome, categoria)').order('created_at', { ascending: false }).limit(2000),
          supabase.from('repasses').select('*').order('created_at', { ascending: false }),
        ])
        if (p.error || v.error || m.error || r.error)
          throw p.error || v.error || m.error || r.error
        if (!active) return
        setProdutos((p.data ?? []) as Produto[])
        setVendas((v.data ?? []) as VendaComItens[])
        setMovs((m.data ?? []) as MovimentacaoEstoque[])
        setRepasses((r.data ?? []) as Repasse[])
      } catch (err) {
        if (active) toast.error(err instanceof Error ? err.message : 'Erro ao carregar dados.')
      } finally {
        if (active) setLoading(false)
      }
    }
    load()
    return () => {
      active = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const inRange = (iso: string) => {
    const t = new Date(iso).getTime()
    return t >= intervalo.inicio.getTime() && t <= intervalo.fim.getTime()
  }

  const { title, columns, rows } = useMemo<{
    title: string
    columns: Column<Row>[]
    rows: Row[]
  }>(() => {
    const label = REPORTS.find((r) => r.id === report)?.label ?? ''
    const vendasPeriodo = vendas.filter((v) => inRange(v.data_venda))
    const itensPeriodo = vendasPeriodo.flatMap((v) =>
      (v.itens_venda ?? []).map((it) => ({ ...it, _venda: v })),
    )

    switch (report) {
      case 'produtos':
        return {
          title: label,
          columns: [
            { header: 'Produto', accessor: (r) => r.nome },
            { header: 'Categoria', accessor: (r) => r.categoria },
            { header: 'Descrição', accessor: (r) => r.descricao ?? '' },
            { header: 'Custo', accessor: (r) => formatBRL(r.custo_unitario) },
            { header: 'Preço', accessor: (r) => formatBRL(r.preco_venda) },
            { header: 'Margem', accessor: (r) => formatPercent(metricasProduto(r as Produto).margem) },
            { header: 'Status', accessor: (r) => (r.ativo ? 'Ativo' : 'Inativo') },
            { header: 'Cadastro', accessor: (r) => formatDate(r.created_at) },
          ],
          rows: produtos,
        }

      case 'estoque':
        return {
          title: label,
          columns: [
            { header: 'Produto', accessor: (r) => r.nome },
            { header: 'Categoria', accessor: (r) => r.categoria },
            { header: 'Estoque', accessor: (r) => formatInt(r.quantidade_estoque) },
            { header: 'Mínimo', accessor: (r) => formatInt(r.estoque_minimo) },
            { header: 'Custo un.', accessor: (r) => formatBRL(r.custo_unitario) },
            { header: 'Investido', accessor: (r) => formatBRL(metricasProduto(r as Produto).investidoTotal) },
            { header: 'Potencial', accessor: (r) => formatBRL(metricasProduto(r as Produto).potencialVenda) },
          ],
          rows: produtos,
        }

      case 'estoque_baixo':
        return {
          title: label,
          columns: [
            { header: 'Produto', accessor: (r) => r.nome },
            { header: 'Categoria', accessor: (r) => r.categoria },
            { header: 'Estoque', accessor: (r) => formatInt(r.quantidade_estoque) },
            { header: 'Mínimo', accessor: (r) => formatInt(r.estoque_minimo) },
          ],
          rows: produtos.filter((p) => p.ativo && p.quantidade_estoque <= p.estoque_minimo),
        }

      case 'movimentacoes':
        return {
          title: label,
          columns: [
            { header: 'Data/Hora', accessor: (r) => formatDateTime(r.created_at) },
            { header: 'Produto', accessor: (r) => r.produtos?.nome ?? '' },
            { header: 'Tipo', accessor: (r) => labelTipoMov(r.tipo) },
            { header: 'Qtd.', accessor: (r) => formatInt(r.quantidade) },
            { header: 'Anterior', accessor: (r) => formatInt(r.estoque_anterior) },
            { header: 'Atual', accessor: (r) => formatInt(r.estoque_atual) },
            { header: 'Motivo', accessor: (r) => r.motivo ?? '' },
          ],
          rows: movs.filter((m) => inRange(m.created_at)),
        }

      case 'vendas':
        return {
          title: label,
          columns: [
            { header: 'Data', accessor: (r) => formatDateTime(r.data_venda) },
            { header: 'Cliente', accessor: (r) => r.nome_cliente ?? '' },
            { header: 'Pagamento', accessor: (r) => labelFormaPagamento(r.forma_pagamento) },
            { header: 'Itens', accessor: (r) => formatInt((r.itens_venda ?? []).length) },
            { header: 'Faturamento', accessor: (r) => formatBRL(r.faturamento_total) },
            { header: 'Custo', accessor: (r) => formatBRL(r.custo_total) },
            { header: 'Desconto', accessor: (r) => formatBRL(r.desconto_total) },
            { header: 'Lucro bruto', accessor: (r) => formatBRL(r.lucro_bruto) },
            { header: 'Repasse', accessor: (r) => formatBRL(r.valor_repasse) },
            { header: 'Lucro líquido', accessor: (r) => formatBRL(r.lucro_liquido) },
          ],
          rows: vendasPeriodo,
        }

      case 'mais_vendidos': {
        const map = new Map<string, { nome: string; qtd: number; faturamento: number }>()
        for (const it of itensPeriodo) {
          const nome = it.produtos?.nome ?? 'Produto'
          const cur = map.get(nome) ?? { nome, qtd: 0, faturamento: 0 }
          cur.qtd += it.quantidade
          cur.faturamento += it.faturamento
          map.set(nome, cur)
        }
        return {
          title: label,
          columns: [
            { header: 'Produto', accessor: (r) => r.nome },
            { header: 'Qtd. vendida', accessor: (r) => formatInt(r.qtd) },
            { header: 'Faturamento', accessor: (r) => formatBRL(r.faturamento) },
          ],
          rows: Array.from(map.values()).sort((a, b) => b.qtd - a.qtd),
        }
      }

      case 'lucro_produto': {
        const map = new Map<string, { nome: string; qtd: number; faturamento: number; custo: number; lucro: number }>()
        for (const it of itensPeriodo) {
          const nome = it.produtos?.nome ?? 'Produto'
          const cur = map.get(nome) ?? { nome, qtd: 0, faturamento: 0, custo: 0, lucro: 0 }
          cur.qtd += it.quantidade
          cur.faturamento += it.faturamento
          cur.custo += it.custo_total
          cur.lucro += it.lucro_bruto
          map.set(nome, cur)
        }
        return {
          title: label,
          columns: [
            { header: 'Produto', accessor: (r) => r.nome },
            { header: 'Qtd.', accessor: (r) => formatInt(r.qtd) },
            { header: 'Faturamento', accessor: (r) => formatBRL(r.faturamento) },
            { header: 'Custo', accessor: (r) => formatBRL(r.custo) },
            { header: 'Lucro bruto', accessor: (r) => formatBRL(r.lucro) },
          ],
          rows: Array.from(map.values()).sort((a, b) => b.lucro - a.lucro),
        }
      }

      case 'faturamento_periodo':
      case 'lucro_periodo': {
        const map = new Map<string, { dia: string; faturamento: number; custo: number; lucro: number; repasse: number; liquido: number }>()
        for (const v of vendasPeriodo) {
          const dia = v.data_venda.slice(0, 10)
          const cur = map.get(dia) ?? { dia, faturamento: 0, custo: 0, lucro: 0, repasse: 0, liquido: 0 }
          cur.faturamento += v.faturamento_total
          cur.custo += v.custo_total
          cur.lucro += v.lucro_bruto
          cur.repasse += v.valor_repasse
          cur.liquido += v.lucro_liquido
          map.set(dia, cur)
        }
        const rows = Array.from(map.values()).sort((a, b) => a.dia.localeCompare(b.dia))
        return {
          title: label,
          columns: [
            { header: 'Dia', accessor: (r) => formatDate(r.dia) },
            { header: 'Faturamento', accessor: (r) => formatBRL(r.faturamento) },
            { header: 'Custo', accessor: (r) => formatBRL(r.custo) },
            { header: 'Lucro bruto', accessor: (r) => formatBRL(r.lucro) },
            { header: 'Repasse', accessor: (r) => formatBRL(r.repasse) },
            { header: 'Lucro líquido', accessor: (r) => formatBRL(r.liquido) },
          ],
          rows,
        }
      }

      case 'pagamentos': {
        const map = new Map<string, { forma: string; qtd: number; total: number }>()
        for (const v of vendasPeriodo) {
          const cur = map.get(v.forma_pagamento) ?? { forma: v.forma_pagamento, qtd: 0, total: 0 }
          cur.qtd += 1
          cur.total += v.faturamento_total
          map.set(v.forma_pagamento, cur)
        }
        return {
          title: label,
          columns: [
            { header: 'Forma de pagamento', accessor: (r) => labelFormaPagamento(r.forma) },
            { header: 'Qtd. vendas', accessor: (r) => formatInt(r.qtd) },
            { header: 'Total faturado', accessor: (r) => formatBRL(r.total) },
          ],
          rows: Array.from(map.values()).sort((a, b) => b.total - a.total),
        }
      }

      case 'repasses_pagos':
      case 'repasses_pendentes': {
        const status = report === 'repasses_pagos' ? 'pago' : 'pendente'
        return {
          title: label,
          columns: [
            { header: 'Período', accessor: (r) => `${formatDate(r.data_inicial)} - ${formatDate(r.data_final)}` },
            { header: 'Lucro bruto', accessor: (r) => formatBRL(r.lucro_bruto_periodo) },
            { header: '%', accessor: (r) => formatPercent(r.percentual) },
            { header: 'Valor', accessor: (r) => formatBRL(r.valor_repasse) },
            { header: 'Status', accessor: (r) => (r.status === 'pago' ? 'Pago' : 'Pendente') },
            { header: 'Pago em', accessor: (r) => formatDate(r.data_pagamento) },
          ],
          rows: repasses.filter((r) => r.status === status),
        }
      }

      default:
        return { title: label, columns: [], rows: [] }
    }
  }, [report, produtos, vendas, movs, repasses, intervalo.inicio, intervalo.fim])

  const filename = report

  async function handleExport(fn: () => void | Promise<void>) {
    try {
      await fn()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Falha ao exportar o relatório.')
    }
  }

  return (
    <Layout title="Relatórios" subtitle="Consulte e exporte os dados do sistema">
      <div className="card mb-5 p-4">
        <div className="flex flex-wrap items-end gap-3">
          <div>
            <label className="label">Relatório</label>
            <select className="input min-w-[15rem]" value={report} onChange={(e) => setReport(e.target.value as ReportId)}>
              {REPORTS.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.label}
                </option>
              ))}
            </select>
          </div>
          {usaPeriodo && (
            <PeriodFilter preset={preset} onPreset={setPreset} inicio={inicio} fim={fim} onInicio={setInicio} onFim={setFim} />
          )}
          <div className="ml-auto flex flex-wrap gap-2">
            <button className="btn-secondary" disabled={rows.length === 0} onClick={() => handleExport(() => exportCSV(filename, rows, columns))}>
              <FileDown className="h-4 w-4" /> CSV
            </button>
            <button className="btn-secondary" disabled={rows.length === 0} onClick={() => handleExport(() => exportXLSX(filename, rows, columns))}>
              <FileSpreadsheet className="h-4 w-4" /> Excel
            </button>
            <button className="btn-secondary" disabled={rows.length === 0} onClick={() => handleExport(() => exportPDF(filename, title, rows, columns))}>
              <FileText className="h-4 w-4" /> PDF
            </button>
          </div>
        </div>
      </div>

      {loading ? (
        <LoadingState label="Carregando relatório…" />
      ) : (
        <div className="card overflow-hidden">
          <div className="flex items-center gap-2 border-b border-slate-200 px-4 py-3">
            <Table2 className="h-5 w-5 text-brand-600" />
            <h3 className="font-semibold text-slate-800">{title}</h3>
            <span className="badge ml-auto bg-slate-100 text-slate-600">{rows.length} registro(s)</span>
          </div>
          {rows.length === 0 ? (
            <EmptyState title="Nenhum dado para exibir" description="Ajuste o período ou registre dados no sistema." />
          ) : (
            <div className="max-h-[60vh] overflow-auto">
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-slate-50">
                  <tr className="border-b border-slate-200 text-xs uppercase text-slate-500">
                    {columns.map((c, i) => (
                      <th key={i} className="whitespace-nowrap px-4 py-2 text-left font-semibold">
                        {c.header}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row, ri) => (
                    <tr key={ri} className="border-b border-slate-100 last:border-0 hover:bg-slate-50">
                      {columns.map((c, ci) => (
                        <td key={ci} className="whitespace-nowrap px-4 py-2 text-slate-600">
                          {c.accessor(row)}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </Layout>
  )
}
