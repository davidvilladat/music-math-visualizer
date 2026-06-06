import { describe, expect, it } from 'vitest'
import {
  VISUAL_PRESET_STORAGE_KEY,
  loadVisualPreset,
  parsePresetQuery,
  saveVisualPreset,
  serializePresetQuery,
} from '../../src/state/visualPreset'
import { MemoryStorage } from './storage'

describe('visual presets', () => {
  it('saves and loads local visual-only preset state', () => {
    const storage = new MemoryStorage()
    const preset = { visualMode: 'airframe' as const, reactivity: 'intense' as const, aircraftVariant: 3 }

    saveVisualPreset(preset, storage)

    expect(loadVisualPreset(storage)).toEqual(preset)
  })

  it('removes malformed persisted presets', () => {
    const storage = new MemoryStorage()
    storage.setItem(VISUAL_PRESET_STORAGE_KEY, '{not-json')

    expect(loadVisualPreset(storage)).toBeNull()
    expect(storage.getItem(VISUAL_PRESET_STORAGE_KEY)).toBeNull()
  })

  it('parses only valid query preset fields', () => {
    const preset = parsePresetQuery('?mode=prism&reactivity=frenetic&aircraft=4&track=https://soundcloud.com/private')

    expect(preset).toEqual({
      visualMode: 'prism',
      reactivity: 'frenetic',
      aircraftVariant: 4,
    })
  })

  it('serializes share links without source or account data', () => {
    const query = serializePresetQuery({
      visualMode: 'formula',
      reactivity: 'balanced',
      aircraftVariant: 0,
    })

    expect(query).toBe('?mode=formula&reactivity=balanced&aircraft=0')
  })
})
