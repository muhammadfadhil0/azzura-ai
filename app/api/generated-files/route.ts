import type { NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import type { GeneratedFileSummary } from '@/types/skills'

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

  const { data, error } = await supabase
    .from('skill_executions')
    .select(
      'id, skill_slug, conversation_id, message_id, file_name, file_mime_type, file_size_bytes, canvas_revision_id, created_at',
    )
    .eq('user_id', user.id)
    .eq('conversation_id', conversationId)
    .eq('status', 'success')
    .order('created_at', { ascending: true })

  if (error) return jsonError(error.message, 500)

  const files: GeneratedFileSummary[] = (data ?? []).map((row) => ({
    id: row.id as string,
    conversationId: row.conversation_id as string,
    messageId: (row.message_id as string | null) ?? null,
    skillSlug: row.skill_slug as string,
    fileName: (row.file_name as string | null) ?? 'untitled',
    mimeType: (row.file_mime_type as string | null) ?? 'application/octet-stream',
    sizeBytes: (row.file_size_bytes as number | null) ?? null,
    downloadUrl: `/api/generated-files/${row.id}/download`,
    canvasRevisionId: (row.canvas_revision_id as string | null) ?? null,
    createdAt: row.created_at as string,
  }))

  return Response.json({ files })
}
