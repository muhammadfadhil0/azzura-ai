import type { SupabaseClient } from '@supabase/supabase-js'
import type { ChatCompletionTool } from 'openai/resources/chat/completions'

export interface LoadedSkill {
  id: string
  slug: string
  handlerKey: string
  systemInstructions: string
  tools: ChatCompletionTool[]
}

export interface SkillHandlerCtx {
  admin: SupabaseClient
  userId: string
  conversationId: string | null
  assistantMessageId: string | null
  executionId: string
  signal: AbortSignal | undefined
}

export interface SkillHandlerResult {
  fileBuffer: Buffer
  fileName: string
  mimeType: string
  previewMarkdown?: string
  previewTitle?: string
  llmFeedback: string
}

export type SkillHandler = (
  args: unknown,
  ctx: SkillHandlerCtx,
) => Promise<SkillHandlerResult>

export class SkillValidationError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'SkillValidationError'
  }
}
