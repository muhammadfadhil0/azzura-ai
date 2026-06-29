import OpenAI from 'openai'

export const gemini = new OpenAI({
  apiKey: process.env.GEMINI_API_KEY,
  baseURL: 'https://generativelanguage.googleapis.com/v1beta/openai/',
})

export function isGeminiModel(modelId: string): boolean {
  return modelId.startsWith('gemini-')
}
