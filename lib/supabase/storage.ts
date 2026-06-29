import type { SupabaseClient } from '@supabase/supabase-js'
import type { Attachment } from '@/types/chat'

const BUCKET = 'attachments'
const AVATAR_BUCKET = 'avatars'
const SIGNED_URL_TTL_SECONDS = 60 * 60 * 24 // 24 hours

function mimeExtension(mimeType: string) {
  const map: Record<string, string> = {
    'image/png': '.png',
    'image/jpeg': '.jpg',
    'image/webp': '.webp',
    'image/gif': '.gif',
  }
  return map[mimeType] ?? ''
}

async function dataUrlToBlob(dataUrl: string): Promise<Blob> {
  const res = await fetch(dataUrl)
  return res.blob()
}

export interface UploadedAttachment {
  id: string
  storagePath: string
  name: string
  mimeType: string
  sizeBytes?: number
}

export async function uploadAttachments(
  supabase: SupabaseClient,
  userId: string,
  conversationId: string,
  messageId: string,
  attachments: Attachment[],
): Promise<UploadedAttachment[]> {
  if (attachments.length === 0) return []
  const out: UploadedAttachment[] = []

  for (const att of attachments) {
    if (!att.url.startsWith('data:')) {
      // Already a remote URL — skip upload, keep reference as storage path
      continue
    }
    const blob = await dataUrlToBlob(att.url)
    const path = `${userId}/${conversationId}/${messageId}/${att.id}${mimeExtension(att.mimeType)}`
    const { error } = await supabase.storage
      .from(BUCKET)
      .upload(path, blob, { contentType: att.mimeType, upsert: false })
    if (error) {
      console.error('Failed to upload attachment', error)
      continue
    }
    out.push({
      id: att.id,
      storagePath: path,
      name: att.name,
      mimeType: att.mimeType,
      sizeBytes: att.sizeBytes,
    })
  }

  return out
}

export async function signAttachmentUrls(
  supabase: SupabaseClient,
  rows: Array<{
    id: string
    storage_path: string
    name: string | null
    mime_type: string
    size_bytes: number | null
  }>,
): Promise<Attachment[]> {
  if (rows.length === 0) return []
  const paths = rows.map((r) => r.storage_path)
  const { data, error } = await supabase.storage
    .from(BUCKET)
    .createSignedUrls(paths, SIGNED_URL_TTL_SECONDS)
  if (error || !data) {
    console.error('Failed to sign attachment URLs', error)
    return []
  }
  const byPath = new Map(data.map((d) => [d.path, d.signedUrl]))
  const out: Attachment[] = []
  for (const r of rows) {
    const signed = byPath.get(r.storage_path)
    if (!signed) continue
    out.push({
      id: r.id,
      url: signed,
      thumbUrl: toThumbUrl(signed),
      name: r.name ?? '',
      mimeType: r.mime_type,
      sizeBytes: r.size_bytes ?? undefined,
    })
  }
  return out
}

export async function uploadAvatar(
  supabase: SupabaseClient,
  userId: string,
  dataUrl: string,
  mimeType: string,
): Promise<string> {
  const blob = await dataUrlToBlob(dataUrl)
  const ext = mimeExtension(mimeType) || '.jpg'
  const path = `${userId}/avatar${ext}`
  const { error } = await supabase.storage
    .from(AVATAR_BUCKET)
    .upload(path, blob, { contentType: mimeType, upsert: true })
  if (error) throw error
  const { data } = supabase.storage.from(AVATAR_BUCKET).getPublicUrl(path)
  return data.publicUrl
}

// Convert an `/object/sign/...` signed URL into a render URL with thumbnail
// transform params. The signature token is over bucket+path, so the same
// token works for the `/render/image/sign/` endpoint.
function toThumbUrl(signedUrl: string): string {
  const url = new URL(signedUrl)
  url.pathname = url.pathname.replace(
    '/storage/v1/object/sign/',
    '/storage/v1/render/image/sign/',
  )
  url.searchParams.set('width', '400')
  url.searchParams.set('height', '400')
  url.searchParams.set('resize', 'cover')
  url.searchParams.set('quality', '70')
  return url.toString()
}
