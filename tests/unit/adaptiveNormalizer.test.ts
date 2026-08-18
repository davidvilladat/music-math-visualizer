import { describe, expect, it } from 'vitest'
import { AdaptiveFeatureNormalizer } from '../../src/audio/adaptiveNormalizer'
import { makeNormalizedAudioFeatures, type NormalizedAudioFeatures } from '../../src/audio/audioFeatures'

function frame(level: number): NormalizedAudioFeatures {
  return {
    subBass: level,
    bass: level,
    lowMid: level,
    mid: level,
    highMid: level,
    brilliance: level,
    rms: level,
    centroid: level,
    flux: level,
    rolloff: level,
  }
}

describe('AdaptiveFeatureNormalizer', () => {
  it('maps differently mastered versions of the same envelope similarly', () => {
    const quiet = new AdaptiveFeatureNormalizer()
    const loud = new AdaptiveFeatureNormalizer()
    const quietOut = makeNormalizedAudioFeatures()
    const loudOut = makeNormalizedAudioFeatures()

    for (let i = 0; i < 120; i++) {
      const shape = 0.2 + 0.8 * (i % 20) / 19
      quiet.update(frame(shape * 0.10), quietOut, 0.125)
      loud.update(frame(shape * 0.50), loudOut, 0.125)
    }

    expect(quietOut.bass).toBeGreaterThan(0.9)
    expect(loudOut.bass).toBeGreaterThan(0.9)
    expect(Math.abs(quietOut.bass - loudOut.bass)).toBeLessThan(0.08)
  })

  it('resets the learned range between tracks', () => {
    const normalizer = new AdaptiveFeatureNormalizer()
    const out = makeNormalizedAudioFeatures()
    for (let i = 0; i < 40; i++) normalizer.update(frame(0.8), out, 0.125)
    normalizer.reset()
    normalizer.update(frame(0.08), out, 0.125)
    expect(out.bass).toBeGreaterThan(0.45)
    expect(out.bass).toBeLessThan(0.6)
  })
})
