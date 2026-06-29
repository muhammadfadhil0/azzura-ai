import { useChat } from "@/components/chat/chat-provider";
import { MessageAttachments } from "@/components/chat/message-attachments";
import { MessageDocuments } from "@/components/chat/message-documents";
import type { Message } from "@/types/chat";

export function MessageUser({
  message,
  conversationId,
}: {
  message: Message;
  conversationId: string;
}) {
  const { documentsByConversation } = useChat();
  const docs = (documentsByConversation[conversationId] ?? []).filter(
    (d) => d.messageId === message.id,
  );

  return (
    <div className="flex justify-end">
      <div className="flex max-w-[75%] animate-in fade-in slide-in-from-bottom-2 flex-col items-end duration-200">
        {message.attachments && message.attachments.length > 0 ? (
          <MessageAttachments attachments={message.attachments} />
        ) : null}
        {docs.length > 0 ? <MessageDocuments documents={docs} /> : null}
        {message.content ? (
          <div className="rounded-3xl bg-surface px-4 py-2.5 text-sm whitespace-pre-wrap">
            {message.content}
          </div>
        ) : null}
      </div>
    </div>
  );
}
