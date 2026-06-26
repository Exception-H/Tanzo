import type { Machine } from './types'

/**
 * Imperative shell around a pure `Machine`. The interpreter owns the current
 * state, runs `transition` on each event, and hands every produced effect to
 * `runEffect` — the single place allowed to perform I/O. Effects may feed new
 * events back in by calling the `send` callback they receive.
 *
 * See docs/state-machine-unification.md §3.2.
 */
export interface Interpreter<S, E> {
  /** Current machine state. */
  state(): S
  /** Advance one step: transition, then run produced effects. Returns the new state. */
  send(event: E): S
  /** Whether the machine has reached a terminal state. */
  isDone(): boolean
}

export type EffectRunner<E, Eff> = (effect: Eff, send: (event: E) => void) => void | Promise<void>

export function createInterpreter<S, E, Eff>(
  machine: Machine<S, E, Eff>,
  initial: S,
  runEffect: EffectRunner<E, Eff>
): Interpreter<S, E> {
  let current = initial

  const send = (event: E): S => {
    if (machine.isTerminal(current)) return current
    const result = machine.transition(current, event)
    current = result.state
    for (const effect of result.effects) {
      void runEffect(effect, send)
    }
    return current
  }

  return {
    state: () => current,
    send,
    isDone: () => machine.isTerminal(current)
  }
}
