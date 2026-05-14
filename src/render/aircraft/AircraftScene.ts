import * as THREE from 'three'
import type { AudioFeatures } from '../../audio/audioFeatures'

import aircraftVert from './shaders/aircraft.vert?raw'
import aircraftFrag from './shaders/aircraft.frag?raw'

export interface AircraftDevParams {
  variant: number
  speed: number
  tempoReactivity: number
  reactivity: number
}

const POINT_COUNT = 90_000
const T_RATE = Math.PI / 90 * 60

export class AircraftScene {
  private gl: THREE.WebGLRenderer
  private scene = new THREE.Scene()
  private camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1)
  private geo: THREE.BufferGeometry
  private mat: THREE.RawShaderMaterial
  private time = 0
  private motionRate = 1

  constructor(gl: THREE.WebGLRenderer, w: number, h: number) {
    this.gl = gl

    const indices = new Float32Array(POINT_COUNT)
    for (let i = 0; i < POINT_COUNT; i++) indices[i] = i

    const positions = new Float32Array(POINT_COUNT * 3)
    this.geo = new THREE.BufferGeometry()
    this.geo.setAttribute('position', new THREE.BufferAttribute(positions, 3))
    this.geo.setAttribute('aIndex', new THREE.BufferAttribute(indices, 1))

    this.mat = new THREE.RawShaderMaterial({
      vertexShader: aircraftVert,
      fragmentShader: aircraftFrag,
      uniforms: {
        uTime: { value: 0 },
        uVariant: { value: 0 },
        uBass: { value: 0 },
        uMid: { value: 0 },
        uBrilliance: { value: 0 },
        uFlux: { value: 0 },
        uBeatPulse: { value: 0 },
        uRms: { value: 0 },
        uReactivity: { value: 1 },
        uResolution: { value: new THREE.Vector2(w, h) },
      },
      blending: THREE.AdditiveBlending,
      transparent: true,
      depthTest: false,
      depthWrite: false,
    })

    this.scene.add(new THREE.Points(this.geo, this.mat))
  }

  update(dt: number, features: AudioFeatures, cfg: AircraftDevParams): void {
    const bpmRate = features.bpm && features.bpmConfidence > 0.25
      ? Math.max(0.5, Math.min(1.65, features.bpm / 120))
      : 1
    const tempo = 1 + (bpmRate - 1) * cfg.tempoReactivity * Math.max(0.25, features.bpmConfidence)
    const energy = 1 + features.rms * 0.18 * cfg.reactivity
    const targetRate = Math.max(0.25, Math.min(2.4, tempo * energy))
    const follow = 1 - Math.exp(-dt * 4)
    this.motionRate += (targetRate - this.motionRate) * follow
    this.time += dt * T_RATE * cfg.speed * this.motionRate

    const u = this.mat.uniforms
    u.uTime.value = this.time
    u.uVariant.value = cfg.variant
    u.uBass.value = features.bass
    u.uMid.value = features.mid
    u.uBrilliance.value = features.brilliance
    u.uFlux.value = features.flux
    u.uBeatPulse.value = features.beatPulse
    u.uRms.value = features.rms
    u.uReactivity.value = cfg.reactivity
  }

  render(target: THREE.WebGLRenderTarget): void {
    this.gl.setRenderTarget(target)
    this.gl.setClearColor(0x060606, 1)
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
