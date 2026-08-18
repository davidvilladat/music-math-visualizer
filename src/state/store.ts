import { create } from 'zustand'
import {
  AIRCRAFT_VARIANTS,
  VISUAL_MODE_META,
  type ReactivityMode,
  type VisualMode,
  type VisualModeMeta,
} from '../visualModes'

export { AIRCRAFT_VARIANTS, VISUAL_MODE_META }
export type { ReactivityMode, VisualMode, VisualModeMeta }

export interface TrackInfo {
  title: string
  artist: string
  artworkUrl: string
  duration: number
}

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
  densityDissipation: number
  velocityDissipation: number
  pressureIterations: number
  curlStrength: number
  splatRadius: number
  splatForce: number
  audioMappingEnabled: boolean
  bassThreshold: number
  audioForceScale: number
  fluxVorticityScale: number
  beatForceScale: number
  magneticEnabled: boolean
  magneticReynoldsMax: number
  fieldLineBrightness: number
  lineCount: number
  dipoleStrength: number
  dipoleRadius: number
  psiDissipation: number
  visualMode: VisualMode
  reactivity: ReactivityMode
  aircraftVariant: number
  particleSpeed: number
  particleRespawnRate: number
  particleTrailDecay: number
  particleBrightness: number
  particlePointSize: number
  magneticBlend: number
  plasmaSpeed: number
  plasmaIntensity: number
  waveAmplitude: number
  waveIntensity: number
  electricLightningCount: number
  novaCoreIntensity: number
  formulaSpeed: number
  formulaZoom: number
  formulaWaveAmp: number
  formulaBrightness: number
  formulaTempoInfluence: number
  formulaEnergyInfluence: number
  formulaBeatKick: number
  formulaBandWarp: number
  recordScale: number
  recordFps: number
  bloomThreshold: number
  bloomKnee: number
  bloomStrength: number
  aberrationStrength: number
  vignetteStrength: number
}

interface StoreState {
  currentTrack: TrackInfo | null
  isPlaying: boolean
  setTrack: (track: TrackInfo | null) => void
  setPlaying: (isPlaying: boolean) => void
  devParams: DevParams
  setDevParams: (params: Partial<DevParams>) => void
  debugVisible: boolean
  setDebugVisible: (visible: boolean) => void
}

export const DEFAULT_DEV_PARAMS: DevParams = {
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
  visualMode: 'formula',
  reactivity: 'balanced',
  aircraftVariant: 0,
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
  formulaSpeed: 1.0,
  formulaZoom: 1.0,
  formulaWaveAmp: 1.0,
  formulaBrightness: 0.45,
  formulaTempoInfluence: 1.0,
  formulaEnergyInfluence: 0.35,
  formulaBeatKick: 1.0,
  formulaBandWarp: 1.0,
  recordScale: 2,
  recordFps: 60,
  bloomThreshold: 0.45,
  bloomKnee: 0.1,
  bloomStrength: 1.4,
  aberrationStrength: 0.005,
  vignetteStrength: 2.2,
}

export const useStore = create<StoreState>((set) => ({
  currentTrack: null,
  isPlaying: false,
  setTrack: (track) => set({ currentTrack: track }),
  setPlaying: (isPlaying) => set({ isPlaying }),
  devParams: DEFAULT_DEV_PARAMS,
  setDevParams: (params) => set((state) => ({ devParams: { ...state.devParams, ...params } })),
  debugVisible: false,
  setDebugVisible: (debugVisible) => set({ debugVisible }),
}))
