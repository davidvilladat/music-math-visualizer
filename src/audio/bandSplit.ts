import { FFT_SIZE } from './audioFeatures'

// One-pole IIR smoother: y = α·x + (1-α)·y
export class OnePole {
  private y = 0
  private alpha: number

  constructor(tauSeconds: number, sampleRateHz = 60) {
    this.alpha = 1 - Math.exp(-1 / (tauSeconds * sampleRateHz))
  }

  setTau(tauSeconds: number, sampleRateHz = 60): void {
    this.alpha = 1 - Math.exp(-1 / (tauSeconds * sampleRateHz))
  }

  update(x: number): number {
    this.y = this.alpha * x + (1 - this.alpha) * this.y
    return this.y
  }

  get value(): number { return this.y }
}

export interface BandDef {
  lo: number // Hz
  hi: number // Hz
}

export const BANDS: Record<string, BandDef> = {
  subBass:   { lo: 20,   hi: 60   },
  bass:      { lo: 60,   hi: 250  },
  lowMid:    { lo: 250,  hi: 500  },
  mid:       { lo: 500,  hi: 2000 },
  highMid:   { lo: 2000, hi: 6000 },
  brilliance:{ lo: 6000, hi: 20000},
}

export function hzToBin(hz: number, sampleRate: number): number {
  return Math.round((hz / (sampleRate / 2)) * (FFT_SIZE / 2))
}

export function bandEnergy(
  data: Uint8Array<ArrayBuffer>,
  lo: number,
  hi: number,
  sampleRate: number
): number {
  const binLo = Math.max(0, hzToBin(lo, sampleRate))
  const binHi = Math.min(data.length - 1, hzToBin(hi, sampleRate))
  if (binHi <= binLo) return 0
  let sum = 0
  for (let i = binLo; i <= binHi; i++) sum += data[i]
  return sum / (255 * (binHi - binLo + 1))
}
