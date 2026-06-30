import {
  execWriteCanvas,
  getCurrentCanvas,
  type CurrentCanvasInfo,
} from '@/lib/ai/tools'
import { createAdminClient } from '@/lib/supabase/admin'
import { uploadGeneratedFile } from '@/lib/supabase/generated-files'
import type { CanvasRevisionResult } from '@/types/canvas'
import { getSkillHandler } from './handlers'
import {
  SkillValidationError,
  type LoadedSkill,
  type SkillHandlerCtx,
} from './types'

export interface ExecuteSkillCallArgs {
  skill: LoadedSkill
  args: unknown
  ctx: {
    userId: string
    conversationId: string | null
    assistantMessageId: string | null
    signal: AbortSignal | undefined
    toolCallId: string
  }
}

export interface ExecuteSkillCallResult {
  ok: boolean
  llmFeedback: string
  executionId: string
  skillSlug: string
  fileName?: string
  mimeType?: string
  sizeBytes?: number
  canvasRevision?: CanvasRevisionResult
}

export async function executeSkillCall(
  input: ExecuteSkillCallArgs,
): Promise<ExecuteSkillCallResult> {
  const { skill, args, ctx } = input
  const admin = createAdminClient()
  const executionId = crypto.randomUUID()
  const startedAt = Date.now()

  await admin.from('skill_executions').insert({
    id: executionId,
    skill_id: skill.id,
    skill_slug: skill.slug,
    user_id: ctx.userId,
    conversation_id: ctx.conversationId,
    message_id: ctx.assistantMessageId,
    tool_call_id: ctx.toolCallId,
    input_args: args,
    status: 'pending',
  })

  const handler = getSkillHandler(skill.handlerKey)
  if (!handler) {
    const msg = `handler "${skill.handlerKey}" tidak terdaftar`
    await markExecError(admin, executionId, msg, startedAt)
    return {
      ok: false,
      llmFeedback: `TOOL ERROR: ${msg}. Sampaikan ke user kalau skill ini belum siap dipakai.`,
      executionId,
      skillSlug: skill.slug,
    }
  }

  const handlerCtx: SkillHandlerCtx = {
    admin,
    userId: ctx.userId,
    conversationId: ctx.conversationId,
    assistantMessageId: ctx.assistantMessageId,
    executionId,
    signal: ctx.signal,
  }

  let handlerResult
  try {
    handlerResult = await handler(args, handlerCtx)
  } catch (err) {
    const isValidation = err instanceof SkillValidationError
    const msg = err instanceof Error ? err.message : String(err)
    await markExecError(admin, executionId, msg, startedAt)
    return {
      ok: false,
      llmFeedback: isValidation
        ? `TOOL ERROR: spec tidak valid — ${msg}. Periksa schema lalu panggil ulang dengan spec yang benar.`
        : `TOOL ERROR: handler gagal: ${msg}. Sampaikan ke user kalau pembuatan dokumen gagal.`,
      executionId,
      skillSlug: skill.slug,
    }
  }

  let storagePath: string
  let sizeBytes: number
  try {
    const upload = await uploadGeneratedFile({
      admin,
      userId: ctx.userId,
      conversationId: ctx.conversationId,
      executionId,
      fileName: handlerResult.fileName,
      mimeType: handlerResult.mimeType,
      buffer: handlerResult.fileBuffer,
    })
    storagePath = upload.storagePath
    sizeBytes = upload.sizeBytes
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    await markExecError(admin, executionId, msg, startedAt)
    return {
      ok: false,
      llmFeedback: `TOOL ERROR: upload file gagal: ${msg}. Sampaikan ke user.`,
      executionId,
      skillSlug: skill.slug,
    }
  }

  let canvasRevision: CanvasRevisionResult | undefined
  if (handlerResult.previewMarkdown && ctx.conversationId) {
    try {
      const existing: CurrentCanvasInfo | null = await getCurrentCanvas(
        ctx.conversationId,
      )
      const mode = existing ? 'replace' : 'initial'
      canvasRevision = await execWriteCanvas(
        {
          title: handlerResult.previewTitle,
          content: handlerResult.previewMarkdown,
          mode,
        },
        {
          conversationId: ctx.conversationId,
          userId: ctx.userId,
          assistantMessageId: ctx.assistantMessageId,
        },
      )
    } catch (err) {
      console.error('[skills] canvas preview write failed (non-fatal)', err)
    }
  }

  await admin
    .from('skill_executions')
    .update({
      status: 'success',
      file_storage_path: storagePath,
      file_name: handlerResult.fileName,
      file_mime_type: handlerResult.mimeType,
      file_size_bytes: sizeBytes,
      canvas_revision_id: canvasRevision?.revisionId ?? null,
      duration_ms: Date.now() - startedAt,
    })
    .eq('id', executionId)

  return {
    ok: true,
    llmFeedback: handlerResult.llmFeedback,
    executionId,
    skillSlug: skill.slug,
    fileName: handlerResult.fileName,
    mimeType: handlerResult.mimeType,
    sizeBytes,
    canvasRevision,
  }
}

async function markExecError(
  admin: ReturnType<typeof createAdminClient>,
  executionId: string,
  errorMessage: string,
  startedAt: number,
): Promise<void> {
  await admin
    .from('skill_executions')
    .update({
      status: 'error',
      error_message: errorMessage,
      duration_ms: Date.now() - startedAt,
    })
    .eq('id', executionId)
}
