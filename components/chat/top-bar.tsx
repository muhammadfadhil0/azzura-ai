'use client'

import {
  IconCheck,
  IconChevronDown,
  IconMenu2,
  IconDots,
  IconLayoutSidebarLeftExpand,
  IconShare,
} from '@tabler/icons-react'
import { Fragment } from 'react'
import { useChat } from '@/components/chat/chat-provider'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { useSidebar } from '@/hooks/use-sidebar'
import { cn } from '@/lib/utils'
import { DEFAULT_MODEL_ID, findModel, MODEL_GROUPS } from '@/lib/ai/models'
import { ModelLogo } from '@/components/chat/model-logo'

export function TopBar() {
  const { selectedModelId, setSelectedModelId } = useChat()
  const { toggleCollapsed, setMobileOpen } = useSidebar()

  const current =
    findModel(selectedModelId) ?? findModel(DEFAULT_MODEL_ID)
  const currentLabel = current?.label ?? selectedModelId

  return (
    <header className="sticky top-0 z-10 flex h-14 items-center justify-between gap-2 border-b border-border/40 bg-background/80 px-3 backdrop-blur">
      <div className="flex items-center gap-1">
        <Button
          variant="ghost"
          size="icon"
          className="md:hidden"
          aria-label="Open sidebar"
          onClick={() => setMobileOpen(true)}
        >
          <IconMenu2 className="size-4" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="hidden md:inline-flex"
          aria-label="Toggle sidebar"
          onClick={toggleCollapsed}
        >
          <IconLayoutSidebarLeftExpand className="size-4" />
        </Button>
        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <Button variant="ghost" className="gap-1.5 px-2 font-semibold">
                {currentLabel}
                <IconChevronDown className="size-3.5 text-muted-foreground" />
              </Button>
            }
          />
          <DropdownMenuContent
            align="start"
            className="max-h-[70vh] w-64 overflow-y-auto"
          >
            {MODEL_GROUPS.map((group, idx) => (
              <Fragment key={group.tier}>
                {idx > 0 ? <DropdownMenuSeparator /> : null}
                <DropdownMenuGroup>
                  <DropdownMenuLabel className="flex items-center gap-1.5 py-1.5 text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">
                    {group.label}
                  </DropdownMenuLabel>
                  {group.models.map((m) => (
                    <DropdownMenuItem
                      key={m.id}
                      onClick={() => setSelectedModelId(m.id)}
                      className={cn(
                        'flex items-center gap-2 py-1.5',
                        selectedModelId === m.id &&
                          'bg-accent text-accent-foreground',
                      )}
                    >
                      <ModelLogo provider={m.provider} />
                      <span className="flex-1 text-sm">{m.label}</span>
                      {selectedModelId === m.id ? (
                        <IconCheck className="size-3.5 shrink-0" />
                      ) : null}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuGroup>
              </Fragment>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
      <div className="flex items-center gap-1">
        <Tooltip>
          <TooltipTrigger
            render={
              <Button variant="ghost" size="icon" aria-label="Share">
                <IconShare className="size-4" />
              </Button>
            }
          />
          <TooltipContent>Share</TooltipContent>
        </Tooltip>
        <Button variant="ghost" size="icon" aria-label="More options">
          <IconDots className="size-4" />
        </Button>
      </div>
    </header>
  )
}
