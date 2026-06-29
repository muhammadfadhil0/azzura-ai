'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { IconFolder, IconDots, IconPencil, IconTrash } from '@tabler/icons-react'
import { useState } from 'react'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Button } from '@/components/ui/button'
import type { Project } from '@/types/project'

interface Props {
  project: Project
  onDeleted: (id: string) => void
  onRenamed: (id: string, name: string) => void
}

export function ProjectCard({ project, onDeleted, onRenamed }: Props) {
  const router = useRouter()
  const [renaming, setRenaming] = useState(false)
  const [nameValue, setNameValue] = useState(project.name)

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
    await fetch(`/api/projects/${project.id}`, { method: 'DELETE' })
    onDeleted(project.id)
  }

  return (
    <div className="group relative flex flex-col gap-3 rounded-xl border border-border bg-card p-4 transition-shadow hover:shadow-md">
      <Link href={`/projects/${project.id}`} className="absolute inset-0 rounded-xl" aria-label={project.name} />

      <div className="flex items-start justify-between">
        <div className="flex size-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
          <IconFolder className="size-5" />
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
                onClick={(e) => { e.preventDefault(); handleDelete() }}
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
    </div>
  )
}
