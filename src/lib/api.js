let portalRole
export function setPortalRole(role) { portalRole = role }

export class ApiError extends Error {
  constructor(status, message) {
    super(message)
    this.status = status
  }
}
export async function api(path, { method = 'GET', body, signal } = {}) {
  let response
  try {
    response = await fetch('/api' + path, {
      method,
      signal,
      credentials: 'same-origin',
      headers: {
        ...(body && { 'Content-Type': 'application/json' }),
        ...(portalRole && !['/me','/auth/login','/auth/logout'].includes(path) && { 'X-Campus-Role': portalRole }),
      },
      body: body && JSON.stringify(body),
    })
  } catch (e) {
    if (e.name === 'AbortError') throw e
    throw new ApiError(0, 'Connection lost. Check your connection and try again.')
  }
  const data = await response.json().catch(() => ({}))
  if (!response.ok || !Object.hasOwn(data, 'data')) {
    if (response.status === 401 && !['/auth/login', '/me'].includes(path))
      window.dispatchEvent(new Event('session-expired'))
    throw new ApiError(response.status, data.error || 'The campus API is unavailable. Please try again.')
  }
  return data.data
}
export async function all(path, signal) {
  const rows = []
  for (let offset = 0; ; offset += 100) {
    const page = await api(
      path + (path.includes('?') ? '&' : '?') + new URLSearchParams({ limit: 100, offset }),
      { signal },
    )
    rows.push(...page)
    if (page.length < 100) return rows
  }
}
