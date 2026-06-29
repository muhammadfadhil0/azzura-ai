import { ConversationItem } from '@/components/sidebar/conversation-item'
import type { Conversation, DateBucket } from '@/types/chat'

interface Props {
  label: DateBucket
  items: Conversation[]
}

export function ConversationSection({ label, items }: Props) {
  return (
    <div className="px-2 pb-2">
      <h3 className="px-2.5 pb-1 pt-2 text-xs font-medium text-muted-foreground">
        {label}
      </h3>
      <div className="flex flex-col gap-0.5">
        {items.map((conv) => (
          <ConversationItem key={conv.id} conversation={conv} />
        ))}
      </div>
    </div>
  )
}
