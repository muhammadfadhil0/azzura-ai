'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { useChat } from '@/components/chat/chat-provider'
import { MessageAssistant } from '@/components/chat/message-assistant'
import { MessageUser } from '@/components/chat/message-user'
import { getSiblings } from '@/lib/chat/tree'
import type { Message } from '@/types/chat'

const STICK_THRESHOLD_PX = 40

interface Props {
  messages: Message[]
  allMessages: Message[]
  conversationId: string
}

export function MessageList({ messages, allMessages, conversationId }: Props) {
  const { streamingMessageId, regenerateAssistantMessage, switchSibling } =
    useChat()
  const containerRef = useRef<HTMLDivElement>(null)
  const [stuck, setStuck] = useState(true)
  const stuckRef = useRef(stuck)
  const prevCountRef = useRef(messages.length)

  useEffect(() => {
    stuckRef.current = stuck
  }, [stuck])

  const totalChars = useMemo(
    () => messages.reduce((sum, m) => sum + m.content.length, 0),
    [messages],
  )

  useEffect(() => {
    if (messages.length > prevCountRef.current) {
      setStuck(true)
      stuckRef.current = true
      const el = containerRef.current
      if (el) el.scrollTop = el.scrollHeight
    }
    prevCountRef.current = messages.length
  }, [messages.length])

  useEffect(() => {
    if (!stuckRef.current) return
    const el = containerRef.current
    if (!el) return
    el.scrollTop = el.scrollHeight
  }, [totalChars])

  const handleScroll = () => {
    const el = containerRef.current
    if (!el) return
    const distance = el.scrollHeight - el.scrollTop - el.clientHeight
    const atBottom = distance < STICK_THRESHOLD_PX
    if (atBottom !== stuckRef.current) {
      setStuck(atBottom)
    }
  }

  return (
    <div
      ref={containerRef}
      onScroll={handleScroll}
      className="min-h-0 flex-1 overflow-y-auto"
    >
      <div className="mx-auto flex max-w-3xl flex-col gap-6 px-4 py-6">
        {messages.map((m) => {
          if (m.role === 'user') {
            return (
              <MessageUser
                key={m.id}
                message={m}
                conversationId={conversationId}
              />
            )
          }
          const siblings = getSiblings(allMessages, m)
          const siblingIndex = siblings.findIndex((s) => s.id === m.id) + 1
          const siblingCount = siblings.length
          return (
            <MessageAssistant
              key={m.id}
              message={m}
              isStreaming={streamingMessageId === m.id}
              siblingIndex={siblingIndex}
              siblingCount={siblingCount}
              onRegenerate={() =>
                regenerateAssistantMessage(conversationId, m.id)
              }
              onPrevSibling={
                siblingIndex > 1
                  ? () => switchSibling(conversationId, m.id, 'prev')
                  : undefined
              }
              onNextSibling={
                siblingIndex < siblingCount
                  ? () => switchSibling(conversationId, m.id, 'next')
                  : undefined
              }
            />
          )
        })}
      </div>
    </div>
  )
}
