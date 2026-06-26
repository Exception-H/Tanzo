import { useEffect, useMemo, useState, useTransition } from 'react'
import { PanelLeftClose, PanelLeftOpen } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { PageHeader, pageHeaderIconBtnCls } from '@/components/layout/page-header'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { Spinner } from '@/components/ui/spinner'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { useAppShell } from '@/app/app-shell-context'
import { useChatNavigation } from './model/use-chat-navigation'
import { ChatEmpty } from './ui/chat-empty'
import { ActiveChat } from './ui/active-chat'
import { TaskOverviewPill } from './ui/task-overview-pill'
import { StartComposer } from './ui/compose/start-composer'
import { GitReviewDialog, WorkspaceGitPill } from '@/features/git/ui'
import { useGitReviewController } from '@/features/git/model'

export default function ChatPage(): React.JSX.Element {
  const { t } = useTranslation()
  const { sidebarCollapsed, toggleSidebar } = useAppShell()
  const navigation = useChatNavigation()
  const { activeChatId, activeConversation, currentWorkspace, defaultWorkspace } = navigation
  const [displayedChatId, setDisplayedChatId] = useState<string | null>(activeChatId)
  const [, startChatSwitchTransition] = useTransition()

  const headerTitle = currentWorkspace?.label || activeConversation?.title || t('chat.page.title')
  const sidebarToggleLabel = sidebarCollapsed
    ? t('chat.sidebar.expandSidebar')
    : t('chat.sidebar.collapseSidebar')

  const gitCwd = activeConversation?.cwd ?? currentWorkspace?.cwd ?? null
  const gitTarget = useMemo(() => (gitCwd ? { cwd: gitCwd } : null), [gitCwd])
  const gitReview = useGitReviewController(gitTarget)
  const [gitReviewOpen, setGitReviewOpen] = useState(false)

  useEffect(() => {
    if (activeChatId === displayedChatId) return undefined

    const frame = window.requestAnimationFrame(() => {
      if (!activeChatId) {
        setDisplayedChatId(null)
        return
      }
      startChatSwitchTransition(() => setDisplayedChatId(activeChatId))
    })
    return () => window.cancelAnimationFrame(frame)
  }, [activeChatId, displayedChatId, startChatSwitchTransition])

  const isSwitchingChat = activeChatId !== displayedChatId

  useEffect(() => {
    if (!gitCwd) return undefined
    void window.electron?.git?.watch(gitCwd)
    return () => {
      void window.electron?.git?.unwatch(gitCwd)
    }
  }, [gitCwd])

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden">
      <PageHeader
        title={headerTitle}
        leadingActions={
          <Tooltip>
            <TooltipTrigger
              render={(triggerProps) => (
                <Button
                  {...triggerProps}
                  type="button"
                  variant="ghost"
                  size="icon"
                  className={cn(pageHeaderIconBtnCls, 'hover:bg-transparent')}
                  onClick={toggleSidebar}
                  aria-label={sidebarToggleLabel}
                  aria-pressed={sidebarCollapsed}
                >
                  {sidebarCollapsed ? (
                    <PanelLeftOpen className="size-4" aria-hidden="true" />
                  ) : (
                    <PanelLeftClose className="size-4" aria-hidden="true" />
                  )}
                </Button>
              )}
            />
            <TooltipContent side="bottom">{sidebarToggleLabel}</TooltipContent>
          </Tooltip>
        }
        actions={
          <>
            {displayedChatId ? <TaskOverviewPill chatId={displayedChatId} /> : null}
            {gitTarget ? (
              <WorkspaceGitPill
                overview={gitReview.overview}
                loading={gitReview.loading}
                onClick={() => setGitReviewOpen(true)}
              />
            ) : null}
          </>
        }
      />
      <div className="flex min-h-0 flex-1 flex-col">
        {activeChatId ? (
          isSwitchingChat || !displayedChatId ? (
            <ChatSwitchShell />
          ) : (
            <ActiveChat
              key={displayedChatId}
              chatId={displayedChatId}
              onForkMessage={navigation.handleForkMessage}
            />
          )
        ) : (
          <ChatEmpty>
            <StartComposer
              workspaceRoot={defaultWorkspace?.cwd ?? null}
              onStart={navigation.handleStartConversation}
            />
          </ChatEmpty>
        )}
      </div>
      <GitReviewDialog
        open={gitReviewOpen}
        onOpenChange={setGitReviewOpen}
        controller={gitReview}
      />
    </div>
  )
}

function ChatSwitchShell(): React.JSX.Element {
  return (
    <div className="flex h-full min-h-0 flex-1 items-center justify-center">
      <Spinner className="size-5 text-foreground/35" />
    </div>
  )
}
