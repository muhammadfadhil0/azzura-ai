'use client'

import { IconX } from '@tabler/icons-react'
import { Button } from '@/components/ui/button'
import type { Attachment } from '@/types/chat'

interface Props {
  attachments: Attachment[]
  onRemove: (id: string) => void
}

export function ComposerAttachments({ attachments, onRemove }: Props) {
  if (attachments.length === 0) return null
  return (
    <div className="flex flex-wrap gap-2 px-2 pb-1 pt-1">
      {attachments.map((att) => (
        <div
          key={att.id}
          className="group/chip relative size-14 overflow-hidden rounded-lg border border-border bg-background"
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={att.url}
            alt={att.name}
            className="size-full object-cover"
          />
          <Button
            type="button"
            variant="default"
            size="icon-xs"
            onClick={() => onRemove(att.id)}
            aria-label={`Remove ${att.name}`}
            className="absolute right-0.5 top-0.5 size-5 rounded-full bg-foreground/80 text-background opacity-0 transition-opacity group-hover/chip:opacity-100"
          >
            <IconX className="size-3" />
          </Button>
        </div>
      ))}
    </div>
  )
}
