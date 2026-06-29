'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { usePathname } from 'next/navigation'
import { IconArrowLeft, IconEdit, IconFolder } from '@tabler/icons-react'
import { useChat } from '@/components/chat/chat-provider'
import { useProject } from '@/components/projects/project-provider'
import { cn } from '@/lib/utils'

export function ProjectSidebar({ projectId }: { projectId: string }) {
  const { project } = useProject()
  const { conversations, createEmptyConversation } = useChat()
  const router = useRouter()
  const pathname = usePathname()

  const projectConversations = conversations.filter((c) => c.projectId === projectId)

  const handleNewChat = async () => {
    try {
      const id = await createEmptyConversation({ projectId })
      router.push(`/projects/${projectId}/c/${id}`)
    } catch {
      // ignore
    }
  }

  return (
    <div className="flex h-full w-[220px] shrink-0 flex-col border-r border-sidebar-border bg-sidebar text-sidebar-foreground">
      <div className="flex items-center gap-2 border-b border-sidebar-border px-3 py-3">
        <Link
          href="/projects"
          className="rounded p-1 text-muted-foreground hover:bg-sidebar-accent/60 transition-colors"
          aria-label="Back to projects"
        >
          <IconArrowLeft className="size-4" />
        </Link>
        <div className="flex min-w-0 flex-1 items-center gap-1.5">
          <IconFolder className="size-4 shrink-0 text-muted-foreground" />
          <span className="truncate text-sm font-medium">{project?.name ?? '…'}</span>
        </div>
      </div>

      <div className="px-2 py-2">
        <button
          onClick={handleNewChat}
          className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-sm hover:bg-sidebar-accent/60 transition-colors"
        >
          <IconEdit className="size-4 shrink-0" />
          New chat
        </button>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-2 py-1">
        {projectConversations.length === 0 ? (
          <p className="px-2 py-4 text-center text-xs text-muted-foreground">No conversations yet</p>
        ) : (
          <ul className="flex flex-col gap-0.5">
            {projectConversations.map((c) => {
              const href = `/projects/${projectId}/c/${c.id}`
              const active = pathname === href
              return (
                <li key={c.id}>
                  <Link
                    href={href}
                    className={cn(
                      'block truncate rounded-lg px-2.5 py-2 text-sm transition-colors',
                      active
                        ? 'bg-sidebar-accent text-sidebar-accent-foreground'
                        : 'hover:bg-sidebar-accent/60',
                    )}
                    title={c.title}
                  >
                    {c.isGeneratingTitle ? (
                      <span className="block h-3 w-24 animate-pulse rounded bg-sidebar-foreground/15" />
                    ) : (
                      c.title
                    )}
                  </Link>
                </li>
              )
            })}
          </ul>
        )}
      </div>
    </div>
  )
}
