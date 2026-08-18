import * as THREE from 'three'
import type { AudioFeatures } from '../../audio/audioFeatures'

import aircraftVert from './shaders/aircraft.vert?raw'
import aircraftFrag from './shaders/aircraft.frag?raw'

export interface AircraftDevParams {
  variant: number
  speed: number
  tempoReactivity: number
  reactivity: number
  beatGate: number
}

export type AircraftVariantStatus = 'ready' | 'compiling' | 'failed' | 'idle'

export interface AircraftPreloadProgress {
  ready: number
  compiling: number
  failed: number
  total: number
  percent: number
}

const POINT_COUNT = 90_000
const T_RATE = Math.PI / 90 * 60

// All 12 per-variant samplers inlined into one program take ~3 minutes to link
// on ANGLE/D3D11 (a superlinear FXC blowup), which froze the tab when switching
// to aviation. Instead we compile one program per variant — gated by a
// `#define AIRCRAFT_VARIANT` so only that variant's sampler survives dead-code
// elimination — which links in ~2s. Programs are built lazily on first use and
// compiled asynchronously (KHR_parallel_shader_compile when available) so the
// switch never blocks the main thread; we render the variant only once ready.
export class AircraftScene {
  private gl: THREE.WebGLRenderer
  private camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1)
  private geo: THREE.BufferGeometry
  private w: number
  private h: number

  private scenes      = new Map<number, THREE.Scene>()
  private materials   = new Map<number, THREE.RawShaderMaterial>()
  private ready       = new Set<number>()
  private compiling   = new Set<number>()
  private failed      = new Set<number>()
  private current     = 0

  private time = 0
  private motionRate = 1

  constructor(gl: THREE.WebGLRenderer, w: number, h: number) {
    this.gl = gl
    this.w = w
    this.h = h

    const indices = new Float32Array(POINT_COUNT)
    for (let i = 0; i < POINT_COUNT; i++) indices[i] = i

    const positions = new Float32Array(POINT_COUNT * 3)
    this.geo = new THREE.BufferGeometry()
    this.geo.setAttribute('position', new THREE.BufferAttribute(positions, 3))
    this.geo.setAttribute('aIndex', new THREE.BufferAttribute(indices, 1))
  }

  private materialFor(variant: number): THREE.RawShaderMaterial {
    let mat = this.materials.get(variant)
    if (!mat) {
      mat = new THREE.RawShaderMaterial({
        vertexShader: `#define AIRCRAFT_VARIANT ${variant}\n${aircraftVert}`,
        fragmentShader: aircraftFrag,
        uniforms: {
          uTime: { value: 0 },
          uVariant: { value: variant },
          uBass: { value: 0 },
          uMid: { value: 0 },
          uBrilliance: { value: 0 },
          uFlux: { value: 0 },
          uBeatPulse: { value: 0 },
          uRms: { value: 0 },
          uReactivity: { value: 1 },
          uResolution: { value: new THREE.Vector2(this.w, this.h) },
        },
        blending: THREE.AdditiveBlending,
        transparent: true,
        depthTest: false,
        depthWrite: false,
      })
      this.materials.set(variant, mat)
    }
    return mat
  }

  private sceneFor(variant: number): THREE.Scene {
    let scene = this.scenes.get(variant)
    if (!scene) {
      const points = new THREE.Points(this.geo, this.materialFor(variant))
      points.frustumCulled = false
      scene = new THREE.Scene()
      scene.add(points)
      this.scenes.set(variant, scene)
    }
    return scene
  }

  preloadVariant(variant: number): Promise<'ready' | 'failed'> {
    return this.ensureCompiled(variant)
  }

  getVariantStatus(variant = this.current): AircraftVariantStatus {
    if (this.ready.has(variant)) return 'ready'
    if (this.failed.has(variant)) return 'failed'
    if (this.compiling.has(variant)) return 'compiling'
    return 'idle'
  }

  getPreloadProgress(total: number): AircraftPreloadProgress {
    return {
      ready: this.ready.size,
      compiling: this.compiling.size,
      failed: this.failed.size,
      total,
      percent: total > 0 ? Math.round((this.ready.size / total) * 100) : 0,
    }
  }

  // Kick off an async compile for a variant's program (once). compileAsync uses
  // parallel shader compile when supported, so the ~2s link runs off-thread.
  private ensureCompiled(variant: number): Promise<'ready' | 'failed'> {
    if (this.ready.has(variant)) return Promise.resolve('ready')
    if (this.failed.has(variant)) return Promise.resolve('failed')
    if (this.compiling.has(variant)) {
      return new Promise((resolve) => {
        const check = () => {
          const status = this.getVariantStatus(variant)
          if (status === 'ready' || status === 'failed') resolve(status)
          else window.setTimeout(check, 100)
        }
        check()
      })
    }
    this.compiling.add(variant)
    const scene = this.sceneFor(variant)
    return this.gl.compileAsync(scene, this.camera)
      .then(() => {
        this.ready.add(variant)
        this.failed.delete(variant)
        return 'ready' as const
      })
      .catch(() => {
        this.failed.add(variant)
        return 'failed' as const
      })
      .finally(() => {
        this.compiling.delete(variant)
      })
  }

  update(dt: number, features: AudioFeatures, cfg: AircraftDevParams): void {
    this.current = cfg.variant
    this.ensureCompiled(cfg.variant)

    const bpmRate = features.bpm && features.bpmConfidence > 0.25
      ? Math.max(0.5, Math.min(1.65, features.bpm / 120))
      : 1
    const tempo = 1 + (bpmRate - 1) * cfg.tempoReactivity * Math.max(0.25, features.bpmConfidence)
    const energy = 1 + features.rms * 0.18 * cfg.reactivity * cfg.beatGate
    const targetRate = Math.max(0.25, Math.min(2.4, tempo * energy))
    const follow = 1 - Math.exp(-dt * 4)
    this.motionRate += (targetRate - this.motionRate) * follow
    this.time += dt * T_RATE * cfg.speed * this.motionRate

    const u = this.materialFor(cfg.variant).uniforms
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
    // Until the active variant's program has finished compiling, show the cleared
    // background rather than blocking on a synchronous link.
    if (this.ready.has(this.current)) {
      this.gl.autoClear = false
      this.gl.render(this.sceneFor(this.current), this.camera)
      this.gl.autoClear = true
    }
    this.gl.setRenderTarget(null)
  }

  resize(w: number, h: number): void {
    this.w = w
    this.h = h
    this.materials.forEach((mat) => mat.uniforms.uResolution.value.set(w, h))
  }

  dispose(): void {
    this.geo.dispose()
    this.materials.forEach((mat) => mat.dispose())
    this.materials.clear()
    this.scenes.clear()
    this.ready.clear()
    this.compiling.clear()
    this.failed.clear()
  }
}
