'use client'

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import { DEFAULT_MODEL_ID } from '@/lib/ai/models'
import {
  buildActivePath,
  getSiblings,
  latestLeafInSubtree,
} from '@/lib/chat/tree'
import { createClient } from '@/lib/supabase/client'
import {
  signAttachmentUrls,
  uploadAttachments,
} from '@/lib/supabase/storage'
import type {
  Conversation,
  DocumentRef,
  Message,
  SearchStatus,
} from '@/types/chat'

interface ChatState {
  conversations: Conversation[]
  isLoadingConversations: boolean
  isLoadingMessageId: string | null
  isStreaming: boolean
  streamingMessageId: string | null
  searchStatuses: Record<string, SearchStatus>
  documentsByConversation: Record<string, DocumentRef[]>
  webSearchEnabled: boolean
  setWebSearchEnabled: (enabled: boolean) => void
  selectedModelId: string
  setSelectedModelId: (id: string) => void
  getConversation: (id: string) => Conversation | undefined
  loadConversationMessages: (id: string) => Promise<void>
  createConversation: (initial: Message) => Promise<string>
  createEmptyConversation: () => Promise<string>
  appendMessage: (conversationId: string, message: Message) => Promise<void>
  renameConversation: (id: string, title: string) => Promise<void>
  deleteConversation: (id: string) => Promise<void>
  streamAssistantReply: (
    conversationId: string,
    history: Message[],
    options?: { webSearch?: boolean },
  ) => void
  stopStreaming: () => void
  regenerateAssistantMessage: (
    conversationId: string,
    assistantMessageId: string,
  ) => void
  switchSibling: (
    conversationId: string,
    currentMessageId: string,
    direction: 'prev' | 'next',
  ) => Promise<void>
  loadDocuments: (conversationId: string) => Promise<void>
  uploadDocument: (
    file: File,
    conversationId: string,
  ) => Promise<{ documentId: string }>
  removeDocument: (conversationId: string, documentId: string) => Promise<void>
  hasIndexingDocuments: (conversationId: string) => boolean
}

const ChatContext = createContext<ChatState | null>(null)

function makeId() {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID()
  }
  return Math.random().toString(36).slice(2)
}

function titleFromMessage(content: string) {
  const trimmed = content.trim().replace(/\s+/g, ' ')
  if (!trimmed) return 'New chat'
  return trimmed.length > 40 ? `${trimmed.slice(0, 40)}…` : trimmed
}

export function ChatProvider({ children }: { children: ReactNode }) {
  const supabase = useMemo(() => createClient(), [])
  const [userId, setUserId] = useState<string | null>(null)
  const [conversations, setConversations] = useState<Conversation[]>([])
  const [isLoadingConversations, setIsLoadingConversations] = useState(true)
  const [isLoadingMessageId, setIsLoadingMessageId] = useState<string | null>(null)
  const [isStreaming, setIsStreaming] = useState(false)
  const [streamingMessageId, setStreamingMessageId] = useState<string | null>(
    null,
  )
  const [searchStatuses, setSearchStatuses] = useState<
    Record<string, SearchStatus>
  >({})
  const [documentsByConversation, setDocumentsByConversation] = useState<
    Record<string, DocumentRef[]>
  >({})
  const loadedDocumentsRef = useRef<Set<string>>(new Set())
  const documentAbortControllersRef = useRef<Map<string, AbortController>>(
    new Map(),
  )
  const [selectedModelId, setSelectedModelId] = useState(DEFAULT_MODEL_ID)
  const [webSearchEnabled, setWebSearchEnabledState] = useState(false)
  const setWebSearchEnabled = useCallback((enabled: boolean) => {
    setWebSearchEnabledState(enabled)
    if (typeof window !== 'undefined') {
      try {
        window.localStorage.setItem(
          'settings:webSearch',
          JSON.stringify(enabled),
        )
      } catch {
        // ignore quota errors
      }
    }
  }, [])
  const selectedModelIdRef = useRef(selectedModelId)
  const loadedMessagesRef = useRef<Set<string>>(new Set())
  const abortControllerRef = useRef<AbortController | null>(null)
  // Live ref for synchronous lookups inside async callbacks where state may
  // not have flushed yet (regenerate, switchSibling).
  const conversationsRef = useRef<Conversation[]>([])

  useEffect(() => {
    try {
      const storedModel = window.localStorage.getItem('settings:defaultModelId')
      if (storedModel) setSelectedModelId(JSON.parse(storedModel) as string)
      const storedSearch = window.localStorage.getItem('settings:webSearch')
      if (storedSearch) setWebSearchEnabledState(JSON.parse(storedSearch) as boolean)
    } catch {
      // ignore
    }
  }, [])

  useEffect(() => {
    selectedModelIdRef.current = selectedModelId
  }, [selectedModelId])

  useEffect(() => {
    conversationsRef.current = conversations
  }, [conversations])

  // Track current user
  useEffect(() => {
    let mounted = true
    supabase.auth.getUser().then(({ data }) => {
      if (mounted) setUserId(data.user?.id ?? null)
    })
    const { data } = supabase.auth.onAuthStateChange((_event, session) => {
      if (mounted) setUserId(session?.user?.id ?? null)
    })
    return () => {
      mounted = false
      data.subscription.unsubscribe()
    }
  }, [supabase])

  // Fetch conversation list when user is available
  useEffect(() => {
    if (!userId) {
      setConversations([])
      setIsLoadingConversations(false)
      loadedMessagesRef.current.clear()
      return
    }
    let cancelled = false
    setIsLoadingConversations(true)
    supabase
      .from('conversations')
      .select('id, title, updated_at, active_leaf_message_id')
      .order('updated_at', { ascending: false })
      .then(({ data, error }) => {
        if (cancelled) return
        if (error) {
          console.error('Failed to load conversations', error)
          setConversations([])
        } else {
          setConversations(
            (data ?? []).map((c) => ({
              id: c.id,
              title: c.title,
              updatedAt: c.updated_at,
              allMessages: [],
              activeLeafId: c.active_leaf_message_id ?? null,
            })),
          )
        }
        setIsLoadingConversations(false)
      })
    return () => {
      cancelled = true
    }
  }, [supabase, userId])

  const getConversation = useCallback(
    (id: string) => conversations.find((c) => c.id === id),
    [conversations],
  )

  const loadConversationMessages = useCallback(
    async (id: string) => {
      if (loadedMessagesRef.current.has(id)) return
      loadedMessagesRef.current.add(id)
      setIsLoadingMessageId(id)
      const { data, error } = await supabase
        .from('messages')
        .select(
          'id, role, content, parent_id, created_at, model, attachments(id, storage_path, name, mime_type, size_bytes)',
        )
        .eq('conversation_id', id)
        .order('created_at', { ascending: true })
      if (error) {
        loadedMessagesRef.current.delete(id)
        console.error('Failed to load messages', error)
        setIsLoadingMessageId(null)
        return
      }
      const rows = data ?? []
      const messages: Message[] = await Promise.all(
        rows.map(async (m) => {
          const atts =
            (m.attachments as
              | Array<{
                  id: string
                  storage_path: string
                  name: string | null
                  mime_type: string
                  size_bytes: number | null
                }>
              | null) ?? []
          const signed = await signAttachmentUrls(supabase, atts)
          return {
            id: m.id,
            role: m.role as Message['role'],
            content: m.content,
            parentId: m.parent_id ?? null,
            createdAt: m.created_at,
            model: (m.model as string | null) ?? undefined,
            attachments: signed.length > 0 ? signed : undefined,
          }
        }),
      )
      setConversations((prev) =>
        prev.map((c) => (c.id === id ? { ...c, allMessages: messages } : c)),
      )
      setIsLoadingMessageId(null)
    },
    [supabase],
  )

  const persistActiveLeaf = useCallback(
    async (conversationId: string, leafId: string | null) => {
      const { error } = await supabase
        .from('conversations')
        .update({ active_leaf_message_id: leafId })
        .eq('id', conversationId)
      if (error) console.error('Failed to update active leaf', error)
    },
    [supabase],
  )

  const createConversation = useCallback(
    async (initial: Message) => {
      if (!userId) throw new Error('Not signed in')
      const id = makeId()
      const title = titleFromMessage(initial.content || 'New chat')
      const nowIso = new Date().toISOString()
      const rootMessage: Message = { ...initial, parentId: null }

      // Optimistic insert
      setConversations((prev) => [
        {
          id,
          title,
          updatedAt: nowIso,
          isGeneratingTitle: true,
          allMessages: [rootMessage],
          activeLeafId: rootMessage.id,
        },
        ...prev,
      ])
      loadedMessagesRef.current.add(id)

      const { error: convErr } = await supabase.from('conversations').insert({
        id,
        user_id: userId,
        title,
        model: selectedModelIdRef.current,
      })
      if (convErr) {
        console.error('Failed to insert conversation', convErr)
        setConversations((prev) => prev.filter((c) => c.id !== id))
        loadedMessagesRef.current.delete(id)
        throw convErr
      }

      const { error: msgErr } = await supabase.from('messages').insert({
        id: rootMessage.id,
        conversation_id: id,
        role: rootMessage.role,
        content: rootMessage.content,
        parent_id: null,
      })
      if (msgErr) {
        console.error('Failed to insert initial message', msgErr)
      } else {
        void persistActiveLeaf(id, rootMessage.id)
        void attachReadyDocumentsToMessage(id, rootMessage.id)
      }

      if (rootMessage.attachments && rootMessage.attachments.length > 0) {
        const uploaded = await uploadAttachments(
          supabase,
          userId,
          id,
          rootMessage.id,
          rootMessage.attachments,
        )
        if (uploaded.length > 0) {
          const { error: attErr } = await supabase.from('attachments').insert(
            uploaded.map((u) => ({
              id: u.id,
              message_id: rootMessage.id,
              storage_path: u.storagePath,
              name: u.name,
              mime_type: u.mimeType,
              size_bytes: u.sizeBytes,
            })),
          )
          if (attErr) console.error('Failed to insert attachments', attErr)
        }
      }

      return id
    },
    [supabase, userId],
  )

  const createEmptyConversation = useCallback(async () => {
    if (!userId) throw new Error('Not signed in')
    const id = makeId()
    const nowIso = new Date().toISOString()
    setConversations((prev) => [
      {
        id,
        title: 'New chat',
        updatedAt: nowIso,
        allMessages: [],
        activeLeafId: null,
      },
      ...prev,
    ])
    loadedMessagesRef.current.add(id)
    // Mark docs as loaded so ConversationView's loadDocuments effect doesn't
    // race against an in-flight upload and overwrite the optimistic chip.
    loadedDocumentsRef.current.add(id)
    const { error } = await supabase.from('conversations').insert({
      id,
      user_id: userId,
      title: 'New chat',
      model: selectedModelIdRef.current,
    })
    if (error) {
      console.error('Failed to insert empty conversation', error)
      setConversations((prev) => prev.filter((c) => c.id !== id))
      loadedMessagesRef.current.delete(id)
      loadedDocumentsRef.current.delete(id)
      throw error
    }
    return id
  }, [supabase, userId])

  const appendMessage = useCallback(
    async (conversationId: string, message: Message) => {
      const nowIso = new Date().toISOString()

      setConversations((prev) =>
        prev.map((c) =>
          c.id === conversationId
            ? {
                ...c,
                allMessages: [...c.allMessages, message],
                activeLeafId: message.id,
                updatedAt: nowIso,
              }
            : c,
        ),
      )

      const { error } = await supabase.from('messages').insert({
        id: message.id,
        conversation_id: conversationId,
        role: message.role,
        content: message.content,
        parent_id: message.parentId,
      })
      if (error) {
        console.error('Failed to insert message', error)
      } else {
        void attachReadyDocumentsToMessage(conversationId, message.id)
      }
      void persistActiveLeaf(conversationId, message.id)

      if (userId && message.attachments && message.attachments.length > 0) {
        const uploaded = await uploadAttachments(
          supabase,
          userId,
          conversationId,
          message.id,
          message.attachments,
        )
        if (uploaded.length > 0) {
          const { error: attErr } = await supabase.from('attachments').insert(
            uploaded.map((u) => ({
              id: u.id,
              message_id: message.id,
              storage_path: u.storagePath,
              name: u.name,
              mime_type: u.mimeType,
              size_bytes: u.sizeBytes,
            })),
          )
          if (attErr) console.error('Failed to insert attachments', attErr)
        }
      }
    },
    [persistActiveLeaf, supabase, userId],
  )

  const updateMessageContent = useCallback(
    (
      conversationId: string,
      messageId: string,
      updater: (prev: string) => string,
    ) => {
      setConversations((prev) =>
        prev.map((c) =>
          c.id === conversationId
            ? {
                ...c,
                allMessages: c.allMessages.map((m) =>
                  m.id === messageId
                    ? { ...m, content: updater(m.content) }
                    : m,
                ),
              }
            : c,
        ),
      )
    },
    [],
  )

  const persistAssistantMessage = useCallback(
    async (conversationId: string, message: Message) => {
      const { error } = await supabase.from('messages').insert({
        id: message.id,
        conversation_id: conversationId,
        role: 'assistant',
        content: message.content,
        parent_id: message.parentId,
        model: message.model ?? null,
      })
      if (error) {
        console.error('Failed to persist assistant message', error)
      }
    },
    [supabase],
  )

  const renameConversation = useCallback(
    async (id: string, title: string) => {
      setConversations((prev) =>
        prev.map((c) => (c.id === id ? { ...c, title } : c)),
      )
      const { error } = await supabase
        .from('conversations')
        .update({ title })
        .eq('id', id)
      if (error) console.error('Failed to rename conversation', error)
    },
    [supabase],
  )

  const deleteConversation = useCallback(
    async (id: string) => {
      setConversations((prev) => prev.filter((c) => c.id !== id))
      loadedMessagesRef.current.delete(id)
      loadedDocumentsRef.current.delete(id)
      setDocumentsByConversation((prev) => {
        if (!(id in prev)) return prev
        const next = { ...prev }
        delete next[id]
        return next
      })
      const { error } = await supabase
        .from('conversations')
        .delete()
        .eq('id', id)
      if (error) console.error('Failed to delete conversation', error)
    },
    [supabase],
  )

  const loadDocuments = useCallback(async (conversationId: string) => {
    if (loadedDocumentsRef.current.has(conversationId)) return
    loadedDocumentsRef.current.add(conversationId)
    try {
      const res = await fetch(
        `/api/documents?conversationId=${encodeURIComponent(conversationId)}`,
      )
      if (!res.ok) throw new Error(`Failed (${res.status})`)
      const { documents } = (await res.json()) as {
        documents: Array<{
          id: string
          message_id: string | null
          name: string
          mime_type: string
          size_bytes: number
          status: DocumentRef['status']
          page_count: number | null
          chunk_count: number
          error_message: string | null
          created_at: string
        }>
      }
      const refs: DocumentRef[] = documents.map((d) => ({
        id: d.id,
        conversationId,
        messageId: d.message_id,
        name: d.name,
        mimeType: d.mime_type,
        sizeBytes: d.size_bytes,
        status: d.status,
        pageCount: d.page_count,
        chunkCount: d.chunk_count,
        error: d.error_message ?? undefined,
        createdAt: d.created_at,
      }))
      setDocumentsByConversation((prev) => ({ ...prev, [conversationId]: refs }))
    } catch (err) {
      console.error('Failed to load documents', err)
      loadedDocumentsRef.current.delete(conversationId)
    }
  }, [])

  const updateDocument = useCallback(
    (
      conversationId: string,
      documentId: string,
      patch: Partial<DocumentRef>,
    ) => {
      setDocumentsByConversation((prev) => {
        const list = prev[conversationId] ?? []
        return {
          ...prev,
          [conversationId]: list.map((d) =>
            d.id === documentId ? { ...d, ...patch } : d,
          ),
        }
      })
    },
    [],
  )

  const uploadDocument = useCallback(
    async (file: File, conversationId: string) => {
      const tempId = makeId()
      const optimistic: DocumentRef = {
        id: tempId,
        conversationId,
        name: file.name,
        mimeType: file.type,
        sizeBytes: file.size,
        status: 'uploading',
        createdAt: new Date().toISOString(),
      }
      setDocumentsByConversation((prev) => ({
        ...prev,
        [conversationId]: [...(prev[conversationId] ?? []), optimistic],
      }))

      const controller = new AbortController()
      const form = new FormData()
      form.append('file', file)
      form.append('conversationId', conversationId)

      let serverId: string | null = null
      try {
        const res = await fetch('/api/documents', {
          method: 'POST',
          body: form,
          signal: controller.signal,
        })
        if (!res.ok || !res.body) {
          const text = await res.text().catch(() => '')
          throw new Error(text || `Upload failed (${res.status})`)
        }

        const reader = res.body.getReader()
        const decoder = new TextDecoder()
        let buffer = ''
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
            if (payload === '[DONE]') {
              finished = true
              break
            }
            try {
              const parsed = JSON.parse(payload) as {
                type?: string
                id?: string
                phase?: 'parsing' | 'embedding'
                completed?: number
                total?: number
                chunkCount?: number
                pageCount?: number | null
                error?: string
              }
              if (parsed.type === 'doc.created' && parsed.id) {
                const newId = parsed.id
                serverId = newId
                setDocumentsByConversation((prev) => {
                  const list = prev[conversationId] ?? []
                  return {
                    ...prev,
                    [conversationId]: list.map((d) =>
                      d.id === tempId ? { ...d, id: newId } : d,
                    ),
                  }
                })
                documentAbortControllersRef.current.set(newId, controller)
              } else if (parsed.type === 'doc.progress' && serverId) {
                const status: DocumentRef['status'] =
                  parsed.phase === 'parsing' ? 'parsing' : 'embedding'
                updateDocument(conversationId, serverId, {
                  status,
                  progress:
                    parsed.completed !== undefined &&
                    parsed.total !== undefined
                      ? { completed: parsed.completed, total: parsed.total }
                      : undefined,
                })
              } else if (parsed.type === 'doc.ready' && serverId) {
                updateDocument(conversationId, serverId, {
                  status: 'ready',
                  chunkCount: parsed.chunkCount,
                  pageCount: parsed.pageCount ?? null,
                  progress: undefined,
                })
              } else if (parsed.type === 'doc.error' && serverId) {
                updateDocument(conversationId, serverId, {
                  status: 'error',
                  error: parsed.error,
                  progress: undefined,
                })
              }
            } catch {
              // ignore malformed SSE chunk
            }
          }
        }

        if (!serverId) {
          throw new Error('Upload did not return a document id')
        }
        return { documentId: serverId }
      } catch (err) {
        const isAbort =
          (err instanceof DOMException && err.name === 'AbortError') ||
          (err instanceof Error && err.name === 'AbortError')
        const idToMark = serverId ?? tempId
        if (isAbort) {
          setDocumentsByConversation((prev) => {
            const list = prev[conversationId] ?? []
            return {
              ...prev,
              [conversationId]: list.filter((d) => d.id !== idToMark),
            }
          })
        } else {
          const msg = err instanceof Error ? err.message : String(err)
          updateDocument(conversationId, idToMark, {
            status: 'error',
            error: msg,
            progress: undefined,
          })
        }
        throw err
      } finally {
        if (serverId) documentAbortControllersRef.current.delete(serverId)
      }
    },
    [updateDocument],
  )

  const removeDocument = useCallback(
    async (conversationId: string, documentId: string) => {
      const current =
        documentsByConversation[conversationId]?.find(
          (d) => d.id === documentId,
        ) ?? null

      const inFlight = documentAbortControllersRef.current.get(documentId)
      if (inFlight) {
        inFlight.abort()
        documentAbortControllersRef.current.delete(documentId)
      }

      setDocumentsByConversation((prev) => {
        const list = prev[conversationId] ?? []
        return {
          ...prev,
          [conversationId]: list.filter((d) => d.id !== documentId),
        }
      })

      if (current && current.status !== 'uploading') {
        const res = await fetch(`/api/documents/${documentId}`, {
          method: 'DELETE',
        })
        if (!res.ok) {
          console.error('Failed to delete document on server')
        }
      }
    },
    [documentsByConversation],
  )

  const hasIndexingDocuments = useCallback(
    (conversationId: string) => {
      const list = documentsByConversation[conversationId] ?? []
      return list.some(
        (d) =>
          d.status === 'uploading' ||
          d.status === 'parsing' ||
          d.status === 'embedding',
      )
    },
    [documentsByConversation],
  )

  const documentsByConversationRef = useRef(documentsByConversation)
  useEffect(() => {
    documentsByConversationRef.current = documentsByConversation
  }, [documentsByConversation])

  const attachReadyDocumentsToMessage = useCallback(
    async (conversationId: string, messageId: string) => {
      const list = documentsByConversationRef.current[conversationId] ?? []
      const targetIds = list
        .filter((d) => !d.messageId && d.status === 'ready')
        .map((d) => d.id)
      if (targetIds.length === 0) return

      setDocumentsByConversation((prev) => {
        const cur = prev[conversationId] ?? []
        return {
          ...prev,
          [conversationId]: cur.map((d) =>
            targetIds.includes(d.id) ? { ...d, messageId } : d,
          ),
        }
      })

      const { error } = await supabase
        .from('documents')
        .update({ message_id: messageId })
        .in('id', targetIds)
      if (error) {
        console.error('Failed to link documents to message', error)
      }
    },
    [supabase],
  )

  const generateTitle = useCallback(
    async (conversationId: string, userMessage: string, assistantMessage: string) => {
      try {
        const res = await fetch(`/api/conversations/${conversationId}/title`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userMessage, assistantMessage }),
        })
        if (!res.ok) return
        const { title } = await res.json() as { title: string }
        if (title) {
          setConversations((prev) =>
            prev.map((c) =>
              c.id === conversationId ? { ...c, title, isGeneratingTitle: false } : c,
            ),
          )
        }
      } catch {
        // silently ignore — clear loader, title stays as fallback
        setConversations((prev) =>
          prev.map((c) =>
            c.id === conversationId ? { ...c, isGeneratingTitle: false } : c,
          ),
        )
      }
    },
    [],
  )

  const streamAssistantReply = useCallback(
    (
      conversationId: string,
      history: Message[],
      options?: { webSearch?: boolean },
    ) => {
      const lastMsg = history[history.length - 1]
      const assistantId = makeId()
      const webSearch = options?.webSearch === true
      const assistantMessage: Message = {
        id: assistantId,
        role: 'assistant',
        content: '',
        parentId: lastMsg?.id ?? null,
        createdAt: new Date().toISOString(),
        model: selectedModelIdRef.current,
      }
      // Optimistic in-memory append + set as active leaf so view follows it.
      setConversations((prev) =>
        prev.map((c) =>
          c.id === conversationId
            ? {
                ...c,
                allMessages: [...c.allMessages, assistantMessage],
                activeLeafId: assistantId,
              }
            : c,
        ),
      )

      // Abort any previous in-flight stream before starting a new one.
      abortControllerRef.current?.abort()
      const controller = new AbortController()
      abortControllerRef.current = controller
      setIsStreaming(true)
      setStreamingMessageId(assistantId)

      let accumulated = ''
      let errored = false

      // rAF-paced typewriter queue
      let displayQueue = ''
      let rafId = 0
      const flush = () => {
        if (!displayQueue) {
          rafId = 0
          return
        }
        const take = Math.max(2, Math.ceil(displayQueue.length / 12))
        const chunk = displayQueue.slice(0, take)
        displayQueue = displayQueue.slice(take)
        updateMessageContent(
          conversationId,
          assistantId,
          (prev) => prev + chunk,
        )
        rafId = requestAnimationFrame(flush)
      }
      const enqueueDisplay = (text: string) => {
        displayQueue += text
        if (!rafId) rafId = requestAnimationFrame(flush)
      }

      void (async () => {
        try {
          const res = await fetch('/api/chat', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              messages: history,
              model: selectedModelIdRef.current,
              webSearch,
              assistantMessageId: assistantId,
              conversationId,
            }),
            signal: controller.signal,
          })

          if (!res.ok || !res.body) {
            const text = await res.text().catch(() => '')
            throw new Error(
              `Request failed (${res.status})${text ? `: ${text}` : ''}`,
            )
          }

          const reader = res.body.getReader()
          const decoder = new TextDecoder()
          let buffer = ''
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
              if (payload === '[DONE]') {
                finished = true
                break
              }
              try {
                const parsed = JSON.parse(payload) as {
                  type?: string
                  delta?: string
                  error?: string
                  messageId?: string
                  query?: string
                  domain?: string
                  count?: number
                  phase?: 'reading' | 'extracted' | 'fallback'
                  sources?: { url: string; domain: string; title: string }[]
                }
                if (parsed.error) {
                  const errLine = `\n\n_[Error: ${parsed.error}]_`
                  accumulated += errLine
                  enqueueDisplay(errLine)
                  errored = true
                  finished = true
                  break
                }
                if (parsed.type === 'web_search.start') {
                  setSearchStatuses((s) => ({
                    ...s,
                    [assistantId]: {
                      status: 'searching',
                      query: parsed.query,
                    },
                  }))
                  continue
                }
                if (parsed.type === 'web_search.progress') {
                  setSearchStatuses((s) => ({
                    ...s,
                    [assistantId]: {
                      ...s[assistantId],
                      status: 'searching',
                      currentDomain: parsed.domain,
                      phase: parsed.phase,
                    },
                  }))
                  continue
                }
                if (parsed.type === 'web_search.complete') {
                  setSearchStatuses((s) => ({
                    ...s,
                    [assistantId]: {
                      ...s[assistantId],
                      status: 'synthesizing',
                      currentDomain: undefined,
                      phase: undefined,
                      count: parsed.count,
                      sources: parsed.sources,
                    },
                  }))
                  continue
                }
                if (parsed.delta) {
                  setSearchStatuses((s) => {
                    const prev = s[assistantId]
                    if (!prev || prev.status === 'done') return s
                    return {
                      ...s,
                      [assistantId]: { ...prev, status: 'done' },
                    }
                  })
                }
                if (parsed.delta) {
                  const delta = parsed.delta
                  accumulated += delta
                  enqueueDisplay(delta)
                }
              } catch {
                // ignore malformed chunk
              }
            }
          }
        } catch (err) {
          const isAbort =
            (err instanceof DOMException && err.name === 'AbortError') ||
            (err instanceof Error && err.name === 'AbortError')
          if (!isAbort) {
            const msg = err instanceof Error ? err.message : String(err)
            const errLine = `\n\n_[Error: ${msg}]_`
            accumulated += errLine
            enqueueDisplay(errLine)
            errored = true
          }
        } finally {
          if (rafId) cancelAnimationFrame(rafId)
          if (displayQueue) {
            const remaining = displayQueue
            displayQueue = ''
            updateMessageContent(
              conversationId,
              assistantId,
              (prev) => prev + remaining,
            )
          }
          if (abortControllerRef.current === controller) {
            abortControllerRef.current = null
            setIsStreaming(false)
            setStreamingMessageId(null)
          }
          if (accumulated || errored) {
            await persistAssistantMessage(conversationId, {
              ...assistantMessage,
              content: accumulated,
            })
            void persistActiveLeaf(conversationId, assistantId)
          }
          // Generate AI title after the first exchange
          const firstUserMsg = history[0]
          if (
            history.length === 1 &&
            firstUserMsg?.role === 'user' &&
            accumulated &&
            !errored
          ) {
            void generateTitle(conversationId, firstUserMsg.content, accumulated)
          }
        }
      })()
    },
    [generateTitle, persistActiveLeaf, persistAssistantMessage, updateMessageContent],
  )

  const stopStreaming = useCallback(() => {
    abortControllerRef.current?.abort()
  }, [])

  const regenerateAssistantMessage = useCallback(
    (conversationId: string, assistantMessageId: string) => {
      const conv = conversationsRef.current.find(
        (c) => c.id === conversationId,
      )
      if (!conv) return
      const target = conv.allMessages.find((m) => m.id === assistantMessageId)
      if (!target || target.role !== 'assistant' || !target.parentId) return

      // Build history up to (and including) the parent user message; this is
      // what the AI saw the first time. The new assistant message becomes a
      // sibling because streamAssistantReply sets parentId = last history msg id.
      const path = buildActivePath(conv.allMessages, target.parentId)
      if (path.length === 0) return

      stopStreaming()
      streamAssistantReply(conversationId, path)
    },
    [stopStreaming, streamAssistantReply],
  )

  const switchSibling = useCallback(
    async (
      conversationId: string,
      currentMessageId: string,
      direction: 'prev' | 'next',
    ) => {
      const conv = conversationsRef.current.find(
        (c) => c.id === conversationId,
      )
      if (!conv) return
      const curr = conv.allMessages.find((m) => m.id === currentMessageId)
      if (!curr) return
      const siblings = getSiblings(conv.allMessages, curr)
      const idx = siblings.findIndex((s) => s.id === curr.id)
      const targetIdx = direction === 'next' ? idx + 1 : idx - 1
      const target = siblings[targetIdx]
      if (!target) return

      // If currently streaming a different branch, stop it first.
      if (isStreaming) stopStreaming()

      const newLeaf = latestLeafInSubtree(conv.allMessages, target.id)
      setConversations((prev) =>
        prev.map((c) =>
          c.id === conversationId ? { ...c, activeLeafId: newLeaf } : c,
        ),
      )
      await persistActiveLeaf(conversationId, newLeaf)
    },
    [isStreaming, persistActiveLeaf, stopStreaming],
  )

  const value = useMemo<ChatState>(
    () => ({
      conversations,
      isLoadingConversations,
      isLoadingMessageId,
      isStreaming,
      streamingMessageId,
      searchStatuses,
      documentsByConversation,
      webSearchEnabled,
      setWebSearchEnabled,
      selectedModelId,
      setSelectedModelId,
      getConversation,
      loadConversationMessages,
      createConversation,
      createEmptyConversation,
      appendMessage,
      renameConversation,
      deleteConversation,
      streamAssistantReply,
      stopStreaming,
      regenerateAssistantMessage,
      switchSibling,
      loadDocuments,
      uploadDocument,
      removeDocument,
      hasIndexingDocuments,
    }),
    [
      conversations,
      isLoadingConversations,
      isLoadingMessageId,
      isStreaming,
      streamingMessageId,
      searchStatuses,
      documentsByConversation,
      webSearchEnabled,
      setWebSearchEnabled,
      selectedModelId,
      getConversation,
      loadConversationMessages,
      createConversation,
      createEmptyConversation,
      appendMessage,
      renameConversation,
      deleteConversation,
      streamAssistantReply,
      stopStreaming,
      regenerateAssistantMessage,
      switchSibling,
      loadDocuments,
      uploadDocument,
      removeDocument,
      hasIndexingDocuments,
    ],
  )

  return <ChatContext.Provider value={value}>{children}</ChatContext.Provider>
}

export function useChat() {
  const ctx = useContext(ChatContext)
  if (!ctx) throw new Error('useChat must be used within ChatProvider')
  return ctx
}
