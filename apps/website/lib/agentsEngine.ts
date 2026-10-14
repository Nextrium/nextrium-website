interface AgentsEngineOptions extends RequestInit {
  timeoutMs?: number
}

export interface AgentsEngineResult<T = any> {
  ok: boolean
  status: number
  data: T | null
  error?: string
}

/**
 * Shared fetch wrapper for every call from the website into the Agents
 * Engine. Centralizes: auth header, JSON parsing, and — critically — a
 * timeout with a specific, user-facing message when the engine doesn't
 * respond in time. Render's free tier spins down after inactivity and can
 * take up to ~50s to wake on the first request, so a generic hang or a
 * Vercel function-timeout page is the wrong failure mode here; callers
 * should always get back a clear reason.
 */
export async function fetchAgentsEngine<T = any>(
  path: string,
  options: AgentsEngineOptions = {}
): Promise<AgentsEngineResult<T>> {
  const engineUrl = process.env.AGENTS_ENGINE_URL || 'http://localhost:3001'
  const apiKey = process.env.AGENTS_ENGINE_API_KEY
  const { timeoutMs = 55000, headers, ...rest } = options

  if (!engineUrl.startsWith('http://') && !engineUrl.startsWith('https://')) {
    return {
      ok: false,
      status: 0,
      data: null,
      error: `AGENTS_ENGINE_URL is not configured correctly (got "${engineUrl}"). A relative or empty URL resolves back to this website's own domain instead of the AI Engine — set AGENTS_ENGINE_URL to the engine's full https:// address in this environment's variables.`,
    }
  }

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), timeoutMs)

  try {
    const response = await fetch(`${engineUrl}${path}`, {
      ...rest,
      headers: {
        'Content-Type': 'application/json',
        ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {}),
        ...headers,
      },
      signal: controller.signal,
      cache: 'no-store',
    })

    let data: any = null
    try {
      data = await response.json()
    } catch {
      // Non-JSON or empty response body — data stays null
    }

    if (!response.ok || data?.success === false) {
      const message = data?.error || data?.message || `Agents Engine responded with HTTP ${response.status}`
      return { ok: false, status: response.status, data, error: message }
    }

    return { ok: true, status: response.status, data }
  } catch (err: any) {
    if (err.name === 'AbortError') {
      return {
        ok: false,
        status: 0,
        data: null,
        error: `The AI Engine didn't respond within ${Math.round(timeoutMs / 1000)}s. If it's been idle, the hosting free tier can take up to ~50s to wake from sleep — please try again in a moment.`,
      }
    }
    return {
      ok: false,
      status: 0,
      data: null,
      error: err.message || 'Could not reach the AI Engine.',
    }
  } finally {
    clearTimeout(timeout)
  }
}
