import React, { useState, useEffect } from 'react';
import { useRiviumChatTheme } from '../theme/RiviumChatTheme';

export interface LinkMetadata {
  /** The original URL. */
  url: string;
  /** Page title. */
  title?: string;
  /** Page description. */
  description?: string;
  /** Preview image URL. */
  imageUrl?: string;
  /** Site name or domain. */
  siteName?: string;
  /** Favicon URL. */
  faviconUrl?: string;
}

export interface LinkPreviewProps {
  /** The URL to preview. */
  url: string;
  /** Pre-loaded metadata (if available). */
  metadata?: LinkMetadata;
  /** Called to fetch metadata for a URL. */
  onFetchMetadata?: (url: string) => Promise<LinkMetadata>;
  /** Whether this is in a message from the current user. */
  isMe?: boolean;
  /** Whether to show the preview in compact mode. */
  compact?: boolean;
  /** Called when the preview is clicked. */
  onClick?: () => void;
  /** Custom class name. */
  className?: string;
}

/**
 * A rich link preview component for URLs in messages.
 */
export function LinkPreview({
  url,
  metadata: initialMetadata,
  onFetchMetadata,
  isMe = false,
  compact = false,
  onClick,
  className = '',
}: LinkPreviewProps) {
  const { colors } = useRiviumChatTheme();
  const [metadata, setMetadata] = useState<LinkMetadata | undefined>(initialMetadata);
  const [isLoading, setIsLoading] = useState(!initialMetadata);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (!initialMetadata && onFetchMetadata) {
      setIsLoading(true);
      onFetchMetadata(url)
        .then((data) => {
          setMetadata(data);
          setIsLoading(false);
        })
        .catch(() => {
          setError(true);
          setIsLoading(false);
        });
    }
  }, [url, initialMetadata, onFetchMetadata]);

  const handleClick = () => {
    if (onClick) {
      onClick();
    } else {
      window.open(url, '_blank', 'noopener,noreferrer');
    }
  };

  const getDomain = (urlString: string) => {
    try {
      const urlObj = new URL(urlString);
      return urlObj.hostname.replace('www.', '');
    } catch {
      return urlString;
    }
  };

  if (isLoading) {
    return (
      <div
        className={className}
        style={{
          padding: 16,
          borderRadius: 12,
          border: '1px solid rgba(0, 0, 0, 0.1)',
          backgroundColor: isMe ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.05)',
          marginTop: 8,
          textAlign: 'center',
        }}
      >
        <span style={{ fontSize: 14, color: colors.timestampText }}>Loading...</span>
      </div>
    );
  }

  if (error || !metadata) {
    return (
      <a
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        className={className}
        style={{
          color: colors.linkText,
          textDecoration: 'underline',
          wordBreak: 'break-all' as const,
        }}
      >
        {url}
      </a>
    );
  }

  if (compact) {
    return (
      <div
        className={className}
        onClick={handleClick}
        style={{
          borderLeft: `3px solid ${colors.linkText}`,
          paddingLeft: 8,
          paddingTop: 4,
          paddingBottom: 4,
          marginTop: 8,
          cursor: 'pointer',
          backgroundColor: isMe ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.05)',
        }}
      >
        <div style={{
          fontSize: 13,
          fontWeight: 500,
          color: isMe ? '#fff' : colors.otherMessageText,
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap' as const,
        }}>
          {metadata.title || getDomain(url)}
        </div>
        <div style={{
          fontSize: 11,
          marginTop: 2,
          color: isMe ? 'rgba(255, 255, 255, 0.7)' : colors.timestampText,
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap' as const,
        }}>
          {getDomain(url)}
        </div>
      </div>
    );
  }

  return (
    <div
      className={className}
      onClick={handleClick}
      style={{
        borderRadius: 12,
        border: `1px solid ${isMe ? 'rgba(255, 255, 255, 0.2)' : 'rgba(0, 0, 0, 0.1)'}`,
        overflow: 'hidden',
        marginTop: 8,
        maxWidth: 280,
        cursor: 'pointer',
        backgroundColor: isMe ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.05)',
      }}
    >
      {metadata.imageUrl && (
        <img
          src={metadata.imageUrl}
          alt=""
          style={{
            width: '100%',
            height: 140,
            objectFit: 'cover' as const,
          }}
        />
      )}

      <div style={{ padding: 12 }}>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          marginBottom: 4,
        }}>
          {metadata.faviconUrl && (
            <img
              src={metadata.faviconUrl}
              alt=""
              style={{
                width: 14,
                height: 14,
                borderRadius: 2,
                marginRight: 6,
              }}
            />
          )}
          <span style={{
            fontSize: 11,
            textTransform: 'uppercase' as const,
            letterSpacing: 0.5,
            color: isMe ? 'rgba(255, 255, 255, 0.6)' : colors.timestampText,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap' as const,
          }}>
            {metadata.siteName || getDomain(url)}
          </span>
        </div>

        {metadata.title && (
          <div style={{
            fontSize: 14,
            fontWeight: 600,
            lineHeight: 1.3,
            marginBottom: 4,
            color: isMe ? '#fff' : colors.otherMessageText,
            display: '-webkit-box',
            WebkitLineClamp: 2,
            WebkitBoxOrient: 'vertical' as const,
            overflow: 'hidden',
          }}>
            {metadata.title}
          </div>
        )}

        {metadata.description && (
          <div style={{
            fontSize: 12,
            lineHeight: 1.4,
            color: isMe ? 'rgba(255, 255, 255, 0.8)' : colors.timestampText,
            display: '-webkit-box',
            WebkitLineClamp: 3,
            WebkitBoxOrient: 'vertical' as const,
            overflow: 'hidden',
          }}>
            {metadata.description}
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * Extracts URLs from text content.
 */
export function extractUrls(text: string): string[] {
  const urlRegex = /(https?:\/\/[^\s]+)/g;
  return text.match(urlRegex) || [];
}

/**
 * Checks if a string is a valid URL.
 */
export function isValidUrl(string: string): boolean {
  try {
    new URL(string);
    return true;
  } catch {
    return false;
  }
}

export default LinkPreview;
