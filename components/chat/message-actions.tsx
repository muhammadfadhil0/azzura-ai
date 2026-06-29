'use client'

import { IconCheck, IconCopy, IconRefresh } from '@tabler/icons-react'
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { findModel } from '@/lib/ai/models'
import type { Message } from '@/types/chat'

interface Props {
  message: Message
  onRegenerate?: () => void
}

export function MessageActions({ message, onRegenerate }: Props) {
  const [copied, setCopied] = useState(false)

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(message.content)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch {
      // ignore
    }
  }

  const modelLabel = message.model
    ? (findModel(message.model)?.label ?? message.model)
    : null

  return (
    <div className="flex items-center gap-1 pt-1 opacity-0 transition-opacity group-hover/msg:opacity-100">
      <Tooltip>
        <TooltipTrigger
          render={
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              aria-label="Copy"
              onClick={handleCopy}
            >
              {copied ? (
                <IconCheck className="size-3.5" />
              ) : (
                <IconCopy className="size-3.5" />
              )}
            </Button>
          }
        />
        <TooltipContent>{copied ? 'Copied' : 'Copy'}</TooltipContent>
      </Tooltip>
      {onRegenerate ? (
        <Tooltip>
          <TooltipTrigger
            render={
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                aria-label="Regenerate"
                onClick={onRegenerate}
              >
                <IconRefresh className="size-3.5" />
              </Button>
            }
          />
          <TooltipContent>Regenerate</TooltipContent>
        </Tooltip>
      ) : null}
      {modelLabel ? (
        <span className="ml-1 text-[11px] text-muted-foreground/70 select-none">
          {modelLabel}
        </span>
      ) : null}
    </div>
  )
}
