/**
 * Report app events to the Vibradex diagnostics hub.
 *
 * Ported from VibraFlow's lib/vibradex.ts. Same three design notes apply, and
 * all three matter more here than they look:
 *
 * - SERVER ONLY. The API key must never reach the browser. Nitro keeps
 *   server/utils out of the client bundle, which is why this lives here.
 * - NO BATCHING. Vercel serverless functions freeze the moment they respond,
 *   so a queue with an interval flush would silently drop events. Each one is
 *   POSTed immediately.
 * - FAIL-SAFE. Telemetry must never break or slow a user action: short timeout,
 *   errors swallowed, missing config means silently do nothing.
 */
export type VibradexType = 'info' | 'warning' | 'error' | 'debug'
export type VibradexSeverity = 'low' | 'medium' | 'high' | 'critical'

interface ReportOptions {
  type?: VibradexType
  severity?: VibradexSeverity
  details?: Record<string, unknown>
}

/**
 * Defaults to info/low deliberately: in Vibradex `severity: "high"` marks the
 * app as DOWN and can fire a Web Push alert to Kilian's phone. Ordinary user
 * actions must never do that.
 */
export async function reportEvent(message: string, opts: ReportOptions = {}): Promise<void> {
  const hub = process.env.VIBRADEX_URL
  const key = process.env.VIBRADEX_API_KEY
  if (!hub || !key) return

  try {
    await $fetch(`${hub}/api/diagnostics/events`, {
      method: 'POST',
      headers: { 'x-api-key': key },
      body: {
        type: opts.type ?? 'info',
        severity: opts.severity ?? 'low',
        message,
        details: opts.details,
      },
      timeout: 3000,
    })
  } catch (error) {
    console.error('[vibradex] failed to report event:', error)
  }
}
