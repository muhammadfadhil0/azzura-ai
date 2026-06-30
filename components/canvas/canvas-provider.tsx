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
import { usePathname } from 'next/navigation'
import { toast } from 'sonner'
import { useSidebar } from '@/hooks/use-sidebar'
import { CanvasAnimator } from '@/components/canvas/canvas-animator'
import type {
  Canvas,
  CanvasMode,
  CanvasRevision,
  CanvasRevisionResult,
  CanvasSnapshot,
  CanvasSource,
} from '@/types/canvas'

const MAX_STACK = 50
const USER_EDIT_DEBOUNCE_MS = 1500

interface BeginRevisionMeta {
  conversationId: string
  messageId: string
}

interface CompleteRevisionMeta extends CanvasRevisionResult {
  conversationId: string
}

interface CanvasState {
  isOpen: boolean
  conversationId: string | null
  canvasId: string | null
  title: string
  displayContent: string
  sourceContent: string
  viewMode: 'preview' | 'edit'
  isAnimating: boolean
  isAIWriting: boolean
  canUndo: boolean
  canRedo: boolean
  activeRevisionId: string | null
  openForConversation: (conversationId: string) => Promise<void>
  close: () => void
  setTitle: (t: string) => void
  commitTitle: () => Promise<void>
  setViewMode: (m: 'preview' | 'edit') => void
  applyUserEdit: (next: string) => void
  undo: () => void
  redo: () => void
  copy: () => Promise<void>
  print: () => void
  jumpToRevision: (revisionId: string) => Promise<void>
}

const CanvasContext = createContext<CanvasState | null>(null)

// Bridge — stable callbacks ChatProvider can call without re-renders.
export interface CanvasBridge {
  beginAIRevision: (meta: BeginRevisionMeta) => void
  pushAIDelta: (delta: string) => void
  completeAIRevision: (meta: CompleteRevisionMeta) => void
  abortAIRevision: () => void
}

const BridgeContext = createContext<CanvasBridge | null>(null)

type RevisionRow = {
  id: string
  canvas_id: string
  conversation_id: string
  message_id: string | null
  revision_index: number
  content: string
  word_count: number
  source: CanvasSource
  mode: CanvasMode
  prev_revision_id: string | null
  created_at: string
}

type CanvasRow = {
  id: string
  conversation_id: string
  title: string
  current_revision_id: string | null
  created_at: string
  updated_at: string
}

function rowToRevision(r: RevisionRow): CanvasRevision {
  return {
    id: r.id,
    canvasId: r.canvas_id,
    conversationId: r.conversation_id,
    messageId: r.message_id,
    revisionIndex: r.revision_index,
    content: r.content,
    wordCount: r.word_count,
    source: r.source,
    mode: r.mode,
    prevRevisionId: r.prev_revision_id,
    createdAt: r.created_at,
  }
}

function rowToCanvas(c: CanvasRow): Canvas {
  return {
    id: c.id,
    conversationId: c.conversation_id,
    title: c.title,
    currentRevisionId: c.current_revision_id,
    createdAt: c.created_at,
    updatedAt: c.updated_at,
  }
}

export function CanvasProvider({ children }: { children: ReactNode }) {
  const { collapsed, setCollapsed } = useSidebar()

  const [isOpen, setIsOpen] = useState(false)
  const [conversationId, setConversationId] = useState<string | null>(null)
  const [canvasId, setCanvasId] = useState<string | null>(null)
  const [title, setTitleState] = useState('Untitled canvas')
  const [titleDraft, setTitleDraft] = useState('Untitled canvas')
  const [displayContent, setDisplayContent] = useState('')
  const [sourceContent, setSourceContent] = useState('')
  const [viewMode, setViewModeState] = useState<'preview' | 'edit'>('preview')
  const [isAnimating, setIsAnimating] = useState(false)
  const [isAIWriting, setIsAIWriting] = useState(false)
  const [undoStack, setUndoStack] = useState<CanvasSnapshot[]>([])
  const [redoStack, setRedoStack] = useState<CanvasSnapshot[]>([])
  const [activeRevisionId, setActiveRevisionId] = useState<string | null>(null)

  // Whether we were the ones who collapsed the sidebar, so we can restore on close.
  const sidebarRestoreRef = useRef<boolean | null>(null)

  // Live-stream state for AI write: when the canvas was empty at the start of an
  // AI revision, we type the deltas straight into displayContent so the user
  // sees progress immediately. When the canvas already had content, we ignore
  // deltas and run a single delete→type animation on canvas.complete instead.
  const liveStreamRef = useRef<{ buffer: string; active: boolean } | null>(null)

  // Animator instance — wires onTick to setDisplayContent.
  const animatorRef = useRef<CanvasAnimator | null>(null)
  if (animatorRef.current === null) {
    animatorRef.current = new CanvasAnimator(
      (s) => setDisplayContent(s),
      () => setIsAnimating(false),
    )
  }

  // Debounced user-edit save.
  const userEditTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const pendingUserEditRef = useRef<string | null>(null)
  const canvasIdRef = useRef<string | null>(null)
  useEffect(() => {
    canvasIdRef.current = canvasId
  }, [canvasId])

  const pushUndo = useCallback((snap: CanvasSnapshot) => {
    setUndoStack((prev) => {
      const next = [...prev, snap]
      if (next.length > MAX_STACK) next.shift()
      return next
    })
    setRedoStack([])
  }, [])

  const animate = useCallback((from: string, to: string) => {
    const animator = animatorRef.current
    if (!animator) {
      setDisplayContent(to)
      return
    }
    if (from === to) {
      setDisplayContent(to)
      return
    }
    setIsAnimating(true)
    animator.animateTo(from, to)
  }, [])

  const openForConversation = useCallback(
    async (convId: string) => {
      setConversationId(convId)
      setIsOpen(true)
      if (!collapsed) {
        sidebarRestoreRef.current = false
        setCollapsed(true)
      }
      try {
        const res = await fetch(
          `/api/canvas?conversationId=${encodeURIComponent(convId)}`,
        )
        if (!res.ok) return
        const { canvas, revisions } = (await res.json()) as {
          canvas: CanvasRow | null
          revisions: RevisionRow[]
        }
        if (!canvas) {
          setCanvasId(null)
          setTitleState('Untitled canvas')
          setTitleDraft('Untitled canvas')
          setSourceContent('')
          setDisplayContent('')
          setUndoStack([])
          setRedoStack([])
          return
        }
        const c = rowToCanvas(canvas)
        setCanvasId(c.id)
        setTitleState(c.title)
        setTitleDraft(c.title)
        // revisions came newest-first; reverse for stack (oldest at bottom).
        const ordered = [...revisions].reverse().map(rowToRevision)
        const current = ordered[ordered.length - 1]
        const currentContent = current?.content ?? ''
        setSourceContent(currentContent)
        setDisplayContent(currentContent)
        setUndoStack(
          ordered.map((r) => ({
            content: r.content,
            revisionId: r.id,
            source: r.source,
          })),
        )
        setRedoStack([])
      } catch (err) {
        console.error('Failed to hydrate canvas', err)
      }
    },
    [collapsed, setCollapsed],
  )

  const close = useCallback(() => {
    setIsOpen(false)
    if (sidebarRestoreRef.current === false) {
      setCollapsed(false)
      sidebarRestoreRef.current = null
    }
  }, [setCollapsed])

  // Auto-close the panel when the user navigates to a different conversation
  // (or to /, /projects, etc.). Match conversation id from `/c/<id>` segment so
  // it works for both `/c/[id]` and `/projects/[id]/c/[convId]` routes.
  const pathname = usePathname()
  const routeConvId = useMemo(() => {
    if (!pathname) return null
    const m = pathname.match(/\/c\/([^/?#]+)/)
    return m ? m[1] : null
  }, [pathname])
  useEffect(() => {
    if (!isOpen) return
    if (conversationId && routeConvId !== conversationId) {
      close()
    }
  }, [routeConvId, conversationId, isOpen, close])

  const setTitle = useCallback((t: string) => {
    setTitleDraft(t)
  }, [])

  const commitTitle = useCallback(async () => {
    const next = titleDraft.trim() || 'Untitled canvas'
    if (next === title) return
    setTitleState(next)
    if (!canvasIdRef.current) return
    try {
      await fetch(`/api/canvas/${canvasIdRef.current}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: next }),
      })
    } catch (err) {
      console.error('Failed to update canvas title', err)
    }
  }, [titleDraft, title])

  const setViewMode = useCallback((m: 'preview' | 'edit') => {
    setViewModeState(m)
  }, [])

  const flushUserEdit = useCallback(async () => {
    const next = pendingUserEditRef.current
    pendingUserEditRef.current = null
    const id = canvasIdRef.current
    if (next === null || !id) return
    try {
      const res = await fetch(`/api/canvas/${id}/revisions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: next }),
      })
      if (!res.ok) throw new Error(`Save failed (${res.status})`)
      const { revision } = (await res.json()) as { revision: RevisionRow }
      pushUndo({
        content: next,
        revisionId: revision.id,
        source: 'user',
      })
    } catch (err) {
      console.error('Failed to save user canvas edit', err)
      toast.error('Gagal menyimpan suntingan canvas')
    }
  }, [pushUndo])

  const applyUserEdit = useCallback(
    (next: string) => {
      setSourceContent(next)
      setDisplayContent(next)
      pendingUserEditRef.current = next
      if (userEditTimerRef.current) clearTimeout(userEditTimerRef.current)
      userEditTimerRef.current = setTimeout(() => {
        void flushUserEdit()
      }, USER_EDIT_DEBOUNCE_MS)
    },
    [flushUserEdit],
  )

  // Flush on unmount to avoid losing edits.
  useEffect(() => {
    return () => {
      if (userEditTimerRef.current) clearTimeout(userEditTimerRef.current)
      void flushUserEdit()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const undo = useCallback(() => {
    if (isAnimating || isAIWriting) return
    setUndoStack((prevStack) => {
      if (prevStack.length <= 1) return prevStack
      const top = prevStack[prevStack.length - 1]
      const target = prevStack[prevStack.length - 2]
      setRedoStack((r) => [...r, top])
      setSourceContent(target.content)
      animate(top.content, target.content)
      return prevStack.slice(0, -1)
    })
  }, [animate, isAnimating, isAIWriting])

  const redo = useCallback(() => {
    if (isAnimating || isAIWriting) return
    setRedoStack((prevRedo) => {
      if (prevRedo.length === 0) return prevRedo
      const top = prevRedo[prevRedo.length - 1]
      setUndoStack((u) => [...u, top])
      setSourceContent((prev) => {
        animate(prev, top.content)
        return top.content
      })
      return prevRedo.slice(0, -1)
    })
  }, [animate, isAnimating, isAIWriting])

  const copy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(sourceContent)
      toast.success('Canvas tersalin ke clipboard')
    } catch {
      toast.error('Gagal menyalin canvas')
    }
  }, [sourceContent])

  const print = useCallback(() => {
    if (isAnimating) return
    if (viewMode === 'edit') setViewModeState('preview')
    requestAnimationFrame(() => window.print())
  }, [isAnimating, viewMode])

  // ===== Bridge =====
  const beginAIRevision = useCallback(
    (meta: BeginRevisionMeta) => {
      setIsAIWriting(true)

      const isSameConv = conversationId === meta.conversationId
      // Only treat existing content as "prior" if we're still on the same
      // conversation — different conv means stale state we should reset.
      const hadPrior = isSameConv && sourceContent.length > 0
      liveStreamRef.current = { buffer: '', active: !hadPrior }

      // Switching conversations (or first open) — reset stale content state.
      // Don't fetch from /api/canvas here: canvas.complete will deliver the
      // canonical content/id/title at the end of the stream, and fetching now
      // races against the live stream and can wipe displayContent.
      if (!isSameConv) {
        setConversationId(meta.conversationId)
        setCanvasId(null)
        setTitleState('Untitled canvas')
        setTitleDraft('Untitled canvas')
        setSourceContent('')
        setUndoStack([])
        setRedoStack([])
      }

      if (!hadPrior) {
        // Reset display so the live stream types from empty.
        setDisplayContent('')
      }

      // Auto-open panel + collapse sidebar (without fetching).
      if (!isOpen) {
        setIsOpen(true)
        if (!collapsed) {
          sidebarRestoreRef.current = false
          setCollapsed(true)
        }
      }
    },
    [collapsed, conversationId, isOpen, setCollapsed, sourceContent],
  )

  const pushAIDelta = useCallback((delta: string) => {
    const live = liveStreamRef.current
    if (!live || !live.active) return
    live.buffer += delta
    setDisplayContent(live.buffer)
  }, [])

  const completeAIRevision = useCallback(
    (meta: CompleteRevisionMeta) => {
      setIsAIWriting(false)
      const live = liveStreamRef.current
      liveStreamRef.current = null
      if (
        conversationId &&
        conversationId !== meta.conversationId
      ) {
        return
      }
      setCanvasId(meta.canvasId)
      if (meta.title) {
        setTitleState(meta.title)
        setTitleDraft(meta.title)
      }
      const prev = sourceContent
      setSourceContent(meta.content)
      pushUndo({
        content: meta.content,
        revisionId: meta.revisionId,
        source: 'ai',
      })
      setActiveRevisionId(meta.revisionId)
      if (live?.active) {
        // We were live-streaming — snap displayContent to the canonical final
        // content (handles any drift between streamed deltas and final args).
        setDisplayContent(meta.content)
      } else {
        // No live stream — run the delete→type animation from the prior content.
        animate(prev, meta.content)
      }
    },
    [animate, conversationId, pushUndo, sourceContent],
  )

  const abortAIRevision = useCallback(() => {
    setIsAIWriting(false)
    liveStreamRef.current = null
  }, [])

  const jumpToRevision = useCallback(
    async (revisionId: string) => {
      if (isAIWriting || isAnimating) return
      try {
        const res = await fetch(`/api/canvas/revisions/${revisionId}`)
        if (!res.ok) return
        const { revision } = (await res.json()) as { revision: RevisionRow }

        if (!isOpen) {
          setIsOpen(true)
          setConversationId(revision.conversation_id)
          setCanvasId(revision.canvas_id)
          if (!collapsed) {
            sidebarRestoreRef.current = false
            setCollapsed(true)
          }
        }

        const prev = sourceContent
        setSourceContent(revision.content)
        setActiveRevisionId(revisionId)
        animate(prev, revision.content)
        // Pure view — does NOT touch undo/redo stack.
      } catch (err) {
        console.error('Failed to jump to canvas revision', err)
      }
    },
    [animate, collapsed, isAIWriting, isAnimating, isOpen, setCollapsed, sourceContent],
  )

  const bridge = useMemo<CanvasBridge>(
    () => ({
      beginAIRevision,
      pushAIDelta,
      completeAIRevision,
      abortAIRevision,
    }),
    [beginAIRevision, pushAIDelta, completeAIRevision, abortAIRevision],
  )

  const value = useMemo<CanvasState>(
    () => ({
      isOpen,
      conversationId,
      canvasId,
      title: titleDraft,
      displayContent,
      sourceContent,
      viewMode,
      isAnimating,
      isAIWriting,
      canUndo: undoStack.length > 1 && !isAnimating && !isAIWriting,
      canRedo: redoStack.length > 0 && !isAnimating && !isAIWriting,
      activeRevisionId,
      openForConversation,
      close,
      setTitle,
      commitTitle,
      setViewMode,
      applyUserEdit,
      undo,
      redo,
      copy,
      print,
      jumpToRevision,
    }),
    [
      isOpen,
      conversationId,
      canvasId,
      titleDraft,
      displayContent,
      sourceContent,
      viewMode,
      isAnimating,
      isAIWriting,
      undoStack.length,
      redoStack.length,
      activeRevisionId,
      openForConversation,
      close,
      setTitle,
      commitTitle,
      setViewMode,
      applyUserEdit,
      undo,
      redo,
      copy,
      print,
      jumpToRevision,
    ],
  )

  return (
    <CanvasContext.Provider value={value}>
      <BridgeContext.Provider value={bridge}>{children}</BridgeContext.Provider>
    </CanvasContext.Provider>
  )
}

export function useCanvas() {
  const ctx = useContext(CanvasContext)
  if (!ctx) throw new Error('useCanvas must be used within CanvasProvider')
  return ctx
}

export function useCanvasBridge() {
  const ctx = useContext(BridgeContext)
  if (!ctx) throw new Error('useCanvasBridge must be used within CanvasProvider')
  return ctx
}
