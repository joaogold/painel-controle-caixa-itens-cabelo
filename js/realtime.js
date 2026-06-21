import { supabase } from './supabaseClient.js'

// Gerencia UMA assinatura de tempo real por vez (a tela ativa).
// Cada página chama watch(...) ao renderizar; a anterior é descartada.

let activeChannel = null
let debounceTimer = null

/**
 * Observa mudanças (INSERT/UPDATE/DELETE) nas tabelas informadas e chama
 * onChange (com debounce) sempre que algo muda no banco — para qualquer usuário.
 *
 * @param {string[]} tables  ex.: ['produtos','movimentacoes_estoque','vendas']
 * @param {() => void} onChange  callback de atualização da tela
 */
export function watch(tables, onChange) {
  unwatch()
  const channel = supabase.channel('tempo-real-' + Date.now())
  for (const table of tables) {
    channel.on('postgres_changes', { event: '*', schema: 'public', table }, () => {
      // Agrupa rajadas de eventos (ex.: uma venda mexe em vários itens).
      clearTimeout(debounceTimer)
      debounceTimer = setTimeout(() => onChange(), 350)
    })
  }
  channel.subscribe()
  activeChannel = channel
  return channel
}

/** Cancela a assinatura ativa (ao trocar de tela ou sair). */
export function unwatch() {
  clearTimeout(debounceTimer)
  if (activeChannel) {
    supabase.removeChannel(activeChannel)
    activeChannel = null
  }
}
