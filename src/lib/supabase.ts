import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

// Falha cedo e com mensagem clara se as variáveis não estiverem configuradas.
if (!url || !anonKey) {
  // eslint-disable-next-line no-console
  console.error(
    'Variáveis de ambiente do Supabase ausentes. ' +
      'Defina VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY (veja .env.example).',
  )
}

export const supabaseConfigured = Boolean(url && anonKey)

// O cliente é criado mesmo sem config para não quebrar o import;
// a tela exibe um aviso quando supabaseConfigured for false.
export const supabase = createClient(url ?? 'http://localhost', anonKey ?? 'public-anon-key', {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
})
