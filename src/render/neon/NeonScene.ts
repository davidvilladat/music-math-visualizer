import * as THREE from 'three'
import type { AudioFeatures } from '../../audio/audioFeatures'

import baseVert from '../fluid/shaders/base.vert?raw'
import neonFrag from './shaders/neon.frag?raw'

export class NeonScene {
  private gl: THREE.WebGLRenderer

  private scene  = new THREE.Scene()
  private camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1)
  private mat    : THREE.RawShaderMaterial
  private geo    : THREE.PlaneGeometry

  private specData: Uint8Array<ArrayBuffer>
  private specTex : THREE.DataTexture

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
      fragmentShader: neonFrag,
      uniforms: {
        uSpectrum:   { value: this.specTex },
        uBass:       { value: 0 },
        uMid:        { value: 0 },
        uBrilliance: { value: 0 },
        uBeatPulse:  { value: 0 },
        uResolution: { value: new THREE.Vector2(w, h) },
      },
      depthTest:  false,
      depthWrite: false,
    })

    this.geo = new THREE.PlaneGeometry(2, 2)
    const mesh = new THREE.Mesh(this.geo, this.mat)
    this.scene.add(mesh)
  }

  update(_dt: number, features: AudioFeatures): void {
    const spec = features.spectrum
    const len  = Math.min(spec.length, 1024)
    for (let i = 0; i < len; i++) this.specData[i * 4] = Math.floor(spec[i] * 255)
    this.specTex.needsUpdate = true

    const u = this.mat.uniforms
    u.uBass.value       = features.normalized.bass
    u.uMid.value        = features.normalized.mid
    u.uBrilliance.value = features.normalized.brilliance
    u.uBeatPulse.value  = Math.max(features.beatPulse, features.kickPulse, features.snarePulse * 0.7)
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
