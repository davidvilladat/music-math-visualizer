import type { AudioFeatures } from './audioFeatures'

/** Generates synthetic AudioFeatures at 120 BPM — no real audio required. */
export class DemoEngine {
  private time = 0
  readonly bpm = 120

  tick(dt: number, out: AudioFeatures): void {
    this.time += dt
    const t = this.time
    const bps = this.bpm / 60  // 2 beats/s

    // Beat pulse: sharp spike at each beat, exponential decay
    const beatPhase = (t * bps) % 1
    out.beatPulse    = Math.exp(-beatPhase * 7)
    out.lastBeatTime = (Math.floor(t * bps) / bps) * 1000
    out.beatPhase    = beatPhase
    out.barPhase     = (t * bps / 4) % 1
    out.phrasePhase  = (t * bps / 16) % 1
    out.barPulse     = Math.exp(-Math.min(out.barPhase, 1 - out.barPhase) * 18)
    out.bpm          = this.bpm
    out.bpmConfidence = 1
    out.kickPulse = out.beatPulse
    out.snarePulse = Math.exp(-Math.abs(((beatPhase + 0.5) % 1) - 0.5) * 18) * (Math.floor(t * bps) % 2)
    out.hatPulse = Math.exp(-((t * bps * 2) % 1) * 13)
    out.downbeatPulse = Math.exp(-out.barPhase * 10)
    out.onsetDensity = 0.55

    // Perceptual bands — each oscillates at its own rate
    out.subBass    = Math.abs(Math.sin(Math.PI * t * bps)) * 0.85 + 0.05
    out.bass       = out.subBass * 0.7 + Math.abs(Math.sin(Math.PI * t * 0.8)) * 0.25
    out.lowMid     = Math.abs(Math.sin(Math.PI * t * 1.4)) * 0.55 + 0.10
    out.mid        = Math.abs(Math.sin(Math.PI * t * 2.3)) * 0.48 + 0.10
    out.highMid    = Math.abs(Math.sin(Math.PI * t * 3.9)) * 0.38 + 0.05
    out.brilliance = Math.abs(Math.sin(Math.PI * t * 5.7)) * 0.32 + 0.05

    out.rms      = (out.bass + out.mid) * 0.5
    out.centroid = out.mid
    out.flux     = Math.abs(Math.sin(Math.PI * t * 4.5)) * 0.5
    out.rolloff  = out.highMid
    out.sectionEnergy = Math.min(1, out.rms * 0.75 + out.bass * 0.35 + out.flux * 0.3)
    out.sectionPulse = 0
    out.sectionNovelty = 0
    out.sectionIndex = 0

    out.normalized.subBass = out.subBass
    out.normalized.bass = out.bass
    out.normalized.lowMid = out.lowMid
    out.normalized.mid = out.mid
    out.normalized.highMid = out.highMid
    out.normalized.brilliance = out.brilliance
    out.normalized.rms = out.rms
    out.normalized.centroid = out.centroid
    out.normalized.flux = out.flux
    out.normalized.rolloff = out.rolloff

    // Spectrum: layered envelopes shaped like real music FFT
    const n = out.spectrum.length
    for (let i = 0; i < n; i++) {
      const f        = i / n
      const bassEnv  = Math.exp(-f * 12)              * out.bass  * 1.3
      const midEnv   = Math.exp(-((f - 0.15) ** 2) * 50) * out.mid
      const hiEnv    = Math.exp(-f * 3) * (1 - Math.exp(-f * 9)) * out.brilliance * 0.9
      const noise    = Math.random() * 0.015
      out.spectrum[i] = Math.max(0, Math.min(1, bassEnv + midEnv + hiEnv + noise))
    }
  }
}
