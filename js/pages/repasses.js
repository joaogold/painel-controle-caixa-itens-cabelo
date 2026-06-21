import { supabase } from '../supabaseClient.js'
import { mountLayout } from '../layout.js'
import { createDataTable } from '../components/dataTable.js'
import {
  refreshIcons,
  openModal,
  confirmDialog,
  loadingState,
  emptyState,
  showSuccess,
  showError,
  errMessage,
  escapeHtml,
} from '../ui.js'
import { formatBRL, formatDate, formatPercent, toISODate } from '../format.js'
import { startOfMonth } from '../filters.js'
import { labelFormaPagamento } from '../labels.js'

export async function render() {
  const content = mountLayout({
    activePath: '#/repasses',
    title: 'Repasses',
    subtitle: 'Controle dos 10% destinados ao dono do ambiente',
  })
  refreshIcons()
  content.innerHTML = loadingState('Carregando repasses…')
  await load(content)
}

async function load(content) {
  const { data, error } = await supabase.from('repasses').select('*').order('created_at', { ascending: false })
  if (error) {
    showError(errMessage(error))
    content.innerHTML = ''
    return
  }
  const repasses = data || []
  const pendente = repasses.filter((r) => r.status === 'pendente').reduce((s, r) => s + Number(r.valor_repasse), 0)
  const pago = repasses.filter((r) => r.status === 'pago').reduce((s, r) => s + Number(r.valor_repasse), 0)

  const dataInicial = toISODate(startOfMonth(new Date()))
  const dataFinal = toISODate(new Date())

  content.innerHTML = `
    <div class="mb-5 grid grid-cols-1 gap-4 sm:grid-cols-3">
      ${statCard('Total pendente', formatBRL(pendente), 'clock', 'warning')}
      ${statCard('Total pago', formatBRL(pago), 'check-circle-2', 'positive')}
      ${statCard('Total geral', formatBRL(pendente + pago), 'circle-dollar-sign', 'brand')}
    </div>

    <div class="grid grid-cols-1 gap-5 xl:grid-cols-3">
      <div class="xl:col-span-1">
        <form id="repasse-form" class="card sticky top-4 space-y-4 p-4">
          <h3 class="flex items-center gap-2 font-semibold text-slate-800"><i data-lucide="hand-coins" class="h-5 w-5 text-brand-600"></i> Gerar repasse</h3>
          <p class="text-xs text-slate-500">Inclui as vendas do período que ainda não fazem parte de outro repasse.</p>
          <div><label class="label">Data inicial *</label><input id="data-inicial" type="date" class="input" value="${dataInicial}" required /></div>
          <div><label class="label">Data final *</label><input id="data-final" type="date" class="input" value="${dataFinal}" required /></div>
          <div><label class="label">Percentual (%)</label><input id="percentual" type="number" min="0" max="100" step="0.01" class="input" value="10" /></div>
          <div><label class="label">Observação</label><textarea id="observacao" class="input" style="min-height:60px"></textarea></div>
          <button type="submit" id="gerar" class="btn btn-primary w-full"><i data-lucide="plus" class="h-4 w-4"></i> Gerar repasse</button>
        </form>
      </div>
      <div class="xl:col-span-2"><div id="tabela"></div></div>
    </div>`

  refreshIcons()

  content.querySelector('#repasse-form').addEventListener('submit', (e) => gerar(e, content))

  const columns = [
    {
      header: 'Período',
      search: (r) => `${formatDate(r.data_inicial)} ${formatDate(r.data_final)}`,
      cell: (r) => `<span class="whitespace-nowrap text-slate-700">${formatDate(r.data_inicial)} – ${formatDate(r.data_final)}</span>`,
    },
    { header: 'Lucro bruto', align: 'right', cell: (r) => formatBRL(r.lucro_bruto_periodo) },
    { header: '%', align: 'right', cell: (r) => formatPercent(r.percentual) },
    { header: 'Valor repasse', align: 'right', cell: (r) => `<span class="font-semibold text-brand-600">${formatBRL(r.valor_repasse)}</span>` },
    {
      header: 'Status',
      align: 'center',
      search: (r) => r.status,
      cell: (r) => `<span class="badge ${r.status === 'pago' ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'}">${r.status === 'pago' ? 'Pago' : 'Pendente'}</span>`,
    },
    { header: 'Pago em', cell: (r) => formatDate(r.data_pagamento) },
    {
      header: 'Ações',
      align: 'right',
      cell: (r) => `
        <div class="flex justify-end gap-1">
          <button data-action="ver" data-id="${r.id}" class="rounded-lg p-2 text-slate-500 hover:bg-slate-100" title="Ver vendas"><i data-lucide="eye" class="h-4 w-4"></i></button>
          ${r.status === 'pendente' ? `<button data-action="pagar" data-id="${r.id}" class="rounded-lg p-2 text-green-600 hover:bg-green-50" title="Marcar como pago"><i data-lucide="check-circle-2" class="h-4 w-4"></i></button>` : ''}
        </div>`,
    },
  ]

  createDataTable(document.getElementById('tabela'), {
    columns,
    rows: repasses,
    rowKey: (r) => r.id,
    searchPlaceholder: 'Buscar por período ou status…',
    emptyTitle: 'Nenhum repasse gerado',
    emptyDescription: 'Gere o primeiro repasse a partir das vendas de um período.',
    onAction: async (action, _id, r) => {
      if (action === 'ver') verVendas(r)
      else if (action === 'pagar') await pagar(r, content)
    },
  })
}

function statCard(label, value, icon, tone) {
  const tones = {
    warning: ['text-amber-600', 'bg-amber-100 text-amber-600'],
    positive: ['text-green-600', 'bg-green-100 text-green-600'],
    brand: ['text-brand-600', 'bg-brand-100 text-brand-600'],
  }
  const [valColor, iconColor] = tones[tone] || ['text-slate-800', 'bg-slate-100 text-slate-500']
  return `
    <div class="card p-4">
      <div class="flex items-start justify-between gap-3">
        <div class="min-w-0">
          <p class="truncate text-xs font-medium uppercase tracking-wide text-slate-500">${label}</p>
          <p class="mt-1 truncate text-2xl font-bold ${valColor}">${value}</p>
        </div>
        <div class="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${iconColor}"><i data-lucide="${icon}" class="h-5 w-5"></i></div>
      </div>
    </div>`
}

async function gerar(e, content) {
  e.preventDefault()
  const dataInicial = content.querySelector('#data-inicial').value
  const dataFinal = content.querySelector('#data-final').value
  const percentual = Number(content.querySelector('#percentual').value) || 10
  const observacao = content.querySelector('#observacao').value.trim() || null
  if (!dataInicial || !dataFinal) return showError('Informe data inicial e final.')
  if (dataFinal < dataInicial) return showError('Data final menor que a inicial.')

  const btn = content.querySelector('#gerar')
  btn.disabled = true
  btn.innerHTML = '<span class="spinner h-4 w-4"></span> Gerando…'
  try {
    const { error } = await supabase.rpc('gerar_repasse', {
      p_data_inicial: dataInicial,
      p_data_final: dataFinal,
      p_percentual: percentual,
      p_observacao: observacao,
    })
    if (error) throw error
    showSuccess('Repasse gerado a partir das vendas do período.')
    await load(content)
  } catch (err) {
    const msg = errMessage(err, 'Erro ao gerar repasse.')
    showError(/Nenhuma venda pendente/i.test(msg) ? 'Nenhuma venda pendente de repasse nesse período.' : msg)
    btn.disabled = false
    btn.innerHTML = '<i data-lucide="plus" class="h-4 w-4"></i> Gerar repasse'
    refreshIcons()
  }
}

async function pagar(r, content) {
  const ok = await confirmDialog({
    title: 'Marcar repasse como pago',
    message: `Confirmar o pagamento de ${formatBRL(r.valor_repasse)}? Isso não altera o histórico das vendas.`,
    confirmLabel: 'Confirmar pagamento',
    danger: false,
  })
  if (!ok) return
  const { error } = await supabase.rpc('marcar_repasse_pago', {
    p_repasse_id: r.id,
    p_data_pagamento: new Date().toISOString(),
  })
  if (error) showError(errMessage(error))
  else {
    showSuccess('Repasse marcado como pago.')
    await load(content)
  }
}

async function verVendas(r) {
  const body = document.createElement('div')
  body.innerHTML = `
    <div class="mb-3 grid grid-cols-2 gap-3 rounded-lg bg-slate-50 p-3 text-sm sm:grid-cols-4">
      ${info('Período', `${formatDate(r.data_inicial)} – ${formatDate(r.data_final)}`)}
      ${info('Lucro bruto', formatBRL(r.lucro_bruto_periodo))}
      ${info('Percentual', formatPercent(r.percentual))}
      ${info('Valor', formatBRL(r.valor_repasse))}
    </div>
    <div id="vendas-lista">${loadingState()}</div>`
  openModal({ title: 'Vendas incluídas no repasse', body, size: 'xl' })

  const { data, error } = await supabase.from('vendas_repasses').select('vendas(*)').eq('repasse_id', r.id)
  const lista = body.querySelector('#vendas-lista')
  if (error) {
    lista.innerHTML = ''
    showError(errMessage(error))
    return
  }
  const vendas = (data || []).map((x) => x.vendas).filter(Boolean)
  if (vendas.length === 0) {
    lista.innerHTML = emptyState({ title: 'Nenhuma venda vinculada' })
    refreshIcons()
    return
  }
  lista.innerHTML = `
    <div class="max-h-[50vh] overflow-auto">
      <table class="tbl">
        <thead><tr>
          <th>Data</th><th>Cliente</th><th>Pagamento</th>
          <th class="text-right">Faturamento</th><th class="text-right">Lucro bruto</th><th class="text-right">Repasse</th>
        </tr></thead>
        <tbody>
          ${vendas
            .map(
              (v) => `<tr>
                <td>${formatDate(v.data_venda)}</td>
                <td>${escapeHtml(v.nome_cliente ?? '—')}</td>
                <td>${labelFormaPagamento(v.forma_pagamento)}</td>
                <td class="text-right">${formatBRL(v.faturamento_total)}</td>
                <td class="text-right">${formatBRL(v.lucro_bruto)}</td>
                <td class="text-right font-semibold text-brand-600">${formatBRL(v.valor_repasse)}</td>
              </tr>`,
            )
            .join('')}
        </tbody>
      </table>
    </div>`
}

function info(label, value) {
  return `<div><p class="text-xs text-slate-500">${label}</p><p class="font-semibold text-slate-700">${value}</p></div>`
}
