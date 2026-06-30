'use client'

import { useState } from 'react'
import { IconLogout, IconSettings } from '@tabler/icons-react'
import { useRouter } from 'next/navigation'
import { SettingsModal } from '@/components/settings'
import { ThemeToggle } from '@/components/theme-toggle'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { useUser } from '@/hooks/use-user'
import { useOnboarding } from '@/hooks/use-onboarding'
import { createClient } from '@/lib/supabase/client'
import { cn } from '@/lib/utils'

function initials(value: string) {
  return value
    .split(/[\s@.]+/)
    .map((p) => p[0])
    .filter(Boolean)
    .slice(0, 2)
    .join('')
    .toUpperCase()
}

export function SidebarFooter({ collapsed }: { collapsed: boolean }) {
  const { user, avatarUrl } = useUser()
  const { profile } = useOnboarding()
  const router = useRouter()
  const displayName = profile?.nickname || user?.email || ''
  const label = displayName || 'Loading…'
  const [settingsOpen, setSettingsOpen] = useState(false)

  const handleSignOut = async () => {
    await createClient().auth.signOut()
    router.replace('/login')
    router.refresh()
  }

  return (
    <div
      className={cn(
        'flex items-center border-t border-sidebar-border p-2',
        collapsed ? 'justify-center' : 'justify-between gap-2',
      )}
    >
      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <button
              type="button"
              aria-label="Open user menu"
              className={cn(
                'flex items-center gap-2 rounded-lg text-left text-sm transition-colors hover:bg-sidebar-accent/60 aria-expanded:bg-sidebar-accent',
                collapsed ? 'p-1' : 'flex-1 p-1.5',
              )}
            >
              <Avatar className="size-7 shrink-0">
                {avatarUrl && <AvatarImage src={avatarUrl} />}
                <AvatarFallback className="text-xs font-medium">
                  {displayName ? initials(displayName) : '?'}
                </AvatarFallback>
              </Avatar>
              {!collapsed ? (
                <span className="flex-1 truncate text-sm">{label}</span>
              ) : null}
            </button>
          }
        />
        <DropdownMenuContent align="end" side="top" className="w-64">
          <div className="flex items-center gap-3 px-2 py-2.5">
            <Avatar className="size-9 shrink-0">
              {avatarUrl && <AvatarImage src={avatarUrl} />}
              <AvatarFallback className="text-sm font-semibold">
                {displayName ? initials(displayName) : '?'}
              </AvatarFallback>
            </Avatar>
            <div className="flex min-w-0 flex-col gap-0.5">
              <span className="truncate text-xs font-medium text-foreground">
                {label}
              </span>
              <span className="text-[11px] text-muted-foreground">Free plan</span>
            </div>
          </div>
          <DropdownMenuSeparator />
          <DropdownMenuItem className="gap-2" onClick={() => setSettingsOpen(true)}>
            <IconSettings className="size-4" /> Settings
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            variant="destructive"
            className="gap-2"
            onClick={handleSignOut}
          >
            <IconLogout className="size-4" /> Log out
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      {!collapsed ? <ThemeToggle /> : null}
      <SettingsModal open={settingsOpen} onOpenChange={setSettingsOpen} />
    </div>
  )
}
