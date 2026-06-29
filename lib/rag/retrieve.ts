import { createAdminClient } from '@/lib/supabase/admin'
import { embedTexts } from '@/lib/ai/embeddings'
import { truncate } from '@/lib/ai/tavily'

const CHUNK_TRUNCATE_CHARS = 1200

export interface RetrievedChunk {
  id: string
  document_id: string
  content: string
  page: number | null
  heading: string | null
  paragraph_index: number | null
  similarity: number
}

export interface RetrievedDoc {
  id: string
  name: string
}

export async function retrieveChunks(
  conversationId: string,
  query: string,
  k = 6,
  minSimilarity = 0.3,
): Promise<{ chunks: RetrievedChunk[]; docs: RetrievedDoc[] }> {
  const admin = createAdminClient()
  const [embedding] = await embedTexts([query])
  if (!embedding) return { chunks: [], docs: [] }

  const { data, error } = await admin.rpc('match_document_chunks', {
    query_embedding: `[${embedding.join(',')}]`,
    conv_id: conversationId,
    match_count: k,
    min_similarity: minSimilarity,
  })
  if (error) {
    console.error('match_document_chunks RPC failed', error)
    return { chunks: [], docs: [] }
  }
  if (!data || data.length === 0) return { chunks: [], docs: [] }

  const chunks = data as RetrievedChunk[]
  const docIds = Array.from(new Set(chunks.map((c) => c.document_id)))

  const { data: docs } = await admin
    .from('documents')
    .select('id, name')
    .in('id', docIds)

  return {
    chunks,
    docs: ((docs ?? []) as Array<{ id: string; name: string }>).map((d) => ({
      id: d.id,
      name: d.name,
    })),
  }
}

export async function retrieveProjectChunks(
  projectId: string,
  query: string,
  k = 6,
  minSimilarity = 0.3,
): Promise<{ chunks: RetrievedChunk[]; docs: RetrievedDoc[] }> {
  const admin = createAdminClient()
  const [embedding] = await embedTexts([query])
  if (!embedding) return { chunks: [], docs: [] }

  const { data, error } = await admin.rpc('match_project_chunks', {
    query_embedding: `[${embedding.join(',')}]`,
    proj_id: projectId,
    match_count: k,
    min_similarity: minSimilarity,
  })
  if (error) {
    console.error('match_project_chunks RPC failed', error)
    return { chunks: [], docs: [] }
  }
  if (!data || data.length === 0) return { chunks: [], docs: [] }

  const chunks = data as RetrievedChunk[]
  const docIds = Array.from(new Set(chunks.map((c) => c.document_id)))

  const { data: docs } = await admin
    .from('documents')
    .select('id, name')
    .in('id', docIds)

  return {
    chunks,
    docs: ((docs ?? []) as Array<{ id: string; name: string }>).map((d) => ({
      id: d.id,
      name: d.name,
    })),
  }
}

export async function retrieveCombinedChunks(
  conversationId: string | null,
  projectId: string | null,
  query: string,
  k = 8,
): Promise<{ chunks: RetrievedChunk[]; docs: RetrievedDoc[] }> {
  const results = await Promise.all([
    conversationId ? retrieveChunks(conversationId, query, k) : Promise.resolve({ chunks: [], docs: [] }),
    projectId ? retrieveProjectChunks(projectId, query, k) : Promise.resolve({ chunks: [], docs: [] }),
  ])

  const allChunks = [...results[0].chunks, ...results[1].chunks]
  const allDocs = [...results[0].docs, ...results[1].docs]

  const seen = new Set<string>()
  const uniqueChunks = allChunks
    .filter((c) => { if (seen.has(c.id)) return false; seen.add(c.id); return true })
    .sort((a, b) => b.similarity - a.similarity)
    .slice(0, k)

  const usedDocIds = new Set(uniqueChunks.map((c) => c.document_id))
  const seenDocIds = new Set<string>()
  const uniqueDocs = allDocs.filter((d) => {
    if (!usedDocIds.has(d.id) || seenDocIds.has(d.id)) return false
    seenDocIds.add(d.id)
    return true
  })

  return { chunks: uniqueChunks, docs: uniqueDocs }
}

export function buildRagSystemMessage(
  chunks: RetrievedChunk[],
  docsById: Map<string, string>,
  query: string,
): string {
  const kutipan = chunks
    .map((c, i) => {
      const docName = docsById.get(c.document_id) ?? 'dokumen'
      let locator = ''
      if (c.page !== null) locator = `, halaman ${c.page}`
      else if (c.heading) locator = `, § ${c.heading}`
      else if (c.paragraph_index !== null)
        locator = `, paragraf ${c.paragraph_index}`

      const content = truncate(c.content, CHUNK_TRUNCATE_CHARS)
      return `===== KUTIPAN [${i + 1}] (dokumen: "${docName}"${locator}) =====
documentId: ${c.document_id}
${content}`
    })
    .join('\n\n')

  return `User mengupload dokumen di percakapan ini. Berikut ${chunks.length} kutipan paling relevan dengan pertanyaan: "${query}"

${kutipan}

=== ATURAN MENJAWAB ===
1. Jawab berdasarkan isi kutipan di atas. Jangan menebak dari pengetahuan umum.
2. Cantumkan sitasi inline DI AKHIR setiap klaim yang bersumber dari kutipan, dengan format:
   - Halaman PDF: \`[doc:DOCUMENT_ID#p=NOMOR]\`
   - Heading DOCX/MD: \`[doc:DOCUMENT_ID#h=NAMA_HEADING]\`
   - Paragraf TXT: \`[doc:DOCUMENT_ID#para=NOMOR]\`
   Ganti DOCUMENT_ID dengan documentId persis seperti tertulis di kutipan. Frontend akan convert marker ini jadi link viewer — JANGAN ubah formatnya, JANGAN sisipkan teks lain di dalam tanda \`[ ]\`.
3. Jika kutipan tidak memuat jawaban, katakan jujur: "Dokumen tidak memuat info itu." Jangan dipaksa menjawab.
4. Untuk pertanyaan ringkasan, sintesis lintas kutipan dan beri sitasi per poin.`
}
