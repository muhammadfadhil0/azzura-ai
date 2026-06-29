'use client'

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import type { Project, ProjectDocument } from '@/types/project'

interface ProjectState {
  project: Project | null
  projectDocuments: ProjectDocument[]
  isLoadingProject: boolean
  uploadProjectDocument: (file: File) => Promise<{ documentId: string }>
  addProjectNote: (content: string, title?: string) => Promise<{ documentId: string }>
  removeProjectDocument: (docId: string) => Promise<void>
  updateProject: (patch: { name?: string; description?: string }) => Promise<void>
}

const ProjectContext = createContext<ProjectState | null>(null)

function makeId() {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID()
  return Math.random().toString(36).slice(2)
}

export function ProjectProvider({ projectId, children }: { projectId: string; children: ReactNode }) {
  const [project, setProject] = useState<Project | null>(null)
  const [projectDocuments, setProjectDocuments] = useState<ProjectDocument[]>([])
  const [isLoadingProject, setIsLoadingProject] = useState(true)

  useEffect(() => {
    let cancelled = false
    setIsLoadingProject(true)
    fetch(`/api/projects/${projectId}`)
      .then((r) => r.json())
      .then(({ project: p, documents }: { project: Project; documents: Array<{
        id: string; name: string; mime_type: string; size_bytes: number
        status: ProjectDocument['status']; page_count: number | null
        chunk_count: number; error_message: string | null; created_at: string
      }> }) => {
        if (cancelled) return
        const raw = p as unknown as { id: string; name: string; description: string | null; created_at: string; updated_at: string }
        setProject({
          id: raw.id, name: raw.name, description: raw.description,
          createdAt: raw.created_at,
          updatedAt: raw.updated_at,
        })
        setProjectDocuments(
          (documents ?? []).map((d) => ({
            id: d.id, projectId, name: d.name, mimeType: d.mime_type,
            sizeBytes: d.size_bytes, status: d.status,
            pageCount: d.page_count, chunkCount: d.chunk_count,
            error: d.error_message ?? undefined, createdAt: d.created_at,
          })),
        )
      })
      .catch(() => { /* ignore */ })
      .finally(() => { if (!cancelled) setIsLoadingProject(false) })
    return () => { cancelled = true }
  }, [projectId])

  const updateDocumentById = useCallback(
    (id: string, patch: Partial<ProjectDocument>) => {
      setProjectDocuments((prev) => prev.map((d) => d.id === id ? { ...d, ...patch } : d))
    },
    [],
  )

  const streamDocumentUpload = useCallback(
    async (
      res: Response,
      tempId: string,
    ): Promise<{ documentId: string }> => {
      if (!res.ok || !res.body) {
        const text = await res.text().catch(() => '')
        throw new Error(text || `Upload failed (${res.status})`)
      }
      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      let buffer = ''
      let serverId: string | null = null
      let finished = false

      while (!finished) {
        const { done, value } = await reader.read()
        if (done) break
        buffer += decoder.decode(value, { stream: true })
        const parts = buffer.split('\n\n')
        buffer = parts.pop() ?? ''

        for (const part of parts) {
          const line = part.trim()
          if (!line.startsWith('data:')) continue
          const payload = line.slice(5).trim()
          if (payload === '[DONE]') { finished = true; break }
          try {
            const parsed = JSON.parse(payload) as {
              type?: string; id?: string; phase?: string
              completed?: number; total?: number
              chunkCount?: number; pageCount?: number | null; error?: string
            }
            if (parsed.type === 'doc.created' && parsed.id) {
              serverId = parsed.id
              setProjectDocuments((prev) =>
                prev.map((d) => d.id === tempId ? { ...d, id: serverId! } : d),
              )
            } else if (parsed.type === 'doc.progress' && serverId) {
              const status: ProjectDocument['status'] =
                parsed.phase === 'parsing' ? 'parsing' : 'embedding'
              updateDocumentById(serverId, {
                status,
                progress: parsed.completed !== undefined && parsed.total !== undefined
                  ? { completed: parsed.completed, total: parsed.total }
                  : undefined,
              })
            } else if (parsed.type === 'doc.ready' && serverId) {
              updateDocumentById(serverId, {
                status: 'ready', chunkCount: parsed.chunkCount,
                pageCount: parsed.pageCount ?? null, progress: undefined,
              })
            } else if (parsed.type === 'doc.error' && serverId) {
              updateDocumentById(serverId, { status: 'error', error: parsed.error, progress: undefined })
            }
          } catch { /* ignore */ }
        }
      }
      if (!serverId) throw new Error('Upload did not return a document id')
      return { documentId: serverId }
    },
    [updateDocumentById],
  )

  const uploadProjectDocument = useCallback(
    async (file: File) => {
      const tempId = makeId()
      const optimistic: ProjectDocument = {
        id: tempId, projectId, name: file.name, mimeType: file.type,
        sizeBytes: file.size, status: 'uploading', createdAt: new Date().toISOString(),
      }
      setProjectDocuments((prev) => [...prev, optimistic])

      const form = new FormData()
      form.append('file', file)
      try {
        const res = await fetch(`/api/projects/${projectId}/documents`, { method: 'POST', body: form })
        return await streamDocumentUpload(res, tempId)
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err)
        setProjectDocuments((prev) =>
          prev.map((d) => d.id === tempId ? { ...d, status: 'error', error: msg } : d),
        )
        throw err
      }
    },
    [projectId, streamDocumentUpload],
  )

  const addProjectNote = useCallback(
    async (content: string, title?: string) => {
      const tempId = makeId()
      const optimistic: ProjectDocument = {
        id: tempId, projectId, name: title ?? 'Note', mimeType: 'text/plain',
        sizeBytes: new TextEncoder().encode(content).length,
        status: 'uploading', createdAt: new Date().toISOString(),
      }
      setProjectDocuments((prev) => [...prev, optimistic])

      try {
        const res = await fetch(`/api/projects/${projectId}/notes`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ content, title }),
        })
        return await streamDocumentUpload(res, tempId)
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err)
        setProjectDocuments((prev) =>
          prev.map((d) => d.id === tempId ? { ...d, status: 'error', error: msg } : d),
        )
        throw err
      }
    },
    [projectId, streamDocumentUpload],
  )

  const removeProjectDocument = useCallback(
    async (docId: string) => {
      setProjectDocuments((prev) => prev.filter((d) => d.id !== docId))
      await fetch(`/api/projects/${projectId}/documents/${docId}`, { method: 'DELETE' })
    },
    [projectId],
  )

  const updateProject = useCallback(
    async (patch: { name?: string; description?: string }) => {
      const res = await fetch(`/api/projects/${projectId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(patch),
      })
      if (!res.ok) throw new Error('Failed to update project')
      const { project: updated } = await res.json() as { project: { id: string; name: string; description: string | null; updated_at: string } }
      setProject((prev) => prev ? { ...prev, name: updated.name, description: updated.description, updatedAt: updated.updated_at } : prev)
    },
    [projectId],
  )

  const value = useMemo<ProjectState>(
    () => ({ project, projectDocuments, isLoadingProject, uploadProjectDocument, addProjectNote, removeProjectDocument, updateProject }),
    [project, projectDocuments, isLoadingProject, uploadProjectDocument, addProjectNote, removeProjectDocument, updateProject],
  )

  return <ProjectContext.Provider value={value}>{children}</ProjectContext.Provider>
}

export function useProject() {
  const ctx = useContext(ProjectContext)
  if (!ctx) throw new Error('useProject must be used within ProjectProvider')
  return ctx
}
