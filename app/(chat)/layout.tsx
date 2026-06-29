import { ChatProvider } from '@/components/chat/chat-provider'
import { DocumentViewerProvider } from '@/components/chat/document-viewer'
import { OnboardingModal } from '@/components/onboarding/onboarding-modal'
import { Sidebar } from '@/components/sidebar/sidebar'
import { SidebarProvider } from '@/hooks/use-sidebar'

export default function ChatLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <ChatProvider>
      <DocumentViewerProvider>
        <SidebarProvider>
          <div className="fixed inset-0 flex overflow-hidden bg-background text-foreground">
            <Sidebar />
            <main className="flex min-h-0 min-w-0 flex-1 flex-col">
              {children}
            </main>
          </div>
          <OnboardingModal />
        </SidebarProvider>
      </DocumentViewerProvider>
    </ChatProvider>
  )
}
