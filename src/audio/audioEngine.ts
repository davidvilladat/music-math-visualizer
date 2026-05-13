import { type AudioFeatures, FFT_SIZE, BIN_COUNT } from './audioFeatures'
import { OnePole, BANDS, bandEnergy } from './bandSplit'
import { computeRms, computeCentroid, computeFlux, computeRolloff, fillSpectrum } from './features'
import { BeatDetector } from './beatDetector'
import { useStore } from '../state/store'

type ChromiumDisplayMediaOptions = DisplayMediaStreamOptions & {
  preferCurrentTab?: boolean
  selfBrowserSurface?: 'include' | 'exclude'
  systemAudio?: 'include' | 'exclude'
}

type TabAudioConstraints = MediaTrackConstraints & {
  suppressLocalAudioPlayback?: boolean
}

export class AudioEngine {
  private ctx: AudioContext | null = null
  private analyser: AnalyserNode | null = null
  private stream: MediaStream | null = null
  private onEnded: (() => void) | null = null
  private stopping = false

  private freqData: Uint8Array<ArrayBuffer> | null = null
  private prevFreqData: Uint8Array<ArrayBuffer> | null = null
  private timeData: Uint8Array<ArrayBuffer> | null = null

  private smoothers = {
    subBass:    new OnePole(0.05),
    bass:       new OnePole(0.07),
    lowMid:     new OnePole(0.10),
    mid:        new OnePole(0.12),
    highMid:    new OnePole(0.18),
    brilliance: new OnePole(0.25),
    flux:       new OnePole(0.08),
    sectionEnergy: new OnePole(6.0),
  }

  private beat = new BeatDetector()
  private lastTime = performance.now()
  private musicalBeats = 0

  setOnEnded(cb: (() => void) | null): void {
    this.onEnded = cb
  }

  async start(): Promise<void> {
    this.stop()

    const stream = await navigator.mediaDevices.getDisplayMedia({
      video: { displaySurface: 'browser' } as MediaTrackConstraints,
      audio: { suppressLocalAudioPlayback: false } as TabAudioConstraints,
      preferCurrentTab: true,
      selfBrowserSurface: 'include',
      systemAudio: 'include',
    } as ChromiumDisplayMediaOptions)

    const audioTracks = stream.getAudioTracks()
    if (audioTracks.length === 0) {
      stream.getTracks().forEach((t) => t.stop())
      throw new Error(
        'No audio track captured. Make sure "Share tab audio" is checked in the browser prompt.'
      )
    }

    // stop video tracks — we only need audio
    stream.getVideoTracks().forEach((t) => t.stop())

    this.stream = stream
    audioTracks.forEach((track) => {
      track.onended = () => {
        if (this.stopping || this.stream !== stream) return
        this.stop()
        this.onEnded?.()
      }
    })

    this.ctx = new AudioContext()
    const source = this.ctx.createMediaStreamSource(new MediaStream(audioTracks))

    this.analyser = this.ctx.createAnalyser()
    this.analyser.fftSize = FFT_SIZE
    this.analyser.smoothingTimeConstant = 0 // we do our own smoothing
    source.connect(this.analyser)

    this.freqData = new Uint8Array(BIN_COUNT) as Uint8Array<ArrayBuffer>
    this.prevFreqData = new Uint8Array(BIN_COUNT) as Uint8Array<ArrayBuffer>
    this.timeData = new Uint8Array(FFT_SIZE) as Uint8Array<ArrayBuffer>
    this.lastTime = performance.now()
  }

  stop(): void {
    this.stopping = true
    this.stream?.getTracks().forEach((t) => t.stop())
    void this.ctx?.close()
    this.stream = null
    this.ctx = null
    this.analyser = null
    this.freqData = null
    this.prevFreqData = null
    this.timeData = null
    this.stopping = false
  }

  tick(features: AudioFeatures): void {
    const analyser = this.analyser
    const freq = this.freqData
    const prev = this.prevFreqData
    const time = this.timeData
    if (!analyser || !freq || !prev || !time) return

    const now = performance.now()
    const delta = (now - this.lastTime) / 1000
    this.lastTime = now

    // rotate buffers
    prev.set(freq)
    analyser.getByteFrequencyData(freq)
    analyser.getByteTimeDomainData(time)

    const sr = this.ctx!.sampleRate
    const devParams = useStore.getState().devParams

    // update smoother taus from dev params
    this.smoothers.subBass.setTau(devParams.tauSubBass)
    this.smoothers.bass.setTau(devParams.tauBass)
    this.smoothers.lowMid.setTau(devParams.tauLowMid)
    this.smoothers.mid.setTau(devParams.tauMid)
    this.smoothers.highMid.setTau(devParams.tauHighMid)
    this.smoothers.brilliance.setTau(devParams.tauBrilliance)

    features.subBass    = this.smoothers.subBass.update(bandEnergy(freq, BANDS.subBass.lo,    BANDS.subBass.hi,    sr))
    features.bass       = this.smoothers.bass.update(bandEnergy(freq, BANDS.bass.lo,       BANDS.bass.hi,       sr))
    features.lowMid     = this.smoothers.lowMid.update(bandEnergy(freq, BANDS.lowMid.lo,     BANDS.lowMid.hi,     sr))
    features.mid        = this.smoothers.mid.update(bandEnergy(freq, BANDS.mid.lo,        BANDS.mid.hi,        sr))
    features.highMid    = this.smoothers.highMid.update(bandEnergy(freq, BANDS.highMid.lo,   BANDS.highMid.hi,   sr))
    features.brilliance = this.smoothers.brilliance.update(bandEnergy(freq, BANDS.brilliance.lo, BANDS.brilliance.hi, sr))

    features.rms      = computeRms(time)
    features.centroid = computeCentroid(freq, sr)
    features.rolloff  = computeRolloff(freq, 0)

    const rawFlux = computeFlux(freq, prev)
    features.flux = this.smoothers.flux.update(rawFlux)

    this.beat.updateParams({
      threshold: devParams.beatThreshold,
      refractoryMs: devParams.beatRefractoryMs,
    })
    features.beatPulse    = this.beat.update(rawFlux, now, delta)
    features.lastBeatTime = this.beat.lastBeat
    features.bpm          = this.beat.bpm
    features.bpmConfidence = this.beat.bpmConfidence

    const effectiveBpm = features.bpm ?? 120
    const confidence = Math.max(0.2, features.bpmConfidence)
    const beatsPerSecond = effectiveBpm / 60
    this.musicalBeats += delta * beatsPerSecond * confidence
    const beatDurationMs = 60_000 / effectiveBpm
    const sinceBeat = features.lastBeatTime > 0 ? now - features.lastBeatTime : this.musicalBeats % 1 * beatDurationMs
    features.beatPhase = Math.max(0, Math.min(1, sinceBeat / beatDurationMs))
    features.barPhase = (this.musicalBeats / 4) % 1
    features.phrasePhase = (this.musicalBeats / 16) % 1
    const barDistance = Math.min(features.barPhase, 1 - features.barPhase)
    features.barPulse = Math.exp(-barDistance * 18)
    const rawSectionEnergy = Math.min(1, features.rms * 0.7 + features.bass * 0.45 + features.flux * 0.7)
    features.sectionEnergy = this.smoothers.sectionEnergy.update(rawSectionEnergy)

    fillSpectrum(freq, features.spectrum)
  }

  get isRunning(): boolean {
    return this.analyser !== null
  }
}
