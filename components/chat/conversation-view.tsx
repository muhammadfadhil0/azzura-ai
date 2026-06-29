'use client'

import { IconLoader2 } from '@tabler/icons-react'
import Link from 'next/link'
import { useEffect, useMemo } from 'react'
import { useChat } from '@/components/chat/chat-provider'
import { Composer, type ComposerPayload } from '@/components/chat/composer'
import { MessageList } from '@/components/chat/message-list'
import { TopBar } from '@/components/chat/top-bar'
import { buildActivePath } from '@/lib/chat/tree'
import type { Message } from '@/types/chat'

function makeId() {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID()
  }
  return Math.random().toString(36).slice(2)
}

const MAX_DOCS_PER_CONVERSATION = 5

export function ConversationView({ id }: { id: string }) {
  const {
    getConversation,
    isLoadingConversations,
    isLoadingMessageId,
    loadConversationMessages,
    appendMessage,
    streamAssistantReply,
    documentsByConversation,
    loadDocuments,
    uploadDocument,
    removeDocument,
    hasIndexingDocuments,
  } = useChat()
  const conversation = getConversation(id)
  const allDocuments = documentsByConversation[id] ?? []
  // Composer only shows docs not yet attached to a message. Once the user sends
  // a message, ready+unattached docs migrate into that message bubble.
  const composerDocuments = allDocuments.filter((d) => !d.messageId)
  const blockSendForIndexing = hasIndexingDocuments(id)
  const documentUploadDisabled = allDocuments.length >= MAX_DOCS_PER_CONVERSATION

  useEffect(() => {
    if (conversation) {
      void loadConversationMessages(id)
      void loadDocuments(id)
    }
  }, [conversation, id, loadConversationMessages, loadDocuments])

  const handleDocumentPicked = (file: File) => {
    void uploadDocument(file, id).catch((err) => {
      console.error('Document upload failed', err)
    })
  }

  const handleRemoveDocument = (docId: string) => {
    void removeDocument(id, docId).catch((err) => {
      console.error('Failed to remove document', err)
    })
  }

  const activePath = useMemo(
    () =>
      conversation
        ? buildActivePath(conversation.allMessages, conversation.activeLeafId)
        : [],
    [conversation],
  )

  const isLoadingMessages = isLoadingMessageId === id

  if (!conversation) {
    if (isLoadingConversations) {
      return (
        <>
          <TopBar />
          <div className="flex flex-1 items-center justify-center">
            <IconLoader2 className="size-5 animate-spin text-muted-foreground" />
          </div>
        </>
      )
    }
    return (
      <>
        <TopBar />
        <div className="flex flex-1 flex-col items-center justify-center gap-3 text-sm text-muted-foreground">
          <p>Conversation not found.</p>
          <Link href="/" className="underline">
            Start a new chat
          </Link>
        </div>
      </>
    )
  }

  const handleSend = async ({
    text,
    attachments,
    webSearch,
  }: ComposerPayload) => {
    const userMessage: Message = {
      id: makeId(),
      role: 'user',
      content: text,
      parentId: conversation.activeLeafId,
      attachments: attachments.length > 0 ? attachments : undefined,
      createdAt: new Date().toISOString(),
    }
    const history = [...activePath, userMessage]
    await appendMessage(conversation.id, userMessage)
    streamAssistantReply(conversation.id, history, { webSearch })
  }

  if (isLoadingMessages) {
    return (
      <>
        <TopBar />
        <div className="flex flex-1 items-center justify-center">
          <IconLoader2 className="size-5 animate-spin text-muted-foreground" />
        </div>
        <Composer
          onSend={handleSend}
          documents={composerDocuments}
          onDocumentPicked={handleDocumentPicked}
          onRemoveDocument={handleRemoveDocument}
          blockSendForIndexing={blockSendForIndexing}
          documentUploadDisabled={documentUploadDisabled}
        />
      </>
    )
  }

  return (
    <>
      <TopBar />
      <MessageList
        messages={activePath}
        allMessages={conversation.allMessages}
        conversationId={conversation.id}
      />
      <Composer
        onSend={handleSend}
        documents={composerDocuments}
        onDocumentPicked={handleDocumentPicked}
        onRemoveDocument={handleRemoveDocument}
        blockSendForIndexing={blockSendForIndexing}
        documentUploadDisabled={documentUploadDisabled}
      />
    </>
  )
}
