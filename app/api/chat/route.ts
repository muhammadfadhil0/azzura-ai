import type { ChatCompletionMessageParam } from 'openai/resources/chat/completions'
import { adacode, ADACODE_MODEL } from '@/lib/ai/adacode'
import { gemini, isGeminiModel } from '@/lib/ai/gemini'
import { toOpenAIMessages } from '@/lib/ai/messages'
import {
  domainOf,
  tavilyExtract,
  tavilySearch,
  truncate,
} from '@/lib/ai/tavily'
import { buildRagSystemMessage, retrieveChunks } from '@/lib/rag/retrieve'
import { createAdminClient } from '@/lib/supabase/admin'

const EXTRACT_TOP_N = 4
const EXTRACT_CHAR_LIMIT = 6000
import type { Message } from '@/types/chat'

export async function POST(req: Request) {
  let body: {
    messages?: Message[]
    model?: string
    webSearch?: boolean
    assistantMessageId?: string
    conversationId?: string
  }
  try {
    body = await req.json()
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON body' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  const messages = body.messages
  if (!Array.isArray(messages) || messages.length === 0) {
    return new Response(
      JSON.stringify({ error: 'messages must be a non-empty array' }),
      { status: 400, headers: { 'Content-Type': 'application/json' } },
    )
  }

  const model =
    typeof body.model === 'string' && body.model.trim()
      ? body.model.trim()
      : ADACODE_MODEL
  const webSearch = body.webSearch === true
  const assistantMessageId =
    typeof body.assistantMessageId === 'string' ? body.assistantMessageId : ''
  const conversationId =
    typeof body.conversationId === 'string' && body.conversationId.trim()
      ? body.conversationId.trim()
      : null

  const encoder = new TextEncoder()
  const stream = new ReadableStream({
    async start(controller) {
      const send = (obj: unknown) => {
        controller.enqueue(
          encoder.encode(`data: ${JSON.stringify(obj)}\n\n`),
        )
      }

      try {
        const convo: ChatCompletionMessageParam[] = toOpenAIMessages(messages, {
          webSearch,
        })

        if (webSearch) {
          const lastUser = [...messages].reverse().find((m) => m.role === 'user')
          const query = lastUser?.content?.trim() ?? ''

          if (query) {
            send({
              type: 'web_search.start',
              messageId: assistantMessageId,
              query,
            })

            try {
              const { results, answer } = await tavilySearch(query, req.signal)

              const topResults = results.slice(0, EXTRACT_TOP_N)
              const topUrls = topResults.map((r) => r.url)

              topResults.forEach((r, index) => {
                send({
                  type: 'web_search.progress',
                  messageId: assistantMessageId,
                  domain: domainOf(r.url),
                  index,
                  total: topResults.length,
                  phase: 'reading',
                })
              })

              let extracted: { url: string; raw_content: string }[] = []
              if (topUrls.length > 0) {
                try {
                  const extractRes = await tavilyExtract(topUrls, req.signal)
                  extracted = extractRes.results
                  extracted.forEach((r, index) => {
                    send({
                      type: 'web_search.progress',
                      messageId: assistantMessageId,
                      domain: domainOf(r.url),
                      index,
                      total: extracted.length,
                      phase: 'extracted',
                    })
                  })
                } catch (extractErr) {
                  const msg =
                    extractErr instanceof Error
                      ? extractErr.message
                      : String(extractErr)
                  send({
                    type: 'web_search.progress',
                    messageId: assistantMessageId,
                    domain: 'extract failed',
                    index: 0,
                    total: 0,
                    phase: 'fallback',
                    error: msg,
                  })
                }
              }

              send({
                type: 'web_search.complete',
                messageId: assistantMessageId,
                count: topResults.length,
                sources: topResults.map((r) => ({
                  url: r.url,
                  domain: domainOf(r.url),
                  title: r.title,
                })),
              })

              if (topResults.length > 0) {
                const extractedByUrl = new Map(
                  extracted.map((e) => [e.url, e.raw_content]),
                )

                const sourcesBlock = topResults
                  .map((r, i) => {
                    const date = r.published_date
                      ? ` (terbit: ${r.published_date})`
                      : ''
                    const full = extractedByUrl.get(r.url)
                    const body = full
                      ? `ISI HALAMAN (extract penuh):\n${truncate(full, EXTRACT_CHAR_LIMIT)}`
                      : `SNIPPET (extract gagal, hanya cuplikan):\n${r.content}`
                    return `===== SUMBER [${i + 1}] =====
Judul: ${r.title}${date}
Domain: ${domainOf(r.url)}
URL: ${r.url}

${body}`
                  })
                  .join('\n\n')

                const answerBlock = answer
                  ? `RINGKASAN AWAL DARI TAVILY (gunakan sebagai petunjuk, tetap verifikasi dengan isi sumber di bawah):\n${answer}\n\n`
                  : ''

                convo.push({
                  role: 'system',
                  content: `Kamu sudah membuka dan membaca ${topResults.length} halaman web untuk query: "${query}"

${answerBlock}=== ISI LENGKAP DARI SETIAP SUMBER ===

${sourcesBlock}

=== TUGASMU ===
Kamu BUKAN sekadar membaca thumbnail. Kamu sudah membaca isi lengkap dari ${topResults.length} halaman di atas. Sekarang lakukan analisis lintas-sumber:

1. **Ekstrak fakta** spesifik (tanggal, angka, nama, skor, jadwal, harga, dll) dari isi halaman, bukan judul atau snippet.
2. **Bandingkan antar sumber**: kalau ada angka/fakta yang sama disebut beberapa sumber, sebut konsensusnya. Kalau ada yang berbeda, tampilkan perbedaannya secara eksplisit (contoh: "Sumber A bilang X, sumber B bilang Y").
3. **Prioritaskan kebaruan**: kalau ada tanggal terbit, pakai yang paling baru saat sumber bertentangan.
4. **Cantumkan sumber inline** dengan format markdown \`[domain](url)\` langsung di akhir kalimat — tanpa kata "Sumber:", "Source:", atau label apapun sebelum link. Wajib, supaya user bisa verifikasi.
5. **Jangan menebak** dari pengetahuan internalmu. Kalau isi halaman tidak menjawab pertanyaan, katakan jujur "sumber yang saya baca tidak memuat info itu" — jangan mengarang penolakan seperti "acaranya belum dimulai" kecuali isi halaman benar-benar mengatakannya.
6. **Struktur jawaban**: untuk pertanyaan yang butuh perbandingan, pakai tabel atau bullet list. Untuk pertanyaan langsung, jawab langsung lalu kasih konteks.`,
                })
              } else {
                convo.push({
                  role: 'system',
                  content: `Pencarian web untuk "${query}" tidak mengembalikan hasil. Katakan jujur ke user bahwa pencarian tidak menemukan apa pun dan sarankan dia mempersempit pertanyaan.`,
                })
              }
            } catch (err) {
              const msg = err instanceof Error ? err.message : String(err)
              send({ error: `Web search failed: ${msg}` })
            }
          }
        }

        if (conversationId) {
          const lastUser = [...messages].reverse().find((m) => m.role === 'user')
          const ragQuery = lastUser?.content?.trim() ?? ''

          if (ragQuery) {
            try {
              const admin = createAdminClient()
              const { count } = await admin
                .from('documents')
                .select('id', { count: 'exact', head: true })
                .eq('conversation_id', conversationId)
                .eq('status', 'ready')

              if ((count ?? 0) > 0) {
                send({
                  type: 'rag.start',
                  messageId: assistantMessageId,
                  query: ragQuery,
                })

                const { chunks, docs } = await retrieveChunks(
                  conversationId,
                  ragQuery,
                )

                if (chunks.length > 0) {
                  const docsById = new Map(docs.map((d) => [d.id, d.name]))
                  convo.push({
                    role: 'system',
                    content: buildRagSystemMessage(chunks, docsById, ragQuery),
                  })
                  send({
                    type: 'rag.complete',
                    messageId: assistantMessageId,
                    count: chunks.length,
                    docs: docs.map((d) => ({ id: d.id, name: d.name })),
                  })
                } else {
                  send({
                    type: 'rag.complete',
                    messageId: assistantMessageId,
                    count: 0,
                    docs: [],
                  })
                }
              }
            } catch (ragErr) {
              const msg =
                ragErr instanceof Error ? ragErr.message : String(ragErr)
              console.error('RAG retrieval failed', msg)
            }
          }
        }

        const client = isGeminiModel(model) ? gemini : adacode
        const completion = await client.chat.completions.create(
          {
            model,
            messages: convo,
            stream: true,
          },
          { signal: req.signal },
        )

        for await (const chunk of completion) {
          const delta = chunk.choices[0]?.delta?.content
          if (delta) {
            send({ delta })
          }
        }

        controller.enqueue(encoder.encode('data: [DONE]\n\n'))
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err)
        controller.enqueue(
          encoder.encode(`data: ${JSON.stringify({ error: message })}\n\n`),
        )
      } finally {
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
