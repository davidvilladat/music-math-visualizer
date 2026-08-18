import * as THREE from 'three'
import type { AudioFeatures } from '../../audio/audioFeatures'

import baseVert      from '../fluid/shaders/base.vert?raw'
import plasmaFrag    from './shaders/plasma.frag?raw'
import waveformFrag  from './shaders/waveform.frag?raw'
import lightningVert from './shaders/lightning.vert?raw'
import lightningFrag from './shaders/lightning.frag?raw'

export interface ElectricDevParams {
  plasmaSpeed: number
  plasmaIntensity: number
  waveAmplitude: number
  waveIntensity: number
  electricLightningCount: number
}

const MAX_BOLT_VERTS = 2048 // 1024 line segments × 2 endpoints

export class ElectricScene {
  private gl: THREE.WebGLRenderer

  // Shared full-screen quad
  private quadScene  = new THREE.Scene()
  private quadCamera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1)
  private quadMesh   : THREE.Mesh

  // Spectrum texture: 1024×1 RGBA UByte, R = amplitude
  private specData: Uint8Array<ArrayBuffer>
  private specTex : THREE.DataTexture

  // Materials
  private mPlasma: THREE.RawShaderMaterial
  private mWave  : THREE.RawShaderMaterial

  // Lightning
  private boltScene     = new THREE.Scene()
  private boltGeo       : THREE.BufferGeometry
  private boltPositions : Float32Array
  private boltMesh      : THREE.LineSegments
  private mBolt         : THREE.RawShaderMaterial
  private boltAge       = 1.0 // 0 = fresh, 1 = dead
  private boltDecay     = 2.2 // age units per second

  private time   = 0
  private aspect = 16 / 9

  constructor(gl: THREE.WebGLRenderer, w: number, h: number) {
    this.gl     = gl
    this.aspect = w / h

    // ── Spectrum texture ────────────────────────────────────────────────────
    this.specData = new Uint8Array(1024 * 4) as Uint8Array<ArrayBuffer>
    for (let i = 0; i < 1024; i++) this.specData[i * 4 + 3] = 255
    this.specTex = new THREE.DataTexture(this.specData, 1024, 1, THREE.RGBAFormat)
    this.specTex.magFilter = THREE.LinearFilter
    this.specTex.minFilter = THREE.LinearFilter
    this.specTex.needsUpdate = true

    // ── Quad ────────────────────────────────────────────────────────────────
    const geo = new THREE.PlaneGeometry(2, 2)
    this.quadMesh = new THREE.Mesh(geo)
    this.quadScene.add(this.quadMesh)

    // ── Plasma (opaque background) ──────────────────────────────────────────
    this.mPlasma = new THREE.RawShaderMaterial({
      vertexShader:   baseVert,
      fragmentShader: plasmaFrag,
      uniforms: {
        uTime:       { value: 0 },
        uBass:       { value: 0 },
        uBrilliance: { value: 0 },
        uSpeed:      { value: 0.8 },
        uIntensity:  { value: 0.5 },
      },
      depthTest:  false,
      depthWrite: false,
    })

    // ── Waveform (additive) ─────────────────────────────────────────────────
    this.mWave = new THREE.RawShaderMaterial({
      vertexShader:   baseVert,
      fragmentShader: waveformFrag,
      uniforms: {
        uSpectrum:   { value: this.specTex },
        uBass:       { value: 0 },
        uAmplitude:  { value: 0.35 },
        uIntensity:  { value: 2.0 },
        uResolution: { value: new THREE.Vector2(w, h) },
      },
      blending:    THREE.AdditiveBlending,
      transparent: true,
      depthTest:   false,
      depthWrite:  false,
    })

    // ── Lightning ───────────────────────────────────────────────────────────
    this.boltPositions = new Float32Array(MAX_BOLT_VERTS * 3)
    this.boltGeo = new THREE.BufferGeometry()
    const posAttr = new THREE.BufferAttribute(this.boltPositions, 3)
    posAttr.setUsage(THREE.DynamicDrawUsage)
    this.boltGeo.setAttribute('position', posAttr)
    this.boltGeo.setDrawRange(0, 0)

    this.mBolt = new THREE.RawShaderMaterial({
      vertexShader:   lightningVert,
      fragmentShader: lightningFrag,
      uniforms: {
        uAge: { value: 1.0 },
      },
      blending:    THREE.AdditiveBlending,
      transparent: true,
      depthTest:   false,
      depthWrite:  false,
    })

    this.boltMesh = new THREE.LineSegments(this.boltGeo, this.mBolt)
    this.boltScene.add(this.boltMesh)
  }

  // ── public API ─────────────────────────────────────────────────────────────

  update(dt: number, features: AudioFeatures, cfg: ElectricDevParams): void {
    this.time += dt

    // Upload spectrum (R channel, 0-255)
    const spec = features.spectrum
    const len  = Math.min(spec.length, 1024)
    for (let i = 0; i < len; i++) {
      this.specData[i * 4] = Math.floor(spec[i] * 255)
    }
    this.specTex.needsUpdate = true

    // Plasma uniforms
    this.mPlasma.uniforms.uTime.value       = this.time
    this.mPlasma.uniforms.uBass.value       = features.normalized.bass
    this.mPlasma.uniforms.uBrilliance.value = features.normalized.brilliance
    this.mPlasma.uniforms.uSpeed.value      = cfg.plasmaSpeed
    this.mPlasma.uniforms.uIntensity.value  = cfg.plasmaIntensity

    // Waveform uniforms
    this.mWave.uniforms.uBass.value      = features.normalized.bass
    this.mWave.uniforms.uAmplitude.value = cfg.waveAmplitude
    this.mWave.uniforms.uIntensity.value = cfg.waveIntensity

    // Beat → spawn lightning bolts
    if (Math.max(features.beatPulse, features.snarePulse, features.hatPulse * 0.7) > 0.5 && this.boltAge > 0.35) {
      this.spawnLightning(cfg.electricLightningCount)
      this.boltAge = 0
    }
    this.boltAge = Math.min(1.0, this.boltAge + dt * this.boltDecay)
    this.mBolt.uniforms.uAge.value = this.boltAge
  }

  render(target: THREE.WebGLRenderTarget): void {
    // 1. Clear and draw opaque plasma background
    this.gl.setRenderTarget(target)
    this.gl.setClearColor(0x000000, 1)
    this.gl.clear(true, false, false)
    this.quadMesh.material = this.mPlasma
    this.gl.autoClear = false
    this.gl.render(this.quadScene, this.quadCamera)

    // 2. Waveform on top (additive)
    this.quadMesh.material = this.mWave
    this.gl.render(this.quadScene, this.quadCamera)

    // 3. Lightning bolts (additive, skip when fully dead)
    if (this.boltAge < 0.98) {
      this.gl.render(this.boltScene, this.quadCamera)
    }

    this.gl.autoClear = true
    this.gl.setRenderTarget(null)
  }

  resize(w: number, h: number): void {
    this.aspect = w / h
    this.mWave.uniforms.uResolution.value.set(w, h)
  }

  dispose(): void {
    this.specTex.dispose()
    this.quadMesh.geometry.dispose()
    ;[this.mPlasma, this.mWave, this.mBolt].forEach((m) => m.dispose())
    this.boltGeo.dispose()
  }

  // ── private ────────────────────────────────────────────────────────────────

  private spawnLightning(count: number): void {
    const segs: number[] = []
    for (let b = 0; b < count; b++) {
      // Fan bolts evenly around the screen, with jitter
      const angle = (b / count) * Math.PI * 2 + (Math.random() - 0.5) * 0.9
      // Slightly randomized origin near center
      const sx = (Math.random() - 0.5) * 0.25
      const sy = (Math.random() - 0.5) * 0.25
      // Endpoint off-screen, aspect-corrected
      const ex = Math.cos(angle) * 1.35
      const ey = Math.sin(angle) * 1.35 / this.aspect
      this.fractal(sx, sy, ex, ey, 5, 0.32, segs)
    }

    const n = Math.min(segs.length, MAX_BOLT_VERTS * 3)
    for (let i = 0; i < n; i++) this.boltPositions[i] = segs[i]
    ;(this.boltGeo.getAttribute('position') as THREE.BufferAttribute).needsUpdate = true
    this.boltGeo.setDrawRange(0, Math.floor(n / 3))
  }

  private fractal(
    x0: number, y0: number, x1: number, y1: number,
    depth: number, roughness: number, out: number[]
  ): void {
    if (out.length >= MAX_BOLT_VERTS * 3 - 6) return
    if (depth === 0) {
      out.push(x0, y0, 0, x1, y1, 0)
      return
    }
    const mx = (x0 + x1) * 0.5 + (Math.random() - 0.5) * roughness
    const my = (y0 + y1) * 0.5 + (Math.random() - 0.5) * roughness
    this.fractal(x0, y0, mx, my, depth - 1, roughness * 0.62, out)
    this.fractal(mx, my, x1, y1, depth - 1, roughness * 0.62, out)
    // Random branch
    if (Math.random() < 0.35 && depth >= 2) {
      const bx = mx + (Math.random() - 0.5) * roughness * 1.4
      const by = my + (Math.random() - 0.5) * roughness * 1.4
      this.fractal(mx, my, bx, by, depth - 2, roughness * 0.52, out)
    }
  }
}
