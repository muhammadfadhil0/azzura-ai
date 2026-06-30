'use client'

import { useRouter } from 'next/navigation'
import { useRef } from 'react'
import { useChat } from '@/components/chat/chat-provider'
import {
  Composer,
  type ComposerHandle,
  type ComposerPayload,
} from '@/components/chat/composer'
import { EmptyState } from '@/components/chat/empty-state'
import { TopBar } from '@/components/chat/top-bar'

function makeId() {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID()
  }
  return Math.random().toString(36).slice(2)
}

export default function NewChatPage() {
  const router = useRouter()
  const {
    createConversation,
    createEmptyConversation,
    streamAssistantReply,
    uploadDocument,
  } = useChat()
  const composerRef = useRef<ComposerHandle>(null)

  const handleSend = async ({
    text,
    attachments,
    webSearch,
    canvas,
  }: ComposerPayload) => {
    const userMessage = {
      id: makeId(),
      role: 'user' as const,
      content: text,
      parentId: null,
      attachments: attachments.length > 0 ? attachments : undefined,
      createdAt: new Date().toISOString(),
    }
    try {
      const id = await createConversation(userMessage)
      streamAssistantReply(id, [userMessage], { webSearch, canvas })
      router.push(`/c/${id}`)
    } catch (err) {
      console.error('Failed to start new conversation', err)
    }
  }

  const handleDocumentPicked = async (file: File) => {
    try {
      const id = await createEmptyConversation()
      router.push(`/c/${id}`)
      void uploadDocument(file, id).catch((err) => {
        console.error('Document upload failed', err)
      })
    } catch (err) {
      console.error('Failed to create conversation for document', err)
    }
  }

  return (
    <>
      <TopBar />
      <div className="flex flex-1 flex-col justify-center">
        <EmptyState onSuggest={(p) => composerRef.current?.setText(p)} />
      </div>
      <Composer
        ref={composerRef}
        onSend={handleSend}
        onDocumentPicked={handleDocumentPicked}
        autoFocus
      />
    </>
  )
}
