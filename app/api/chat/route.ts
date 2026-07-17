import type {
  ChatCompletionAssistantMessageParam,
  ChatCompletionMessageParam,
  ChatCompletionMessageToolCall,
} from 'openai/resources/chat/completions'
import { adacode, ADACODE_MODEL } from '@/lib/ai/adacode'
import { gemini, isGeminiModel } from '@/lib/ai/gemini'
import { toOpenAIMessages } from '@/lib/ai/messages'
import {
  buildTools,
  execAnalyzeFullDocument,
  execRetrieveDocs,
  execRetrieveOutline,
  execWebExtract,
  execWebSearch,
  execWriteCanvas,
  getCurrentCanvas,
} from '@/lib/ai/tools'
import { executeSkillCall } from '@/lib/ai/skills/execute'
import { getActiveSkills } from '@/lib/ai/skills/registry'
import type { LoadedSkill } from '@/lib/ai/skills/types'
import { createAdminClient } from '@/lib/supabase/admin'
import { createClient as createServerSupabase } from '@/lib/supabase/server'
import type { Message } from '@/types/chat'
import type { CanvasMode } from '@/types/canvas'
import type { ChatCompletionFunctionTool } from 'openai/resources/chat/completions'

const MAX_TOOL_ITERATIONS = 4

interface AccumulatedToolCall {
  id: string
  name: string
  argumentsRaw: string
  // For write_canvas streaming: tracks how much of the `content` string has
  // already been emitted as canvas.delta to the client.
  canvasStartSent?: boolean
  canvasLastEmitted?: number
}

/**
 * Best-effort extraction of the partial value of the "content" string field
 * from a JSON object that may be partially streamed. Returns the decoded
 * substring of "content" we've seen so far, or null if the field isn't found
 * yet. We only decode characters whose JSON escape state is unambiguous —
 * a half-emitted backslash escape (e.g. trailing `\`) returns what's stable.
 */
function extractPartialContentString(raw: string): string | null {
  const key = '"content":'
  const keyIdx = raw.indexOf(key)
  if (keyIdx < 0) return null
  let i = keyIdx + key.length
  // Skip whitespace.
  while (i < raw.length && (raw[i] === ' ' || raw[i] === '\n' || raw[i] === '\t')) i++
  if (i >= raw.length || raw[i] !== '"') return null
  i++ // past the opening quote
  let out = ''
  while (i < raw.length) {
    const ch = raw[i]
    if (ch === '\\') {
      // Need at least one more char to decide.
      if (i + 1 >= raw.length) return out
      const next = raw[i + 1]
      if (next === 'n') out += '\n'
      else if (next === 't') out += '\t'
      else if (next === 'r') out += '\r'
      else if (next === '"') out += '"'
      else if (next === '\\') out += '\\'
      else if (next === '/') out += '/'
      else if (next === 'b') out += '\b'
      else if (next === 'f') out += '\f'
      else if (next === 'u') {
        if (i + 5 >= raw.length) return out
        const hex = raw.slice(i + 2, i + 6)
        const code = parseInt(hex, 16)
        if (Number.isNaN(code)) return out
        out += String.fromCharCode(code)
        i += 6
        continue
      } else {
        out += next
      }
      i += 2
      continue
    }
    if (ch === '"') {
      // Closing quote — content fully streamed.
      return out
    }
    out += ch
    i++
  }
  return out
}

export async function POST(req: Request) {
  let body: {
    messages?: Message[]
    model?: string
    webSearch?: boolean
    canvas?: boolean
    assistantMessageId?: string
    conversationId?: string
    projectId?: string
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
  const canvas = body.canvas === true
  const assistantMessageId =
    typeof body.assistantMessageId === 'string' ? body.assistantMessageId : ''
  const conversationId =
    typeof body.conversationId === 'string' && body.conversationId.trim()
      ? body.conversationId.trim()
      : null
  const projectId =
    typeof body.projectId === 'string' && body.projectId.trim()
      ? body.projectId.trim()
      : null

  // Resolve current user from cookie session. Needed for canvas + skill
  // executions. Fallback to looking up the conversation's owner via admin
  // client if auth.getUser didn't return a user — keeps things working in dev
  // where cookies may be flaky.
  let userId: string | null = null
  try {
    const supabase = await createServerSupabase()
    const { data } = await supabase.auth.getUser()
    userId = data.user?.id ?? null
  } catch {
    userId = null
  }
  if (!userId && conversationId) {
    try {
      const admin = createAdminClient()
      const { data } = await admin
        .from('conversations')
        .select('user_id')
        .eq('id', conversationId)
        .maybeSingle()
      userId = (data?.user_id as string | undefined) ?? null
    } catch (err) {
      console.error('userId fallback failed', err)
    }
  }
  if (!userId) {
    console.warn('no userId resolved; canvas + skill writes will be skipped')
  }

  const encoder = new TextEncoder()
  const stream = new ReadableStream({
    async start(controller) {
      const send = (obj: unknown) => {
        controller.enqueue(
          encoder.encode(`data: ${JSON.stringify(obj)}\n\n`),
        )
      }

      try {
        const { available: ragAvailable, documentNames: ragDocumentNames } = await hasReadyDocuments(conversationId, projectId)
        const currentCanvas = canvas
          ? await getCurrentCanvas(conversationId)
          : null
        const skills = await getActiveSkills()
        const skillToolByName = new Map<string, LoadedSkill>()
        for (const skill of skills) {
          for (const tool of skill.tools) {
            skillToolByName.set(
              (tool as ChatCompletionFunctionTool).function.name,
              skill,
            )
          }
        }
        const tools = [
          ...buildTools({
            webSearchEnabled: webSearch,
            ragAvailable,
            canvasEnabled: canvas,
          }),
          ...skills.flatMap((s) => s.tools),
        ]

        const convo: ChatCompletionMessageParam[] = toOpenAIMessages(messages, {
          webSearch,
          hasRag: ragAvailable,
          ragDocumentNames,
          canvas,
          currentCanvas,
          model,
          skills,
        })

        const client = isGeminiModel(model) ? gemini : adacode

        for (let iteration = 0; iteration < MAX_TOOL_ITERATIONS; iteration++) {
          const completion = await client.chat.completions.create(
            {
              model,
              messages: convo,
              stream: true,
              ...(tools.length > 0 ? { tools, tool_choice: 'auto' } : {}),
            },
            { signal: req.signal },
          )

          let accumulatedText = ''
          const toolCallsByIndex = new Map<number, AccumulatedToolCall>()
          let finishReason: string | null = null

          for await (const chunk of completion) {
            const choice = chunk.choices[0]
            if (!choice) continue
            const delta = choice.delta

            if (delta?.content) {
              accumulatedText += delta.content
              send({ delta: delta.content })
            }

            if (delta?.tool_calls) {
              for (const tcDelta of delta.tool_calls) {
                const idx = tcDelta.index
                const existing = toolCallsByIndex.get(idx) ?? {
                  id: '',
                  name: '',
                  argumentsRaw: '',
                }
                if (tcDelta.id) existing.id = tcDelta.id
                if (tcDelta.function?.name) existing.name = tcDelta.function.name
                if (tcDelta.function?.arguments) {
                  existing.argumentsRaw += tcDelta.function.arguments
                }
                toolCallsByIndex.set(idx, existing)

                if (existing.name === 'write_canvas') {
                  if (!existing.canvasStartSent) {
                    console.log('[canvas] write_canvas tool call detected, emitting canvas.start')
                    send({
                      type: 'canvas.start',
                      messageId: assistantMessageId,
                    })
                    existing.canvasStartSent = true
                    existing.canvasLastEmitted = 0
                  }
                  const partial = extractPartialContentString(
                    existing.argumentsRaw,
                  )
                  if (partial !== null) {
                    const lastEmitted = existing.canvasLastEmitted ?? 0
                    if (partial.length > lastEmitted) {
                      send({
                        type: 'canvas.delta',
                        messageId: assistantMessageId,
                        delta: partial.slice(lastEmitted),
                      })
                      existing.canvasLastEmitted = partial.length
                    }
                  }
                }
              }
            }

            if (choice.finish_reason) {
              finishReason = choice.finish_reason
            }
          }

          const toolCalls = Array.from(toolCallsByIndex.entries())
            .sort(([a], [b]) => a - b)
            .map(([, v]) => v)
            .filter((tc) => tc.name)

          if (toolCalls.length === 0) {
            break
          }

          const assistantMsg: ChatCompletionAssistantMessageParam = {
            role: 'assistant',
            content: accumulatedText || null,
            tool_calls: toolCalls.map<ChatCompletionMessageToolCall>((tc) => ({
              id: tc.id || `call_${Math.random().toString(36).slice(2, 12)}`,
              type: 'function',
              function: { name: tc.name, arguments: tc.argumentsRaw || '{}' },
            })),
          }
          convo.push(assistantMsg)

          const assistantToolCalls = assistantMsg.tool_calls ?? []

          const toolResults = await Promise.all(
            toolCalls.map(async (tc, i) => {
              const toolCallId = assistantToolCalls[i]?.id ?? tc.id
              try {
                const args = parseToolArgs(tc.argumentsRaw)
                if (tc.name === 'web_search') {
                  send({
                    type: 'web_search.start',
                    messageId: assistantMessageId,
                    query: typeof args.query === 'string' ? args.query : '',
                  })
                  const result = await execWebSearch(
                    { query: String(args.query ?? '') },
                    req.signal,
                    (progress) => {
                      send({
                        type: 'web_search.progress',
                        messageId: assistantMessageId,
                        domain: progress.domain,
                        index: progress.index,
                        total: progress.total,
                        phase: progress.phase,
                        ...(progress.error ? { error: progress.error } : {}),
                      })
                    },
                  )
                  send({
                    type: 'web_search.complete',
                    messageId: assistantMessageId,
                    count: result.count,
                    sources: result.sources,
                  })
                  return { toolCallId, content: result.contentForLLM }
                }

                if (tc.name === 'web_extract') {
                  const rawUrls = Array.isArray(args.urls) ? args.urls : []
                  const urls = rawUrls.filter(
                    (u): u is string => typeof u === 'string',
                  )
                  send({
                    type: 'web_search.start',
                    messageId: assistantMessageId,
                    query: `extract: ${urls.slice(0, 3).join(', ')}${urls.length > 3 ? ` (+${urls.length - 3})` : ''}`,
                  })
                  const result = await execWebExtract({ urls }, req.signal)
                  send({
                    type: 'web_search.complete',
                    messageId: assistantMessageId,
                    count: result.count,
                    sources: result.sources,
                  })
                  return { toolCallId, content: result.contentForLLM }
                }

                if (tc.name === 'retrieve_documents') {
                  const query =
                    typeof args.query === 'string' ? args.query : ''
                  send({
                    type: 'rag.start',
                    messageId: assistantMessageId,
                    query,
                  })
                  const result = await execRetrieveDocs(
                    { query },
                    { conversationId, projectId },
                  )
                  send({
                    type: 'rag.complete',
                    messageId: assistantMessageId,
                    count: result.count,
                    docs: result.docs,
                  })
                  return { toolCallId, content: result.contentForLLM }
                }

                if (tc.name === 'retrieve_outline') {
                  send({
                    type: 'rag.start',
                    messageId: assistantMessageId,
                    query: 'outline dokumen',
                  })
                  const result = await execRetrieveOutline({ conversationId, projectId })
                  send({
                    type: 'rag.complete',
                    messageId: assistantMessageId,
                    count: result.count,
                    docs: result.docs,
                  })
                  return { toolCallId, content: result.contentForLLM }
                }

                if (tc.name === 'analyze_full_document') {
                  const docId =
                    typeof args.documentId === 'string' ? args.documentId : ''
                  const instruction =
                    typeof args.instruction === 'string' ? args.instruction : ''
                  send({
                    type: 'rag.start',
                    messageId: assistantMessageId,
                    query: `analyze_full_document: ${instruction.slice(0, 100)}`,
                  })
                  const result = await execAnalyzeFullDocument(
                    { documentId: docId, instruction },
                    { conversationId, projectId },
                  )
                  send({
                    type: 'rag.complete',
                    messageId: assistantMessageId,
                    count: result.totalChunksProcessed,
                    docs: [{ id: result.documentId, name: result.documentName }],
                  })
                  return { toolCallId, content: result.contentForLLM }
                }

                if (tc.name === 'write_canvas') {
                  const rawMode = typeof args.mode === 'string' ? args.mode : 'replace'
                  const mode: CanvasMode =
                    rawMode === 'initial' || rawMode === 'replace' || rawMode === 'patch'
                      ? rawMode
                      : 'replace'
                  const title =
                    typeof args.title === 'string' ? args.title : undefined
                  const content =
                    typeof args.content === 'string' ? args.content : ''
                  console.log('[canvas] executing write_canvas', {
                    mode,
                    titleLen: title?.length ?? 0,
                    contentLen: content.length,
                    userId,
                    conversationId,
                  })
                  try {
                    const result = await execWriteCanvas(
                      { title, content, mode },
                      {
                        conversationId,
                        userId,
                        assistantMessageId: assistantMessageId || null,
                      },
                    )
                    send({
                      type: 'canvas.complete',
                      messageId: assistantMessageId,
                      canvasId: result.canvasId,
                      revisionId: result.revisionId,
                      revisionIndex: result.revisionIndex,
                      title: result.title,
                      content: result.content,
                      mode: result.mode,
                    })
                    return {
                      toolCallId,
                      content: `Canvas updated (revisi #${result.revisionIndex}, ${result.content.length} chars). Beri konfirmasi singkat 1–2 kalimat ke user dalam Bahasa Indonesia, jangan ulangi isi canvas.`,
                    }
                  } catch (err) {
                    const msg = err instanceof Error ? err.message : String(err)
                    send({
                      type: 'canvas.error',
                      messageId: assistantMessageId,
                      error: msg,
                    })
                    return {
                      toolCallId,
                      content: `TOOL ERROR: write_canvas gagal: ${msg}. Beri tahu user kalau canvas gagal disimpan.`,
                    }
                  }
                }

                const skill = skillToolByName.get(tc.name)
                if (skill) {
                  if (!userId) {
                    return {
                      toolCallId,
                      content:
                        'TOOL ERROR: tidak bisa identifikasi user untuk eksekusi skill. Minta user untuk login ulang.',
                    }
                  }
                  send({
                    type: 'skill.start',
                    messageId: assistantMessageId,
                    skillSlug: skill.slug,
                    toolName: tc.name,
                  })
                  const result = await executeSkillCall({
                    skill,
                    args,
                    ctx: {
                      userId,
                      conversationId,
                      assistantMessageId: assistantMessageId || null,
                      signal: req.signal,
                      toolCallId,
                    },
                  })
                  if (result.canvasRevision) {
                    send({
                      type: 'canvas.complete',
                      messageId: assistantMessageId,
                      canvasId: result.canvasRevision.canvasId,
                      revisionId: result.canvasRevision.revisionId,
                      revisionIndex: result.canvasRevision.revisionIndex,
                      title: result.canvasRevision.title,
                      content: result.canvasRevision.content,
                      mode: result.canvasRevision.mode,
                    })
                  }
                  if (result.ok) {
                    send({
                      type: 'file.generated',
                      messageId: assistantMessageId,
                      executionId: result.executionId,
                      skillSlug: result.skillSlug,
                      fileName: result.fileName,
                      mimeType: result.mimeType,
                      sizeBytes: result.sizeBytes,
                      downloadUrl: `/api/generated-files/${result.executionId}/download`,
                      canvasRevisionId:
                        result.canvasRevision?.revisionId ?? null,
                    })
                  } else {
                    send({
                      type: 'skill.error',
                      messageId: assistantMessageId,
                      executionId: result.executionId,
                      skillSlug: result.skillSlug,
                      error: result.llmFeedback,
                    })
                  }
                  return { toolCallId, content: result.llmFeedback }
                }

                return {
                  toolCallId,
                  content: `TOOL ERROR: tool "${tc.name}" tidak dikenal.`,
                }
              } catch (err) {
                const msg = err instanceof Error ? err.message : String(err)
                return {
                  toolCallId,
                  content: `TOOL ERROR: ${tc.name} gagal: ${msg}. Sampaikan ke user dengan jujur kalau pencarian gagal.`,
                }
              }
            }),
          )

          for (const result of toolResults) {
            convo.push({
              role: 'tool',
              tool_call_id: result.toolCallId,
              content: result.content,
            })
          }

          if (finishReason && finishReason !== 'tool_calls') {
            // Defensive: model stopped for non-tool reason despite producing
            // tool calls. Don't loop further — let user see what we have.
            break
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

async function hasReadyDocuments(
  conversationId: string | null,
  projectId: string | null,
): Promise<{ available: boolean; documentNames: string[] }> {
  if (!conversationId && !projectId) return { available: false, documentNames: [] }
  try {
    const admin = createAdminClient()
    const filters: string[] = []
    if (conversationId) filters.push(`conversation_id.eq.${conversationId}`)
    if (projectId) filters.push(`project_id.eq.${projectId}`)

    const { data, error } = await admin
      .from('documents')
      .select('name')
      .or(filters.join(','))
      .eq('status', 'ready')
      .limit(20)

    if (error) {
      console.error('hasReadyDocuments check failed', error)
      return { available: false, documentNames: [] }
    }
    const names = (data ?? []).map((d) => d.name as string).filter(Boolean)
    return { available: names.length > 0, documentNames: names }
  } catch (err) {
    console.error('hasReadyDocuments check threw', err)
    return { available: false, documentNames: [] }
  }
}

function parseToolArgs(raw: string): Record<string, unknown> {
  if (!raw) return {}
  try {
    const parsed = JSON.parse(raw)
    if (parsed && typeof parsed === 'object') {
      return parsed as Record<string, unknown>
    }
    return {}
  } catch {
    return {}
  }
}
