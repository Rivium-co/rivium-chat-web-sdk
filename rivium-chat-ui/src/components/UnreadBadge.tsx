import React from 'react';
import { clsx } from 'clsx';

export interface UnreadBadgeProps {
  count: number;
  maxCount?: number;
  backgroundColor?: string;
  textColor?: string;
  minSize?: number;
  className?: string;
}

export function UnreadBadge({
  count,
  maxCount = 99,
  backgroundColor = '#EF4444',
  textColor = '#FFFFFF',
  minSize = 20,
  className,
}: UnreadBadgeProps) {
  if (count <= 0) return null;

  const displayText = count > maxCount ? `${maxCount}+` : count.toString();
  const isLargeNumber = displayText.length > 2;

  return (
    <span
      className={clsx(
        'inline-flex items-center justify-center text-xs font-bold',
        isLargeNumber ? 'px-1.5 rounded-full' : 'rounded-full',
        className
      )}
      style={{
        minWidth: minSize,
        minHeight: minSize,
        backgroundColor,
        color: textColor,
      }}
    >
      {displayText}
    </span>
  );
}

export interface UnreadDotProps {
  hasUnread: boolean;
  size?: number;
  color?: string;
  className?: string;
}

export function UnreadDot({
  hasUnread,
  size = 8,
  color = '#EF4444',
  className,
}: UnreadDotProps) {
  if (!hasUnread) return null;

  return (
    <span
      className={clsx('inline-block rounded-full', className)}
      style={{
        width: size,
        height: size,
        backgroundColor: color,
      }}
    />
  );
}

export default UnreadBadge;
