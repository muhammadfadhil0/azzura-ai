import type { NextRequest } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { createClient as createServerSupabase } from '@/lib/supabase/server'
import { signGeneratedFileDownloadUrl } from '@/lib/supabase/generated-files'

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  if (!id) return new Response('Not found', { status: 404 })

  const supabase = await createServerSupabase()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return new Response('Unauthorized', { status: 401 })

  const admin = createAdminClient()
  const { data: row } = await admin
    .from('skill_executions')
    .select('user_id, status, file_storage_path, file_name')
    .eq('id', id)
    .maybeSingle()

  if (
    !row ||
    row.user_id !== user.id ||
    row.status !== 'success' ||
    !row.file_storage_path
  ) {
    return new Response('Not found', { status: 404 })
  }

  try {
    const signedUrl = await signGeneratedFileDownloadUrl(
      admin,
      row.file_storage_path as string,
      (row.file_name as string | null) ?? 'download',
    )
    return Response.redirect(signedUrl, 302)
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('[generated-files/download] sign failed', msg)
    return new Response('Signing failed', { status: 500 })
  }
}
