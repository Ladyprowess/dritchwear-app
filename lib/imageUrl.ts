// Image optimization helper.
//
// Product images are currently 2MB+ PNGs hosted on GitHub (raw.githubusercontent),
// served with a 5-minute cache and two 302 redirects. That's the main cause of
// slow-loading product images / bounce.
//
// optimizeImageUrl() routes remote images through the wsrv.nl (weserv) image CDN,
// which resizes to the display width, converts to WebP, and caches for a year.
// Typical result: ~2MB PNG -> ~10KB WebP (200x smaller). No re-upload / DB change.
//
// Local assets (require()), data:/blob: URIs, and already-proxied URLs are passed
// through untouched.

const WSRV_HOST = 'https://wsrv.nl/'

type OptimizeOpts = {
  /** Target display width in CSS px. The CDN resizes to this (never upscales). */
  width?: number
  /** WebP quality 1-100. Default 70 - visually lossless for product photos. */
  quality?: number
}

// Normalize GitHub "blob" / "raw" URLs to raw.githubusercontent.com so the CDN
// fetches the file directly instead of following GitHub's 302 redirect chain.
function normalizeGitHub(url: string): string {
  // https://github.com/USER/REPO/blob/BRANCH/PATH?raw=true
  // https://github.com/USER/REPO/raw/BRANCH/PATH
  const m = url.match(/^https?:\/\/github\.com\/([^/]+)\/([^/]+)\/(?:blob|raw)\/(.+?)(?:\?.*)?$/i)
  if (m) {
    return `https://raw.githubusercontent.com/${m[1]}/${m[2]}/${m[3]}`
  }
  return url
}

export function optimizeImageUrl(
  src: string | number | null | undefined,
  opts: OptimizeOpts = {}
): string | number | null | undefined {
  // Local require()'d assets are numbers on native - leave untouched.
  if (typeof src !== 'string') return src
  if (!src) return src

  // Don't touch inline/local/already-optimized sources.
  if (
    src.startsWith('data:') ||
    src.startsWith('blob:') ||
    src.startsWith('file:') ||
    src.includes('wsrv.nl') ||
    src.includes('weserv.nl')
  ) {
    return src
  }

  // Only remote http(s) images can be proxied.
  if (!/^https?:\/\//i.test(src)) return src

  const normalized = normalizeGitHub(src)
  const { width, quality = 70 } = opts

  // wsrv takes the source URL without its protocol in the `url` param.
  const source = normalized.replace(/^https?:\/\//i, '')

  const params = new URLSearchParams()
  params.set('url', source)
  if (width) params.set('w', String(width))
  params.set('q', String(quality))
  params.set('output', 'webp')
  params.set('we', '') // "without enlargement" - never upscale small images

  return `${WSRV_HOST}?${params.toString()}`
}
