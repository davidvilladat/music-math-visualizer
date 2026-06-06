import * as THREE from 'three'
import { DoubleFBO } from '../fluid/FBO'

import baseVert      from '../fluid/shaders/base.vert?raw'
import advectFrag    from './shaders/particleAdvect.frag?raw'
import particleVert  from './shaders/particle.vert?raw'
import particleFrag  from './shaders/particle.frag?raw'
import decayFrag     from './shaders/trailDecay.frag?raw'
import displayFrag   from './shaders/trailDisplay.frag?raw'

const GRID_W = 512
const GRID_H = 256  // 131 072 particles

export interface ParticleConfig {
  dt: number
  speed: number
  respawnRate: number
  trailDecay: number
  brightness: number
  magneticBlend: number
  pointSize: number
  velocityTex: THREE.Texture
  psiTex: THREE.Texture
  simTexelSize: THREE.Vector2
}

export class ParticleSystem {
  private gl: THREE.WebGLRenderer

  // position ping-pong (x, y, seed, _)
  private posFBO: DoubleFBO
  // trail accumulation (RGBA, HDR)
  private trailFBO: DoubleFBO

  // full-screen quad helpers
  private quadScene   = new THREE.Scene()
  private quadCamera  = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1)
  private quadMesh    : THREE.Mesh
  private pointScene  = new THREE.Scene()

  // point cloud geometry
  private pointsGeo  : THREE.BufferGeometry
  private pointsMesh : THREE.Points

  private mAdvect  : THREE.RawShaderMaterial
  private mDecay   : THREE.RawShaderMaterial
  private mDisplay : THREE.RawShaderMaterial
  private mParticle: THREE.RawShaderMaterial

  constructor(gl: THREE.WebGLRenderer, w: number, h: number) {
    this.gl = gl

    this.posFBO   = this.makeRT(GRID_W, GRID_H)
    this.trailFBO = this.makeRT(w, h)

    // full-screen quad
    const geo = new THREE.PlaneGeometry(2, 2)
    this.quadMesh = new THREE.Mesh(geo)
    this.quadScene.add(this.quadMesh)

    // point cloud — one vertex per particle texel
    this.pointsGeo = new THREE.BufferGeometry()
    const uvs = new Float32Array(GRID_W * GRID_H * 2)
    for (let i = 0; i < GRID_H; i++) {
      for (let j = 0; j < GRID_W; j++) {
        const idx = (i * GRID_W + j) * 2
        uvs[idx]     = (j + 0.5) / GRID_W
        uvs[idx + 1] = (i + 0.5) / GRID_H
      }
    }
    this.pointsGeo.setAttribute('aUv', new THREE.BufferAttribute(uvs, 2))

    this.mAdvect = new THREE.RawShaderMaterial({
      vertexShader:   baseVert,
      fragmentShader: advectFrag,
      uniforms: {
        uPositions:   { value: null as THREE.Texture | null },
        uVelocity:    { value: null as THREE.Texture | null },
        uPsi:         { value: null as THREE.Texture | null },
        simTexelSize: { value: new THREE.Vector2() },
        dt:           { value: 1 / 60 },
        speed:        { value: 8.0 },
        uTime:        { value: 0 },
        respawnRate:  { value: 0.002 },
        magneticBlend:{ value: 0.5 },
      },
      depthTest: false, depthWrite: false,
    })

    this.mParticle = new THREE.RawShaderMaterial({
      vertexShader:   particleVert,
      fragmentShader: particleFrag,
      uniforms: {
        uPositions:  { value: null as THREE.Texture | null },
        uVelocity:   { value: null as THREE.Texture | null },
        uPointSize:  { value: 1.5 },
        uBrightness: { value: 1.0 },
      },
      blending:    THREE.AdditiveBlending,
      transparent: true,
      depthTest:   false,
      depthWrite:  false,
    })
    this.pointsMesh = new THREE.Points(this.pointsGeo, this.mParticle)
    this.pointScene.add(this.pointsMesh)

    this.mDecay = new THREE.RawShaderMaterial({
      vertexShader:   baseVert,
      fragmentShader: decayFrag,
      uniforms: {
        uTrail: { value: null as THREE.Texture | null },
        uDecay: { value: 0.94 },
      },
      depthTest: false, depthWrite: false,
    })

    this.mDisplay = new THREE.RawShaderMaterial({
      vertexShader:   baseVert,
      fragmentShader: displayFrag,
      uniforms: {
        uTrail:      { value: null as THREE.Texture | null },
        uBrightness: { value: 1.0 },
      },
      blending:    THREE.AdditiveBlending,
      transparent: true,
      depthTest:   false,
      depthWrite:  false,
    })

    this.initPositions()
  }

  step(time: number, cfg: ParticleConfig): void {
    const u = this.mAdvect.uniforms
    u.uPositions.value    = this.posFBO.texture
    u.uVelocity.value     = cfg.velocityTex
    u.uPsi.value          = cfg.psiTex
    u.simTexelSize.value  = cfg.simTexelSize
    u.dt.value            = cfg.dt
    u.speed.value         = cfg.speed
    u.uTime.value         = time
    u.respawnRate.value   = cfg.respawnRate
    u.magneticBlend.value = cfg.magneticBlend

    this.runQuad(this.mAdvect, this.posFBO.write)
    this.posFBO.swap()

    // decay trail
    this.mDecay.uniforms.uTrail.value = this.trailFBO.texture
    this.mDecay.uniforms.uDecay.value = cfg.trailDecay
    this.runQuad(this.mDecay, this.trailFBO.write)
    this.trailFBO.swap()

    // render points into trail (additive)
    const pu = this.mParticle.uniforms
    pu.uPositions.value  = this.posFBO.texture
    pu.uVelocity.value   = cfg.velocityTex
    pu.uPointSize.value  = cfg.pointSize
    pu.uBrightness.value = cfg.brightness

    this.gl.setRenderTarget(this.trailFBO.read)
    this.gl.autoClear = false
    this.gl.render(this.pointScene, this.quadCamera)
    this.gl.autoClear = true
    this.gl.setRenderTarget(null)
  }

  renderTrail(target: THREE.WebGLRenderTarget | null, brightness: number): void {
    this.mDisplay.uniforms.uTrail.value      = this.trailFBO.texture
    this.mDisplay.uniforms.uBrightness.value = brightness
    this.runQuad(this.mDisplay, target)
  }

  resize(w: number, h: number): void {
    this.trailFBO.dispose()
    this.trailFBO = this.makeRT(w, h)
  }

  dispose(): void {
    this.posFBO.dispose()
    this.trailFBO.dispose()
    this.quadMesh.geometry.dispose()
    this.pointsGeo.dispose()
    ;[this.mAdvect, this.mParticle, this.mDecay, this.mDisplay].forEach(m => m.dispose())
  }

  // ── private ─────────────────────────────────────────────────────────────────

  private initPositions(): void {
    const data = new Float32Array(GRID_W * GRID_H * 4)
    for (let i = 0; i < GRID_W * GRID_H; i++) {
      data[i * 4]     = Math.random()  // x
      data[i * 4 + 1] = Math.random()  // y
      data[i * 4 + 2] = Math.random()  // seed
      data[i * 4 + 3] = 1.0
    }
    const tex = new THREE.DataTexture(data, GRID_W, GRID_H, THREE.RGBAFormat, THREE.FloatType)
    tex.needsUpdate = true

    const mat = new THREE.RawShaderMaterial({
      vertexShader: baseVert,
      fragmentShader: /* glsl */`
        precision highp float;
        varying vec2 vUv;
        uniform sampler2D uInit;
        void main() { gl_FragColor = texture2D(uInit, vUv); }
      `,
      uniforms: { uInit: { value: tex } },
      depthTest: false, depthWrite: false,
    })
    this.runQuad(mat, this.posFBO.write)
    this.posFBO.swap()
    mat.dispose()
    tex.dispose()
  }

  private runQuad(mat: THREE.RawShaderMaterial, target: THREE.WebGLRenderTarget | null): void {
    this.quadMesh.material = mat
    this.gl.setRenderTarget(target)
    this.gl.render(this.quadScene, this.quadCamera)
    this.gl.setRenderTarget(null)
  }

  private makeRT(w: number, h: number): DoubleFBO {
    return new DoubleFBO(w, h, THREE.RGBAFormat, THREE.FloatType)
  }
}
