'use client'

import Image from 'next/image'
import { useTheme } from 'next-themes'
import type { ModelProvider } from '@/lib/ai/models'

const LOGO_SRC: Record<ModelProvider, string> = {
  anthropic: '/logos/anthropic.svg',
  openai:    '/logos/openai.svg',
  qwen:      '/logos/qwen.svg',
  minimax:   '/logos/minimax.svg',
  gemini:    '/logos/gemini.svg',
}

export function ModelLogo({ provider }: { provider: ModelProvider }) {
  const { resolvedTheme } = useTheme()

  const src =
    provider === 'openai' && resolvedTheme === 'dark'
      ? '/logos/openai-light.svg'
      : LOGO_SRC[provider]

  return (
    <Image
      src={src}
      alt={provider}
      width={16}
      height={16}
      className="size-4 shrink-0 rounded-sm object-contain"
    />
  )
}
