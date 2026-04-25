import React from 'react';
import { clsx } from 'clsx';

export const defaultReactions = ['❤️', '👍', '👎', '😂', '😮', '😢'];

export interface MessageReactionPickerProps {
  onReactionSelected: (emoji: string) => void;
  onMoreClick?: () => void;
  commonReactions?: string[];
  className?: string;
}

export function MessageReactionPicker({
  onReactionSelected,
  onMoreClick,
  commonReactions = defaultReactions,
  className,
}: MessageReactionPickerProps) {
  return (
    <div
      className={clsx(
        'inline-flex items-center gap-1 px-2 py-1 bg-white rounded-full shadow-lg',
        className
      )}
    >
      {commonReactions.map((emoji) => (
        <button
          key={emoji}
          onClick={() => onReactionSelected(emoji)}
          className="w-9 h-9 flex items-center justify-center text-xl hover:bg-gray-100 rounded-lg transition-colors"
        >
          {emoji}
        </button>
      ))}
      {onMoreClick && (
        <button
          onClick={onMoreClick}
          className="w-9 h-9 flex items-center justify-center text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
        >
          <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
            <path
              fillRule="evenodd"
              d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z"
              clipRule="evenodd"
            />
          </svg>
        </button>
      )}
    </div>
  );
}

export interface MessageReactionsProps {
  reactions: Record<string, number>;
  userReactions?: Set<string>;
  onReactionTap: (emoji: string) => void;
  className?: string;
}

export function MessageReactions({
  reactions,
  userReactions = new Set(),
  onReactionTap,
  className,
}: MessageReactionsProps) {
  if (Object.keys(reactions).length === 0) return null;

  return (
    <div className={clsx('flex flex-wrap gap-1', className)}>
      {Object.entries(reactions).map(([emoji, count]) => {
        const isSelected = userReactions.has(emoji);
        return (
          <button
            key={emoji}
            onClick={() => onReactionTap(emoji)}
            className={clsx(
              'flex items-center gap-1 px-2 py-0.5 rounded-full text-sm transition-colors',
              isSelected ? 'bg-blue-100 text-blue-600' : 'bg-gray-100 hover:bg-gray-200'
            )}
          >
            <span>{emoji}</span>
            {count > 1 && <span className="text-xs">{count}</span>}
          </button>
        );
      })}
    </div>
  );
}

export default MessageReactionPicker;
