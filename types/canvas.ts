export type CanvasMode = 'initial' | 'replace' | 'patch' | 'user'
export type CanvasSource = 'ai' | 'user'

export interface Canvas {
  id: string
  conversationId: string
  title: string
  currentRevisionId: string | null
  createdAt: string
  updatedAt: string
}

export interface CanvasRevision {
  id: string
  canvasId: string
  conversationId: string
  messageId: string | null
  revisionIndex: number
  content: string
  wordCount: number
  source: CanvasSource
  mode: CanvasMode
  prevRevisionId: string | null
  createdAt: string
}

export interface CanvasSnapshot {
  content: string
  revisionId: string | null
  source: CanvasSource
}

export interface CanvasRevisionResult {
  canvasId: string
  revisionId: string
  revisionIndex: number
  title: string
  content: string
  mode: CanvasMode
}

// Lightweight summary used for inline cards in the chat thread.
// `content` is intentionally omitted — fetched on demand when user clicks a card.
export interface CanvasRevisionSummary {
  id: string
  canvasId: string
  conversationId: string
  messageId: string | null
  revisionIndex: number
  title: string
  wordCount: number
  source: CanvasSource
  mode: CanvasMode
  createdAt: string
}
