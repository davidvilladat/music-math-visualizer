import * as THREE from 'three'
import type { AudioFeatures } from '../../audio/audioFeatures'

import baseVert from '../fluid/shaders/base.vert?raw'
import novaFrag from './shaders/nova.frag?raw'

interface Ring {
  radius: number
  age:    number
}

const RING_SPEED  = 0.42 // units/second
const RING_DECAY  = 0.55 // age units/second
const RING_TRIGGER_THRESHOLD = 0.65
const RING_REFIRE_AGE        = 0.30 // minimum age before re-trigger

export class NovaScene {
  private gl: THREE.WebGLRenderer

  private scene  = new THREE.Scene()
  private camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1)
  private mat    : THREE.RawShaderMaterial
  private geo    : THREE.PlaneGeometry

  private specData: Uint8Array<ArrayBuffer>
  private specTex : THREE.DataTexture

  // 3 ring slots — ring with lowest age is "most recent"
  private rings: Ring[] = [
    { radius: 1.5, age: 1.0 },
    { radius: 1.5, age: 1.0 },
    { radius: 1.5, age: 1.0 },
  ]
  private nextRingSlot = 0

  private time = 0

  constructor(gl: THREE.WebGLRenderer, w: number, h: number) {
    this.gl = gl

    this.specData = new Uint8Array(1024 * 4) as Uint8Array<ArrayBuffer>
    for (let i = 0; i < 1024; i++) this.specData[i * 4 + 3] = 255
    this.specTex = new THREE.DataTexture(this.specData, 1024, 1, THREE.RGBAFormat)
    this.specTex.magFilter = THREE.LinearFilter
    this.specTex.minFilter = THREE.LinearFilter
    this.specTex.needsUpdate = true

    this.mat = new THREE.RawShaderMaterial({
      vertexShader:   baseVert,
      fragmentShader: novaFrag,
      uniforms: {
        uSpectrum:      { value: this.specTex },
        uBass:          { value: 0 },
        uMid:           { value: 0 },
        uBrilliance:    { value: 0 },
        uBeatPulse:     { value: 0 },
        uTime:          { value: 0 },
        uCoreIntensity: { value: 1.0 },
        uResolution:    { value: new THREE.Vector2(w, h) },
        uRing0: { value: new THREE.Vector2(1.5, 1.0) },
        uRing1: { value: new THREE.Vector2(1.5, 1.0) },
        uRing2: { value: new THREE.Vector2(1.5, 1.0) },
      },
      depthTest:  false,
      depthWrite: false,
    })

    this.geo = new THREE.PlaneGeometry(2, 2)
    const mesh = new THREE.Mesh(this.geo, this.mat)
    this.scene.add(mesh)
  }

  update(dt: number, features: AudioFeatures): void {
    this.time += dt

    // Beat → spawn shockwave ring (refire guard: newest ring must be old enough)
    const youngest = this.rings.reduce((a, b) => (a.age < b.age ? a : b))
    const impact = Math.max(features.beatPulse, features.kickPulse, features.downbeatPulse)
    if (impact > RING_TRIGGER_THRESHOLD && youngest.age > RING_REFIRE_AGE) {
      const slot = this.nextRingSlot % 3
      this.rings[slot] = { radius: 0, age: 0 }
      this.nextRingSlot++
    }

    // Advance all rings
    for (const ring of this.rings) {
      if (ring.age < 1.0) {
        ring.radius += dt * RING_SPEED
        ring.age     = Math.min(1.0, ring.age + dt * RING_DECAY)
      }
    }

    // Upload spectrum
    const spec = features.spectrum
    const len  = Math.min(spec.length, 1024)
    for (let i = 0; i < len; i++) this.specData[i * 4] = Math.floor(spec[i] * 255)
    this.specTex.needsUpdate = true

    const u = this.mat.uniforms
    u.uTime.value       = this.time
    u.uBass.value       = features.normalized.bass
    u.uMid.value        = features.normalized.mid
    u.uBrilliance.value = features.normalized.brilliance
    u.uBeatPulse.value  = impact

    u.uRing0.value.set(this.rings[0].radius, this.rings[0].age)
    u.uRing1.value.set(this.rings[1].radius, this.rings[1].age)
    u.uRing2.value.set(this.rings[2].radius, this.rings[2].age)
  }

  render(target: THREE.WebGLRenderTarget): void {
    this.gl.setRenderTarget(target)
    this.gl.setClearColor(0x000000, 1)
    this.gl.clear(true, false, false)
    this.gl.render(this.scene, this.camera)
    this.gl.setRenderTarget(null)
  }

  resize(w: number, h: number): void {
    this.mat.uniforms.uResolution.value.set(w, h)
  }

  dispose(): void {
    this.specTex.dispose()
    this.geo.dispose()
    this.mat.dispose()
  }
}
