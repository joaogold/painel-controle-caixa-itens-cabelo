import { supabase } from '../supabaseClient.js'
import { mountLayout } from '../layout.js'
import { createDataTable } from '../components/dataTable.js'
import { refreshIcons, loadingState, showSuccess, showError, errMessage, escapeHtml } from '../ui.js'
import { formatInt, formatDateTime, parseNumber } from '../format.js'
import { TIPOS_MOVIMENTACAO_MANUAL, labelTipoMov, sentidoTipoMov } from '../labels.js'
import { watch } from '../realtime.js'

let produtos = []

export async function render() {
  const content = mountLayout({
    activePath: '#/movimentacoes',
    title: 'Movimentações de estoque',
    subtitle: 'Entradas, saídas, perdas, ajustes e histórico',
  })
  refreshIcons()
  content.innerHTML = loadingState('Carregando…')

  const { data: prods, error: pErr } = await supabase.from('produtos').select('*').order('nome')
  if (pErr) {
    showError(errMessage(pErr))
    content.innerHTML = ''
    return
  }
  produtos = prods || []

  content.innerHTML = `
    <div class="grid grid-cols-1 gap-5 xl:grid-cols-3">
      <div class="xl:col-span-1">
        <form id="mov-form" class="card sticky top-4 space-y-4 p-4">
          <h3 class="font-semibold text-slate-800">Nova movimentação</h3>
          <div>
            <label class="label">Produto *</label>
            <select id="produto" class="input" required>
              <option value="">Selecione…</option>
              ${produtos.map((p) => `<option value="${p.id}" data-estoque="${p.quantidade_estoque}" data-min="${p.estoque_minimo}">${escapeHtml(p.nome)} (estoque ${formatInt(p.quantidade_estoque)})</option>`).join('')}
            </select>
          </div>
          <div id="estoque-info" class="hidden"></div>
          <div>
            <label class="label">Tipo de movimentação *</label>
            <select id="tipo" class="input">
              ${TIPOS_MOVIMENTACAO_MANUAL.map((t) => `<option value="${t.value}">${t.label}</option>`).join('')}
            </select>
          </div>
          <div>
            <label class="label" id="qtd-label">Quantidade *</label>
            <input id="quantidade" type="number" min="0" step="1" class="input" value="1" required />
            <p id="ajuste-hint" class="mt-1 hidden text-xs text-slate-400">O sistema calcula a diferença e ajusta o estoque para esse valor.</p>
          </div>
          <div>
            <label class="label">Motivo</label>
            <input id="motivo" class="input" placeholder="Ex.: reposição, quebra…" />
          </div>
          <div>
            <label class="label">Observação</label>
            <textarea id="observacao" class="input" style="min-height:60px"></textarea>
          </div>
          <button type="submit" id="salvar" class="btn btn-primary w-full"><i data-lucide="refresh-cw" class="h-4 w-4"></i> Registrar movimentação</button>
          <p class="text-center text-xs text-slate-400">O histórico não pode ser excluído ou editado.</p>
        </form>
      </div>
      <div class="xl:col-span-2">
        <div class="mb-3 flex items-center gap-2 text-slate-700">
          <i data-lucide="history" class="h-5 w-5 text-brand-600"></i>
          <h3 class="font-semibold">Histórico de movimentações</h3>
        </div>
        <div id="hist"></div>
      </div>
    </div>`

  refreshIcons()
  wireForm(content)
  await loadHistorico()

  // Tempo real: atualiza histórico e números de estoque sem mexer no formulário.
  watch(['produtos', 'movimentacoes_estoque', 'vendas'], () => realtimeRefresh(content))
}

async function realtimeRefresh(content) {
  await loadHistorico()
  const { data } = await supabase.from('produtos').select('*').order('nome')
  if (!data) return
  produtos = data
  const sel = content.querySelector('#produto')
  if (!sel) return
  for (const opt of sel.options) {
    const p = produtos.find((x) => x.id === opt.value)
    if (p) {
      opt.dataset.estoque = p.quantidade_estoque
      opt.dataset.min = p.estoque_minimo
      opt.textContent = `${p.nome} (estoque ${formatInt(p.quantidade_estoque)})`
    }
  }
  // Atualiza o aviso de "Estoque atual" do produto selecionado.
  if (sel.value) sel.dispatchEvent(new Event('change'))
}

function wireForm(content) {
  const produtoSel = content.querySelector('#produto')
  const tipoSel = content.querySelector('#tipo')
  const infoEl = content.querySelector('#estoque-info')
  const qtdLabel = content.querySelector('#qtd-label')
  const ajusteHint = content.querySelector('#ajuste-hint')

  function updateInfo() {
    const opt = produtoSel.selectedOptions[0]
    if (!opt || !opt.value) {
      infoEl.classList.add('hidden')
      return
    }
    const estoque = Number(opt.dataset.estoque)
    const min = Number(opt.dataset.min)
    const baixo = estoque <= min
    infoEl.className = `flex items-center justify-between rounded-lg border p-3 text-sm ${baixo ? 'border-amber-200 bg-amber-50 text-amber-700' : 'border-slate-200 bg-slate-50 text-slate-600'}`
    infoEl.innerHTML = `<span>Estoque atual</span><span class="flex items-center gap-1 font-semibold">${baixo ? '<i data-lucide="alert-triangle" class="h-4 w-4"></i>' : ''}${formatInt(estoque)}</span>`
    refreshIcons()
  }
  function updateTipo() {
    const isAjuste = tipoSel.value === 'ajuste'
    qtdLabel.textContent = isAjuste ? 'Nova contagem (estoque real) *' : 'Quantidade *'
    ajusteHint.classList.toggle('hidden', !isAjuste)
  }
  produtoSel.addEventListener('change', updateInfo)
  tipoSel.addEventListener('change', updateTipo)
  updateTipo()

  content.querySelector('#mov-form').addEventListener('submit', async (e) => {
    e.preventDefault()
    const produtoId = produtoSel.value
    const tipo = tipoSel.value
    const qtd = Math.trunc(parseNumber(content.querySelector('#quantidade').value))
    if (!produtoId) return showError('Selecione um produto.')
    if (tipo !== 'ajuste' && qtd <= 0) return showError('Informe uma quantidade maior que zero.')
    if (tipo === 'ajuste' && qtd < 0) return showError('A contagem do ajuste não pode ser negativa.')

    const btn = content.querySelector('#salvar')
    btn.disabled = true
    btn.innerHTML = '<span class="spinner h-4 w-4"></span> Registrando…'
    try {
      const { error } = await supabase.rpc('registrar_movimentacao', {
        p_produto_id: produtoId,
        p_tipo: tipo,
        p_quantidade: qtd,
        p_motivo: content.querySelector('#motivo').value.trim() || null,
        p_observacao: content.querySelector('#observacao').value.trim() || null,
      })
      if (error) throw error
      showSuccess('Movimentação registrada e estoque atualizado.')
      await render() // recarrega tudo (produtos e histórico)
    } catch (err) {
      showError(errMessage(err, 'Erro ao registrar movimentação.'))
      btn.disabled = false
      btn.innerHTML = '<i data-lucide="refresh-cw" class="h-4 w-4"></i> Registrar movimentação'
      refreshIcons()
    }
  })
}

async function loadHistorico() {
  const histEl = document.getElementById('hist')
  if (!histEl) return
  histEl.innerHTML = loadingState('Carregando movimentações…')
  const { data, error } = await supabase
    .from('movimentacoes_estoque')
    .select('*, produtos(nome, categoria)')
    .order('created_at', { ascending: false })
    .limit(500)
  if (error) {
    showError(errMessage(error))
    histEl.innerHTML = ''
    return
  }

  const columns = [
    { header: 'Data/Hora', search: (m) => formatDateTime(m.created_at), cell: (m) => `<span class="whitespace-nowrap">${formatDateTime(m.created_at)}</span>` },
    { header: 'Produto', search: (m) => m.produtos?.nome ?? '', cell: (m) => `<span class="font-medium text-slate-700">${escapeHtml(m.produtos?.nome ?? '—')}</span>` },
    {
      header: 'Tipo',
      search: (m) => labelTipoMov(m.tipo),
      cell: (m) => {
        const s = sentidoTipoMov(m.tipo)
        const cls = s === 'entrada' ? 'bg-green-100 text-green-700' : s === 'saida' ? 'bg-red-100 text-red-700' : 'bg-slate-100 text-slate-600'
        return `<span class="badge ${cls}">${labelTipoMov(m.tipo)}</span>`
      },
    },
    {
      header: 'Qtd.',
      align: 'right',
      cell: (m) => {
        const s = sentidoTipoMov(m.tipo)
        const sign = s === 'entrada' ? '+' : s === 'saida' ? '−' : '±'
        const color = s === 'entrada' ? 'text-green-600' : s === 'saida' ? 'text-red-600' : 'text-slate-600'
        return `<span class="${color}">${sign}${formatInt(m.quantidade)}</span>`
      },
    },
    {
      header: 'Estoque (ant. → atual)',
      align: 'center',
      cell: (m) => `<span class="whitespace-nowrap text-slate-500">${formatInt(m.estoque_anterior)} → <strong class="text-slate-700">${formatInt(m.estoque_atual)}</strong></span>`,
    },
    {
      header: 'Motivo / Obs.',
      search: (m) => `${m.motivo ?? ''} ${m.observacao ?? ''}`,
      cell: (m) => `<div class="max-w-[16rem]"><p class="truncate">${escapeHtml(m.motivo ?? '—')}</p>${m.observacao ? `<p class="truncate text-xs text-slate-400">${escapeHtml(m.observacao)}</p>` : ''}</div>`,
    },
  ]

  createDataTable(histEl, {
    columns,
    rows: data || [],
    rowKey: (m) => m.id,
    searchPlaceholder: 'Buscar por produto, tipo ou motivo…',
    pageSize: 12,
    emptyTitle: 'Nenhuma movimentação registrada',
    emptyDescription: 'As movimentações de estoque aparecerão aqui.',
  })
}
