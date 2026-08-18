import { describe, expect, it } from 'vitest'
import { makeAudioFeatures } from '../../src/audio/audioFeatures'
import {
  HUTCHULA_CHOREOGRAPHY,
  SongChoreographer,
} from '../../src/choreography/songChoreography'

function features() {
  const value = makeAudioFeatures()
  value.bpmConfidence = 0
  value.sectionEnergy = 0.5
  value.normalized.rms = 0.5
  value.onsetDensity = 0.4
  return value
}

describe('Hutchula choreography', () => {
  it('runs calm and peak acts for every formula from Lorenz to Trefoil', () => {
    const conductor = new SongChoreographer(HUTCHULA_CHOREOGRAPHY)
    const f = features()
    const modes = HUTCHULA_CHOREOGRAPHY.acts.map((act) => {
      const position = (act.start + 0.001) * HUTCHULA_CHOREOGRAPHY.durationMs
      return conductor.update(position, HUTCHULA_CHOREOGRAPHY.durationMs, f).act.mode
    })
    expect(modes).toEqual([
      'lorenz', 'lorenz',
      'mira', 'mira',
      'nacre', 'nacre',
      'tandem', 'tandem',
      'triad', 'triad',
      'trefoil', 'trefoil',
    ])
    expect(HUTCHULA_CHOREOGRAPHY.acts.map((act) => act.reactivity)).toEqual([
      'steady', 'intense',
      'subtle', 'intense',
      'steady', 'balanced',
      'balanced', 'frenetic',
      'subtle', 'intense',
      'balanced', 'frenetic',
    ])
  })

  it('holds a visual transition for a musical boundary when tempo is locked', () => {
    const conductor = new SongChoreographer(HUTCHULA_CHOREOGRAPHY)
    const f = features()
    f.bpmConfidence = 0.9
    f.barPhase = 0.5
    conductor.update(0, HUTCHULA_CHOREOGRAPHY.durationMs, f)

    const boundary = HUTCHULA_CHOREOGRAPHY.acts[1].start * HUTCHULA_CHOREOGRAPHY.durationMs
    expect(conductor.update(boundary + 500, HUTCHULA_CHOREOGRAPHY.durationMs, f).actIndex).toBe(0)
    f.downbeatPulse = 1
    const transitioned = conductor.update(boundary + 900, HUTCHULA_CHOREOGRAPHY.durationMs, f)
    expect(transitioned.actIndex).toBe(1)
    expect(transitioned.reactivity).toBe('intense')
  })

  it('raises or lowers an act sensitivity from live song energy', () => {
    const calm = features()
    calm.sectionEnergy = 0.02
    calm.normalized.rms = 0.02
    calm.onsetDensity = 0.02
    const calmFrame = new SongChoreographer(HUTCHULA_CHOREOGRAPHY)
      .update(0, HUTCHULA_CHOREOGRAPHY.durationMs, calm)
    expect(calmFrame.reactivity).toBe('steady')

    const peak = features()
    peak.sectionEnergy = 1
    peak.normalized.rms = 1
    peak.onsetDensity = 1
    peak.sectionNovelty = 1
    const peakFrame = new SongChoreographer(HUTCHULA_CHOREOGRAPHY)
      .update(0, HUTCHULA_CHOREOGRAPHY.durationMs, peak)
    // The authored act is guaranteed an eight-second entrance before live
    // energy is allowed to raise or lower it.
    expect(peakFrame.reactivity).toBe('steady')
    peak.downbeatPulse = 1
    const adaptedPeak = new SongChoreographer(HUTCHULA_CHOREOGRAPHY)
    adaptedPeak.update(0, HUTCHULA_CHOREOGRAPHY.durationMs, peak)
    expect(adaptedPeak.update(9_000, HUTCHULA_CHOREOGRAPHY.durationMs, peak).reactivity).toBe('subtle')
  })
  it('keeps the authored act order with strictly ascending starts', () => {
    const starts = HUTCHULA_CHOREOGRAPHY.acts.map((act) => act.start)
    expect(starts[0]).toBe(0)
    for (let i = 1; i < starts.length; i++) expect(starts[i]).toBeGreaterThan(starts[i - 1])
  })

  it('lands a cut early when the track changes section just before one is due', () => {
    const conductor = new SongChoreographer(HUTCHULA_CHOREOGRAPHY)
    const f = features()
    f.bpmConfidence = 0.9
    f.barPhase = 0.5
    conductor.update(0, HUTCHULA_CHOREOGRAPHY.durationMs, f)

    const boundary = HUTCHULA_CHOREOGRAPHY.acts[1].start * HUTCHULA_CHOREOGRAPHY.durationMs
    // A bar landing alone must not pull the cut forward, or every boundary
    // would drift earlier by the whole lead-in window.
    f.downbeatPulse = 1
    expect(conductor.update(boundary - 1_500, HUTCHULA_CHOREOGRAPHY.durationMs, f).actIndex).toBe(0)

    f.downbeatPulse = 0
    f.sectionPulse = 1
    expect(conductor.update(boundary - 1_200, HUTCHULA_CHOREOGRAPHY.durationMs, f).actIndex).toBe(1)
  })

  it('ignores a section change too far ahead of the next act', () => {
    const conductor = new SongChoreographer(HUTCHULA_CHOREOGRAPHY)
    const f = features()
    f.bpmConfidence = 0.9
    f.barPhase = 0.5
    f.sectionPulse = 1
    conductor.update(0, HUTCHULA_CHOREOGRAPHY.durationMs, f)

    const boundary = HUTCHULA_CHOREOGRAPHY.acts[1].start * HUTCHULA_CHOREOGRAPHY.durationMs
    expect(conductor.update(boundary - 9_000, HUTCHULA_CHOREOGRAPHY.durationMs, f).actIndex).toBe(0)
  })

  it('holds a raised sensitivity through a dip that never releases it', () => {
    const conductor = new SongChoreographer(HUTCHULA_CHOREOGRAPHY)
    const f = features()
    f.sectionEnergy = 1
    f.normalized.rms = 1
    f.onsetDensity = 1
    f.sectionNovelty = 1
    conductor.update(0, HUTCHULA_CHOREOGRAPHY.durationMs, f)
    expect(conductor.update(9_000, HUTCHULA_CHOREOGRAPHY.durationMs, f).reactivity).toBe('subtle')

    // 0.70 sits under the 0.76 needed to raise, but over the 0.62 hold level.
    f.sectionEnergy = 0.7
    f.normalized.rms = 0.7
    f.onsetDensity = 0.7
    f.sectionNovelty = 0.7
    expect(conductor.update(20_000, HUTCHULA_CHOREOGRAPHY.durationMs, f).reactivity).toBe('subtle')

    f.sectionEnergy = 0.1
    f.normalized.rms = 0.1
    f.onsetDensity = 0.1
    f.sectionNovelty = 0.1
    expect(conductor.update(31_000, HUTCHULA_CHOREOGRAPHY.durationMs, f).reactivity).toBe('steady')
  })
})
