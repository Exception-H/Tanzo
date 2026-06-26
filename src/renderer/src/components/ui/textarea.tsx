import * as React from 'react'

import { cn } from '@/lib/utils'

const textareaVariants = {
  default:
    'flex field-sizing-content min-h-16 w-full rounded-md border border-input bg-transparent px-2.5 py-2 text-base shadow-xs transition-[color,box-shadow] outline-none placeholder:text-muted-foreground focus-visible:ring-0 focus-visible:ring-offset-0 disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20 md:text-sm dark:bg-input/30 dark:aria-invalid:border-destructive/50 dark:aria-invalid:ring-destructive/40',
  bare: 'w-full min-w-0 resize-none border-0 bg-transparent p-0 text-base shadow-none transition-[color,box-shadow] outline-none placeholder:text-muted-foreground focus-visible:ring-0 focus-visible:ring-offset-0 disabled:cursor-not-allowed disabled:opacity-50 md:text-sm'
} as const

export type TextareaVariant = keyof typeof textareaVariants

type TextareaProps = React.ComponentProps<'textarea'> & {
  variant?: TextareaVariant
}

const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(function Textarea(
  { className, variant = 'default', ...props },
  ref
) {
  return (
    <textarea
      ref={ref}
      data-slot="textarea"
      className={cn(textareaVariants[variant], className)}
      {...props}
    />
  )
})

export { Textarea }
