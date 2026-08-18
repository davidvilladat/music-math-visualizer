export interface TransientFrame {
  kick: number
  snare: number
  hat: number
}

interface ChannelState {
  history: number[]
  pulse: number
  lastEvent: number
  refractoryMs: number
  decay: number
}

function median(values: number[]): number {
  if (values.length === 0) return 0
  const sorted = [...values].sort((a, b) => a - b)
  return sorted[Math.floor(sorted.length / 2)]
}

export class TransientDetector {
  private readonly channels: Record<keyof TransientFrame, ChannelState> = {
    kick: { history: [], pulse: 0, lastEvent: -Infinity, refractoryMs: 170, decay: 11 },
    snare: { history: [], pulse: 0, lastEvent: -Infinity, refractoryMs: 105, decay: 15 },
    hat: { history: [], pulse: 0, lastEvent: -Infinity, refractoryMs: 45, decay: 23 },
  }
  private onsetTimes: number[] = []

  reset(): void {
    this.onsetTimes = []
    for (const state of Object.values(this.channels)) {
      state.history = []
      state.pulse = 0
      state.lastEvent = -Infinity
    }
  }

  update(frame: TransientFrame, now: number, deltaSeconds: number): TransientFrame & { density: number } {
    let anyEvent = false
    const result = { kick: 0, snare: 0, hat: 0, density: 0 }

    for (const name of Object.keys(this.channels) as (keyof TransientFrame)[]) {
      const state = this.channels[name]
      const value = Math.max(0, frame[name])
      const baseline = median(state.history)
      const threshold = Math.max(0.0015, baseline * 2.15)
      const isEvent = state.history.length >= 6
        && value > threshold
        && now - state.lastEvent >= state.refractoryMs

      if (isEvent) {
        state.pulse = 1
        state.lastEvent = now
        anyEvent = true
      } else {
        state.pulse *= Math.exp(-state.decay * deltaSeconds)
      }

      state.history.push(value)
      if (state.history.length > 120) state.history.shift()
      result[name] = state.pulse
    }

    if (anyEvent) this.onsetTimes.push(now)
    const cutoff = now - 8_000
    while (this.onsetTimes.length > 0 && this.onsetTimes[0] < cutoff) this.onsetTimes.shift()
    result.density = Math.min(1, this.onsetTimes.length / 32)
    return result
  }
}

export interface SectionFrame {
  rms: number
  bass: number
  mid: number
  high: number
  centroid: number
  onsetDensity: number
}

/** Detects structural changes from divergence between fast and slow timbre averages. */
export class SectionDetector {
  private fast = new Float32Array(6)
  private slow = new Float32Array(6)
  private elapsed = 0
  private sinceChange = 0
  private pulse = 0
  private index = 0

  reset(): void {
    this.fast.fill(0)
    this.slow.fill(0)
    this.elapsed = 0
    this.sinceChange = 0
    this.pulse = 0
    this.index = 0
  }

  update(frame: SectionFrame, deltaSeconds: number): { pulse: number; novelty: number; index: number } {
    const dt = Math.max(0, Math.min(deltaSeconds, 0.25))
    const values = [frame.rms, frame.bass, frame.mid, frame.high, frame.centroid, frame.onsetDensity]
    const fastFollow = 1 - Math.exp(-dt / 1.8)
    const slowFollow = 1 - Math.exp(-dt / 11)

    if (this.elapsed === 0) {
      this.fast.set(values)
      this.slow.set(values)
    } else {
      for (let i = 0; i < values.length; i++) {
        this.fast[i] += (values[i] - this.fast[i]) * fastFollow
        this.slow[i] += (values[i] - this.slow[i]) * slowFollow
      }
    }

    this.elapsed += dt
    this.sinceChange += dt
    let distance = 0
    for (let i = 0; i < values.length; i++) {
      const delta = this.fast[i] - this.slow[i]
      distance += delta * delta
    }
    const novelty = Math.min(1, Math.sqrt(distance / values.length) * 2.6)

    if (this.elapsed > 8 && this.sinceChange > 6 && novelty > 0.42) {
      this.index++
      this.pulse = 1
      this.sinceChange = 0
      this.slow.set(this.fast)
    } else {
      this.pulse *= Math.exp(-dt * 2.4)
    }

    return { pulse: this.pulse, novelty, index: this.index }
  }
}
