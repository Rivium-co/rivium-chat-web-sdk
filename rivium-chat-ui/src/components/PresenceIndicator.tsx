import React from 'react';
import { clsx } from 'clsx';
import { useRiviumChatTheme } from '../theme/RiviumChatTheme';

export interface PresenceIndicatorProps {
  isOnline: boolean;
  size?: number;
  showBorder?: boolean;
  borderColor?: string;
  className?: string;
}

export function PresenceIndicator({
  isOnline,
  size = 12,
  showBorder = true,
  borderColor = '#FFFFFF',
  className,
}: PresenceIndicatorProps) {
  const { colors } = useRiviumChatTheme();

  return (
    <span
      className={clsx(
        'inline-block rounded-full transition-colors duration-300',
        className
      )}
      style={{
        width: size,
        height: size,
        backgroundColor: isOnline ? colors.onlineIndicator : colors.offlineIndicator,
        border: showBorder ? `2px solid ${borderColor}` : undefined,
      }}
    />
  );
}

export interface PresenceStatusProps {
  isOnline: boolean;
  className?: string;
}

export function PresenceStatus({ isOnline, className }: PresenceStatusProps) {
  const { colors } = useRiviumChatTheme();

  return (
    <div className={clsx('flex items-center gap-1.5', className)}>
      <span
        className="w-2 h-2 rounded-full transition-colors duration-300"
        style={{
          backgroundColor: isOnline ? colors.onlineIndicator : colors.offlineIndicator,
        }}
      />
      <span
        className="text-xs transition-colors duration-300"
        style={{
          color: isOnline ? colors.onlineIndicator : colors.offlineIndicator,
        }}
      >
        {isOnline ? 'Online' : 'Offline'}
      </span>
    </div>
  );
}

export default PresenceIndicator;
