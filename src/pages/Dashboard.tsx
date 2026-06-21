import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  Boxes,
  Package,
  Wallet,
  TrendingUp,
  DollarSign,
  Receipt,
  HandCoins,
  ShoppingBag,
  Trophy,
  AlertTriangle,
  PiggyBank,
  Clock,
} from 'lucide-react'
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { Layout } from '@/components/Layout'
import { StatCard } from '@/components/ui/StatCard'
import { LoadingState } from '@/components/ui/Spinner'
import { EmptyState } from '@/components/ui/EmptyState'
import { PeriodFilter } from '@/components/PeriodFilter'
import { supabase } from '@/lib/supabase'
import { useToast } from '@/components/ui/Toast'
import { formatBRL, formatInt, toISODate } from '@/lib/format'
import { intervaloDoPreset, type PeriodoPreset } from '@/lib/filters'
import { FORMAS_PAGAMENTO } from '@/lib/labels'
import type { Produto, Venda, ItemVenda, Repasse } from '@/types'

interface VendaComItens extends Venda {
  itens_venda: (ItemVenda & { produtos: { nome: string; categoria: string } | null })[]
}

export function Dashboard() {
  const toast = useToast()
  const [loading, setLoading] = useState(true)
  const [produtos, setProdutos] = useState<Produto[]>([])
  const [vendas, setVendas] = useState<VendaComItens[]>([])
  const [repasses, setRepasses] = useState<Repasse[]>([])

  const [preset, setPreset] = useState<PeriodoPreset>('mes')
  const [inicio, setInicio] = useState(toISODate(new Date()))
  const [fim, setFim] = useState(toISODate(new Date()))
  const [produtoId, setProdutoId] = useState('')
  const [categoria, setCategoria] = useState('')
  const [pagamento, setPagamento] = useState('')

  const intervalo = useMemo(
    () => intervaloDoPreset(preset, { inicio, fim }),
    [preset, inicio, fim],
  )

  useEffect(() => {
    let active = true
    async function load() {
      setLoading(true)
      try {
        const [pRes, vRes, rRes] = await Promise.all([
          supabase.from('produtos').select('*').order('nome'),
          supabase
            .from('vendas')
            .select('*, itens_venda(*, produtos(nome, categoria))')
            .gte('data_venda', intervalo.inicio.toISOString())
            .lte('data_venda', intervalo.fim.toISOString())
            .order('data_venda', { ascending: false }),
          supabase.from('repasses').select('*'),
        ])
        if (pRes.error) throw pRes.error
        if (vRes.error) throw vRes.error
        if (rRes.error) throw rRes.error
        if (!active) return
        setProdutos((pRes.data ?? []) as Produto[])
        setVendas((vRes.data ?? []) as VendaComItens[])
        setRepasses((rRes.data ?? []) as Repasse[])
      } catch (err) {
        if (active) toast.error(err instanceof Error ? err.message : 'Erro ao carregar o painel.')
      } finally {
        if (active) setLoading(false)
      }
    }
    load()
    return () => {
      active = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [intervalo.inicio, intervalo.fim])

  const categorias = useMemo(
    () => Array.from(new Set(produtos.map((p) => p.categoria))).sort(),
    [produtos],
  )

  // Indicadores de estoque (independentes do período).
  const estoque = useMemo(() => {
    const totalUnidades = produtos.reduce((s, p) => s + p.quantidade_estoque, 0)
    const investido = produtos.reduce((s, p) => s + p.quantidade_estoque * p.custo_unitario, 0)
    const potencial = produtos.reduce((s, p) => s + p.quantidade_estoque * p.preco_venda, 0)
    const baixos = produtos.filter((p) => p.ativo && p.quantidade_estoque <= p.estoque_minimo)
    return { totalUnidades, investido, potencial, baixos }
  }, [produtos])

  // Vendas filtradas + agregações.
  const fin = useMemo(() => {
    const vendasFiltradas = vendas.filter(
      (v) => !pagamento || v.forma_pagamento === pagamento,
    )
    const itens = vendasFiltradas.flatMap((v) =>
      (v.itens_venda ?? [])
        .filter((it) => !produtoId || it.produto_id === produtoId)
        .filter((it) => !categoria || it.produtos?.categoria === categoria)
        .map((it) => ({ ...it, venda_id: v.id })),
    )
    const vendaIds = new Set(itens.map((it) => it.venda_id))

    const faturamento = itens.reduce((s, it) => s + it.faturamento, 0)
    const custo = itens.reduce((s, it) => s + it.custo_total, 0)
    const lucroBruto = itens.reduce((s, it) => s + it.lucro_bruto, 0)
    const repasse = itens.reduce((s, it) => s + it.valor_repasse, 0)
    const lucroLiquido = itens.reduce((s, it) => s + it.lucro_liquido, 0)

    // Vendas por produto.
    const porProduto = new Map<string, number>()
    for (const it of itens) {
      const nome = it.produtos?.nome ?? 'Produto'
      porProduto.set(nome, (porProduto.get(nome) ?? 0) + it.quantidade)
    }
    const vendasPorProduto = Array.from(porProduto.entries())
      .map(([nome, qtd]) => ({ nome, qtd }))
      .sort((a, b) => b.qtd - a.qtd)

    const maisVendido = vendasPorProduto[0]?.nome ?? '—'

    return {
      faturamento,
      custo,
      lucroBruto,
      repasse,
      lucroLiquido,
      qtdVendas: vendaIds.size,
      maisVendido,
      vendasPorProduto,
    }
  }, [vendas, pagamento, produtoId, categoria])

  const repassesPendentes = useMemo(
    () => repasses.filter((r) => r.status === 'pendente').reduce((s, r) => s + r.valor_repasse, 0),
    [repasses],
  )

  const resultadoChart = [
    { nome: 'Faturamento', valor: fin.faturamento, cor: '#0ea5e9' },
    { nome: 'Custo', valor: fin.custo, cor: '#f59e0b' },
    { nome: 'Lucro bruto', valor: fin.lucroBruto, cor: '#10b981' },
    { nome: 'Repasse 10%', valor: fin.repasse, cor: '#db2777' },
    { nome: 'Lucro líquido', valor: fin.lucroLiquido, cor: '#6366f1' },
  ]

  return (
    <Layout title="Dashboard" subtitle="Visão geral do estoque, vendas e caixa">
      {/* Filtros */}
      <div className="card mb-5 p-4">
        <div className="flex flex-wrap items-end gap-3">
          <PeriodFilter
            preset={preset}
            onPreset={setPreset}
            inicio={inicio}
            fim={fim}
            onInicio={setInicio}
            onFim={setFim}
          />
          <div>
            <label className="label">Produto</label>
            <select className="input min-w-[10rem]" value={produtoId} onChange={(e) => setProdutoId(e.target.value)}>
              <option value="">Todos</option>
              {produtos.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.nome}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">Categoria</label>
            <select className="input min-w-[9rem]" value={categoria} onChange={(e) => setCategoria(e.target.value)}>
              <option value="">Todas</option>
              {categorias.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">Pagamento</label>
            <select className="input min-w-[9rem]" value={pagamento} onChange={(e) => setPagamento(e.target.value)}>
              <option value="">Todos</option>
              {FORMAS_PAGAMENTO.map((f) => (
                <option key={f.value} value={f.value}>
                  {f.label}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {loading ? (
        <LoadingState label="Carregando indicadores…" />
      ) : (
        <>
          {/* Cartões */}
          <div className="mb-5 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <StatCard label="Unidades em estoque" value={formatInt(estoque.totalUnidades)} icon={<Boxes className="h-5 w-5" />} tone="brand" />
            <StatCard label="Produtos cadastrados" value={formatInt(produtos.length)} icon={<Package className="h-5 w-5" />} />
            <StatCard label="Investido no estoque" value={formatBRL(estoque.investido)} icon={<Wallet className="h-5 w-5" />} tone="warning" />
            <StatCard label="Potencial de venda" value={formatBRL(estoque.potencial)} icon={<TrendingUp className="h-5 w-5" />} tone="positive" />

            <StatCard label="Faturamento" value={formatBRL(fin.faturamento)} icon={<DollarSign className="h-5 w-5" />} tone="positive" />
            <StatCard label="Custo dos produtos vendidos" value={formatBRL(fin.custo)} icon={<Receipt className="h-5 w-5" />} tone="warning" />
            <StatCard label="Lucro bruto" value={formatBRL(fin.lucroBruto)} icon={<TrendingUp className="h-5 w-5" />} tone={fin.lucroBruto >= 0 ? 'positive' : 'negative'} />
            <StatCard label="A repassar (10%)" value={formatBRL(fin.repasse)} icon={<HandCoins className="h-5 w-5" />} tone="brand" />

            <StatCard label="Lucro líquido" value={formatBRL(fin.lucroLiquido)} icon={<PiggyBank className="h-5 w-5" />} tone={fin.lucroLiquido >= 0 ? 'positive' : 'negative'} />
            <StatCard label="Vendas realizadas" value={formatInt(fin.qtdVendas)} icon={<ShoppingBag className="h-5 w-5" />} />
            <StatCard label="Produto mais vendido" value={fin.maisVendido} icon={<Trophy className="h-5 w-5" />} tone="brand" />
            <StatCard label="Repasses pendentes" value={formatBRL(repassesPendentes)} icon={<Clock className="h-5 w-5" />} tone="warning" hint="Lançamentos não pagos" />
          </div>

          {/* Gráficos */}
          <div className="mb-5 grid grid-cols-1 gap-4 lg:grid-cols-2">
            <div className="card p-4">
              <h3 className="mb-3 font-semibold text-slate-800">Vendas por produto</h3>
              {fin.vendasPorProduto.length === 0 ? (
                <EmptyState title="Sem vendas no período" description="Ajuste os filtros ou registre uma venda." />
              ) : (
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={fin.vendasPorProduto.slice(0, 12)} margin={{ left: -10 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                    <XAxis dataKey="nome" tick={{ fontSize: 11 }} interval={0} angle={-20} textAnchor="end" height={60} />
                    <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                    <Tooltip formatter={(value) => [formatInt(Number(value)), 'Qtd. vendida'] as [string, string]} />
                    <Bar dataKey="qtd" radius={[4, 4, 0, 0]} fill="#db2777" />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>

            <div className="card p-4">
              <h3 className="mb-3 font-semibold text-slate-800">Resultado financeiro</h3>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={resultadoChart} margin={{ left: 10 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis dataKey="nome" tick={{ fontSize: 11 }} interval={0} angle={-15} textAnchor="end" height={60} />
                  <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => formatBRL(Number(v)).replace('R$', '')} />
                  <Tooltip formatter={(value) => formatBRL(Number(value))} />
                  <Legend />
                  <Bar dataKey="valor" name="Valor (R$)" radius={[4, 4, 0, 0]}>
                    {resultadoChart.map((e) => (
                      <Cell key={e.nome} fill={e.cor} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Estoque baixo */}
          <div className="card p-4">
            <div className="mb-3 flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-amber-500" />
              <h3 className="font-semibold text-slate-800">Produtos com estoque baixo</h3>
              <span className="badge bg-amber-100 text-amber-700">{estoque.baixos.length}</span>
            </div>
            {estoque.baixos.length === 0 ? (
              <p className="py-6 text-center text-sm text-slate-500">
                Nenhum produto abaixo do estoque mínimo. 🎉
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-200 text-xs uppercase text-slate-500">
                      <th className="px-3 py-2 text-left font-semibold">Produto</th>
                      <th className="px-3 py-2 text-left font-semibold">Categoria</th>
                      <th className="px-3 py-2 text-right font-semibold">Em estoque</th>
                      <th className="px-3 py-2 text-right font-semibold">Mínimo</th>
                    </tr>
                  </thead>
                  <tbody>
                    {estoque.baixos.map((p) => (
                      <tr key={p.id} className="border-b border-slate-100 last:border-0">
                        <td className="px-3 py-2 font-medium text-slate-700">{p.nome}</td>
                        <td className="px-3 py-2 text-slate-500">{p.categoria}</td>
                        <td className="px-3 py-2 text-right">
                          <span className="badge bg-red-100 text-red-700">{formatInt(p.quantidade_estoque)}</span>
                        </td>
                        <td className="px-3 py-2 text-right text-slate-500">{formatInt(p.estoque_minimo)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <div className="mt-3 text-right">
                  <Link to="/movimentacoes" className="text-sm font-medium text-brand-600 hover:underline">
                    Repor estoque →
                  </Link>
                </div>
              </div>
            )}
          </div>
        </>
      )}
    </Layout>
  )
}
