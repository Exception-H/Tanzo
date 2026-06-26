import { describe, expect, it } from 'vitest'
import {
  createDepthPools,
  createKeyedSemaphores,
  createSemaphore
} from '@main/agent/runtime/concurrency'

describe('main/agent/concurrency', () => {
  it('queues semaphore acquisitions until a release is called', async () => {
    const semaphore = createSemaphore(1)
    const releaseFirst = await semaphore.acquire()

    let acquiredSecond = false
    const second = semaphore.acquire().then((release) => {
      acquiredSecond = true
      return release
    })

    await Promise.resolve()
    expect(acquiredSecond).toBe(false)

    releaseFirst()
    const releaseSecond = await second
    expect(acquiredSecond).toBe(true)
    releaseSecond()
  })

  it('keeps depth pools independent', async () => {
    const pools = createDepthPools(1)
    const releaseDepthOne = await pools.acquire(1)

    let sameDepthAcquired = false
    const sameDepth = pools.acquire(1).then((release) => {
      sameDepthAcquired = true
      return release
    })
    const releaseDepthTwo = await pools.acquire(2)

    await Promise.resolve()
    expect(sameDepthAcquired).toBe(false)

    releaseDepthTwo()
    releaseDepthOne()
    const releaseSameDepth = await sameDepth
    expect(sameDepthAcquired).toBe(true)
    releaseSameDepth()
  })

  it('caps each key independently and isolates keys from each other', async () => {
    const pools = createKeyedSemaphores(1)
    const releaseA = await pools.acquire('root-a')

    let sameKeyAcquired = false
    const sameKey = pools.acquire('root-a').then((release) => {
      sameKeyAcquired = true
      return release
    })
    // A different key has its own pool and is not blocked by root-a.
    const releaseB = await pools.acquire('root-b')

    await Promise.resolve()
    expect(sameKeyAcquired).toBe(false)

    releaseB()
    releaseA()
    const releaseSameKey = await sameKey
    expect(sameKeyAcquired).toBe(true)
    releaseSameKey()
  })

  it('reuses a key pool while in flight and frees the same key after release', async () => {
    const pools = createKeyedSemaphores(1)
    const first = await pools.acquire('root')
    first()
    // After full release the pool is evicted, so the key starts fresh and the
    // next acquisition succeeds immediately rather than queueing.
    let secondAcquired = false
    await pools.acquire('root').then((release) => {
      secondAcquired = true
      release()
    })
    expect(secondAcquired).toBe(true)
  })

  it('is reentrant per key up to the cap and queues beyond it', async () => {
    const pools = createKeyedSemaphores(2)
    const r1 = await pools.acquire('root')
    const r2 = await pools.acquire('root')

    let thirdAcquired = false
    const third = pools.acquire('root').then((release) => {
      thirdAcquired = true
      return release
    })
    await Promise.resolve()
    expect(thirdAcquired).toBe(false)

    r1()
    const r3 = await third
    expect(thirdAcquired).toBe(true)
    r2()
    r3()
  })
})
