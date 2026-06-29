'use client'

import { useMemo } from 'react'
import { useChat } from '@/components/chat/chat-provider'
import { ConversationSection } from '@/components/sidebar/conversation-section'
import { bucketConversations } from '@/lib/date-buckets'

export function ConversationList({ query }: { query: string }) {
  const { conversations, isLoadingConversations } = useChat()

  const groups = useMemo(() => {
    const filtered = query.trim()
      ? conversations.filter((c) =>
          c.title.toLowerCase().includes(query.trim().toLowerCase()),
        )
      : conversations
    return bucketConversations(filtered)
  }, [conversations, query])

  if (isLoadingConversations) {
    return (
      <p className="px-4 py-6 text-center text-xs text-muted-foreground">
        Loading…
      </p>
    )
  }

  if (groups.length === 0) {
    return (
      <p className="px-4 py-6 text-center text-xs text-muted-foreground">
        No conversations yet.
      </p>
    )
  }

  return (
    <div className="flex flex-col">
      {groups.map(({ bucket, items }) => (
        <ConversationSection key={bucket} label={bucket} items={items} />
      ))}
    </div>
  )
}
