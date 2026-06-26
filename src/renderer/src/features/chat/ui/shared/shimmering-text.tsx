import { useRef } from 'react'
import { motion, useInView, type UseInViewOptions } from 'motion/react'
import { cn } from '@/lib/utils'

export interface ShimmeringTextProps {
  text: string
  duration?: number
  delay?: number
  repeat?: boolean
  repeatDelay?: number
  className?: string
  startOnView?: boolean
  once?: boolean
  inViewMargin?: UseInViewOptions['margin']
  spread?: number
  color?: string
  shimmerColor?: string
}

export function ShimmeringText({
  text,
  duration = 2.5,
  delay = 0,
  repeat = true,
  repeatDelay = 1,
  className,
  startOnView = true,
  once = false,
  inViewMargin,
  spread = 2.5,
  color,
  shimmerColor
}: ShimmeringTextProps): React.JSX.Element {
  const ref = useRef<HTMLSpanElement>(null)
  const inViewOptions: UseInViewOptions = {
    once,
    margin: inViewMargin
  }
  const isInView = useInView(ref, inViewOptions)
  const dynamicSpread = text.length * spread
  const halfSpread = dynamicSpread * 0.5
  const shouldAnimate = !startOnView || isInView
  const resolvedBaseColor = color ?? 'var(--muted-foreground)'
  const resolvedShimmerColor = shimmerColor ?? 'var(--foreground)'
  const backgroundImage =
    `linear-gradient(90deg, transparent calc(50% - ${dynamicSpread}px), ` +
    `${resolvedShimmerColor} calc(50% - ${halfSpread}px), ` +
    `${resolvedShimmerColor} calc(50% + ${halfSpread}px), ` +
    `transparent calc(50% + ${dynamicSpread}px)), ` +
    `linear-gradient(${resolvedBaseColor}, ${resolvedBaseColor})`

  return (
    <motion.span
      ref={ref}
      className={cn(
        'relative inline-block bg-[length:250%_100%,auto] bg-clip-text text-transparent',
        '[background-repeat:no-repeat,padding-box]',
        className
      )}
      initial={{
        backgroundPosition: '-100% center',
        opacity: 0
      }}
      animate={
        shouldAnimate
          ? {
              backgroundPosition: ['200% center', '-100% center'],
              opacity: 1
            }
          : {}
      }
      style={{
        backgroundImage
      }}
      transition={{
        backgroundPosition: {
          repeat: repeat ? Infinity : 0,
          duration,
          delay,
          repeatDelay,
          ease: 'linear'
        },
        opacity: {
          duration: 0.5,
          delay,
          ease: 'easeOut'
        }
      }}
    >
      {text}
    </motion.span>
  )
}
