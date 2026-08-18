import type { NormalizedAudioFeatures } from './audioFeatures'

export type NormalizableFeature = keyof NormalizedAudioFeatures

const FEATURE_NAMES: NormalizableFeature[] = [
  'subBass',
  'bass',
  'lowMid',
  'mid',
  'highMid',
  'brilliance',
  'rms',
  'centroid',
  'flux',
  'rolloff',
]

const DEFAULT_CEILING: Record<NormalizableFeature, number> = {
  subBass: 0.16,
  bass: 0.16,
  lowMid: 0.16,
  mid: 0.16,
  highMid: 0.14,
  brilliance: 0.12,
  rms: 0.18,
  centroid: 0.42,
  flux: 0.018,
  rolloff: 0.55,
}

const MIN_SPAN: Record<NormalizableFeature, number> = {
  subBass: 0.035,
  bass: 0.035,
  lowMid: 0.035,
  mid: 0.035,
  highMid: 0.03,
  brilliance: 0.025,
  rms: 0.035,
  centroid: 0.08,
  flux: 0.006,
  rolloff: 0.08,
}

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value))
}

function percentile(sorted: number[], fraction: number): number {
  if (sorted.length === 0) return 0
  const position = (sorted.length - 1) * fraction
  const lo = Math.floor(position)
  const hi = Math.ceil(position)
  const mix = position - lo
  return sorted[lo] + (sorted[hi] - sorted[lo]) * mix
}

/** Rolling P10/P95 normalization sampled at 8 Hz over the last two minutes. */
export class AdaptiveFeatureNormalizer {
  private readonly samples = new Map<NormalizableFeature, number[]>()
  private readonly lower = new Map<NormalizableFeature, number>()
  private readonly upper = new Map<NormalizableFeature, number>()
  private sampleClock = 0
  private readonly samplePeriod = 0.125
  private readonly maxSamples = 960

  constructor() {
    this.reset()
  }

  reset(): void {
    this.sampleClock = this.samplePeriod
    for (const name of FEATURE_NAMES) {
      this.samples.set(name, [])
      this.lower.set(name, 0)
      this.upper.set(name, DEFAULT_CEILING[name])
    }
  }

  update(
    input: Readonly<Record<NormalizableFeature, number>>,
    output: NormalizedAudioFeatures,
    deltaSeconds: number,
  ): void {
    this.sampleClock += Math.max(0, Math.min(deltaSeconds, 0.25))
    if (this.sampleClock >= this.samplePeriod) {
      this.sampleClock %= this.samplePeriod
      for (const name of FEATURE_NAMES) {
        const values = this.samples.get(name)!
        values.push(Math.max(0, input[name]))
        if (values.length > this.maxSamples) values.shift()

        const sorted = [...values].sort((a, b) => a - b)
        const warmingUp = sorted.length < 24
        const p10 = warmingUp ? 0 : percentile(sorted, 0.10)
        const p95 = percentile(sorted, 0.95)
        this.lower.set(name, p10)
        this.upper.set(
          name,
          warmingUp
            ? Math.max(DEFAULT_CEILING[name], p95)
            : Math.max(p10 + MIN_SPAN[name], p95),
        )
      }
    }

    for (const name of FEATURE_NAMES) {
      const lo = this.lower.get(name) ?? 0
      const hi = this.upper.get(name) ?? DEFAULT_CEILING[name]
      output[name] = clamp01((input[name] - lo) / Math.max(MIN_SPAN[name], hi - lo))
    }
  }
}
