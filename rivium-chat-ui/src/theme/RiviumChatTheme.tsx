import React, { createContext, useContext, useEffect, useMemo, useState, ReactNode } from 'react';

/**
 * RiviumChat-specific colors
 */
export interface RiviumChatColors {
  myMessageBubble: string;
  otherMessageBubble: string;
  myMessageText: string;
  otherMessageText: string;
  timestampText: string;
  linkText: string;
  onlineIndicator: string;
  offlineIndicator: string;
  typingIndicator: string;
  readReceipt: string;
  unreadReceipt: string;
  failedMessage: string;
  pendingMessage: string;
  replyBackground: string;
  mentionHighlight: string;
  /** Screen and input bar background. */
  background?: string;
  /** Text field and menu surfaces. */
  surface?: string;
  /** Separator lines. */
  border?: string;
}

/**
 * RiviumChat-specific dimensions
 */
export interface RiviumChatDimensions {
  messageBubbleRadius: number;
  messagePadding: number;
  avatarSize: number;
  smallAvatarSize: number;
  inputFieldRadius: number;
  maxBubbleWidthRatio: number;
  imagePreviewSize: number;
  reactionPillRadius: number;
}

export interface RiviumChatThemeValue {
  colors: RiviumChatColors;
  dimensions: RiviumChatDimensions;
  isDark: boolean;
}

const defaultLightColors: RiviumChatColors = {
  myMessageBubble: '#007AFF',
  otherMessageBubble: '#E9E9EB',
  myMessageText: '#FFFFFF',
  otherMessageText: '#000000',
  timestampText: '#8E8E93',
  linkText: '#007AFF',
  onlineIndicator: '#34C759',
  offlineIndicator: '#C7C7CC',
  typingIndicator: '#8E8E93',
  readReceipt: '#007AFF',
  unreadReceipt: '#8E8E93',
  failedMessage: '#FF3B30',
  pendingMessage: '#8E8E93',
  replyBackground: '#F2F2F7',
  mentionHighlight: 'rgba(0, 122, 255, 0.2)',
  background: '#FFFFFF',
  surface: '#F2F2F7',
  border: '#E5E5EA',
};

const defaultDarkColors: RiviumChatColors = {
  myMessageBubble: '#0A84FF',
  otherMessageBubble: '#2C2C2E',
  myMessageText: '#FFFFFF',
  otherMessageText: '#FFFFFF',
  timestampText: '#8E8E93',
  linkText: '#0A84FF',
  onlineIndicator: '#30D158',
  offlineIndicator: '#636366',
  typingIndicator: '#8E8E93',
  readReceipt: '#0A84FF',
  unreadReceipt: '#8E8E93',
  failedMessage: '#FF453A',
  pendingMessage: '#8E8E93',
  replyBackground: '#1C1C1E',
  mentionHighlight: 'rgba(10, 132, 255, 0.3)',
  background: '#000000',
  surface: '#1C1C1E',
  border: '#38383A',
};

const defaultDimensions: RiviumChatDimensions = {
  messageBubbleRadius: 16,
  messagePadding: 12,
  avatarSize: 40,
  smallAvatarSize: 24,
  inputFieldRadius: 24,
  maxBubbleWidthRatio: 0.75,
  imagePreviewSize: 320,
  reactionPillRadius: 12,
};

const RiviumChatThemeContext = createContext<RiviumChatThemeValue>({
  colors: defaultLightColors,
  dimensions: defaultDimensions,
  isDark: false,
});

export interface RiviumChatThemeProviderProps {
  children: ReactNode;
  colors?: Partial<RiviumChatColors>;
  dimensions?: Partial<RiviumChatDimensions>;
  /**
   * `true` dark, `false` light (default), or `'system'` to follow the
   * device's light / dark setting, live.
   */
  dark?: boolean | 'system';
}

const DARK_QUERY = '(prefers-color-scheme: dark)';

/** Whether the system is in dark mode now, following changes. Only listens when `enabled`. */
function useSystemDark(enabled: boolean): boolean {
  const read = () =>
    typeof window !== 'undefined' && typeof window.matchMedia === 'function'
      ? window.matchMedia(DARK_QUERY).matches
      : false;
  const [isDark, setIsDark] = useState(() => (enabled ? read() : false));

  useEffect(() => {
    if (!enabled || typeof window === 'undefined' || typeof window.matchMedia !== 'function') return;
    const query = window.matchMedia(DARK_QUERY);
    const update = () => setIsDark(query.matches);
    update();
    if (query.addEventListener) {
      query.addEventListener('change', update);
      return () => query.removeEventListener('change', update);
    }
    query.addListener(update); // older Safari
    return () => query.removeListener(update);
  }, [enabled]);

  return isDark;
}

/**
 * Provides RiviumChat theme to child components
 */
export function RiviumChatThemeProvider({
  children,
  colors,
  dimensions,
  dark = false,
}: RiviumChatThemeProviderProps) {
  const systemDark = useSystemDark(dark === 'system');
  const isDark = dark === 'system' ? systemDark : dark;
  const theme = useMemo<RiviumChatThemeValue>(() => {
    const baseColors = isDark ? defaultDarkColors : defaultLightColors;
    return {
      colors: { ...baseColors, ...colors },
      dimensions: { ...defaultDimensions, ...dimensions },
      isDark,
    };
  }, [colors, dimensions, isDark]);

  return (
    <RiviumChatThemeContext.Provider value={theme}>
      {children}
    </RiviumChatThemeContext.Provider>
  );
}

/**
 * Hook to access RiviumChat theme
 */
export function useRiviumChatTheme(): RiviumChatThemeValue {
  return useContext(RiviumChatThemeContext);
}

/**
 * Default exports
 */
export { defaultLightColors, defaultDarkColors, defaultDimensions };
