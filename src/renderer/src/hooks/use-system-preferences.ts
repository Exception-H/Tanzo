import { useEffect, useState } from 'react'
import type { ElectronColorScheme, ElectronSystemPreferences } from '@shared/system'
import { createLogger } from '@/common/logger'

const log = createLogger('renderer.system-preferences')

const FALLBACK: ElectronSystemPreferences = {
  locale: 'en',
  preferredLanguages: ['en'],
  colorScheme: 'light'
}

export function useSystemPreferences(): ElectronSystemPreferences | null {
  const electron = window.electron
  const [preferences, setPreferences] = useState<ElectronSystemPreferences | null>(
    electron ? null : FALLBACK
  )

  useEffect(() => {
    if (!electron) return

    let cancelled = false
    void electron
      .getSystemPreferences()
      .then((value) => {
        if (!cancelled) setPreferences(value)
      })
      .catch((error) => {
        log.warn('failed to load system preferences; using defaults', error)
        if (!cancelled) setPreferences(FALLBACK)
      })
    const unsubscribe = electron.onSystemPreferencesChanged((value) => setPreferences(value))
    return () => {
      cancelled = true
      unsubscribe()
    }
  }, [electron])

  return preferences
}

export function useResolvedColorScheme(): ElectronColorScheme {
  const preferences = useSystemPreferences()
  return preferences?.colorScheme ?? 'light'
}
