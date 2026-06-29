import type { NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { chunkBlocks } from '@/lib/rag/chunker'
import { embedTexts } from '@/lib/ai/embeddings'
import { countWordsInBlocks, type ParsedBlock } from '@/lib/rag/parse'

export const runtime = 'nodejs'
export const maxDuration = 60

const EMBED_BATCH = 96
const CHUNK_INSERT_BATCH = 100

function jsonError(message: string, status: number) {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: projectId } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return jsonError('Unauthorized', 401)

  const { data: project } = await supabase
    .from('projects')
    .select('id')
    .eq('id', projectId)
    .maybeSingle()
  if (!project) return jsonError('Project not found', 404)

  let body: { content?: string; title?: string }
  try {
    body = await req.json()
  } catch {
    return jsonError('Invalid JSON body', 400)
  }

  const content = typeof body.content === 'string' ? body.content.trim() : ''
  if (!content) return jsonError('content is required', 400)
  const title = typeof body.title === 'string' && body.title.trim() ? body.title.trim() : 'Note'

  const admin = createAdminClient()

  const { data: docRow, error: insertErr } = await admin
    .from('documents')
    .insert({
      project_id: projectId,
      user_id: user.id,
      storage_path: '',
      name: title,
      mime_type: 'text/plain',
      size_bytes: new TextEncoder().encode(content).length,
      status: 'pending',
    })
    .select('id')
    .single()

  if (insertErr || !docRow) {
    console.error('Failed to insert project note', insertErr?.message)
    return jsonError(insertErr?.message ?? 'Failed to create note', 500)
  }
  const docId = docRow.id as string

  const encoder = new TextEncoder()
  const stream = new ReadableStream({
    async start(controller) {
      const send = (obj: unknown) =>
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(obj)}\n\n`))

      try {
        send({ type: 'doc.created', id: docId, name: title, mimeType: 'text/plain', sizeBytes: new TextEncoder().encode(content).length })

        await admin.from('documents').update({ status: 'embedding' }).eq('id', docId)

        const blocks: ParsedBlock[] = content
          .split(/\n\n+/)
          .map((p, i) => ({ text: p.trim(), paragraphIndex: i }))
          .filter((b) => b.text.length > 0)

        const chunks = chunkBlocks(blocks)
        if (chunks.length === 0) throw new Error('No content to index')

        const wordCount = countWordsInBlocks(blocks)
        await admin.from('documents').update({ word_count: wordCount }).eq('id', docId)

        send({ type: 'doc.progress', id: docId, phase: 'embedding', completed: 0, total: chunks.length })

        const contents = chunks.map((c) => c.content)
        const embeddings: number[][] = []
        for (let i = 0; i < contents.length; i += EMBED_BATCH) {
          const embs = await embedTexts(contents.slice(i, i + EMBED_BATCH))
          embeddings.push(...embs)
          send({ type: 'doc.progress', id: docId, phase: 'embedding', completed: Math.min(i + EMBED_BATCH, contents.length), total: contents.length })
        }

        const rows = chunks.map((c, i) => ({
          document_id: docId,
          project_id: projectId,
          chunk_index: i,
          content: c.content,
          token_count: c.tokenCount,
          page: null,
          heading: null,
          paragraph_index: c.paragraphIndex ?? null,
          embedding: `[${embeddings[i].join(',')}]`,
        }))

        for (let i = 0; i < rows.length; i += CHUNK_INSERT_BATCH) {
          const { error } = await admin.from('document_chunks').insert(rows.slice(i, i + CHUNK_INSERT_BATCH))
          if (error) throw error
        }

        await admin.from('documents').update({ status: 'ready', chunk_count: chunks.length, updated_at: new Date().toISOString() }).eq('id', docId)
        send({ type: 'doc.ready', id: docId, chunkCount: chunks.length, pageCount: null, wordCount })
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err)
        try {
          await admin.from('documents').update({ status: 'error', error_message: msg }).eq('id', docId)
        } catch { /* ignore */ }
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
