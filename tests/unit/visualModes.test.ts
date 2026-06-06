import { describe, expect, it } from 'vitest'
import {
  FORMULA_MODE_KEYS,
  VISUAL_MODE_META,
  VISUAL_MODE_REGISTRY,
  formulaVariantFor,
  isFormulaMode,
} from '../../src/visualModes'

describe('visual mode registry', () => {
  it('has unique keys and registry entries for every mode', () => {
    const keys = VISUAL_MODE_META.map((mode) => mode.key)
    expect(new Set(keys).size).toBe(keys.length)
    for (const key of keys) {
      expect(VISUAL_MODE_REGISTRY[key].key).toBe(key)
    }
  })

  it('keeps formula variants aligned with formula cycling order', () => {
    FORMULA_MODE_KEYS.forEach((key, index) => {
      expect(isFormulaMode(key)).toBe(true)
      expect(formulaVariantFor(key)).toBe(index)
    })
  })

  it('keeps non-formula scenes out of formula cycling', () => {
    expect(isFormulaMode('airframe')).toBe(false)
    expect(isFormulaMode('fluid')).toBe(false)
  })
})
