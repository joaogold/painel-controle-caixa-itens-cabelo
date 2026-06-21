// =============================================================
//  Configuração do Supabase
//  -----------------------------------------------------------
//  1. Copie este arquivo para "config.js" (na mesma pasta).
//  2. Preencha com os dados do seu projeto Supabase:
//       Supabase Dashboard > Project Settings > API
//
//  IMPORTANTE:
//   - Use APENAS a chave "anon public" (ela é segura para o
//     navegador, pois é protegida pelo Row Level Security/RLS).
//   - NUNCA use a chave "service_role" aqui.
//   - O arquivo config.js está no .gitignore (não vai pro Git).
// =============================================================

window.APP_CONFIG = {
  SUPABASE_URL: 'https://SEU-PROJETO.supabase.co',
  SUPABASE_ANON_KEY: 'SUA-ANON-KEY',
}
