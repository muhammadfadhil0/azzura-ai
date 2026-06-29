import OpenAI from 'openai'
import { adacode } from '@/lib/ai/adacode'

export const EMBEDDING_MODEL =
  process.env.EMBEDDINGS_MODEL ??
  process.env.ADACODE_EMBEDDING_MODEL ??
  'text-embedding-3-small'

const BATCH_SIZE = 96

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

export async function embedTexts(texts: string[]): Promise<number[][]> {
  if (texts.length === 0) return []
  const client = getEmbedClient()
  const out: number[][] = []
  for (let i = 0; i < texts.length; i += BATCH_SIZE) {
    const batch = texts.slice(i, i + BATCH_SIZE)
    try {
      const res = await client.embeddings.create({
        model: EMBEDDING_MODEL,
        input: batch,
      })
      for (const item of res.data) {
        out.push(item.embedding as number[])
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      throw new Error(
        `Embedding call failed (model="${EMBEDDING_MODEL}"). ${msg}. ` +
          `Pastikan endpoint /embeddings tersedia — set EMBEDDINGS_API_KEY (+ optional EMBEDDINGS_BASE_URL) untuk pakai OpenAI langsung.`,
      )
    }
  }
  return out
}
