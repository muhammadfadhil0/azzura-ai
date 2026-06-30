import type {
  ChatCompletionFunctionTool,
  ChatCompletionTool,
} from 'openai/resources/chat/completions'
import { createAdminClient } from '@/lib/supabase/admin'
import type { LoadedSkill } from './types'

const TTL_MS = 60_000

const BUILTIN_TOOL_NAMES = new Set([
  'web_search',
  'web_extract',
  'retrieve_documents',
  'write_canvas',
])

interface CachedRegistry {
  skills: LoadedSkill[]
  expiresAt: number
}

let cache: CachedRegistry | null = null

export async function getActiveSkills(): Promise<LoadedSkill[]> {
  if (cache && cache.expiresAt > Date.now()) return cache.skills

  const admin = createAdminClient()
  const { data, error } = await admin
    .from('skills')
    .select('id, slug, handler_key, system_instructions, tool_definitions')
    .eq('is_active', true)

  if (error) {
    console.error('[skills] failed to load registry', error)
    return cache?.skills ?? []
  }

  const skills: LoadedSkill[] = []
  const seenToolNames = new Set<string>(BUILTIN_TOOL_NAMES)

  for (const row of data ?? []) {
    const tools = row.tool_definitions as unknown
    if (!Array.isArray(tools)) {
      console.warn(`[skills] skill "${row.slug}" has invalid tool_definitions (not an array)`)
      continue
    }

    const validTools: ChatCompletionTool[] = []
    let skipSkill = false
    for (const t of tools) {
      const tool = t as ChatCompletionTool
      if (tool?.type !== 'function') {
        console.warn(
          `[skills] skill "${row.slug}" has non-function tool — only "function" tools are supported`,
        )
        skipSkill = true
        break
      }
      const fnTool = tool as ChatCompletionFunctionTool
      const name = fnTool.function?.name
      if (!name) {
        console.warn(`[skills] skill "${row.slug}" has tool without function.name`)
        skipSkill = true
        break
      }
      if (seenToolNames.has(name)) {
        console.warn(
          `[skills] skill "${row.slug}" tool name "${name}" collides with existing tool — skipping skill`,
        )
        skipSkill = true
        break
      }
      validTools.push(fnTool)
    }
    if (skipSkill) continue

    for (const t of validTools) {
      seenToolNames.add((t as ChatCompletionFunctionTool).function.name)
    }

    skills.push({
      id: row.id as string,
      slug: row.slug as string,
      handlerKey: row.handler_key as string,
      systemInstructions: row.system_instructions as string,
      tools: validTools,
    })
  }

  cache = { skills, expiresAt: Date.now() + TTL_MS }
  return skills
}

export function invalidateSkillCache(): void {
  cache = null
}
