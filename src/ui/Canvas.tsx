import { useEffect, useRef } from 'react'
import { Renderer } from '../render/renderer'

interface Props {
  onRendererReady: (r: Renderer) => void
}

export function Canvas({ onRendererReady }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const renderer = new Renderer(canvas)
    onRendererReady(renderer)
    renderer.startLoop()
    return () => renderer.destroy()
  }, [onRendererReady])

  return (
    <canvas
      ref={canvasRef}
      data-testid="visualizer-canvas"
      style={{ position: 'fixed', inset: 0, width: '100%', height: '100%', display: 'block' }}
    />
  )
}
