import type { NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { removeDocumentFile } from '@/lib/rag/storage'

export const runtime = 'nodejs'

export async function DELETE(
  _req: NextRequest,
  ctx: RouteContext<'/api/documents/[id]'>,
) {
  const { id } = await ctx.params

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  const { data: doc, error: selErr } = await supabase
    .from('documents')
    .select('id, storage_path')
    .eq('id', id)
    .maybeSingle()
  if (selErr || !doc) {
    return new Response(JSON.stringify({ error: 'Not found' }), {
      status: 404,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  if (doc.storage_path) {
    try {
      await removeDocumentFile(supabase, doc.storage_path)
    } catch (err) {
      console.error('Failed to remove storage file', err)
    }
  }

  const { error: delErr } = await supabase
    .from('documents')
    .delete()
    .eq('id', id)
  if (delErr) {
    return new Response(JSON.stringify({ error: delErr.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  return Response.json({ id, deleted: true })
}
