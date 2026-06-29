import { ConversationView } from '@/components/chat/conversation-view'

export default async function ProjectConversationPage({
  params,
}: {
  params: Promise<{ id: string; convId: string }>
}) {
  const { id: projectId, convId } = await params
  return <ConversationView id={convId} projectId={projectId} />
}
