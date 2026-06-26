import { describe, expect, it, vi } from 'vitest'
import { createInterpreter } from '@main/agent/runtime/machine/interpreter'
import { type Machine, next, stay } from '@main/agent/runtime/machine/types'

type S = { kind: 'idle' | 'counting' | 'done'; count: number }
type E = { kind: 'inc' } | { kind: 'stop' } | { kind: 'echoed' }
type Eff = { kind: 'log'; value: number } | { kind: 'reenter' }

const machine: Machine<S, E, Eff> = {
  initial: () => ({ kind: 'idle', count: 0 }),
  isTerminal: (s) => s.kind === 'done',
  transition: (state, event) => {
    if (event.kind === 'inc') {
      const count = state.count + 1
      return next({ kind: 'counting', count }, [{ kind: 'log', value: count }])
    }
    if (event.kind === 'stop') {
      return next({ ...state, kind: 'done' }, [{ kind: 'reenter' }])
    }
    return stay(state)
  }
}

describe('agent/runtime/machine/interpreter', () => {
  it('advances state and runs produced effects', () => {
    const logged: number[] = []
    const interp = createInterpreter(machine, machine.initial(), (eff) => {
      if (eff.kind === 'log') logged.push(eff.value)
    })
    interp.send({ kind: 'inc' })
    interp.send({ kind: 'inc' })
    expect(interp.state()).toEqual({ kind: 'counting', count: 2 })
    expect(logged).toEqual([1, 2])
  })

  it('lets effects feed events back via send', () => {
    const seen: string[] = []
    const interp = createInterpreter(machine, machine.initial(), (eff, send) => {
      if (eff.kind === 'reenter') {
        seen.push('reenter')
        send({ kind: 'echoed' })
      }
    })
    interp.send({ kind: 'stop' })
    expect(seen).toEqual(['reenter'])
    expect(interp.isDone()).toBe(true)
  })

  it('ignores events once terminal', () => {
    const runEffect = vi.fn()
    const interp = createInterpreter(machine, machine.initial(), runEffect)
    interp.send({ kind: 'stop' })
    expect(interp.isDone()).toBe(true)
    runEffect.mockClear()
    const after = interp.send({ kind: 'inc' })
    expect(after.kind).toBe('done')
    expect(runEffect).not.toHaveBeenCalled()
  })

  it('treats unknown transitions as a no-op (stay)', () => {
    const interp = createInterpreter(machine, machine.initial(), () => {})
    const state = interp.send({ kind: 'echoed' })
    expect(state).toEqual({ kind: 'idle', count: 0 })
  })
})
