import type { AudioFeatures } from '../audio/audioFeatures'
import type { FormulaMode, ReactivityMode } from '../visualModes'

export interface ChoreographyAct {
  start: number // normalized position through the track
  mode: FormulaMode
  reactivity: ReactivityMode
  label: string
}

export interface SongChoreography {
  id: string
  title: string
  artist: string
  url: string
  durationMs: number
  acts: readonly ChoreographyAct[]
}

export interface ChoreographyFrame {
  actIndex: number
  act: ChoreographyAct
  nextAct: ChoreographyAct | null
  reactivity: ReactivityMode
  progress: number
  actProgress: number
  energy: number
}

export type ChoreographyFeatures = Pick<
  AudioFeatures,
  | 'sectionEnergy'
  | 'sectionPulse'
  | 'sectionNovelty'
  | 'onsetDensity'
  | 'downbeatPulse'
  | 'barPhase'
  | 'bpmConfidence'
  | 'normalized'
>

export const HUTCHULA_CHOREOGRAPHY: SongChoreography = {
  id: 'hutchula-lorenz-trefoil',
  title: 'Hutchula',
  artist: 'Sébastien Léger',
  url: 'https://soundcloud.com/sebastienleger/hutchula',
  durationMs: 491_000,
  acts: [
    { start: 0.00, mode: 'lorenz',  reactivity: 'steady',   label: 'Emergence' },
    { start: 0.07, mode: 'lorenz',  reactivity: 'intense',  label: 'Ignition' },
    { start: 0.14, mode: 'mira',    reactivity: 'subtle',   label: 'Drift' },
    { start: 0.22, mode: 'mira',    reactivity: 'intense',  label: 'Current' },
    { start: 0.30, mode: 'nacre',   reactivity: 'steady',   label: 'Suspension' },
    { start: 0.39, mode: 'nacre',   reactivity: 'balanced', label: 'Pearlescence' },
    { start: 0.47, mode: 'tandem',  reactivity: 'balanced', label: 'Convergence' },
    { start: 0.56, mode: 'tandem',  reactivity: 'frenetic', label: 'Drive' },
    { start: 0.65, mode: 'triad',   reactivity: 'subtle',   label: 'Lift' },
    { start: 0.74, mode: 'triad',   reactivity: 'intense',  label: 'Ascent' },
    { start: 0.82, mode: 'trefoil', reactivity: 'balanced', label: 'Resolution' },
    { start: 0.91, mode: 'trefoil', reactivity: 'frenetic', label: 'Finale' },
  ],
}

const REACTIVITY_ORDER: readonly ReactivityMode[] = [
  'steady',
  'subtle',
  'balanced',
  'intense',
  'frenetic',
]

/** A due cut waits this long for a downbeat before it lands unaligned. */
const MAX_HOLD_MS = 3_000
/** A cut may also land this far ahead of schedule. See the guard in update(). */
const LEAD_IN_MS = 2_500
const DOWNBEAT_LEVEL = 0.22
const SECTION_CUT_LEVEL = 0.5
const REACTIVITY_HOLD_MS = 8_000

// Asymmetric thresholds: entering a shift takes more than holding one, so
// energy sitting on a threshold cannot oscillate the whole visual.
const RAISE_AT = 0.76
const HOLD_RAISE_AT = 0.62
const LOWER_AT = 0.24
const HOLD_LOWER_AT = 0.38

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value))
}

function actIndexAt(acts: readonly ChoreographyAct[], progress: number): number {
  let result = 0
  for (let i = 1; i < acts.length; i++) {
    if (progress < acts[i].start) break
    result = i
  }
  return result
}

function shiftFor(energy: number, current: number): number {
  if (current > 0) return energy >= HOLD_RAISE_AT ? 1 : energy <= LOWER_AT ? -1 : 0
  if (current < 0) return energy <= HOLD_LOWER_AT ? -1 : energy >= RAISE_AT ? 1 : 0
  return energy >= RAISE_AT ? 1 : energy <= LOWER_AT ? -1 : 0
}

function shifted(base: ReactivityMode, shift: number): ReactivityMode {
  const index = REACTIVITY_ORDER.indexOf(base) + shift
  return REACTIVITY_ORDER[Math.max(0, Math.min(REACTIVITY_ORDER.length - 1, index))]
}

/**
 * Timeline sets the narrative; detected musical events decide when changes land.
 * This keeps the show repeatable while avoiding cuts in the middle of a phrase.
 */
export class SongChoreographer {
  private currentAct = -1
  private pendingAct = -1
  private pendingSinceMs = 0
  private currentReactivity: ReactivityMode = 'balanced'
  private currentShift = 0
  private lastReactivityChangeMs = -Infinity

  constructor(private readonly choreography: SongChoreography) {}

  reset(): void {
    this.currentAct = -1
    this.pendingAct = -1
    this.pendingSinceMs = 0
    this.currentReactivity = 'balanced'
    this.currentShift = 0
    this.lastReactivityChangeMs = -Infinity
  }

  update(positionMs: number, durationMs: number, features: ChoreographyFeatures): ChoreographyFrame {
    const acts = this.choreography.acts
    const duration = durationMs > 0 ? durationMs : this.choreography.durationMs
    const progress = clamp01(positionMs / Math.max(1, duration))
    const desiredAct = actIndexAt(acts, progress)

    const sectionChange = features.sectionPulse >= SECTION_CUT_LEVEL
    const downbeat = features.downbeatPulse > DOWNBEAT_LEVEL
      || (features.bpmConfidence > 0.25 && features.barPhase < 0.08)
    const tempoUnknown = features.bpmConfidence <= 0.25

    if (this.currentAct < 0) {
      this.enterAct(desiredAct, positionMs)
    } else if (desiredAct !== this.currentAct) {
      if (desiredAct !== this.pendingAct) {
        this.pendingAct = desiredAct
        this.pendingSinceMs = positionMs
      }
      const heldLongEnough = Math.abs(positionMs - this.pendingSinceMs) >= MAX_HOLD_MS
      if (downbeat || sectionChange || heldLongEnough || tempoUnknown) {
        this.enterAct(desiredAct, positionMs)
      }
    } else {
      this.pendingAct = -1
      // A cut may also land early, but only where the track itself changes
      // section. Downbeats arrive every bar, so accepting one here would drag
      // every boundary forward by the whole lead-in and lose the authored timing.
      const next = this.currentAct + 1
      if (sectionChange && next < acts.length) {
        const untilNext = acts[next].start * duration - positionMs
        if (untilNext > 0 && untilNext <= LEAD_IN_MS) this.enterAct(next, positionMs)
      }
    }

    const energy = clamp01(
      features.sectionEnergy * 0.48
        + features.normalized.rms * 0.22
        + features.onsetDensity * 0.18
        + features.sectionNovelty * 0.12,
    )
    const act = acts[this.currentAct]
    const desiredShift = shiftFor(energy, this.currentShift)
    const atBoundary = tempoUnknown || downbeat || features.barPhase < 0.08
    const canChange = Math.abs(positionMs - this.lastReactivityChangeMs) >= REACTIVITY_HOLD_MS
    if (desiredShift !== this.currentShift && atBoundary && canChange) {
      this.currentShift = desiredShift
      this.currentReactivity = shifted(act.reactivity, desiredShift)
      this.lastReactivityChangeMs = positionMs
    }

    const nextAct = this.currentAct + 1 < acts.length ? acts[this.currentAct + 1] : null
    const actEnd = nextAct ? nextAct.start : 1
    const actProgress = clamp01((progress - act.start) / Math.max(1e-6, actEnd - act.start))

    return {
      actIndex: this.currentAct,
      act,
      nextAct,
      reactivity: this.currentReactivity,
      progress,
      actProgress,
      energy,
    }
  }

  private enterAct(index: number, positionMs: number): void {
    this.currentAct = index
    this.pendingAct = -1
    // Every act gets to establish its authored sensitivity before the live
    // energy layer is allowed to move it one step in either direction.
    this.currentShift = 0
    this.currentReactivity = this.choreography.acts[index].reactivity
    this.lastReactivityChangeMs = positionMs
  }
}
