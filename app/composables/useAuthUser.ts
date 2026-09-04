export interface AuthUser { id: string; email: string }

/** Shared, SSR-safe auth state. useState survives hydration, so the server's
 *  answer isn't thrown away and re-fetched on the client. */
export const useAuthUser = () => useState<AuthUser | null>('auth-user', () => null)
