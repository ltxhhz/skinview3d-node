import { PNG } from 'pngjs'
import { Canvas, Image } from 'skia-canvas'
import { DataTexture, RGBAFormat } from 'three'

export type RemoteImage =
  | string
  | {
      src: string
    }

export async function loadImage(source: RemoteImage): Promise<Image> {
  const image = new Image()
  return new Promise((resolve, reject) => {
    image.onload = () => resolve(image)
    image.onerror = reject
    if (typeof source === 'string') {
      image.src = source
    } else {
      image.src = source.src
    }
  })
}

export function canvas2DataTexture(canvas:Canvas) {
	const png = PNG.sync.read(canvas.toBufferSync('png'))
	const texture = new DataTexture(Uint8Array.from(png.data), png.width, png.height, RGBAFormat)
	texture.needsUpdate = true
	texture.flipY = true
	return texture
}
