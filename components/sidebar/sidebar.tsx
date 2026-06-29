'use client'

import { Sheet, SheetContent } from '@/components/ui/sheet'
import { SidebarHeader } from '@/components/sidebar/sidebar-header'
import { SidebarNewChat } from '@/components/sidebar/sidebar-new-chat'
import { SidebarSearch } from '@/components/sidebar/sidebar-search'
import { SidebarProjects } from '@/components/sidebar/sidebar-projects'
import { ConversationList } from '@/components/sidebar/conversation-list'
import { SidebarFooter } from '@/components/sidebar/sidebar-footer'
import { useSidebar } from '@/hooks/use-sidebar'
import { cn } from '@/lib/utils'

function SidebarInner({ collapsed }: { collapsed: boolean }) {
  return (
    <div className="flex h-full flex-col">
      <SidebarHeader collapsed={collapsed} />
      <SidebarNewChat collapsed={collapsed} />
      {!collapsed ? <SidebarSearch /> : null}
      {!collapsed ? <SidebarProjects /> : null}
      <div className="min-h-0 flex-1 overflow-y-auto">
        {!collapsed ? <ConversationList query="" /> : null}
      </div>
      <SidebarFooter collapsed={collapsed} />
    </div>
  )
}

export function Sidebar() {
  const { collapsed, mobileOpen, setMobileOpen } = useSidebar()

  return (
    <>
      <aside
        className={cn(
          'hidden shrink-0 flex-col border-r border-sidebar-border bg-sidebar text-sidebar-foreground transition-[width] duration-200 ease-in-out md:flex',
          collapsed ? 'w-[52px]' : 'w-[260px]',
        )}
      >
        <SidebarInner collapsed={collapsed} />
      </aside>
      <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
        <SheetContent
          side="left"
          showCloseButton={false}
          className="w-[280px] bg-sidebar p-0 text-sidebar-foreground"
        >
          <SidebarInner collapsed={false} />
        </SheetContent>
      </Sheet>
    </>
  )
}
