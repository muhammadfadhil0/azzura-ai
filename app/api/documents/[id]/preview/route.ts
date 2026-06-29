import type { NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { signDocumentUrl } from '@/lib/rag/storage'

export const runtime = 'nodejs'

export async function GET(
  _req: NextRequest,
  ctx: RouteContext<'/api/documents/[id]/preview'>,
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

  const { data: doc, error } = await supabase
    .from('documents')
    .select('id, name, mime_type, storage_path, page_count')
    .eq('id', id)
    .maybeSingle()
  if (error || !doc || !doc.storage_path) {
    return new Response(JSON.stringify({ error: 'Not found' }), {
      status: 404,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  try {
    const url = await signDocumentUrl(supabase, doc.storage_path)
    return Response.json({
      url,
      name: doc.name,
      mimeType: doc.mime_type,
      pageCount: doc.page_count,
    })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    return new Response(JSON.stringify({ error: msg }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    })
  }
}
