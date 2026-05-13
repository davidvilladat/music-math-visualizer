import * as THREE from 'three'
import { SpectrumScene } from './scene'
import { FluidSolver } from './fluid/FluidSolver'
import { AudioInjector } from './AudioInjector'
import { PostProcessStack } from './post/PostProcessStack'
import { ParticleSystem } from './particles/ParticleSystem'
import { ElectricScene } from './electric/ElectricScene'
import { NeonScene } from './neon/NeonScene'
import { NovaScene } from './nova/NovaScene'
import { FormulaScene } from './formula/FormulaScene'
import { AudioEngine } from '../audio/audioEngine'
import { DemoEngine } from '../audio/DemoEngine'
import { makeAudioFeatures, type AudioFeatures } from '../audio/audioFeatures'
import { useStore } from '../state/store'

function hueToRgb(h: number): [number, number, number] {
  const h6 = (h % 1) * 6
  const x = 1 - Math.abs((h6 % 2) - 1)
  if (h6 < 1) return [1, x, 0]
  if (h6 < 2) return [x, 1, 0]
  if (h6 < 3) return [0, 1, x]
  if (h6 < 4) return [0, x, 1]
  if (h6 < 5) return [x, 0, 1]
  return [1, 0, x]
}

export class Renderer {
  private renderer: THREE.WebGLRenderer
  private camera: THREE.OrthographicCamera
  private spectrumScene: SpectrumScene
  private fluid: FluidSolver
  private post: PostProcessStack
  private particles: ParticleSystem
  private electric: ElectricScene
  private neon:    NeonScene
  private nova:    NovaScene
  private formula: FormulaScene
  private audioInjector: AudioInjector
  private engine: AudioEngine
  private demo: DemoEngine | null = null
  readonly features: AudioFeatures

  private rafId = 0
  private running = false
  private lastTime = performance.now()
  private time = 0

  // mouse state for splats
  private mouse = { x: 0.5, y: 0.5, dx: 0, dy: 0, down: false }
  private mouseHue = Math.random()

  // fps tracking
  private fpsFrames = 0
  private fpsLastTime = performance.now()
  fps = 0

  constructor(canvas: HTMLCanvasElement) {
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: false })
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    this.renderer.setSize(canvas.clientWidth, canvas.clientHeight, false)

    this.camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 10)
    this.camera.position.z = 1

    this.spectrumScene = new SpectrumScene()
    this.engine = new AudioEngine()
    this.features = makeAudioFeatures()

    this.fluid     = new FluidSolver(this.renderer)
    this.post      = new PostProcessStack(this.renderer, canvas.clientWidth, canvas.clientHeight)
    this.particles = new ParticleSystem(this.renderer, canvas.clientWidth, canvas.clientHeight)
    this.electric  = new ElectricScene(this.renderer, canvas.clientWidth, canvas.clientHeight)
    this.neon      = new NeonScene(this.renderer, canvas.clientWidth, canvas.clientHeight)
    this.nova      = new NovaScene(this.renderer, canvas.clientWidth, canvas.clientHeight)
    this.formula   = new FormulaScene(this.renderer, canvas.clientWidth, canvas.clientHeight)
    this.audioInjector = new AudioInjector()

    this.bindMouse(canvas)
    window.addEventListener('resize', this.onResize)
    window.addEventListener('keydown', this.onKeyDown)
  }

  async startAudio(): Promise<void> {
    await this.engine.start()
  }

  stopAudio(): void {
    this.engine.stop()
  }

  setCaptureEndedHandler(cb: (() => void) | null): void {
    this.engine.setOnEnded(cb)
  }

  startDemo(): void {
    this.demo = new DemoEngine()
  }

  stopDemo(): void {
    this.demo = null
  }

  get isDemoMode(): boolean { return this.demo !== null }

  startLoop(): void {
    if (this.running) return
    this.running = true
    this.lastTime = performance.now()
    this.rafId = requestAnimationFrame(this.loop)
  }

  stopLoop(): void {
    this.running = false
    cancelAnimationFrame(this.rafId)
  }

  destroy(): void {
    this.stopLoop()
    this.engine.setOnEnded(null)
    this.engine.stop()
    this.fluid.dispose()
    this.post.dispose()
    this.particles.dispose()
    this.electric.dispose()
    this.neon.dispose()
    this.nova.dispose()
    this.formula.dispose()
    this.renderer.dispose()
    this.unbindMouse(this.renderer.domElement)
    window.removeEventListener('resize', this.onResize)
    window.removeEventListener('keydown', this.onKeyDown)
  }

  private loop = (): void => {
    if (!this.running) return

    const now = performance.now()
    const dt = Math.min((now - this.lastTime) / 1000, 0.05) // cap at 50ms
    this.lastTime = now
    this.time += dt

    // fps counter
    this.fpsFrames++
    if (now - this.fpsLastTime >= 500) {
      this.fps = Math.round((this.fpsFrames * 1000) / (now - this.fpsLastTime))
      this.fpsFrames = 0
      this.fpsLastTime = now
    }

    // audio
    if (this.demo) {
      this.demo.tick(dt, this.features)
    } else if (this.engine.isRunning) {
      this.engine.tick(this.features)
    }

    // mouse splat
    if (this.mouse.down) {
      const { devParams } = useStore.getState()
      this.fluid.addSplat({
        x: this.mouse.x,
        y: this.mouse.y,
        dx: this.mouse.dx * devParams.splatForce,
        dy: this.mouse.dy * devParams.splatForce,
        color: hueToRgb(this.mouseHue),
      })
      this.mouseHue += 0.01
      this.mouse.dx = 0
      this.mouse.dy = 0
    }

    // audio → fluid injection (only when audio is captured)
    const { devParams } = useStore.getState()
    const modulated = this.engine.isRunning
      ? this.audioInjector.inject(
          this.features,
          this.fluid,
          {
            enabled:            devParams.audioMappingEnabled,
            bassThreshold:      devParams.bassThreshold,
            audioForceScale:    devParams.audioForceScale,
            fluxVorticityScale: devParams.fluxVorticityScale,
            beatForceScale:     devParams.beatForceScale,
            magneticEnabled:    devParams.magneticEnabled,
            magneticReynoldsMax: devParams.magneticReynoldsMax,
            dipoleStrength:     devParams.dipoleStrength,
            dipoleRadius:       devParams.dipoleRadius,
          },
          devParams.splatForce,
          devParams.curlStrength,
          devParams.velocityDissipation,
          devParams.magneticReynoldsMax,
          devParams.fieldLineBrightness,
        )
      : {
          curlStrength:        devParams.curlStrength,
          velocityDissipation: devParams.velocityDissipation,
          magneticReynolds:    0,
          fieldLineBrightness: devParams.fieldLineBrightness,
        }

    const mode = devParams.visualMode

    if (mode === 'electric') {
      // ── Electric: plasma + waveform + lightning ────────────────────────
      this.electric.update(dt, this.features, {
        plasmaSpeed:            devParams.plasmaSpeed,
        plasmaIntensity:        devParams.plasmaIntensity,
        waveAmplitude:          devParams.waveAmplitude,
        waveIntensity:          devParams.waveIntensity,
        electricLightningCount: devParams.electricLightningCount,
      })
      this.electric.render(this.post.sourceRT)
    } else if (mode === 'neon') {
      // ── Neon: 3-channel oscilloscope ───────────────────────────────────
      this.neon.update(dt, this.features)
      this.neon.render(this.post.sourceRT)
    } else if (mode === 'nova') {
      // ── Nova: supernova explosion ──────────────────────────────────────
      this.nova.update(dt, this.features)
      this.nova.render(this.post.sourceRT)
    } else if (mode === 'formula' || mode === 'feather' || mode === 'pulse') {
      // ── Formula: parametric spiral point cloud ─────────────────────────
      this.formula.update(dt, this.features, {
        variant:    mode === 'pulse' ? 2 : mode === 'feather' ? 1 : 0,
        speed:      devParams.formulaSpeed,
        zoom:       devParams.formulaZoom,
        waveAmp:    devParams.formulaWaveAmp,
        brightness: devParams.formulaBrightness,
      })
      this.formula.render(this.post.sourceRT)
    } else {
      // ── Fluid/particle modes ──────────────────────────────────────────────

      // fluid step with audio-modulated params
      this.fluid.step(dt, {
        densityDissipation:  devParams.densityDissipation,
        velocityDissipation: modulated.velocityDissipation,
        pressureIterations:  devParams.pressureIterations,
        curlStrength:        modulated.curlStrength,
        splatRadius:         devParams.splatRadius,
        splatForce:          devParams.splatForce,
        magneticReynolds:    modulated.magneticReynolds,
        psiDissipation:      devParams.psiDissipation,
        fieldLineBrightness: modulated.fieldLineBrightness,
        lineCount:           devParams.lineCount,
      })

      // particle system step (always, so trails age correctly)
      this.particles.step(this.time, {
        dt,
        speed:         devParams.particleSpeed,
        respawnRate:   devParams.particleRespawnRate,
        trailDecay:    devParams.particleTrailDecay,
        brightness:    devParams.particleBrightness,
        magneticBlend: devParams.magneticBlend,
        pointSize:     devParams.particlePointSize,
        velocityTex:   this.fluid.velocityTexture,
        psiTex:        this.fluid.psiTexture,
        simTexelSize:  this.fluid.simTexelSize,
      })

      // fluid dye + field lines into source RT (skip for pure streamlines)
      if (mode !== 'streamlines') {
        this.fluid.display(this.post.sourceRT)
      } else {
        this.renderer.setRenderTarget(this.post.sourceRT)
        this.renderer.setClearColor(0x000000, 1)
        this.renderer.clear()
        this.renderer.setRenderTarget(null)
      }

      // particle trails into source RT (additive, skip for pure fluid)
      if (mode !== 'fluid') {
        this.renderer.autoClear = false
        this.particles.renderTrail(this.post.sourceRT, devParams.particleBrightness)
        this.renderer.autoClear = true
      }

      // spectrum bars (additive, not shown in electric mode)
      this.renderer.autoClear = false
      this.renderer.setRenderTarget(this.post.sourceRT)
      this.spectrumScene.update(this.features, devParams.barHeightScale)
      this.renderer.render(this.spectrumScene.scene, this.camera)
      this.renderer.setRenderTarget(null)
      this.renderer.autoClear = true
    }

    // post-process stack → screen
    // aberration pulses on beat for a visual "hit" feel
    this.post.render({
      bloomThreshold:  devParams.bloomThreshold,
      bloomKnee:       devParams.bloomKnee,
      bloomStrength:   devParams.bloomStrength,
      aberration:      devParams.aberrationStrength + this.features.beatPulse * 0.014,
      vignetteStrength: devParams.vignetteStrength,
    })

    this.rafId = requestAnimationFrame(this.loop)
  }

  private onResize = (): void => {
    const canvas = this.renderer.domElement
    const w = canvas.clientWidth
    const h = canvas.clientHeight
    this.renderer.setSize(w, h, false)
    this.fluid.updateAspect(w / h)
    this.post.resize(w, h)
    this.particles.resize(w, h)
    this.electric.resize(w, h)
    this.neon.resize(w, h)
    this.nova.resize(w, h)
    this.formula.resize(w, h)
  }

  private onKeyDown = (e: KeyboardEvent): void => {
    if (e.key === 'v' || e.key === 'V') {
      const { devParams, setDevParams } = useStore.getState()
      const modes = ['fluid', 'streamlines', 'hybrid', 'electric', 'neon', 'nova', 'formula', 'feather', 'pulse'] as const
      const next = modes[(modes.indexOf(devParams.visualMode as typeof modes[number]) + 1) % modes.length]
      setDevParams({ visualMode: next })
    }
  }

  // ── mouse handling ──────────────────────────────────────────────────────────

  private bindMouse(canvas: HTMLCanvasElement): void {
    canvas.addEventListener('mousedown', this.onMouseDown)
    canvas.addEventListener('mousemove', this.onMouseMove)
    canvas.addEventListener('mouseup',   this.onMouseUp)
    canvas.addEventListener('touchstart', this.onTouchStart, { passive: false })
    canvas.addEventListener('touchmove',  this.onTouchMove,  { passive: false })
    canvas.addEventListener('touchend',   this.onTouchEnd)
  }

  private unbindMouse(canvas: HTMLCanvasElement): void {
    canvas.removeEventListener('mousedown', this.onMouseDown)
    canvas.removeEventListener('mousemove', this.onMouseMove)
    canvas.removeEventListener('mouseup',   this.onMouseUp)
    canvas.removeEventListener('touchstart', this.onTouchStart)
    canvas.removeEventListener('touchmove',  this.onTouchMove)
    canvas.removeEventListener('touchend',   this.onTouchEnd)
  }

  private toUV(clientX: number, clientY: number): { x: number; y: number } {
    const rect = this.renderer.domElement.getBoundingClientRect()
    return {
      x: clientX / rect.width,
      y: 1 - clientY / rect.height, // flip Y: WebGL UV origin is bottom-left
    }
  }

  private onMouseDown = (e: MouseEvent): void => {
    const uv = this.toUV(e.clientX, e.clientY)
    this.mouse = { ...uv, dx: 0, dy: 0, down: true }
    this.mouseHue += 0.1
  }

  private onMouseMove = (e: MouseEvent): void => {
    const uv = this.toUV(e.clientX, e.clientY)
    this.mouse.dx += uv.x - this.mouse.x
    this.mouse.dy += uv.y - this.mouse.y
    this.mouse.x = uv.x
    this.mouse.y = uv.y
  }

  private onMouseUp = (): void => {
    this.mouse.down = false
  }

  private onTouchStart = (e: TouchEvent): void => {
    e.preventDefault()
    const t = e.touches[0]
    if (!t) return
    const uv = this.toUV(t.clientX, t.clientY)
    this.mouse = { ...uv, dx: 0, dy: 0, down: true }
  }

  private onTouchMove = (e: TouchEvent): void => {
    e.preventDefault()
    const t = e.touches[0]
    if (!t) return
    const uv = this.toUV(t.clientX, t.clientY)
    this.mouse.dx += uv.x - this.mouse.x
    this.mouse.dy += uv.y - this.mouse.y
    this.mouse.x = uv.x
    this.mouse.y = uv.y
  }

  private onTouchEnd = (): void => {
    this.mouse.down = false
  }

  get audioRunning(): boolean { return this.engine.isRunning }
}
