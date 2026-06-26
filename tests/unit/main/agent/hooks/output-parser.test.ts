import { describe, expect, it } from 'vitest'
import { parseHandlerResult } from '@main/agent/hooks/output-parser'
import type { HookExecResult } from '@main/agent/hooks/types'

function result(partial: Partial<HookExecResult>): HookExecResult {
  return { exitCode: 0, stdout: '', stderr: '', durationMs: 1, timedOut: false, ...partial }
}

describe('main/agent/hooks/output-parser exit-code matrix', () => {
  it('exit 0 + empty stdout → no-op', () => {
    const outcome = parseHandlerResult('PreToolUse', 'k', result({ exitCode: 0 }))
    expect(outcome.denied).toBe(false)
    expect(outcome.entries).toEqual([])
  })

  it('executor error → failed entry', () => {
    const outcome = parseHandlerResult(
      'PreToolUse',
      'k',
      result({ error: 'hook timed out after 1s' })
    )
    expect(outcome.entries[0]).toMatchObject({ kind: 'error', message: 'hook timed out after 1s' })
  })

  it('non-zero non-2 exit → failed entry, no deny', () => {
    const outcome = parseHandlerResult('PreToolUse', 'k', result({ exitCode: 7 }))
    expect(outcome.denied).toBe(false)
    expect(outcome.entries[0].message).toMatch(/exited with code 7/)
  })

  it('exit 2 + stderr → deny for PreToolUse', () => {
    const outcome = parseHandlerResult('PreToolUse', 'k', result({ exitCode: 2, stderr: 'nope' }))
    expect(outcome.denied).toBe(true)
    expect(outcome.denyReason).toBe('nope')
  })

  it('exit 2 + empty stderr → failed entry', () => {
    const outcome = parseHandlerResult('PreToolUse', 'k', result({ exitCode: 2, stderr: '  ' }))
    expect(outcome.denied).toBe(false)
    expect(outcome.entries[0].message).toMatch(/code 2 but wrote no stderr/)
  })

  it('exit 2 + stderr → feedback for PostToolUse (non-blocking)', () => {
    const outcome = parseHandlerResult('PostToolUse', 'k', result({ exitCode: 2, stderr: 'fyi' }))
    expect(outcome.denied).toBe(false)
    expect(outcome.feedback).toBe('fyi')
  })

  it('looks-like-JSON but invalid → failed entry', () => {
    const outcome = parseHandlerResult('PreToolUse', 'k', result({ stdout: '{not json' }))
    expect(outcome.entries[0].message).toMatch(/invalid JSON/)
  })

  it('plain text stdout → context for SessionStart, ignored for PreToolUse', () => {
    expect(
      parseHandlerResult('SessionStart', 'k', result({ stdout: 'hello world' })).additionalContext
    ).toBe('hello world')
    expect(
      parseHandlerResult('PreToolUse', 'k', result({ stdout: 'hello world' })).additionalContext
    ).toBeUndefined()
  })
})

describe('main/agent/hooks/output-parser JSON effects', () => {
  it('PreToolUse permissionDecision:deny blocks with reason', () => {
    const outcome = parseHandlerResult(
      'PreToolUse',
      'k',
      result({
        stdout: JSON.stringify({
          hookSpecificOutput: {
            hookEventName: 'PreToolUse',
            permissionDecision: 'deny',
            permissionDecisionReason: 'blocked path'
          }
        })
      })
    )
    expect(outcome.denied).toBe(true)
    expect(outcome.denyReason).toBe('blocked path')
  })

  it('PreToolUse legacy decision:block also blocks', () => {
    const outcome = parseHandlerResult(
      'PreToolUse',
      'k',
      result({ stdout: JSON.stringify({ decision: 'block', reason: 'legacy' }) })
    )
    expect(outcome.denied).toBe(true)
    expect(outcome.denyReason).toBe('legacy')
  })

  it('PreToolUse updatedInput is accepted-but-unsupported (warns, no-op)', () => {
    const outcome = parseHandlerResult(
      'PreToolUse',
      'k',
      result({
        stdout: JSON.stringify({
          hookSpecificOutput: {
            hookEventName: 'PreToolUse',
            permissionDecision: 'allow',
            updatedInput: { command: 'rewritten' }
          }
        })
      })
    )
    expect(outcome.hasUpdatedInput).toBe(true)
    expect(
      outcome.entries.some((entry) => /updatedInput.*not yet supported/.test(entry.message))
    ).toBe(true)
  })

  it('UserPromptSubmit decision:block denies; additionalContext flows', () => {
    const blocked = parseHandlerResult(
      'UserPromptSubmit',
      'k',
      result({ stdout: JSON.stringify({ decision: 'block', reason: 'no' }) })
    )
    expect(blocked.denied).toBe(true)
    const ctx = parseHandlerResult(
      'UserPromptSubmit',
      'k',
      result({
        stdout: JSON.stringify({
          hookSpecificOutput: { hookEventName: 'UserPromptSubmit', additionalContext: 'extra' }
        })
      })
    )
    expect(ctx.additionalContext).toBe('extra')
  })

  it('continue:false stops the turn for PostToolUse', () => {
    const outcome = parseHandlerResult(
      'PostToolUse',
      'k',
      result({ stdout: JSON.stringify({ continue: false, stopReason: 'halt' }) })
    )
    expect(outcome.stopped).toBe(true)
    expect(outcome.stopReason).toBe('halt')
  })

  it('systemMessage surfaces as a warning entry', () => {
    const outcome = parseHandlerResult(
      'Stop',
      'k',
      result({ stdout: JSON.stringify({ systemMessage: 'heads up' }) })
    )
    expect(
      outcome.entries.some((entry) => entry.kind === 'warning' && entry.message === 'heads up')
    ).toBe(true)
  })

  it('rejects unknown output fields (deny_unknown_fields)', () => {
    const outcome = parseHandlerResult(
      'PreToolUse',
      'k',
      result({ stdout: JSON.stringify({ bogusField: true }) })
    )
    expect(outcome.entries[0].message).toMatch(/invalid PreToolUse output/)
  })
})
