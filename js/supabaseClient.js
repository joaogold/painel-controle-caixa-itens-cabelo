import { createClient } from '@supabase/supabase-js'

const cfg = window.APP_CONFIG || {}

// A SUPABASE_URL precisa ser o endereço COMPLETO (https://SEU-PROJETO.supabase.co),
// e não apenas o ID do projeto. Validamos para nunca passar uma URL inválida ao
// createClient — isso quebraria o app inteiro (tela branca).
function urlValida(u) {
  try {
    const parsed = new URL(String(u))
    return parsed.protocol === 'https:' || parsed.protocol === 'http:'
  } catch {
    return false
  }
}

const urlOk = urlValida(cfg.SUPABASE_URL) && !String(cfg.SUPABASE_URL).includes('SEU-PROJETO')
const keyOk = Boolean(cfg.SUPABASE_ANON_KEY) && !String(cfg.SUPABASE_ANON_KEY).includes('SUA-ANON-KEY')

export const isConfigured = urlOk && keyOk

if (!isConfigured) {
  // eslint-disable-next-line no-console
  console.warn(
    'Supabase não configurado ou URL inválida. ' +
      'SUPABASE_URL deve ser o endereço completo, ex.: https://SEU-PROJETO.supabase.co',
  )
}

// Usa valores seguros (formato válido) quando a configuração estiver incorreta,
// para que o createClient NÃO lance erro no carregamento. A tela de login
// continua acessível e exibe o aviso de configuração.
const safeUrl = urlOk ? cfg.SUPABASE_URL : 'https://placeholder.supabase.co'
const safeKey = keyOk ? cfg.SUPABASE_ANON_KEY : 'placeholder-anon-key'

export const supabase = createClient(safeUrl, safeKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
})
