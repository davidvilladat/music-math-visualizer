import * as THREE from 'three'
import { DoubleFBO } from '../fluid/FBO'

import baseVert from '../fluid/shaders/base.vert?raw'
import thresholdFrag from './shaders/threshold.frag?raw'
import blurFrag from './shaders/blur.frag?raw'
import compositeFrag from './shaders/composite.frag?raw'

export interface PostConfig {
  bloomThreshold: number
  bloomKnee: number
  bloomStrength: number
  aberration: number       // already audio-modulated by caller
  vignetteStrength: number
}

export class PostProcessStack {
  private gl: THREE.WebGLRenderer

  // Full-res source — fluid renders INTO this
  sourceRT: THREE.WebGLRenderTarget
  // Half-res ping-pong for blur passes
  private bloomRT: DoubleFBO

  // Shared full-screen quad
  private quadScene: THREE.Scene
  private quadCamera: THREE.OrthographicCamera
  private quadMesh: THREE.Mesh

  // Materials
  private mThreshold: THREE.RawShaderMaterial
  private mBlur: THREE.RawShaderMaterial
  private mComposite: THREE.RawShaderMaterial

  private bw: number  // bloom (half-res) width
  private bh: number

  constructor(gl: THREE.WebGLRenderer, w: number, h: number) {
    this.gl = gl
    this.bw = Math.max(1, Math.floor(w / 2))
    this.bh = Math.max(1, Math.floor(h / 2))

    this.sourceRT = this.makeSourceRT(w, h)
    this.bloomRT  = this.makeBloomRT(this.bw, this.bh)

    const geo = new THREE.PlaneGeometry(2, 2)
    this.quadMesh = new THREE.Mesh(geo)
    this.quadScene = new THREE.Scene()
    this.quadScene.add(this.quadMesh)
    this.quadCamera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1)

    this.mThreshold = this.makeMat(thresholdFrag, {
      uScene:     { value: null as THREE.Texture | null },
      threshold:  { value: 0.5 },
      knee:       { value: 0.1 },
    })

    this.mBlur = this.makeMat(blurFrag, {
      uSource:  { value: null as THREE.Texture | null },
      blurDir:  { value: new THREE.Vector2() },
    })

    this.mComposite = this.makeMat(compositeFrag, {
      uScene:          { value: null as THREE.Texture | null },
      uBloom:          { value: null as THREE.Texture | null },
      bloomStrength:   { value: 1.5 },
      aberration:      { value: 0.005 },
      vignetteStrength:{ value: 2.2 },
    })
  }

  // ── public API ─────────────────────────────────────────────────────────────

  render(cfg: PostConfig): void {
    const bts = new THREE.Vector2(1 / this.bw, 1 / this.bh)

    // 1. Threshold + downsample: source → bloomRT.write
    this.mThreshold.uniforms.uScene.value    = this.sourceRT.texture
    this.mThreshold.uniforms.threshold.value = cfg.bloomThreshold
    this.mThreshold.uniforms.knee.value      = cfg.bloomKnee
    this.run(this.mThreshold, this.bloomRT.write)
    this.bloomRT.swap()

    // 2–5. Two rounds of separable Gaussian blur (wider spread)
    for (let pass = 0; pass < 2; pass++) {
      // Horizontal
      this.mBlur.uniforms.uSource.value  = this.bloomRT.texture
      this.mBlur.uniforms.blurDir.value  = new THREE.Vector2(bts.x, 0)
      this.run(this.mBlur, this.bloomRT.write)
      this.bloomRT.swap()
      // Vertical
      this.mBlur.uniforms.uSource.value  = this.bloomRT.texture
      this.mBlur.uniforms.blurDir.value  = new THREE.Vector2(0, bts.y)
      this.run(this.mBlur, this.bloomRT.write)
      this.bloomRT.swap()
    }

    // 6. Composite to screen (null = default framebuffer)
    this.mComposite.uniforms.uScene.value           = this.sourceRT.texture
    this.mComposite.uniforms.uBloom.value           = this.bloomRT.texture
    this.mComposite.uniforms.bloomStrength.value    = cfg.bloomStrength
    this.mComposite.uniforms.aberration.value       = cfg.aberration
    this.mComposite.uniforms.vignetteStrength.value = cfg.vignetteStrength
    this.run(this.mComposite, null)
  }

  resize(w: number, h: number): void {
    this.sourceRT.dispose()
    this.bloomRT.dispose()
    this.bw = Math.max(1, Math.floor(w / 2))
    this.bh = Math.max(1, Math.floor(h / 2))
    this.sourceRT = this.makeSourceRT(w, h)
    this.bloomRT  = this.makeBloomRT(this.bw, this.bh)
  }

  dispose(): void {
    this.sourceRT.dispose()
    this.bloomRT.dispose()
    this.quadMesh.geometry.dispose()
    ;[this.mThreshold, this.mBlur, this.mComposite].forEach((m) => m.dispose())
  }

  // ── private ────────────────────────────────────────────────────────────────

  private run(mat: THREE.RawShaderMaterial, target: THREE.WebGLRenderTarget | null): void {
    this.quadMesh.material = mat
    this.gl.setRenderTarget(target)
    this.gl.render(this.quadScene, this.quadCamera)
    this.gl.setRenderTarget(null)
  }

  private makeSourceRT(w: number, h: number): THREE.WebGLRenderTarget {
    return new THREE.WebGLRenderTarget(w, h, {
      minFilter: THREE.LinearFilter,
      magFilter: THREE.LinearFilter,
      format: THREE.RGBAFormat,
      type: THREE.HalfFloatType,
      depthBuffer: false,
      stencilBuffer: false,
    })
  }

  private makeBloomRT(w: number, h: number): DoubleFBO {
    return new DoubleFBO(w, h, THREE.RGBAFormat, THREE.HalfFloatType)
  }

  private makeMat(
    frag: string,
    uniforms: Record<string, THREE.IUniform>
  ): THREE.RawShaderMaterial {
    return new THREE.RawShaderMaterial({
      vertexShader: baseVert,
      fragmentShader: frag,
      uniforms,
      depthTest: false,
      depthWrite: false,
    })
  }
}
