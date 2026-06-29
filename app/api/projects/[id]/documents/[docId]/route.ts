import type { NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { removeDocumentFile } from '@/lib/rag/storage'

function jsonError(message: string, status: number) {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; docId: string }> },
) {
  const { docId } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return jsonError('Unauthorized', 401)

  const { data: doc } = await supabase
    .from('documents')
    .select('id, storage_path')
    .eq('id', docId)
    .maybeSingle()

  if (doc?.storage_path) {
    try {
      await removeDocumentFile(supabase, doc.storage_path)
    } catch {
      // ignore storage errors — delete DB record anyway
    }
  }

  const { error } = await supabase.from('documents').delete().eq('id', docId)
  if (error) return jsonError(error.message, 500)
  return Response.json({ id: docId, deleted: true })
}
