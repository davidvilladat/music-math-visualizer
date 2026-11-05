import { useEffect } from 'react'

/**
 * Hold a screen wake lock while `active`. The browser drops the lock whenever
 * the page is hidden, so it is taken again each time the page comes back.
 * Browsers without the API (iOS before 16.4) simply let the screen sleep.
 */
export function useWakeLock(active: boolean): void {
  useEffect(() => {
    if (!active || !('wakeLock' in navigator)) return

    let sentinel: WakeLockSentinel | null = null
    let cancelled = false

    const acquire = async () => {
      if (document.visibilityState !== 'visible' || sentinel) return
      try {
        const lock = await navigator.wakeLock.request('screen')
        if (cancelled) {
          void lock.release()
          return
        }
        sentinel = lock
        lock.addEventListener('release', () => {
          if (sentinel === lock) sentinel = null
        })
      } catch {
        // Denied (low battery, no user gesture yet): the screen just sleeps.
      }
    }

    const onVisibility = () => void acquire()
    void acquire()
    document.addEventListener('visibilitychange', onVisibility)

    return () => {
      cancelled = true
      document.removeEventListener('visibilitychange', onVisibility)
      void sentinel?.release()
      sentinel = null
    }
  }, [active])
}
