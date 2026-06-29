'use client'

import { IconSparkles } from '@tabler/icons-react'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { cn } from '@/lib/utils'

export function SidebarHeader({ collapsed }: { collapsed: boolean }) {
  return (
    <div
      className={cn(
        'flex items-center px-3 py-3',
        collapsed ? 'justify-center' : 'gap-2',
      )}
    >
      {collapsed ? (
        <Tooltip>
          <TooltipTrigger
            render={
              <span className="flex size-8 items-center justify-center rounded-lg">
                <IconSparkles className="size-4 text-primary" />
              </span>
            }
          />
          <TooltipContent side="right">Azzura</TooltipContent>
        </Tooltip>
      ) : (
        <div className="flex items-center gap-1.5 select-none px-1">
          <IconSparkles className="size-4 text-primary shrink-0" />
          <span
            className="text-[15px] font-bold tracking-tight text-sidebar-foreground"
            style={{ fontFamily: 'var(--font-brand)' }}
          >
            Azzura
          </span>
        </div>
      )}
    </div>
  )
}
