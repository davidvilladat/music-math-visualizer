import { useControls, folder } from 'leva'
import { useStore, type VisualMode } from '../state/store'
import { useEffect } from 'react'

export function DevPanel() {
  const setDevParams = useStore((s) => s.setDevParams)

  const values = useControls({
    'Post-process': folder({
      bloomThreshold:    { value: 0.45, min: 0.1, max: 1.0,  step: 0.01,  label: 'Bloom threshold' },
      bloomKnee:         { value: 0.1,  min: 0.0, max: 0.5,  step: 0.01,  label: 'Bloom knee' },
      bloomStrength:     { value: 1.4,  min: 0.0, max: 5.0,  step: 0.05,  label: 'Bloom strength' },
      aberrationStrength:{ value: 0.005,min: 0.0, max: 0.03, step: 0.001, label: 'Aberration' },
      vignetteStrength:  { value: 2.2,  min: 0.5, max: 5.0,  step: 0.1,   label: 'Vignette' },
    }),
    Magnetic: folder({
      magneticEnabled:     { value: true,  label: 'Enabled' },
      magneticReynoldsMax: { value: 2.5,   min: 0,    max: 8,    step: 0.1,  label: 'Rm max (centroid→)' },
      fieldLineBrightness: { value: 0.6,   min: 0,    max: 2.0,  step: 0.05, label: 'Field line brightness' },
      lineCount:           { value: 24,    min: 5,    max: 80,   step: 1,    label: 'Line count' },
      dipoleStrength:      { value: 0.08,  min: 0.01, max: 0.5,  step: 0.01, label: 'Dipole strength' },
      dipoleRadius:        { value: 0.2,   min: 0.05, max: 0.6,  step: 0.01, label: 'Dipole radius' },
      psiDissipation:      { value: 0.998, min: 0.97, max: 1.0,  step: 0.001,label: 'ψ dissipation' },
    }),
    'Audio → Fluid': folder({
      audioMappingEnabled: { value: true,  label: 'Enabled' },
      bassThreshold:       { value: 0.05,  min: 0.0,  max: 0.5,  step: 0.01, label: 'Bass threshold' },
      audioForceScale:     { value: 1.0,   min: 0.1,  max: 4.0,  step: 0.05, label: 'Force scale' },
      fluxVorticityScale:  { value: 60,    min: 0,    max: 200,  step: 1,    label: 'Flux → vorticity' },
      beatForceScale:      { value: 2.0,   min: 0.5,  max: 6.0,  step: 0.1,  label: 'Beat force ×' },
    }, { collapsed: true }),
    Fluid: folder({
      densityDissipation:  { value: 0.98, min: 0.9,  max: 1.0,   step: 0.001, label: 'Density dissipation' },
      velocityDissipation: { value: 0.98, min: 0.9,  max: 1.0,   step: 0.001, label: 'Velocity dissipation' },
      pressureIterations:  { value: 40,   min: 5,    max: 80,    step: 1,     label: 'Pressure iterations' },
      curlStrength:        { value: 35,   min: 0,    max: 100,   step: 1,     label: 'Curl (base)' },
      splatRadius:         { value: 0.25, min: 0.05, max: 1.0,   step: 0.01,  label: 'Splat radius' },
      splatForce:          { value: 6000, min: 500,  max: 15000, step: 100,   label: 'Mouse force' },
    }, { collapsed: true }),
    Smoothing: folder({
      tauSubBass:    { value: 0.05, min: 0.01, max: 1.0, step: 0.01, label: 'Sub-bass τ' },
      tauBass:       { value: 0.07, min: 0.01, max: 1.0, step: 0.01, label: 'Bass τ' },
      tauLowMid:     { value: 0.10, min: 0.01, max: 1.0, step: 0.01, label: 'Low-mid τ' },
      tauMid:        { value: 0.12, min: 0.01, max: 1.0, step: 0.01, label: 'Mid τ' },
      tauHighMid:    { value: 0.18, min: 0.01, max: 1.0, step: 0.01, label: 'High-mid τ' },
      tauBrilliance: { value: 0.25, min: 0.01, max: 1.0, step: 0.01, label: 'Brilliance τ' },
    }, { collapsed: true }),
    Beat: folder({
      beatThreshold:    { value: 1.5, min: 1.0, max: 5.0, step: 0.1, label: 'Threshold ×' },
      beatRefractoryMs: { value: 200, min: 50,  max: 800, step: 10,  label: 'Refractory ms' },
    }, { collapsed: true }),
    Visuals: folder({
      barHeightScale: { value: 1.0, min: 0.1, max: 3.0, step: 0.05, label: 'Bar height ×' },
    }, { collapsed: true }),
    Electric: folder({
      plasmaSpeed:            { value: 0.8,  min: 0.1,  max: 3.0,  step: 0.1,  label: 'Plasma speed' },
      plasmaIntensity:        { value: 0.5,  min: 0.0,  max: 1.5,  step: 0.05, label: 'Plasma intensity' },
      waveAmplitude:          { value: 0.35, min: 0.05, max: 0.48, step: 0.01, label: 'Wave amplitude' },
      waveIntensity:          { value: 2.0,  min: 0.5,  max: 6.0,  step: 0.1,  label: 'Wave intensity' },
      electricLightningCount: { value: 4,    min: 1,    max: 8,    step: 1,    label: 'Lightning bolts' },
    }, { collapsed: true }),
    Nova: folder({
      novaCoreIntensity: { value: 1.0, min: 0.2, max: 3.0, step: 0.1, label: 'Core intensity' },
    }, { collapsed: true }),
    Formula: folder({
      formulaSpeed:      { value: 1.0,  min: 0.05, max: 6.0,  step: 0.05, label: 'Speed' },
      formulaZoom:       { value: 1.0,  min: 0.3,  max: 3.0,  step: 0.05, label: 'Zoom' },
      formulaWaveAmp:    { value: 1.0,  min: 0.0,  max: 4.0,  step: 0.1,  label: 'Wave amp' },
      formulaBrightness: { value: 0.45, min: 0.01, max: 1.00, step: 0.01, label: 'Brightness' },
      formulaTempoInfluence: { value: 0.65, min: 0.0, max: 2.0, step: 0.05, label: 'Tempo influence' },
      formulaEnergyInfluence:{ value: 0.35, min: 0.0, max: 2.0, step: 0.05, label: 'Energy speed' },
      formulaBeatKick:       { value: 0.22, min: 0.0, max: 1.5, step: 0.05, label: 'Beat kick' },
      formulaBandWarp:       { value: 1.0,  min: 0.0, max: 3.0, step: 0.05, label: 'Band warp' },
    }, { collapsed: true }),
    Particles: folder({
      visualMode:          { value: 'formula', options: ['formula', 'feather', 'pulse', 'grid', 'orbit', 'wing', 'bloom', 'ribbon', 'helix', 'field', 'echo', 'flare', 'surge', 'lyra', 'veil', 'ember', 'glint', 'wave', 'cyclone', 'lattice', 'petal', 'comet', 'chroma', 'attractor', 'prism'], label: 'Visual mode (V)' },
      reactivity:          { value: 'balanced', options: ['subtle', 'balanced', 'intense', 'frenetic'], label: 'Reactivity' },
      magneticBlend:       { value: 0.6,   min: 0.0,   max: 1.0,   step: 0.05,  label: 'Mag blend (0=vel,1=B)' },
      particleSpeed:       { value: 8.0,   min: 1.0,   max: 30.0,  step: 0.5,   label: 'Particle speed' },
      particleRespawnRate: { value: 0.002, min: 0.0,   max: 0.02,  step: 0.001, label: 'Respawn rate' },
      particleTrailDecay:  { value: 0.94,  min: 0.85,  max: 0.999, step: 0.001, label: 'Trail decay' },
      particleBrightness:  { value: 1.2,   min: 0.1,   max: 4.0,   step: 0.1,   label: 'Trail brightness' },
      particlePointSize:   { value: 1.5,   min: 0.5,   max: 4.0,   step: 0.5,   label: 'Point size' },
    }),
  })

  useEffect(() => {
    setDevParams({
      ...values,
      visualMode: values.visualMode as VisualMode,
      reactivity: values.reactivity as 'subtle' | 'balanced' | 'intense' | 'frenetic',
    })
  }, [values, setDevParams])

  return null
}
