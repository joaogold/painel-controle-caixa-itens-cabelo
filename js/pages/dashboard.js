import Chart from 'chart.js'
import { supabase } from '../supabaseClient.js'
import { mountLayout } from '../layout.js'
import { refreshIcons, loadingState, emptyState, showError, errMessage, escapeHtml } from '../ui.js'
import { formatBRL, formatInt, toISODate } from '../format.js'
import { intervaloDoPreset, PERIODO_OPCOES } from '../filters.js'
import { FORMAS_PAGAMENTO } from '../labels.js'

let state = {
  produtos: [],
  vendas: [],
  repasses: [],
  preset: 'mes',
  inicio: toISODate(new Date()),
  fim: toISODate(new Date()),
  produtoId: '',
  categoria: '',
  pagamento: '',
}
let chartProdutos = null
let chartFinanceiro = null

export async function render() {
  const content = mountLayout({
    activePath: '#/',
    title: 'Dashboard',
    subtitle: 'Visão geral do estoque, vendas e caixa',
  })
  refreshIcons()
  content.innerHTML = `<div id="filtros" class="card mb-5 p-4"></div><div id="painel">${loadingState('Carregando indicadores…')}</div>`

  renderFiltros(content)
  await reloadData()
}

function renderFiltros(content) {
  const filtros = content.querySelector('#filtros')
  const categorias = Array.from(new Set(state.produtos.map((p) => p.categoria))).sort()
  filtros.innerHTML = `
    <div class="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end">
      <div>
        <label class="label">Período</label>
        <select id="f-preset" class="input min-w-[10rem]">
          ${PERIODO_OPCOES.map((o) => `<option value="${o.value}" ${o.value === state.preset ? 'selected' : ''}>${o.label}</option>`).join('')}
        </select>
      </div>
      <div id="f-custom" class="${state.preset === 'personalizado' ? 'flex' : 'hidden'} items-end gap-3">
        <div><label class="label">De</label><input id="f-inicio" type="date" class="input" value="${state.inicio}" /></div>
        <div><label class="label">Até</label><input id="f-fim" type="date" class="input" value="${state.fim}" /></div>
      </div>
      <div>
        <label class="label">Produto</label>
        <select id="f-produto" class="input min-w-[10rem]"><option value="">Todos</option>
          ${state.produtos.map((p) => `<option value="${p.id}" ${p.id === state.produtoId ? 'selected' : ''}>${escapeHtml(p.nome)}</option>`).join('')}
        </select>
      </div>
      <div>
        <label class="label">Categoria</label>
        <select id="f-categoria" class="input min-w-[9rem]"><option value="">Todas</option>
          ${categorias.map((c) => `<option value="${escapeHtml(c)}" ${c === state.categoria ? 'selected' : ''}>${escapeHtml(c)}</option>`).join('')}
        </select>
      </div>
      <div>
        <label class="label">Pagamento</label>
        <select id="f-pagamento" class="input min-w-[9rem]"><option value="">Todos</option>
          ${FORMAS_PAGAMENTO.map((f) => `<option value="${f.value}" ${f.value === state.pagamento ? 'selected' : ''}>${f.label}</option>`).join('')}
        </select>
      </div>
    </div>`

  const reloadOnPeriod = async () => {
    state.preset = filtros.querySelector('#f-preset').value
    state.inicio = filtros.querySelector('#f-inicio')?.value || state.inicio
    state.fim = filtros.querySelector('#f-fim')?.value || state.fim
    filtros.querySelector('#f-custom').className = `${state.preset === 'personalizado' ? 'flex' : 'hidden'} items-end gap-3`
    await reloadData()
  }
  filtros.querySelector('#f-preset').addEventListener('change', reloadOnPeriod)
  filtros.querySelector('#f-inicio')?.addEventListener('change', reloadOnPeriod)
  filtros.querySelector('#f-fim')?.addEventListener('change', reloadOnPeriod)
  filtros.querySelector('#f-produto').addEventListener('change', (e) => {
    state.produtoId = e.target.value
    renderPainel()
  })
  filtros.querySelector('#f-categoria').addEventListener('change', (e) => {
    state.categoria = e.target.value
    renderPainel()
  })
  filtros.querySelector('#f-pagamento').addEventListener('change', (e) => {
    state.pagamento = e.target.value
    renderPainel()
  })
}

async function reloadData() {
  const intervalo = intervaloDoPreset(state.preset, { inicio: state.inicio, fim: state.fim })
  try {
    const [p, v, r] = await Promise.all([
      supabase.from('produtos').select('*').order('nome'),
      supabase
        .from('vendas')
        .select('*, itens_venda(*, produtos(nome, categoria))')
        .gte('data_venda', intervalo.inicio.toISOString())
        .lte('data_venda', intervalo.fim.toISOString())
        .order('data_venda', { ascending: false }),
      supabase.from('repasses').select('*'),
    ])
    if (p.error || v.error || r.error) throw p.error || v.error || r.error
    state.produtos = p.data || []
    state.vendas = v.data || []
    state.repasses = r.data || []
  } catch (err) {
    showError(errMessage(err, 'Erro ao carregar o painel.'))
    return
  }
  // Atualiza selects de produto/categoria conforme novos produtos
  renderFiltros(document.getElementById('content'))
  renderPainel()
}

function compute() {
  const totalUnidades = state.produtos.reduce((s, p) => s + p.quantidade_estoque, 0)
  const investido = state.produtos.reduce((s, p) => s + p.quantidade_estoque * p.custo_unitario, 0)
  const potencial = state.produtos.reduce((s, p) => s + p.quantidade_estoque * p.preco_venda, 0)
  const baixos = state.produtos.filter((p) => p.ativo && p.quantidade_estoque <= p.estoque_minimo)

  const vendasFiltradas = state.vendas.filter((v) => !state.pagamento || v.forma_pagamento === state.pagamento)
  const itens = vendasFiltradas.flatMap((v) =>
    (v.itens_venda || [])
      .filter((it) => !state.produtoId || it.produto_id === state.produtoId)
      .filter((it) => !state.categoria || it.produtos?.categoria === state.categoria)
      .map((it) => ({ ...it, _venda: v.id })),
  )
  const vendaIds = new Set(itens.map((it) => it._venda))
  const faturamento = itens.reduce((s, it) => s + Number(it.faturamento), 0)
  const custo = itens.reduce((s, it) => s + Number(it.custo_total), 0)
  const lucroBruto = itens.reduce((s, it) => s + Number(it.lucro_bruto), 0)
  const repasse = itens.reduce((s, it) => s + Number(it.valor_repasse), 0)
  const lucroLiquido = itens.reduce((s, it) => s + Number(it.lucro_liquido), 0)

  const porProduto = new Map()
  for (const it of itens) {
    const nome = it.produtos?.nome ?? 'Produto'
    porProduto.set(nome, (porProduto.get(nome) || 0) + it.quantidade)
  }
  const vendasPorProduto = Array.from(porProduto.entries())
    .map(([nome, qtd]) => ({ nome, qtd }))
    .sort((a, b) => b.qtd - a.qtd)

  const repassesPendentes = state.repasses
    .filter((r) => r.status === 'pendente')
    .reduce((s, r) => s + Number(r.valor_repasse), 0)

  return {
    totalUnidades, investido, potencial, baixos,
    faturamento, custo, lucroBruto, repasse, lucroLiquido,
    qtdVendas: vendaIds.size,
    maisVendido: vendasPorProduto[0]?.nome ?? '—',
    vendasPorProduto, repassesPendentes,
  }
}

function statCard(label, value, icon, tone = 'default', hint = '') {
  const tones = {
    default: ['text-slate-800', 'bg-slate-100 text-slate-500'],
    positive: ['text-green-600', 'bg-green-100 text-green-600'],
    negative: ['text-red-600', 'bg-red-100 text-red-600'],
    warning: ['text-amber-600', 'bg-amber-100 text-amber-600'],
    brand: ['text-brand-600', 'bg-brand-100 text-brand-600'],
  }
  const [valColor, iconColor] = tones[tone] || tones.default
  return `
    <div class="card p-4">
      <div class="flex items-start justify-between gap-3">
        <div class="min-w-0">
          <p class="truncate text-xs font-medium uppercase tracking-wide text-slate-500">${label}</p>
          <p class="mt-1 truncate text-xl font-bold sm:text-2xl ${valColor}">${value}</p>
          ${hint ? `<p class="mt-1 truncate text-xs text-slate-400">${hint}</p>` : ''}
        </div>
        <div class="hidden h-10 w-10 shrink-0 items-center justify-center rounded-lg sm:flex ${iconColor}"><i data-lucide="${icon}" class="h-5 w-5"></i></div>
      </div>
    </div>`
}

function renderPainel() {
  const painel = document.getElementById('painel')
  if (!painel) return
  const d = compute()

  painel.innerHTML = `
    <div class="mb-5 grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-3 xl:grid-cols-4">
      ${statCard('Unidades em estoque', formatInt(d.totalUnidades), 'boxes', 'brand')}
      ${statCard('Produtos cadastrados', formatInt(state.produtos.length), 'package')}
      ${statCard('Investido no estoque', formatBRL(d.investido), 'wallet', 'warning')}
      ${statCard('Potencial de venda', formatBRL(d.potencial), 'trending-up', 'positive')}
      ${statCard('Faturamento', formatBRL(d.faturamento), 'dollar-sign', 'positive')}
      ${statCard('Custo dos vendidos', formatBRL(d.custo), 'receipt', 'warning')}
      ${statCard('Lucro bruto', formatBRL(d.lucroBruto), 'trending-up', d.lucroBruto >= 0 ? 'positive' : 'negative')}
      ${statCard('A repassar (10%)', formatBRL(d.repasse), 'hand-coins', 'brand')}
      ${statCard('Lucro líquido', formatBRL(d.lucroLiquido), 'piggy-bank', d.lucroLiquido >= 0 ? 'positive' : 'negative')}
      ${statCard('Vendas realizadas', formatInt(d.qtdVendas), 'shopping-bag')}
      ${statCard('Produto mais vendido', escapeHtml(d.maisVendido), 'trophy', 'brand')}
      ${statCard('Repasses pendentes', formatBRL(d.repassesPendentes), 'clock', 'warning', 'Lançamentos não pagos')}
    </div>

    <div class="mb-5 grid grid-cols-1 gap-4 lg:grid-cols-2">
      <div class="card p-4">
        <h3 class="mb-3 font-semibold text-slate-800">Vendas por produto</h3>
        <div id="chart-produtos-wrap">${d.vendasPorProduto.length === 0 ? emptyState({ title: 'Sem vendas no período', description: 'Ajuste os filtros ou registre uma venda.' }) : '<div style="height:300px"><canvas id="chart-produtos"></canvas></div>'}</div>
      </div>
      <div class="card p-4">
        <h3 class="mb-3 font-semibold text-slate-800">Resultado financeiro</h3>
        <div style="height:300px"><canvas id="chart-financeiro"></canvas></div>
      </div>
    </div>

    <div class="card p-4">
      <div class="mb-3 flex items-center gap-2">
        <i data-lucide="alert-triangle" class="h-5 w-5 text-amber-500"></i>
        <h3 class="font-semibold text-slate-800">Produtos com estoque baixo</h3>
        <span class="badge bg-amber-100 text-amber-700">${d.baixos.length}</span>
      </div>
      ${
        d.baixos.length === 0
          ? '<p class="py-6 text-center text-sm text-slate-500">Nenhum produto abaixo do estoque mínimo. 🎉</p>'
          : `<div class="overflow-x-auto"><table class="tbl"><thead><tr><th>Produto</th><th>Categoria</th><th class="text-right">Em estoque</th><th class="text-right">Mínimo</th></tr></thead><tbody>
              ${d.baixos
                .map(
                  (p) => `<tr>
                    <td class="font-medium text-slate-700">${escapeHtml(p.nome)}</td>
                    <td class="text-slate-500">${escapeHtml(p.categoria)}</td>
                    <td class="text-right"><span class="badge bg-red-100 text-red-700">${formatInt(p.quantidade_estoque)}</span></td>
                    <td class="text-right text-slate-500">${formatInt(p.estoque_minimo)}</td>
                  </tr>`,
                )
                .join('')}
            </tbody></table>
            <div class="mt-3 text-right"><a href="#/movimentacoes" class="text-sm font-medium text-brand-600 hover:underline">Repor estoque →</a></div></div>`
      }
    </div>`

  refreshIcons()
  drawCharts(d)
}

function drawCharts(d) {
  if (chartProdutos) { chartProdutos.destroy(); chartProdutos = null }
  if (chartFinanceiro) { chartFinanceiro.destroy(); chartFinanceiro = null }

  const cp = document.getElementById('chart-produtos')
  if (cp && d.vendasPorProduto.length > 0) {
    const top = d.vendasPorProduto.slice(0, 12)
    chartProdutos = new Chart(cp, {
      type: 'bar',
      data: {
        labels: top.map((x) => x.nome),
        datasets: [{ label: 'Qtd. vendida', data: top.map((x) => x.qtd), backgroundColor: '#db2777', borderRadius: 4 }],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: { y: { beginAtZero: true, ticks: { precision: 0 } } },
      },
    })
  }

  const cf = document.getElementById('chart-financeiro')
  if (cf) {
    chartFinanceiro = new Chart(cf, {
      type: 'bar',
      data: {
        labels: ['Faturamento', 'Custo', 'Lucro bruto', 'Repasse 10%', 'Lucro líquido'],
        datasets: [
          {
            label: 'Valor (R$)',
            data: [d.faturamento, d.custo, d.lucroBruto, d.repasse, d.lucroLiquido],
            backgroundColor: ['#0ea5e9', '#f59e0b', '#10b981', '#db2777', '#6366f1'],
            borderRadius: 4,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: { callbacks: { label: (ctx) => formatBRL(ctx.parsed.y) } },
        },
        scales: { y: { beginAtZero: true, ticks: { callback: (v) => formatBRL(v).replace('R$', '').trim() } } },
      },
    })
  }
}
