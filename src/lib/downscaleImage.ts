// Everything the app saves shares Chrome's ~5 MB per-site localStorage, and a
// single phone photo is 3–6 MB as text. Shrinking images before they're stored
// keeps a project from silently hitting that limit and losing work.

/** Data Bank photos: MobileNet only ever looks at 224×224, so 320 px loses nothing for training. */
export const BANK_IMAGE_MAX_DIM = 320
/** Pictures pasted onto the canvas (e.g. a screenshot of a question) stay readable at this size. */
export const CANVAS_IMAGE_MAX_DIM = 1000

export interface DownscaledImage {
  dataUrl: string
  blob: Blob
  width: number
  height: number
}

/**
 * Decodes an image file/blob and re-encodes it as a JPEG no larger than
 * `maxDim` on its longest side. Throws if the browser can't decode the image
 * (e.g. HEIC or a corrupted file).
 */
export async function downscaleImage(source: Blob, maxDim: number, quality = 0.85): Promise<DownscaledImage> {
  const bitmap = await createImageBitmap(source)
  try {
    const scale = Math.min(1, maxDim / Math.max(bitmap.width, bitmap.height))
    const width = Math.max(1, Math.round(bitmap.width * scale))
    const height = Math.max(1, Math.round(bitmap.height * scale))
    const canvas = document.createElement('canvas')
    canvas.width = width
    canvas.height = height
    const ctx = canvas.getContext('2d')
    if (!ctx) throw new Error('Canvas unavailable')
    // JPEG has no transparency — give see-through PNGs a white background instead of black
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, width, height)
    ctx.imageSmoothingQuality = 'high'
    ctx.drawImage(bitmap, 0, 0, width, height)
    const blob = await new Promise<Blob>((resolve, reject) =>
      canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('Could not encode image'))), 'image/jpeg', quality)
    )
    const dataUrl = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = () => resolve(reader.result as string)
      reader.onerror = () => reject(reader.error)
      reader.readAsDataURL(blob)
    })
    return { dataUrl, blob, width, height }
  } finally {
    bitmap.close()
  }
}
