export interface SignalQueue {
  signal(): void
  close(): void
  next(): Promise<boolean>
}

export function createSignalQueue(): SignalQueue {
  let ready = false
  let closed = false
  let wake: (() => void) | null = null

  const flushWake = (): void => {
    const resume = wake
    wake = null
    resume?.()
  }

  return {
    signal() {
      ready = true
      flushWake()
    },
    close() {
      closed = true
      flushWake()
    },
    async next() {
      for (;;) {
        if (ready) {
          ready = false
          return true
        }
        if (closed) return false
        await new Promise<void>((resolve) => {
          wake = resolve
        })
      }
    }
  }
}
