import { describe, expect, it } from 'vitest'
import { isSoundCloudUrl } from '../../src/ui/SoundCloudGate'

describe('SoundCloud URL validation', () => {
  it('accepts public SoundCloud hosts', () => {
    expect(isSoundCloudUrl('https://soundcloud.com/artist/track')).toBe(true)
    expect(isSoundCloudUrl('https://www.soundcloud.com/artist/sets/list')).toBe(true)
    expect(isSoundCloudUrl('https://m.soundcloud.com/artist/track')).toBe(true)
  })

  it('rejects non-SoundCloud and malformed URLs', () => {
    expect(isSoundCloudUrl('https://example.com/soundcloud.com/artist/track')).toBe(false)
    expect(isSoundCloudUrl('not a url')).toBe(false)
  })
})
