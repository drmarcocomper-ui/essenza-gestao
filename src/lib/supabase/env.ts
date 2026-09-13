/**
 * Leitura centralizada das variáveis do Supabase.
 * Falha cedo e com mensagem clara se o .env.local não estiver completo —
 * sem isso o erro só aparece como "Invalid API key" na hora do login.
 */
export function supabaseEnv() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !anonKey) {
    throw new Error(
      "Faltam NEXT_PUBLIC_SUPABASE_URL e/ou NEXT_PUBLIC_SUPABASE_ANON_KEY no .env.local",
    );
  }

  return { url, anonKey };
}
