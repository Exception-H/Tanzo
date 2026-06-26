import { tool, zodSchema, type Tool, type ToolSet } from 'ai'
import type { TanzoTools } from '@shared/agent-message'
import type { ToolDeps } from './types'
import { toolError } from './builtin/shared'
import { toolResultToModelOutput } from './model-output'
import {
  shellListInputSchema,
  shellListOutputSchema,
  shellPollInputSchema,
  shellSessionOutputOrErrorSchema,
  shellStartInputSchema,
  shellStopInputSchema,
  shellStopOutputSchema,
  shellWriteInputSchema
} from './tool-schemas'

function errorOutput(message: string): { error: true; message: string } {
  return toolError(message)
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

export function shellStartTool(
  deps: ToolDeps,
  chatId: string
): Tool<TanzoTools['shellStart']['input'], TanzoTools['shellStart']['output']> {
  return tool<
    TanzoTools['shellStart']['input'],
    TanzoTools['shellStart']['output'],
    Record<string, unknown>
  >({
    description:
      'Start a long-running shell command in the background and return a shell session id. Use for dev ' +
      'servers, watch tasks, logs, and commands that should keep running while you continue working. ' +
      'Use shellPoll to read new output, shellWrite to send stdin, and shellStop when done.',
    inputSchema: zodSchema(shellStartInputSchema),
    outputSchema: zodSchema(shellSessionOutputOrErrorSchema),
    metadata: { tanzo: { kind: 'exec', component: 'ShellCard' } },
    toModelOutput: toolResultToModelOutput,
    async execute({ command, workdir, timeoutMs, yieldTimeMs }, { abortSignal }) {
      try {
        const cwd = workdir ? await deps.fs.resolveWorkspace(workdir, abortSignal) : deps.fs.root
        return await deps.shellSessions.start({
          chatId,
          command,
          cwd,
          ...(timeoutMs !== undefined ? { timeoutMs } : {}),
          ...(yieldTimeMs !== undefined ? { yieldTimeMs } : {}),
          signal: abortSignal
        })
      } catch (error) {
        return errorOutput(errorMessage(error))
      }
    }
  })
}

export function shellPollTool(
  deps: ToolDeps,
  chatId: string
): Tool<TanzoTools['shellPoll']['input'], TanzoTools['shellPoll']['output']> {
  return tool<
    TanzoTools['shellPoll']['input'],
    TanzoTools['shellPoll']['output'],
    Record<string, unknown>
  >({
    description:
      'Read new output from a background shell session. Returns only output produced since the last ' +
      'shellStart/shellPoll/shellWrite read for that session, along with current status and exit code.',
    inputSchema: zodSchema(shellPollInputSchema),
    outputSchema: zodSchema(shellSessionOutputOrErrorSchema),
    metadata: { tanzo: { kind: 'read', component: 'ShellCard' } },
    toModelOutput: toolResultToModelOutput,
    async execute({ sessionId, yieldTimeMs }, { abortSignal }) {
      try {
        return await deps.shellSessions.poll({
          chatId,
          sessionId,
          ...(yieldTimeMs !== undefined ? { yieldTimeMs } : {}),
          signal: abortSignal
        })
      } catch (error) {
        return errorOutput(errorMessage(error))
      }
    }
  })
}

export function shellWriteTool(
  deps: ToolDeps,
  chatId: string
): Tool<TanzoTools['shellWrite']['input'], TanzoTools['shellWrite']['output']> {
  return tool<
    TanzoTools['shellWrite']['input'],
    TanzoTools['shellWrite']['output'],
    Record<string, unknown>
  >({
    description:
      'Write text to stdin of a background shell session, then read any new output. Include a trailing ' +
      'newline when the process expects Enter.',
    inputSchema: zodSchema(shellWriteInputSchema),
    outputSchema: zodSchema(shellSessionOutputOrErrorSchema),
    metadata: { tanzo: { kind: 'exec', component: 'ShellCard' } },
    toModelOutput: toolResultToModelOutput,
    async execute({ sessionId, input, yieldTimeMs }, { abortSignal }) {
      try {
        return await deps.shellSessions.write({
          chatId,
          sessionId,
          input,
          ...(yieldTimeMs !== undefined ? { yieldTimeMs } : {}),
          signal: abortSignal
        })
      } catch (error) {
        return errorOutput(errorMessage(error))
      }
    }
  })
}

export function shellStopTool(
  deps: ToolDeps,
  chatId: string
): Tool<TanzoTools['shellStop']['input'], TanzoTools['shellStop']['output']> {
  return tool<
    TanzoTools['shellStop']['input'],
    TanzoTools['shellStop']['output'],
    Record<string, unknown>
  >({
    description: 'Stop a background shell session that this conversation started.',
    inputSchema: zodSchema(shellStopInputSchema),
    outputSchema: zodSchema(shellStopOutputSchema),
    metadata: { tanzo: { kind: 'exec', component: 'ShellCard' } },
    toModelOutput: toolResultToModelOutput,
    async execute({ sessionId }, { abortSignal }) {
      try {
        return await deps.shellSessions.stop({ chatId, sessionId, signal: abortSignal })
      } catch (error) {
        return errorOutput(errorMessage(error))
      }
    }
  })
}

export function shellListTool(
  deps: ToolDeps,
  chatId: string
): Tool<TanzoTools['shellList']['input'], TanzoTools['shellList']['output']> {
  return tool<
    TanzoTools['shellList']['input'],
    TanzoTools['shellList']['output'],
    Record<string, unknown>
  >({
    description: 'List background shell sessions started by this conversation.',
    inputSchema: zodSchema(shellListInputSchema),
    outputSchema: zodSchema(shellListOutputSchema),
    metadata: { tanzo: { kind: 'read', component: 'ShellCard' } },
    toModelOutput: toolResultToModelOutput,
    execute() {
      return { sessions: deps.shellSessions.list(chatId) }
    }
  })
}

export function shellBackgroundTools(deps: ToolDeps, chatId: string): ToolSet {
  return {
    shellStart: shellStartTool(deps, chatId),
    shellPoll: shellPollTool(deps, chatId),
    shellWrite: shellWriteTool(deps, chatId),
    shellStop: shellStopTool(deps, chatId),
    shellList: shellListTool(deps, chatId)
  }
}
