import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import {
  ArrowDownToLine,
  ChevronsUpDown,
  Clock3,
  Download,
  ExternalLink,
  FileCode2,
  History,
  Plus,
  ShieldCheck,
  Upload
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle
} from '@/components/ui/alert-dialog'
import { Input } from '@/components/ui/input'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { cn } from '@/lib/utils'
import type { GitCommitFileChange, GitLogEntry } from '@shared/git'
import type { GitReviewController } from '../model'
import {
  DeltaStats,
  EmptyState,
  FIELD_CLASSNAME,
  GIT_DIALOG_BUTTON_CLASSNAME,
  GIT_DIALOG_GHOST_BUTTON_CLASSNAME,
  GIT_DIALOG_INSPECTOR_HEADER_CLASSNAME,
  GIT_DIALOG_SIDEBAR_TOOLBAR_CLASSNAME,
  GIT_DIALOG_SPLIT_CLASSNAME,
  GIT_DIALOG_SPLIT_SIDEBAR_CLASSNAME,
  GIT_DIALOG_TYPO_ACTION_CLASSNAME,
  GIT_DIALOG_TYPO_CODE_META_CLASSNAME,
  GIT_DIALOG_TYPO_HEADING_CLASSNAME,
  GIT_DIALOG_TYPO_ITEM_CLASSNAME,
  GIT_DIALOG_TYPO_META_CLASSNAME,
  PatchPreview,
  RefDelta,
  SIDEBAR_ROW_CLASSNAME,
  formatDate
} from './git-dialog-shared'

function SyncOptionPill({
  active,
  onToggle,
  children
}: {
  readonly active: boolean
  readonly onToggle: () => void
  readonly children: React.ReactNode
}): React.JSX.Element {
  return (
    <Button
      type="button"
      variant="ghost"
      size="xs"
      onClick={onToggle}
      aria-pressed={active}
      className={cn(
        'h-7 rounded-[var(--radius-4xl)] border-0 px-2.5 text-[0.6875rem] font-medium shadow-none transition-colors',
        active
          ? 'bg-destructive/12 text-destructive hover:bg-destructive/16 hover:text-destructive dark:bg-destructive/20 dark:hover:bg-destructive/25'
          : 'bg-transparent text-muted-foreground/70 hover:bg-foreground/5 hover:text-foreground dark:hover:bg-foreground/10'
      )}
    >
      {children}
    </Button>
  )
}

export function SyncView({
  controller
}: {
  readonly controller: GitReviewController
}): React.JSX.Element {
  const { t } = useTranslation()
  const [remote, setRemote] = useState(controller.remotes[0]?.name ?? 'origin')
  const [branch, setBranch] = useState(controller.overview?.branch ?? '')
  const [forceWithLease, setForceWithLease] = useState(false)
  const [lease, setLease] = useState('')
  const [remoteName, setRemoteName] = useState('origin')
  const [remoteUrl, setRemoteUrl] = useState('')
  const [pushConfirmOpen, setPushConfirmOpen] = useState(false)
  const hasRemote = controller.remotes.length > 0
  const ahead = controller.overview?.ahead ?? 0
  const behind = controller.overview?.behind ?? 0
  const pushTarget = `${remote || 'origin'}${branch ? `/${branch}` : ''}`

  const confirmPush = (): void => {
    setPushConfirmOpen(false)
    void controller.push({ remote, branch, forceWithLease, lease })
  }

  return (
    <div className={GIT_DIALOG_SPLIT_CLASSNAME}>
      <aside className={GIT_DIALOG_SPLIT_SIDEBAR_CLASSNAME}>
        <div className={GIT_DIALOG_SIDEBAR_TOOLBAR_CLASSNAME}>
          <div className="flex min-w-0 flex-1 items-center gap-1.5 px-1">
            <ExternalLink className="size-3.5 shrink-0 text-foreground/45" />
            <span className={cn('truncate', GIT_DIALOG_TYPO_HEADING_CLASSNAME)}>
              {t('gitReview.sync.remotes')}
            </span>
          </div>
          {controller.remotes.length ? (
            <span className={GIT_DIALOG_TYPO_CODE_META_CLASSNAME}>{controller.remotes.length}</span>
          ) : null}
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto p-2 scrollbar-subtle">
          {controller.remotes.map((item) => (
            <button
              key={item.name}
              type="button"
              className={cn(
                SIDEBAR_ROW_CLASSNAME,
                remote === item.name &&
                  'bg-[color-mix(in_oklab,var(--sidebar-primary)_12%,transparent)] ring-1 ring-inset ring-[color-mix(in_oklab,var(--sidebar-primary)_20%,transparent)] dark:bg-[color-mix(in_oklab,var(--sidebar-primary)_15%,transparent)] dark:ring-[color-mix(in_oklab,var(--sidebar-primary)_24%,transparent)]'
              )}
              onClick={() => setRemote(item.name)}
            >
              <ExternalLink
                className={cn(
                  'size-3.5 shrink-0',
                  remote === item.name ? 'text-foreground/70' : 'text-foreground/38'
                )}
              />
              <div className="min-w-0 flex-1 text-left">
                <div className={cn('truncate', GIT_DIALOG_TYPO_ITEM_CLASSNAME)}>{item.name}</div>
                <div className={cn('mt-0.5 truncate', GIT_DIALOG_TYPO_CODE_META_CLASSNAME)}>
                  {item.fetchUrl}
                </div>
              </div>
            </button>
          ))}
          {!hasRemote ? (
            <div className={cn('px-2 py-4 text-center', GIT_DIALOG_TYPO_META_CLASSNAME)}>
              {t('gitReview.sync.noRemotes')}
            </div>
          ) : null}
        </div>
        <form
          className="space-y-2 border-t border-border/15 p-3"
          onSubmit={(event) => {
            event.preventDefault()
            void controller.addRemote(remoteName, remoteUrl, true)
          }}
        >
          <Input
            value={remoteName}
            onChange={(event) => setRemoteName(event.target.value)}
            placeholder={t('gitReview.sync.remoteName')}
            className={FIELD_CLASSNAME}
          />
          <Input
            value={remoteUrl}
            onChange={(event) => setRemoteUrl(event.target.value)}
            placeholder={t('gitReview.sync.remoteUrl')}
            className={FIELD_CLASSNAME}
          />
          <Button
            type="submit"
            size="sm"
            disabled={controller.mutating || !remoteName.trim() || !remoteUrl.trim()}
            className={cn(GIT_DIALOG_BUTTON_CLASSNAME, GIT_DIALOG_TYPO_ACTION_CLASSNAME, 'w-full')}
          >
            <Plus className="size-3.5" />
            {t('gitReview.actions.addRemote')}
          </Button>
        </form>
      </aside>
      <main className="grid min-h-0 grid-rows-[auto_minmax(0,1fr)]">
        <div className={GIT_DIALOG_INSPECTOR_HEADER_CLASSNAME}>
          <ShieldCheck className="size-3.5 shrink-0 text-foreground/45" />
          <div className="flex min-w-0 flex-1 items-center gap-2">
            <div className={cn('min-w-0 truncate', GIT_DIALOG_TYPO_ITEM_CLASSNAME)}>
              {controller.status?.head.upstream ?? t('gitReview.sync.noUpstream')}
            </div>
            <span className="shrink-0 text-foreground/20">·</span>
            <RefDelta ahead={ahead} behind={behind} className="shrink-0" />
          </div>
          <div className="flex shrink-0 items-center gap-1">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className={cn(GIT_DIALOG_GHOST_BUTTON_CLASSNAME, GIT_DIALOG_TYPO_ACTION_CLASSNAME)}
              disabled={controller.mutating || !hasRemote}
              onClick={() => void controller.fetch(remote)}
            >
              <Download className="size-3.5" />
              {t('gitReview.actions.fetch')}
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className={cn(GIT_DIALOG_GHOST_BUTTON_CLASSNAME, GIT_DIALOG_TYPO_ACTION_CLASSNAME)}
              disabled={controller.mutating || !hasRemote}
              onClick={() => void controller.pull(remote, branch)}
            >
              <ArrowDownToLine className="size-3.5" />
              {t('gitReview.actions.pull')}
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className={cn(GIT_DIALOG_GHOST_BUTTON_CLASSNAME, GIT_DIALOG_TYPO_ACTION_CLASSNAME)}
              disabled={controller.mutating || !hasRemote}
              onClick={() => setPushConfirmOpen(true)}
            >
              <Upload className="size-3.5" />
              {t('gitReview.actions.push')}
            </Button>
          </div>
        </div>
        <div className="min-h-0 overflow-y-auto p-3 scrollbar-subtle">
          <div className="mx-auto max-w-2xl space-y-3">
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-[150px_minmax(0,1fr)]">
              <Input
                value={remote}
                onChange={(event) => setRemote(event.target.value)}
                placeholder={t('gitReview.sync.remote')}
                className={FIELD_CLASSNAME}
              />
              <Input
                value={branch}
                onChange={(event) => setBranch(event.target.value)}
                placeholder={t('gitReview.sync.branch')}
                className={FIELD_CLASSNAME}
              />
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <SyncOptionPill active={forceWithLease} onToggle={() => setForceWithLease((c) => !c)}>
                {t('gitReview.sync.forceWithLease')}
              </SyncOptionPill>
              {forceWithLease ? (
                <Input
                  value={lease}
                  onChange={(event) => setLease(event.target.value)}
                  placeholder={t('gitReview.sync.lease')}
                  className={cn(FIELD_CLASSNAME, 'h-7 w-48')}
                />
              ) : null}
            </div>
          </div>
        </div>
      </main>

      <AlertDialog open={pushConfirmOpen} onOpenChange={setPushConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('gitReview.push.confirmTitle')}</AlertDialogTitle>
            <AlertDialogDescription>
              {t('gitReview.push.confirmBody', { target: pushTarget })}
              {forceWithLease ? (
                <span className="mt-2 block font-medium text-destructive">
                  {t('gitReview.push.forceWarning')}
                </span>
              ) : null}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('common.actions.cancel')}</AlertDialogCancel>
            <AlertDialogAction
              variant={forceWithLease ? 'destructive' : 'default'}
              onClick={confirmPush}
            >
              {forceWithLease ? t('gitReview.actions.forcePush') : t('gitReview.actions.push')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

function CommitFileRow({
  file,
  selected,
  onSelect
}: {
  readonly file: GitCommitFileChange
  readonly selected: boolean
  readonly onSelect: () => void
}): React.JSX.Element {
  const name = file.path.split(/[/\\]/).pop() ?? file.path
  const dir = file.path.slice(0, file.path.length - name.length)
  const stats =
    file.binary || (file.additions === 0 && file.deletions === 0)
      ? file.binary
        ? { additions: 0, deletions: 0, binary: true }
        : null
      : { additions: file.additions, deletions: file.deletions }
  return (
    <button
      type="button"
      onClick={onSelect}
      className={cn(
        'group/file flex h-7 w-full min-w-0 items-center gap-1.5 rounded-[var(--radius-md)] px-2 text-left transition-[background-color,color] duration-150 ease-out',
        selected
          ? 'bg-[color-mix(in_oklab,var(--sidebar-primary)_12%,transparent)] ring-1 ring-inset ring-[color-mix(in_oklab,var(--sidebar-primary)_20%,transparent)] dark:bg-[color-mix(in_oklab,var(--sidebar-primary)_15%,transparent)] dark:ring-[color-mix(in_oklab,var(--sidebar-primary)_24%,transparent)]'
          : 'hover:bg-[color-mix(in_oklab,var(--foreground)_4%,transparent)] dark:hover:bg-[color-mix(in_oklab,var(--foreground)_6%,transparent)]'
      )}
    >
      <FileCode2
        className={cn('size-3.5 shrink-0', selected ? 'text-foreground/70' : 'text-foreground/38')}
      />
      <span
        className={cn(
          'min-w-0 flex-1 truncate text-[0.8125rem] leading-tight',
          selected ? 'font-medium text-foreground' : 'text-foreground/78'
        )}
      >
        {dir ? <span className="text-foreground/35">{dir}</span> : null}
        {name}
      </span>
      {stats ? <DeltaStats stats={stats} className="shrink-0" /> : null}
    </button>
  )
}

function CommitPickerRow({
  entry,
  selected,
  onSelect
}: {
  readonly entry: GitLogEntry
  readonly selected: boolean
  readonly onSelect: () => void
}): React.JSX.Element {
  const { t } = useTranslation()
  return (
    <button
      type="button"
      onClick={onSelect}
      className={cn(
        'flex h-7 w-full min-w-0 items-center gap-2 rounded-[var(--radius-sm)] px-2 text-left transition-colors duration-150',
        selected
          ? 'bg-[color-mix(in_oklab,var(--sidebar-primary)_14%,transparent)] text-foreground'
          : 'text-foreground/78 hover:bg-[color-mix(in_oklab,var(--foreground)_5%,transparent)]'
      )}
    >
      <span
        className={cn(
          'w-12 shrink-0 tabular-nums',
          GIT_DIALOG_TYPO_CODE_META_CLASSNAME,
          selected && 'text-foreground/70'
        )}
      >
        {entry.shortHash}
      </span>
      <span className="min-w-0 flex-1 truncate text-[0.75rem]">
        {entry.subject || t('gitReview.history.noSubject')}
      </span>
      <span className={cn('shrink-0 text-[0.625rem]', GIT_DIALOG_TYPO_META_CLASSNAME)}>
        {formatDate(entry.date)}
      </span>
    </button>
  )
}

export function HistoryView({
  controller
}: {
  readonly controller: GitReviewController
}): React.JSX.Element {
  const { t } = useTranslation()
  const [pickerOpen, setPickerOpen] = useState(false)
  const entries = controller.history?.entries ?? []
  const selectedEntry =
    entries.find((entry) => entry.hash === controller.selectedCommitHash) ?? null
  const files = controller.commitDetails?.files ?? []

  return (
    <div className={GIT_DIALOG_SPLIT_CLASSNAME}>
      <aside className={GIT_DIALOG_SPLIT_SIDEBAR_CLASSNAME}>
        <div className={cn(GIT_DIALOG_SIDEBAR_TOOLBAR_CLASSNAME, 'gap-1.5')}>
          <Popover open={pickerOpen} onOpenChange={setPickerOpen}>
            <PopoverTrigger
              render={
                <Button
                  type="button"
                  variant="outline"
                  size="xs"
                  aria-label={t('gitReview.history.pickCommit')}
                  className="h-8 min-w-0 flex-1 justify-start gap-1.5 rounded-[min(var(--radius-md),10px)] border-border/40 bg-muted/[0.14] px-2 shadow-none hover:bg-muted/[0.28] aria-expanded:bg-muted/[0.3]"
                >
                  <History className="size-3.5 shrink-0 text-foreground/45" />
                  <span
                    className={cn(
                      'min-w-0 flex-1 truncate text-left',
                      GIT_DIALOG_TYPO_ITEM_CLASSNAME
                    )}
                  >
                    {selectedEntry?.subject || t('gitReview.states.selectCommit')}
                  </span>
                  {selectedEntry ? (
                    <span className={cn('shrink-0', GIT_DIALOG_TYPO_CODE_META_CLASSNAME)}>
                      {selectedEntry.shortHash}
                    </span>
                  ) : null}
                  <ChevronsUpDown className="size-3.5 shrink-0 text-foreground/55" />
                </Button>
              }
            />
            <PopoverContent
              align="start"
              side="bottom"
              sideOffset={6}
              className="w-[300px] rounded-[min(var(--radius-lg),14px)] border border-border/35 bg-background/96 p-1 shadow-lg backdrop-blur-md"
            >
              <div className="max-h-[min(60vh,360px)] min-h-0 space-y-px overflow-y-auto scrollbar-subtle">
                {entries.map((entry) => (
                  <CommitPickerRow
                    key={entry.hash}
                    entry={entry}
                    selected={controller.selectedCommitHash === entry.hash}
                    onSelect={() => {
                      controller.setSelectedCommitHash(entry.hash)
                      setPickerOpen(false)
                    }}
                  />
                ))}
              </div>
            </PopoverContent>
          </Popover>
        </div>
        <div className="flex h-9 shrink-0 items-center justify-between gap-2 border-b border-border/12 px-3">
          {selectedEntry ? (
            <>
              <div
                className={cn(
                  'flex min-w-0 flex-1 items-center gap-2',
                  GIT_DIALOG_TYPO_META_CLASSNAME
                )}
              >
                <span className="min-w-0 truncate">{selectedEntry.author}</span>
                <Clock3 className="size-3 shrink-0 text-foreground/35" />
                <span className="shrink-0">{formatDate(selectedEntry.date)}</span>
              </div>
              <span className={cn('shrink-0', GIT_DIALOG_TYPO_CODE_META_CLASSNAME)}>
                {t('gitReview.counts.files', { count: files.length })}
              </span>
            </>
          ) : (
            <span className={GIT_DIALOG_TYPO_META_CLASSNAME}>
              {t('gitReview.states.selectCommit')}
            </span>
          )}
        </div>
        <div className="min-h-0 flex-1 space-y-px overflow-y-auto p-2 scrollbar-subtle">
          {selectedEntry ? (
            files.length > 0 ? (
              files.map((file) => (
                <CommitFileRow
                  key={file.path}
                  file={file}
                  selected={controller.selectedCommitFile === file.path}
                  onSelect={() => controller.setSelectedCommitFile(file.path)}
                />
              ))
            ) : (
              <div className={cn('px-2 py-4 text-center', GIT_DIALOG_TYPO_META_CLASSNAME)}>
                {t('gitReview.diff.noTextual')}
              </div>
            )
          ) : null}
        </div>
      </aside>
      <main className="flex min-h-0 flex-col overflow-hidden">
        {!controller.selectedCommitHash ? (
          <EmptyState icon={History} title={t('gitReview.states.selectCommit')} />
        ) : controller.selectedCommitFile ? (
          <PatchPreview
            diff={controller.commitDiff}
            loading={controller.commitDiffLoading || controller.commitLoading}
            emptyLabel={t('gitReview.diff.noTextual')}
          />
        ) : (
          <EmptyState icon={History} title={t('gitReview.states.selectFile')} />
        )}
      </main>
    </div>
  )
}
