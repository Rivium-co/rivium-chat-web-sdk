/** Hardcoded configuration values. */
export const SDK_CONFIG = {
  /** Base URL for the RiviumChat API */
  baseUrl: 'https://chat.rivium.co',
  /** WebSocket URL for Centrifugo realtime server */
  centrifugoUrl: 'wss://ws-chat.rivium.co/connection/websocket',
} as const;

/** Configuration for RiviumChat SDK. */
export interface RiviumChatConfig {
  /** Your RiviumChat API key */
  apiKey: string;

  /** The external user ID for the current user */
  userId: string;

  /** Optional user info (displayName, locale, etc.) */
  userInfo?: Record<string, string>;
}

/** Internal normalized config type. */
export interface NormalizedConfig {
  apiKey: string;
  userId: string;
  userInfo: Record<string, string>;
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
  };
}
