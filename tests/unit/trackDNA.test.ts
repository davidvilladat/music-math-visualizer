import { describe, expect, it } from 'vitest'
import { createTrackDNA, hashTrackKey, TrackDNAController, trackKey } from '../../src/render/trackDNA'
import { makeAudioFeatures } from '../../src/audio/audioFeatures'
import type { TrackInfo } from '../../src/state/store'

const track: TrackInfo = {
  id: 'spotify-id-123',
  source: 'spotify',
  title: 'A Song',
  artist: 'An Artist',
  artworkUrl: '',
  duration: 210_000,
}

describe('track DNA', () => {
  it('is deterministic for a track across replays', () => {
    expect(createTrackDNA(track)).toEqual(createTrackDNA({ ...track }))
    expect(trackKey(track)).toBe('spotify:spotify-id-123')
  })

  it('gives different tracks different visual identities', () => {
    const other = { ...track, id: 'spotify-id-456', title: 'Another Song' }
    expect(hashTrackKey(trackKey(track))).not.toBe(hashTrackKey(trackKey(other)))
    expect(createTrackDNA(track)).not.toEqual(createTrackDNA(other))
  })

  it('lets learned sound balance shape the stable geometry', () => {
    const bassHeavy = createTrackDNA(track, {
      bassBalance: 0.8,
      midBalance: 0.15,
      highBalance: 0.05,
      brightness: 0.2,
      dynamicRange: 0.7,
      onsetDensity: 0.3,
    })
    const bright = createTrackDNA(track, {
      bassBalance: 0.1,
      midBalance: 0.2,
      highBalance: 0.7,
      brightness: 0.85,
      dynamicRange: 0.4,
      onsetDensity: 0.8,
    })
    expect(bassHeavy.radius).toBeGreaterThan(bright.radius)
    expect(bassHeavy.hue).not.toBe(bright.hue)
    expect(bassHeavy.texture).not.toBe(bright.texture)
  })

  it('caches a learned sound profile for the next replay', () => {
    const values = new Map<string, string>()
    const storage: Storage = {
      get length() { return values.size },
      clear: () => values.clear(),
      getItem: (key) => values.get(key) ?? null,
      key: (index) => [...values.keys()][index] ?? null,
      removeItem: (key) => { values.delete(key) },
      setItem: (key, value) => { values.set(key, value) },
    }
    const features = makeAudioFeatures()
    features.rms = 0.2
    Object.assign(features.normalized, {
      subBass: 0.9,
      bass: 0.8,
      lowMid: 0.3,
      mid: 0.25,
      highMid: 0.1,
      brilliance: 0.05,
    })
    features.centroid = 0.22
    features.onsetDensity = 0.4

    const first = new TrackDNAController(storage)
    first.setTrack(track)
    for (let i = 0; i < 130; i++) first.update(features, 0.1)
    expect(storage.length).toBe(1)

    const replay = new TrackDNAController(storage)
    replay.setTrack(track)
    expect(replay.dna).toEqual(first.dna)
  })
})
