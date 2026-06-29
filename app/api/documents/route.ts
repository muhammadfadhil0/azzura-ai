import type { NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { parseDocument, SUPPORTED_DOC_MIME } from '@/lib/rag/parse'
import { chunkBlocks } from '@/lib/rag/chunker'
import { embedTexts } from '@/lib/ai/embeddings'
import { buildDocumentPath, uploadDocumentFile } from '@/lib/rag/storage'

export const runtime = 'nodejs'
export const maxDuration = 60

const MAX_FILE_BYTES = 25 * 1024 * 1024
const MAX_DOCS_PER_CONVERSATION = 5
const EMBED_BATCH = 96
const CHUNK_INSERT_BATCH = 100

function inferMimeFromName(name: string): string | null {
  const lower = name.toLowerCase()
  if (lower.endsWith('.pdf')) return 'application/pdf'
  if (lower.endsWith('.docx')) {
    return 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  }
  if (lower.endsWith('.txt')) return 'text/plain'
  if (lower.endsWith('.md')) return 'text/markdown'
  return null
}

function jsonError(message: string, status: number) {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return jsonError('Unauthorized', 401)

  let form: FormData
  try {
    form = await req.formData()
  } catch {
    return jsonError('Invalid form data', 400)
  }

  const file = form.get('file')
  const conversationId = form.get('conversationId')

  if (!(file instanceof File)) return jsonError('file is required', 400)
  if (typeof conversationId !== 'string' || !conversationId) {
    return jsonError('conversationId is required', 400)
  }
  if (file.size > MAX_FILE_BYTES) {
    return jsonError('File exceeds 25MB limit', 400)
  }

  const mimeType = SUPPORTED_DOC_MIME.has(file.type)
    ? file.type
    : inferMimeFromName(file.name)
  if (!mimeType) return jsonError('Unsupported file type', 400)

  const { data: conv, error: convErr } = await supabase
    .from('conversations')
    .select('id')
    .eq('id', conversationId)
    .maybeSingle()
  if (convErr || !conv) return jsonError('Conversation not found', 404)

  const { count } = await supabase
    .from('documents')
    .select('id', { count: 'exact', head: true })
    .eq('conversation_id', conversationId)
  if ((count ?? 0) >= MAX_DOCS_PER_CONVERSATION) {
    return jsonError(
      `Maximum ${MAX_DOCS_PER_CONVERSATION} documents per conversation`,
      400,
    )
  }

  const arrayBuffer = await file.arrayBuffer()
  const fileName = file.name
  const sizeBytes = file.size

  const { data: docRow, error: insertErr } = await supabase
    .from('documents')
    .insert({
      conversation_id: conversationId,
      user_id: user.id,
      storage_path: '',
      name: fileName,
      mime_type: mimeType,
      size_bytes: sizeBytes,
      status: 'pending',
    })
    .select('id')
    .single()
  if (insertErr || !docRow) {
    return jsonError(insertErr?.message ?? 'Failed to create document', 500)
  }
  const docId = docRow.id as string
  const path = buildDocumentPath(user.id, conversationId, docId, mimeType)
  const admin = createAdminClient()

  const encoder = new TextEncoder()
  const stream = new ReadableStream({
    async start(controller) {
      const send = (obj: unknown) => {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(obj)}\n\n`))
      }

      try {
        send({
          type: 'doc.created',
          id: docId,
          name: fileName,
          mimeType,
          sizeBytes,
        })

        await uploadDocumentFile(
          supabase,
          path,
          new Blob([arrayBuffer], { type: mimeType }),
          mimeType,
        )
        await admin
          .from('documents')
          .update({ storage_path: path, status: 'parsing' })
          .eq('id', docId)
        send({ type: 'doc.progress', id: docId, phase: 'parsing' })

        const parsed = await parseDocument(arrayBuffer, mimeType, fileName)
        const chunks = chunkBlocks(parsed.blocks)
        if (chunks.length === 0) {
          throw new Error('No readable content extracted from document')
        }

        await admin
          .from('documents')
          .update({
            status: 'embedding',
            page_count: parsed.pageCount ?? null,
          })
          .eq('id', docId)
        send({
          type: 'doc.progress',
          id: docId,
          phase: 'embedding',
          completed: 0,
          total: chunks.length,
        })

        const contents = chunks.map((c) => c.content)
        const embeddings: number[][] = []
        for (let i = 0; i < contents.length; i += EMBED_BATCH) {
          const slice = contents.slice(i, i + EMBED_BATCH)
          const embs = await embedTexts(slice)
          embeddings.push(...embs)
          send({
            type: 'doc.progress',
            id: docId,
            phase: 'embedding',
            completed: Math.min(i + EMBED_BATCH, contents.length),
            total: contents.length,
          })
        }

        const rows = chunks.map((c, i) => ({
          document_id: docId,
          conversation_id: conversationId,
          chunk_index: i,
          content: c.content,
          token_count: c.tokenCount,
          page: c.page ?? null,
          heading: c.heading ?? null,
          paragraph_index: c.paragraphIndex ?? null,
          embedding: `[${embeddings[i].join(',')}]`,
        }))

        for (let i = 0; i < rows.length; i += CHUNK_INSERT_BATCH) {
          const batch = rows.slice(i, i + CHUNK_INSERT_BATCH)
          const { error } = await admin.from('document_chunks').insert(batch)
          if (error) throw error
        }

        await admin
          .from('documents')
          .update({
            status: 'ready',
            chunk_count: chunks.length,
            updated_at: new Date().toISOString(),
          })
          .eq('id', docId)

        send({
          type: 'doc.ready',
          id: docId,
          chunkCount: chunks.length,
          pageCount: parsed.pageCount ?? null,
        })
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err)
        console.error('Document indexing failed', msg)
        try {
          await admin
            .from('documents')
            .update({ status: 'error', error_message: msg })
            .eq('id', docId)
        } catch (updateErr) {
          console.error('Failed to mark doc as error', updateErr)
        }
        send({ type: 'doc.error', id: docId, error: msg })
      } finally {
        controller.enqueue(encoder.encode('data: [DONE]\n\n'))
        controller.close()
      }
    },
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
    },
  })
}

export async function GET(req: NextRequest) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return jsonError('Unauthorized', 401)

  const conversationId = new URL(req.url).searchParams.get('conversationId')
  if (!conversationId) return jsonError('conversationId required', 400)

  const { data, error } = await supabase
    .from('documents')
    .select(
      'id, message_id, name, mime_type, size_bytes, status, page_count, chunk_count, error_message, created_at',
    )
    .eq('conversation_id', conversationId)
    .order('created_at', { ascending: true })

  if (error) return jsonError(error.message, 500)
  return Response.json({ documents: data ?? [] })
}
