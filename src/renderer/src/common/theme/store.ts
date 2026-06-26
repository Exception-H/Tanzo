import { useLayoutEffect } from 'react'
import type { ElectronColorScheme } from '@shared/system'
import type { ThemeMode } from '@shared/preferences'
import { useTheme } from '@/components/theme/theme-provider'
import { patchPreferences, usePreferences } from '@/common/preferences'
import {
  getColorThemeById,
  getDensityPresetById,
  getFontSizePresetById,
  getRadiusPresetById
} from './presets'
import type {
  ColorThemeId,
  DensityPresetId,
  FontSizePresetId,
  RadiusPresetId,
  ThemeOverrides
} from './types'

const OVERRIDE_KEYS: (keyof ThemeOverrides)[] = [
  'radius',
  'spacing',
  'tracking-normal',
  'font-sans',
  'font-serif',
  'font-mono',
  'shadow-2xs',
  'shadow-xs',
  'shadow-sm',
  'shadow',
  'shadow-md',
  'shadow-lg',
  'shadow-xl',
  'shadow-2xl'
]

interface ApplySpec {
  colorThemeId: ColorThemeId
  radiusPresetId: RadiusPresetId
  densityPresetId: DensityPresetId
  fontSizePresetId: FontSizePresetId
  mode: 'light' | 'dark'
}

export function resolveThemeMode(mode: ThemeMode, system: ElectronColorScheme): 'light' | 'dark' {
  return mode === 'system' ? system : mode
}

export function applyThemeSettings({
  colorThemeId,
  radiusPresetId,
  densityPresetId,
  fontSizePresetId,
  mode
}: ApplySpec): void {
  if (typeof document === 'undefined') return
  const root = document.documentElement
  const colorTheme = getColorThemeById(colorThemeId)
  const palette = mode === 'dark' ? colorTheme.dark : colorTheme.light
  const overrides = mode === 'dark' ? colorTheme.darkOverrides : colorTheme.lightOverrides
  const radiusPreset = getRadiusPresetById(radiusPresetId)
  const densityPreset = getDensityPresetById(densityPresetId)
  const fontSizePreset = getFontSizePresetById(fontSizePresetId)

  for (const [key, value] of Object.entries(palette)) {
    root.style.setProperty(`--${key}`, value)
  }

  for (const key of OVERRIDE_KEYS) {
    const value = overrides?.[key]
    if (value != null) root.style.setProperty(`--${key}`, value)
    else root.style.removeProperty(`--${key}`)
  }

  if (overrides?.radius == null) root.style.setProperty('--radius', radiusPreset.value)
  if (overrides?.spacing == null) root.style.setProperty('--spacing', densityPreset.spacing)
  root.style.setProperty('--font-size-base', fontSizePreset.value)
  root.dataset.colorTheme = colorTheme.id
  root.dataset.radius = radiusPreset.id
  root.dataset.density = densityPreset.id
  root.dataset.fontSize = fontSizePreset.id
}

export function ThemeInitializer() {
  const { resolvedTheme } = useTheme()
  const preferences = usePreferences()
  const resolvedColorThemeId = getColorThemeById(preferences.colorThemeId).id

  useLayoutEffect(() => {
    if (resolvedColorThemeId !== preferences.colorThemeId) {
      void patchPreferences({ colorThemeId: resolvedColorThemeId })
    }
    applyThemeSettings({
      colorThemeId: resolvedColorThemeId,
      radiusPresetId: preferences.radiusPresetId,
      densityPresetId: preferences.densityPresetId,
      fontSizePresetId: preferences.fontSizePresetId,
      mode: resolvedTheme
    })
  }, [
    preferences.colorThemeId,
    preferences.customThemes,
    preferences.radiusPresetId,
    preferences.densityPresetId,
    preferences.fontSizePresetId,
    resolvedColorThemeId,
    resolvedTheme
  ])

  return null
}

export function useThemeSettings() {
  const preferences = usePreferences()
  const resolvedColorThemeId = getColorThemeById(preferences.colorThemeId).id
  return {
    colorThemeId: resolvedColorThemeId,
    radiusPresetId: preferences.radiusPresetId,
    densityPresetId: preferences.densityPresetId,
    fontSizePresetId: preferences.fontSizePresetId,
    setColorThemeId: (id: ColorThemeId) => patchPreferences({ colorThemeId: id }),
    setRadiusPresetId: (id: RadiusPresetId) => patchPreferences({ radiusPresetId: id }),
    setDensityPresetId: (id: DensityPresetId) => patchPreferences({ densityPresetId: id }),
    setFontSizePresetId: (id: FontSizePresetId) => patchPreferences({ fontSizePresetId: id })
  }
}
