import { describe, expect, it } from 'vitest'
import { SectionDetector, TransientDetector } from '../../src/audio/musicalEvents'

describe('TransientDetector', () => {
  it('separates a low-frequency onset into the kick channel', () => {
    const detector = new TransientDetector()
    let now = 0
    for (let i = 0; i < 10; i++) {
      detector.update({ kick: 0.001, snare: 0.001, hat: 0.001 }, now, 1 / 60)
      now += 1000 / 60
    }
    const event = detector.update({ kick: 0.03, snare: 0.001, hat: 0.001 }, now, 1 / 60)
    expect(event.kick).toBe(1)
    expect(event.snare).toBe(0)
    expect(event.hat).toBe(0)
  })

  it('decays pulses instead of leaving a permanent visual offset', () => {
    const detector = new TransientDetector()
    let now = 0
    for (let i = 0; i < 10; i++, now += 20) {
      detector.update({ kick: 0.001, snare: 0.001, hat: 0.001 }, now, 0.02)
    }
    detector.update({ kick: 0.03, snare: 0.001, hat: 0.001 }, now, 0.02)
    let result = detector.update({ kick: 0.001, snare: 0.001, hat: 0.001 }, now + 20, 0.02)
    for (let i = 0; i < 30; i++) {
      result = detector.update({ kick: 0.001, snare: 0.001, hat: 0.001 }, now + 40 + i * 20, 0.02)
    }
    expect(result.kick).toBeLessThan(0.01)
  })
})

describe('SectionDetector', () => {
  it('fires once when the sustained timbre changes substantially', () => {
    const detector = new SectionDetector()
    const calm = { rms: 0.15, bass: 0.2, mid: 0.2, high: 0.1, centroid: 0.2, onsetDensity: 0.1 }
    const chorus = { rms: 0.95, bass: 0.9, mid: 0.8, high: 0.85, centroid: 0.75, onsetDensity: 0.9 }
    for (let i = 0; i < 100; i++) detector.update(calm, 0.1)

    let peak = 0
    let index = 0
    for (let i = 0; i < 50; i++) {
      const result = detector.update(chorus, 0.1)
      peak = Math.max(peak, result.pulse)
      index = result.index
    }
    expect(peak).toBe(1)
    expect(index).toBe(1)
  })
})
