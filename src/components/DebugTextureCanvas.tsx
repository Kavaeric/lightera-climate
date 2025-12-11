import { useRef } from 'react'
import { useThree, useFrame } from '@react-three/fiber'
import { Html } from '@react-three/drei'
import { TextureGridSimulation } from '../util/TextureGridSimulation'

interface DebugTextureCanvasProps {
  simulation: TextureGridSimulation
  position?: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right'
  size?: number
}

/**
 * Debug component that renders the simulation texture to a separate 2D canvas overlay
 * Much simpler than trying to render into the same WebGL context!
 */
export function DebugTextureCanvas({
  simulation,
  position = 'bottom-right',
  size = 256,
}: DebugTextureCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const { gl } = useThree()

  // Position the canvas
  const getPositionStyle = () => {
    const style: React.CSSProperties = {
      position: 'absolute',
      width: `${size}px`,
      height: `${8}px`,
      pointerEvents: 'none',
      imageRendering: 'pixelated', // Crisp pixels for the texture
    }

    switch (position) {
      case 'top-left':
        style.top = '10px'
        style.left = '10px'
        break
      case 'top-right':
        style.top = '10px'
        style.right = '10px'
        break
      case 'bottom-left':
        style.bottom = '10px'
        style.left = '10px'
        break
      case 'bottom-right':
        style.bottom = '10px'
        style.right = '10px'
        break
    }

    return style
  }

  // Read texture data and render to canvas
  useFrame(() => {
    if (!canvasRef.current) return

    const canvas = canvasRef.current
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    // Read pixels from the current render target
    const renderTarget = simulation.getCurrentRenderTarget()
    const textureWidth = simulation.getTextureWidth()
    const buffer = new Float32Array(textureWidth * 4)

    gl.readRenderTargetPixels(renderTarget, 0, 0, textureWidth, 1, buffer)

    // Create ImageData for the canvas
    const imageData = ctx.createImageData(textureWidth, 1)

    // Convert temperature values to grayscale (normalize -40 to 30 -> 0 to 255)
    for (let i = 0; i < simulation.getCellCount(); i++) {
      const temp = buffer[i * 4] // R channel = temperature
      const normalized = (temp + 40) / 70 // -40 to 30 -> 0 to 1
      const gray = Math.floor(normalized * 255)

      imageData.data[i * 4 + 0] = gray // R
      imageData.data[i * 4 + 1] = gray // G
      imageData.data[i * 4 + 2] = gray // B
      imageData.data[i * 4 + 3] = 255  // A
    }

    // Draw the 1-pixel-high texture data
    ctx.putImageData(imageData, 0, 0)

    // Scale it up to fill the canvas
    ctx.imageSmoothingEnabled = false
    const tempCanvas = document.createElement('canvas')
    tempCanvas.width = textureWidth
    tempCanvas.height = 1
    const tempCtx = tempCanvas.getContext('2d')
    if (tempCtx) {
      tempCtx.putImageData(imageData, 0, 0)
      ctx.clearRect(0, 0, canvas.width, canvas.height)
      ctx.drawImage(tempCanvas, 0, 0, canvas.width, canvas.height)
    }
  })

  return (
    <Html fullscreen>
      <canvas
        ref={canvasRef}
        width={simulation.getTextureWidth()}
        height={simulation.getTextureWidth()}
        style={getPositionStyle()}
      />
    </Html>
  )
}
