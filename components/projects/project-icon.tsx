import {
  IconFolder, IconCode, IconDatabase, IconBrain, IconRocket, IconTarget,
  IconFlask, IconPalette, IconChartBar, IconGlobe, IconLock, IconBook,
  IconBug, IconCamera, IconMusic, IconRobot, IconShield, IconBriefcase,
} from '@tabler/icons-react'

export const PROJECT_ICONS = {
  IconFolder,
  IconCode,
  IconDatabase,
  IconBrain,
  IconRocket,
  IconTarget,
  IconFlask,
  IconPalette,
  IconChartBar,
  IconGlobe,
  IconLock,
  IconBook,
  IconBug,
  IconCamera,
  IconMusic,
  IconRobot,
  IconShield,
  IconBriefcase,
} as const

export type ProjectIconName = keyof typeof PROJECT_ICONS

export const DEFAULT_PROJECT_ICON: ProjectIconName = 'IconFolder'

export function ProjectIcon({
  name,
  className,
}: {
  name: string | null | undefined
  className?: string
}) {
  const Icon =
    name && name in PROJECT_ICONS
      ? PROJECT_ICONS[name as ProjectIconName]
      : PROJECT_ICONS.IconFolder
  return <Icon className={className} />
}
