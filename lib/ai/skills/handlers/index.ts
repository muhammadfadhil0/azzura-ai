import type { SkillHandler } from '../types'
import { docxGeneratorHandler } from './docx-generator'
import { pptxGeneratorHandler } from './pptx-generator'
import { xlsxGeneratorHandler } from './xlsx-generator'

export const HANDLER_REGISTRY: Record<string, SkillHandler> = {
  'docx-generator-v1': docxGeneratorHandler,
  'pptx-generator-v1': pptxGeneratorHandler,
  'xlsx-generator-v1': xlsxGeneratorHandler,
}

export function getSkillHandler(handlerKey: string): SkillHandler | null {
  return HANDLER_REGISTRY[handlerKey] ?? null
}
