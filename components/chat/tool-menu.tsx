'use client'

import {
  IconCheck,
  IconFileText,
  IconPhotoPlus,
  IconPlus,
  IconUpload,
  IconWorld,
} from '@tabler/icons-react'
import { useRef } from 'react'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { cn } from '@/lib/utils'
import type { Attachment } from '@/types/chat'

const MAX_FILE_BYTES = 5 * 1024 * 1024
const MAX_DOC_BYTES = 25 * 1024 * 1024
const DOC_ACCEPT =
  '.pdf,.docx,.txt,.md,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain,text/markdown'

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

interface Props {
  onFiles?: (attachments: Attachment[]) => void
  onDocument?: (file: File) => void
  documentUploadDisabled?: boolean
  webSearchEnabled?: boolean
  onToggleWebSearch?: (enabled: boolean) => void
}

const DOC_MIME_ALLOW = new Set([
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'text/plain',
  'text/markdown',
])

function isAcceptedDocument(file: File): boolean {
  if (DOC_MIME_ALLOW.has(file.type)) return true
  const name = file.name.toLowerCase()
  return (
    name.endsWith('.pdf') ||
    name.endsWith('.docx') ||
    name.endsWith('.txt') ||
    name.endsWith('.md')
  )
}

export function ToolMenu({
  onFiles,
  onDocument,
  documentUploadDisabled = false,
  webSearchEnabled = false,
  onToggleWebSearch,
}: Props) {
  const inputRef = useRef<HTMLInputElement>(null)
  const docInputRef = useRef<HTMLInputElement>(null)

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
      onFiles?.(attachments)
    } catch (err) {
      console.error('Failed to read attachment', err)
      alert('Failed to read attachment.')
    }
  }

  const handleDocumentChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (!files || files.length === 0) return
    const file = files[0]
    e.target.value = ''
    if (!isAcceptedDocument(file)) {
      alert(`"${file.name}" tidak didukung. Hanya PDF, DOCX, TXT, MD.`)
      return
    }
    if (file.size > MAX_DOC_BYTES) {
      alert(`"${file.name}" lebih dari 25MB.`)
      return
    }
    onDocument?.(file)
  }

  return (
    <>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        onChange={handleChange}
      />
      <input
        ref={docInputRef}
        type="file"
        accept={DOC_ACCEPT}
        className="hidden"
        onChange={handleDocumentChange}
      />
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            aria-label="Tools"
            className="size-8 rounded-full"
          >
            <IconPlus className="size-4" />
          </Button>
        }
      />
      <DropdownMenuContent align="start" side="top" className="w-52">
        <DropdownMenuItem className="gap-2.5 py-2" onClick={() => inputRef.current?.click()}>
          <div className="flex size-6 shrink-0 items-center justify-center rounded-md bg-muted">
            <IconUpload className="size-3.5 text-muted-foreground" />
          </div>
          <div className="flex flex-col">
            <span>Upload file</span>
            <span className="text-[11px] text-muted-foreground">Images up to 5 MB</span>
          </div>
        </DropdownMenuItem>
        {onDocument ? (
          <DropdownMenuItem
            className="gap-2.5 py-2"
            disabled={documentUploadDisabled}
            onClick={() => docInputRef.current?.click()}
          >
            <div className="flex size-6 shrink-0 items-center justify-center rounded-md bg-muted">
              <IconFileText className="size-3.5 text-muted-foreground" />
            </div>
            <div className="flex flex-col">
              <span>Upload dokumen</span>
              <span className="text-[11px] text-muted-foreground">
                PDF, DOCX, TXT, MD · 25 MB
              </span>
            </div>
          </DropdownMenuItem>
        ) : null}
        <DropdownMenuItem
          className={cn(
            'gap-2.5 py-2',
            webSearchEnabled && 'bg-foreground/5',
          )}
          onClick={(e) => {
            e.preventDefault()
            onToggleWebSearch?.(!webSearchEnabled)
          }}
        >
          <div className="flex size-6 shrink-0 items-center justify-center rounded-md bg-muted">
            <IconWorld className="size-3.5 text-muted-foreground" />
          </div>
          <div className="flex flex-col">
            <span>Web search</span>
            <span className="text-[11px] text-muted-foreground">Search the web</span>
          </div>
          {webSearchEnabled ? (
            <IconCheck className="ml-auto size-4 text-foreground" />
          ) : null}
        </DropdownMenuItem>
        <DropdownMenuItem className="gap-2.5 py-2">
          <div className="flex size-6 shrink-0 items-center justify-center rounded-md bg-muted">
            <IconPhotoPlus className="size-3.5 text-muted-foreground" />
          </div>
          <div className="flex flex-col">
            <span>Generate image</span>
            <span className="text-[11px] text-muted-foreground">Create AI images</span>
          </div>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
    </>
  )
}
