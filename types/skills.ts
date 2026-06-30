export interface GeneratedFileSummary {
  id: string
  conversationId: string
  messageId: string | null
  skillSlug: string
  fileName: string
  mimeType: string
  sizeBytes: number | null
  downloadUrl: string
  canvasRevisionId: string | null
  createdAt: string
}
