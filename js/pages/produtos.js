import { supabase } from '../supabaseClient.js'
import { getUser } from '../auth.js'
import { mountLayout } from '../layout.js'
import { createDataTable } from '../components/dataTable.js'
import {
  refreshIcons,
  openModal,
  confirmDialog,
  loadingState,
  showSuccess,
  showError,
  errMessage,
  escapeHtml,
} from '../ui.js'
import { formatBRL, formatInt, formatPercent, parseNumber } from '../format.js'
import { metricasProduto } from '../finance.js'
import { CATEGORIAS_SUGERIDAS } from '../labels.js'
import { watch } from '../realtime.js'

let table = null

export async function render() {
  const content = mountLayout({
    activePath: '#/produtos',
    title: 'Produtos',
    subtitle: 'Cadastro e gestão dos produtos',
    actionsHTML: `<button id="novo-produto" class="btn btn-primary"><i data-lucide="plus" class="h-4 w-4"></i> Novo produto</button>`,
  })
  refreshIcons()

  content.innerHTML = loadingState('Carregando produtos…')
  document.getElementById('novo-produto').addEventListener('click', () => openProdutoForm(null))

  await load(content)

  // Tempo real: recarrega a lista quando o estoque muda em qualquer login.
  watch(['produtos', 'movimentacoes_estoque'], () => load(content))
}

async function load(content) {
  const { data, error } = await supabase.from('produtos').select('*').order('nome')
  if (error) {
    showError(errMessage(error))
    content.innerHTML = ''
    return
  }
  const produtos = data || []

  const columns = [
    {
      header: 'Produto',
      search: (p) => `${p.nome} ${p.categoria}`,
      cell: (p) => `
        <div class="flex items-center gap-3">
          ${
            p.imagem_url
              ? `<img src="${escapeHtml(p.imagem_url)}" alt="" class="h-10 w-10 rounded-lg object-cover" />`
              : `<div class="flex h-10 w-10 items-center justify-center rounded-lg bg-slate-100 text-slate-400"><i data-lucide="image-off" class="h-4 w-4"></i></div>`
          }
          <div class="min-w-0">
            <p class="truncate font-medium text-slate-700">${escapeHtml(p.nome)}</p>
            <p class="truncate text-xs text-slate-400">${escapeHtml(p.categoria)}</p>
          </div>
        </div>`,
    },
    {
      header: 'Estoque',
      align: 'right',
      cell: (p) => {
        const baixo = p.quantidade_estoque <= p.estoque_minimo
        return `<span class="badge ${baixo ? 'bg-red-100 text-red-700' : 'bg-slate-100 text-slate-600'}">
          ${baixo ? '<i data-lucide=\"alert-triangle\" class=\"mr-1 h-3 w-3\"></i>' : ''}${formatInt(p.quantidade_estoque)}
        </span>`
      },
    },
    { header: 'Custo', align: 'right', cell: (p) => formatBRL(p.custo_unitario) },
    { header: 'Preço', align: 'right', cell: (p) => formatBRL(p.preco_venda) },
    { header: 'Margem', align: 'right', cell: (p) => formatPercent(metricasProduto(p).margem) },
    { header: 'Investido', align: 'right', cell: (p) => formatBRL(metricasProduto(p).investidoTotal) },
    {
      header: 'Status',
      align: 'center',
      cell: (p) =>
        `<span class="badge ${p.ativo ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-500'}">${p.ativo ? 'Ativo' : 'Inativo'}</span>`,
    },
    {
      header: 'Ações',
      align: 'right',
      cell: (p) => `
        <div class="flex justify-end gap-1">
          <button data-action="edit" data-id="${p.id}" class="rounded-lg p-2 text-slate-500 hover:bg-slate-100" title="Editar"><i data-lucide="pencil" class="h-4 w-4"></i></button>
          <button data-action="toggle" data-id="${p.id}" class="rounded-lg p-2 text-slate-500 hover:bg-slate-100" title="${p.ativo ? 'Inativar' : 'Ativar'}"><i data-lucide="power" class="h-4 w-4"></i></button>
          <button data-action="delete" data-id="${p.id}" class="rounded-lg p-2 text-red-500 hover:bg-red-50" title="Excluir"><i data-lucide="trash-2" class="h-4 w-4"></i></button>
        </div>`,
    },
  ]

  table = createDataTable(content, {
    columns,
    rows: produtos,
    rowKey: (p) => p.id,
    searchPlaceholder: 'Buscar por nome ou categoria…',
    emptyTitle: 'Nenhum produto cadastrado',
    emptyDescription: 'Clique em “Novo produto” para começar.',
    onAction: async (action, _id, p) => {
      if (action === 'edit') openProdutoForm(p)
      else if (action === 'toggle') await toggleAtivo(p, content)
      else if (action === 'delete') await excluir(p, content)
    },
  })
}

async function toggleAtivo(p, content) {
  const { error } = await supabase.from('produtos').update({ ativo: !p.ativo }).eq('id', p.id)
  if (error) showError(errMessage(error))
  else {
    showSuccess(p.ativo ? 'Produto inativado.' : 'Produto ativado.')
    await load(content)
  }
}

async function excluir(p, content) {
  const ok = await confirmDialog({
    title: 'Excluir produto',
    message: `Excluir “${p.nome}”? Produtos com vendas não podem ser excluídos — nesse caso, inative-o.`,
    confirmLabel: 'Excluir',
  })
  if (!ok) return
  const { error } = await supabase.from('produtos').delete().eq('id', p.id)
  if (error) {
    showError('Não foi possível excluir (o produto possui vendas/movimentações). Inative-o.')
  } else {
    showSuccess('Produto excluído.')
    await load(content)
  }
}

function openProdutoForm(produto) {
  const editing = !!produto
  const p = produto || {}

  const formEl = document.createElement('form')
  formEl.className = 'space-y-4'
  formEl.innerHTML = `
    <div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
      <div class="sm:col-span-2">
        <label class="label">Nome do produto *</label>
        <input name="nome" class="input" value="${escapeHtml(p.nome || '')}" required />
      </div>
      <div>
        <label class="label">Categoria</label>
        <input name="categoria" class="input" list="cats" value="${escapeHtml(p.categoria || 'Geral')}" />
        <datalist id="cats">${CATEGORIAS_SUGERIDAS.map((c) => `<option value="${c}"></option>`).join('')}</datalist>
      </div>
      <div>
        <label class="label">Status</label>
        <select name="ativo" class="input">
          <option value="ativo" ${p.ativo !== false ? 'selected' : ''}>Ativo</option>
          <option value="inativo" ${p.ativo === false ? 'selected' : ''}>Inativo</option>
        </select>
      </div>
      <div class="sm:col-span-2">
        <label class="label">Descrição</label>
        <textarea name="descricao" class="input" style="min-height:70px">${escapeHtml(p.descricao || '')}</textarea>
      </div>
      <div>
        <label class="label">Custo de compra (un.) *</label>
        <input name="custo" type="number" step="0.01" min="0" class="input" value="${p.custo_unitario ?? 0}" />
      </div>
      <div>
        <label class="label">Preço de venda (un.) *</label>
        <input name="preco" type="number" step="0.01" min="0" class="input" value="${p.preco_venda ?? 0}" />
      </div>
      ${
        editing
          ? `<div>
              <label class="label">Estoque atual</label>
              <input class="input" value="${formatInt(p.quantidade_estoque)}" disabled />
              <p class="mt-1 text-xs text-slate-400">Ajuste pelo módulo de Movimentações.</p>
            </div>`
          : `<div>
              <label class="label">Quantidade inicial</label>
              <input name="quantidade_inicial" type="number" step="1" min="0" class="input" value="0" />
            </div>`
      }
      <div>
        <label class="label">Estoque mínimo</label>
        <input name="estoque_minimo" type="number" step="1" min="0" class="input" value="${p.estoque_minimo ?? 0}" />
      </div>
      <div class="sm:col-span-2">
        <label class="label">Foto do produto (opcional)</label>
        <input name="imagem" type="file" accept="image/*" class="input" />
        ${
          editing && p.imagem_url
            ? `<div class="mt-2 flex items-center gap-2 text-xs text-slate-500"><img src="${escapeHtml(p.imagem_url)}" class="h-12 w-12 rounded object-cover" /> Imagem atual</div>`
            : ''
        }
      </div>
    </div>

    <div class="rounded-lg border border-slate-200 bg-slate-50 p-3">
      <p class="mb-2 flex items-center gap-1 text-xs font-semibold uppercase text-slate-500"><i data-lucide="package" class="h-3.5 w-3.5"></i> Cálculos automáticos</p>
      <div id="calc" class="grid grid-cols-2 gap-x-4 gap-y-1 text-sm sm:grid-cols-3"></div>
    </div>`

  const footer = document.createElement('div')
  footer.className = 'flex gap-3'
  footer.innerHTML = `
    <button data-cancel class="btn btn-secondary">Cancelar</button>
    <button data-save class="btn btn-primary">${editing ? 'Salvar alterações' : 'Cadastrar'}</button>`

  const modal = openModal({
    title: editing ? 'Editar produto' : 'Novo produto',
    body: formEl,
    footer,
    size: 'lg',
  })

  const calcEl = formEl.querySelector('#calc')
  function updateCalc() {
    const quantidade = editing
      ? p.quantidade_estoque
      : Math.trunc(parseNumber(formEl.quantidade_inicial?.value))
    const m = metricasProduto({
      quantidade_estoque: quantidade || 0,
      custo_unitario: parseNumber(formEl.custo.value),
      preco_venda: parseNumber(formEl.preco.value),
    })
    const row = (label, value) =>
      `<div class="flex justify-between gap-2 sm:block"><span class="text-slate-500">${label}</span><span class="font-semibold text-slate-700">${value}</span></div>`
    calcEl.innerHTML =
      row('Lucro / unidade', formatBRL(m.lucroUnidade)) +
      row('Margem', formatPercent(m.margem)) +
      row('Investido no estoque', formatBRL(m.investidoTotal)) +
      row('Potencial de venda', formatBRL(m.potencialVenda)) +
      row('Lucro potencial', formatBRL(m.lucroPotencial))
  }
  updateCalc()
  ;['custo', 'preco', 'quantidade_inicial'].forEach((name) => {
    formEl[name]?.addEventListener('input', updateCalc)
  })
  refreshIcons()

  footer.querySelector('[data-cancel]').addEventListener('click', () => modal.close())

  const submit = async (e) => {
    e?.preventDefault()
    const user = getUser()
    if (!user) return
    const nome = formEl.nome.value.trim()
    const custo = parseNumber(formEl.custo.value)
    const preco = parseNumber(formEl.preco.value)
    const minimo = Math.trunc(parseNumber(formEl.estoque_minimo.value))
    if (!nome) return showError('Informe o nome do produto.')
    if (custo < 0 || preco < 0 || minimo < 0) return showError('Valores não podem ser negativos.')

    const saveBtn = footer.querySelector('[data-save]')
    saveBtn.disabled = true
    saveBtn.innerHTML = '<span class="spinner h-4 w-4"></span> Salvando…'

    const file = formEl.imagem.files[0] || null
    const ativo = formEl.ativo.value === 'ativo'
    const descricao = formEl.descricao.value.trim() || null
    const categoria = formEl.categoria.value.trim() || 'Geral'

    try {
      if (editing) {
        let imagem_url = p.imagem_url
        if (file) imagem_url = await uploadImagem(file, user.id, p.id)
        const { error } = await supabase
          .from('produtos')
          .update({ nome, categoria, descricao, estoque_minimo: minimo, custo_unitario: custo, preco_venda: preco, ativo, imagem_url })
          .eq('id', p.id)
        if (error) throw error
        showSuccess('Produto atualizado com sucesso!')
      } else {
        const { data: created, error } = await supabase
          .from('produtos')
          .insert({ nome, categoria, descricao, quantidade_estoque: 0, estoque_minimo: minimo, custo_unitario: custo, preco_venda: preco, ativo, user_id: user.id })
          .select()
          .single()
        if (error) throw error

        const inicial = Math.trunc(parseNumber(formEl.quantidade_inicial.value))
        if (inicial > 0) {
          const { error: movErr } = await supabase.rpc('registrar_movimentacao', {
            p_produto_id: created.id,
            p_tipo: 'entrada',
            p_quantidade: inicial,
            p_motivo: 'Estoque inicial (cadastro)',
            p_observacao: null,
          })
          if (movErr) throw movErr
        }
        if (file) {
          const imagem_url = await uploadImagem(file, user.id, created.id)
          if (imagem_url) await supabase.from('produtos').update({ imagem_url }).eq('id', created.id)
        }
        showSuccess('Produto cadastrado com sucesso!')
      }
      modal.close()
      const content = document.getElementById('content')
      await load(content)
    } catch (err) {
      showError(errMessage(err, 'Erro ao salvar produto.'))
      saveBtn.disabled = false
      saveBtn.innerHTML = editing ? 'Salvar alterações' : 'Cadastrar'
    }
  }

  footer.querySelector('[data-save]').addEventListener('click', submit)
  formEl.addEventListener('submit', submit)
}

async function uploadImagem(file, userId, produtoId) {
  const ext = (file.name.split('.').pop() || 'jpg').toLowerCase()
  const path = `${userId}/${produtoId}-${Date.now()}.${ext}`
  const { error } = await supabase.storage.from('produtos').upload(path, file, { upsert: true, contentType: file.type })
  if (error) throw error
  const { data } = supabase.storage.from('produtos').getPublicUrl(path)
  return data.publicUrl
}
