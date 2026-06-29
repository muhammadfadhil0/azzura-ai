import type { NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'

function jsonError(message: string, status: number) {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return jsonError('Unauthorized', 401)

  const { data, error } = await supabase
    .from('projects')
    .select('id, name, description, icon, created_at, updated_at')
    .order('updated_at', { ascending: false })

  if (error) return jsonError(error.message, 500)
  return Response.json({ projects: data ?? [] })
}

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return jsonError('Unauthorized', 401)

  let body: { name?: string; description?: string; icon?: string }
  try {
    body = await req.json()
  } catch {
    return jsonError('Invalid JSON body', 400)
  }

  const name = typeof body.name === 'string' && body.name.trim() ? body.name.trim() : 'New Project'
  const description = typeof body.description === 'string' ? body.description.trim() : null
  const icon = typeof body.icon === 'string' && body.icon.trim() ? body.icon.trim() : null

  const { data, error } = await supabase
    .from('projects')
    .insert({ user_id: user.id, name, description, icon })
    .select('id, name, description, icon, created_at, updated_at')
    .single()

  if (error) return jsonError(error.message, 500)
  return Response.json({ project: data }, { status: 201 })
}
