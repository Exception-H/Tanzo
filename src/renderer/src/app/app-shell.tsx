import { useCallback, useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useLocation } from 'react-router-dom'
import { useGroupRef, usePanelRef } from 'react-resizable-panels'
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from '@/components/ui/resizable'
import { cn } from '@/lib/utils'
import { ConversationSidebar } from '@/features/chat/ui/conversation/conversation-sidebar'
import { SettingsNav } from '@/features/settings/ui/settings-nav'
import { useChatNavigation } from '@/features/chat/model/use-chat-navigation'
import { AppShellContext, type AppShellContextValue } from './app-shell-context'

const DEFAULT_LAYOUT = { sidebar: 28, content: 72 } as const

export interface AppShellProps {
  children: React.ReactNode
}

export function AppShell({ children }: AppShellProps): React.JSX.Element {
  const { t } = useTranslation()
  const { pathname } = useLocation()
  const groupRef = useGroupRef()
  const sidebarPanelRef = usePanelRef()
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)

  const isSettings = pathname.startsWith('/settings')
  const navigation = useChatNavigation()

  useEffect(() => {
    const group = groupRef.current
    if (!group) return
    const layout = group.getLayout()
    if ((layout.sidebar ?? 0) < 10) {
      group.setLayout(DEFAULT_LAYOUT)
    }
  }, [groupRef])

  useEffect(() => {
    const panel = sidebarPanelRef.current
    if (!panel) return
    const collapsed = panel.isCollapsed()
    if (collapsed === sidebarCollapsed) return
    if (sidebarCollapsed) panel.collapse()
    else panel.expand()
  }, [sidebarCollapsed, sidebarPanelRef])

  const handleSidebarResize = useCallback(() => {
    const panel = sidebarPanelRef.current
    if (!panel) return
    setSidebarCollapsed(panel.isCollapsed())
  }, [sidebarPanelRef])

  const toggleSidebar = useCallback(() => setSidebarCollapsed((value) => !value), [])

  const contextValue = useMemo<AppShellContextValue>(
    () => ({ sidebarCollapsed, toggleSidebar }),
    [sidebarCollapsed, toggleSidebar]
  )

  return (
    <AppShellContext.Provider value={contextValue}>
      <ResizablePanelGroup
        id="app-shell"
        orientation="horizontal"
        defaultLayout={DEFAULT_LAYOUT}
        groupRef={groupRef}
        className="h-full min-h-0 w-full min-w-0 bg-transparent"
      >
        <ResizablePanel
          key="sidebar"
          id="sidebar"
          defaultSize="28%"
          minSize="18%"
          maxSize="40%"
          collapsible
          panelRef={sidebarPanelRef}
          onResize={handleSidebarResize}
          className="min-h-0 min-w-0 transition-[flex-basis] duration-200 ease-linear"
        >
          <div className="sidebar-surface h-full min-h-0 w-full min-w-0">
            {isSettings ? (
              <SettingsNav />
            ) : (
              <ConversationSidebar
                sidebar={navigation.sidebarModel}
                onConversationSelect={navigation.handleSelectConversation}
                onConversationDelete={navigation.handleDelete}
                onConversationRename={navigation.handleRename}
                onNewConversation={navigation.handleNewConversation}
                onWorkspaceConversationCreate={navigation.handleWorkspaceConversationCreate}
                onWorkspaceRemove={navigation.handleWorkspaceRemove}
                onToggleWorkspaceExpanded={navigation.handleToggleWorkspaceExpanded}
                onPickWorkspace={navigation.handlePickWorkspace}
              />
            )}
          </div>
        </ResizablePanel>

        <ResizableHandle
          id="app-shell-separator"
          disabled={sidebarCollapsed}
          style={{ backgroundColor: 'transparent' }}
          className={cn(
            'relative w-px shrink-0 cursor-col-resize',
            'bg-gradient-to-b from-transparent via-foreground/20 to-transparent',
            'transition-[colors,opacity] duration-200 ease-linear hover:via-foreground/40',
            'after:absolute after:inset-y-0 after:left-1/2 after:w-3 after:-translate-x-1/2',
            sidebarCollapsed && 'pointer-events-none opacity-0'
          )}
        >
          <span className="sr-only">{t('common.layout.resizeSidebar')}</span>
        </ResizableHandle>

        <ResizablePanel
          key="content"
          id="content"
          minSize="30%"
          className="min-h-0 min-w-0 transition-[flex-basis] duration-200 ease-linear"
        >
          <div className="main-surface flex h-full min-h-0 min-w-0 flex-col">{children}</div>
        </ResizablePanel>
      </ResizablePanelGroup>
    </AppShellContext.Provider>
  )
}
