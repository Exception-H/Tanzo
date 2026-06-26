import { create } from 'zustand'
import { DEFAULT_SETTINGS_SECTION, type SettingsSectionId } from '@/features/settings/model'

interface AppShellState {
  settingsSection: SettingsSectionId
  setSettingsSection: (section: SettingsSectionId) => void
}

export const useAppShellStore = create<AppShellState>()((set) => ({
  settingsSection: DEFAULT_SETTINGS_SECTION,
  setSettingsSection: (section) =>
    set((state) => (state.settingsSection === section ? state : { settingsSection: section }))
}))
