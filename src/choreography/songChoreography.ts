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
  reactivity: ReactivityMode
  progress: number
  energy: number
}

export type ChoreographyFeatures = Pick<
  AudioFeatures,
  'sectionEnergy' | 'sectionNovelty' | 'onsetDensity' | 'downbeatPulse' | 'barPhase' | 'bpmConfidence' | 'normalized'
>

export const HUTCHULA_CHOREOGRAPHY: SongChoreography = {
  id: 'hutchula-lorenz-trefoil',
  title: 'Hutchula',
  artist: 'Sébastien Léger',
  url: 'https://soundcloud.com/sebastienleger/hutchula',
  durationMs: 491_000,
  acts: [
    { start: 0.00, mode: 'lorenz',  reactivity: 'subtle',   label: 'Emergence' },
    { start: 0.14, mode: 'mira',    reactivity: 'balanced', label: 'Current' },
    { start: 0.30, mode: 'nacre',   reactivity: 'subtle',   label: 'Suspension' },
    { start: 0.47, mode: 'tandem',  reactivity: 'intense',  label: 'Convergence' },
    { start: 0.65, mode: 'triad',   reactivity: 'balanced', label: 'Lift' },
    { start: 0.82, mode: 'trefoil', reactivity: 'intense',  label: 'Resolution' },
  ],
}

const REACTIVITY_ORDER: readonly ReactivityMode[] = [
  'steady',
  'subtle',
  'balanced',
  'intense',
  'frenetic',
]

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

function sensitivityFor(base: ReactivityMode, energy: number): ReactivityMode {
  const baseIndex = REACTIVITY_ORDER.indexOf(base)
  const shift = energy > 0.76 ? 1 : energy < 0.24 ? -1 : 0
  return REACTIVITY_ORDER[Math.max(0, Math.min(REACTIVITY_ORDER.length - 1, baseIndex + shift))]
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
  private lastReactivityChangeMs = -Infinity

  constructor(private readonly choreography: SongChoreography) {}

  reset(): void {
    this.currentAct = -1
    this.pendingAct = -1
    this.pendingSinceMs = 0
    this.currentReactivity = 'balanced'
    this.lastReactivityChangeMs = -Infinity
  }

  update(positionMs: number, durationMs: number, features: ChoreographyFeatures): ChoreographyFrame {
    const duration = durationMs > 0 ? durationMs : this.choreography.durationMs
    const progress = clamp01(positionMs / Math.max(1, duration))
    const desiredAct = actIndexAt(this.choreography.acts, progress)

    if (this.currentAct < 0) {
      this.currentAct = desiredAct
      this.currentReactivity = this.choreography.acts[desiredAct].reactivity
    } else if (desiredAct !== this.currentAct) {
      if (desiredAct !== this.pendingAct) {
        this.pendingAct = desiredAct
        this.pendingSinceMs = positionMs
      }
      const waitedLongEnough = Math.abs(positionMs - this.pendingSinceMs) >= 3_000
      const musicalBoundary = features.downbeatPulse > 0.22
        || (features.bpmConfidence > 0.25 && features.barPhase < 0.08)
      if (musicalBoundary || waitedLongEnough || features.bpmConfidence <= 0.25) {
        this.currentAct = desiredAct
        this.pendingAct = -1
      }
    } else {
      this.pendingAct = -1
    }

    const rms = features.normalized.rms
    const energy = clamp01(
      features.sectionEnergy * 0.48
        + rms * 0.22
        + features.onsetDensity * 0.18
        + features.sectionNovelty * 0.12,
    )
    const act = this.choreography.acts[this.currentAct]
    const desiredReactivity = sensitivityFor(act.reactivity, energy)
    const atBarBoundary = features.bpmConfidence <= 0.25
      || features.downbeatPulse > 0.22
      || features.barPhase < 0.08
    const canChangeReactivity = Math.abs(positionMs - this.lastReactivityChangeMs) >= 8_000
    if (desiredReactivity !== this.currentReactivity && atBarBoundary && canChangeReactivity) {
      this.currentReactivity = desiredReactivity
      this.lastReactivityChangeMs = positionMs
    }

    return {
      actIndex: this.currentAct,
      act,
      reactivity: this.currentReactivity,
      progress,
      energy,
    }
  }
}
