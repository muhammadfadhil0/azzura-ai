import type { NextRequest } from 'next/server'
import { countWords } from '@/lib/rag/parse'
import { createClient } from '@/lib/supabase/server'

function jsonError(message: string, status: number) {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: canvasId } = await params
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return jsonError('Unauthorized', 401)

  let body: { content?: string }
  try {
    body = await req.json()
  } catch {
    return jsonError('Invalid JSON body', 400)
  }
  if (typeof body.content !== 'string') return jsonError('content is required', 400)
  const content = body.content

  // Verify ownership and fetch conversation_id + current revision.
  const { data: canvas, error: canvasErr } = await supabase
    .from('canvases')
    .select('id, conversation_id, current_revision_id')
    .eq('id', canvasId)
    .maybeSingle()
  if (canvasErr) return jsonError(canvasErr.message, 500)
  if (!canvas) return jsonError('Canvas not found', 404)

  const { data: lastRev } = await supabase
    .from('canvas_revisions')
    .select('id, revision_index')
    .eq('canvas_id', canvasId)
    .order('revision_index', { ascending: false })
    .limit(1)
    .maybeSingle()
  const nextIndex = lastRev ? (lastRev.revision_index as number) + 1 : 0
  const prevRevisionId = lastRev ? (lastRev.id as string) : null

  const { data: rev, error: revErr } = await supabase
    .from('canvas_revisions')
    .insert({
      canvas_id: canvasId,
      conversation_id: canvas.conversation_id,
      message_id: null,
      revision_index: nextIndex,
      content,
      word_count: countWords(content),
      source: 'user',
      mode: 'user',
      prev_revision_id: prevRevisionId,
    })
    .select(
      'id, canvas_id, conversation_id, message_id, revision_index, content, word_count, source, mode, prev_revision_id, created_at',
    )
    .single()
  if (revErr || !rev) return jsonError(revErr?.message ?? 'Insert failed', 500)

  await supabase
    .from('canvases')
    .update({ current_revision_id: rev.id })
    .eq('id', canvasId)

  return Response.json({ revision: rev })
}
