import { useEffect, useMemo, useState } from 'react'
import { Plus, Trash2, ShoppingCart, Calculator } from 'lucide-react'
import { Layout } from '@/components/Layout'
import { LoadingState, Spinner } from '@/components/ui/Spinner'
import { EmptyState } from '@/components/ui/EmptyState'
import { useToast } from '@/components/ui/Toast'
import { supabase } from '@/lib/supabase'
import { formatBRL, formatInt } from '@/lib/format'
import {
  calcularItem,
  somarResultados,
  PERCENTUAL_REPASSE_PADRAO,
  type ResultadoFinanceiro,
} from '@/lib/finance'
import { FORMAS_PAGAMENTO } from '@/lib/labels'
import type { Produto, ItemVendaInput } from '@/types'

interface CartItem extends ItemVendaInput {
  _key: number
}

let cartCounter = 0

export function NovaVenda() {
  const toast = useToast()
  const [produtos, setProdutos] = useState<Produto[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  const [dataVenda, setDataVenda] = useState(() => {
    const d = new Date()
    d.setMinutes(d.getMinutes() - d.getTimezoneOffset())
    return d.toISOString().slice(0, 16)
  })
  const [cliente, setCliente] = useState('')
  const [pagamento, setPagamento] = useState('dinheiro')
  const [observacao, setObservacao] = useState('')
  const [percentual, setPercentual] = useState(String(PERCENTUAL_REPASSE_PADRAO))
  const [itens, setItens] = useState<CartItem[]>([])
  const [selProduto, setSelProduto] = useState('')

  async function load() {
    setLoading(true)
    const { data, error } = await supabase
      .from('produtos')
      .select('*')
      .eq('ativo', true)
      .order('nome')
    if (error) toast.error(error.message)
    else setProdutos((data ?? []) as Produto[])
    setLoading(false)
  }

  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const produtoMap = useMemo(() => new Map(produtos.map((p) => [p.id, p])), [produtos])
  const pct = Number(String(percentual).replace(',', '.')) || 0

  function addItem() {
    if (!selProduto) {
      toast.error('Selecione um produto.')
      return
    }
    if (itens.some((i) => i.produto_id === selProduto)) {
      toast.info('Produto já está na venda. Ajuste a quantidade na lista.')
      return
    }
    const p = produtoMap.get(selProduto)
    if (!p) return
    if (p.quantidade_estoque <= 0) {
      toast.error('Produto sem estoque disponível.')
      return
    }
    setItens((prev) => [
      ...prev,
      { _key: ++cartCounter, produto_id: p.id, quantidade: 1, preco_unitario: p.preco_venda, desconto: 0 },
    ])
    setSelProduto('')
  }

  function updateItem(key: number, patch: Partial<CartItem>) {
    setItens((prev) => prev.map((i) => (i._key === key ? { ...i, ...patch } : i)))
  }

  function removeItem(key: number) {
    setItens((prev) => prev.filter((i) => i._key !== key))
  }

  const linhas = itens.map((it) => {
    const p = produtoMap.get(it.produto_id)
    const res = calcularItem(it.quantidade, it.preco_unitario, p?.custo_unitario ?? 0, it.desconto, pct)
    const semEstoque = p ? it.quantidade > p.quantidade_estoque : true
    return { it, p, res, semEstoque }
  })

  const totais: ResultadoFinanceiro = somarResultados(linhas.map((l) => l.res))
  const temErroEstoque = linhas.some((l) => l.semEstoque)

  async function finalizar() {
    if (itens.length === 0) {
      toast.error('Adicione ao menos um produto à venda.')
      return
    }
    if (temErroEstoque) {
      toast.error('Há itens com quantidade acima do estoque disponível.')
      return
    }
    if (itens.some((i) => i.quantidade <= 0)) {
      toast.error('Quantidade deve ser maior que zero.')
      return
    }
    setSaving(true)
    try {
      const payload = itens.map((i) => ({
        produto_id: i.produto_id,
        quantidade: Math.trunc(i.quantidade),
        preco_unitario: i.preco_unitario,
        desconto: i.desconto,
      }))
      const { error } = await supabase.rpc('registrar_venda', {
        p_data_venda: new Date(dataVenda).toISOString(),
        p_nome_cliente: cliente.trim() || null,
        p_forma_pagamento: pagamento,
        p_observacao: observacao.trim() || null,
        p_percentual_repasse: pct,
        p_itens: payload,
      })
      if (error) throw error
      toast.success('Venda registrada com sucesso! Estoque atualizado.')
      setItens([])
      setCliente('')
      setObservacao('')
      await load()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao registrar a venda.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Layout title="Nova venda" subtitle="Registre uma venda e dê baixa no estoque automaticamente">
      {loading ? (
        <LoadingState label="Carregando produtos…" />
      ) : (
        <div className="grid grid-cols-1 gap-5 xl:grid-cols-3">
          {/* Coluna principal: itens */}
          <div className="space-y-5 xl:col-span-2">
            <div className="card p-4">
              <h3 className="mb-3 font-semibold text-slate-800">Itens da venda</h3>
              <div className="flex flex-col gap-2 sm:flex-row">
                <select className="input flex-1" value={selProduto} onChange={(e) => setSelProduto(e.target.value)}>
                  <option value="">Selecione um produto…</option>
                  {produtos.map((p) => (
                    <option key={p.id} value={p.id} disabled={p.quantidade_estoque <= 0}>
                      {p.nome} — estoque {formatInt(p.quantidade_estoque)} — {formatBRL(p.preco_venda)}
                    </option>
                  ))}
                </select>
                <button className="btn-primary" onClick={addItem} type="button">
                  <Plus className="h-4 w-4" /> Adicionar
                </button>
              </div>

              {itens.length === 0 ? (
                <div className="mt-2">
                  <EmptyState
                    title="Nenhum item adicionado"
                    description="Selecione um produto acima para começar a venda."
                    icon={<ShoppingCart className="h-7 w-7" />}
                  />
                </div>
              ) : (
                <div className="mt-4 overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-slate-200 text-xs uppercase text-slate-500">
                        <th className="px-2 py-2 text-left font-semibold">Produto</th>
                        <th className="px-2 py-2 text-right font-semibold">Qtd.</th>
                        <th className="px-2 py-2 text-right font-semibold">Preço un.</th>
                        <th className="px-2 py-2 text-right font-semibold">Desc.</th>
                        <th className="px-2 py-2 text-right font-semibold">Subtotal</th>
                        <th className="px-2 py-2"></th>
                      </tr>
                    </thead>
                    <tbody>
                      {linhas.map(({ it, p, res, semEstoque }) => (
                        <tr key={it._key} className="border-b border-slate-100 last:border-0">
                          <td className="px-2 py-2">
                            <p className="font-medium text-slate-700">{p?.nome}</p>
                            <p className={`text-xs ${semEstoque ? 'text-red-500' : 'text-slate-400'}`}>
                              Estoque: {formatInt(p?.quantidade_estoque ?? 0)}
                              {semEstoque && ' — insuficiente'}
                            </p>
                          </td>
                          <td className="px-2 py-2">
                            <input
                              type="number"
                              min="1"
                              step="1"
                              className={`input w-20 text-right ${semEstoque ? 'border-red-400' : ''}`}
                              value={it.quantidade}
                              onChange={(e) =>
                                updateItem(it._key, { quantidade: Math.max(1, Math.trunc(Number(e.target.value) || 0)) })
                              }
                            />
                          </td>
                          <td className="px-2 py-2">
                            <input
                              type="number"
                              min="0"
                              step="0.01"
                              className="input w-24 text-right"
                              value={it.preco_unitario}
                              onChange={(e) => updateItem(it._key, { preco_unitario: Number(e.target.value) || 0 })}
                            />
                          </td>
                          <td className="px-2 py-2">
                            <input
                              type="number"
                              min="0"
                              step="0.01"
                              className="input w-20 text-right"
                              value={it.desconto}
                              onChange={(e) => updateItem(it._key, { desconto: Number(e.target.value) || 0 })}
                            />
                          </td>
                          <td className="px-2 py-2 text-right font-semibold text-slate-700">
                            {formatBRL(res.faturamento - res.desconto)}
                          </td>
                          <td className="px-2 py-2 text-right">
                            <button
                              className="rounded-lg p-2 text-red-500 hover:bg-red-50"
                              onClick={() => removeItem(it._key)}
                              type="button"
                              aria-label="Remover item"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Dados da venda */}
            <div className="card p-4">
              <h3 className="mb-3 font-semibold text-slate-800">Dados da venda</h3>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label className="label">Data da venda</label>
                  <input
                    type="datetime-local"
                    className="input"
                    value={dataVenda}
                    onChange={(e) => setDataVenda(e.target.value)}
                  />
                </div>
                <div>
                  <label className="label">Forma de pagamento</label>
                  <select className="input" value={pagamento} onChange={(e) => setPagamento(e.target.value)}>
                    {FORMAS_PAGAMENTO.map((f) => (
                      <option key={f.value} value={f.value}>
                        {f.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="label">Cliente (opcional)</label>
                  <input className="input" value={cliente} onChange={(e) => setCliente(e.target.value)} placeholder="Nome do cliente" />
                </div>
                <div>
                  <label className="label">Repasse ao dono (%)</label>
                  <input
                    type="number"
                    min="0"
                    max="100"
                    step="0.01"
                    className="input"
                    value={percentual}
                    onChange={(e) => setPercentual(e.target.value)}
                  />
                </div>
                <div className="sm:col-span-2">
                  <label className="label">Observação</label>
                  <textarea className="input min-h-[60px]" value={observacao} onChange={(e) => setObservacao(e.target.value)} />
                </div>
              </div>
            </div>
          </div>

          {/* Resumo */}
          <div className="xl:col-span-1">
            <div className="card sticky top-4 p-4">
              <h3 className="mb-3 flex items-center gap-2 font-semibold text-slate-800">
                <Calculator className="h-4 w-4 text-brand-600" /> Resumo financeiro
              </h3>
              <dl className="space-y-2 text-sm">
                <Row label="Faturamento" value={formatBRL(totais.faturamento)} />
                <Row label="Custo dos produtos" value={formatBRL(totais.custo)} />
                <Row label="Desconto" value={`- ${formatBRL(totais.desconto)}`} />
                <div className="my-2 border-t border-slate-200" />
                <Row label="Lucro bruto" value={formatBRL(totais.lucroBruto)} strong tone={totais.lucroBruto >= 0 ? 'pos' : 'neg'} />
                <Row label={`Repasse (${pct}%)`} value={`- ${formatBRL(totais.valorRepasse)}`} tone="brand" />
                <div className="my-2 border-t border-slate-200" />
                <Row label="Lucro líquido" value={formatBRL(totais.lucroLiquido)} strong tone={totais.lucroLiquido >= 0 ? 'pos' : 'neg'} big />
              </dl>

              <button
                className="btn-primary mt-4 w-full"
                onClick={finalizar}
                disabled={saving || itens.length === 0 || temErroEstoque}
              >
                {saving ? <Spinner className="h-4 w-4" /> : <ShoppingCart className="h-4 w-4" />}
                Registrar venda
              </button>
              {temErroEstoque && (
                <p className="mt-2 text-center text-xs text-red-500">
                  Ajuste as quantidades: há itens acima do estoque.
                </p>
              )}
            </div>
          </div>
        </div>
      )}
    </Layout>
  )
}

function Row({
  label,
  value,
  strong,
  big,
  tone,
}: {
  label: string
  value: string
  strong?: boolean
  big?: boolean
  tone?: 'pos' | 'neg' | 'brand'
}) {
  const color =
    tone === 'pos' ? 'text-green-600' : tone === 'neg' ? 'text-red-600' : tone === 'brand' ? 'text-brand-600' : 'text-slate-700'
  return (
    <div className="flex items-center justify-between">
      <dt className="text-slate-500">{label}</dt>
      <dd className={`${strong ? 'font-bold' : 'font-medium'} ${big ? 'text-lg' : ''} ${color}`}>{value}</dd>
    </div>
  )
}
