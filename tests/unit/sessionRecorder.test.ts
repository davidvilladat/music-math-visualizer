import { describe, expect, it } from 'vitest'
import {
  bitrateFor,
  pickRecordingFormat,
  recordingFilename,
} from '../../src/capture/SessionRecorder'

describe('recording format choice', () => {
  it('prefers mp4 when the browser can produce it', () => {
    const format = pickRecordingFormat(() => true)
    expect(format?.extension).toBe('mp4')
  })

  it('falls back to webm when mp4 is unavailable', () => {
    const format = pickRecordingFormat((type) => type.startsWith('video/webm'))
    expect(format?.mimeType).toBe('video/webm;codecs=vp9,opus')
    expect(format?.extension).toBe('webm')
  })

  it('reports nothing when no candidate is supported', () => {
    expect(pickRecordingFormat(() => false)).toBeNull()
  })

  it('keeps the extension consistent with the chosen container', () => {
    const format = pickRecordingFormat((type) => type === 'video/webm')
    expect(format).toEqual({ mimeType: 'video/webm', extension: 'webm' })
  })
})

describe('recording bitrate', () => {
  it('scales with resolution and frame rate', () => {
    const hd = bitrateFor(1920, 1080, 60)
    const uhd = bitrateFor(3840, 2160, 60)
    expect(uhd).toBeGreaterThan(hd)
  })

  it('holds a floor so small canvases still look clean', () => {
    expect(bitrateFor(320, 240, 24)).toBe(8_000_000)
  })

  it('holds a ceiling so a 4K capture stays a movable file', () => {
    expect(bitrateFor(7680, 4320, 60)).toBe(80_000_000)
  })
})

describe('recording filename', () => {
  it('carries the mode and a sortable timestamp', () => {
    const name = recordingFilename('seraph', new Date(2026, 7, 18, 9, 5, 3), 'mp4')
    expect(name).toBe('visualizer-seraph-20260818-090503.mp4')
  })
})
