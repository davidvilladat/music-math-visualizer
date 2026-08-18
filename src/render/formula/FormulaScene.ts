import * as THREE from 'three'
import type { AudioFeatures } from '../../audio/audioFeatures'

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
}

const BASE_POINT_COUNT = 10_000
const DETAIL_LAYERS = 4
const POINT_COUNT = BASE_POINT_COUNT * DETAIL_LAYERS

// t increment per second matching the original PI/240 per frame at 60 fps
const T_RATE = Math.PI / 4   // PI/240 * 60

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
        uMid:        { value: 0 },
        uBrilliance: { value: 0 },
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
        uReactivity: { value: 1 },
        uBeatGate:   { value: 1 },
        uBeatKick:   { value: 1 },
        uTempoLock:  { value: 0 },
        uProfile:    { value: new THREE.Vector4(1, 1, 1, 1) },
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
    const profile = this.profileFor(cfg.variant)
    const bpmRate = features.bpm && features.bpmConfidence > 0.25
      ? Math.max(0.5, Math.min(1.85, features.bpm / 120))
      : 1
    const tempo = 1 + (bpmRate - 1) * cfg.tempoInfluence * profile.tempo * cfg.tempoReactivity * Math.max(0.25, features.bpmConfidence)
    // Gated rather than scaled: on steady this collapses to 1, so targetRate is a
    // constant 1 and the time step never flexes.
    const energy = 1 + features.rms * cfg.energyInfluence * profile.energy * cfg.reactivity * cfg.beatGate
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
    u.uBass.value       = features.bass
    u.uMid.value        = features.mid
    u.uBrilliance.value = features.brilliance
    u.uFlux.value       = features.flux
    u.uBeatPulse.value  = features.beatPulse
    u.uRms.value        = features.rms
    u.uTempoRate.value  = this.motionRate
    u.uBandWarp.value   = cfg.bandWarp
    u.uBeatPhase.value  = features.beatPhase
    u.uBarPhase.value   = features.barPhase
    u.uPhrasePhase.value = features.phrasePhase
    u.uBarPulse.value   = features.barPulse
    u.uSectionEnergy.value = features.sectionEnergy
    u.uReactivity.value = cfg.reactivity
    u.uBeatGate.value   = cfg.beatGate
    u.uBeatKick.value   = cfg.beatKick
    u.uTempoLock.value  = features.bpmConfidence
    u.uProfile.value.set(profile.bass, profile.mid, profile.high, profile.beat)
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
