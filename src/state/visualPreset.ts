import { DEFAULT_DEV_PARAMS, type DevParams } from './store'
import {
  AIRCRAFT_VARIANTS,
  REACTIVITY_MODES,
  isVisualMode,
  type ReactivityMode,
  type VisualMode,
} from '../visualModes'

export interface VisualPreset {
  visualMode: VisualMode
  reactivity: ReactivityMode
  aircraftVariant: number
}

export const VISUAL_PRESET_STORAGE_KEY = 'spectra_visual_preset'

function hasLocalStorage(): boolean {
  return typeof window !== 'undefined' && !!window.localStorage
}

function isReactivityMode(value: string | null | undefined): value is ReactivityMode {
  return !!value && REACTIVITY_MODES.includes(value as ReactivityMode)
}

function normalizeAircraftVariant(value: unknown): number {
  const parsed = typeof value === 'number' ? value : Number(value)
  if (!Number.isFinite(parsed)) return DEFAULT_DEV_PARAMS.aircraftVariant
  const rounded = Math.round(parsed)
  if (rounded < 0 || rounded >= AIRCRAFT_VARIANTS.length) return DEFAULT_DEV_PARAMS.aircraftVariant
  return rounded
}

function normalizePreset(value: unknown): VisualPreset | null {
  if (!value || typeof value !== 'object') return null
  const candidate = value as Record<string, unknown>
  const visualMode = typeof candidate.visualMode === 'string' && isVisualMode(candidate.visualMode)
    ? candidate.visualMode
    : null
  const reactivity = typeof candidate.reactivity === 'string' && isReactivityMode(candidate.reactivity)
    ? candidate.reactivity
    : null
  if (!visualMode || !reactivity) return null

  return {
    visualMode,
    reactivity,
    aircraftVariant: normalizeAircraftVariant(candidate.aircraftVariant),
  }
}

export function presetFromDevParams(params: DevParams): VisualPreset {
  return {
    visualMode: params.visualMode,
    reactivity: params.reactivity,
    aircraftVariant: normalizeAircraftVariant(params.aircraftVariant),
  }
}

export function loadVisualPreset(storage: Storage | null = hasLocalStorage() ? window.localStorage : null): VisualPreset | null {
  if (!storage) return null
  const raw = storage.getItem(VISUAL_PRESET_STORAGE_KEY)
  if (!raw) return null

  try {
    const preset = normalizePreset(JSON.parse(raw))
    if (!preset) storage.removeItem(VISUAL_PRESET_STORAGE_KEY)
    return preset
  } catch {
    storage.removeItem(VISUAL_PRESET_STORAGE_KEY)
    return null
  }
}

export function saveVisualPreset(
  preset: VisualPreset,
  storage: Storage | null = hasLocalStorage() ? window.localStorage : null,
): void {
  if (!storage) return
  storage.setItem(VISUAL_PRESET_STORAGE_KEY, JSON.stringify(preset))
}

export function parsePresetQuery(input: string | URLSearchParams): Partial<VisualPreset> {
  const params = typeof input === 'string' ? new URLSearchParams(input) : input
  const visualMode = params.get('mode')
  const reactivity = params.get('reactivity')
  const aircraftVariant = params.get('aircraft')
  const preset: Partial<VisualPreset> = {}

  if (isVisualMode(visualMode)) preset.visualMode = visualMode
  if (isReactivityMode(reactivity)) preset.reactivity = reactivity
  if (aircraftVariant !== null) preset.aircraftVariant = normalizeAircraftVariant(aircraftVariant)

  return preset
}

export function serializePresetQuery(preset: VisualPreset): string {
  const params = new URLSearchParams({
    mode: preset.visualMode,
    reactivity: preset.reactivity,
    aircraft: String(normalizeAircraftVariant(preset.aircraftVariant)),
  })
  return `?${params.toString()}`
}
