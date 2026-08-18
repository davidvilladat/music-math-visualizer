import type { AudioFeatures } from '../audio/audioFeatures'
import type { TrackInfo } from '../state/store'

export interface LearnedTrackProfile {
  bassBalance: number
  midBalance: number
  highBalance: number
  brightness: number
  dynamicRange: number
  onsetDensity: number
}

export interface TrackDNA {
  seed: number
  hue: number
  radius: number
  twist: number
  rotation: number
  phase: number
  texture: number
  paletteSpread: number
}

const PROFILE_PREFIX = 'spotify-visualizer:track-profile:v1:'

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value))
}

function fract(value: number): number {
  return value - Math.floor(value)
}

/** FNV-1a; stable across browsers and sessions, unlike String hash shortcuts. */
export function hashTrackKey(value: string): number {
  let hash = 0x811c9dc5
  for (let i = 0; i < value.length; i++) {
    hash ^= value.charCodeAt(i)
    hash = Math.imul(hash, 0x01000193)
  }
  return hash >>> 0
}

function randomUnit(seed: number, channel: number): number {
  let value = seed + Math.imul(channel + 1, 0x9e3779b9)
  value ^= value >>> 16
  value = Math.imul(value, 0x21f0aaad)
  value ^= value >>> 15
  value = Math.imul(value, 0x735a2d97)
  value ^= value >>> 15
  return (value >>> 0) / 0x1_0000_0000
}

export function trackKey(track: TrackInfo | null): string {
  if (!track) return 'idle'
  if (track.id) return `${track.source ?? 'track'}:${track.id}`
  return [track.source ?? 'track', track.artist, track.title, Math.round(track.duration / 1000)]
    .join(':')
    .trim()
    .toLowerCase()
}

export function createTrackDNA(track: TrackInfo | null, profile?: LearnedTrackProfile | null): TrackDNA {
  const seed = hashTrackKey(trackKey(track))
  const bass = profile?.bassBalance ?? 0.33
  const mid = profile?.midBalance ?? 0.34
  const high = profile?.highBalance ?? 0.33
  const brightness = profile?.brightness ?? 0.5
  const dynamics = profile?.dynamicRange ?? 0.5
  const density = profile?.onsetDensity ?? 0.35

  return {
    seed: seed / 0xffff_ffff,
    hue: fract(randomUnit(seed, 0) * 0.72 + brightness * 0.28),
    radius: 0.90 + randomUnit(seed, 1) * 0.16 + (bass - 0.33) * 0.16,
    twist: 0.88 + randomUnit(seed, 2) * 0.24 + (mid - 0.34) * 0.12,
    rotation: randomUnit(seed, 3) < 0.5 ? -1 : 1,
    phase: randomUnit(seed, 4) * Math.PI * 2,
    texture: clamp01(randomUnit(seed, 5) * 0.55 + density * 0.3 + dynamics * 0.15),
    paletteSpread: clamp01(0.28 + randomUnit(seed, 6) * 0.42 + high * 0.18),
  }
}

function validProfile(value: unknown): value is LearnedTrackProfile {
  if (!value || typeof value !== 'object') return false
  const record = value as Record<string, unknown>
  return ['bassBalance', 'midBalance', 'highBalance', 'brightness', 'dynamicRange', 'onsetDensity']
    .every((key) => typeof record[key] === 'number' && Number.isFinite(record[key]))
}

function defaultStorage(): Storage | null {
  try {
    return typeof localStorage === 'undefined' ? null : localStorage
  } catch {
    return null
  }
}

/** Learns a compact sound profile and caches it under the non-PII track hash. */
export class TrackDNAController {
  private key = 'idle'
  private track: TrackInfo | null = null
  private dnaValue = createTrackDNA(null)
  private elapsed = 0
  private sampleWeight = 0
  private bassSum = 0
  private midSum = 0
  private highSum = 0
  private brightnessSum = 0
  private onsetSum = 0
  private rmsMin = 1
  private rmsMax = 0
  private lastSavedAt = 0

  constructor(private readonly storage: Storage | null = defaultStorage()) {}

  setTrack(track: TrackInfo | null): boolean {
    const nextKey = trackKey(track)
    if (nextKey === this.key) return false
    this.key = nextKey
    this.track = track
    this.elapsed = 0
    this.sampleWeight = 0
    this.bassSum = 0
    this.midSum = 0
    this.highSum = 0
    this.brightnessSum = 0
    this.onsetSum = 0
    this.rmsMin = 1
    this.rmsMax = 0
    this.lastSavedAt = 0
    this.dnaValue = createTrackDNA(track, this.loadProfile())
    return true
  }

  update(features: AudioFeatures, deltaSeconds: number): void {
    if (!this.track) return
    const dt = Math.max(0, Math.min(deltaSeconds, 0.1))
    if (dt === 0 || features.rms < 0.003) return
    const n = features.normalized
    this.elapsed += dt
    this.sampleWeight += dt
    this.bassSum += (n.subBass + n.bass) * 0.5 * dt
    this.midSum += (n.lowMid + n.mid) * 0.5 * dt
    this.highSum += (n.highMid + n.brilliance) * 0.5 * dt
    this.brightnessSum += features.centroid * dt
    this.onsetSum += features.onsetDensity * dt
    this.rmsMin = Math.min(this.rmsMin, features.rms)
    this.rmsMax = Math.max(this.rmsMax, features.rms)

    // Wait for enough music to avoid fingerprinting a silent lead-in. Updating
    // at coarse intervals keeps the identity stable instead of drifting frame by frame.
    if (this.sampleWeight >= 12 && this.elapsed - this.lastSavedAt >= 8) {
      const profile = this.profile()
      this.dnaValue = createTrackDNA(this.track, profile)
      this.saveProfile(profile)
      this.lastSavedAt = this.elapsed
    }
  }

  get dna(): TrackDNA { return this.dnaValue }
  get currentKey(): string { return this.key }

  private profile(): LearnedTrackProfile {
    const weight = Math.max(this.sampleWeight, 0.001)
    const bass = this.bassSum / weight
    const mid = this.midSum / weight
    const high = this.highSum / weight
    const total = Math.max(0.001, bass + mid + high)
    return {
      bassBalance: clamp01(bass / total),
      midBalance: clamp01(mid / total),
      highBalance: clamp01(high / total),
      brightness: clamp01(this.brightnessSum / weight),
      dynamicRange: clamp01((this.rmsMax - this.rmsMin) * 4),
      onsetDensity: clamp01(this.onsetSum / weight),
    }
  }

  private storageKey(): string {
    return `${PROFILE_PREFIX}${hashTrackKey(this.key).toString(16)}`
  }

  private loadProfile(): LearnedTrackProfile | null {
    try {
      const raw = this.storage?.getItem(this.storageKey())
      if (!raw) return null
      const value: unknown = JSON.parse(raw)
      return validProfile(value) ? value : null
    } catch {
      return null
    }
  }

  private saveProfile(profile: LearnedTrackProfile): void {
    try {
      this.storage?.setItem(this.storageKey(), JSON.stringify(profile))
    } catch {
      // Storage may be unavailable or full; deterministic metadata DNA still works.
    }
  }
}
