import { supabase } from '../supabaseClient.js'
import { mountLayout } from '../layout.js'
import { refreshIcons, loadingState, emptyState, showSuccess, showError, showInfo, errMessage } from '../ui.js'
import { formatBRL, formatInt, parseNumber } from '../format.js'
import { calcularItem, somarResultados, PERCENTUAL_REPASSE_PADRAO } from '../finance.js'
import { FORMAS_PAGAMENTO } from '../labels.js'

let produtos = []
let produtoMap = new Map()
let items = []
let counter = 0

export async function render() {
  const content = mountLayout({
    activePath: '#/vendas/nova',
    title: 'Nova venda',
    subtitle: 'Registre uma venda e dê baixa no estoque automaticamente',
  })
  refreshIcons()
  content.innerHTML = loadingState('Carregando produtos…')

  const { data, error } = await supabase.from('produtos').select('*').eq('ativo', true).order('nome')
  if (error) {
    showError(errMessage(error))
    content.innerHTML = ''
    return
  }
  produtos = data || []
  produtoMap = new Map(produtos.map((p) => [p.id, p]))
  items = []

  const now = new Date()
  now.setMinutes(now.getMinutes() - now.getTimezoneOffset())
  const dataLocal = now.toISOString().slice(0, 16)

  content.innerHTML = `
    <div class="grid grid-cols-1 gap-5 xl:grid-cols-3">
      <div class="space-y-5 xl:col-span-2">
        <div class="card p-4">
          <h3 class="mb-3 font-semibold text-slate-800">Itens da venda</h3>
          <div class="flex flex-col gap-2 sm:flex-row">
            <select id="sel-produto" class="input flex-1">
              <option value="">Selecione um produto…</option>
              ${produtos
                .map(
                  (p) =>
                    `<option value="${p.id}" ${p.quantidade_estoque <= 0 ? 'disabled' : ''}>${escapeOpt(p.nome)} — estoque ${formatInt(p.quantidade_estoque)} — ${formatBRL(p.preco_venda)}</option>`,
                )
                .join('')}
            </select>
            <button id="add-item" class="btn btn-primary"><i data-lucide="plus" class="h-4 w-4"></i> Adicionar</button>
          </div>
          <div id="itens-wrap" class="mt-4"></div>
        </div>

        <div class="card p-4">
          <h3 class="mb-3 font-semibold text-slate-800">Dados da venda</h3>
          <div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label class="label">Data da venda</label>
              <input id="data-venda" type="datetime-local" class="input" value="${dataLocal}" />
            </div>
            <div>
              <label class="label">Forma de pagamento</label>
              <select id="pagamento" class="input">
                ${FORMAS_PAGAMENTO.map((f) => `<option value="${f.value}">${f.label}</option>`).join('')}
              </select>
            </div>
            <div>
              <label class="label">Cliente (opcional)</label>
              <input id="cliente" class="input" placeholder="Nome do cliente" />
            </div>
            <div>
              <label class="label">Repasse ao dono (%)</label>
              <input id="percentual" type="number" min="0" max="100" step="0.01" class="input" value="${PERCENTUAL_REPASSE_PADRAO}" />
            </div>
            <div class="sm:col-span-2">
              <label class="label">Observação</label>
              <textarea id="observacao" class="input" style="min-height:60px"></textarea>
            </div>
          </div>
        </div>
      </div>

      <div class="xl:col-span-1">
        <div class="card sticky top-4 p-4">
          <h3 class="mb-3 flex items-center gap-2 font-semibold text-slate-800"><i data-lucide="calculator" class="h-4 w-4 text-brand-600"></i> Resumo financeiro</h3>
          <dl id="resumo" class="space-y-2 text-sm"></dl>
          <button id="finalizar" class="btn btn-primary mt-4 w-full"><i data-lucide="shopping-cart" class="h-4 w-4"></i> Registrar venda</button>
          <p id="erro-estoque" class="mt-2 hidden text-center text-xs text-red-500">Ajuste as quantidades: há itens acima do estoque.</p>
        </div>
      </div>
    </div>`

  content.querySelector('#add-item').addEventListener('click', addItem)
  content.querySelector('#percentual').addEventListener('input', renderResumo)
  content.querySelector('#finalizar').addEventListener('click', finalizar)

  renderItens()
  renderResumo()
  refreshIcons()
}

function escapeOpt(s) {
  return String(s).replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

function getPct() {
  return parseNumber(document.getElementById('percentual')?.value) || 0
}

function addItem() {
  const sel = document.getElementById('sel-produto')
  const id = sel.value
  if (!id) return showError('Selecione um produto.')
  if (items.some((i) => i.produto_id === id)) return showInfo('Produto já está na venda. Ajuste a quantidade na lista.')
  const p = produtoMap.get(id)
  if (!p) return
  if (p.quantidade_estoque <= 0) return showError('Produto sem estoque disponível.')
  items.push({ _key: ++counter, produto_id: id, quantidade: 1, preco_unitario: p.preco_venda, desconto: 0 })
  sel.value = ''
  renderItens()
  renderResumo()
}

function removeItem(key) {
  items = items.filter((i) => i._key !== key)
  renderItens()
  renderResumo()
}

function renderItens() {
  const wrap = document.getElementById('itens-wrap')
  if (!wrap) return
  if (items.length === 0) {
    wrap.innerHTML = emptyState({
      title: 'Nenhum item adicionado',
      description: 'Selecione um produto acima para começar a venda.',
      icon: 'shopping-cart',
    })
    refreshIcons()
    return
  }

  const rows = items
    .map((it) => {
      const p = produtoMap.get(it.produto_id)
      const semEstoque = p ? it.quantidade > p.quantidade_estoque : true
      const sub = calcularItem(it.quantidade, it.preco_unitario, p?.custo_unitario ?? 0, it.desconto, getPct())
      return `
        <tr class="border-b border-slate-100 last:border-0">
          <td class="px-2 py-2">
            <p class="font-medium text-slate-700">${escapeOpt(p?.nome ?? '')}</p>
            <p class="text-xs ${semEstoque ? 'text-red-500' : 'text-slate-400'}" id="warn-${it._key}">Estoque: ${formatInt(p?.quantidade_estoque ?? 0)}${semEstoque ? ' — insuficiente' : ''}</p>
          </td>
          <td class="px-2 py-2"><input data-key="${it._key}" data-field="quantidade" type="number" min="1" step="1" class="input w-20 text-right ${semEstoque ? 'border-red-400' : ''}" value="${it.quantidade}" /></td>
          <td class="px-2 py-2"><input data-key="${it._key}" data-field="preco_unitario" type="number" min="0" step="0.01" class="input w-24 text-right" value="${it.preco_unitario}" /></td>
          <td class="px-2 py-2"><input data-key="${it._key}" data-field="desconto" type="number" min="0" step="0.01" class="input w-20 text-right" value="${it.desconto}" /></td>
          <td class="px-2 py-2 text-right font-semibold text-slate-700" id="sub-${it._key}">${formatBRL(sub.faturamento - sub.desconto)}</td>
          <td class="px-2 py-2 text-right"><button data-remove="${it._key}" class="rounded-lg p-2 text-red-500 hover:bg-red-50" aria-label="Remover"><i data-lucide="trash-2" class="h-4 w-4"></i></button></td>
        </tr>`
    })
    .join('')

  wrap.innerHTML = `
    <div class="overflow-x-auto">
      <table class="w-full text-sm">
        <thead>
          <tr class="border-b border-slate-200 text-xs uppercase text-slate-500">
            <th class="px-2 py-2 text-left font-semibold">Produto</th>
            <th class="px-2 py-2 text-right font-semibold">Qtd.</th>
            <th class="px-2 py-2 text-right font-semibold">Preço un.</th>
            <th class="px-2 py-2 text-right font-semibold">Desc.</th>
            <th class="px-2 py-2 text-right font-semibold">Subtotal</th>
            <th class="px-2 py-2"></th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
    </div>`

  wrap.querySelectorAll('input[data-key]').forEach((input) => {
    input.addEventListener('input', () => {
      const key = Number(input.getAttribute('data-key'))
      const field = input.getAttribute('data-field')
      const it = items.find((i) => i._key === key)
      if (!it) return
      let val = parseNumber(input.value)
      if (field === 'quantidade') val = Math.max(1, Math.trunc(val))
      it[field] = val
      // Atualiza subtotal + aviso de estoque sem perder o foco.
      const p = produtoMap.get(it.produto_id)
      const semEstoque = p ? it.quantidade > p.quantidade_estoque : true
      const sub = calcularItem(it.quantidade, it.preco_unitario, p?.custo_unitario ?? 0, it.desconto, getPct())
      const subEl = document.getElementById(`sub-${key}`)
      if (subEl) subEl.textContent = formatBRL(sub.faturamento - sub.desconto)
      const warnEl = document.getElementById(`warn-${key}`)
      if (warnEl) {
        warnEl.className = `text-xs ${semEstoque ? 'text-red-500' : 'text-slate-400'}`
        warnEl.textContent = `Estoque: ${formatInt(p?.quantidade_estoque ?? 0)}${semEstoque ? ' — insuficiente' : ''}`
      }
      if (field === 'quantidade') input.classList.toggle('border-red-400', semEstoque)
      renderResumo()
    })
  })

  wrap.querySelectorAll('[data-remove]').forEach((b) =>
    b.addEventListener('click', () => removeItem(Number(b.getAttribute('data-remove')))),
  )
  refreshIcons()
}

function computeTotais() {
  const pct = getPct()
  const linhas = items.map((it) => {
    const p = produtoMap.get(it.produto_id)
    return {
      semEstoque: p ? it.quantidade > p.quantidade_estoque : true,
      res: calcularItem(it.quantidade, it.preco_unitario, p?.custo_unitario ?? 0, it.desconto, pct),
    }
  })
  return { totais: somarResultados(linhas.map((l) => l.res)), temErro: linhas.some((l) => l.semEstoque), pct }
}

function renderResumo() {
  const el = document.getElementById('resumo')
  if (!el) return
  const { totais, temErro, pct } = computeTotais()
  const row = (label, value, opts = {}) => {
    const color = opts.tone === 'pos' ? 'text-green-600' : opts.tone === 'neg' ? 'text-red-600' : opts.tone === 'brand' ? 'text-brand-600' : 'text-slate-700'
    return `<div class="flex items-center justify-between"><dt class="text-slate-500">${label}</dt><dd class="${opts.strong ? 'font-bold' : 'font-medium'} ${opts.big ? 'text-lg' : ''} ${color}">${value}</dd></div>`
  }
  el.innerHTML =
    row('Faturamento', formatBRL(totais.faturamento)) +
    row('Custo dos produtos', formatBRL(totais.custo)) +
    row('Desconto', `- ${formatBRL(totais.desconto)}`) +
    '<div class="my-2 border-t border-slate-200"></div>' +
    row('Lucro bruto', formatBRL(totais.lucroBruto), { strong: true, tone: totais.lucroBruto >= 0 ? 'pos' : 'neg' }) +
    row(`Repasse (${pct}%)`, `- ${formatBRL(totais.valorRepasse)}`, { tone: 'brand' }) +
    '<div class="my-2 border-t border-slate-200"></div>' +
    row('Lucro líquido', formatBRL(totais.lucroLiquido), { strong: true, big: true, tone: totais.lucroLiquido >= 0 ? 'pos' : 'neg' })

  const btn = document.getElementById('finalizar')
  const erro = document.getElementById('erro-estoque')
  if (btn) btn.disabled = items.length === 0 || temErro
  if (erro) erro.classList.toggle('hidden', !temErro)
}

async function finalizar() {
  if (items.length === 0) return showError('Adicione ao menos um produto à venda.')
  const { temErro } = computeTotais()
  if (temErro) return showError('Há itens com quantidade acima do estoque disponível.')

  const btn = document.getElementById('finalizar')
  btn.disabled = true
  btn.innerHTML = '<span class="spinner h-4 w-4"></span> Registrando…'

  try {
    const payload = items.map((i) => ({
      produto_id: i.produto_id,
      quantidade: Math.trunc(i.quantidade),
      preco_unitario: i.preco_unitario,
      desconto: i.desconto,
    }))
    const { error } = await supabase.rpc('registrar_venda', {
      p_data_venda: new Date(document.getElementById('data-venda').value).toISOString(),
      p_nome_cliente: document.getElementById('cliente').value.trim() || null,
      p_forma_pagamento: document.getElementById('pagamento').value,
      p_observacao: document.getElementById('observacao').value.trim() || null,
      p_percentual_repasse: getPct(),
      p_itens: payload,
    })
    if (error) throw error
    showSuccess('Venda registrada com sucesso! Estoque atualizado.')
    await render()
  } catch (err) {
    showError(errMessage(err, 'Erro ao registrar a venda.'))
    btn.disabled = false
    btn.innerHTML = '<i data-lucide="shopping-cart" class="h-4 w-4"></i> Registrar venda'
    refreshIcons()
  }
}
