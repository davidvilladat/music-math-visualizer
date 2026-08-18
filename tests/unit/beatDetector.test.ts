import { describe, expect, it } from 'vitest'
import { BeatDetector } from '../../src/audio/beatDetector'

const FRAME_MS = 1000 / 60
const FRAME_S = 1 / 60

// Drives the detector at 60fps with a quiet floor and a flux spike every
// `intervalMs`, which is the only shape it treats as a beat.
function runAtInterval(intervalMs: number, beats: number): BeatDetector {
  const detector = new BeatDetector()
  const framesPerBeat = Math.round(intervalMs / FRAME_MS)
  const totalFrames = framesPerBeat * beats
  for (let frame = 0; frame <= totalFrames; frame++) {
    const flux = frame % framesPerBeat === 0 ? 1 : 0.1
    detector.update(flux, frame * FRAME_MS, FRAME_S)
  }
  return detector
}

describe('BeatDetector tempo estimate', () => {
  it('reports the tempo of a steady pulse', () => {
    const detector = runAtInterval(500, 12)
    expect(detector.bpmConfidence).toBeGreaterThan(0.25)
    expect(detector.bpm).toBeCloseTo(120, 0)
  })

  it('folds a half-time reading up into the working octave', () => {
    // 1000ms between beats is 60 BPM, which the fold doubles to 120 so every
    // rate derived from it stays comparable to a 120 BPM track.
    const detector = runAtInterval(1000, 12)
    expect(detector.bpm).toBeCloseTo(120, 0)
  })

  it('folds a double-time reading back down into the working octave', () => {
    // 333ms is 180 BPM, the fastest the interval filter admits; halved it is 90.
    const detector = runAtInterval(333, 14)
    expect(detector.bpm).toBeCloseTo(90, 0)
  })

  it('leaves a tempo already inside the octave alone', () => {
    const detector = runAtInterval(400, 12)
    expect(detector.bpm).toBeCloseTo(150, 0)
  })

  it('reports no tempo until it has seen enough consistent beats', () => {
    expect(runAtInterval(500, 2).bpm).toBeNull()
  })
})
