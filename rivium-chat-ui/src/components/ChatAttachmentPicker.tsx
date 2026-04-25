import React, { useRef, useState } from 'react';
import { useRiviumChatTheme } from '../theme/RiviumChatTheme';

export interface AttachmentOption {
  /** Unique identifier for the option. */
  id: string;
  /** Display label. */
  label: string;
  /** Icon (emoji or text). */
  icon: string;
  /** Accept attribute for file input. */
  accept?: string;
  /** Whether this captures from camera. */
  capture?: 'user' | 'environment';
}

export interface SelectedAttachment {
  /** Unique identifier. */
  id: string;
  /** The file object. */
  file: File;
  /** Preview URL (for images). */
  previewUrl?: string;
}

export interface ChatAttachmentPickerProps {
  /** Whether the picker is visible. */
  visible: boolean;
  /** Called when the picker is closed. */
  onClose: () => void;
  /** Called when attachments are selected. */
  onAttachmentsSelected: (attachments: SelectedAttachment[]) => void;
  /** Custom attachment options. */
  options?: AttachmentOption[];
  /** Maximum number of attachments allowed. */
  maxAttachments?: number;
  /** Maximum file size in bytes. */
  maxFileSize?: number;
  /** Allowed file types (MIME types). */
  allowedTypes?: string[];
  /** Custom class name. */
  className?: string;
}

const DEFAULT_OPTIONS: AttachmentOption[] = [
  {
    id: 'image',
    label: 'Photo',
    icon: '🖼️',
    accept: 'image/*',
  },
  {
    id: 'camera',
    label: 'Camera',
    icon: '📷',
    accept: 'image/*',
    capture: 'environment',
  },
  {
    id: 'document',
    label: 'Document',
    icon: '📄',
    accept: '.pdf,.doc,.docx,.xls,.xlsx,.txt',
  },
  {
    id: 'file',
    label: 'File',
    icon: '📎',
    accept: '*/*',
  },
];

/**
 * An attachment picker for selecting files, images, and other media.
 */
export function ChatAttachmentPicker({
  visible,
  onClose,
  onAttachmentsSelected,
  options = DEFAULT_OPTIONS,
  maxAttachments = 10,
  maxFileSize = 25 * 1024 * 1024, // 25MB
  allowedTypes,
  className = '',
}: ChatAttachmentPickerProps) {
  const { colors } = useRiviumChatTheme();
  const [selectedAttachments, setSelectedAttachments] = useState<SelectedAttachment[]>([]);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const currentOptionRef = useRef<AttachmentOption | null>(null);

  if (!visible) return null;

  const handleOptionClick = (option: AttachmentOption) => {
    currentOptionRef.current = option;
    if (fileInputRef.current) {
      fileInputRef.current.accept = option.accept || '*/*';
      if (option.capture) {
        fileInputRef.current.setAttribute('capture', option.capture);
      } else {
        fileInputRef.current.removeAttribute('capture');
      }
      fileInputRef.current.click();
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    setError(null);

    const validFiles: SelectedAttachment[] = [];

    for (const file of files) {
      if (selectedAttachments.length + validFiles.length >= maxAttachments) {
        setError(`Maximum ${maxAttachments} attachments allowed`);
        break;
      }

      if (file.size > maxFileSize) {
        setError(`File "${file.name}" exceeds maximum size of ${formatFileSize(maxFileSize)}`);
        continue;
      }

      if (allowedTypes && !allowedTypes.some(type => file.type.match(type))) {
        setError(`File type not allowed: ${file.type}`);
        continue;
      }

      const attachment: SelectedAttachment = {
        id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        file,
        previewUrl: file.type.startsWith('image/') ? URL.createObjectURL(file) : undefined,
      };

      validFiles.push(attachment);
    }

    setSelectedAttachments([...selectedAttachments, ...validFiles]);

    // Reset input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleRemoveAttachment = (id: string) => {
    const attachment = selectedAttachments.find(a => a.id === id);
    if (attachment?.previewUrl) {
      URL.revokeObjectURL(attachment.previewUrl);
    }
    setSelectedAttachments(selectedAttachments.filter(a => a.id !== id));
  };

  const handleSend = () => {
    if (selectedAttachments.length > 0) {
      onAttachmentsSelected(selectedAttachments);
      setSelectedAttachments([]);
    }
    onClose();
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const overlayStyle: React.CSSProperties = {
    position: 'fixed',
    inset: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'flex-end',
    zIndex: 1000,
  };

  const containerStyle: React.CSSProperties = {
    backgroundColor: colors.otherMessageBubble,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: '16px 0 24px',
    width: '100%',
    maxWidth: 400,
    maxHeight: '80vh',
    overflowY: 'auto' as const,
    animation: 'slideUp 0.3s ease-out',
  };

  const handleStyle: React.CSSProperties = {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(0, 0, 0, 0.2)',
    margin: '0 auto 16px',
  };

  const optionsGridStyle: React.CSSProperties = {
    display: 'flex',
    flexWrap: 'wrap' as const,
    justifyContent: 'center',
    padding: '0 20px',
    gap: 12,
  };

  const optionButtonStyle: React.CSSProperties = {
    display: 'flex',
    flexDirection: 'column' as const,
    alignItems: 'center',
    width: 80,
    padding: '12px 8px',
    background: 'none',
    border: 'none',
    cursor: 'pointer',
    borderRadius: 12,
    transition: 'background-color 0.15s',
  };

  return (
    <>
      <style>
        {`
          @keyframes slideUp {
            from { transform: translateY(100%); }
            to { transform: translateY(0); }
          }
        `}
      </style>

      <div style={overlayStyle} onClick={onClose}>
        <div
          className={className}
          style={containerStyle}
          onClick={e => e.stopPropagation()}
        >
          <div style={handleStyle} />

          <h3 style={{
            fontSize: 18,
            fontWeight: 600,
            textAlign: 'center',
            margin: '0 0 20px',
            color: colors.otherMessageText,
          }}>
            Add Attachment
          </h3>

          <input
            ref={fileInputRef}
            type="file"
            multiple
            onChange={handleFileChange}
            style={{ display: 'none' }}
          />

          <div style={optionsGridStyle}>
            {options.map(option => (
              <button
                key={option.id}
                type="button"
                style={optionButtonStyle}
                onClick={() => handleOptionClick(option)}
                onMouseEnter={(e) => {
                  (e.currentTarget as HTMLButtonElement).style.backgroundColor = 'rgba(0, 0, 0, 0.05)';
                }}
                onMouseLeave={(e) => {
                  (e.currentTarget as HTMLButtonElement).style.backgroundColor = 'transparent';
                }}
              >
                <div style={{
                  width: 56,
                  height: 56,
                  borderRadius: 16,
                  backgroundColor: `${colors.linkText}15`,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  marginBottom: 8,
                  fontSize: 28,
                }}>
                  {option.icon}
                </div>
                <span style={{
                  fontSize: 12,
                  color: colors.otherMessageText,
                }}>
                  {option.label}
                </span>
              </button>
            ))}
          </div>

          {error && (
            <div style={{
              padding: '8px 16px',
              margin: '16px 16px 0',
              backgroundColor: `${colors.failedMessage}15`,
              borderRadius: 8,
              fontSize: 12,
              color: colors.failedMessage,
              textAlign: 'center',
            }}>
              {error}
            </div>
          )}

          {selectedAttachments.length > 0 && (
            <div style={{
              borderTop: '1px solid rgba(0, 0, 0, 0.1)',
              marginTop: 16,
              padding: '16px 16px 0',
            }}>
              <div style={{
                fontSize: 12,
                color: colors.timestampText,
                marginBottom: 12,
              }}>
                Selected ({selectedAttachments.length}/{maxAttachments})
              </div>

              <div style={{
                display: 'flex',
                gap: 12,
                overflowX: 'auto' as const,
                paddingBottom: 8,
              }}>
                {selectedAttachments.map(attachment => (
                  <div
                    key={attachment.id}
                    style={{
                      position: 'relative',
                      width: 72,
                      flexShrink: 0,
                    }}
                  >
                    {attachment.previewUrl ? (
                      <img
                        src={attachment.previewUrl}
                        alt=""
                        style={{
                          width: 64,
                          height: 64,
                          borderRadius: 8,
                          objectFit: 'cover' as const,
                        }}
                      />
                    ) : (
                      <div style={{
                        width: 64,
                        height: 64,
                        borderRadius: 8,
                        backgroundColor: `${colors.linkText}20`,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: 24,
                      }}>
                        📄
                      </div>
                    )}

                    <button
                      type="button"
                      onClick={() => handleRemoveAttachment(attachment.id)}
                      style={{
                        position: 'absolute',
                        top: -4,
                        right: 4,
                        width: 20,
                        height: 20,
                        borderRadius: '50%',
                        backgroundColor: '#FF3B30',
                        border: 'none',
                        color: '#fff',
                        fontSize: 12,
                        fontWeight: 600,
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      ✕
                    </button>

                    <div style={{
                      fontSize: 10,
                      marginTop: 4,
                      color: colors.timestampText,
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap' as const,
                      textAlign: 'center',
                    }}>
                      {attachment.file.name}
                    </div>
                  </div>
                ))}
              </div>

              <button
                type="button"
                onClick={handleSend}
                style={{
                  width: '100%',
                  padding: 12,
                  marginTop: 16,
                  borderRadius: 12,
                  border: 'none',
                  backgroundColor: colors.linkText,
                  color: '#fff',
                  fontSize: 16,
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                Send
              </button>
            </div>
          )}
        </div>
      </div>
    </>
  );
}

/**
 * Inline attachment preview for the input field.
 */
export interface AttachmentPreviewProps {
  /** The attachment to preview. */
  attachment: SelectedAttachment;
  /** Called when the remove button is pressed. */
  onRemove: () => void;
  /** Custom class name. */
  className?: string;
}

export function AttachmentPreview({
  attachment,
  onRemove,
  className = '',
}: AttachmentPreviewProps) {
  const { colors } = useRiviumChatTheme();

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const isImage = attachment.file.type.startsWith('image/');

  return (
    <div
      className={className}
      style={{
        display: 'flex',
        alignItems: 'center',
        padding: 8,
        borderRadius: 8,
        backgroundColor: 'rgba(0, 0, 0, 0.05)',
        margin: '8px 0',
      }}
    >
      {isImage && attachment.previewUrl ? (
        <img
          src={attachment.previewUrl}
          alt=""
          style={{
            width: 40,
            height: 40,
            borderRadius: 4,
            objectFit: 'cover' as const,
          }}
        />
      ) : (
        <div style={{
          width: 40,
          height: 40,
          borderRadius: 4,
          backgroundColor: `${colors.linkText}20`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}>
          📄
        </div>
      )}

      <div style={{ flex: 1, marginLeft: 10, minWidth: 0 }}>
        <div style={{
          fontSize: 13,
          fontWeight: 500,
          color: colors.otherMessageText,
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap' as const,
        }}>
          {attachment.file.name}
        </div>
        <div style={{
          fontSize: 11,
          marginTop: 2,
          color: colors.timestampText,
        }}>
          {formatFileSize(attachment.file.size)}
        </div>
      </div>

      <button
        type="button"
        onClick={onRemove}
        style={{
          padding: 8,
          background: 'none',
          border: 'none',
          cursor: 'pointer',
          fontSize: 16,
          color: colors.timestampText,
        }}
      >
        ✕
      </button>
    </div>
  );
}

export default ChatAttachmentPicker;
