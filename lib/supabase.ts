import { createBrowserClient } from '@supabase/ssr'

// Singleton — misma instancia en toda la app para mantener la sesión activa
let _client: ReturnType<typeof createBrowserClient> | null = null

export function getClient() {
  if (!_client) {
    _client = createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    )
  }
  return _client
}
