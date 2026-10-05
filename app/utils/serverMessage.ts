/**
 * The server's error text from a failed $fetch.
 *
 * Read it from the response BODY (`data.statusMessage`), not from
 * `error.statusMessage`: ofetch fills the latter from the HTTP status line,
 * and HTTP/2 (what Vercel serves) has no status text - in production it would
 * be empty, and every "which error was it?" check would silently fail.
 */
export function serverMessage(e: unknown): string {
  const err = e as { data?: { statusMessage?: string; message?: string }; statusMessage?: string } | null
  return err?.data?.statusMessage ?? err?.data?.message ?? err?.statusMessage ?? ''
}
