export interface BeatDetectorParams {
  windowSeconds: number   // rolling median window (default 2s)
  threshold: number       // multiplier over median (default 1.5)
  refractoryMs: number    // min ms between beats (default 200)
  decayRate: number       // beat pulse decay per second (default 8)
}

const DEFAULT_PARAMS: BeatDetectorParams = {
  windowSeconds: 2,
  threshold: 1.5,
  refractoryMs: 200,
  decayRate: 8,
}

export class BeatDetector {
  private params: BeatDetectorParams
  private history: number[] = []
  private lastBeatTime = 0
  private pulse = 0

  constructor(params: Partial<BeatDetectorParams> = {}) {
    this.params = { ...DEFAULT_PARAMS, ...params }
  }

  updateParams(params: Partial<BeatDetectorParams>): void {
    this.params = { ...this.params, ...params }
  }

  // returns updated beatPulse
  update(flux: number, now: number, deltaSeconds: number): number {
    const frameRate = 60
    const maxHistory = Math.round(this.params.windowSeconds * frameRate)
    this.history.push(flux)
    if (this.history.length > maxHistory) this.history.shift()

    const sorted = [...this.history].sort((a, b) => a - b)
    const median = sorted[Math.floor(sorted.length / 2)] ?? 0

    const elapsed = now - this.lastBeatTime
    if (
      flux > median * this.params.threshold &&
      elapsed > this.params.refractoryMs
    ) {
      this.lastBeatTime = now
      this.pulse = 1
    } else {
      this.pulse *= Math.exp(-this.params.decayRate * deltaSeconds)
    }

    return this.pulse
  }

  get lastBeat(): number { return this.lastBeatTime }
  get currentPulse(): number { return this.pulse }
}
