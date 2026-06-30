import type { NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'

function jsonError(message: string, status: number) {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return jsonError('Unauthorized', 401)

  let body: { title?: string }
  try {
    body = await req.json()
  } catch {
    return jsonError('Invalid JSON body', 400)
  }

  const title = typeof body.title === 'string' ? body.title.trim() : ''
  if (!title) return jsonError('title is required', 400)

  const { data, error } = await supabase
    .from('canvases')
    .update({ title })
    .eq('id', id)
    .select('id, title, updated_at')
    .single()

  if (error) return jsonError(error.message, 500)
  return Response.json({ canvas: data })
}
