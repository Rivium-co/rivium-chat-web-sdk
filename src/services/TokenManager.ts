/** Returns a user token for the current user, issued by your server. */
export type TokenProvider = () => Promise<string>;

/** Refresh this long before `exp`, to absorb clock skew and request time. */
const REFRESH_MARGIN_MS = 60_000;

/**
 * Holds the current user token and refreshes it through the tokenProvider.
 *
 * - Reuses the cached token until shortly before it expires, then fetches a
 *   new one before the request, so an expired token rarely reaches the server.
 * - Concurrent callers share one in-flight refresh: a burst of requests
 *   triggers a single call to your server.
 */
export class TokenManager {
  private token?: string;
  private expiresAt?: number;
  private inFlight?: Promise<string>;

  constructor(
    private readonly provider: TokenProvider,
    private readonly now: () => number = Date.now,
  ) {}

  /** A token valid for at least the refresh margin. */
  get(): Promise<string> {
    if (this.token && (this.expiresAt === undefined || this.now() < this.expiresAt - REFRESH_MARGIN_MS)) {
      return Promise.resolve(this.token);
    }
    return this.refresh();
  }

  /** Fetches a new token even if the cached one looks valid. Joins a refresh in flight. */
  refresh(): Promise<string> {
    if (!this.inFlight) {
      this.inFlight = this.provider()
        .then((token) => {
          this.token = token;
          this.expiresAt = TokenManager.expiryOf(token);
          return token;
        })
        .finally(() => {
          this.inFlight = undefined;
        });
    }
    return this.inFlight;
  }

  /** Forgets the cached token. */
  clear(): void {
    this.token = undefined;
    this.expiresAt = undefined;
  }

  /** The `exp` claim of a JWT in ms, or undefined if it has none or cannot be read. */
  static expiryOf(token: string): number | undefined {
    try {
      const part = token.split('.')[1];
      if (!part) return undefined;
      const base64 = part.replace(/-/g, '+').replace(/_/g, '/');
      const json =
        typeof atob === 'function'
          ? atob(base64.padEnd(Math.ceil(base64.length / 4) * 4, '='))
          : Buffer.from(base64, 'base64').toString('utf8');
      const exp = JSON.parse(json)?.exp;
      return typeof exp === 'number' ? exp * 1000 : undefined;
    } catch {
      return undefined;
    }
  }
}
