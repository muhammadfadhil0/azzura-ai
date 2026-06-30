import type { SupabaseClient } from '@supabase/supabase-js'

const BUCKET = 'generated-files'
const DOWNLOAD_URL_TTL_SECONDS = 60 * 5

export interface UploadGeneratedFileArgs {
  admin: SupabaseClient
  userId: string
  conversationId: string | null
  executionId: string
  fileName: string
  mimeType: string
  buffer: Buffer
}

export interface UploadGeneratedFileResult {
  storagePath: string
  sizeBytes: number
}

export async function uploadGeneratedFile(
  args: UploadGeneratedFileArgs,
): Promise<UploadGeneratedFileResult> {
  const convSegment = args.conversationId ?? 'no-conv'
  const storagePath = `${args.userId}/${convSegment}/${args.executionId}/${args.fileName}`

  const { error } = await args.admin.storage
    .from(BUCKET)
    .upload(storagePath, args.buffer, {
      contentType: args.mimeType,
      upsert: false,
    })

  if (error) {
    throw new Error(`Failed to upload generated file: ${error.message}`)
  }

  return { storagePath, sizeBytes: args.buffer.byteLength }
}

export async function signGeneratedFileDownloadUrl(
  admin: SupabaseClient,
  storagePath: string,
  fileName: string,
): Promise<string> {
  const { data, error } = await admin.storage
    .from(BUCKET)
    .createSignedUrl(storagePath, DOWNLOAD_URL_TTL_SECONDS, {
      download: fileName,
    })
  if (error || !data) {
    throw new Error(
      `Failed to sign generated file URL: ${error?.message ?? 'unknown'}`,
    )
  }
  return data.signedUrl
}
