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
  private beatTimes: number[] = []
  private lastBeatTime = 0
  private pulse = 0
  private bpmEstimate: number | null = null
  private bpmConfidenceValue = 0

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
      this.recordBeat(now)
    } else {
      this.pulse *= Math.exp(-this.params.decayRate * deltaSeconds)
    }

    return this.pulse
  }

  private recordBeat(now: number): void {
    this.beatTimes.push(now)
    const cutoff = now - 12_000
    while (this.beatTimes.length > 0 && this.beatTimes[0] < cutoff) {
      this.beatTimes.shift()
    }

    const intervals: number[] = []
    for (let i = 1; i < this.beatTimes.length; i++) {
      const interval = this.beatTimes[i] - this.beatTimes[i - 1]
      if (interval >= 333 && interval <= 1000) intervals.push(interval)
    }

    if (intervals.length < 3) {
      this.bpmConfidenceValue *= 0.92
      return
    }

    const sorted = [...intervals].sort((a, b) => a - b)
    const median = sorted[Math.floor(sorted.length / 2)]
    // Fold into a single octave. The interval filter admits 60-180 BPM, so a
    // track whose eighths read as beats lands at double tempo and halves every
    // rate derived from it; folding removes that whiplash without needing to
    // decide which reading is "right".
    // Closed form rather than a doubling loop: bpm is derived from runtime
    // timing, and a bare `while` here would lean on the interval filter above to
    // terminate -- widen that filter to admit a zero interval and the loop hangs
    // the frame. This always terminates whatever the input.
    const FOLD_LOW = 85
    const raw = 60_000 / median
    const bpm = raw / Math.pow(2, Math.floor(Math.log2(raw / FOLD_LOW)))
    const meanDeviation = intervals.reduce((sum, interval) => sum + Math.abs(interval - median), 0) / intervals.length
    const consistency = Math.max(0, 1 - meanDeviation / median)
    const sampleConfidence = Math.min(1, intervals.length / 8)
    const confidence = consistency * sampleConfidence

    this.bpmEstimate = this.bpmEstimate === null
      ? bpm
      : this.bpmEstimate + (bpm - this.bpmEstimate) * 0.18
    this.bpmConfidenceValue = this.bpmConfidenceValue + (confidence - this.bpmConfidenceValue) * 0.25
  }

  get lastBeat(): number { return this.lastBeatTime }
  get currentPulse(): number { return this.pulse }
  get bpm(): number | null { return this.bpmConfidenceValue > 0.25 ? this.bpmEstimate : null }
  get bpmConfidence(): number { return this.bpmConfidenceValue }
}
