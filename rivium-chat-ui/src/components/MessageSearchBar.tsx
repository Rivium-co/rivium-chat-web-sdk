import React, { useState, useRef, useEffect } from 'react';
import { useRiviumChatTheme } from '../theme/RiviumChatTheme';

export interface SearchResult {
  /** Unique identifier for the message. */
  messageId: string;
  /** Message content. */
  content: string;
  /** Sender display name. */
  senderName?: string;
  /** Message timestamp. */
  timestamp: Date;
}

export interface MessageSearchBarProps {
  /** Called when the search query changes. */
  onSearch: (query: string) => void;
  /** Called when a search result is selected. */
  onResultSelected?: (result: SearchResult) => void;
  /** Called when the search bar is closed. */
  onClose?: () => void;
  /** Search results to display. */
  results?: SearchResult[];
  /** Current result index (for navigation). */
  currentIndex?: number;
  /** Total number of results. */
  totalResults?: number;
  /** Whether search is in progress. */
  isLoading?: boolean;
  /** Placeholder text. */
  placeholder?: string;
  /** Called when navigating to previous result. */
  onPrevious?: () => void;
  /** Called when navigating to next result. */
  onNext?: () => void;
  /** Custom class name. */
  className?: string;
}

/**
 * A search bar for searching through chat messages.
 */
export function MessageSearchBar({
  onSearch,
  onResultSelected,
  onClose,
  results = [],
  currentIndex = 0,
  totalResults = 0,
  isLoading = false,
  placeholder = 'Search messages...',
  onPrevious,
  onNext,
  className = '',
}: MessageSearchBarProps) {
  const { colors } = useRiviumChatTheme();
  const [query, setQuery] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setQuery(value);
    onSearch(value);
  };

  const handleClear = () => {
    setQuery('');
    onSearch('');
    inputRef.current?.focus();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      if (e.shiftKey) {
        onPrevious?.();
      } else {
        onNext?.();
      }
    } else if (e.key === 'Escape') {
      onClose?.();
    }
  };

  const containerStyle: React.CSSProperties = {
    padding: '8px 12px',
    backgroundColor: colors.otherMessageBubble,
    boxShadow: '0 2px 4px rgba(0, 0, 0, 0.1)',
    animation: 'slideDown 0.2s ease-out',
  };

  const inputRowStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
  };

  const closeButtonStyle: React.CSSProperties = {
    padding: 8,
    background: 'none',
    border: 'none',
    cursor: 'pointer',
    fontSize: 16,
    fontWeight: 600,
    color: colors.otherMessageText,
  };

  const inputContainerStyle: React.CSSProperties = {
    flex: 1,
    display: 'flex',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.05)',
    borderRadius: 8,
    padding: '0 10px',
    height: 36,
  };

  const inputStyle: React.CSSProperties = {
    flex: 1,
    border: 'none',
    background: 'none',
    outline: 'none',
    fontSize: 14,
    color: colors.otherMessageText,
  };

  const clearButtonStyle: React.CSSProperties = {
    padding: 4,
    background: 'none',
    border: 'none',
    cursor: 'pointer',
    fontSize: 12,
    color: colors.timestampText,
  };

  const resultsRowStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 8,
    padding: '0 8px',
  };

  const navButtonStyle = (disabled: boolean): React.CSSProperties => ({
    padding: '4px 12px',
    background: 'none',
    border: 'none',
    cursor: disabled ? 'default' : 'pointer',
    fontSize: 14,
    fontWeight: 600,
    color: disabled ? colors.timestampText : colors.linkText,
    opacity: disabled ? 0.5 : 1,
  });

  return (
    <div className={className} style={containerStyle}>
      <style>
        {`
          @keyframes slideDown {
            from { transform: translateY(-100%); opacity: 0; }
            to { transform: translateY(0); opacity: 1; }
          }
        `}
      </style>

      <div style={inputRowStyle}>
        <button type="button" style={closeButtonStyle} onClick={onClose}>
          ✕
        </button>

        <div style={inputContainerStyle}>
          <span style={{ fontSize: 14, marginRight: 8 }}>🔍</span>
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={handleChange}
            onKeyDown={handleKeyDown}
            placeholder={placeholder}
            style={inputStyle}
          />
          {query.length > 0 && (
            <button type="button" style={clearButtonStyle} onClick={handleClear}>
              ✕
            </button>
          )}
        </div>
      </div>

      {query.length > 0 && (
        <div style={resultsRowStyle}>
          {isLoading ? (
            <span style={{ fontSize: 12, color: colors.timestampText }}>
              Searching...
            </span>
          ) : totalResults > 0 ? (
            <>
              <span style={{ fontSize: 12, color: colors.timestampText }}>
                {currentIndex + 1} of {totalResults}
              </span>

              <div style={{ display: 'flex' }}>
                <button
                  type="button"
                  style={navButtonStyle(currentIndex === 0)}
                  onClick={onPrevious}
                  disabled={currentIndex === 0}
                >
                  ▲
                </button>
                <button
                  type="button"
                  style={navButtonStyle(currentIndex >= totalResults - 1)}
                  onClick={onNext}
                  disabled={currentIndex >= totalResults - 1}
                >
                  ▼
                </button>
              </div>
            </>
          ) : (
            <span style={{ fontSize: 12, color: colors.timestampText, flex: 1, textAlign: 'center' }}>
              No results found
            </span>
          )}
        </div>
      )}
    </div>
  );
}

/**
 * Highlighted text component for search results.
 */
export interface HighlightedTextProps {
  /** The full text content. */
  text: string;
  /** The search query to highlight. */
  query: string;
  /** Custom class name. */
  className?: string;
  /** Custom style. */
  style?: React.CSSProperties;
  /** Custom highlight style. */
  highlightStyle?: React.CSSProperties;
}

export function HighlightedText({
  text,
  query,
  className = '',
  style,
  highlightStyle,
}: HighlightedTextProps) {
  const { colors } = useRiviumChatTheme();

  if (!query.trim()) {
    return <span className={className} style={style}>{text}</span>;
  }

  const parts = text.split(new RegExp(`(${query})`, 'gi'));

  const defaultHighlightStyle: React.CSSProperties = {
    backgroundColor: `${colors.linkText}30`,
    fontWeight: 600,
  };

  return (
    <span className={className} style={style}>
      {parts.map((part, index) =>
        part.toLowerCase() === query.toLowerCase() ? (
          <span
            key={index}
            style={{ ...defaultHighlightStyle, ...highlightStyle }}
          >
            {part}
          </span>
        ) : (
          part
        )
      )}
    </span>
  );
}

export default MessageSearchBar;
