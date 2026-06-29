'use client'

import { IconArrowUp } from '@tabler/icons-react'
import { Button } from '@/components/ui/button'

interface Props {
  disabled: boolean
}

export function SendButton({ disabled }: Props) {
  return (
    <Button
      type="submit"
      size="icon"
      aria-label="Send message"
      disabled={disabled}
      className="size-8 rounded-full"
    >
      <IconArrowUp className="size-4" />
    </Button>
  )
}
