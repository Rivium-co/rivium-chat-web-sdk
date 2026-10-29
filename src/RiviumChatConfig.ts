/** Hardcoded configuration values. */
export const SDK_CONFIG = {
  /** Base URL for the RiviumChat API */
  baseUrl: 'https://chat.rivium.co',
  /** WebSocket URL for Centrifugo realtime server */
  centrifugoUrl: 'wss://ws-chat.rivium.co/connection/websocket',
} as const;

import type { TokenProvider } from './services/TokenManager';
import type { OutboxStore } from './services/Outbox';

/** Configuration for RiviumChat SDK. */
export interface RiviumChatConfig {
  /** Your RiviumChat API key */
  apiKey: string;

  /** The external user ID for the current user */
  userId: string;

  /** Optional user info (displayName, locale, etc.) */
  userInfo?: Record<string, string>;

  /**
   * Recommended. Returns a user token issued by **your server**, which calls
   * `POST https://chat.rivium.co/api/v1/users/token` with its server secret
   * (never put the secret in the app). Every request then proves who the user
   * is, so nobody holding the public API key can act as another user.
   *
   * The SDK calls it on connect, shortly before the token expires, and when
   * the server reports an expired token — refreshes are invisible to the
   * user. `userInfo` is ignored when set: your server passes it with the token.
   *
   * Without it the SDK uses the legacy mode (API key + userId), which a
   * project can disable in Rivium Console.
   */
  tokenProvider?: TokenProvider;

  /**
   * How long a request to the Chat API may take, in milliseconds, before it
   * fails with a `RiviumChatError` whose `code` is `'timeout'`.
   * Default: 30000 (30 seconds).
   */
  requestTimeoutMs?: number;

  /**
   * Keep messages written without network and send them when the connection
   * is back, in order and never twice. Default: `false` (`sendMessage()`
   * without network rejects, as before).
   *
   * When on, `sendMessage()` sends a `clientMessageId` with every message and,
   * on a transient failure (no network, timeout, 408, 429, 5xx), returns the
   * message as pending (`isPending: true`, `id: "local_<clientMessageId>"`)
   * instead of rejecting. Follow it with the `messageSent` / `messageFailed`
   * events. A permanent failure (400, 401, 403, 404, 413, ...) still rejects.
   *
   * Needs the current Chat API (one that accepts `clientMessageId`).
   */
  queueOfflineMessages?: boolean;

  /**
   * Where the offline outbox keeps its messages (with `queueOfflineMessages`).
   * Default `'memory'`: kept while the page is open. `'localStorage'` keeps
   * them across reloads (one key per API key and user), or pass your own
   * `OutboxStore`. Call `clearPendingMessages()` on sign-out.
   */
  outboxStore?: 'memory' | 'localStorage' | OutboxStore;
}

/** Default for `requestTimeoutMs`. */
export const DEFAULT_REQUEST_TIMEOUT_MS = 30_000;

/** Internal normalized config type. */
export interface NormalizedConfig {
  apiKey: string;
  userId: string;
  userInfo: Record<string, string>;
  tokenProvider?: TokenProvider;
  requestTimeoutMs: number;
  queueOfflineMessages: boolean;
  outboxStore?: 'memory' | 'localStorage' | OutboxStore;
}

/** Validate and normalize configuration. */
export function normalizeConfig(config: RiviumChatConfig): NormalizedConfig {
  if (!config.apiKey) {
    throw new Error('API key is required');
  }
  if (!config.userId) {
    throw new Error('User ID is required');
  }

  return {
    apiKey: config.apiKey,
    userId: config.userId,
    userInfo: config.userInfo ?? {},
    tokenProvider: config.tokenProvider,
    requestTimeoutMs:
      typeof config.requestTimeoutMs === 'number' && config.requestTimeoutMs > 0
        ? config.requestTimeoutMs
        : DEFAULT_REQUEST_TIMEOUT_MS,
    queueOfflineMessages: config.queueOfflineMessages === true,
    outboxStore: config.outboxStore,
  };
}
