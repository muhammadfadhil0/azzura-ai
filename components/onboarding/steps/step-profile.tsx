'use client'

import { useState } from 'react'
import {
  IconBriefcase,
  IconBrush,
  IconChartBar,
  IconCode,
  IconSpeakerphone,
  IconPencil,
  IconRocket,
  IconSchool,
  IconShoppingCart,
  IconStack,
} from '@tabler/icons-react'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { cn } from '@/lib/utils'

const JOB_OPTIONS = [
  { value: 'Software Engineer', label: 'Software Engineer', icon: IconCode,         color: 'bg-blue-50 text-blue-600 dark:bg-blue-950/40 dark:text-blue-400' },
  { value: 'Designer',          label: 'Designer',          icon: IconBrush,        color: 'bg-purple-50 text-purple-600 dark:bg-purple-950/40 dark:text-purple-400' },
  { value: 'Product Manager',   label: 'Product Manager',   icon: IconStack,        color: 'bg-amber-50 text-amber-600 dark:bg-amber-950/40 dark:text-amber-400' },
  { value: 'Data Scientist',    label: 'Data Scientist',    icon: IconChartBar,     color: 'bg-emerald-50 text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-400' },
  { value: 'Marketing',         label: 'Marketing',         icon: IconSpeakerphone, color: 'bg-rose-50 text-rose-600 dark:bg-rose-950/40 dark:text-rose-400' },
  { value: 'Sales',             label: 'Sales',             icon: IconShoppingCart, color: 'bg-orange-50 text-orange-600 dark:bg-orange-950/40 dark:text-orange-400' },
  { value: 'Content Creator',   label: 'Content Creator',   icon: IconPencil,       color: 'bg-pink-50 text-pink-600 dark:bg-pink-950/40 dark:text-pink-400' },
  { value: 'Student',           label: 'Pelajar/Mahasiswa', icon: IconSchool,       color: 'bg-cyan-50 text-cyan-600 dark:bg-cyan-950/40 dark:text-cyan-400' },
  { value: 'Entrepreneur',      label: 'Entrepreneur',      icon: IconRocket,       color: 'bg-violet-50 text-violet-600 dark:bg-violet-950/40 dark:text-violet-400' },
  { value: 'Other',             label: 'Lainnya',           icon: IconBriefcase,    color: 'bg-muted text-muted-foreground' },
]

interface Props {
  nickname: string
  avatarUrl: string | null
  job: string | null
  bio: string | null
  onJobChange: (job: string | null) => void
  onBioChange: (bio: string | null) => void
}

export function StepProfile({ nickname, avatarUrl, job, bio, onJobChange, onBioChange }: Props) {
  const isCustom = job !== null && !JOB_OPTIONS.some((o) => o.value === job && o.value !== 'Other')
  const [showCustomInput, setShowCustomInput] = useState(isCustom)

  const handleSelect = (value: string) => {
    if (value === 'Other') {
      setShowCustomInput(true)
      onJobChange('')
    } else {
      setShowCustomInput(false)
      onJobChange(value)
    }
  }

  const selectedPreset = JOB_OPTIONS.find((o) => o.value === job)?.value ?? (showCustomInput ? 'Other' : null)

  return (
    <div className="flex flex-col gap-5">
      {/* Profile preview card */}
      <div className="flex items-center gap-3 rounded-xl border border-border bg-muted/40 px-4 py-3">
        <div className="size-10 shrink-0 rounded-full overflow-hidden border border-border bg-muted">
          {avatarUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={avatarUrl} alt={nickname} className="size-full object-cover" />
          ) : (
            <div className="size-full flex items-center justify-center text-sm font-medium text-muted-foreground">
              {nickname.charAt(0).toUpperCase()}
            </div>
          )}
        </div>
        <div className="flex flex-col">
          <span className="text-sm font-medium leading-tight">{nickname}</span>
          <span className="text-xs text-muted-foreground">
            {job || 'Belum ada pekerjaan'}
          </span>
        </div>
      </div>

      {/* Job picker */}
      <div className="flex flex-col gap-2.5">
        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Bidang pekerjaan</p>
        <div className="grid grid-cols-2 gap-2">
          {JOB_OPTIONS.map(({ value, label, icon: Icon, color }) => {
            const active = selectedPreset === value
            return (
              <button
                key={value}
                type="button"
                onClick={() => handleSelect(value)}
                className={cn(
                  'relative flex items-center gap-3 rounded-xl border px-3 py-2.5 text-left transition-all',
                  active
                    ? 'border-primary bg-primary/5 shadow-sm ring-1 ring-primary/20'
                    : 'border-border hover:bg-muted/40',
                )}
              >
                <span className={cn('flex size-7 shrink-0 items-center justify-center rounded-lg', color)}>
                  <Icon className="size-3.5" />
                </span>
                <span className={cn('truncate text-sm', active ? 'font-medium text-foreground' : 'text-muted-foreground')}>
                  {label}
                </span>
                {active && (
                  <div className="absolute top-1.5 right-1.5 size-2 rounded-full bg-primary" />
                )}
              </button>
            )
          })}
        </div>

        {showCustomInput && (
          <Input
            autoFocus
            placeholder="Tuliskan bidang pekerjaanmu…"
            value={job ?? ''}
            onChange={(e) => onJobChange(e.target.value || null)}
          />
        )}
      </div>

      {/* Bio */}
      <div className="flex flex-col gap-2">
        <div className="flex items-baseline justify-between">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Tentang kamu <span className="normal-case font-normal">(opsional)</span>
          </p>
          <span className="text-xs text-muted-foreground">{(bio ?? '').length}/300</span>
        </div>
        <Textarea
          placeholder="Ceritakan minat, tujuan, atau hal yang ingin kamu capai…"
          value={bio ?? ''}
          onChange={(e) => onBioChange(e.target.value || null)}
          rows={3}
          maxLength={300}
          className="resize-none"
        />
      </div>
    </div>
  )
}
