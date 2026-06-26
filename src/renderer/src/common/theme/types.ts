export type {
  ColorThemeDefinition,
  ColorThemeId,
  ThemeColors,
  ThemeOverrides,
  RadiusPresetId,
  DensityPresetId,
  FontSizePresetId
} from '@shared/preferences'

export interface RadiusPreset {
  id: import('@shared/preferences').RadiusPresetId
  name: string
  description: string
  value: string
}

export interface DensityPreset {
  id: import('@shared/preferences').DensityPresetId
  name: string
  description: string
  spacing: string
}

export interface FontSizePreset {
  id: import('@shared/preferences').FontSizePresetId
  name: string
  description: string
  value: string
}
