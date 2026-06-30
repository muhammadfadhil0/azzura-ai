'use client'

import { useEffect, useRef, useState } from 'react'
import {
  IconFileText, IconLoader2, IconTrash, IconUpload,
  IconAlertCircle, IconCheck, IconNotes,
} from '@tabler/icons-react'
import { useProject } from '@/components/projects/project-provider'
import { Loader } from '@/components/ui/loader'
import type { ProjectDocument } from '@/types/project'

const SUPPORTED_EXTENSIONS = '.pdf,.docx,.txt,.md'

function StatusChip({ doc }: { doc: ProjectDocument }) {
  const prevStatus = useRef(doc.status)
  const [showReadyFlash, setShowReadyFlash] = useState(false)

  useEffect(() => {
    if (prevStatus.current !== 'ready' && doc.status === 'ready') {
      setShowReadyFlash(true)
      const t = setTimeout(() => setShowReadyFlash(false), 1800)
      prevStatus.current = doc.status
      return () => clearTimeout(t)
    }
    prevStatus.current = doc.status
  }, [doc.status])

  if (doc.status === 'ready') {
    if (showReadyFlash) {
      return (
        <span className="flex items-center gap-1 text-xs text-emerald-600 dark:text-emerald-400">
          <IconCheck className="size-3" /> Ready
        </span>
      )
    }
    const parts: string[] = []
    if (doc.wordCount) parts.push(`${doc.wordCount.toLocaleString('id-ID')} kata`)
    if (doc.pageCount) parts.push(`${doc.pageCount} hlm`)
    if (parts.length === 0 && doc.chunkCount) parts.push(`${doc.chunkCount} chunk`)
    return (
      <span className="flex items-center gap-1 text-xs text-muted-foreground">
        <IconCheck className="size-3" />
        {parts.length > 0 ? parts.join(' · ') : 'Ready'}
      </span>
    )
  }
  if (doc.status === 'error') {
    return (
      <span className="flex items-center gap-1 text-xs text-destructive" title={doc.error}>
        <IconAlertCircle className="size-3" /> Error
      </span>
    )
  }
  const label = doc.status === 'uploading' ? 'Uploading' : doc.status === 'parsing' ? 'Parsing' : 'Indexing'
  return (
    <span className="flex items-center gap-1 text-xs text-muted-foreground">
      <IconLoader2 className="size-3 animate-spin" /> {label}
      {doc.progress && ` ${doc.progress.completed}/${doc.progress.total}`}
    </span>
  )
}

function NoteDialog({ onClose }: { onClose: () => void }) {
  const { addProjectNote } = useProject()
  const [title, setTitle] = useState('')
  const [content, setContent] = useState('')
  const [saving, setSaving] = useState(false)

  const handleSave = async () => {
    if (!content.trim()) return
    setSaving(true)
    try {
      await addProjectNote(content.trim(), title.trim() || undefined)
      onClose()
    } catch {
      // error shown via doc status chip
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={onClose}>
      <div
        className="w-full max-w-md rounded-xl border border-border bg-background p-5 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="mb-3 text-sm font-semibold">Add text note</h3>
        <input
          className="mb-2 w-full rounded-md border border-border bg-background px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-primary"
          placeholder="Title (optional)"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
        />
        <textarea
          className="mb-3 w-full rounded-md border border-border bg-background px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-primary"
          rows={8}
          placeholder="Paste or type your text here…"
          value={content}
          onChange={(e) => setContent(e.target.value)}
          autoFocus
        />
        <div className="flex justify-end gap-2">
          <button
            onClick={onClose}
            className="rounded-md px-3 py-1.5 text-sm text-muted-foreground hover:bg-sidebar-accent/60"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={!content.trim() || saving}
            className="rounded-md bg-primary px-3 py-1.5 text-sm text-primary-foreground disabled:opacity-50"
          >
            {saving ? 'Saving…' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  )
}

export function KnowledgeBase() {
  const { projectDocuments, isLoadingProject, uploadProjectDocument, removeProjectDocument } = useProject()
  const fileRef = useRef<HTMLInputElement>(null)
  const [noteOpen, setNoteOpen] = useState(false)

  const handleFiles = (files: FileList | null) => {
    if (!files) return
    Array.from(files).forEach((f) => {
      uploadProjectDocument(f).catch(() => { /* error shown via doc status chip */ })
    })
  }

  if (isLoadingProject) {
    return (
      <div className="flex h-full items-center justify-center">
        <Loader />
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Knowledge Base</span>
        <div className="flex gap-1.5">
          <button
            onClick={() => setNoteOpen(true)}
            className="flex items-center gap-1 rounded-md px-2 py-1 text-xs text-foreground hover:bg-sidebar-accent/60 transition-colors"
          >
            <IconNotes className="size-3.5" /> Add note
          </button>
          <button
            onClick={() => fileRef.current?.click()}
            className="flex items-center gap-1 rounded-md px-2 py-1 text-xs text-foreground hover:bg-sidebar-accent/60 transition-colors"
          >
            <IconUpload className="size-3.5" /> Upload file
          </button>
        </div>
      </div>

      <input
        ref={fileRef}
        type="file"
        accept={SUPPORTED_EXTENSIONS}
        multiple
        className="hidden"
        onChange={(e) => handleFiles(e.target.files)}
      />

      {projectDocuments.length === 0 ? (
        <div
          className="flex cursor-pointer flex-col items-center gap-2 rounded-lg border border-dashed border-border px-4 py-8 text-center text-muted-foreground transition-colors hover:border-primary/50 hover:bg-sidebar-accent/30"
          onClick={() => fileRef.current?.click()}
        >
          <IconUpload className="size-6" />
          <p className="text-sm">Upload files or add text notes</p>
          <p className="text-xs">PDF, DOCX, TXT, Markdown — max 25 MB</p>
        </div>
      ) : (
        <ul className="flex flex-col gap-1.5">
          {projectDocuments.map((doc) => (
            <li
              key={doc.id}
              className="group flex items-center gap-2 rounded-lg border border-border bg-sidebar px-3 py-2"
            >
              <IconFileText className="size-4 shrink-0 text-muted-foreground" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm" title={doc.name}>{doc.name}</p>
                <StatusChip doc={doc} />
              </div>
              <button
                onClick={() => {
                  if (confirm(`Hapus "${doc.name}"? File tidak bisa dikembalikan.`)) {
                    removeProjectDocument(doc.id)
                  }
                }}
                className="shrink-0 opacity-0 transition-opacity group-hover:opacity-100"
                aria-label="Remove"
              >
                <IconTrash className="size-3.5 text-muted-foreground hover:text-destructive" />
              </button>
            </li>
          ))}
        </ul>
      )}

      {noteOpen && <NoteDialog onClose={() => setNoteOpen(false)} />}
    </div>
  )
}
