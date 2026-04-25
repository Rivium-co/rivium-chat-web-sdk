import React, { useRef, useEffect, useCallback, useState } from 'react';
import { clsx } from 'clsx';
import { useChatChannel } from '../hooks/useChatChannel';
import { useRiviumChatTheme } from '../theme/RiviumChatTheme';
import { Message, Attachment } from '../state/RiviumChatProvider';
import { ChatMessageBubble } from './ChatMessageBubble';
import { ChatInputField } from './ChatInputField';
import { ChatAttachmentPicker, SelectedAttachment } from './ChatAttachmentPicker';
import { TypingIndicator } from './TypingIndicator';
import { MessageContextMenu, MessageAction } from './MessageContextMenu';
import { MessageReactionPicker } from './MessageReactionPicker';

export interface FileUploader {
  uploadFile(file: File): Promise<Attachment | null>;
}

export interface ChatScreenProps {
  roomId: string;
  currentUserId: string;
  readOnly?: boolean;
  messageBuilder?: (message: Message, isMe: boolean, isRead: boolean) => React.ReactNode;
  fileUploader?: FileUploader;
  onImageClick?: (url: string) => void;
  userDisplayNames?: Record<string, string>;
  className?: string;
}

export function ChatScreen({
  roomId,
  currentUserId,
  readOnly = false,
  messageBuilder,
  fileUploader,
  onImageClick,
  userDisplayNames = {},
  className,
}: ChatScreenProps) {
  const state = useChatChannel(roomId, currentUserId);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const [selectedMessage, setSelectedMessage] = useState<Message | null>(null);
  const [showContextMenu, setShowContextMenu] = useState(false);
  const [showReactionPicker, setShowReactionPicker] = useState(false);
  const [contextMenuPosition, setContextMenuPosition] = useState({ x: 0, y: 0 });
  const [showAttachmentPicker, setShowAttachmentPicker] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [editingMessage, setEditingMessage] = useState<Message | null>(null);

  // Scroll to bottom on new messages
  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [state.messages[0]?.id]);

  // Load more on scroll to top - only when user manually scrolls up
  const handleScroll = useCallback(() => {
    const container = messagesContainerRef.current;
    if (!container) return;

    // Only trigger load more if the container is scrollable (has enough content)
    // and user has scrolled near the top
    const isScrollable = container.scrollHeight > container.clientHeight;
    if (isScrollable && container.scrollTop < 100 && state.hasMore && !state.isLoadingMore) {
      state.loadMore();
    }
  }, [state]);

  // Mark as read when visible
  useEffect(() => {
    state.markAsRead();
  }, [state.messages.length]);

  const handleContextMenu = (message: Message, event: React.MouseEvent) => {
    event.preventDefault();
    setSelectedMessage(message);
    setContextMenuPosition({ x: event.clientX, y: event.clientY });
    setShowContextMenu(true);
  };

  const handleContextAction = async (action: MessageAction) => {
    if (!selectedMessage) return;

    switch (action) {
      case 'reply':
        state.setReplyingTo(selectedMessage);
        break;
      case 'copy':
        await navigator.clipboard.writeText(selectedMessage.content);
        break;
      case 'delete':
        await state.deleteMessage(selectedMessage.id);
        break;
      case 'edit':
        setEditingMessage(selectedMessage);
        break;
      case 'pin':
        // Would pin/unpin
        break;
      case 'react':
        setShowReactionPicker(true);
        return; // Don't close menu
    }

    setShowContextMenu(false);
    setSelectedMessage(null);
  };

  const handleReactionSelect = async (emoji: string) => {
    if (!selectedMessage) return;

    const hasReacted = (selectedMessage.reactions ?? []).some(
      (r) => r.userId === currentUserId && r.emoji === emoji
    );

    if (hasReacted) {
      await state.removeReaction(selectedMessage.id, emoji);
    } else {
      await state.addReaction(selectedMessage.id, emoji);
    }

    setShowReactionPicker(false);
    setShowContextMenu(false);
    setSelectedMessage(null);
  };

  // Handle attachments selected from picker
  const handleAttachmentsSelected = useCallback(async (selected: SelectedAttachment[]) => {
    if (!fileUploader || selected.length === 0) return;

    setIsUploading(true);
    try {
      for (const item of selected) {
        const attachment = await fileUploader.uploadFile(item.file);
        if (attachment) {
          const isImage = item.file.type.startsWith('image/');
          await state.sendMessage(
            isImage ? '📷 Image' : `📎 ${item.file.name}`,
            [attachment],
          );
        }
      }
    } finally {
      setIsUploading(false);
    }
  }, [fileUploader, state]);

  const isMessageRead = (message: Message) => {
    if (message.senderUserId !== currentUserId || !state.otherUserLastRead) {
      return false;
    }
    const messageDate = new Date(message.createdAt);
    return messageDate <= state.otherUserLastRead;
  };

  return (
    <div className={clsx('flex flex-col h-full bg-white', className)}>
      {/* Messages area */}
      <div
        ref={messagesContainerRef}
        onScroll={handleScroll}
        className="flex-1 overflow-y-auto"
      >
        {state.isInitialLoading ? (
          <div className="flex items-center justify-center h-full">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500" />
          </div>
        ) : state.error ? (
          <div className="flex flex-col items-center justify-center h-full text-center p-4">
            <p className="text-red-500 font-medium">Failed to load messages</p>
            <p className="text-gray-500 text-sm mt-1">{state.error.message}</p>
          </div>
        ) : state.messages.length === 0 ? (
          <div className="flex items-center justify-center h-full">
            <p className="text-gray-500">No messages yet</p>
          </div>
        ) : (
          <div className="flex flex-col py-4">
            {/* Loading more indicator */}
            {state.isLoadingMore && (
              <div className="flex justify-center py-4">
                <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-500" />
              </div>
            )}

            {/* Messages (reversed for newest at bottom) */}
            {[...state.messages].reverse().map((message) => {
              const isMe = message.senderUserId === currentUserId;

              if (messageBuilder) {
                return (
                  <div key={message.id} onContextMenu={(e) => handleContextMenu(message, e)}>
                    {messageBuilder(message, isMe, isMessageRead(message))}
                  </div>
                );
              }

              return (
                <div
                  key={message.id}
                  onContextMenu={(e) => handleContextMenu(message, e)}
                >
                  <ChatMessageBubble
                    message={message}
                    isMe={isMe}
                    isRead={isMessageRead(message)}
                    otherUserName={userDisplayNames[message.senderUserId]}
                    mentionDisplayNames={userDisplayNames}
                    onRetry={message.isFailed ? () => state.retryMessage(message.id) : undefined}
                    onReactionTap={(emoji) => {
                      const hasReacted = (message.reactions ?? []).some(
                        (r) => r.userId === currentUserId && r.emoji === emoji
                      );
                      if (hasReacted) {
                        state.removeReaction(message.id, emoji);
                      } else {
                        state.addReaction(message.id, emoji);
                      }
                    }}
                    onLongPress={() => {
                      setSelectedMessage(message);
                      setShowContextMenu(true);
                    }}
                    onImageClick={onImageClick}
                  />
                </div>
              );
            })}

            <div ref={messagesEndRef} />
          </div>
        )}
      </div>

      {/* Typing indicator - fixed above input */}
      {state.typingUsers.length > 0 && (
        <TypingIndicator
          typingUsers={state.typingUsers}
          userDisplayNames={userDisplayNames}
        />
      )}

      {/* Input field */}
      {!readOnly && (
        <ChatInputField
          onSendMessage={(content) => state.sendMessage(content)}
          onTyping={() => state.publishTyping()}
          replyingTo={state.replyingTo}
          onCancelReply={() => state.setReplyingTo(null)}
          editingMessage={editingMessage}
          onCancelEdit={() => setEditingMessage(null)}
          onEditMessage={(messageId, content) => state.editMessage(messageId, content)}
          onAttachmentClick={fileUploader ? () => setShowAttachmentPicker(true) : undefined}
          disabled={state.isInitialLoading || isUploading}
        />
      )}

      {/* Attachment picker */}
      {showAttachmentPicker && fileUploader && (
        <ChatAttachmentPicker
          visible={showAttachmentPicker}
          onClose={() => setShowAttachmentPicker(false)}
          onAttachmentsSelected={handleAttachmentsSelected}
        />
      )}

      {/* Context menu overlay */}
      {showContextMenu && selectedMessage && (
        <>
          <div
            className="fixed inset-0 z-40"
            onClick={() => {
              setShowContextMenu(false);
              setShowReactionPicker(false);
              setSelectedMessage(null);
            }}
          />
          <div
            className="fixed z-50"
            style={{
              left: contextMenuPosition.x,
              top: contextMenuPosition.y,
              transform: 'translate(-50%, -50%)',
            }}
          >
            {showReactionPicker ? (
              <MessageReactionPicker onReactionSelected={handleReactionSelect} />
            ) : (
              <MessageContextMenu
                message={selectedMessage}
                isMe={selectedMessage.senderUserId === currentUserId}
                isPinned={selectedMessage.isPinned}
                onAction={handleContextAction}
              />
            )}
          </div>
        </>
      )}
    </div>
  );
}

export default ChatScreen;
