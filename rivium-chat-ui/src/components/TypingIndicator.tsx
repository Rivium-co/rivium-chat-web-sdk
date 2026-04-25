import React from 'react';
import { clsx } from 'clsx';
import { useRiviumChatTheme } from '../theme/RiviumChatTheme';

export interface TypingIndicatorProps {
  typingUsers: string[];
  userDisplayNames?: Record<string, string>;
  className?: string;
}

export function TypingIndicator({
  typingUsers,
  userDisplayNames = {},
  className,
}: TypingIndicatorProps) {
  const { colors, dimensions } = useRiviumChatTheme();

  if (typingUsers.length === 0) return null;

  const getDisplayText = () => {
    if (typingUsers.length === 1) {
      const name = userDisplayNames[typingUsers[0]] || typingUsers[0];
      return `${name} is typing...`;
    }
    if (typingUsers.length === 2) {
      const name1 = userDisplayNames[typingUsers[0]] || typingUsers[0];
      const name2 = userDisplayNames[typingUsers[1]] || typingUsers[1];
      return `${name1} and ${name2} are typing...`;
    }
    return `${typingUsers.length} people are typing...`;
  };

  return (
    <div
      className={clsx('flex items-center gap-2 px-2 py-1', className)}
      style={{ paddingLeft: dimensions.smallAvatarSize + 16 }}
    >
      <div
        className="flex items-center gap-2 px-4 py-3"
        style={{
          backgroundColor: colors.otherMessageBubble,
          borderRadius: dimensions.messageBubbleRadius,
        }}
      >
        <TypingDots />
        <span className="text-sm" style={{ color: colors.typingIndicator }}>
          {getDisplayText()}
        </span>
      </div>
    </div>
  );
}

export interface TypingDotsProps {
  dotCount?: number;
  dotSize?: number;
  className?: string;
}

export function TypingDots({
  dotCount = 3,
  dotSize = 8,
  className,
}: TypingDotsProps) {
  const { colors } = useRiviumChatTheme();

  return (
    <div className={clsx('flex items-center gap-1', className)}>
      {Array.from({ length: dotCount }).map((_, index) => (
        <span
          key={index}
          className="rounded-full animate-bounce"
          style={{
            width: dotSize,
            height: dotSize,
            backgroundColor: colors.typingIndicator,
            animationDelay: `${index * 0.15}s`,
            animationDuration: '0.6s',
          }}
        />
      ))}
    </div>
  );
}

export interface CompactTypingIndicatorProps {
  isTyping: boolean;
  className?: string;
}

export function CompactTypingIndicator({
  isTyping,
  className,
}: CompactTypingIndicatorProps) {
  const { colors } = useRiviumChatTheme();

  if (!isTyping) return null;

  return (
    <div
      className={clsx('inline-flex px-3 py-2 rounded-xl', className)}
      style={{ backgroundColor: colors.otherMessageBubble }}
    >
      <TypingDots />
    </div>
  );
}

export default TypingIndicator;
