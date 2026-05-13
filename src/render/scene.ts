import * as THREE from 'three'
import type { AudioFeatures } from '../audio/audioFeatures'
import vertSrc from './shaders/spectrum.vert?raw'
import fragSrc from './shaders/spectrum.frag?raw'

const BAR_COUNT = 128

export class SpectrumScene {
  readonly scene: THREE.Scene
  private material: THREE.RawShaderMaterial
  private instanceData: Float32Array
  private instanceBuffer: THREE.InstancedBufferAttribute

  constructor() {
    this.scene = new THREE.Scene()

    // unit quad: x in [-0.5, 0.5], y in [0, 1] so scaling Y keeps base at 0
    const geo = new THREE.InstancedBufferGeometry()
    const planeGeo = new THREE.PlaneGeometry(1, 1)
    planeGeo.translate(0, 0.5, 0) // pivot at bottom
    geo.index = planeGeo.index
    geo.setAttribute('position', planeGeo.getAttribute('position'))

    this.instanceData = new Float32Array(BAR_COUNT * 2)
    for (let i = 0; i < BAR_COUNT; i++) {
      this.instanceData[i * 2]     = i       // bar index
      this.instanceData[i * 2 + 1] = 0       // energy
    }
    this.instanceBuffer = new THREE.InstancedBufferAttribute(this.instanceData, 2, false, 1)
    geo.setAttribute('instanceData', this.instanceBuffer)
    geo.instanceCount = BAR_COUNT

    this.material = new THREE.RawShaderMaterial({
      vertexShader: vertSrc,
      fragmentShader: fragSrc,
      uniforms: {
        uHeightScale: { value: 1.0 },
      },
      blending: THREE.AdditiveBlending,
      transparent: true,
      depthTest: false,
      depthWrite: false,
    })

    const mesh = new THREE.Mesh(geo, this.material)
    this.scene.add(mesh)
  }

  update(features: AudioFeatures, barHeightScale: number): void {
    this.material.uniforms.uHeightScale.value = barHeightScale

    // map spectrum bins to BAR_COUNT bars (log-ish compression)
    const bins = features.spectrum.length
    for (let b = 0; b < BAR_COUNT; b++) {
      const t = b / BAR_COUNT
      const binIdx = Math.floor(t * t * bins) // quadratic for log-like spacing
      this.instanceData[b * 2 + 1] = features.spectrum[Math.min(binIdx, bins - 1)]
    }
    this.instanceBuffer.needsUpdate = true
  }
}
