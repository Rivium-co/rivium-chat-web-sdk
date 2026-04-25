import React from 'react';
import { clsx } from 'clsx';
import { Message } from '../state/RiviumChatProvider';

export type MessageAction = 'reply' | 'copy' | 'edit' | 'delete' | 'pin' | 'react';

export interface MessageContextMenuProps {
  message: Message;
  isMe: boolean;
  isPinned?: boolean;
  onAction: (action: MessageAction) => void;
  availableActions?: MessageAction[];
  className?: string;
}

const defaultActionsForMe: MessageAction[] = ['reply', 'copy', 'edit', 'delete', 'pin', 'react'];
const defaultActionsForOther: MessageAction[] = ['reply', 'copy', 'pin', 'react'];

export function MessageContextMenu({
  message,
  isMe,
  isPinned = false,
  onAction,
  availableActions,
  className,
}: MessageContextMenuProps) {
  const actions = availableActions || (isMe ? defaultActionsForMe : defaultActionsForOther);

  const actionConfig: Record<MessageAction, { icon: React.ReactNode; label: string; destructive?: boolean }> = {
    reply: {
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" />
        </svg>
      ),
      label: 'Reply',
    },
    copy: {
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
        </svg>
      ),
      label: 'Copy',
    },
    edit: {
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
        </svg>
      ),
      label: 'Edit',
    },
    delete: {
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
        </svg>
      ),
      label: 'Delete',
      destructive: true,
    },
    pin: {
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
        </svg>
      ),
      label: isPinned ? 'Unpin' : 'Pin',
    },
    react: {
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.828 14.828a4 4 0 01-5.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      ),
      label: 'React',
    },
  };

  return (
    <div
      className={clsx(
        'bg-white rounded-xl shadow-lg overflow-hidden py-2 min-w-[200px]',
        className
      )}
    >
      {actions.map((action, index) => {
        const config = actionConfig[action];
        return (
          <React.Fragment key={action}>
            <button
              onClick={() => onAction(action)}
              className={clsx(
                'w-full flex items-center gap-3 px-4 py-3 hover:bg-gray-100 transition-colors',
                config.destructive ? 'text-red-500' : 'text-gray-700'
              )}
            >
              {config.icon}
              <span className="text-sm">{config.label}</span>
            </button>
            {index < actions.length - 1 && (
              <div className="mx-4 border-t border-gray-100" />
            )}
          </React.Fragment>
        );
      })}
    </div>
  );
}

export default MessageContextMenu;
