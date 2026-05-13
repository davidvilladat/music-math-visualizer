import type { AudioFeatures } from '../audio/audioFeatures'
import type { FluidSolver } from './fluid/FluidSolver'

function hueToRgb(h: number): [number, number, number] {
  const h6 = (((h % 1) + 1) % 1) * 6
  const x = 1 - Math.abs((h6 % 2) - 1)
  if (h6 < 1) return [1, x, 0]
  if (h6 < 2) return [x, 1, 0]
  if (h6 < 3) return [0, 1, x]
  if (h6 < 4) return [0, x, 1]
  if (h6 < 5) return [x, 0, 1]
  return [1, 0, x]
}

function scaledColor(hue: number, brightness: number): [number, number, number] {
  const [r, g, b] = hueToRgb(hue)
  const bv = Math.max(0.08, brightness)
  return [r * bv, g * bv, b * bv]
}

export interface AudioMappingParams {
  enabled: boolean
  bassThreshold: number
  audioForceScale: number
  fluxVorticityScale: number
  beatForceScale: number
  // MHD
  magneticEnabled: boolean
  magneticReynoldsMax: number  // Rm when centroid = 1.0
  dipoleStrength: number       // ψ amplitude per beat-dipole
  dipoleRadius: number         // dipole gaussian radius (UV)
}

export const DEFAULT_AUDIO_MAPPING: AudioMappingParams = {
  enabled: true,
  bassThreshold: 0.05,
  audioForceScale: 1.0,
  fluxVorticityScale: 60,
  beatForceScale: 2.0,
  magneticEnabled: true,
  magneticReynoldsMax: 2.5,
  dipoleStrength: 0.08,
  dipoleRadius: 0.2,
}

export interface InjectorResult {
  curlStrength: number
  velocityDissipation: number
  magneticReynolds: number
  fieldLineBrightness: number
}

export class AudioInjector {
  private hue = Math.random()
  private prevBeatPulse = 0

  inject(
    features: AudioFeatures,
    fluid: FluidSolver,
    params: AudioMappingParams,
    baseSplatForce: number,
    baseCurlStrength: number,
    baseVelocityDissipation: number,
    baseMagneticReynoldsMax: number,
    baseFieldLineBrightness: number,
  ): InjectorResult {
    // Hue tracks centroid: 0 (bass-heavy) = warm, 1 (treble-heavy) = cool
    const targetHue = features.centroid * 0.67
    this.hue += (targetHue - this.hue) * 0.02

    const defaults: InjectorResult = {
      curlStrength: baseCurlStrength,
      velocityDissipation: baseVelocityDissipation,
      magneticReynolds: 0,
      fieldLineBrightness: baseFieldLineBrightness,
    }

    if (!params.enabled) return defaults

    const force = baseSplatForce * params.audioForceScale
    const brightness = 0.3 + features.rms * 4

    // ── 1. Continuous bass injection ─────────────────────────────────────────
    const bassEnergy = features.subBass * 0.6 + features.bass * 0.4
    if (bassEnergy > params.bassThreshold) {
      const excess = (bassEnergy - params.bassThreshold) / (1 - params.bassThreshold)
      const count = Math.random() < excess * 2 ? (Math.random() < 0.5 ? 2 : 1) : 0
      for (let i = 0; i < count; i++) {
        const x = 0.15 + Math.random() * 0.7
        const y = 0.05 + Math.random() * 0.35
        const speed = excess * force * 0.6
        fluid.addSplat({
          x, y,
          dx: (Math.random() - 0.5) * speed * 0.4,
          dy: speed * (0.5 + Math.random() * 0.5),
          color: scaledColor(this.hue, brightness * bassEnergy * 2),
        })
      }
    }

    // ── 2. Beat burst: radial velocity splats + magnetic dipole ──────────────
    const beatRising = features.beatPulse > 0.5 && this.prevBeatPulse <= 0.5
    if (beatRising) {
      const cx = 0.25 + Math.random() * 0.5
      const cy = 0.25 + Math.random() * 0.5
      const beatForce = force * params.beatForceScale * features.beatPulse
      const beatHue = (this.hue + 0.5) % 1

      // Radial velocity burst
      for (let i = 0; i < 6; i++) {
        const angle = (i / 6) * Math.PI * 2 + Math.random() * 0.3
        fluid.addSplat({
          x: cx, y: cy,
          dx: Math.cos(angle) * beatForce,
          dy: Math.sin(angle) * beatForce,
          color: scaledColor(beatHue, brightness * 1.5),
        })
      }

      // Magnetic dipole at beat position
      if (params.magneticEnabled) {
        fluid.addMagneticDipole({
          x: cx,
          y: cy,
          angle: Math.random() * Math.PI * 2,
          strength: params.dipoleStrength * features.beatPulse,
          radius: params.dipoleRadius,
        })
      }
    }
    this.prevBeatPulse = features.beatPulse

    // ── 3. Brilliance sparkles ────────────────────────────────────────────────
    if (features.brilliance > 0.15 && Math.random() < features.brilliance * 0.4) {
      fluid.addSplat({
        x: Math.random(),
        y: Math.random(),
        dx: (Math.random() - 0.5) * force * 0.15,
        dy: (Math.random() - 0.5) * force * 0.15,
        color: scaledColor(this.hue + 0.1, brightness * features.brilliance * 3),
      })
    }

    // ── 4. Sub-bass also injects small dipoles (slow magnetic breathing) ─────
    if (params.magneticEnabled && features.subBass > 0.12 && Math.random() < features.subBass * 0.15) {
      fluid.addMagneticDipole({
        x: 0.2 + Math.random() * 0.6,
        y: 0.1 + Math.random() * 0.4,
        angle: Math.random() * Math.PI * 2,
        strength: params.dipoleStrength * 0.4 * features.subBass,
        radius: params.dipoleRadius * 1.5,
      })
    }

    // ── Parameter modulation ──────────────────────────────────────────────────
    // Flux sharpens vorticity on transients
    const curlStrength = baseCurlStrength + features.flux * params.fluxVorticityScale

    // More mids = fluid retains more energy
    const velocityDissipation = baseVelocityDissipation +
      features.mid * 0.5 * (1.0 - baseVelocityDissipation) * 0.4

    // Centroid → Rm: bright music tightens the MHD coupling (field lines resist flow)
    const magneticReynolds = params.magneticEnabled
      ? features.centroid * baseMagneticReynoldsMax
      : 0

    // Field line brightness scales with overall energy (quiet music = subtle lines)
    const fieldLineBrightness = params.magneticEnabled
      ? baseFieldLineBrightness * (0.4 + features.rms * 2.5)
      : 0

    return { curlStrength, velocityDissipation, magneticReynolds, fieldLineBrightness }
  }
}
