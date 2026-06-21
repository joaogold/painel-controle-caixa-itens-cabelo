import { supabase } from '../supabaseClient.js'
import { mountLayout } from '../layout.js'
import { refreshIcons, loadingState, emptyState, showError, errMessage, escapeHtml } from '../ui.js'
import { formatBRL, formatInt, formatDate, formatDateTime, formatPercent, toISODate } from '../format.js'
import { metricasProduto } from '../finance.js'
import { intervaloDoPreset, PERIODO_OPCOES } from '../filters.js'
import { labelFormaPagamento, labelTipoMov } from '../labels.js'
import { exportCSV, exportXLSX, exportPDF } from '../export.js'

const REPORTS = [
  { id: 'produtos', label: 'Produtos cadastrados', periodo: false },
  { id: 'estoque', label: 'Estoque atual', periodo: false },
  { id: 'estoque_baixo', label: 'Produtos abaixo do mínimo', periodo: false },
  { id: 'movimentacoes', label: 'Histórico de movimentações', periodo: true },
  { id: 'vendas', label: 'Histórico de vendas', periodo: true },
  { id: 'mais_vendidos', label: 'Produtos mais vendidos', periodo: true },
  { id: 'faturamento_periodo', label: 'Faturamento por período', periodo: true },
  { id: 'lucro_produto', label: 'Lucro por produto', periodo: true },
  { id: 'lucro_periodo', label: 'Lucro por período (dia)', periodo: true },
  { id: 'pagamentos', label: 'Formas de pagamento', periodo: true },
  { id: 'repasses_pagos', label: 'Repasses pagos', periodo: false },
  { id: 'repasses_pendentes', label: 'Repasses pendentes', periodo: false },
]

let dataset = { produtos: [], vendas: [], movs: [], repasses: [] }
let sel = { report: 'vendas', preset: 'mes', inicio: toISODate(new Date()), fim: toISODate(new Date()) }
let lastResult = { title: '', columns: [], rows: [] }

export async function render() {
  const content = mountLayout({ activePath: '#/relatorios', title: 'Relatórios', subtitle: 'Consulte e exporte os dados do sistema' })
  refreshIcons()
  content.innerHTML = loadingState('Carregando dados…')

  try {
    const [p, v, m, r] = await Promise.all([
      supabase.from('produtos').select('*').order('nome'),
      supabase.from('vendas').select('*, itens_venda(*, produtos(nome, categoria))').order('data_venda', { ascending: false }),
      supabase.from('movimentacoes_estoque').select('*, produtos(nome, categoria)').order('created_at', { ascending: false }).limit(2000),
      supabase.from('repasses').select('*').order('created_at', { ascending: false }),
    ])
    if (p.error || v.error || m.error || r.error) throw p.error || v.error || m.error || r.error
    dataset = { produtos: p.data || [], vendas: v.data || [], movs: m.data || [], repasses: r.data || [] }
  } catch (err) {
    showError(errMessage(err))
    content.innerHTML = ''
    return
  }

  content.innerHTML = `
    <div class="card mb-5 p-4">
      <div class="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end">
        <div>
          <label class="label">Relatório</label>
          <select id="r-report" class="input min-w-[15rem]">
            ${REPORTS.map((r) => `<option value="${r.id}" ${r.id === sel.report ? 'selected' : ''}>${r.label}</option>`).join('')}
          </select>
        </div>
        <div id="r-periodo" class="flex items-end gap-3">
          <div>
            <label class="label">Período</label>
            <select id="r-preset" class="input min-w-[10rem]">
              ${PERIODO_OPCOES.map((o) => `<option value="${o.value}" ${o.value === sel.preset ? 'selected' : ''}>${o.label}</option>`).join('')}
            </select>
          </div>
          <div id="r-custom" class="${sel.preset === 'personalizado' ? 'flex' : 'hidden'} items-end gap-3">
            <div><label class="label">De</label><input id="r-inicio" type="date" class="input" value="${sel.inicio}" /></div>
            <div><label class="label">Até</label><input id="r-fim" type="date" class="input" value="${sel.fim}" /></div>
          </div>
        </div>
        <div class="ml-auto flex flex-wrap gap-2">
          <button id="exp-csv" class="btn btn-secondary"><i data-lucide="file-down" class="h-4 w-4"></i> CSV</button>
          <button id="exp-xlsx" class="btn btn-secondary"><i data-lucide="file-spreadsheet" class="h-4 w-4"></i> Excel</button>
          <button id="exp-pdf" class="btn btn-secondary"><i data-lucide="file-text" class="h-4 w-4"></i> PDF</button>
        </div>
      </div>
    </div>
    <div id="r-tabela"></div>`

  refreshIcons()

  const reportSel = content.querySelector('#r-report')
  const presetSel = content.querySelector('#r-preset')
  reportSel.addEventListener('change', () => {
    sel.report = reportSel.value
    updatePeriodVisibility(content)
    renderTabela(content)
  })
  presetSel.addEventListener('change', () => {
    sel.preset = presetSel.value
    content.querySelector('#r-custom').className = `${sel.preset === 'personalizado' ? 'flex' : 'hidden'} items-end gap-3`
    renderTabela(content)
  })
  content.querySelector('#r-inicio').addEventListener('change', (e) => { sel.inicio = e.target.value; renderTabela(content) })
  content.querySelector('#r-fim').addEventListener('change', (e) => { sel.fim = e.target.value; renderTabela(content) })

  content.querySelector('#exp-csv').addEventListener('click', () => doExport(() => exportCSV(sel.report, lastResult.rows, lastResult.columns)))
  content.querySelector('#exp-xlsx').addEventListener('click', () => doExport(() => exportXLSX(sel.report, lastResult.rows, lastResult.columns)))
  content.querySelector('#exp-pdf').addEventListener('click', () => doExport(() => exportPDF(sel.report, lastResult.title, lastResult.rows, lastResult.columns)))

  updatePeriodVisibility(content)
  renderTabela(content)
}

function updatePeriodVisibility(content) {
  const usa = REPORTS.find((r) => r.id === sel.report)?.periodo
  content.querySelector('#r-periodo').classList.toggle('hidden', !usa)
}

async function doExport(fn) {
  if (!lastResult.rows.length) return showError('Não há dados para exportar.')
  try {
    await fn()
  } catch (err) {
    showError(errMessage(err, 'Falha ao exportar.'))
  }
}

function buildReport() {
  const intervalo = intervaloDoPreset(sel.preset, { inicio: sel.inicio, fim: sel.fim })
  const inRange = (iso) => {
    const t = new Date(iso).getTime()
    return t >= intervalo.inicio.getTime() && t <= intervalo.fim.getTime()
  }
  const label = REPORTS.find((r) => r.id === sel.report)?.label ?? ''
  const vendasPeriodo = dataset.vendas.filter((v) => inRange(v.data_venda))
  const itensPeriodo = vendasPeriodo.flatMap((v) => (v.itens_venda || []).map((it) => ({ ...it, _venda: v })))

  switch (sel.report) {
    case 'produtos':
      return { title: label, columns: [
        { header: 'Produto', accessor: (r) => r.nome },
        { header: 'Categoria', accessor: (r) => r.categoria },
        { header: 'Descrição', accessor: (r) => r.descricao ?? '' },
        { header: 'Custo', accessor: (r) => formatBRL(r.custo_unitario) },
        { header: 'Preço', accessor: (r) => formatBRL(r.preco_venda) },
        { header: 'Margem', accessor: (r) => formatPercent(metricasProduto(r).margem) },
        { header: 'Status', accessor: (r) => (r.ativo ? 'Ativo' : 'Inativo') },
        { header: 'Cadastro', accessor: (r) => formatDate(r.created_at) },
      ], rows: dataset.produtos }

    case 'estoque':
      return { title: label, columns: [
        { header: 'Produto', accessor: (r) => r.nome },
        { header: 'Categoria', accessor: (r) => r.categoria },
        { header: 'Estoque', accessor: (r) => formatInt(r.quantidade_estoque) },
        { header: 'Mínimo', accessor: (r) => formatInt(r.estoque_minimo) },
        { header: 'Custo un.', accessor: (r) => formatBRL(r.custo_unitario) },
        { header: 'Investido', accessor: (r) => formatBRL(metricasProduto(r).investidoTotal) },
        { header: 'Potencial', accessor: (r) => formatBRL(metricasProduto(r).potencialVenda) },
      ], rows: dataset.produtos }

    case 'estoque_baixo':
      return { title: label, columns: [
        { header: 'Produto', accessor: (r) => r.nome },
        { header: 'Categoria', accessor: (r) => r.categoria },
        { header: 'Estoque', accessor: (r) => formatInt(r.quantidade_estoque) },
        { header: 'Mínimo', accessor: (r) => formatInt(r.estoque_minimo) },
      ], rows: dataset.produtos.filter((p) => p.ativo && p.quantidade_estoque <= p.estoque_minimo) }

    case 'movimentacoes':
      return { title: label, columns: [
        { header: 'Data/Hora', accessor: (r) => formatDateTime(r.created_at) },
        { header: 'Produto', accessor: (r) => r.produtos?.nome ?? '' },
        { header: 'Tipo', accessor: (r) => labelTipoMov(r.tipo) },
        { header: 'Qtd.', accessor: (r) => formatInt(r.quantidade) },
        { header: 'Anterior', accessor: (r) => formatInt(r.estoque_anterior) },
        { header: 'Atual', accessor: (r) => formatInt(r.estoque_atual) },
        { header: 'Motivo', accessor: (r) => r.motivo ?? '' },
      ], rows: dataset.movs.filter((m) => inRange(m.created_at)) }

    case 'vendas':
      return { title: label, columns: [
        { header: 'Data', accessor: (r) => formatDateTime(r.data_venda) },
        { header: 'Cliente', accessor: (r) => r.nome_cliente ?? '' },
        { header: 'Pagamento', accessor: (r) => labelFormaPagamento(r.forma_pagamento) },
        { header: 'Itens', accessor: (r) => formatInt((r.itens_venda || []).length) },
        { header: 'Faturamento', accessor: (r) => formatBRL(r.faturamento_total) },
        { header: 'Custo', accessor: (r) => formatBRL(r.custo_total) },
        { header: 'Desconto', accessor: (r) => formatBRL(r.desconto_total) },
        { header: 'Lucro bruto', accessor: (r) => formatBRL(r.lucro_bruto) },
        { header: 'Repasse', accessor: (r) => formatBRL(r.valor_repasse) },
        { header: 'Lucro líquido', accessor: (r) => formatBRL(r.lucro_liquido) },
      ], rows: vendasPeriodo }

    case 'mais_vendidos': {
      const map = new Map()
      for (const it of itensPeriodo) {
        const nome = it.produtos?.nome ?? 'Produto'
        const cur = map.get(nome) || { nome, qtd: 0, faturamento: 0 }
        cur.qtd += it.quantidade
        cur.faturamento += Number(it.faturamento)
        map.set(nome, cur)
      }
      return { title: label, columns: [
        { header: 'Produto', accessor: (r) => r.nome },
        { header: 'Qtd. vendida', accessor: (r) => formatInt(r.qtd) },
        { header: 'Faturamento', accessor: (r) => formatBRL(r.faturamento) },
      ], rows: Array.from(map.values()).sort((a, b) => b.qtd - a.qtd) }
    }

    case 'lucro_produto': {
      const map = new Map()
      for (const it of itensPeriodo) {
        const nome = it.produtos?.nome ?? 'Produto'
        const cur = map.get(nome) || { nome, qtd: 0, faturamento: 0, custo: 0, lucro: 0 }
        cur.qtd += it.quantidade
        cur.faturamento += Number(it.faturamento)
        cur.custo += Number(it.custo_total)
        cur.lucro += Number(it.lucro_bruto)
        map.set(nome, cur)
      }
      return { title: label, columns: [
        { header: 'Produto', accessor: (r) => r.nome },
        { header: 'Qtd.', accessor: (r) => formatInt(r.qtd) },
        { header: 'Faturamento', accessor: (r) => formatBRL(r.faturamento) },
        { header: 'Custo', accessor: (r) => formatBRL(r.custo) },
        { header: 'Lucro bruto', accessor: (r) => formatBRL(r.lucro) },
      ], rows: Array.from(map.values()).sort((a, b) => b.lucro - a.lucro) }
    }

    case 'faturamento_periodo':
    case 'lucro_periodo': {
      const map = new Map()
      for (const v of vendasPeriodo) {
        const dia = v.data_venda.slice(0, 10)
        const cur = map.get(dia) || { dia, faturamento: 0, custo: 0, lucro: 0, repasse: 0, liquido: 0 }
        cur.faturamento += Number(v.faturamento_total)
        cur.custo += Number(v.custo_total)
        cur.lucro += Number(v.lucro_bruto)
        cur.repasse += Number(v.valor_repasse)
        cur.liquido += Number(v.lucro_liquido)
        map.set(dia, cur)
      }
      return { title: label, columns: [
        { header: 'Dia', accessor: (r) => formatDate(r.dia) },
        { header: 'Faturamento', accessor: (r) => formatBRL(r.faturamento) },
        { header: 'Custo', accessor: (r) => formatBRL(r.custo) },
        { header: 'Lucro bruto', accessor: (r) => formatBRL(r.lucro) },
        { header: 'Repasse', accessor: (r) => formatBRL(r.repasse) },
        { header: 'Lucro líquido', accessor: (r) => formatBRL(r.liquido) },
      ], rows: Array.from(map.values()).sort((a, b) => a.dia.localeCompare(b.dia)) }
    }

    case 'pagamentos': {
      const map = new Map()
      for (const v of vendasPeriodo) {
        const cur = map.get(v.forma_pagamento) || { forma: v.forma_pagamento, qtd: 0, total: 0 }
        cur.qtd += 1
        cur.total += Number(v.faturamento_total)
        map.set(v.forma_pagamento, cur)
      }
      return { title: label, columns: [
        { header: 'Forma de pagamento', accessor: (r) => labelFormaPagamento(r.forma) },
        { header: 'Qtd. vendas', accessor: (r) => formatInt(r.qtd) },
        { header: 'Total faturado', accessor: (r) => formatBRL(r.total) },
      ], rows: Array.from(map.values()).sort((a, b) => b.total - a.total) }
    }

    case 'repasses_pagos':
    case 'repasses_pendentes': {
      const status = sel.report === 'repasses_pagos' ? 'pago' : 'pendente'
      return { title: label, columns: [
        { header: 'Período', accessor: (r) => `${formatDate(r.data_inicial)} - ${formatDate(r.data_final)}` },
        { header: 'Lucro bruto', accessor: (r) => formatBRL(r.lucro_bruto_periodo) },
        { header: '%', accessor: (r) => formatPercent(r.percentual) },
        { header: 'Valor', accessor: (r) => formatBRL(r.valor_repasse) },
        { header: 'Status', accessor: (r) => (r.status === 'pago' ? 'Pago' : 'Pendente') },
        { header: 'Pago em', accessor: (r) => formatDate(r.data_pagamento) },
      ], rows: dataset.repasses.filter((r) => r.status === status) }
    }

    default:
      return { title: label, columns: [], rows: [] }
  }
}

function renderTabela(content) {
  lastResult = buildReport()
  const { title, columns, rows } = lastResult
  const el = content.querySelector('#r-tabela')

  const head = columns.map((c) => `<th class="whitespace-nowrap">${escapeHtml(c.header)}</th>`).join('')
  const body = rows
    .map((row) => `<tr>${columns.map((c) => `<td class="whitespace-nowrap">${escapeHtml(c.accessor(row))}</td>`).join('')}</tr>`)
    .join('')

  el.innerHTML = `
    <div class="card overflow-hidden">
      <div class="flex items-center gap-2 border-b border-slate-200 px-4 py-3">
        <i data-lucide="table-2" class="h-5 w-5 text-brand-600"></i>
        <h3 class="font-semibold text-slate-800">${escapeHtml(title)}</h3>
        <span class="badge ml-auto bg-slate-100 text-slate-600">${rows.length} registro(s)</span>
      </div>
      ${
        rows.length === 0
          ? emptyState({ title: 'Nenhum dado para exibir', description: 'Ajuste o período ou registre dados no sistema.' })
          : `<div class="max-h-[60vh] overflow-auto"><table class="tbl"><thead><tr>${head}</tr></thead><tbody>${body}</tbody></table></div>`
      }
    </div>`
  refreshIcons()
}
