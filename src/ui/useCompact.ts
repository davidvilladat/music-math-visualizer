import { useEffect, useState } from 'react'

/** Phones in either orientation, and narrow desktop windows. */
export const COMPACT_QUERY = '(max-width: 760px), (max-height: 500px)'

export function useCompact(): boolean {
  const [compact, setCompact] = useState(() => window.matchMedia?.(COMPACT_QUERY).matches ?? false)

  useEffect(() => {
    const mql = window.matchMedia?.(COMPACT_QUERY)
    if (!mql) return
    const onChange = () => setCompact(mql.matches)
    onChange()
    mql.addEventListener('change', onChange)
    return () => mql.removeEventListener('change', onChange)
  }, [])

  return compact
}
