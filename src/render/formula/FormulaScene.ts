import * as THREE from 'three'
import type { AudioFeatures } from '../../audio/audioFeatures'
import type { TrackDNA } from '../trackDNA'

import formulaVert from './shaders/formula.vert?raw'
import formulaFrag from './shaders/formula.frag?raw'

export interface FormulaDevParams {
  variant:    number
  speed:      number
  zoom:       number
  waveAmp:    number
  brightness: number
  tempoInfluence: number
  tempoReactivity: number
  energyInfluence: number
  beatKick: number
  bandWarp: number
  reactivity: number
  beatGate: number
  trackDNA: TrackDNA
}

const BASE_POINT_COUNT = 10_000
const DETAIL_LAYERS = 4
const STANDARD_POINT_COUNT = BASE_POINT_COUNT * DETAIL_LAYERS
const MANDELBROT_VARIANT = 33
const MANDELBROT_POINT_COUNT = 60_000
const LORENZ_VARIANT = 36
const LORENZ_POINT_COUNT = 30_000
const MIRA_POINT_COUNT = 40_000
const POINT_COUNT = MANDELBROT_POINT_COUNT

// t increment per second matching the original PI/240 per frame at 60 fps
const T_RATE = Math.PI / 4   // PI/240 * 60

function drawCountFor(variant: number): number {
  if (variant === MANDELBROT_VARIANT) return MANDELBROT_POINT_COUNT
  if (variant === LORENZ_VARIANT) return LORENZ_POINT_COUNT
  return STANDARD_POINT_COUNT
}

// Lorenz Rosette integrates the attractor inside the loop that draws it, so
// each sample depends on the previous one -- a recurrence the vertex shader
// cannot unroll. The trajectory is the same on every frame, though, since only
// its projection reads the clock, so it is run once here and handed to the
// shader as a per-point attribute. Points past the Lorenz draw range keep the
// zeros they were allocated with; no other variant reads the attribute.
// Mira Plume walks the Gumowski-Mira map, and for the same reason as the Lorenz
// orbit -- a serial recurrence whose result is identical on every frame -- it is
// walked once here rather than in the shader. Its draw count is the standard
// one, so no drawCountFor entry is needed.
function miraOrbit(): Float32Array {
  const data = new Float32Array(POINT_COUNT * 2)
  const a = 0.003
  const b = 0.06
  const u = -0.8
  const f = (v: number): number => u * v + 2 * (1 - u) * v * v / (1 + v * v)
  let x = 1
  let y = 1
  for (let n = 0; n < MIRA_POINT_COUNT; n++) {
    // The source's second element re-evaluates the same expression rather than
    // reading the first, so both read the pre-step x and y.
    const step = y + (1 - b * y * y) * a * y + f(x)
    const nextY = f(step) - x
    x = step
    y = nextY
    data[n * 2] = x
    data[n * 2 + 1] = y
  }
  return data
}

function lorenzOrbit(): Float32Array {
  const data = new Float32Array(POINT_COUNT * 3)
  const dt = 5e-4
  let x = 9
  let y = 9
  let z = 9
  for (let n = 0; n < LORENZ_POINT_COUNT; n++) {
    // Written from the pre-step values on all three axes, matching the source's
    // simultaneous destructuring assignment rather than updating in place.
    const nx = x + 9 * (y - x) * dt
    const ny = y + (x * (28 - z) - y) * dt
    const nz = z + (x * y - z - z) * dt
    x = nx
    y = ny
    z = nz
    data[n * 3] = x
    data[n * 3 + 1] = y
    data[n * 3 + 2] = z
  }
  return data
}

export class FormulaScene {
  private gl: THREE.WebGLRenderer

  private scene  = new THREE.Scene()
  private camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1)
  private geo    : THREE.BufferGeometry
  private mat    : THREE.RawShaderMaterial

  private time = 0
  private motionRate = 1

  constructor(gl: THREE.WebGLRenderer, w: number, h: number) {
    this.gl = gl

    // One float attribute per point: its 1-based index
    const indices = new Float32Array(POINT_COUNT)
    for (let i = 0; i < POINT_COUNT; i++) indices[i] = i + 1

    // Three uses the standard position attribute to determine draw count even
    // when the shader computes positions procedurally from custom attributes.
    const positions = new Float32Array(POINT_COUNT * 3)
    this.geo = new THREE.BufferGeometry()
    this.geo.setAttribute('position', new THREE.BufferAttribute(positions, 3))
    this.geo.setAttribute('aIndex', new THREE.BufferAttribute(indices, 1))
    this.geo.setAttribute('aLorenz', new THREE.BufferAttribute(lorenzOrbit(), 3))
    this.geo.setAttribute('aMira', new THREE.BufferAttribute(miraOrbit(), 2))
    this.geo.setDrawRange(0, STANDARD_POINT_COUNT)

    this.mat = new THREE.RawShaderMaterial({
      vertexShader:   formulaVert,
      fragmentShader: formulaFrag,
      uniforms: {
        uTime:       { value: 0 },
        uVariant:    { value: 0 },
        uZoom:       { value: 1.0 },
        uWaveAmp:    { value: 1.0 },
        uBrightness: { value: 0.45 },
        uBass:       { value: 0 },
        uSubBass:    { value: 0 },
        uLowMid:     { value: 0 },
        uMid:        { value: 0 },
        uHighMid:    { value: 0 },
        uBrilliance: { value: 0 },
        uCentroid:   { value: 0 },
        uRolloff:    { value: 0 },
        uFlux:       { value: 0 },
        uBeatPulse:  { value: 0 },
        uRms:        { value: 0 },
        uTempoRate:  { value: 1 },
        uBandWarp:   { value: 1 },
        uBeatPhase:  { value: 0 },
        uBarPhase:   { value: 0 },
        uPhrasePhase:{ value: 0 },
        uBarPulse:   { value: 0 },
        uSectionEnergy: { value: 0 },
        uKickPulse:  { value: 0 },
        uSnarePulse: { value: 0 },
        uHatPulse:   { value: 0 },
        uDownbeatPulse: { value: 0 },
        uOnsetDensity: { value: 0 },
        uSectionPulse: { value: 0 },
        uSectionNovelty: { value: 0 },
        uReactivity: { value: 1 },
        uBeatGate:   { value: 1 },
        uBeatKick:   { value: 1 },
        uTempoLock:  { value: 0 },
        uProfile:    { value: new THREE.Vector4(1, 1, 1, 1) },
        uTrackDNA0:  { value: new THREE.Vector4(0, 1, 1, 1) },
        uTrackDNA1:  { value: new THREE.Vector4(0, 0.5, 0.5, 0) },
        uResolution: { value: new THREE.Vector2(w, h) },
      },
      blending:    THREE.AdditiveBlending,
      transparent: true,
      depthTest:   false,
      depthWrite:  false,
    })

    this.scene.add(new THREE.Points(this.geo, this.mat))
  }

  update(dt: number, features: AudioFeatures, cfg: FormulaDevParams): void {
    this.geo.setDrawRange(0, drawCountFor(cfg.variant))

    const profile = this.profileFor(cfg.variant)
    const bpmRate = features.bpm && features.bpmConfidence > 0.25
      ? Math.max(0.5, Math.min(1.85, features.bpm / 120))
      : 1
    const tempo = 1 + (bpmRate - 1) * cfg.tempoInfluence * profile.tempo * cfg.tempoReactivity * Math.max(0.25, features.bpmConfidence)
    // Gated rather than scaled: on steady this collapses to 1, so targetRate is a
    // constant 1 and the time step never flexes.
    const energy = 1 + features.normalized.rms * cfg.energyInfluence * profile.energy * cfg.reactivity * cfg.beatGate
    // beatPulse deliberately does NOT appear here. This rate drives a time
    // accumulator, so a beat that raises it does not bump the visual and settle
    // back -- it advances the animation's phase permanently, and every beat
    // pushes it further. That was the lurch. Beats now act only through the
    // transient terms in the shader, which do return to baseline.
    const targetRate = Math.max(0.2, Math.min(3.0, tempo * energy))
    const follow = 1 - Math.exp(-dt * 5)
    this.motionRate += (targetRate - this.motionRate) * follow
    this.time += dt * T_RATE * cfg.speed * this.motionRate

    const u = this.mat.uniforms
    u.uTime.value       = this.time
    u.uVariant.value    = cfg.variant
    u.uZoom.value       = cfg.zoom
    u.uWaveAmp.value    = cfg.waveAmp
    u.uBrightness.value = cfg.brightness
    const normalized = features.normalized
    u.uSubBass.value    = normalized.subBass
    u.uBass.value       = normalized.bass
    u.uLowMid.value     = normalized.lowMid
    u.uMid.value        = normalized.mid
    u.uHighMid.value    = normalized.highMid
    u.uBrilliance.value = normalized.brilliance
    u.uCentroid.value   = features.centroid
    u.uRolloff.value    = features.rolloff
    u.uFlux.value       = normalized.flux
    u.uBeatPulse.value  = features.beatPulse
    u.uRms.value        = normalized.rms
    u.uTempoRate.value  = this.motionRate
    u.uBandWarp.value   = cfg.bandWarp
    u.uBeatPhase.value  = features.beatPhase
    u.uBarPhase.value   = features.barPhase
    u.uPhrasePhase.value = features.phrasePhase
    u.uBarPulse.value   = features.barPulse
    u.uSectionEnergy.value = features.sectionEnergy
    u.uKickPulse.value  = features.kickPulse
    u.uSnarePulse.value = features.snarePulse
    u.uHatPulse.value   = features.hatPulse
    u.uDownbeatPulse.value = features.downbeatPulse
    u.uOnsetDensity.value = features.onsetDensity
    u.uSectionPulse.value = features.sectionPulse
    u.uSectionNovelty.value = features.sectionNovelty
    u.uReactivity.value = cfg.reactivity
    u.uBeatGate.value   = cfg.beatGate
    u.uBeatKick.value   = cfg.beatKick
    u.uTempoLock.value  = features.bpmConfidence
    u.uProfile.value.set(profile.bass, profile.mid, profile.high, profile.beat)
    const dna = cfg.trackDNA
    const dnaFollow = 1 - Math.exp(-dt * 0.45)
    const dna0 = u.uTrackDNA0.value as THREE.Vector4
    const dna1 = u.uTrackDNA1.value as THREE.Vector4
    dna0.x += (dna.hue - dna0.x) * dnaFollow
    dna0.y += (dna.radius - dna0.y) * dnaFollow
    dna0.z += (dna.twist - dna0.z) * dnaFollow
    dna0.w += (dna.rotation - dna0.w) * dnaFollow
    dna1.x += (dna.phase - dna1.x) * dnaFollow
    dna1.y += (dna.texture - dna1.y) * dnaFollow
    dna1.z += (dna.paletteSpread - dna1.z) * dnaFollow
    dna1.w += (dna.seed - dna1.w) * dnaFollow
  }

  resetTrackClock(dna: TrackDNA): void {
    this.time = 0
    this.motionRate = 1
    this.mat.uniforms.uTrackDNA0.value.set(dna.hue, dna.radius, dna.twist, dna.rotation)
    this.mat.uniforms.uTrackDNA1.value.set(dna.phase, dna.texture, dna.paletteSpread, dna.seed)
  }

  private profileFor(variant: number): { tempo: number; energy: number; bass: number; mid: number; high: number; beat: number } {
    const profiles = [
      { tempo: 0.9, energy: 0.8, bass: 1.2, mid: 0.8, high: 1.1, beat: 1.0 },
      { tempo: 0.5, energy: 0.7, bass: 0.7, mid: 1.5, high: 1.1, beat: 1.2 },
      { tempo: 1.2, energy: 1.0, bass: 1.4, mid: 0.7, high: 0.8, beat: 1.5 },
      { tempo: 0.7, energy: 1.2, bass: 0.8, mid: 1.0, high: 1.2, beat: 0.7 },
      { tempo: 1.3, energy: 0.8, bass: 0.9, mid: 0.8, high: 1.0, beat: 1.1 },
      { tempo: 0.8, energy: 0.9, bass: 0.8, mid: 1.6, high: 1.0, beat: 1.0 },
      { tempo: 0.6, energy: 1.3, bass: 1.5, mid: 1.0, high: 0.9, beat: 1.6 },
      { tempo: 1.0, energy: 0.9, bass: 0.9, mid: 1.4, high: 1.0, beat: 0.9 },
      { tempo: 1.4, energy: 0.8, bass: 0.8, mid: 1.0, high: 1.3, beat: 0.8 },
      { tempo: 0.5, energy: 1.1, bass: 1.0, mid: 0.9, high: 1.4, beat: 0.6 },
      { tempo: 0.9, energy: 1.0, bass: 0.9, mid: 1.1, high: 1.5, beat: 0.9 },
      { tempo: 1.0, energy: 1.2, bass: 1.3, mid: 1.1, high: 1.0, beat: 1.4 },
      { tempo: 1.5, energy: 0.9, bass: 1.2, mid: 1.1, high: 0.9, beat: 1.5 },
      { tempo: 0.8, energy: 0.7, bass: 0.7, mid: 1.3, high: 1.4, beat: 0.9 },
      { tempo: 1.0, energy: 1.1, bass: 1.0, mid: 1.5, high: 0.9, beat: 1.0 },
      { tempo: 0.9, energy: 1.4, bass: 1.6, mid: 0.8, high: 0.8, beat: 1.6 },
      { tempo: 1.4, energy: 0.9, bass: 0.8, mid: 1.0, high: 1.8, beat: 1.1 },
      { tempo: 1.0, energy: 1.2, bass: 1.4, mid: 1.0, high: 1.0, beat: 1.3 },
      { tempo: 1.6, energy: 1.0, bass: 1.2, mid: 0.9, high: 1.1, beat: 1.7 },
      { tempo: 0.7, energy: 1.3, bass: 0.9, mid: 1.1, high: 1.5, beat: 0.8 },
      { tempo: 0.9, energy: 1.0, bass: 1.0, mid: 1.5, high: 1.0, beat: 0.9 },
      { tempo: 1.2, energy: 1.1, bass: 1.3, mid: 0.9, high: 1.0, beat: 1.2 },
      { tempo: 1.1, energy: 1.2, bass: 1.0, mid: 1.0, high: 1.7, beat: 0.9 },
      { tempo: 0.6, energy: 0.8, bass: 0.6, mid: 1.0, high: 1.6, beat: 0.7 },
      { tempo: 1.3, energy: 1.0, bass: 1.1, mid: 1.2, high: 1.2, beat: 1.1 },
      { tempo: 0.75, energy: 1.0, bass: 1.25, mid: 1.15, high: 1.4, beat: 0.85 },
      { tempo: 0.85, energy: 1.0, bass: 1.15, mid: 1.1, high: 1.35, beat: 1.2 },
      { tempo: 0.9, energy: 1.0, bass: 1.2, mid: 1.0, high: 1.2, beat: 1.3 },
      { tempo: 1.1, energy: 1.2, bass: 1.0, mid: 1.0, high: 1.7, beat: 0.9 },
      { tempo: 1.3, energy: 1.1, bass: 1.2, mid: 0.9, high: 1.4, beat: 1.2 },
      { tempo: 0.9, energy: 1.2, bass: 1.1, mid: 1.2, high: 1.6, beat: 0.8 },
      { tempo: 1.2, energy: 1.1, bass: 1.0, mid: 1.0, high: 1.5, beat: 1.1 },
      { tempo: 1.0, energy: 1.2, bass: 1.1, mid: 1.0, high: 1.6, beat: 1.4 },
      { tempo: 0.8, energy: 1.0, bass: 1.2, mid: 0.9, high: 1.6, beat: 1.1 },
      { tempo: 1.0, energy: 1.1, bass: 1.3, mid: 1.0, high: 1.2, beat: 1.2 },
      { tempo: 0.7, energy: 1.2, bass: 0.9, mid: 1.3, high: 1.4, beat: 0.9 },
      { tempo: 1.1, energy: 1.0, bass: 1.1, mid: 1.0, high: 1.3, beat: 1.3 },
      { tempo: 0.9, energy: 1.1, bass: 1.2, mid: 1.1, high: 1.3, beat: 1.0 },
      // Nacre is the slow read of Nautilus, so tempo and energy are pulled down
      // here too -- both feed the time step, and leaving them at Nautilus' values
      // would let a loud passage hand back the speed the clock just gave up.
      { tempo: 0.45, energy: 0.7, bass: 1.0, mid: 1.0, high: 1.4, beat: 0.9 },
      { tempo: 1.0, energy: 1.1, bass: 1.2, mid: 1.1, high: 1.2, beat: 1.2 },
      { tempo: 0.95, energy: 1.1, bass: 1.3, mid: 1.0, high: 1.2, beat: 1.3 },
      { tempo: 0.8, energy: 1.0, bass: 1.1, mid: 1.1, high: 1.3, beat: 1.0 },
    ]
    return profiles[Math.max(0, Math.min(profiles.length - 1, Math.round(variant)))]
  }

  render(target: THREE.WebGLRenderTarget): void {
    this.gl.setRenderTarget(target)
    this.gl.setClearColor(0x090909, 1)   // near-black matching original background(9)
    this.gl.clear(true, false, false)
    this.gl.autoClear = false
    this.gl.render(this.scene, this.camera)
    this.gl.autoClear = true
    this.gl.setRenderTarget(null)
  }

  resize(w: number, h: number): void {
    this.mat.uniforms.uResolution.value.set(w, h)
  }

  dispose(): void {
    this.geo.dispose()
    this.mat.dispose()
  }
}
