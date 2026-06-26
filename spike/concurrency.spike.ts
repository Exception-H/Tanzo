import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createDepthPools, createSemaphore } from '../src/main/agent/concurrency'

const tick = (): Promise<void> => new Promise((r) => setTimeout(r, 0))

test('createSemaphore — caps concurrency and hands off to waiters in FIFO', async () => {
  const sem = createSemaphore(2)
  const r1 = await sem.acquire()
  const r2 = await sem.acquire()
  let third = false
  const p3 = sem.acquire().then((r) => {
    third = true
    return r
  })
  await tick()
  assert.equal(third, false, 'third acquire blocks while 2 held')
  r1()
  const r3 = await p3
  assert.equal(third, true, 'release wakes the waiter')
  r2()
  r3()
})

test('createDepthPools — deadlock scenario from the design doc resolves', async () => {
  const pools = createDepthPools(5)

  async function child(): Promise<void> {
    const release = await pools.acquire(2)
    await tick()
    release()
  }

  async function parent(): Promise<void> {
    const release = await pools.acquire(1)

    await child()
    release()
  }

  const all = Promise.all(Array.from({ length: 5 }, () => parent()))
  const result = await Promise.race([
    all.then(() => 'done'),
    new Promise((r) => setTimeout(() => r('timeout'), 1000))
  ])
  assert.equal(result, 'done', 'depth-partitioned pools drain without deadlock')
})

test('createDepthPools — each depth enforces its own cap independently', async () => {
  const pools = createDepthPools(1)
  const d1a = await pools.acquire(1)

  let d1bGot = false
  const d1b = pools.acquire(1).then((r) => {
    d1bGot = true
    return r
  })

  const d2 = await pools.acquire(2)
  await tick()
  assert.equal(d1bGot, false, 'depth 1 still capped at 1')
  d2()
  d1a()
  ;(await d1b)()
})
