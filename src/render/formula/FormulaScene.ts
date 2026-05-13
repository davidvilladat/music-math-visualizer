import * as THREE from 'three'
import type { AudioFeatures } from '../../audio/audioFeatures'

import formulaVert from './shaders/formula.vert?raw'
import formulaFrag from './shaders/formula.frag?raw'

export interface FormulaDevParams {
  variant:    0 | 1
  speed:      number
  zoom:       number
  waveAmp:    number
  brightness: number
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
        uBeatPulse:  { value: 0 },
        uRms:        { value: 0 },
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
    this.time += dt * T_RATE * cfg.speed

    const u = this.mat.uniforms
    u.uTime.value       = this.time
    u.uVariant.value    = cfg.variant
    u.uZoom.value       = cfg.zoom
    u.uWaveAmp.value    = cfg.waveAmp
    u.uBrightness.value = cfg.brightness
    u.uBass.value       = features.bass
    u.uMid.value        = features.mid
    u.uBrilliance.value = features.brilliance
    u.uBeatPulse.value  = features.beatPulse
    u.uRms.value        = features.rms
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
