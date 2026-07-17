import type { ChatCompletionTool } from 'openai/resources/chat/completions'
import { domainOf, tavilyExtract, tavilySearch, truncate } from './tavily'
import {
  buildRagSystemMessage,
  execRetrieveOutline,
  retrieveCombinedChunks,
  type RetrievedChunk,
  type RetrievedDoc,
} from '@/lib/rag/retrieve'

export { execRetrieveOutline }
import { countWords } from '@/lib/rag/parse'
import { createAdminClient } from '@/lib/supabase/admin'
import type { CanvasMode, CanvasRevisionResult } from '@/types/canvas'
import { adacode, ADACODE_MODEL } from './adacode'

const EXTRACT_TOP_N = 4
const EXTRACT_CHAR_LIMIT = 6000

const CONTINUATION_STOPLIST = new Set([
  'lanjutkan',
  'lanjut',
  'continue',
  'go on',
  'oke',
  'ok',
  'okay',
  'lagi',
  'more',
  'next',
  'iya',
  'ya',
  'yes',
  'baik',
])

export function isLikelyContinuationQuery(q: string): boolean {
  const normalized = q.trim().toLowerCase().replace(/[.!?,]+$/g, '')
  if (normalized.length < 4) return true
  return CONTINUATION_STOPLIST.has(normalized)
}

const WEB_SEARCH_TOOL: ChatCompletionTool = {
  type: 'function',
  function: {
    name: 'web_search',
    description:
      'Cari informasi terkini di internet via Tavily lalu baca isi halaman top-result. Pakai untuk pertanyaan yang butuh data real-time: berita, jadwal, harga, skor, kurs, cuaca, info terbaru tentang orang/produk/peristiwa.\n\nPENTING — bagaimana menentukan parameter "query":\n1. WAJIB rumuskan ulang query menjadi pertanyaan spesifik berdasarkan KONTEKS PERCAKAPAN, bukan menyalin pesan user mentah.\n2. JANGAN PERNAH mengirim kata kontinuasi/kontrol sebagai query, seperti: "lanjutkan", "oke", "continue", "lagi", "lanjut", "ya", "more", "next". Itu bukan topik pencarian.\n3. Contoh: Kalau user sebelumnya tanya "jadwal MotoGP minggu ini" lalu sekarang kirim "lanjutkan" / "oke saya sudah nyalakan internetnya", query yang BENAR adalah "jadwal MotoGP minggu ini 2026", BUKAN "lanjutkan".\n4. Query harus berdiri sendiri (self-contained) — anggap mesin pencari tidak tahu konteks sebelumnya.\n5. Tambahkan tanda waktu (tahun/bulan) bila relevan supaya hasil tidak basi.',
    parameters: {
      type: 'object',
      additionalProperties: false,
      properties: {
        query: {
          type: 'string',
          description:
            'Query pencarian yang spesifik dan self-contained. Bukan pesan user mentah. Bukan kata kontinuasi.',
        },
      },
      required: ['query'],
    },
  },
}

const WEB_EXTRACT_TOOL: ChatCompletionTool = {
  type: 'function',
  function: {
    name: 'web_extract',
    description:
      'Baca isi penuh dari satu atau beberapa URL spesifik. Pakai HANYA kalau kamu sudah punya URL konkret (mis. user kasih link, atau hasil web_search sebelumnya menunjuk halaman tertentu yang perlu dibaca lebih dalam). Jangan tebak URL.',
    parameters: {
      type: 'object',
      additionalProperties: false,
      properties: {
        urls: {
          type: 'array',
          items: { type: 'string' },
          minItems: 1,
          maxItems: 5,
          description: 'Daftar URL absolut yang ingin dibaca isinya.',
        },
      },
      required: ['urls'],
    },
  },
}

const RETRIEVE_DOCS_TOOL: ChatCompletionTool = {
  type: 'function',
  function: {
    name: 'retrieve_documents',
    description:
      'Ambil kutipan paling relevan dari dokumen yang user upload di percakapan/project ini (RAG). Pakai setiap kali user bertanya tentang isi dokumen, ringkasan, perbandingan, atau apapun yang mungkin tertulis di file yang mereka upload.\n\nPENTING — bagaimana menentukan parameter "query":\n1. WAJIB rumuskan ulang query menjadi pertanyaan spesifik berdasarkan KONTEKS PERCAKAPAN. Embedding model butuh sinyal semantik yang jelas.\n2. JANGAN PERNAH mengirim kata kontinuasi sebagai query: "lanjutkan", "oke", "lagi", "next", dll. Itu tidak punya makna semantik.\n3. Contoh: Kalau user sebelumnya tanya "apa poin utama bab 3" lalu kirim "lanjutkan poin ke-2", query yang BENAR adalah "poin kedua dari bab 3" atau "rincian poin kedua bab 3", BUKAN "lanjutkan poin ke-2" mentah.\n4. Query harus berdiri sendiri.',
    parameters: {
      type: 'object',
      additionalProperties: false,
      properties: {
        query: {
          type: 'string',
          description:
            'Query semantik yang spesifik, self-contained, untuk dicari di embedding dokumen.',
        },
      },
      required: ['query'],
    },
  },
}

const ANALYZE_FULL_DOCUMENT_TOOL: ChatCompletionTool = {
  type: 'function',
  function: {
    name: 'analyze_full_document',
    description:
      'Analisis menyeluruh seluruh isi dokumen menggunakan pendekatan map-reduce. Tool ini membaca SEMUA chunk dokumen (bukan hanya yang relevan secara semantik), mengelompokkannya per heading/bab, lalu meringkas/menganalisis tiap bab secara paralel sebelum menggabungkan hasilnya. Cocok untuk tugas yang butuh pemahaman holistik.\n\nKAPAN PAKAI vs retrieve_documents:\n- retrieve_documents: untuk pertanyaan SPESIFIK (fakta, definisi, bagian tertentu). Contoh trigger: "apa definisi X di dokumen?", "bagaimana metodologi yang dipakai?", "kapan tanggal Y?".\n- analyze_full_document: untuk permintaan ANALISIS MENYELURUH. Contoh trigger: "analisis dokumen ini secara detail", "buat ringkasan komprehensif tiap bab", "identifikasi gap/kelemahan di seluruh dokumen", "bantu kembangkan dokumen ini jadi draft lengkap", "bandingkan temuan di bab 2 vs bab 4 secara mendalam".\n\nPENTING — parameter "instruction":\n1. Deskripsikan secara eksplisit apa yang harus dilakukan pada dokumen. Contoh: "Ringkas setiap bab dalam 3-5 poin utama, lalu identifikasi kesenjangan metodologis."\n2. Jangan kosongkan instruction — tool butuh tahu apa yang harus dianalisis.',
    parameters: {
      type: 'object',
      additionalProperties: false,
      properties: {
        documentId: {
          type: 'string',
          description: 'ID dokumen spesifik yang ingin dianalisis. Ambil dari daftar dokumen yang tersedia.',
        },
        instruction: {
          type: 'string',
          description: 'Instruksi analisis yang spesifik dan deskriptif. Jelaskan apa yang harus dilakukan pada seluruh isi dokumen (mis: "ringkas tiap bab dan identifikasi gap metodologi").',
        },
      },
      required: ['documentId', 'instruction'],
    },
  },
}

const RETRIEVE_OUTLINE_TOOL: ChatCompletionTool = {
  type: 'function',
  function: {
    name: 'retrieve_outline',
    description:
      'Ambil struktur/outline lengkap (semua heading/judul bab) dari dokumen yang diupload. WAJIB pakai tool ini saat user minta: daftar isi, struktur dokumen, bab apa saja yang ada, outline, atau pertanyaan yang butuh gambaran keseluruhan dokumen. JANGAN pakai retrieve_documents untuk kasus ini karena hanya mengambil sebagian kecil berdasarkan kemiripan semantik.',
    parameters: { type: 'object', properties: {}, additionalProperties: false },
  },
}

const WRITE_CANVAS_TOOL: ChatCompletionTool = {
  type: 'function',
  function: {
    name: 'write_canvas',
    description:
      'Tulis atau revisi konten panjang ke Canvas panel. WAJIB pakai tool ini (BUKAN balas di chat) saat user minta artikel, esai, dokumen, draft, atau kode panjang. Juga WAJIB pakai tool ini saat user minta revisi terhadap canvas yang sudah ada.\n\nMODE:\n- "initial": canvas masih kosong, buat dari nol. Wajib mengisi "title".\n- "replace": tulis ulang seluruh isi dengan content baru.\n- "patch": revisi lokal (mis. "ubah paragraf 2", "tambahkan kesimpulan"). TETAP kirim FULL content baru (utuh, dari awal sampai akhir, dengan revisi sudah diterapkan) — UI akan menghitung diff dan menjalankan animasi delete→type sendiri. JANGAN cuma kirim potongan yang berubah.\n\nDi balasan chat (di luar tool call): cukup 1–2 kalimat singkat Bahasa Indonesia yang mengonfirmasi apa yang baru ditulis/diubah. JANGAN ulangi isi canvas di chat.',
    parameters: {
      type: 'object',
      additionalProperties: false,
      properties: {
        title: {
          type: 'string',
          description:
            'Judul singkat untuk dokumen. Wajib pada mode "initial". Boleh diperbarui pada "replace".',
        },
        content: {
          type: 'string',
          description:
            'Isi LENGKAP canvas dalam markdown. Selalu kirim utuh, bukan diff.',
        },
        mode: {
          type: 'string',
          enum: ['initial', 'replace', 'patch'],
          description: 'Lihat deskripsi tool untuk semantik tiap mode.',
        },
      },
      required: ['content', 'mode'],
    },
  },
}

export function buildTools(opts: {
  webSearchEnabled: boolean
  ragAvailable: boolean
  canvasEnabled: boolean
}): ChatCompletionTool[] {
  const tools: ChatCompletionTool[] = []
  if (opts.webSearchEnabled) {
    tools.push(WEB_SEARCH_TOOL, WEB_EXTRACT_TOOL)
  }
  if (opts.ragAvailable) {
    tools.push(RETRIEVE_DOCS_TOOL)
    tools.push(RETRIEVE_OUTLINE_TOOL)
    tools.push(ANALYZE_FULL_DOCUMENT_TOOL)
  }
  if (opts.canvasEnabled) {
    tools.push(WRITE_CANVAS_TOOL)
  }
  return tools
}

export interface WebSearchSource {
  url: string
  domain: string
  title: string
}

export interface WebSearchExecResult {
  query: string
  count: number
  sources: WebSearchSource[]
  contentForLLM: string
}

export type WebSearchProgress =
  | {
      phase: 'reading' | 'extracted' | 'fallback'
      domain: string
      index: number
      total: number
      error?: string
    }

export async function execWebSearch(
  args: { query: string },
  signal: AbortSignal | undefined,
  onProgress?: (p: WebSearchProgress) => void,
): Promise<WebSearchExecResult> {
  const query = args.query?.trim() ?? ''
  if (!query) {
    return {
      query,
      count: 0,
      sources: [],
      contentForLLM:
        'TOOL ERROR: parameter "query" kosong. Rumuskan ulang query yang spesifik berdasarkan konteks percakapan, lalu panggil web_search lagi.',
    }
  }

  if (isLikelyContinuationQuery(query)) {
    return {
      query,
      count: 0,
      sources: [],
      contentForLLM: `TOOL ERROR: query "${query}" terlalu generik atau merupakan kata kontinuasi (mis. "lanjutkan", "oke", "lagi"). Lihat history percakapan, identifikasi topik aslinya, lalu panggil web_search lagi dengan query yang spesifik dan self-contained.`,
    }
  }

  const { results, answer } = await tavilySearch(query, signal)
  const topResults = results.slice(0, EXTRACT_TOP_N)
  const topUrls = topResults.map((r) => r.url)

  topResults.forEach((r, index) => {
    onProgress?.({
      phase: 'reading',
      domain: domainOf(r.url),
      index,
      total: topResults.length,
    })
  })

  let extracted: { url: string; raw_content: string }[] = []
  if (topUrls.length > 0) {
    try {
      const extractRes = await tavilyExtract(topUrls, signal)
      extracted = extractRes.results
      extracted.forEach((r, index) => {
        onProgress?.({
          phase: 'extracted',
          domain: domainOf(r.url),
          index,
          total: extracted.length,
        })
      })
    } catch (extractErr) {
      const msg =
        extractErr instanceof Error ? extractErr.message : String(extractErr)
      onProgress?.({
        phase: 'fallback',
        domain: 'extract failed',
        index: 0,
        total: 0,
        error: msg,
      })
    }
  }

  const sources: WebSearchSource[] = topResults.map((r) => ({
    url: r.url,
    domain: domainOf(r.url),
    title: r.title,
  }))

  if (topResults.length === 0) {
    return {
      query,
      count: 0,
      sources,
      contentForLLM: `Pencarian web untuk "${query}" tidak mengembalikan hasil. Katakan jujur ke user bahwa pencarian tidak menemukan apa pun dan sarankan dia mempersempit pertanyaan.`,
    }
  }

  const extractedByUrl = new Map(extracted.map((e) => [e.url, e.raw_content]))
  const sourcesBlock = topResults
    .map((r, i) => {
      const date = r.published_date ? ` (terbit: ${r.published_date})` : ''
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

  const contentForLLM = `Hasil web_search untuk query: "${query}" (${topResults.length} halaman dibaca)

${answerBlock}=== ISI LENGKAP DARI SETIAP SUMBER ===

${sourcesBlock}

=== ATURAN MEMAKAI HASIL INI ===
1. Ekstrak fakta spesifik (tanggal, angka, nama, skor, jadwal, harga) dari isi halaman, bukan judul/snippet saja.
2. Bandingkan antar sumber. Kalau konsensus, sebut konsensusnya. Kalau berbeda, tampilkan perbedaan eksplisit ("Sumber A bilang X, sumber B bilang Y").
3. Prioritaskan tanggal terbit yang paling baru saat sumber bertentangan.
4. Cantumkan sumber inline dengan format markdown \`[domain](url)\` langsung di akhir kalimat. JANGAN pakai prefix "Sumber:" atau "Source:" — cukup link saja.
5. Jangan menebak dari pengetahuan internalmu. Kalau halaman tidak menjawab, katakan jujur.
6. Untuk perbandingan, pakai tabel/bullet. Untuk pertanyaan langsung, jawab langsung lalu kasih konteks.`

  return {
    query,
    count: topResults.length,
    sources,
    contentForLLM,
  }
}

export interface WebExtractExecResult {
  count: number
  contentForLLM: string
  sources: WebSearchSource[]
}

export async function execWebExtract(
  args: { urls: string[] },
  signal: AbortSignal | undefined,
): Promise<WebExtractExecResult> {
  const urls = (args.urls ?? []).filter((u) => typeof u === 'string' && u.trim())
  if (urls.length === 0) {
    return {
      count: 0,
      sources: [],
      contentForLLM:
        'TOOL ERROR: parameter "urls" kosong. Kirim daftar URL absolut yang ingin dibaca.',
    }
  }

  const res = await tavilyExtract(urls, signal)
  const sources: WebSearchSource[] = res.results.map((r) => ({
    url: r.url,
    domain: domainOf(r.url),
    title: domainOf(r.url),
  }))

  if (res.results.length === 0) {
    return {
      count: 0,
      sources,
      contentForLLM: `web_extract tidak mengembalikan isi untuk URL: ${urls.join(', ')}. Katakan jujur ke user kalau halaman tidak bisa dibaca.`,
    }
  }

  const block = res.results
    .map((r, i) => {
      return `===== HALAMAN [${i + 1}] =====
URL: ${r.url}
Domain: ${domainOf(r.url)}

ISI:
${truncate(r.raw_content, EXTRACT_CHAR_LIMIT)}`
    })
    .join('\n\n')

  return {
    count: res.results.length,
    sources,
    contentForLLM: `Hasil web_extract (${res.results.length} halaman):

${block}

Cantumkan sumber inline dengan format \`[domain](url)\` di akhir kalimat yang merujuk halaman tersebut.`,
  }
}

export interface RagExecResult {
  query: string
  count: number
  docs: RetrievedDoc[]
  chunks: RetrievedChunk[]
  contentForLLM: string
}

export interface AnalyzeFullDocumentResult {
  documentId: string
  documentName: string
  instruction: string
  sectionSummaries: string
  totalChunksProcessed: number
  contentForLLM: string
}

export async function execRetrieveDocs(
  args: { query: string },
  ctx: { conversationId: string | null; projectId: string | null },
): Promise<RagExecResult> {
  const query = args.query?.trim() ?? ''
  if (!query) {
    return {
      query,
      count: 0,
      docs: [],
      chunks: [],
      contentForLLM:
        'TOOL ERROR: parameter "query" kosong. Rumuskan query yang spesifik dari konteks percakapan, lalu panggil retrieve_documents lagi.',
    }
  }

  if (isLikelyContinuationQuery(query)) {
    return {
      query,
      count: 0,
      docs: [],
      chunks: [],
      contentForLLM: `TOOL ERROR: query "${query}" terlalu generik atau merupakan kata kontinuasi. Lihat history, identifikasi topik aslinya, lalu panggil retrieve_documents lagi dengan query yang spesifik.`,
    }
  }

  if (!ctx.conversationId && !ctx.projectId) {
    return {
      query,
      count: 0,
      docs: [],
      chunks: [],
      contentForLLM:
        'TOOL ERROR: tidak ada conversationId/projectId di context — tidak ada dokumen untuk dicari. Jawab tanpa retrieve_documents.',
    }
  }

  const { chunks, docs } = await retrieveCombinedChunks(
    ctx.conversationId,
    ctx.projectId,
    query,
  )

  if (chunks.length === 0) {
    return {
      query,
      count: 0,
      docs,
      chunks,
      contentForLLM: `retrieve_documents untuk query "${query}" tidak menemukan kutipan yang cukup relevan. Katakan jujur ke user kalau dokumen yang diupload tidak memuat info itu — jangan dipaksa menjawab dari pengetahuan umum.`,
    }
  }

  const docsById = new Map(docs.map((d) => [d.id, d.name]))
  const contentForLLM = buildRagSystemMessage(chunks, docsById, query)

  return {
    query,
    count: chunks.length,
    docs,
    chunks,
    contentForLLM,
  }
}

export async function execAnalyzeFullDocument(
  args: { documentId: string; instruction: string },
  ctx: { conversationId: string | null; projectId: string | null },
): Promise<AnalyzeFullDocumentResult> {
  const documentId = args.documentId?.trim() ?? ''
  const instruction = args.instruction?.trim() ?? ''

  if (!documentId) {
    return {
      documentId: '',
      documentName: '',
      instruction: '',
      sectionSummaries: '',
      totalChunksProcessed: 0,
      contentForLLM: 'TOOL ERROR: parameter "documentId" kosong. Sebutkan dokumen mana yang ingin dianalisis.',
    }
  }

  if (!instruction) {
    return {
      documentId,
      documentName: '',
      instruction: '',
      sectionSummaries: '',
      totalChunksProcessed: 0,
      contentForLLM: 'TOOL ERROR: parameter "instruction" kosong. Deskripsikan apa yang harus dianalisis dari dokumen.',
    }
  }

  const admin = createAdminClient()

  // Fetch document metadata
  const { data: docRows, error: docErr } = await admin
    .from('documents')
    .select('id, name, conversation_id, project_id')
    .eq('id', documentId)
    .maybeSingle()
  if (docErr || !docRows) {
    return {
      documentId,
      documentName: '',
      instruction,
      sectionSummaries: '',
      totalChunksProcessed: 0,
      contentForLLM: `TOOL ERROR: dokumen dengan ID "${documentId}" tidak ditemukan. Cek apakah ID dokumen sudah benar.`,
    }
  }

  const docName = docRows.name ?? documentId
  const docConvId = (docRows as any)?.conversation_id as string | null
  const docProjId = (docRows as any)?.project_id as string | null

  // Fetch ALL chunks for this document, ordered by chunk_index
  const { data: allChunks, error: chunksErr } = await admin
    .from('document_chunks')
    .select('chunk_index, content, heading, page, paragraph_index')
    .eq('document_id', documentId)
    .order('chunk_index', { ascending: true })
  if (chunksErr || !allChunks) {
    return {
      documentId,
      documentName: docName,
      instruction,
      sectionSummaries: '',
      totalChunksProcessed: 0,
      contentForLLM: `TOOL ERROR: gagal mengambil chunk dokumen "${docName}".`,
    }
  }

  const chunks = allChunks as Array<{
    chunk_index: number
    content: string
    heading: string | null
    page: number | null
    paragraph_index: number | null
  }>

  if (chunks.length === 0) {
    return {
      documentId,
      documentName: docName,
      instruction,
      sectionSummaries: '',
      totalChunksProcessed: 0,
      contentForLLM: `Dokumen "${docName}" tidak memiliki chunk yang tersisa. Dokumen mungkin kosong atau gagal diindeks.`,
    }
  }

  // Group chunks by heading
  const sections: Map<string | null, typeof chunks> = new Map()
  for (const chunk of chunks) {
    const key = chunk.heading
    if (!sections.has(key)) {
      sections.set(key, [])
    }
    sections.get(key)!.push(chunk)
  }

  // Build section summaries using map-reduce: each section gets a parallel LLM call
  const sectionEntries = Array.from(sections.entries())

  const summaryPromises = sectionEntries.map(async ([heading, sectionChunks]) => {
    const sectionText = sectionChunks
      .map((c) => {
        let meta = ''
        if (c.page !== null) meta = `[hal. ${c.page}]`
        else if (c.paragraph_index !== null) meta = `[para. ${c.paragraph_index}]`
        return meta ? `${meta} ${c.content}` : c.content
      })
      .join('\n\n')

    const systemPrompt = `Kamu adalah asisten analisis dokumen. Tugasmu adalah memproses isi bagian dokumen dan menghasilkan ringkasan/analisis sesuai instruksi user.

ATURAN:
- Jawab dalam Bahasa Indonesia kecuali instruksi meminta bahasa lain.
- Fokus pada informasi yang ada di teks bagian ini. Jangan menambahkan pengetahuan eksternal.
- Format output dengan heading yang jelas dan bullet points jika relevan.`

    const userPrompt = `INSTRUKSI ANALISIS: ${instruction}

=== ISI BAGIAN ===
${heading ? `Heading: ${heading}` : '(bagian tanpa heading)'}

${sectionText}

Ringkasan/hasil analisis untuk bagian ini sesuai instruksi di atas:`

    try {
      const response = await adacode.chat.completions.create({
        model: ADACODE_MODEL,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        max_tokens: 1500,
        temperature: 0.3,
      })
      const summary = response.choices[0]?.message?.content ?? '(gagal menghasilkan ringkasan)'
      return { heading, summary, truncated: false }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      console.error(`[analyze_full_document] LLM call failed for heading "${heading}":`, msg)
      return { heading, summary: `(ERROR: ${msg})`, truncated: false }
    }
  })

  const results = await Promise.allSettled(summaryPromises)
  const summaries = results
    .filter((r): r is PromiseFulfilledResult<{ heading: string | null; summary: string; truncated: boolean }> => r.status === 'fulfilled')
    .map((r) => r.value)

  // Build the combined section summaries
  const sectionLines = summaries.map((s) => {
    const label = s.heading ? `### ${s.heading}` : '### Bagian Tanpa Heading'
    return `${label}\n\n${s.summary}`
  })

  const sectionSummaries = sectionLines.join('\n\n---\n\n')

  const contentForLLM = `HASIL ANALISIS MENYELURUH DOKUMEN: "${docName}" (${chunks.length} chunks diproses, ${summaries.length} section)

INSTRUKSI USER: ${instruction}

=== RINGKASAN PER SECTION ===

${sectionSummaries}

=== INSTRUKSI UNTUK MODEL UTAMA ===
Gunakan ringkasan per section di atas untuk melakukan sintesis akhir dan menjawab pertanyaan user. Ringkasan setiap section sudah dihasilkan oleh model analisis khusus. Sekarang gabungkan wawasan dari semua section untuk memberikan jawaban komprehensif sesuai instruksi user di atas. Jika instruksi user meminta output format tertentu (misal: draft, laporan, rekomendasi), susun jawaban akhir sesuai format tersebut berdasarkan ringkasan section di atas.`

  return {
    documentId,
    documentName: docName,
    instruction,
    sectionSummaries,
    totalChunksProcessed: chunks.length,
    contentForLLM,
  }
}

export interface CurrentCanvasInfo {
  canvasId: string
  title: string
  revisionIndex: number
  source: 'ai' | 'user'
  content: string
}

export async function getCurrentCanvas(
  conversationId: string | null,
): Promise<CurrentCanvasInfo | null> {
  if (!conversationId) return null
  try {
    const admin = createAdminClient()
    const { data: canvas } = await admin
      .from('canvases')
      .select('id, title, current_revision_id')
      .eq('conversation_id', conversationId)
      .maybeSingle()
    if (!canvas || !canvas.current_revision_id) return null
    const { data: rev } = await admin
      .from('canvas_revisions')
      .select('content, revision_index, source')
      .eq('id', canvas.current_revision_id)
      .maybeSingle()
    if (!rev) return null
    return {
      canvasId: canvas.id as string,
      title: (canvas.title as string) ?? 'Untitled canvas',
      revisionIndex: rev.revision_index as number,
      source: (rev.source as 'ai' | 'user') ?? 'ai',
      content: (rev.content as string) ?? '',
    }
  } catch (err) {
    console.error('getCurrentCanvas failed', err)
    return null
  }
}

export async function execWriteCanvas(
  args: { title?: string; content: string; mode: CanvasMode },
  ctx: {
    conversationId: string | null
    userId: string | null
    assistantMessageId: string | null
  },
): Promise<CanvasRevisionResult> {
  if (!ctx.conversationId) {
    throw new Error('write_canvas: conversationId is required')
  }
  if (!ctx.userId) {
    throw new Error('write_canvas: userId is required')
  }
  const admin = createAdminClient()

  // Ensure a canvas row exists for this conversation.
  let canvasId: string
  let title: string
  const { data: existing, error: selectErr } = await admin
    .from('canvases')
    .select('id, title')
    .eq('conversation_id', ctx.conversationId)
    .maybeSingle()
  if (selectErr) {
    console.error('[canvas] select canvases failed', selectErr)
  }

  if (existing) {
    canvasId = existing.id as string
    title = (existing.title as string) ?? 'Untitled canvas'
    if (args.title && args.title.trim() && args.title !== title) {
      title = args.title.trim()
      const { error: updErr } = await admin
        .from('canvases')
        .update({ title })
        .eq('id', canvasId)
      if (updErr) console.error('[canvas] update title failed', updErr)
    }
  } else {
    title = (args.title?.trim() || 'Untitled canvas')
    const { data: created, error: createErr } = await admin
      .from('canvases')
      .insert({
        conversation_id: ctx.conversationId,
        user_id: ctx.userId,
        title,
      })
      .select('id')
      .single()
    if (createErr || !created) {
      console.error('[canvas] insert canvas failed', createErr)
      throw new Error(`Failed to create canvas: ${createErr?.message ?? 'unknown'}`)
    }
    canvasId = created.id as string
  }

  // Compute next revision_index and prev_revision_id.
  const { data: lastRev } = await admin
    .from('canvas_revisions')
    .select('id, revision_index')
    .eq('canvas_id', canvasId)
    .order('revision_index', { ascending: false })
    .limit(1)
    .maybeSingle()
  const nextIndex = lastRev ? (lastRev.revision_index as number) + 1 : 0
  const prevRevisionId = lastRev ? (lastRev.id as string) : null

  const content = args.content ?? ''
  const wordCount = countWords(content)

  // message_id is a soft reference — the FK was dropped in migration
  // link_canvas_revisions_to_message because the assistant message isn't yet in
  // public.messages at this point (chat-provider persists it after the stream).
  // We still store the id so UI can render revision cards anchored to the
  // producing assistant message.
  const { data: revRow, error: revErr } = await admin
    .from('canvas_revisions')
    .insert({
      canvas_id: canvasId,
      conversation_id: ctx.conversationId,
      message_id: ctx.assistantMessageId ?? null,
      revision_index: nextIndex,
      content,
      word_count: wordCount,
      source: 'ai',
      mode: args.mode,
      prev_revision_id: prevRevisionId,
    })
    .select('id')
    .single()
  if (revErr || !revRow) {
    console.error('[canvas] insert canvas_revisions failed', revErr, {
      canvasId,
      revisionIndex: nextIndex,
      contentLen: content.length,
    })
    throw new Error(`Failed to insert canvas revision: ${revErr?.message ?? 'unknown'}`)
  }
  const revisionId = revRow.id as string

  await admin
    .from('canvases')
    .update({ current_revision_id: revisionId })
    .eq('id', canvasId)

  return {
    canvasId,
    revisionId,
    revisionIndex: nextIndex,
    title,
    content,
    mode: args.mode,
  }
}
