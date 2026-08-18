import { useEffect } from 'react'
import { folder, useControls } from 'leva'
import {
  DEFAULT_DEV_PARAMS,
  AIRCRAFT_VARIANTS,
  VISUAL_MODE_META,
  useStore,
  type ReactivityMode,
  type VisualMode,
} from '../state/store'

const VISUAL_MODES: VisualMode[] = VISUAL_MODE_META.map((mode) => mode.key)
const REACTIVITY_MODES: ReactivityMode[] = ['steady', 'subtle', 'balanced', 'intense', 'frenetic']

export function DevPanel() {
  const setDevParams = useStore((state) => state.setDevParams)
  const initial = { ...DEFAULT_DEV_PARAMS, ...useStore.getState().devParams }

  const values = useControls({
    'Post-process': folder({
      bloomThreshold: { value: initial.bloomThreshold, min: 0.1, max: 1.0, step: 0.01, label: 'Bloom threshold' },
      bloomKnee: { value: initial.bloomKnee, min: 0.0, max: 0.5, step: 0.01, label: 'Bloom knee' },
      bloomStrength: { value: initial.bloomStrength, min: 0.0, max: 5.0, step: 0.05, label: 'Bloom strength' },
      aberrationStrength: { value: initial.aberrationStrength, min: 0.0, max: 0.03, step: 0.001, label: 'Aberration' },
      vignetteStrength: { value: initial.vignetteStrength, min: 0.5, max: 5.0, step: 0.1, label: 'Vignette' },
    }),
    Magnetic: folder({
      magneticEnabled: { value: initial.magneticEnabled, label: 'Enabled' },
      magneticReynoldsMax: { value: initial.magneticReynoldsMax, min: 0, max: 8, step: 0.1, label: 'Rm max' },
      fieldLineBrightness: { value: initial.fieldLineBrightness, min: 0, max: 2.0, step: 0.05, label: 'Field brightness' },
      lineCount: { value: initial.lineCount, min: 5, max: 80, step: 1, label: 'Line count' },
      dipoleStrength: { value: initial.dipoleStrength, min: 0.01, max: 0.5, step: 0.01, label: 'Dipole strength' },
      dipoleRadius: { value: initial.dipoleRadius, min: 0.05, max: 0.6, step: 0.01, label: 'Dipole radius' },
      psiDissipation: { value: initial.psiDissipation, min: 0.97, max: 1.0, step: 0.001, label: 'Psi dissipation' },
    }),
    'Audio to Fluid': folder({
      audioMappingEnabled: { value: initial.audioMappingEnabled, label: 'Enabled' },
      bassThreshold: { value: initial.bassThreshold, min: 0.0, max: 0.5, step: 0.01, label: 'Bass threshold' },
      audioForceScale: { value: initial.audioForceScale, min: 0.1, max: 4.0, step: 0.05, label: 'Force scale' },
      fluxVorticityScale: { value: initial.fluxVorticityScale, min: 0, max: 200, step: 1, label: 'Flux vorticity' },
      beatForceScale: { value: initial.beatForceScale, min: 0.5, max: 6.0, step: 0.1, label: 'Beat force' },
    }, { collapsed: true }),
    Fluid: folder({
      densityDissipation: { value: initial.densityDissipation, min: 0.9, max: 1.0, step: 0.001, label: 'Density dissipation' },
      velocityDissipation: { value: initial.velocityDissipation, min: 0.9, max: 1.0, step: 0.001, label: 'Velocity dissipation' },
      pressureIterations: { value: initial.pressureIterations, min: 5, max: 80, step: 1, label: 'Pressure iterations' },
      curlStrength: { value: initial.curlStrength, min: 0, max: 100, step: 1, label: 'Curl base' },
      splatRadius: { value: initial.splatRadius, min: 0.05, max: 1.0, step: 0.01, label: 'Splat radius' },
      splatForce: { value: initial.splatForce, min: 500, max: 15000, step: 100, label: 'Mouse force' },
    }, { collapsed: true }),
    Smoothing: folder({
      tauSubBass: { value: initial.tauSubBass, min: 0.01, max: 1.0, step: 0.01, label: 'Sub-bass tau' },
      tauBass: { value: initial.tauBass, min: 0.01, max: 1.0, step: 0.01, label: 'Bass tau' },
      tauLowMid: { value: initial.tauLowMid, min: 0.01, max: 1.0, step: 0.01, label: 'Low-mid tau' },
      tauMid: { value: initial.tauMid, min: 0.01, max: 1.0, step: 0.01, label: 'Mid tau' },
      tauHighMid: { value: initial.tauHighMid, min: 0.01, max: 1.0, step: 0.01, label: 'High-mid tau' },
      tauBrilliance: { value: initial.tauBrilliance, min: 0.01, max: 1.0, step: 0.01, label: 'Brilliance tau' },
    }, { collapsed: true }),
    Beat: folder({
      beatThreshold: { value: initial.beatThreshold, min: 1.0, max: 5.0, step: 0.1, label: 'Threshold' },
      beatRefractoryMs: { value: initial.beatRefractoryMs, min: 50, max: 800, step: 10, label: 'Refractory ms' },
    }, { collapsed: true }),
    Visuals: folder({
      barHeightScale: { value: initial.barHeightScale, min: 0.1, max: 3.0, step: 0.05, label: 'Bar height' },
    }, { collapsed: true }),
    Electric: folder({
      plasmaSpeed: { value: initial.plasmaSpeed, min: 0.1, max: 3.0, step: 0.1, label: 'Plasma speed' },
      plasmaIntensity: { value: initial.plasmaIntensity, min: 0.0, max: 1.5, step: 0.05, label: 'Plasma intensity' },
      waveAmplitude: { value: initial.waveAmplitude, min: 0.05, max: 0.48, step: 0.01, label: 'Wave amplitude' },
      waveIntensity: { value: initial.waveIntensity, min: 0.5, max: 6.0, step: 0.1, label: 'Wave intensity' },
      electricLightningCount: { value: initial.electricLightningCount, min: 1, max: 8, step: 1, label: 'Lightning bolts' },
    }, { collapsed: true }),
    Nova: folder({
      novaCoreIntensity: { value: initial.novaCoreIntensity, min: 0.2, max: 3.0, step: 0.1, label: 'Core intensity' },
    }, { collapsed: true }),
    Formula: folder({
      formulaSpeed: { value: initial.formulaSpeed, min: 0.05, max: 6.0, step: 0.05, label: 'Speed' },
      formulaZoom: { value: initial.formulaZoom, min: 0.3, max: 3.0, step: 0.05, label: 'Zoom' },
      formulaWaveAmp: { value: initial.formulaWaveAmp, min: 0.0, max: 4.0, step: 0.1, label: 'Wave amp' },
      formulaBrightness: { value: initial.formulaBrightness, min: 0.01, max: 1.00, step: 0.01, label: 'Brightness' },
      formulaTempoInfluence: { value: initial.formulaTempoInfluence, min: 0.0, max: 2.0, step: 0.05, label: 'Tempo influence' },
      formulaEnergyInfluence: { value: initial.formulaEnergyInfluence, min: 0.0, max: 2.0, step: 0.05, label: 'Energy speed' },
      formulaBeatKick: { value: initial.formulaBeatKick, min: 0.0, max: 1.5, step: 0.05, label: 'Beat kick' },
      formulaBandWarp: { value: initial.formulaBandWarp, min: 0.0, max: 3.0, step: 0.05, label: 'Band warp' },
      recordScale: { value: initial.recordScale, min: 1, max: 3, step: 1, label: 'Record scale' },
      recordFps: { value: initial.recordFps, min: 24, max: 60, step: 1, label: 'Record fps' },
    }, { collapsed: true }),
    Particles: folder({
      visualMode: { value: initial.visualMode, options: VISUAL_MODES, label: 'Visual mode' },
      reactivity: { value: initial.reactivity, options: REACTIVITY_MODES, label: 'Reactivity' },
      aircraftVariant: { value: initial.aircraftVariant, min: 0, max: AIRCRAFT_VARIANTS.length - 1, step: 1, label: 'Airframe variant' },
      magneticBlend: { value: initial.magneticBlend, min: 0.0, max: 1.0, step: 0.05, label: 'Mag blend' },
      particleSpeed: { value: initial.particleSpeed, min: 1.0, max: 30.0, step: 0.5, label: 'Particle speed' },
      particleRespawnRate: { value: initial.particleRespawnRate, min: 0.0, max: 0.02, step: 0.001, label: 'Respawn rate' },
      particleTrailDecay: { value: initial.particleTrailDecay, min: 0.85, max: 0.999, step: 0.001, label: 'Trail decay' },
      particleBrightness: { value: initial.particleBrightness, min: 0.1, max: 4.0, step: 0.1, label: 'Trail brightness' },
      particlePointSize: { value: initial.particlePointSize, min: 0.5, max: 4.0, step: 0.5, label: 'Point size' },
    }),
  })

  useEffect(() => {
    setDevParams({
      ...values,
      visualMode: values.visualMode as VisualMode,
      reactivity: values.reactivity as ReactivityMode,
    })
  }, [values, setDevParams])

  return null
}
