import { createClient } from '@supabase/supabase-js'

// Admin client using the SECRET key. Bypasses Row Level Security.
// NEVER import this from Client Components or expose to the browser.
export function createAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SECRET_KEY!,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    },
  )
}
