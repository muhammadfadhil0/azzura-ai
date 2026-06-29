'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { IconPlus, IconFolderOpen } from '@tabler/icons-react'
import { ProjectCard } from '@/components/projects/project-card'
import { PROJECT_ICONS, ProjectIcon, DEFAULT_PROJECT_ICON, type ProjectIconName } from '@/components/projects/project-icon'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import type { Project } from '@/types/project'

const ICON_NAMES = Object.keys(PROJECT_ICONS) as ProjectIconName[]

function CreateProjectModal({
  open,
  onClose,
  onCreate,
}: {
  open: boolean
  onClose: () => void
  onCreate: (name: string, description: string, icon: string) => Promise<void>
}) {
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [icon, setIcon] = useState<ProjectIconName>(DEFAULT_PROJECT_ICON)
  const [saving, setSaving] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (open) {
      setName('')
      setDescription('')
      setIcon(DEFAULT_PROJECT_ICON)
      setTimeout(() => inputRef.current?.focus(), 50)
    }
  }, [open])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim()) return
    setSaving(true)
    try {
      await onCreate(name.trim(), description.trim(), icon)
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o && !saving) onClose() }}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>New Project</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          {/* Icon preview */}
          <div className="flex flex-col items-center gap-3">
            <div className="flex size-16 items-center justify-center rounded-2xl border border-border bg-primary/10 text-primary">
              <ProjectIcon name={icon} className="size-8" />
            </div>

            {/* Icon grid */}
            <div className="grid w-full grid-cols-6 gap-1 rounded-xl border border-border bg-muted/40 p-1.5">
              {ICON_NAMES.map((iconName) => {
                const Icon = PROJECT_ICONS[iconName]
                return (
                  <button
                    key={iconName}
                    type="button"
                    title={iconName.replace('Icon', '')}
                    onClick={() => setIcon(iconName)}
                    className={`flex aspect-square w-full items-center justify-center rounded-lg transition-colors hover:bg-sidebar-accent ${icon === iconName ? 'bg-primary/15 text-primary ring-1 ring-primary/40' : 'text-muted-foreground'}`}
                  >
                    <Icon className="size-5" />
                  </button>
                )
              })}
            </div>
          </div>

          {/* Name */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium text-muted-foreground">Nama</label>
            <input
              ref={inputRef}
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Nama project…"
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/50"
            />
          </div>

          {/* Description */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium text-muted-foreground">
              Deskripsi <span className="text-muted-foreground/60">(opsional)</span>
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Jelaskan tujuan project ini…"
              rows={3}
              className="w-full resize-none rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/50"
            />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose} disabled={saving}>
              Batal
            </Button>
            <Button type="submit" disabled={!name.trim() || saving}>
              {saving ? 'Menyimpan…' : 'Simpan'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

export function ProjectGrid({ initialProjects }: { initialProjects: Project[] }) {
  const [projects, setProjects] = useState<Project[]>(initialProjects)
  const [modalOpen, setModalOpen] = useState(false)
  const router = useRouter()

  const handleCreate = async (name: string, description: string, icon: string) => {
    const res = await fetch('/api/projects', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, description, icon }),
    })
    if (!res.ok) return
    const { project } = await res.json() as { project: { id: string } }
    setModalOpen(false)
    router.push(`/projects/${project.id}`)
  }

  const handleDeleted = (id: string) => setProjects((prev) => prev.filter((p) => p.id !== id))
  const handleRenamed = (id: string, name: string) =>
    setProjects((prev) => prev.map((p) => p.id === id ? { ...p, name } : p))

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between border-b border-border px-6 py-4">
        <h1 className="text-lg font-semibold">Projects</h1>
        <Button onClick={() => setModalOpen(true)} className="gap-2">
          <IconPlus className="size-4" />
          New Project
        </Button>
      </div>

      <div className="flex-1 overflow-y-auto p-6">
        {projects.length === 0 ? (
          <div className="flex flex-col items-center gap-3 py-20 text-center text-muted-foreground">
            <IconFolderOpen className="size-12" />
            <div>
              <p className="text-sm font-medium text-foreground">No projects yet</p>
              <p className="mt-0.5 text-xs">Buat project dan upload file sebagai knowledge base AI.</p>
            </div>
            <Button onClick={() => setModalOpen(true)} className="mt-2">
              Buat project pertama
            </Button>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {projects.map((p) => (
              <ProjectCard
                key={p.id}
                project={p}
                onDeleted={handleDeleted}
                onRenamed={handleRenamed}
              />
            ))}
          </div>
        )}
      </div>

      <CreateProjectModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        onCreate={handleCreate}
      />
    </div>
  )
}
