import React, { useState, useRef, useCallback, KeyboardEvent } from 'react';
import { clsx } from 'clsx';
import { useRiviumChatTheme } from '../theme/RiviumChatTheme';
import { Message } from '../state/RiviumChatProvider';

export interface ChatInputFieldProps {
  onSendMessage: (content: string) => void;
  onTyping?: () => void;
  replyingTo?: Message | null;
  onCancelReply?: () => void;
  editingMessage?: Message | null;
  onCancelEdit?: () => void;
  onEditMessage?: (messageId: string, content: string) => void;
  onAttachmentClick?: () => void;
  onEmojiClick?: () => void;
  disabled?: boolean;
  placeholder?: string;
  className?: string;
}

export function ChatInputField({
  onSendMessage,
  onTyping,
  replyingTo,
  onCancelReply,
  editingMessage,
  onCancelEdit,
  onEditMessage,
  onAttachmentClick,
  onEmojiClick,
  disabled = false,
  placeholder = 'Type a message...',
  className,
}: ChatInputFieldProps) {
  const [text, setText] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const { colors, dimensions } = useRiviumChatTheme();

  // When editing starts, populate the text field
  const prevEditingRef = useRef<string | null>(null);
  if (editingMessage && editingMessage.id !== prevEditingRef.current) {
    prevEditingRef.current = editingMessage.id;
    setText(editingMessage.content);
    setTimeout(() => textareaRef.current?.focus(), 0);
  } else if (!editingMessage && prevEditingRef.current) {
    prevEditingRef.current = null;
  }

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setText(e.target.value);
    if (e.target.value) {
      onTyping?.();
    }

    // Auto-resize textarea
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 120)}px`;
    }
  };

  const handleSend = useCallback(() => {
    const trimmed = text.trim();
    if (trimmed) {
      if (editingMessage && onEditMessage) {
        onEditMessage(editingMessage.id, trimmed);
        onCancelEdit?.();
      } else {
        onSendMessage(trimmed);
      }
      setText('');
      if (textareaRef.current) {
        textareaRef.current.style.height = 'auto';
      }
    }
  }, [text, onSendMessage, editingMessage, onEditMessage, onCancelEdit]);

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className={clsx('flex flex-col', className)}>
      {/* Edit preview */}
      {editingMessage && (
        <div
          className="flex items-center gap-3 px-4 py-2"
          style={{ backgroundColor: colors.replyBackground }}
        >
          <div
            className="w-0.5 h-10 rounded-full"
            style={{ backgroundColor: colors.myMessageBubble }}
          />
          <div className="flex-1 min-w-0">
            <p className="text-xs font-medium" style={{ color: colors.myMessageBubble }}>
              Editing message
            </p>
            <p className="text-xs text-gray-500 truncate">{editingMessage.content}</p>
          </div>
          <button
            onClick={() => {
              onCancelEdit?.();
              setText('');
            }}
            className="p-1 text-gray-400 hover:text-gray-600 transition-colors"
          >
            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
              <path
                fillRule="evenodd"
                d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
                clipRule="evenodd"
              />
            </svg>
          </button>
        </div>
      )}

      {/* Reply preview */}
      {replyingTo && !editingMessage && (
        <div
          className="flex items-center gap-3 px-4 py-2"
          style={{ backgroundColor: colors.replyBackground }}
        >
          <div
            className="w-0.5 h-10 rounded-full"
            style={{ backgroundColor: colors.linkText }}
          />
          <div className="flex-1 min-w-0">
            <p className="text-xs font-medium" style={{ color: colors.linkText }}>
              Replying to {replyingTo.senderUserId}
            </p>
            <p className="text-xs text-gray-500 truncate">{replyingTo.content}</p>
          </div>
          <button
            onClick={onCancelReply}
            className="p-1 text-gray-400 hover:text-gray-600 transition-colors"
          >
            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
              <path
                fillRule="evenodd"
                d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
                clipRule="evenodd"
              />
            </svg>
          </button>
        </div>
      )}

      {/* Input bar */}
      <div className="flex items-end gap-2 p-2 bg-white border-t border-gray-200">
        {/* Attachment button */}
        {onAttachmentClick && (
          <button
            onClick={onAttachmentClick}
            disabled={disabled}
            className="p-2 text-gray-500 hover:text-gray-700 disabled:opacity-50 transition-colors"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13"
              />
            </svg>
          </button>
        )}

        {/* Text input container */}
        <div
          className="flex-1 flex items-end gap-2 px-4 py-2 bg-gray-100"
          style={{ borderRadius: dimensions.inputFieldRadius }}
        >
          {/* Emoji button */}
          {onEmojiClick && (
            <button
              onClick={onEmojiClick}
              disabled={disabled}
              className="text-gray-500 hover:text-gray-700 disabled:opacity-50 transition-colors"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M14.828 14.828a4 4 0 01-5.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
            </button>
          )}

          {/* Textarea */}
          <textarea
            ref={textareaRef}
            value={text}
            onChange={handleChange}
            onKeyDown={handleKeyDown}
            disabled={disabled}
            placeholder={placeholder}
            rows={1}
            className="flex-1 bg-transparent resize-none outline-none text-sm min-h-[24px] max-h-[120px]"
            style={{ lineHeight: '24px' }}
          />
        </div>

        {/* Send button */}
        <button
          onClick={handleSend}
          disabled={disabled || !text.trim()}
          className="p-2 rounded-full text-white transition-colors disabled:opacity-50"
          style={{
            backgroundColor: text.trim() ? colors.myMessageBubble : colors.offlineIndicator,
          }}
        >
          <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
            <path d="M10.894 2.553a1 1 0 00-1.788 0l-7 14a1 1 0 001.169 1.409l5-1.429A1 1 0 009 15.571V11a1 1 0 112 0v4.571a1 1 0 00.725.962l5 1.428a1 1 0 001.17-1.408l-7-14z" />
          </svg>
        </button>
      </div>
    </div>
  );
}

export default ChatInputField;
