import { createContext, useContext } from 'react'

export interface AppShellContextValue {
  sidebarCollapsed: boolean
  toggleSidebar: () => void
}

export const AppShellContext = createContext<AppShellContextValue | null>(null)

export function useAppShell(): AppShellContextValue {
  const value = useContext(AppShellContext)
  if (!value) {
    return { sidebarCollapsed: false, toggleSidebar: () => {} }
  }
  return value
}
