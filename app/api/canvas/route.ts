import type { NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'

function jsonError(message: string, status: number) {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

export async function GET(req: NextRequest) {
  const conversationId = req.nextUrl.searchParams.get('conversationId')?.trim()
  if (!conversationId) return jsonError('conversationId is required', 400)

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return jsonError('Unauthorized', 401)

  const { data: canvas } = await supabase
    .from('canvases')
    .select('id, conversation_id, title, current_revision_id, created_at, updated_at')
    .eq('conversation_id', conversationId)
    .maybeSingle()

  if (!canvas) return Response.json({ canvas: null, revisions: [] })

  const { data: revisions } = await supabase
    .from('canvas_revisions')
    .select(
      'id, canvas_id, conversation_id, message_id, revision_index, content, word_count, source, mode, prev_revision_id, created_at',
    )
    .eq('canvas_id', canvas.id)
    .order('revision_index', { ascending: false })
    .limit(20)

  return Response.json({ canvas, revisions: revisions ?? [] })
}
