/**
 * State-machine foundation shared by the agent runtime's explicit state machines
 * (goal, turn-loop, subagent-task). See docs/state-machine-unification.md.
 *
 * The contract splits a machine into a pure functional core and an imperative
 * shell:
 *
 *   - `transition` is a PURE function: no I/O, no randomness, no clock reads.
 *     Everything non-deterministic (Date.now(), randomUUID(), external
 *     snapshots) must arrive as event payloads or via `initial`.
 *   - Effects are DESCRIPTIONS (discriminated unions), not function calls. The
 *     interpreter is the only place that turns an effect into real I/O.
 *   - Illegal transitions are a no-op: return the same state with no effects.
 *     Never throw from `transition`.
 */

/** Result of a transition: the next state plus effects to interpret. */
export interface Transition<S, Eff> {
  readonly state: S
  readonly effects: readonly Eff[]
}

/** A pure state machine definition. */
export interface Machine<S, E, Eff, Ctx = void> {
  /** Build the initial state from explicit input; never reads external mutable state. */
  initial(input: Ctx): S
  /** (state, event) -> (next state, effects). Illegal transitions return { state, effects: [] }. */
  transition(state: S, event: E): Transition<S, Eff>
  /** Terminal predicate; the interpreter stops feeding events once true. */
  isTerminal(state: S): boolean
}

/** Convenience builders for the common transition shapes. */
export function stay<S, Eff>(state: S): Transition<S, Eff> {
  return { state, effects: [] }
}

export function next<S, Eff>(state: S, effects: readonly Eff[] = []): Transition<S, Eff> {
  return { state, effects }
}
