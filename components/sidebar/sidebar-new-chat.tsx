'use client'

import { IconEdit } from '@tabler/icons-react'
import Link from 'next/link'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { useSidebar } from '@/hooks/use-sidebar'
import { cn } from '@/lib/utils'

export function SidebarNewChat({ collapsed }: { collapsed: boolean }) {
  const { setMobileOpen } = useSidebar()

  if (collapsed) {
    return (
      <div className="flex justify-center px-1 pb-2">
        <Tooltip>
          <TooltipTrigger
            render={
              <Link
                href="/"
                onClick={() => setMobileOpen(false)}
                aria-label="New chat"
                className="flex size-8 items-center justify-center rounded-lg text-sidebar-foreground hover:bg-sidebar-accent/60 transition-colors"
              >
                <IconEdit className="size-4" />
              </Link>
            }
          />
          <TooltipContent side="right">New chat</TooltipContent>
        </Tooltip>
      </div>
    )
  }

  return (
    <div className="px-2">
      <Link
        href="/"
        onClick={() => setMobileOpen(false)}
        className={cn(
          'flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm text-sidebar-foreground',
          'hover:bg-sidebar-accent/60 transition-colors',
        )}
      >
        <IconEdit className="size-4 shrink-0" />
        <span>New chat</span>
      </Link>
    </div>
  )
}
