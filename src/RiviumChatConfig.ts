/** Hardcoded configuration values. */
export const SDK_CONFIG = {
  /** Base URL for the RiviumChat API */
  baseUrl: 'https://chat.rivium.co',
  /** WebSocket URL for Centrifugo realtime server */
  centrifugoUrl: 'wss://ws-chat.rivium.co/connection/websocket',
} as const;

import type { TokenProvider } from './services/TokenManager';

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
}

/** Internal normalized config type. */
export interface NormalizedConfig {
  apiKey: string;
  userId: string;
  userInfo: Record<string, string>;
  tokenProvider?: TokenProvider;
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
  };
}
