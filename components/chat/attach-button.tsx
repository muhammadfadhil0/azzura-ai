'use client'

import { IconPaperclip } from '@tabler/icons-react'
import { useRef } from 'react'
import { Button } from '@/components/ui/button'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import type { Attachment } from '@/types/chat'

interface Props {
  onFiles: (attachments: Attachment[]) => void
}

const MAX_FILE_BYTES = 5 * 1024 * 1024

function makeId() {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID()
  }
  return Math.random().toString(36).slice(2)
}

function readAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result as string)
    reader.onerror = () => reject(reader.error)
    reader.readAsDataURL(file)
  })
}

export function AttachButton({ onFiles }: Props) {
  const inputRef = useRef<HTMLInputElement>(null)

  const handleChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (!files || files.length === 0) return

    const accepted: File[] = []
    for (const file of Array.from(files)) {
      if (!file.type.startsWith('image/')) {
        alert(`"${file.name}" is not an image and was skipped.`)
        continue
      }
      if (file.size > MAX_FILE_BYTES) {
        alert(`"${file.name}" is larger than 5MB and was skipped.`)
        continue
      }
      accepted.push(file)
    }

    e.target.value = ''
    if (accepted.length === 0) return

    try {
      const attachments: Attachment[] = await Promise.all(
        accepted.map(async (file) => ({
          id: makeId(),
          url: await readAsDataUrl(file),
          name: file.name,
          mimeType: file.type,
          sizeBytes: file.size,
        })),
      )
      onFiles(attachments)
    } catch (err) {
      console.error('Failed to read attachment', err)
      alert('Failed to read attachment.')
    }
  }

  return (
    <>
      <Tooltip>
        <TooltipTrigger
          render={
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              aria-label="Attach image"
              onClick={() => inputRef.current?.click()}
              className="size-8 rounded-full"
            >
              <IconPaperclip className="size-4" />
            </Button>
          }
        />
        <TooltipContent>Attach image</TooltipContent>
      </Tooltip>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        onChange={handleChange}
      />
    </>
  )
}
