export interface TavilyResult {
  url: string
  title: string
  content: string
  score: number
  published_date?: string
}

export interface TavilyResponse {
  answer?: string
  results: TavilyResult[]
}

export async function tavilySearch(
  query: string,
  signal?: AbortSignal,
): Promise<TavilyResponse> {
  const apiKey = process.env.TAVILY_API_KEY
  if (!apiKey) throw new Error('TAVILY_API_KEY is not configured')

  const res = await fetch('https://api.tavily.com/search', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      api_key: apiKey,
      query,
      max_results: 8,
      include_answer: 'advanced',
      search_depth: 'advanced',
      include_raw_content: false,
    }),
    signal,
  })

  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(`Tavily ${res.status}${text ? `: ${text}` : ''}`)
  }
  return (await res.json()) as TavilyResponse
}

export interface TavilyExtractedPage {
  url: string
  raw_content: string
}

export interface TavilyExtractResponse {
  results: TavilyExtractedPage[]
  failed_results?: { url: string; error: string }[]
}

export async function tavilyExtract(
  urls: string[],
  signal?: AbortSignal,
): Promise<TavilyExtractResponse> {
  const apiKey = process.env.TAVILY_API_KEY
  if (!apiKey) throw new Error('TAVILY_API_KEY is not configured')
  if (urls.length === 0) return { results: [] }

  const res = await fetch('https://api.tavily.com/extract', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      api_key: apiKey,
      urls,
      extract_depth: 'advanced',
      include_images: false,
    }),
    signal,
  })

  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(`Tavily extract ${res.status}${text ? `: ${text}` : ''}`)
  }
  return (await res.json()) as TavilyExtractResponse
}

export function domainOf(u: string): string {
  try {
    return new URL(u).hostname.replace(/^www\./, '')
  } catch {
    return u
  }
}

export function truncate(text: string, max: number): string {
  if (text.length <= max) return text
  return `${text.slice(0, max)}\n…[dipotong, total ${text.length} karakter]`
}
