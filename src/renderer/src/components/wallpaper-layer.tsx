import { useLayoutEffect } from 'react'
import { usePreferences } from '@/common/preferences'
import type { WallpaperOverlay, WallpaperSettings } from '@shared/preferences'

const SURFACE_OVERRIDES: Record<string, string> = {
  '--main-surface-bg': 'color-mix(in oklab, var(--background) 80%, transparent)',
  '--sidebar-surface-bg': 'color-mix(in oklab, var(--sidebar) 55%, transparent)',
  '--sidebar-solid-bg': 'color-mix(in oklab, var(--sidebar) 55%, transparent)',
  '--toolbar-surface-bg': 'color-mix(in oklab, var(--background) 85%, transparent)',
  '--compose-surface-bg': 'color-mix(in oklab, var(--card) 80%, transparent)'
}

function overlayColor(overlay: WallpaperOverlay, strength: number): string | null {
  if (overlay === 'dark') return `rgba(0, 0, 0, ${strength})`
  if (overlay === 'light') return `rgba(255, 255, 255, ${strength})`
  return null
}

function cssUrl(path: string): string {
  const escaped = path.replace(
    /["\\\n\r]/g,
    (char) => `\\${char === '\n' ? 'a' : char === '\r' ? 'd' : char}`
  )
  return `url("${escaped}")`
}

function useSurfaceTransparency(active: boolean): void {
  useLayoutEffect(() => {
    const root = document.documentElement
    if (active) {
      for (const [key, value] of Object.entries(SURFACE_OVERRIDES)) {
        root.style.setProperty(key, value)
      }
    }
    return () => {
      for (const key of Object.keys(SURFACE_OVERRIDES)) root.style.removeProperty(key)
    }
  }, [active])
}

export function WallpaperLayer(): React.JSX.Element | null {
  const wallpaper: WallpaperSettings = usePreferences().wallpaper
  const active = wallpaper.assetPath !== null
  useSurfaceTransparency(active)

  if (!active || !wallpaper.assetPath) return null

  const overflow = Math.max(0, wallpaper.blur * 2)
  const tint = overlayColor(wallpaper.overlay, wallpaper.overlayStrength)

  return (
    <div
      aria-hidden
      style={{ position: 'fixed', inset: 0, overflow: 'hidden', pointerEvents: 'none', zIndex: -1 }}
    >
      <div
        style={{
          position: 'absolute',
          inset: `-${overflow}px`,
          backgroundImage: cssUrl(wallpaper.assetPath),
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          opacity: wallpaper.opacity,
          filter: wallpaper.blur > 0 ? `blur(${wallpaper.blur}px)` : undefined
        }}
      />
      {tint ? <div style={{ position: 'absolute', inset: 0, backgroundColor: tint }} /> : null}
    </div>
  )
}
