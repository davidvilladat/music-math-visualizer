import { useEffect, useState } from 'react'
import { useStore } from '../state/store'
import type { Renderer } from '../render/renderer'

interface Props {
  renderer: Renderer | null
}

export function DebugOverlay({ renderer }: Props) {
  const visible = useStore((s) => s.debugVisible)
  const setDebugVisible = useStore((s) => s.setDebugVisible)
  const [snapshot, setSnapshot] = useState<string>('')

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'd' || e.key === 'D') setDebugVisible(!visible)
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [visible, setDebugVisible])

  useEffect(() => {
    if (!visible || !renderer) return
    const id = setInterval(() => {
      const f = renderer.features
      setSnapshot(
        [
          `FPS: ${renderer.fps}`,
          `RMS: ${f.rms.toFixed(3)}`,
          `Centroid: ${f.centroid.toFixed(3)}`,
          `Flux: ${f.flux.toFixed(3)}`,
          `BPM: ${f.bpm ? f.bpm.toFixed(1) : '--'} (${f.bpmConfidence.toFixed(2)})`,
          `Rolloff: ${f.rolloff.toFixed(3)}`,
          `Beat: ${f.beatPulse.toFixed(3)}`,
          `Kick/Snare/Hat: ${f.kickPulse.toFixed(2)} / ${f.snarePulse.toFixed(2)} / ${f.hatPulse.toFixed(2)}`,
          `Downbeat: ${f.downbeatPulse.toFixed(2)}`,
          `Onset density: ${f.onsetDensity.toFixed(2)}`,
          `Section: ${f.sectionIndex} (${f.sectionNovelty.toFixed(2)})`,
          `SubBass: ${f.subBass.toFixed(3)}`,
          `Bass: ${f.bass.toFixed(3)}`,
          `LowMid: ${f.lowMid.toFixed(3)}`,
          `Mid: ${f.mid.toFixed(3)}`,
          `HighMid: ${f.highMid.toFixed(3)}`,
          `Brilliance: ${f.brilliance.toFixed(3)}`,
          `Normalized B/M/H: ${f.normalized.bass.toFixed(2)} / ${f.normalized.mid.toFixed(2)} / ${f.normalized.brilliance.toFixed(2)}`,
        ].join('\n')
      )
    }, 100)
    return () => clearInterval(id)
  }, [visible, renderer])

  if (!visible) return null

  return (
    <pre style={overlayStyle}>
      {snapshot}
    </pre>
  )
}

const overlayStyle: React.CSSProperties = {
  position: 'fixed',
  bottom: 16,
  left: 16,
  background: 'rgba(0,0,0,0.7)',
  color: '#0f0',
  fontFamily: 'monospace',
  fontSize: 12,
  padding: '8px 12px',
  borderRadius: 6,
  zIndex: 20,
  pointerEvents: 'none',
  lineHeight: 1.6,
  margin: 0,
}
