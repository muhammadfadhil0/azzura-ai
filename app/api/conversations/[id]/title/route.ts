import { adacode, ADACODE_MODEL } from '@/lib/ai/adacode'
import { createClient } from '@/lib/supabase/server'
import type { NextRequest } from 'next/server'

export async function POST(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> },
) {
  const { id } = await ctx.params

  let body: { userMessage?: string; assistantMessage?: string }
  try {
    body = await req.json()
  } catch {
    return Response.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const { userMessage, assistantMessage } = body
  if (!userMessage || !assistantMessage) {
    return Response.json({ error: 'Missing messages' }, { status: 400 })
  }

  const supabase = await createClient()

  const completion = await adacode.chat.completions.create({
    model: ADACODE_MODEL,
    messages: [
      {
        role: 'system',
        content:
          'You generate short conversation titles. Based on the first exchange between user and assistant, write a concise title of max 6 words. Reply with ONLY the title — no quotes, no punctuation at the end, no explanation.',
      },
      {
        role: 'user',
        content: `User: ${userMessage.slice(0, 500)}\n\nAssistant: ${assistantMessage.slice(0, 500)}`,
      },
    ],
    max_tokens: 20,
  })

  const title =
    completion.choices[0]?.message?.content?.trim().replace(/^["']|["']$/g, '') ??
    'New chat'

  const { error } = await supabase
    .from('conversations')
    .update({ title })
    .eq('id', id)

  if (error) {
    console.error('Failed to update title', error)
    return Response.json({ error: 'DB update failed' }, { status: 500 })
  }

  return Response.json({ title })
}
