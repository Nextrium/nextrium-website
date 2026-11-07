// Images uploaded to the public `media` bucket. SVG is left out because it can
// carry scripts, and the extension comes from the type, never the file name.
const IMAGE_EXTENSIONS: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/gif': 'gif',
}

export const IMAGE_ACCEPT = Object.keys(IMAGE_EXTENSIONS).join(',')
export const MAX_IMAGE_BYTES = 10 * 1024 * 1024

export function checkMediaImage(file: { type: string; size: number }):
  { ok: true; ext: string; contentType: string } | { ok: false; error: string } {
  const ext = IMAGE_EXTENSIONS[file.type]
  if (!ext) return { ok: false, error: 'Use a JPEG, PNG, WebP or GIF image.' }
  if (file.size > MAX_IMAGE_BYTES) return { ok: false, error: 'Image must be under 10 MB.' }
  return { ok: true, ext, contentType: file.type }
}
