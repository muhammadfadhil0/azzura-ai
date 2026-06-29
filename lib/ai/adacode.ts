import OpenAI from 'openai'

const rawBaseURL = process.env.ADACODE_BASE_URL ?? ''
const baseURL = rawBaseURL.replace(/\/+chat\/completions\/?$/, '') || undefined

export const adacode = new OpenAI({
  apiKey: process.env.ADACODE_API_KEY,
  baseURL,
})

export const ADACODE_MODEL = process.env.ADACODE_MODEL ?? 'claude-sonnet-4-6'
