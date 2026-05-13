import * as THREE from 'three'

function makeRT(
  w: number,
  h: number,
  format: THREE.PixelFormat,
  type: THREE.TextureDataType
): THREE.WebGLRenderTarget {
  return new THREE.WebGLRenderTarget(w, h, {
    minFilter: THREE.LinearFilter,
    magFilter: THREE.LinearFilter,
    format,
    type,
    depthBuffer: false,
    stencilBuffer: false,
  })
}

export class DoubleFBO {
  private targets: [THREE.WebGLRenderTarget, THREE.WebGLRenderTarget]
  private idx = 0

  constructor(w: number, h: number, format: THREE.PixelFormat, type: THREE.TextureDataType) {
    this.targets = [makeRT(w, h, format, type), makeRT(w, h, format, type)]
  }

  get read(): THREE.WebGLRenderTarget { return this.targets[this.idx] }
  get write(): THREE.WebGLRenderTarget { return this.targets[1 - this.idx] }
  get texture(): THREE.Texture { return this.targets[this.idx].texture }

  swap(): void { this.idx = 1 - this.idx }

  dispose(): void {
    this.targets[0].dispose()
    this.targets[1].dispose()
  }
}

export class SingleFBO {
  readonly target: THREE.WebGLRenderTarget

  constructor(w: number, h: number, format: THREE.PixelFormat, type: THREE.TextureDataType) {
    this.target = makeRT(w, h, format, type)
  }

  get texture(): THREE.Texture { return this.target.texture }

  dispose(): void { this.target.dispose() }
}
