import type { SupabaseClient } from '@supabase/supabase-js'

const BUCKET = 'attachments'
const SIGNED_URL_TTL_SECONDS = 60 * 60 * 24 // 24 hours

const DOC_EXT: Record<string, string> = {
  'application/pdf': '.pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document':
    '.docx',
  'text/plain': '.txt',
  'text/markdown': '.md',
}

export function documentExtension(mimeType: string): string {
  return DOC_EXT[mimeType] ?? ''
}

export function buildDocumentPath(
  userId: string,
  conversationId: string,
  docId: string,
  mimeType: string,
): string {
  return `${userId}/${conversationId}/docs/${docId}${documentExtension(mimeType)}`
}

export function buildProjectDocumentPath(
  userId: string,
  projectId: string,
  docId: string,
  mimeType: string,
): string {
  return `${userId}/projects/${projectId}/docs/${docId}${documentExtension(mimeType)}`
}

export async function uploadDocumentFile(
  supabase: SupabaseClient,
  path: string,
  blob: Blob,
  mimeType: string,
): Promise<void> {
  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(path, blob, { contentType: mimeType, upsert: false })
  if (error) throw error
}

export async function signDocumentUrl(
  supabase: SupabaseClient,
  path: string,
): Promise<string> {
  const { data, error } = await supabase.storage
    .from(BUCKET)
    .createSignedUrl(path, SIGNED_URL_TTL_SECONDS)
  if (error || !data) throw error ?? new Error('Failed to sign document URL')
  return data.signedUrl
}

export async function removeDocumentFile(
  supabase: SupabaseClient,
  path: string,
): Promise<void> {
  const { error } = await supabase.storage.from(BUCKET).remove([path])
  if (error) throw error
}
