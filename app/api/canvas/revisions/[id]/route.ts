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
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return jsonError('Unauthorized', 401)

  const { data: revision, error } = await supabase
    .from('canvas_revisions')
    .select(
      'id, canvas_id, conversation_id, message_id, revision_index, content, word_count, source, mode, prev_revision_id, created_at',
    )
    .eq('id', id)
    .maybeSingle()

  if (error) return jsonError(error.message, 500)
  if (!revision) return jsonError('Revision not found', 404)
  return Response.json({ revision })
}
