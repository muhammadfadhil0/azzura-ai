export type Role = 'user' | 'assistant'

export interface Attachment {
  id: string
  url: string
  thumbUrl?: string
  name: string
  mimeType: string
  sizeBytes?: number
}

export interface Message {
  id: string
  role: Role
  content: string
  parentId: string | null
  attachments?: Attachment[]
  createdAt: string
  model?: string
}

export interface Conversation {
  id: string
  title: string
  updatedAt: string
  projectId?: string | null
  isGeneratingTitle?: boolean
  // Full tree of all messages in this conversation, including siblings from
  // regenerations. Active path is derived by walking parentId from activeLeafId.
  allMessages: Message[]
  activeLeafId: string | null
}

export type DateBucket =
  | 'Today'
  | 'Yesterday'
  | 'Previous 7 Days'
  | 'Previous 30 Days'
  | 'Older'

export interface ComposerPayload {
  text: string
  attachments: Attachment[]
  webSearch?: boolean
}

export type SearchPhase = 'reading' | 'extracted' | 'fallback'

export interface SearchSource {
  url: string
  domain: string
  title: string
}

export interface SearchStatus {
  status: 'searching' | 'synthesizing' | 'done'
  query?: string
  currentDomain?: string
  phase?: SearchPhase
  count?: number
  sources?: SearchSource[]
}

export type DocumentStatus =
  | 'uploading'
  | 'parsing'
  | 'embedding'
  | 'ready'
  | 'error'

export interface DocumentRef {
  id: string
  conversationId: string
  messageId?: string | null
  name: string
  mimeType: string
  sizeBytes: number
  status: DocumentStatus
  progress?: { completed: number; total: number }
  pageCount?: number | null
  chunkCount?: number
  error?: string
  createdAt: string
}

export interface RagCitation {
  documentId: string
  documentName?: string
  page?: number
  heading?: string
  paragraphIndex?: number
}
