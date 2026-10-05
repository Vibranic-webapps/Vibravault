export interface AuthUser {
  id: string
  email: string
  name: string | null
  /** The shared demo account: password, reset and name are locked server-side. */
  demo: boolean
}

/** Shared, SSR-safe auth state. useState survives hydration, so the server's
 *  answer isn't thrown away and re-fetched on the client. */
export const useAuthUser = () => useState<AuthUser | null>('auth-user', () => null)
