'use client'

import { useCallback, useRef, useSyncExternalStore } from 'react'

function subscribe(key: string) {
  return (cb: () => void) => {
    const handler = (e: StorageEvent) => {
      if (e.key === key || e.key === null) cb()
    }
    window.addEventListener('storage', handler)
    return () => window.removeEventListener('storage', handler)
  }
}

export function useLocalStorage<T>(key: string, initial: T) {
  const cacheRef = useRef<{ raw: string | null; parsed: T } | null>(null)

  const getSnapshot = useCallback((): T => {
    try {
      const raw = window.localStorage.getItem(key)
      const cached = cacheRef.current
      if (cached && cached.raw === raw) return cached.parsed
      const parsed = raw === null ? initial : (JSON.parse(raw) as T)
      cacheRef.current = { raw, parsed }
      return parsed
    } catch {
      return initial
    }
  }, [key, initial])

  const getServerSnapshot = useCallback(() => initial, [initial])

  const value = useSyncExternalStore(
    subscribe(key),
    getSnapshot,
    getServerSnapshot,
  )

  const setValue = useCallback(
    (next: T | ((prev: T) => T)) => {
      const resolved =
        typeof next === 'function' ? (next as (p: T) => T)(value) : next
      try {
        window.localStorage.setItem(key, JSON.stringify(resolved))
        window.dispatchEvent(new StorageEvent('storage', { key }))
      } catch {
        // ignore quota / access errors
      }
    },
    [key, value],
  )

  return [value, setValue] as const
}
