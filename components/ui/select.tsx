'use client'

import * as React from 'react'
import { Select as SelectPrimitive } from '@base-ui/react/select'
import { IconCheck, IconChevronDown, IconChevronUp } from '@tabler/icons-react'
import { cn } from '@/lib/utils'

const Select = SelectPrimitive.Root

const SelectGroup = SelectPrimitive.Group

const SelectValue = SelectPrimitive.Value

const SelectTrigger = React.forwardRef<
  React.ElementRef<typeof SelectPrimitive.Trigger>,
  React.ComponentPropsWithoutRef<typeof SelectPrimitive.Trigger>
>(({ className, children, ...props }, ref) => (
  <SelectPrimitive.Trigger
    ref={ref}
    className={cn(
      'flex h-9 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm outline-none transition-colors',
      'placeholder:text-muted-foreground focus:ring-2 focus:ring-primary/20 focus:border-primary',
      'disabled:cursor-not-allowed disabled:opacity-50',
      className,
    )}
    {...props}
  >
    {children}
    <SelectPrimitive.Icon>
      <IconChevronDown className="size-4 opacity-50" />
    </SelectPrimitive.Icon>
  </SelectPrimitive.Trigger>
))
SelectTrigger.displayName = SelectPrimitive.Trigger.displayName

const SelectContent = React.forwardRef<
  React.ElementRef<typeof SelectPrimitive.Positioner>,
  React.ComponentPropsWithoutRef<typeof SelectPrimitive.Positioner>
>(({ className, children, ...props }, ref) => (
  <SelectPrimitive.Portal>
    <SelectPrimitive.Positioner
      ref={ref}
      className={cn('z-50', className)}
      {...props}
    >
      <SelectPrimitive.Popup className="relative max-h-96 min-w-[var(--anchor-width)] overflow-hidden rounded-md border bg-popover text-popover-foreground shadow-md">
        <SelectPrimitive.ScrollUpArrow className="flex cursor-default items-center justify-center py-1">
          <IconChevronUp className="size-4" />
        </SelectPrimitive.ScrollUpArrow>
        <SelectPrimitive.List className="p-1">{children}</SelectPrimitive.List>
        <SelectPrimitive.ScrollDownArrow className="flex cursor-default items-center justify-center py-1">
          <IconChevronDown className="size-4" />
        </SelectPrimitive.ScrollDownArrow>
      </SelectPrimitive.Popup>
    </SelectPrimitive.Positioner>
  </SelectPrimitive.Portal>
))
SelectContent.displayName = 'SelectContent'

const SelectGroupLabel = React.forwardRef<
  React.ElementRef<typeof SelectPrimitive.GroupLabel>,
  React.ComponentPropsWithoutRef<typeof SelectPrimitive.GroupLabel>
>(({ className, ...props }, ref) => (
  <SelectPrimitive.GroupLabel
    ref={ref}
    className={cn('py-1.5 pl-8 pr-2 text-xs font-semibold text-muted-foreground', className)}
    {...props}
  />
))
SelectGroupLabel.displayName = SelectPrimitive.GroupLabel.displayName

const SelectItem = React.forwardRef<
  React.ElementRef<typeof SelectPrimitive.Item>,
  React.ComponentPropsWithoutRef<typeof SelectPrimitive.Item>
>(({ className, children, ...props }, ref) => (
  <SelectPrimitive.Item
    ref={ref}
    className={cn(
      'relative flex w-full cursor-default select-none items-center rounded-sm py-1.5 pl-8 pr-2 text-sm outline-none',
      'data-[highlighted]:bg-accent data-[highlighted]:text-accent-foreground',
      'data-[disabled]:pointer-events-none data-[disabled]:opacity-50',
      className,
    )}
    {...props}
  >
    <span className="absolute left-2 flex size-3.5 items-center justify-center">
      <SelectPrimitive.ItemIndicator>
        <IconCheck className="size-4" />
      </SelectPrimitive.ItemIndicator>
    </span>
    <SelectPrimitive.ItemText>{children}</SelectPrimitive.ItemText>
  </SelectPrimitive.Item>
))
SelectItem.displayName = SelectPrimitive.Item.displayName

export {
  Select,
  SelectGroup,
  SelectValue,
  SelectTrigger,
  SelectContent,
  SelectGroupLabel,
  SelectItem,
}

export const SelectLabel = SelectGroupLabel
