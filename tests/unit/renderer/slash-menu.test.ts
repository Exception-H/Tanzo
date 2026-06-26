import { describe, expect, it } from 'vitest'
import { executesOnSelect, getSlashQuery } from '@renderer/features/chat/ui/compose/use-slash-menu'
import type { SlashCommandDef } from '@shared/slash-command'

describe('chat/use-slash-menu/getSlashQuery', () => {
  it('returns empty string for a lone slash', () => {
    expect(getSlashQuery('/', true)).toBe('')
  })

  it('returns the lowercased command fragment', () => {
    expect(getSlashQuery('/foo', true)).toBe('foo')
    expect(getSlashQuery('/Foo-Bar', true)).toBe('foo-bar')
  })

  it('returns null once the fragment contains a space', () => {
    expect(getSlashQuery('/foo bar', true)).toBeNull()
  })

  it('returns null for non-slash input', () => {
    expect(getSlashQuery('hello', true)).toBeNull()
  })

  it('returns null when slash cannot open', () => {
    expect(getSlashQuery('/foo', false)).toBeNull()
  })
})

describe('chat/use-slash-menu/executesOnSelect', () => {
  it('is true for a bare action command', () => {
    const command: SlashCommandDef = { name: 'compact', kind: 'action', source: 'builtin' }
    expect(executesOnSelect(command)).toBe(true)
  })

  it('is false when the action has argsHint or insertText', () => {
    expect(
      executesOnSelect({ name: 'goal', kind: 'action', source: 'builtin', argsHint: '<text>' })
    ).toBe(false)
    expect(
      executesOnSelect({ name: 'agent', kind: 'action', source: 'agent', insertText: '/agent ' })
    ).toBe(false)
  })

  it('is false for non-action commands', () => {
    expect(
      executesOnSelect({ name: 'plan', kind: 'prompt', source: 'command', template: 'x' })
    ).toBe(false)
  })
})
