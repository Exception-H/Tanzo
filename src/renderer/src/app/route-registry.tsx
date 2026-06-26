import type { ComponentType } from 'react'
import ChatPage from '@/features/chat/page'
import SettingsPage from '@/features/settings/page'

export interface AppRoute {
  path: string
  Component: ComponentType
  keepAlive?: boolean
}

export const APP_ROUTES: readonly AppRoute[] = [
  {
    path: '/',
    Component: ChatPage,
    keepAlive: true
  },
  {
    path: '/settings',
    Component: SettingsPage
  }
]
