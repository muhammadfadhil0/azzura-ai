'use client'

import { useRef, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { IconFolder, IconMessageCircle, IconBook } from '@tabler/icons-react'
import { KnowledgeBase } from '@/components/projects/knowledge-base'
import { useProject } from '@/components/projects/project-provider'
import { useChat } from '@/components/chat/chat-provider'
import { Composer, type ComposerHandle, type ComposerPayload } from '@/components/chat/composer'
import type { Message } from '@/types/chat'

function makeId() {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID()
  return Math.random().toString(36).slice(2)
}

type Tab = 'percakapan' | 'knowledge'

function ConversationList({ projectId }: { projectId: string }) {
  const { conversations } = useChat()
  const projectConvs = conversations.filter((c) => c.projectId === projectId)

  if (projectConvs.length === 0) {
    return (
      <div className="flex flex-col items-center gap-2 py-16 text-center text-muted-foreground">
        <IconMessageCircle className="size-8" />
        <p className="text-sm">Belum ada percakapan.</p>
        <p className="text-xs">Mulai chat di atas untuk membuat percakapan pertama.</p>
      </div>
    )
  }

  return (
    <ul className="flex flex-col divide-y divide-border">
      {projectConvs.map((c) => (
        <li key={c.id}>
          <Link
            href={`/projects/${projectId}/c/${c.id}`}
            className="flex items-center gap-3 px-1 py-3 text-sm hover:bg-sidebar-accent/50 rounded-lg transition-colors"
          >
            <IconMessageCircle className="size-4 shrink-0 text-muted-foreground" />
            <span className="flex-1 truncate">
              {c.isGeneratingTitle ? (
                <span className="block h-3 w-40 animate-pulse rounded bg-muted" />
              ) : (
                c.title
              )}
            </span>
            <span className="shrink-0 text-xs text-muted-foreground">
              {new Date(c.updatedAt).toLocaleDateString('id-ID', { day: 'numeric', month: 'short' })}
            </span>
          </Link>
        </li>
      ))}
    </ul>
  )
}

export function ProjectHomeView({ projectId }: { projectId: string }) {
  const { project } = useProject()
  const { createConversation, streamAssistantReply, webSearchEnabled } = useChat()
  const router = useRouter()
  const composerRef = useRef<ComposerHandle>(null)
  const [activeTab, setActiveTab] = useState<Tab>('percakapan')

  const handleSend = async ({ text, attachments, webSearch }: ComposerPayload) => {
    const userMessage: Message = {
      id: makeId(),
      role: 'user',
      content: text,
      parentId: null,
      attachments: attachments.length > 0 ? attachments : undefined,
      createdAt: new Date().toISOString(),
    }
    try {
      const convId = await createConversation(userMessage, { projectId })
      streamAssistantReply(convId, [userMessage], { webSearch, projectId })
      router.push(`/projects/${projectId}/c/${convId}`)
    } catch {
      // ignore
    }
  }

  const tabs: { key: Tab; label: string; icon: React.ReactNode }[] = [
    { key: 'percakapan', label: 'Percakapan', icon: <IconMessageCircle className="size-4" /> },
    { key: 'knowledge', label: 'Knowledge', icon: <IconBook className="size-4" /> },
  ]

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="flex items-center gap-3 border-b border-border px-6 py-4">
        <div className="flex size-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
          <IconFolder className="size-4" />
        </div>
        <div>
          <h1 className="text-base font-semibold leading-tight">{project?.name ?? '…'}</h1>
          {project?.description && (
            <p className="text-xs text-muted-foreground">{project.description}</p>
          )}
        </div>
      </div>

      {/* Composer */}
      <div className="border-b border-border py-3">
        <Composer
          ref={composerRef}
          onSend={handleSend}
          placeholder="Tanya sesuatu tentang project ini…"
          documentUploadDisabled
          autoFocus
        />
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-border px-6 pt-2">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`flex items-center gap-1.5 border-b-2 px-3 py-2 text-sm font-medium transition-colors ${
              activeTab === tab.key
                ? 'border-primary text-foreground'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            {tab.icon}
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div className="flex-1 overflow-y-auto px-6 py-4">
        {activeTab === 'percakapan' && <ConversationList projectId={projectId} />}
        {activeTab === 'knowledge' && <KnowledgeBase />}
      </div>
    </div>
  )
}
