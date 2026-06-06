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
  | 'airframe'

export type ReactivityMode = 'steady' | 'subtle' | 'balanced' | 'intense' | 'frenetic'

// Airframe blueprint variants, indexed by uVariant in aircraft.vert.
// Order MUST match the isXProfile() dispatch in the shader. The 'P' key
// cycles % length, so this list also gates which variants are reachable.
// Ariane 5 (uVariant 10) and Soyuz T (11) are excluded here; their shader
// samplers remain dormant and can be re-enabled by re-adding them.
export const AIRCRAFT_VARIANTS = [
  'A380 — reference',
  'A350 XWB',
  'A380 — aerodynamics',
  'A380 — structural',
  'A380 — wing box',
  'Concorde',
  'Boeing 747',
  'Mirage 4000',
  'Rafale A',
  'Bréguet XIX',
] as const

export interface VisualModeMeta {
  key:    VisualMode
  label:  string
  accent: string
}

// Single source of truth for the visual-mode pickers (TopBar dropdown, demo
// launcher, dev panel). Order here is the order every picker shows. 'formula'
// stays first so it remains the natural default/fallback. Previously each UI
// kept its own list, which diverged — the TopBar list omitted airframe and the
// core scenes, so those modes were mislabelled and unreachable from the bar.
export const VISUAL_MODE_META = [
  { key: 'formula',     label: 'Formula',     accent: '#ff1f1f' },
  { key: 'feather',     label: 'Feather',     accent: '#f8fafc' },
  { key: 'pulse',       label: 'Pulse',       accent: '#38bdf8' },
  { key: 'grid',        label: 'Grid',        accent: '#f97316' },
  { key: 'orbit',       label: 'Orbit',       accent: '#a3e635' },
  { key: 'wing',        label: 'Wing',        accent: '#ef4444' },
  { key: 'bloom',       label: 'Bloom',       accent: '#f472b6' },
  { key: 'ribbon',      label: 'Ribbon',      accent: '#22d3ee' },
  { key: 'helix',       label: 'Helix',       accent: '#fde047' },
  { key: 'field',       label: 'Field',       accent: '#e5e7eb' },
  { key: 'echo',        label: 'Echo',        accent: '#c084fc' },
  { key: 'flare',       label: 'Flare',       accent: '#fb7185' },
  { key: 'surge',       label: 'Surge',       accent: '#ef4444' },
  { key: 'lyra',        label: 'Lyra',        accent: '#f9a8d4' },
  { key: 'veil',        label: 'Veil',        accent: '#2dd4bf' },
  { key: 'ember',       label: 'Ember',       accent: '#fb923c' },
  { key: 'glint',       label: 'Glint',       accent: '#fef08a' },
  { key: 'wave',        label: 'Wave',        accent: '#7dd3fc' },
  { key: 'cyclone',     label: 'Cyclone',     accent: '#fca5a5' },
  { key: 'lattice',     label: 'Lattice',     accent: '#a7f3d0' },
  { key: 'petal',       label: 'Petal',       accent: '#f0abfc' },
  { key: 'comet',       label: 'Comet',       accent: '#ddd6fe' },
  { key: 'chroma',      label: 'Chroma',      accent: '#67e8f9' },
  { key: 'attractor',   label: 'Attractor',   accent: '#f4f4f5' },
  { key: 'prism',       label: 'Prism',       accent: '#c4b5fd' },
  { key: 'fluid',       label: 'Fluid',       accent: '#3b82f6' },
  { key: 'streamlines', label: 'Streamlines', accent: '#60a5fa' },
  { key: 'hybrid',      label: 'Hybrid',      accent: '#14b8a6' },
  { key: 'electric',    label: 'Electric',    accent: '#a855f7' },
  { key: 'neon',        label: 'Neon',        accent: '#22c55e' },
  { key: 'nova',        label: 'Nova',        accent: '#f59e0b' },
  { key: 'airframe',    label: 'Aviation',    accent: '#0ea5e9' },
] as const satisfies readonly VisualModeMeta[]

// Compile-time guard: if any VisualMode is missing from VISUAL_MODE_META, the
// type below resolves to `false` and this assignment fails to compile — so a
// new mode can never silently drop out of the pickers again.
const _allModesCovered: Exclude<VisualMode, (typeof VISUAL_MODE_META)[number]['key']> extends never
  ? true
  : false = true
void _allModesCovered

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
  reactivity: ReactivityMode
  aircraftVariant: number
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
