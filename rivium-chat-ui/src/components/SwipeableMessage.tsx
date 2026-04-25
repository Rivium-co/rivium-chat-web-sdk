import React, { useRef, useState, useCallback } from 'react';
import { useRiviumChatTheme } from '../theme/RiviumChatTheme';

export interface SwipeableMessageProps {
  /** The message content to wrap. */
  children: React.ReactNode;
  /** Whether this message is from the current user. */
  isMe: boolean;
  /** Called when the user completes a swipe-to-reply gesture. */
  onReply?: () => void;
  /** The threshold in pixels at which the reply action is triggered. */
  replyThreshold?: number;
  /** Whether swipe-to-reply is enabled. */
  enabled?: boolean;
  /** Custom reply icon. */
  replyIcon?: React.ReactNode;
  /** Custom class name. */
  className?: string;
}

/**
 * A swipeable message wrapper that enables swipe-to-reply gesture.
 * Works with touch and mouse events for both mobile and desktop.
 */
export function SwipeableMessage({
  children,
  isMe,
  onReply,
  replyThreshold = 80,
  enabled = true,
  replyIcon,
  className = '',
}: SwipeableMessageProps) {
  const { colors } = useRiviumChatTheme();
  const [translateX, setTranslateX] = useState(0);
  const [isTriggered, setIsTriggered] = useState(false);
  const startX = useRef(0);
  const isDragging = useRef(false);

  const maxDrag = 120;

  const handleStart = useCallback((clientX: number) => {
    if (!enabled || !onReply) return;
    startX.current = clientX;
    isDragging.current = true;
  }, [enabled, onReply]);

  const handleMove = useCallback((clientX: number) => {
    if (!isDragging.current || !enabled || !onReply) return;

    let dx = clientX - startX.current;

    // For own messages, swipe left; for others, swipe right
    if (isMe) {
      dx = Math.min(0, Math.max(-maxDrag, dx));
    } else {
      dx = Math.max(0, Math.min(maxDrag, dx));
    }

    setTranslateX(dx);
    setIsTriggered(Math.abs(dx) >= replyThreshold);
  }, [enabled, onReply, isMe, replyThreshold]);

  const handleEnd = useCallback(() => {
    if (!isDragging.current) return;
    isDragging.current = false;

    if (Math.abs(translateX) >= replyThreshold && onReply) {
      onReply();
    }

    setTranslateX(0);
    setIsTriggered(false);
  }, [translateX, replyThreshold, onReply]);

  // Touch events
  const handleTouchStart = (e: React.TouchEvent) => handleStart(e.touches[0].clientX);
  const handleTouchMove = (e: React.TouchEvent) => handleMove(e.touches[0].clientX);
  const handleTouchEnd = () => handleEnd();

  // Mouse events
  const handleMouseDown = (e: React.MouseEvent) => handleStart(e.clientX);
  const handleMouseMove = (e: React.MouseEvent) => handleMove(e.clientX);
  const handleMouseUp = () => handleEnd();
  const handleMouseLeave = () => handleEnd();

  if (!enabled || !onReply) {
    return <>{children}</>;
  }

  const progress = Math.min(Math.abs(translateX) / replyThreshold, 1);

  const defaultIcon = (
    <span style={{ fontSize: 18 }}>↩️</span>
  );

  return (
    <div
      className={className}
      style={{
        position: 'relative',
        overflow: 'visible',
      }}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseLeave}
    >
      {/* Reply icon indicator */}
      <div
        style={{
          position: 'absolute',
          top: '50%',
          transform: `translateY(-50%) scale(${0.5 + progress * 0.5})`,
          opacity: progress,
          transition: isDragging.current ? 'none' : 'all 0.2s ease-out',
          ...(isMe ? { left: 16 } : { right: 16 }),
          width: 36,
          height: 36,
          borderRadius: '50%',
          backgroundColor: isTriggered ? colors.linkText : colors.replyBackground,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          pointerEvents: 'none',
        }}
      >
        {replyIcon || defaultIcon}
      </div>

      {/* Message content */}
      <div
        style={{
          transform: `translateX(${translateX}px)`,
          transition: isDragging.current ? 'none' : 'transform 0.2s ease-out',
          touchAction: 'pan-y',
          cursor: 'grab',
          userSelect: 'none',
        }}
      >
        {children}
      </div>
    </div>
  );
}

export default SwipeableMessage;
