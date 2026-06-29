'use client'

import { IconDots, IconPencil, IconTrash } from '@tabler/icons-react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Input } from '@/components/ui/input'
import { useChat } from '@/components/chat/chat-provider'
import { useSidebar } from '@/hooks/use-sidebar'
import { cn } from '@/lib/utils'
import type { Conversation } from '@/types/chat'

export function ConversationItem({ conversation }: { conversation: Conversation }) {
  const pathname = usePathname()
  const router = useRouter()
  const { renameConversation, deleteConversation } = useChat()
  const { setMobileOpen } = useSidebar()
  const active = pathname === `/c/${conversation.id}`

  const [renameOpen, setRenameOpen] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [renameValue, setRenameValue] = useState(conversation.title)

  const handleRenameSubmit = () => {
    if (renameValue.trim()) renameConversation(conversation.id, renameValue.trim())
    setRenameOpen(false)
  }

  const handleDeleteConfirm = () => {
    deleteConversation(conversation.id)
    if (active) router.push('/')
    setDeleteOpen(false)
  }

  return (
    <>
      <div
        className={cn(
          'group/item relative flex items-center rounded-lg text-sm',
          active
            ? 'bg-sidebar-accent text-sidebar-accent-foreground'
            : 'hover:bg-sidebar-accent/60',
        )}
      >
        <Link
          href={`/c/${conversation.id}`}
          onClick={() => setMobileOpen(false)}
          className="flex-1 truncate px-2.5 py-2 pr-8"
          title={conversation.isGeneratingTitle ? undefined : conversation.title}
        >
          {conversation.isGeneratingTitle ? (
            <span className="block h-3 w-28 animate-pulse rounded bg-sidebar-foreground/15" />
          ) : (
            conversation.title
          )}
        </Link>
        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label="Conversation actions"
                className={cn(
                  'absolute right-1 top-1/2 -translate-y-1/2 opacity-0 transition-opacity group-hover/item:opacity-100 aria-expanded:opacity-100',
                )}
              >
                <IconDots className="size-4" />
              </Button>
            }
          />
          <DropdownMenuContent align="end">
            <DropdownMenuItem
              onClick={() => {
                setRenameValue(conversation.title)
                setRenameOpen(true)
              }}
              className="gap-2"
            >
              <IconPencil className="size-4" /> Rename
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => setDeleteOpen(true)}
              className="gap-2 text-destructive focus:text-destructive"
            >
              <IconTrash className="size-4" /> Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <Dialog open={renameOpen} onOpenChange={setRenameOpen}>
        <DialogContent showCloseButton={false}>
          <DialogHeader>
            <DialogTitle>Rename conversation</DialogTitle>
          </DialogHeader>
          <Input
            value={renameValue}
            onChange={(e) => setRenameValue(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleRenameSubmit()}
            autoFocus
          />
          <DialogFooter showCloseButton>
            <Button onClick={handleRenameSubmit} disabled={!renameValue.trim()}>
              Rename
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent showCloseButton={false}>
          <DialogHeader>
            <DialogTitle>Delete conversation</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete &ldquo;{conversation.title}&rdquo;? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter showCloseButton>
            <Button variant="destructive" onClick={handleDeleteConfirm}>
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
