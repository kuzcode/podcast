/** Прокси аудио-потока для плеера (same-origin, Range). */

export function decodeProxyUrl(encoded) {
  if (!encoded) return null
  try {
    return Buffer.from(encoded, 'base64url').toString('utf8')
  } catch {
    try {
      return Buffer.from(encoded, 'base64').toString('utf8')
    } catch {
      return null
    }
  }
}

export async function proxyAudioRequest(targetUrl, reqHeaders = {}) {
  const headers = {
    'User-Agent': 'Atelier/1.0',
    Accept: '*/*',
  }
  if (reqHeaders.range) headers.Range = reqHeaders.range

  const upstream = await fetch(targetUrl, {
    headers,
    redirect: 'follow',
    signal: AbortSignal.timeout(120000),
  })

  if (!upstream.ok) {
    throw new Error(`Upstream ${upstream.status}`)
  }

  return upstream
}

export function setProxyResponseHeaders(res, upstream) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Expose-Headers', 'Content-Length, Content-Range, Accept-Ranges')

  const ct = upstream.headers.get('content-type')
  if (ct) res.setHeader('Content-Type', ct)

  const cl = upstream.headers.get('content-length')
  if (cl) res.setHeader('Content-Length', cl)

  const cr = upstream.headers.get('content-range')
  if (cr) res.setHeader('Content-Range', cr)

  const ar = upstream.headers.get('accept-ranges')
  res.setHeader('Accept-Ranges', ar || 'bytes')
}
