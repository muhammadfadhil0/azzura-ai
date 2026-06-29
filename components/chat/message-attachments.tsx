'use client'

import { useState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogTrigger,
} from '@/components/ui/dialog'
import { cn } from '@/lib/utils'
import type { Attachment } from '@/types/chat'

export function MessageAttachments({
  attachments,
}: {
  attachments: Attachment[]
}) {
  if (attachments.length === 0) return null
  return (
    <div
      className={cn(
        'flex flex-wrap gap-2 pb-2',
        attachments.length === 1 ? 'justify-end' : 'justify-end',
      )}
    >
      {attachments.map((att) => (
        <AttachmentThumb key={att.id} attachment={att} />
      ))}
    </div>
  )
}

function AttachmentThumb({ attachment }: { attachment: Attachment }) {
  const [open, setOpen] = useState(false)
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          <button
            type="button"
            aria-label={`Open ${attachment.name || 'image'}`}
            className="block size-40 overflow-hidden rounded-xl border border-border/40 transition hover:opacity-90 focus-visible:outline-2 focus-visible:outline-ring"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={attachment.thumbUrl ?? attachment.url}
              alt={attachment.name}
              className="size-full object-cover"
              loading="lazy"
            />
          </button>
        }
      />
      <DialogContent
        showCloseButton={false}
        className="w-[min(96vw,1200px)] max-w-none border-0 bg-transparent p-0 shadow-none ring-0"
      >
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="block w-full"
          aria-label="Close image"
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={attachment.url}
            alt={attachment.name}
            className="mx-auto max-h-[90vh] max-w-full rounded-lg object-contain"
          />
        </button>
      </DialogContent>
    </Dialog>
  )
}
