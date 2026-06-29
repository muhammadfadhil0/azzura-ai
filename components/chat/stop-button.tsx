'use client'

import { IconSquare } from '@tabler/icons-react'
import { Button } from '@/components/ui/button'

interface Props {
  onClick: () => void
}

export function StopButton({ onClick }: Props) {
  return (
    <Button
      type="button"
      size="icon"
      aria-label="Stop generating"
      onClick={onClick}
      className="size-8 rounded-full"
    >
      <IconSquare className="size-3.5 fill-current" />
    </Button>
  )
}
