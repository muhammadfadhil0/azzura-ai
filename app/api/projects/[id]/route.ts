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

  const { data: project, error } = await supabase
    .from('projects')
    .select('id, name, description, icon, created_at, updated_at')
    .eq('id', id)
    .maybeSingle()

  if (error) return jsonError(error.message, 500)
  if (!project) return jsonError('Project not found', 404)

  const { data: documents } = await supabase
    .from('documents')
    .select('id, name, mime_type, size_bytes, status, page_count, chunk_count, error_message, created_at')
    .eq('project_id', id)
    .is('conversation_id', null)
    .order('created_at', { ascending: true })

  return Response.json({ project, documents: documents ?? [] })
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return jsonError('Unauthorized', 401)

  let body: { name?: string; description?: string; icon?: string }
  try {
    body = await req.json()
  } catch {
    return jsonError('Invalid JSON body', 400)
  }

  const patch: Record<string, string | null> = { updated_at: new Date().toISOString() }
  if (typeof body.name === 'string' && body.name.trim()) patch.name = body.name.trim()
  if (typeof body.description === 'string') patch.description = body.description.trim() || null
  if (typeof body.icon === 'string') patch.icon = body.icon.trim() || null

  const { data, error } = await supabase
    .from('projects')
    .update(patch)
    .eq('id', id)
    .select('id, name, description, icon, updated_at')
    .single()

  if (error) return jsonError(error.message, 500)
  return Response.json({ project: data })
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return jsonError('Unauthorized', 401)

  const { error } = await supabase.from('projects').delete().eq('id', id)
  if (error) return jsonError(error.message, 500)
  return Response.json({ id, deleted: true })
}
