export interface Project {
  id: string
  name: string
  description: string | null
  createdAt: string
  updatedAt: string
}

export interface ProjectDocument {
  id: string
  projectId: string
  name: string
  mimeType: string
  sizeBytes: number
  status: 'uploading' | 'parsing' | 'embedding' | 'ready' | 'error'
  progress?: { completed: number; total: number }
  pageCount?: number | null
  chunkCount?: number
  error?: string
  createdAt: string
}
