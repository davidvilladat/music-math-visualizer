export type SourceTab = 'soundcloud' | 'spotify' | 'demo'
export type SourceKind = SourceTab

export type SourceState =
  | { status: 'idle'; initialTab: SourceTab }
  | { status: 'connecting'; source: SourceKind; initialTab: SourceTab }
  | { status: 'active'; source: SourceKind; isDemo: boolean }
  | { status: 'error'; source: SourceKind; initialTab: SourceTab; message: string }
  | { status: 'capture-ended'; initialTab: SourceTab; message: string }

export function isEntryState(state: SourceState): boolean {
  return state.status !== 'active'
}
