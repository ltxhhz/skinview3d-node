import { Canvas, Image } from 'skia-canvas'
export type TextureCanvas = Canvas //| OffscreenCanvas
export type TextureSource = TextureCanvas | Image //| HTMLVideoElement | ImageBitmap
export type ModelType = 'default' | 'slim'

export function isTextureSource(value: unknown): value is TextureSource {
  return (
    value instanceof Image ||
    // value instanceof HTMLVideoElement ||
    value instanceof Canvas //||
    // (typeof ImageBitmap !== 'undefined' && value instanceof ImageBitmap) ||
    // (typeof OffscreenCanvas !== 'undefined' && value instanceof OffscreenCanvas)
  )
}
