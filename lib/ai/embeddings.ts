import OpenAI from 'openai'
import { adacode } from '@/lib/ai/adacode'

export const EMBEDDING_MODEL =
  process.env.EMBEDDINGS_MODEL ??
  process.env.ADACODE_EMBEDDING_MODEL ??
  'text-embedding-3-small'

const BATCH_SIZE = 32
const MAX_RETRIES = 6
const RETRY_BASE_MS = 2000
const INTER_BATCH_DELAY_MS = 500

let _embedClient: OpenAI | null = null

function getEmbedClient(): OpenAI {
  if (_embedClient) return _embedClient
  const apiKey = process.env.EMBEDDINGS_API_KEY
  const baseURL = process.env.EMBEDDINGS_BASE_URL
  if (apiKey) {
    const cleanBase = baseURL
      ? baseURL.replace(/\/+embeddings\/?$/, '')
      : undefined
    _embedClient = new OpenAI({ apiKey, baseURL: cleanBase })
  } else {
    _embedClient = adacode
  }
  return _embedClient
}

function is429(err: unknown): boolean {
  if (err instanceof OpenAI.APIError) return err.status === 429
  const msg = err instanceof Error ? err.message : String(err)
  return msg.includes('429')
}

async function embedBatchWithRetry(client: OpenAI, batch: string[]): Promise<number[][]> {
  let lastErr: unknown
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    if (attempt > 0) {
      // exponential backoff: 1s, 2s, 4s, 8s
      await new Promise((r) => setTimeout(r, RETRY_BASE_MS * 2 ** (attempt - 1)))
    }
    try {
      const res = await client.embeddings.create({ model: EMBEDDING_MODEL, input: batch })
      return res.data.map((item) => item.embedding as number[])
    } catch (err) {
      lastErr = err
      if (!is429(err)) break
    }
  }
  const msg = lastErr instanceof Error ? lastErr.message : String(lastErr)
  throw new Error(
    `Embedding call failed (model="${EMBEDDING_MODEL}"). ${msg}. ` +
      `Pastikan endpoint /embeddings tersedia — set EMBEDDINGS_API_KEY (+ optional EMBEDDINGS_BASE_URL) untuk pakai OpenAI langsung.`,
  )
}

export async function embedTexts(texts: string[]): Promise<number[][]> {
  if (texts.length === 0) return []
  const client = getEmbedClient()
  const out: number[][] = []
  for (let i = 0; i < texts.length; i += BATCH_SIZE) {
    if (i > 0) await new Promise((r) => setTimeout(r, INTER_BATCH_DELAY_MS))
    const batch = texts.slice(i, i + BATCH_SIZE)
    const embeddings = await embedBatchWithRetry(client, batch)
    out.push(...embeddings)
  }
  return out
}
