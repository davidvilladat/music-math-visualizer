export interface AudioFeatures {
  // 6 perceptual bands (0..1 normalized energy)
  subBass: number   // 20–60 Hz
  bass: number      // 60–250 Hz
  lowMid: number    // 250–500 Hz
  mid: number       // 500–2000 Hz
  highMid: number   // 2000–6000 Hz
  brilliance: number // 6000–20000 Hz

  rms: number          // overall loudness 0..1
  centroid: number     // spectral centroid normalized 0..1
  flux: number         // smoothed spectral flux 0..1
  rolloff: number      // normalized freq containing 85% energy

  beatPulse: number    // 1.0 on beat, decays exponentially toward 0
  lastBeatTime: number // performance.now() timestamp of last beat
  bpm: number | null   // null in phase 1

  spectrum: Float32Array // raw FFT magnitudes (FFT_SIZE/2 bins), 0..1
}

export const FFT_SIZE = 2048
export const BIN_COUNT = FFT_SIZE / 2

export function makeAudioFeatures(): AudioFeatures {
  return {
    subBass: 0,
    bass: 0,
    lowMid: 0,
    mid: 0,
    highMid: 0,
    brilliance: 0,
    rms: 0,
    centroid: 0,
    flux: 0,
    rolloff: 0,
    beatPulse: 0,
    lastBeatTime: 0,
    bpm: null,
    spectrum: new Float32Array(BIN_COUNT),
  }
}
