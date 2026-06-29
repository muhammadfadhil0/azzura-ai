'use client'

import Link from 'next/link'
import { IconDots, IconPencil, IconTrash } from '@tabler/icons-react'
import { useState } from 'react'
import { ProjectIcon } from '@/components/projects/project-icon'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import type { Project } from '@/types/project'

function relativeTime(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime()
  const minutes = Math.floor(diff / 60_000)
  if (minutes < 1) return 'baru saja'
  if (minutes < 60) return `${minutes} menit yang lalu`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours} jam yang lalu`
  const days = Math.floor(hours / 24)
  if (days < 30) return `${days} hari yang lalu`
  const months = Math.floor(days / 30)
  if (months < 12) return `${months} bulan yang lalu`
  return `${Math.floor(months / 12)} tahun yang lalu`
}


interface Props {
  project: Project
  onDeleted: (id: string) => void
  onRenamed: (id: string, name: string) => void
}

export function ProjectCard({ project, onDeleted, onRenamed }: Props) {
  const [renaming, setRenaming] = useState(false)
  const [nameValue, setNameValue] = useState(project.name)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [deleting, setDeleting] = useState(false)

  const handleRename = async () => {
    if (!nameValue.trim() || nameValue === project.name) { setRenaming(false); return }
    const res = await fetch(`/api/projects/${project.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: nameValue.trim() }),
    })
    if (res.ok) onRenamed(project.id, nameValue.trim())
    setRenaming(false)
  }

  const handleDelete = async () => {
    setDeleting(true)
    await fetch(`/api/projects/${project.id}`, { method: 'DELETE' })
    onDeleted(project.id)
  }

  return (
    <>
      <div className="group relative flex flex-col gap-3 rounded-xl border border-border bg-card p-4 transition-shadow hover:shadow-md">
        <Link href={`/projects/${project.id}`} className="absolute inset-0 rounded-xl" aria-label={project.name} />

        <div className="flex items-start justify-between">
          <div className="flex size-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <ProjectIcon name={project.icon} className="size-5" />
          </div>
          <div className="relative z-10">
            <DropdownMenu>
              <DropdownMenuTrigger
                render={
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    className="opacity-0 transition-opacity group-hover:opacity-100"
                    aria-label="Project actions"
                    onClick={(e) => e.preventDefault()}
                  >
                    <IconDots className="size-4" />
                  </Button>
                }
              />
              <DropdownMenuContent align="end">
                <DropdownMenuItem
                  className="gap-2"
                  onClick={(e) => { e.preventDefault(); setRenaming(true) }}
                >
                  <IconPencil className="size-4" /> Rename
                </DropdownMenuItem>
                <DropdownMenuItem
                  className="gap-2 text-destructive focus:text-destructive"
                  onClick={(e) => { e.preventDefault(); setConfirmDelete(true) }}
                >
                  <IconTrash className="size-4" /> Delete
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        {renaming ? (
          <input
            className="relative z-10 rounded border border-border bg-background px-2 py-1 text-sm font-medium outline-none focus:ring-1 focus:ring-primary"
            value={nameValue}
            autoFocus
            onChange={(e) => setNameValue(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') handleRename(); if (e.key === 'Escape') setRenaming(false) }}
            onBlur={handleRename}
            onClick={(e) => e.preventDefault()}
          />
        ) : (
          <p className="text-sm font-medium leading-tight">{project.name}</p>
        )}

        {project.description && (
          <p className="line-clamp-2 text-xs text-muted-foreground">{project.description}</p>
        )}

        <p className="mt-auto text-xs text-muted-foreground/60">
          {relativeTime(project.updatedAt)}
        </p>
      </div>

      <Dialog open={confirmDelete} onOpenChange={(open) => { if (!open && !deleting) setConfirmDelete(false) }}>
        <DialogContent showCloseButton={false}>
          <DialogHeader>
            <DialogTitle>Hapus Project</DialogTitle>
            <DialogDescription>
              Apakah kamu yakin ingin menghapus{' '}
              <span className="font-medium text-foreground">{project.name}</span>? Tindakan ini tidak bisa dibatalkan.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setConfirmDelete(false)}
              disabled={deleting}
            >
              Batal
            </Button>
            <Button
              variant="destructive"
              onClick={handleDelete}
              disabled={deleting}
            >
              {deleting ? 'Menghapus…' : 'Hapus'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
