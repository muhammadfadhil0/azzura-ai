'use client'

import { useState } from 'react'
import { Tabs as TabsPrimitive } from '@base-ui/react/tabs'
import {
  IconAlertTriangle,
  IconCheck,
  IconMessage,
  IconDeviceDesktop,
  IconMoon,
  IconPalette,
  IconPencil,
  IconShield,
  IconSun,
  IconUser,
} from '@tabler/icons-react'
import { useTheme } from 'next-themes'
import { useChat } from '@/components/chat/chat-provider'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from '@/components/ui/dialog'
import { Separator } from '@/components/ui/separator'
import { useLocalStorage } from '@/hooks/use-local-storage'
import { useUser } from '@/hooks/use-user'
import { AvatarPickerDialog } from '@/components/settings/avatar-picker-dialog'
import { DEFAULT_MODEL_ID, MODEL_GROUPS, findModel } from '@/lib/ai/models'
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

function SectionHeader({ title, description }: { title: string; description?: string }) {
  return (
    <div className="mb-6">
      <h2 className="text-sm font-semibold text-foreground">{title}</h2>
      {description && (
        <p className="mt-0.5 text-xs text-muted-foreground">{description}</p>
      )}
      <Separator className="mt-3" />
    </div>
  )
}

function SettingRow({
  label,
  description,
  children,
}: {
  label: string
  description?: string
  children: React.ReactNode
}) {
  return (
    <div className="flex items-start justify-between gap-6 py-3">
      <div className="flex flex-col gap-0.5 min-w-0">
        <span className="text-sm font-medium text-foreground">{label}</span>
        {description && (
          <span className="text-xs text-muted-foreground leading-relaxed">{description}</span>
        )}
      </div>
      <div className="shrink-0">{children}</div>
    </div>
  )
}

function ProfilePanel() {
  const { user, avatarUrl: initialAvatarUrl } = useUser()
  const email = user?.email ?? ''
  const [pickerOpen, setPickerOpen] = useState(false)
  const [avatarUrl, setAvatarUrl] = useState<string | null>(initialAvatarUrl)

  return (
    <div className="flex flex-col">
      <SectionHeader title="Profile" description="Your account information" />

      {/* Avatar + identity block */}
      <div className="flex items-center gap-4 rounded-xl border border-border bg-muted/30 p-4">
        <div className="relative group/avatar shrink-0">
          <Avatar className="size-14 ring-2 ring-border ring-offset-2 ring-offset-background">
            {avatarUrl && <AvatarImage src={avatarUrl} />}
            <AvatarFallback className="text-lg font-bold bg-primary text-primary-foreground">
              {email ? initials(email) : '?'}
            </AvatarFallback>
          </Avatar>
          <button
            type="button"
            onClick={() => setPickerOpen(true)}
            aria-label="Ganti foto profil"
            className="absolute inset-0 flex items-center justify-center rounded-full bg-black/40 opacity-0 transition-opacity group-hover/avatar:opacity-100"
          >
            <IconPencil className="size-5 text-white" />
          </button>
        </div>
        <div className="flex flex-col gap-1.5 min-w-0">
          <span className="text-sm font-semibold truncate text-foreground">
            {email || 'Loading…'}
          </span>
          <span className="inline-flex w-fit items-center gap-1 rounded-full border border-primary/20 bg-primary/8 px-2 py-0.5 text-[11px] font-medium text-primary">
            Free plan
          </span>
        </div>
      </div>

      {user && (
        <AvatarPickerDialog
          open={pickerOpen}
          onOpenChange={setPickerOpen}
          userId={user.id}
          onSaved={(url) => setAvatarUrl(url)}
        />
      )}

      {/* Account details */}
      <div className="flex flex-col gap-2 mt-5">
        <div className="flex items-center justify-between py-1">
          <span className="text-xs text-muted-foreground">Email</span>
          <span className="text-xs font-medium text-foreground truncate max-w-[200px]">
            {email || '—'}
          </span>
        </div>
        <div className="flex items-center justify-between py-1">
          <span className="text-xs text-muted-foreground">Plan</span>
          <span className="text-xs font-medium text-foreground">Free</span>
        </div>
        <div className="flex items-center justify-between py-1">
          <span className="text-xs text-muted-foreground">Storage</span>
          <span className="text-xs font-medium text-foreground">5 MB limit</span>
        </div>
      </div>
    </div>
  )
}

function AppearancePanel() {
  const { theme, setTheme } = useTheme()

  const options = [
    {
      value: 'light',
      label: 'Light',
      icon: IconSun,
      preview: (
        <div className="h-16 w-full rounded-md border border-border bg-white overflow-hidden">
          <div className="h-3 w-full bg-neutral-100 border-b border-neutral-200" />
          <div className="flex gap-1 p-1.5">
            <div className="h-2 w-10 rounded-sm bg-neutral-200" />
            <div className="h-2 w-6 rounded-sm bg-neutral-200" />
          </div>
          <div className="mx-1.5 h-1.5 rounded-sm bg-neutral-200" />
        </div>
      ),
    },
    {
      value: 'dark',
      label: 'Dark',
      icon: IconMoon,
      preview: (
        <div className="h-16 w-full rounded-md border border-border bg-[#212121] overflow-hidden">
          <div className="h-3 w-full bg-[#171717] border-b border-[#2a2a2a]" />
          <div className="flex gap-1 p-1.5">
            <div className="h-2 w-10 rounded-sm bg-[#2f2f2f]" />
            <div className="h-2 w-6 rounded-sm bg-[#2f2f2f]" />
          </div>
          <div className="mx-1.5 h-1.5 rounded-sm bg-[#2f2f2f]" />
        </div>
      ),
    },
    {
      value: 'system',
      label: 'System',
      icon: IconDeviceDesktop,
      preview: (
        <div className="h-16 w-full rounded-md border border-border overflow-hidden flex">
          <div className="w-1/2 bg-white flex flex-col">
            <div className="h-3 w-full bg-neutral-100 border-b border-neutral-200" />
            <div className="flex gap-1 p-1.5">
              <div className="h-2 w-5 rounded-sm bg-neutral-200" />
            </div>
          </div>
          <div className="w-1/2 bg-[#212121] flex flex-col">
            <div className="h-3 w-full bg-[#171717] border-b border-[#2a2a2a]" />
            <div className="flex gap-1 p-1.5">
              <div className="h-2 w-5 rounded-sm bg-[#2f2f2f]" />
            </div>
          </div>
        </div>
      ),
    },
  ]

  return (
    <div className="flex flex-col">
      <SectionHeader title="Appearance" description="Customize how the interface looks" />

      <div className="flex flex-col gap-2">
        <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Theme</span>
        <div className="grid grid-cols-3 gap-2.5 mt-1">
          {options.map(({ value, label, icon: Icon, preview }) => {
            const active = theme === value
            return (
              <button
                key={value}
                type="button"
                onClick={() => setTheme(value)}
                className={cn(
                  'relative flex flex-col gap-2 rounded-xl border-2 p-2.5 text-sm transition-all outline-none',
                  'focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2',
                  active
                    ? 'border-primary bg-primary/5'
                    : 'border-border bg-muted/20 hover:border-border/80 hover:bg-muted/40',
                )}
              >
                {preview}
                <div className="flex items-center justify-between px-0.5">
                  <div className="flex items-center gap-1.5">
                    <Icon className="size-3.5 text-muted-foreground" />
                    <span className={cn('text-xs font-medium', active ? 'text-foreground' : 'text-muted-foreground')}>
                      {label}
                    </span>
                  </div>
                  {active && (
                    <span className="flex items-center justify-center size-4 rounded-full bg-primary">
                      <IconCheck className="size-2.5 text-primary-foreground" stroke={3} />
                    </span>
                  )}
                </div>
              </button>
            )
          })}
        </div>
      </div>
    </div>
  )
}

function ChatDefaultsPanel() {
  const [defaultModelId, setDefaultModelId] = useLocalStorage(
    'settings:defaultModelId',
    DEFAULT_MODEL_ID,
  )
  const { setSelectedModelId } = useChat()
  const currentModel = findModel(defaultModelId)

  function handleChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const id = e.target.value
    setDefaultModelId(id)
    setSelectedModelId(id)
  }

  return (
    <div className="flex flex-col">
      <SectionHeader title="Chat Defaults" description="Settings applied to every new conversation" />

      <div className="flex flex-col gap-3">
        <div className="flex flex-col gap-3">
          <div className="flex items-start justify-between gap-4">
            <div className="flex flex-col gap-0.5">
              <span className="text-sm font-medium text-foreground">Default model</span>
              <span className="text-xs text-muted-foreground">
                Pre-selected when you start a new conversation
              </span>
            </div>
          </div>
          <select
            value={defaultModelId}
            onChange={handleChange}
            className={cn(
              'w-full rounded-lg border border-input bg-background px-3 py-2 text-sm',
              'outline-none transition-colors',
              'focus:border-primary focus:ring-2 focus:ring-primary/20',
              'hover:border-foreground/20',
            )}
          >
            {MODEL_GROUPS.map((group) => (
              <optgroup key={group.tier} label={group.label}>
                {group.models.map((model) => (
                  <option key={model.id} value={model.id}>
                    {model.label}
                  </option>
                ))}
              </optgroup>
            ))}
          </select>
        </div>
      </div>
    </div>
  )
}

function DataPrivacyPanel() {
  const { conversations, deleteConversation } = useChat()
  const [confirming, setConfirming] = useState(false)
  const [clearing, setClearing] = useState(false)

  async function handleClearAll() {
    setClearing(true)
    await Promise.all(conversations.map((c) => deleteConversation(c.id)))
    setClearing(false)
    setConfirming(false)
  }

  return (
    <div className="flex flex-col">
      <SectionHeader title="Data & Privacy" description="Manage your data and storage" />

      {/* Stats row */}
      <div className="grid grid-cols-2 gap-2 mb-5">
        <div className="flex flex-col gap-0.5 rounded-xl border border-border bg-muted/20 px-4 py-3">
          <span className="text-lg font-semibold text-foreground tabular-nums">
            {conversations.length}
          </span>
          <span className="text-xs text-muted-foreground">Conversations</span>
        </div>
        <div className="flex flex-col gap-0.5 rounded-xl border border-border bg-muted/20 px-4 py-3">
          <span className="text-lg font-semibold text-foreground tabular-nums">
            {conversations.reduce((acc, c) => acc + c.allMessages.length, 0)}
          </span>
          <span className="text-xs text-muted-foreground">Total messages</span>
        </div>
      </div>

      {/* Danger zone */}
      <div className={cn(
        'rounded-xl border overflow-hidden transition-colors',
        confirming ? 'border-destructive/40 bg-destructive/5' : 'border-border',
      )}>
        <div className="px-4 py-3 border-b border-inherit">
          <span className="text-xs font-semibold uppercase tracking-wider text-destructive">
            Danger zone
          </span>
        </div>
        <div className="px-4 py-4 flex flex-col gap-3">
          {confirming ? (
            <>
              <div className="flex items-start gap-2.5">
                <div className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-full bg-destructive/15">
                  <IconAlertTriangle className="size-3.5 text-destructive" />
                </div>
                <div className="flex flex-col gap-0.5">
                  <span className="text-sm font-medium text-foreground">
                    Delete all {conversations.length} conversation{conversations.length !== 1 ? 's' : ''}?
                  </span>
                  <span className="text-xs text-muted-foreground">
                    This is permanent and cannot be undone.
                  </span>
                </div>
              </div>
              <div className="flex justify-end gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setConfirming(false)}
                  disabled={clearing}
                >
                  Cancel
                </Button>
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={handleClearAll}
                  disabled={clearing}
                >
                  {clearing ? 'Deleting…' : 'Delete all'}
                </Button>
              </div>
            </>
          ) : (
            <div className="flex items-center justify-between gap-4">
              <div className="flex flex-col gap-0.5">
                <span className="text-sm font-medium text-foreground">Clear all conversations</span>
                <span className="text-xs text-muted-foreground">
                  Permanently remove all your chat history
                </span>
              </div>
              <Button
                variant="outline"
                size="sm"
                className="shrink-0 border-destructive/30 text-destructive hover:bg-destructive/10 hover:text-destructive hover:border-destructive/50"
                onClick={() => setConfirming(true)}
                disabled={conversations.length === 0}
              >
                Clear all
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

const TABS = [
  { value: 'profile', label: 'Profile', icon: IconUser },
  { value: 'appearance', label: 'Appearance', icon: IconPalette },
  { value: 'chat', label: 'Chat Defaults', icon: IconMessage },
  { value: 'data', label: 'Data & Privacy', icon: IconShield },
]

interface SettingsModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function SettingsModal({ open, onOpenChange }: SettingsModalProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent showCloseButton className="gap-0 p-0 sm:max-w-[680px] overflow-hidden">
        <DialogTitle className="sr-only">Settings</DialogTitle>
        <TabsPrimitive.Root
          defaultValue="profile"
          orientation="vertical"
          className="flex h-[560px]"
        >
          {/* Left nav rail */}
          <TabsPrimitive.List className="flex w-48 shrink-0 flex-col gap-0.5 bg-sidebar border-r border-sidebar-border p-3">
            <p className="px-2.5 pb-3 pt-1 text-[10px] font-bold uppercase tracking-widest text-muted-foreground/60">
              Settings
            </p>
            {TABS.map(({ value, label, icon: Icon }) => (
              <TabsPrimitive.Tab
                key={value}
                value={value}
                className={cn(
                  'flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm transition-all outline-none',
                  'text-left text-sidebar-foreground/70 font-normal',
                  'hover:bg-sidebar-accent/70 hover:text-sidebar-foreground',
                  'data-[active]:bg-sidebar-accent data-[active]:text-sidebar-foreground data-[active]:font-medium data-[active]:shadow-sm',
                  'focus-visible:ring-2 focus-visible:ring-sidebar-ring',
                )}
              >
                <Icon className="size-4 shrink-0 opacity-70 data-[active]:opacity-100" />
                {label}
              </TabsPrimitive.Tab>
            ))}
          </TabsPrimitive.List>

          {/* Right content area */}
          <div className="flex flex-1 flex-col overflow-hidden bg-popover">
            {[
              { value: 'profile', Panel: ProfilePanel },
              { value: 'appearance', Panel: AppearancePanel },
              { value: 'chat', Panel: ChatDefaultsPanel },
              { value: 'data', Panel: DataPrivacyPanel },
            ].map(({ value, Panel }) => (
              <TabsPrimitive.Panel
                key={value}
                value={value}
                className="flex-1 overflow-y-auto p-6 outline-none"
              >
                <Panel />
              </TabsPrimitive.Panel>
            ))}
          </div>
        </TabsPrimitive.Root>
      </DialogContent>
    </Dialog>
  )
}
