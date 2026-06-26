import {
  AppearanceModeSection,
  ColorThemeSection,
  FontSizeSection,
  LanguageSettingsSection,
  ReasoningSection
} from './theme/settings-theme-sections'
import { WallpaperSection } from './theme/settings-wallpaper-section'

export function SettingsThemeTab() {
  return (
    <div className="mx-auto w-full max-w-4xl space-y-5">
      <LanguageSettingsSection />
      <AppearanceModeSection />
      <ReasoningSection />
      <ColorThemeSection />
      <WallpaperSection />
      <FontSizeSection />
    </div>
  )
}
