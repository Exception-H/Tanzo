import type { ReactNode } from 'react'
import { AnimatePresence, LazyMotion, domAnimation, m } from 'motion/react'
import { useTranslation } from 'react-i18next'
import { cn } from '@/lib/utils'

interface FloatingSaveBarProps {
  visible: boolean
  changeCount: number
  status: 'idle' | 'saving' | 'success' | 'error'
  children: ReactNode
}

export function FloatingSaveBar({ visible, changeCount, status, children }: FloatingSaveBarProps) {
  const { t } = useTranslation()

  return (
    <LazyMotion features={domAnimation}>
      <AnimatePresence mode="wait">
        {visible && (
          <div className="pointer-events-none sticky bottom-0 z-40 -mx-4 mt-8 flex items-end justify-center px-4 pb-4 sm:pb-6 lg:-mx-6">
            <m.div
              initial={{ y: 80, opacity: 0, scale: 0.9 }}
              animate={{ y: 0, opacity: 1, scale: 1 }}
              exit={{ y: 80, opacity: 0, scale: 0.9 }}
              transition={{ type: 'spring', stiffness: 400, damping: 28, mass: 0.6 }}
              className="pointer-events-auto relative inline-flex"
            >
              <m.div
                layout
                className={cn(
                  'relative inline-flex items-center gap-2 rounded-[var(--radius-2xl)] border border-border/50 bg-background/95 px-2 py-1.5 backdrop-blur-sm',
                  status === 'success' && 'border-emerald-500/50',
                  status === 'error' && 'border-destructive/50'
                )}
              >
                <span className="px-2 text-[0.6875rem] text-muted-foreground">
                  {t('common.status.changes', { count: changeCount })}
                </span>

                <div className="h-5 w-px bg-border/60" />

                {children}
              </m.div>
            </m.div>
          </div>
        )}
      </AnimatePresence>
    </LazyMotion>
  )
}
