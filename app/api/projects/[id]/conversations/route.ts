import type { NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'

function jsonError(message: string, status: number) {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return jsonError('Unauthorized', 401)

  const { data, error } = await supabase
    .from('conversations')
    .select('id, title, updated_at, active_leaf_message_id')
    .eq('project_id', id)
    .order('updated_at', { ascending: false })

  if (error) return jsonError(error.message, 500)
  return Response.json({ conversations: data ?? [] })
}
