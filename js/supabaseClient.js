import { createClient } from '@supabase/supabase-js'

const cfg = window.APP_CONFIG || {}

export const isConfigured = Boolean(
  cfg.SUPABASE_URL &&
    cfg.SUPABASE_ANON_KEY &&
    !String(cfg.SUPABASE_URL).includes('SEU-PROJETO') &&
    !String(cfg.SUPABASE_ANON_KEY).includes('SUA-ANON-KEY'),
)

if (!isConfigured) {
  // eslint-disable-next-line no-console
  console.warn(
    'Supabase não configurado. Copie config.example.js para config.js e preencha SUPABASE_URL e SUPABASE_ANON_KEY.',
  )
}

export const supabase = createClient(
  cfg.SUPABASE_URL || 'http://localhost',
  cfg.SUPABASE_ANON_KEY || 'anon-key-placeholder',
  {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
    },
  },
)
