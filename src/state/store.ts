import { create } from 'zustand'

// Platform-agnostic track info (used by SoundCloud, extensible)
export interface TrackInfo {
  title:      string
  artist:     string
  artworkUrl: string
  duration:   number  // ms
}

export type VisualMode =
  | 'fluid'
  | 'streamlines'
  | 'hybrid'
  | 'electric'
  | 'neon'
  | 'nova'
  | 'formula'
  | 'feather'
  | 'pulse'
  | 'grid'
  | 'orbit'
  | 'wing'
  | 'bloom'
  | 'ribbon'
  | 'helix'
  | 'field'
  | 'echo'
  | 'flare'
  | 'surge'
  | 'lyra'
  | 'veil'
  | 'ember'
  | 'glint'
  | 'wave'
  | 'cyclone'
  | 'lattice'
  | 'petal'
  | 'comet'
  | 'chroma'
  | 'attractor'
  | 'prism'

export interface DevParams {
  tauSubBass: number
  tauBass: number
  tauLowMid: number
  tauMid: number
  tauHighMid: number
  tauBrilliance: number
  beatThreshold: number
  beatRefractoryMs: number
  barHeightScale: number
  // fluid solver
  densityDissipation: number
  velocityDissipation: number
  pressureIterations: number
  curlStrength: number
  splatRadius: number
  splatForce: number
  // audio → fluid mapping
  audioMappingEnabled: boolean
  bassThreshold: number
  audioForceScale: number
  fluxVorticityScale: number
  beatForceScale: number
  // MHD
  magneticEnabled: boolean
  magneticReynoldsMax: number
  fieldLineBrightness: number
  lineCount: number
  dipoleStrength: number
  dipoleRadius: number
  psiDissipation: number
  // particles
  visualMode: VisualMode
  reactivity: 'subtle' | 'balanced' | 'intense' | 'frenetic'
  particleSpeed: number
  particleRespawnRate: number
  particleTrailDecay: number
  particleBrightness: number
  particlePointSize: number
  magneticBlend: number
  // electric mode
  plasmaSpeed: number
  plasmaIntensity: number
  waveAmplitude: number
  waveIntensity: number
  electricLightningCount: number
  // nova mode
  novaCoreIntensity: number
  // formula mode
  formulaSpeed:      number
  formulaZoom:       number
  formulaWaveAmp:    number
  formulaBrightness: number
  formulaTempoInfluence: number
  formulaEnergyInfluence: number
  formulaBeatKick: number
  formulaBandWarp: number
  // post-process
  bloomThreshold: number
  bloomKnee: number
  bloomStrength: number
  aberrationStrength: number
  vignetteStrength: number
}

interface StoreState {
  // playback
  currentTrack: TrackInfo | null
  isPlaying: boolean
  setTrack:   (t: TrackInfo | null) => void
  setPlaying: (v: boolean) => void

  // dev params
  devParams:    DevParams
  setDevParams: (p: Partial<DevParams>) => void

  // debug overlay
  debugVisible:    boolean
  setDebugVisible: (v: boolean) => void
}

const DEFAULT_DEV_PARAMS: DevParams = {
  tauSubBass: 0.05,
  tauBass: 0.07,
  tauLowMid: 0.10,
  tauMid: 0.12,
  tauHighMid: 0.18,
  tauBrilliance: 0.25,
  beatThreshold: 1.5,
  beatRefractoryMs: 200,
  barHeightScale: 1.0,
  densityDissipation: 0.98,
  velocityDissipation: 0.98,
  pressureIterations: 30,
  curlStrength: 30,
  splatRadius: 0.25,
  splatForce: 6000,
  audioMappingEnabled: true,
  bassThreshold: 0.05,
  audioForceScale: 1.0,
  fluxVorticityScale: 60,
  beatForceScale: 2.0,
  magneticEnabled: true,
  magneticReynoldsMax: 2.5,
  fieldLineBrightness: 0.6,
  lineCount: 24,
  dipoleStrength: 0.08,
  dipoleRadius: 0.2,
  psiDissipation: 0.998,
  visualMode: 'formula' as const,
  reactivity: 'balanced',
  particleSpeed: 8.0,
  particleRespawnRate: 0.002,
  particleTrailDecay: 0.94,
  particleBrightness: 1.2,
  particlePointSize: 1.5,
  magneticBlend: 0.6,
  plasmaSpeed: 0.8,
  plasmaIntensity: 0.5,
  waveAmplitude: 0.35,
  waveIntensity: 2.0,
  electricLightningCount: 4,
  novaCoreIntensity: 1.0,
  formulaSpeed:      1.0,
  formulaZoom:       1.0,
  formulaWaveAmp:    1.0,
  formulaBrightness: 0.45,
  formulaTempoInfluence: 0.65,
  formulaEnergyInfluence: 0.35,
  formulaBeatKick: 0.22,
  formulaBandWarp: 1.0,
  bloomThreshold: 0.45,
  bloomKnee: 0.1,
  bloomStrength: 1.4,
  aberrationStrength: 0.005,
  vignetteStrength: 2.2,
}

export const useStore = create<StoreState>((set) => ({
  currentTrack: null,
  isPlaying:    false,
  setTrack:   (t) => set({ currentTrack: t }),
  setPlaying: (v) => set({ isPlaying: v }),

  devParams:    DEFAULT_DEV_PARAMS,
  setDevParams: (p) => set((s) => ({ devParams: { ...s.devParams, ...p } })),

  debugVisible:    false,
  setDebugVisible: (v) => set({ debugVisible: v }),
}))
