/**
 * Records the visualizer canvas together with the audio the analyser is already
 * listening to, and hands back a single file.
 *
 * The canvas stream carries only the WebGL surface, so no UI chrome lands in the
 * capture. Audio comes from the same tab-capture tracks the analyser reads,
 * which means whatever drives the visuals is exactly what is recorded -- and in
 * demo mode, where nothing is actually playing, the result is silent video
 * rather than a failure.
 */

export interface RecordingFormat {
  mimeType: string
  extension: string
}

// MP4 first: it drops straight into an editor. WebM is the fallback every
// MediaRecorder implementation supports.
const FORMAT_CANDIDATES: readonly RecordingFormat[] = [
  // Deliberately unpinned. Naming a codec profile here (avc1.640028 is H.264
  // Level 4.0) caps the encoder near 1080p, and since recording runs at 2x that
  // ceiling is passed on any ordinary display -- whereupon MediaRecorder accepts
  // the type and then dies mid-take. Letting the browser pick the level keeps
  // high-resolution captures working.
  { mimeType: 'video/mp4', extension: 'mp4' },
  { mimeType: 'video/webm;codecs=vp9,opus', extension: 'webm' },
  { mimeType: 'video/webm;codecs=vp8,opus', extension: 'webm' },
  { mimeType: 'video/webm', extension: 'webm' },
]

function defaultSupportCheck(type: string): boolean {
  return typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported(type)
}

export function pickRecordingFormat(
  isSupported: (type: string) => boolean = defaultSupportCheck,
): RecordingFormat | null {
  return FORMAT_CANDIDATES.find((format) => isSupported(format.mimeType)) ?? null
}

/**
 * Bits per pixel per frame, held between a floor that keeps 720p clean and a
 * ceiling that stops a 4K capture from producing a file nobody can move around.
 * 0.12 is generous enough that the point cloud's fine filaments survive, which
 * is where a stingy bitrate shows first.
 */
export function bitrateFor(width: number, height: number, fps: number): number {
  const raw = width * height * fps * 0.12
  return Math.round(Math.max(8_000_000, Math.min(80_000_000, raw)))
}

export function recordingFilename(mode: string, date: Date, extension: string): string {
  const pad = (value: number) => String(value).padStart(2, '0')
  const stamp =
    `${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}` +
    `-${pad(date.getHours())}${pad(date.getMinutes())}${pad(date.getSeconds())}`
  return `visualizer-${mode}-${stamp}.${extension}`
}

export interface RecorderStartOptions {
  canvas: HTMLCanvasElement
  /** Live tracks owned by the audio engine. Empty in demo mode. */
  audioTracks: MediaStreamTrack[]
  fps: number
}

export interface RecordingResult {
  blob: Blob
  format: RecordingFormat
  hadAudio: boolean
  /** Non-null when the take ended on its own; the blob still holds what landed. */
  failure: string | null
}

export class SessionRecorder {
  private recorder: MediaRecorder | null = null
  private stream: MediaStream | null = null
  private format: RecordingFormat | null = null
  private chunks: Blob[] = []
  private startedAt = 0
  private hadAudio = false
  private failure: string | null = null

  /** Set when the encoder or a track died on its own rather than on request. */
  get failureReason(): string | null {
    return this.failure
  }

  get isRecording(): boolean {
    return this.recorder !== null && this.recorder.state !== 'inactive'
  }

  get elapsedMs(): number {
    return this.startedAt === 0 ? 0 : performance.now() - this.startedAt
  }

  start({ canvas, audioTracks, fps }: RecorderStartOptions): RecordingFormat {
    if (this.isRecording) throw new Error('Already recording')

    const format = pickRecordingFormat()
    if (!format) throw new Error('This browser cannot record video from a canvas.')

    const stream = canvas.captureStream(fps)
    for (const track of audioTracks) stream.addTrack(track)

    const recorder = new MediaRecorder(stream, {
      mimeType: format.mimeType,
      videoBitsPerSecond: bitrateFor(canvas.width, canvas.height, fps),
      audioBitsPerSecond: 192_000,
    })
    recorder.ondataavailable = (event) => {
      if (event.data.size > 0) this.chunks.push(event.data)
    }
    // Without this an encoder failure just flips the recorder to inactive, the
    // UI keeps showing a running clock, and the next click starts a second take
    // instead of saving the first.
    recorder.onerror = (event) => {
      const failed = event as unknown as { error?: { message?: string } }
      this.failure = failed.error?.message ?? 'The encoder stopped unexpectedly.'
    }

    this.chunks = []
    this.recorder = recorder
    this.stream = stream
    this.format = format
    this.hadAudio = audioTracks.length > 0
    this.failure = null
    this.startedAt = performance.now()

    // A timeslice keeps a long take from sitting in one growing buffer.
    recorder.start(1000)
    return format
  }

  async stop(): Promise<RecordingResult | null> {
    const recorder = this.recorder
    const format = this.format
    if (!recorder || !format) return null

    if (recorder.state !== 'inactive') {
      await new Promise<void>((resolve) => {
        recorder.onstop = () => resolve()
        recorder.stop()
      })
    }

    // Only the canvas track is ours. The audio tracks belong to the analyser and
    // must keep running, or stopping a recording would kill the visualizer.
    this.stream?.getVideoTracks().forEach((track) => track.stop())

    const result: RecordingResult = {
      blob: new Blob(this.chunks, { type: format.mimeType }),
      format,
      hadAudio: this.hadAudio,
      failure: this.failure,
    }

    this.chunks = []
    this.recorder = null
    this.stream = null
    this.format = null
    this.startedAt = 0
    return result
  }

  dispose(): void {
    if (this.recorder && this.recorder.state !== 'inactive') this.recorder.stop()
    this.stream?.getVideoTracks().forEach((track) => track.stop())
    this.chunks = []
    this.recorder = null
    this.stream = null
    this.format = null
    this.startedAt = 0
  }
}

export function downloadRecording(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  link.remove()

  // Revoking while the browser is still copying the blob to disk cancels the
  // download outright. A long take runs to hundreds of megabytes, which is far
  // more than a few seconds of writing, so the URL is held until the page goes
  // away -- with a generous fallback so a long session does not accumulate
  // recordings in memory forever.
  const release = () => URL.revokeObjectURL(url)
  window.addEventListener('pagehide', release, { once: true })
  window.setTimeout(() => {
    window.removeEventListener('pagehide', release)
    release()
  }, 10 * 60_000)
}
