import { cn } from '@/lib/utils'

export interface ShimmerTextProps {
  text: string
  className?: string
}

export function ShimmerText({ text, className }: ShimmerTextProps): React.JSX.Element {
  return (
    <span
      className={cn(
        'bg-clip-text text-transparent',
        'bg-[linear-gradient(110deg,color-mix(in_oklab,var(--muted-foreground)_45%,transparent)_30%,color-mix(in_oklab,var(--foreground)_95%,transparent)_50%,color-mix(in_oklab,var(--muted-foreground)_45%,transparent)_70%)]',
        'bg-[length:200%_100%] animate-[tool-shimmer_1.8s_linear_infinite]',
        className
      )}
    >
      {text}
    </span>
  )
}
