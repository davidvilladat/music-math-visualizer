export function computeRms(timeDomain: Uint8Array<ArrayBuffer>): number {
  let sum = 0
  for (let i = 0; i < timeDomain.length; i++) {
    const v = (timeDomain[i] - 128) / 128
    sum += v * v
  }
  return Math.sqrt(sum / timeDomain.length)
}

export function computeCentroid(
  freq: Uint8Array<ArrayBuffer>,
  sampleRate: number
): number {
  let weightedSum = 0
  let totalWeight = 0
  const nyquist = sampleRate / 2
  for (let i = 0; i < freq.length; i++) {
    const hz = (i / freq.length) * nyquist
    weightedSum += hz * freq[i]
    totalWeight += freq[i]
  }
  if (totalWeight === 0) return 0
  return weightedSum / totalWeight / nyquist
}

export function computeFlux(
  current: Uint8Array<ArrayBuffer>,
  previous: Uint8Array<ArrayBuffer>
): number {
  let flux = 0
  for (let i = 0; i < current.length; i++) {
    const delta = (current[i] - previous[i]) / 255
    if (delta > 0) flux += delta
  }
  return flux / current.length
}

export function computeBandFlux(
  current: Uint8Array<ArrayBuffer>,
  previous: Uint8Array<ArrayBuffer>,
  sampleRate: number,
  loHz: number,
  hiHz: number,
): number {
  const nyquist = sampleRate / 2
  const lo = Math.max(0, Math.floor(loHz / nyquist * current.length))
  const hi = Math.min(current.length, Math.ceil(hiHz / nyquist * current.length))
  if (hi <= lo) return 0

  let flux = 0
  for (let i = lo; i < hi; i++) {
    const delta = (current[i] - previous[i]) / 255
    if (delta > 0) flux += delta
  }
  return flux / (hi - lo)
}

export function computeRolloff(
  freq: Uint8Array<ArrayBuffer>,
  _sampleRate: number,
  threshold = 0.85
): number {
  let total = 0
  for (let i = 0; i < freq.length; i++) total += freq[i]
  const target = total * threshold
  let cumulative = 0
  for (let i = 0; i < freq.length; i++) {
    cumulative += freq[i]
    if (cumulative >= target) {
      return i / freq.length
    }
  }
  return 1
}

export function fillSpectrum(
  freq: Uint8Array<ArrayBuffer>,
  out: Float32Array
): void {
  const len = Math.min(freq.length, out.length)
  for (let i = 0; i < len; i++) {
    out[i] = freq[i] / 255
  }
}
