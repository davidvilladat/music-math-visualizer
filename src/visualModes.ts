export type SceneFamily = 'formula' | 'fluid' | 'electric' | 'neon' | 'nova' | 'aircraft'

export type ReactivityMode = 'steady' | 'subtle' | 'balanced' | 'intense' | 'frenetic'

export interface VisualModeMeta {
  key: VisualMode
  label: string
  accent: string
  sceneFamily: SceneFamily
  formulaVariant?: number
}

const FORMULA_MODES = [
  { key: 'formula',   label: 'Formula',   accent: '#ff1f1f', formulaVariant: 0 },
  { key: 'feather',   label: 'Feather',   accent: '#f8fafc', formulaVariant: 1 },
  { key: 'pulse',     label: 'Pulse',     accent: '#38bdf8', formulaVariant: 2 },
  { key: 'grid',      label: 'Grid',      accent: '#f97316', formulaVariant: 3 },
  { key: 'orbit',     label: 'Orbit',     accent: '#a3e635', formulaVariant: 4 },
  { key: 'wing',      label: 'Wing',      accent: '#ef4444', formulaVariant: 5 },
  { key: 'bloom',     label: 'Bloom',     accent: '#f472b6', formulaVariant: 6 },
  { key: 'ribbon',    label: 'Ribbon',    accent: '#22d3ee', formulaVariant: 7 },
  { key: 'helix',     label: 'Helix',     accent: '#fde047', formulaVariant: 8 },
  { key: 'field',     label: 'Field',     accent: '#e5e7eb', formulaVariant: 9 },
  { key: 'echo',      label: 'Echo',      accent: '#c084fc', formulaVariant: 10 },
  { key: 'flare',     label: 'Flare',     accent: '#fb7185', formulaVariant: 11 },
  { key: 'surge',     label: 'Surge',     accent: '#ef4444', formulaVariant: 12 },
  { key: 'lyra',      label: 'Lyra',      accent: '#f9a8d4', formulaVariant: 13 },
  { key: 'veil',      label: 'Veil',      accent: '#2dd4bf', formulaVariant: 14 },
  { key: 'ember',     label: 'Ember',     accent: '#fb923c', formulaVariant: 15 },
  { key: 'glint',     label: 'Glint',     accent: '#fef08a', formulaVariant: 16 },
  { key: 'wave',      label: 'Wave',      accent: '#7dd3fc', formulaVariant: 17 },
  { key: 'cyclone',   label: 'Cyclone',   accent: '#fca5a5', formulaVariant: 18 },
  { key: 'lattice',   label: 'Lattice',   accent: '#a7f3d0', formulaVariant: 19 },
  { key: 'petal',     label: 'Petal',     accent: '#f0abfc', formulaVariant: 20 },
  { key: 'comet',     label: 'Comet',     accent: '#ddd6fe', formulaVariant: 21 },
  { key: 'chroma',    label: 'Chroma',    accent: '#67e8f9', formulaVariant: 22 },
  { key: 'attractor', label: 'Attractor', accent: '#f4f4f5', formulaVariant: 23 },
  { key: 'prism',     label: 'Prism',     accent: '#c4b5fd', formulaVariant: 24 },
  { key: 'contact',   label: 'Contact',   accent: '#ff1f1f', formulaVariant: 25 },
  { key: 'birdwing',  label: 'Birdwing',  accent: '#fbbf24', formulaVariant: 26 },
  { key: 'bird',      label: 'Bird',      accent: '#93c5fd', formulaVariant: 27 },
  { key: 'gaze',      label: 'Gaze',      accent: '#5eead4', formulaVariant: 28 },
  { key: 'wake',      label: 'Wake',      accent: '#34d399', formulaVariant: 29 },
  { key: 'mirror',    label: 'Mirror',    accent: '#a5f3fc', formulaVariant: 30 },
  { key: 'waltz',     label: 'Waltz',     accent: '#818cf8', formulaVariant: 31 },
  { key: 'seraph',    label: 'Seraph',    accent: '#e879f9', formulaVariant: 32 },
] as const

const EXTRA_MODES = [
  { key: 'fluid',       label: 'Fluid',       accent: '#3b82f6', sceneFamily: 'fluid' },
  { key: 'streamlines', label: 'Streamlines', accent: '#60a5fa', sceneFamily: 'fluid' },
  { key: 'hybrid',      label: 'Hybrid',      accent: '#14b8a6', sceneFamily: 'fluid' },
  { key: 'electric',    label: 'Electric',    accent: '#a855f7', sceneFamily: 'electric' },
  { key: 'neon',        label: 'Neon',        accent: '#22c55e', sceneFamily: 'neon' },
  { key: 'nova',        label: 'Nova',        accent: '#f59e0b', sceneFamily: 'nova' },
  { key: 'airframe',    label: 'Aviation',    accent: '#0ea5e9', sceneFamily: 'aircraft' },
] as const

type FormulaModeMeta = (typeof FORMULA_MODES)[number] & { sceneFamily: 'formula' }
type ExtraModeMeta = (typeof EXTRA_MODES)[number]
type VisualModeMetaInternal = FormulaModeMeta | ExtraModeMeta

export type VisualMode = VisualModeMetaInternal['key']
export type FormulaMode = (typeof FORMULA_MODES)[number]['key']

export const VISUAL_MODE_META = [
  ...FORMULA_MODES.map((mode) => ({ ...mode, sceneFamily: 'formula' as const })),
  ...EXTRA_MODES,
] as readonly VisualModeMetaInternal[] as readonly VisualModeMeta[]

export const VISUAL_MODE_REGISTRY = Object.fromEntries(
  VISUAL_MODE_META.map((mode) => [mode.key, mode])
) as Record<VisualMode, VisualModeMeta>

export const FORMULA_MODE_KEYS = FORMULA_MODES.map((mode) => mode.key) as readonly FormulaMode[]

export const REACTIVITY_MODES = ['steady', 'subtle', 'balanced', 'intense', 'frenetic'] as const satisfies readonly ReactivityMode[]

// Airframe blueprint variants, indexed by uVariant in aircraft.vert.
// Order MUST match the isXProfile() dispatch in the shader.
export const AIRCRAFT_VARIANTS = [
  'A380 - reference',
  'A350 XWB',
  'A380 - aerodynamics',
  'A380 - structural',
  'A380 - wing box',
  'Concorde',
  'Boeing 747',
  'Mirage 4000',
  'Rafale A',
  'Breguet XIX',
] as const

export function isVisualMode(value: string | null | undefined): value is VisualMode {
  return !!value && value in VISUAL_MODE_REGISTRY
}

export function isFormulaMode(mode: VisualMode): mode is FormulaMode {
  return VISUAL_MODE_REGISTRY[mode].sceneFamily === 'formula'
}

export function formulaVariantFor(mode: FormulaMode): number {
  return VISUAL_MODE_REGISTRY[mode].formulaVariant ?? 0
}

export function nextFormulaMode(mode: FormulaMode): FormulaMode {
  const index = FORMULA_MODE_KEYS.indexOf(mode)
  return FORMULA_MODE_KEYS[(index + 1) % FORMULA_MODE_KEYS.length]
}

export function visualModeLabel(mode: VisualMode): string {
  return VISUAL_MODE_REGISTRY[mode].label
}
