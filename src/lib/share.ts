export function buildShareUrl(origin: string, slug: string): string {
  const trimmedOrigin = origin.trim().replace(/\/+$/, '')
  if (!/^https?:\/\//i.test(trimmedOrigin)) throw new Error('A valid web origin is required.')
  return `${trimmedOrigin}/t/${encodeURIComponent(slug)}`
}

export function buildNimiqPayDeepLink(tabUrl: string): string {
  return `https://nimpay.app/miniapps/open/${encodeURIComponent(tabUrl)}`
}
