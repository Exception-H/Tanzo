import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import type { SlashCommandDef } from '@shared/slash-command'
import { slashCommandClient } from '@/platform/electron/slash-command-client'
import { chatKeys } from '../query-keys'
import { BUILTIN_SLASH_COMMANDS } from './builtin'

const SLASH_STALE_TIME = 30_000
const SLASH_GC_TIME = 30 * 60 * 1_000

export function useSlashCommands(workspaceRoot: string | null): SlashCommandDef[] {
  const { data: remoteCommands } = useQuery({
    queryKey: chatKeys.slashCommands(workspaceRoot ?? ''),
    queryFn: () => slashCommandClient.list(workspaceRoot ?? ''),
    enabled: Boolean(workspaceRoot),
    staleTime: SLASH_STALE_TIME,
    gcTime: SLASH_GC_TIME
  })

  return useMemo(() => {
    const builtinNames = new Set(BUILTIN_SLASH_COMMANDS.map((command) => command.name))
    const dynamic = (remoteCommands ?? []).filter((command) => !builtinNames.has(command.name))
    return [...BUILTIN_SLASH_COMMANDS, ...dynamic]
  }, [remoteCommands])
}
