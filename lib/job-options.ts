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

import type { ComponentType, SVGProps } from 'react'

export interface JobOption {
  value: string
  label: string
  icon: ComponentType<SVGProps<SVGSVGElement>>
  color: string
}

export const JOB_OPTIONS: JobOption[] = [
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
