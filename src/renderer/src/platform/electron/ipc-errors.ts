import { decodeIpcError } from '@shared/errors'

const wrappedApis = new WeakMap<object, object>()

export function withDecodedIpcError<F extends (...args: never[]) => unknown>(fn: F): F {
  return ((...args: Parameters<F>) => {
    const result = fn(...args)
    return result instanceof Promise
      ? result.catch((error) => {
          throw decodeIpcError(error) ?? error
        })
      : result
  }) as F
}

export function withDecodedIpcErrors<T extends object>(api: T): T {
  const cached = wrappedApis.get(api)
  if (cached) return cached as T
  const wrapped = Object.fromEntries(
    Object.entries(api).map(([key, value]) => [
      key,
      typeof value === 'function'
        ? withDecodedIpcError(value as (...args: never[]) => unknown)
        : value
    ])
  ) as T
  wrappedApis.set(api, wrapped)
  return wrapped
}
