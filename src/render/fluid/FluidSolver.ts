import * as THREE from 'three'
import { DoubleFBO, SingleFBO } from './FBO'

import baseVert from './shaders/base.vert?raw'
import splatFrag from './shaders/splat.frag?raw'
import advectFrag from './shaders/advect.frag?raw'
import divergenceFrag from './shaders/divergence.frag?raw'
import curlFrag from './shaders/curl.frag?raw'
import vorticityFrag from './shaders/vorticity.frag?raw'
import pressureFrag from './shaders/pressure.frag?raw'
import gradSubtractFrag from './shaders/gradSubtract.frag?raw'
import psiSplatFrag from './shaders/psiSplat.frag?raw'
import lorentzForceFrag from './shaders/lorentzForce.frag?raw'
import displayFrag from './shaders/display.frag?raw'

export interface FluidConfig {
  simResolution: number
  dyeResolution: number
  densityDissipation: number
  velocityDissipation: number
  pressureIterations: number
  curlStrength: number
  splatRadius: number
  splatForce: number
  // MHD
  magneticReynolds: number    // Lorentz coupling (0 = off, 0–5)
  psiDissipation: number      // ψ decay per frame (0.995–1.0)
  fieldLineBrightness: number // visual intensity of field lines (0–2)
  lineCount: number           // how many isoline bands (10–50)
}

export const DEFAULT_FLUID_CONFIG: FluidConfig = {
  simResolution: 256,
  dyeResolution: 512,
  densityDissipation: 0.98,
  velocityDissipation: 0.98,
  pressureIterations: 40,
  curlStrength: 35,
  splatRadius: 0.25,
  splatForce: 6000,
  magneticReynolds: 0,
  psiDissipation: 0.998,
  fieldLineBrightness: 0,
  lineCount: 24,
}

export interface SplatInput {
  x: number
  y: number
  dx: number
  dy: number
  color: [number, number, number]
}

export interface DipoleInput {
  x: number           // UV [0,1]
  y: number
  angle: number       // dipole axis angle in radians
  strength: number    // ψ amplitude
  radius: number      // gaussian radius (UV)
}

export class FluidSolver {
  private gl: THREE.WebGLRenderer

  // FBOs
  private velocity: DoubleFBO
  private dye: DoubleFBO
  private psi: DoubleFBO      // magnetic stream function
  private divergence: SingleFBO
  private curl: SingleFBO
  private pressure: DoubleFBO

  // Shared quad
  private quadScene: THREE.Scene
  private quadCamera: THREE.OrthographicCamera
  private quadMesh: THREE.Mesh

  // Materials
  private mSplat: THREE.RawShaderMaterial
  private mAdvect: THREE.RawShaderMaterial
  private mDivergence: THREE.RawShaderMaterial
  private mCurl: THREE.RawShaderMaterial
  private mVorticity: THREE.RawShaderMaterial
  private mPressure: THREE.RawShaderMaterial
  private mGradSubtract: THREE.RawShaderMaterial
  private mPsiSplat: THREE.RawShaderMaterial
  private mLorentz: THREE.RawShaderMaterial
  private mDisplay: THREE.RawShaderMaterial

  private config: FluidConfig
  private simW: number
  private simH: number
  private dyeW: number
  private dyeH: number
  private aspectRatio: number

  pendingSplats: SplatInput[] = []
  pendingDipoles: DipoleInput[] = []

  constructor(gl: THREE.WebGLRenderer, config: Partial<FluidConfig> = {}) {
    this.gl = gl
    this.config = { ...DEFAULT_FLUID_CONFIG, ...config }

    const canvas = gl.domElement
    this.aspectRatio = canvas.width / canvas.height

    this.simW = this.config.simResolution
    this.simH = Math.round(this.config.simResolution / this.aspectRatio)
    this.dyeW = this.config.dyeResolution
    this.dyeH = Math.round(this.config.dyeResolution / this.aspectRatio)

    const hf = THREE.HalfFloatType
    const rgba = THREE.RGBAFormat

    this.velocity   = new DoubleFBO(this.simW, this.simH, rgba, hf)
    this.dye        = new DoubleFBO(this.dyeW, this.dyeH, rgba, hf)
    this.psi        = new DoubleFBO(this.simW, this.simH, rgba, hf)
    this.divergence = new SingleFBO(this.simW, this.simH, rgba, hf)
    this.curl       = new SingleFBO(this.simW, this.simH, rgba, hf)
    this.pressure   = new DoubleFBO(this.simW, this.simH, rgba, hf)

    const geo = new THREE.PlaneGeometry(2, 2)
    this.quadMesh = new THREE.Mesh(geo)
    this.quadScene = new THREE.Scene()
    this.quadScene.add(this.quadMesh)
    this.quadCamera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1)

    this.mSplat        = this.makeMat(splatFrag,        this.splatUniforms())
    this.mAdvect       = this.makeMat(advectFrag,       this.advectUniforms())
    this.mDivergence   = this.makeMat(divergenceFrag,   this.divUniforms())
    this.mCurl         = this.makeMat(curlFrag,         this.curlUniforms())
    this.mVorticity    = this.makeMat(vorticityFrag,    this.vorticityUniforms())
    this.mPressure     = this.makeMat(pressureFrag,     this.pressureUniforms())
    this.mGradSubtract = this.makeMat(gradSubtractFrag, this.gradUniforms())
    this.mPsiSplat     = this.makeMat(psiSplatFrag,     this.psiSplatUniforms())
    this.mLorentz      = this.makeMat(lorentzForceFrag, this.lorentzUniforms())
    this.mDisplay      = this.makeMat(displayFrag,      this.displayUniforms())
  }

  // ── public API ─────────────────────────────────────────────────────────────

  step(dt: number, cfg?: Partial<FluidConfig>): void {
    if (cfg) this.config = { ...this.config, ...cfg }

    const ts = new THREE.Vector2(1 / this.simW, 1 / this.simH)

    // 1. Velocity + dye splats
    for (const s of this.pendingSplats) this.runSplat(s)
    this.pendingSplats = []

    // 2. Magnetic dipole injections into ψ
    for (const d of this.pendingDipoles) this.runPsiSplat(d)
    this.pendingDipoles = []

    // 3. Curl
    this.mCurl.uniforms.uVelocity.value = this.velocity.texture
    this.mCurl.uniforms.texelSize.value = ts
    this.run(this.mCurl, this.curl.target)

    // 4. Vorticity confinement
    this.mVorticity.uniforms.uVelocity.value   = this.velocity.texture
    this.mVorticity.uniforms.uCurl.value        = this.curl.texture
    this.mVorticity.uniforms.texelSize.value    = ts
    this.mVorticity.uniforms.curlStrength.value = this.config.curlStrength
    this.mVorticity.uniforms.dt.value           = dt
    this.run(this.mVorticity, this.velocity.write)
    this.velocity.swap()

    // 5. Lorentz force: J×B → velocity (only when Rm > 0)
    if (this.config.magneticReynolds > 0) {
      this.mLorentz.uniforms.uVelocity.value = this.velocity.texture
      this.mLorentz.uniforms.uPsi.value      = this.psi.texture
      this.mLorentz.uniforms.texelSize.value = ts
      this.mLorentz.uniforms.Rm.value        = this.config.magneticReynolds
      this.mLorentz.uniforms.dt.value        = dt
      this.run(this.mLorentz, this.velocity.write)
      this.velocity.swap()
    }

    // 6. Divergence
    this.mDivergence.uniforms.uVelocity.value = this.velocity.texture
    this.mDivergence.uniforms.texelSize.value = ts
    this.run(this.mDivergence, this.divergence.target)

    // 7. Pressure Jacobi
    for (let i = 0; i < this.config.pressureIterations; i++) {
      this.mPressure.uniforms.uPressure.value   = this.pressure.texture
      this.mPressure.uniforms.uDivergence.value = this.divergence.texture
      this.mPressure.uniforms.texelSize.value   = ts
      this.run(this.mPressure, this.pressure.write)
      this.pressure.swap()
    }

    // 8. Gradient subtract
    this.mGradSubtract.uniforms.uPressure.value = this.pressure.texture
    this.mGradSubtract.uniforms.uVelocity.value = this.velocity.texture
    this.mGradSubtract.uniforms.texelSize.value = ts
    this.run(this.mGradSubtract, this.velocity.write)
    this.velocity.swap()

    // 9. Advect velocity
    this.mAdvect.uniforms.uVelocity.value   = this.velocity.texture
    this.mAdvect.uniforms.uSource.value     = this.velocity.texture
    this.mAdvect.uniforms.texelSize.value   = ts
    this.mAdvect.uniforms.dt.value          = dt
    this.mAdvect.uniforms.dissipation.value = this.config.velocityDissipation
    this.run(this.mAdvect, this.velocity.write)
    this.velocity.swap()

    // 10. Advect dye
    this.mAdvect.uniforms.uVelocity.value   = this.velocity.texture
    this.mAdvect.uniforms.uSource.value     = this.dye.texture
    this.mAdvect.uniforms.texelSize.value   = ts
    this.mAdvect.uniforms.dt.value          = dt
    this.mAdvect.uniforms.dissipation.value = this.config.densityDissipation
    this.run(this.mAdvect, this.dye.write)
    this.dye.swap()

    // 11. Advect ψ along velocity (field is frozen into the fluid)
    this.mAdvect.uniforms.uVelocity.value   = this.velocity.texture
    this.mAdvect.uniforms.uSource.value     = this.psi.texture
    this.mAdvect.uniforms.texelSize.value   = ts
    this.mAdvect.uniforms.dt.value          = dt
    this.mAdvect.uniforms.dissipation.value = this.config.psiDissipation
    this.run(this.mAdvect, this.psi.write)
    this.psi.swap()
  }

  display(target: THREE.WebGLRenderTarget | null = null): void {
    const ts = new THREE.Vector2(1 / this.simW, 1 / this.simH)
    this.mDisplay.uniforms.uDye.value                = this.dye.texture
    this.mDisplay.uniforms.uPsi.value                = this.psi.texture
    this.mDisplay.uniforms.texelSize.value           = ts
    this.mDisplay.uniforms.fieldLineBrightness.value = this.config.fieldLineBrightness
    this.mDisplay.uniforms.lineCount.value           = this.config.lineCount
    this.run(this.mDisplay, target)
  }

  addSplat(s: SplatInput): void { this.pendingSplats.push(s) }

  addMagneticDipole(d: DipoleInput): void { this.pendingDipoles.push(d) }

  updateAspect(aspect: number): void { this.aspectRatio = aspect }

  get velocityTexture(): THREE.Texture { return this.velocity.texture }
  get psiTexture(): THREE.Texture { return this.psi.texture }
  get simTexelSize(): THREE.Vector2 { return new THREE.Vector2(1 / this.simW, 1 / this.simH) }

  dispose(): void {
    this.velocity.dispose()
    this.dye.dispose()
    this.psi.dispose()
    this.divergence.dispose()
    this.curl.dispose()
    this.pressure.dispose()
    ;[
      this.mSplat, this.mAdvect, this.mDivergence, this.mCurl,
      this.mVorticity, this.mPressure, this.mGradSubtract,
      this.mPsiSplat, this.mLorentz, this.mDisplay,
    ].forEach((m) => m.dispose())
  }

  // ── private ────────────────────────────────────────────────────────────────

  private run(mat: THREE.RawShaderMaterial, target: THREE.WebGLRenderTarget | null): void {
    this.quadMesh.material = mat
    this.gl.setRenderTarget(target)
    this.gl.render(this.quadScene, this.quadCamera)
    this.gl.setRenderTarget(null)
  }

  private runSplat(s: SplatInput): void {
    // Velocity
    this.mSplat.uniforms.uTarget.value     = this.velocity.texture
    this.mSplat.uniforms.point.value       = new THREE.Vector2(s.x, s.y)
    this.mSplat.uniforms.color.value       = new THREE.Vector3(s.dx, s.dy, 0)
    this.mSplat.uniforms.radius.value      = this.correctRadius(this.config.splatRadius / 100)
    this.mSplat.uniforms.aspectRatio.value = this.aspectRatio
    this.run(this.mSplat, this.velocity.write)
    this.velocity.swap()
    // Dye
    this.mSplat.uniforms.uTarget.value = this.dye.texture
    this.mSplat.uniforms.color.value   = new THREE.Vector3(...s.color)
    this.run(this.mSplat, this.dye.write)
    this.dye.swap()
  }

  private runPsiSplat(d: DipoleInput): void {
    this.mPsiSplat.uniforms.uPsi.value         = this.psi.texture
    this.mPsiSplat.uniforms.point.value        = new THREE.Vector2(d.x, d.y)
    this.mPsiSplat.uniforms.orientation.value  = new THREE.Vector2(Math.cos(d.angle), Math.sin(d.angle))
    this.mPsiSplat.uniforms.strength.value     = d.strength
    this.mPsiSplat.uniforms.radius.value       = d.radius
    this.mPsiSplat.uniforms.aspectRatio.value  = this.aspectRatio
    this.run(this.mPsiSplat, this.psi.write)
    this.psi.swap()
  }

  private correctRadius(r: number): number {
    return this.aspectRatio > 1 ? r * r : r * r * this.aspectRatio * this.aspectRatio
  }

  private makeMat(frag: string, uniforms: Record<string, THREE.IUniform>): THREE.RawShaderMaterial {
    return new THREE.RawShaderMaterial({
      vertexShader: baseVert,
      fragmentShader: frag,
      uniforms,
      depthTest: false,
      depthWrite: false,
    })
  }

  private splatUniforms() {
    return {
      uTarget:     { value: null as THREE.Texture | null },
      aspectRatio: { value: this.aspectRatio },
      color:       { value: new THREE.Vector3() },
      point:       { value: new THREE.Vector2() },
      radius:      { value: 0.25 },
    }
  }

  private advectUniforms() {
    return {
      uVelocity:   { value: null as THREE.Texture | null },
      uSource:     { value: null as THREE.Texture | null },
      texelSize:   { value: new THREE.Vector2(1 / this.simW, 1 / this.simH) },
      dt:          { value: 0 },
      dissipation: { value: 1 },
    }
  }

  private divUniforms() {
    return {
      uVelocity: { value: null as THREE.Texture | null },
      texelSize: { value: new THREE.Vector2(1 / this.simW, 1 / this.simH) },
    }
  }

  private curlUniforms() {
    return {
      uVelocity: { value: null as THREE.Texture | null },
      texelSize: { value: new THREE.Vector2(1 / this.simW, 1 / this.simH) },
    }
  }

  private vorticityUniforms() {
    return {
      uVelocity:    { value: null as THREE.Texture | null },
      uCurl:        { value: null as THREE.Texture | null },
      texelSize:    { value: new THREE.Vector2(1 / this.simW, 1 / this.simH) },
      curlStrength: { value: 30 },
      dt:           { value: 0 },
    }
  }

  private pressureUniforms() {
    return {
      uPressure:   { value: null as THREE.Texture | null },
      uDivergence: { value: null as THREE.Texture | null },
      texelSize:   { value: new THREE.Vector2(1 / this.simW, 1 / this.simH) },
    }
  }

  private gradUniforms() {
    return {
      uPressure:  { value: null as THREE.Texture | null },
      uVelocity:  { value: null as THREE.Texture | null },
      texelSize:  { value: new THREE.Vector2(1 / this.simW, 1 / this.simH) },
    }
  }

  private psiSplatUniforms() {
    return {
      uPsi:        { value: null as THREE.Texture | null },
      point:       { value: new THREE.Vector2() },
      orientation: { value: new THREE.Vector2(1, 0) },
      strength:    { value: 1 },
      radius:      { value: 0.15 },
      aspectRatio: { value: this.aspectRatio },
    }
  }

  private lorentzUniforms() {
    return {
      uVelocity: { value: null as THREE.Texture | null },
      uPsi:      { value: null as THREE.Texture | null },
      texelSize: { value: new THREE.Vector2(1 / this.simW, 1 / this.simH) },
      Rm:        { value: 0 },
      dt:        { value: 0 },
    }
  }

  private displayUniforms() {
    return {
      uDye:                { value: null as THREE.Texture | null },
      uPsi:                { value: null as THREE.Texture | null },
      texelSize:           { value: new THREE.Vector2(1 / this.simW, 1 / this.simH) },
      fieldLineBrightness: { value: 0 },
      lineCount:           { value: 24 },
    }
  }
}
