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
  it('runs through every formula from Lorenz to Trefoil', () => {
    const conductor = new SongChoreographer(HUTCHULA_CHOREOGRAPHY)
    const f = features()
    const modes = HUTCHULA_CHOREOGRAPHY.acts.map((act) => {
      const position = (act.start + 0.001) * HUTCHULA_CHOREOGRAPHY.durationMs
      return conductor.update(position, HUTCHULA_CHOREOGRAPHY.durationMs, f).act.mode
    })
    expect(modes).toEqual(['lorenz', 'mira', 'nacre', 'tandem', 'triad', 'trefoil'])
  })

  it('holds a visual transition for a musical boundary when tempo is locked', () => {
    const conductor = new SongChoreographer(HUTCHULA_CHOREOGRAPHY)
    const f = features()
    f.bpmConfidence = 0.9
    f.barPhase = 0.5
    conductor.update(0, HUTCHULA_CHOREOGRAPHY.durationMs, f)

    const boundary = HUTCHULA_CHOREOGRAPHY.acts[1].start * HUTCHULA_CHOREOGRAPHY.durationMs
    expect(conductor.update(boundary + 500, HUTCHULA_CHOREOGRAPHY.durationMs, f).act.mode).toBe('lorenz')
    f.downbeatPulse = 1
    expect(conductor.update(boundary + 900, HUTCHULA_CHOREOGRAPHY.durationMs, f).act.mode).toBe('mira')
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
    expect(peakFrame.reactivity).toBe('balanced')
  })
})
