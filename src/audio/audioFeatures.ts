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
  beatPhase: number    // 0..1 position through the current beat
  barPhase: number     // 0..1 position through a 4-beat bar
  phrasePhase: number  // 0..1 position through a 16-beat phrase
  barPulse: number     // pulse near the start of each 4-beat bar
  sectionEnergy: number // slow rolling musical intensity 0..1
  bpm: number | null   // estimated tempo when confidence is high enough
  bpmConfidence: number // 0..1 confidence for the tempo estimate

  // Percussive and structural events. Pulses jump to 1 on an event and decay
  // back to zero, which makes them safe to map to temporary visual gestures.
  kickPulse: number
  snarePulse: number
  hatPulse: number
  downbeatPulse: number
  onsetDensity: number // recent classified onsets per second, normalized 0..1
  sectionPulse: number // fires when the short-term timbre diverges from its baseline
  sectionNovelty: number
  sectionIndex: number

  // Song-relative values. Raw magnitudes vary enormously between masters;
  // these rolling percentile-normalized channels use the visual range evenly.
  normalized: NormalizedAudioFeatures

  spectrum: Float32Array // raw FFT magnitudes (FFT_SIZE/2 bins), 0..1
}

export interface NormalizedAudioFeatures {
  subBass: number
  bass: number
  lowMid: number
  mid: number
  highMid: number
  brilliance: number
  rms: number
  centroid: number
  flux: number
  rolloff: number
}

export function makeNormalizedAudioFeatures(): NormalizedAudioFeatures {
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
  }
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
    beatPhase: 0,
    barPhase: 0,
    phrasePhase: 0,
    barPulse: 0,
    sectionEnergy: 0,
    bpm: null,
    bpmConfidence: 0,
    kickPulse: 0,
    snarePulse: 0,
    hatPulse: 0,
    downbeatPulse: 0,
    onsetDensity: 0,
    sectionPulse: 0,
    sectionNovelty: 0,
    sectionIndex: 0,
    normalized: makeNormalizedAudioFeatures(),
    spectrum: new Float32Array(BIN_COUNT),
  }
}
