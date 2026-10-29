import React from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { MessageSearchBar, HighlightedText } from '../src/components/MessageSearchBar';
import { MessageContextMenu } from '../src/components/MessageContextMenu';
import { message } from './fakeClient';

afterEach(() => cleanup());

describe('MessageSearchBar results', () => {
  const results = [
    { messageId: 'm1', content: 'Order #1001 shipped', senderName: 'Jordan', timestamp: new Date(2026, 0, 1, 9, 5) },
    { messageId: 'm2', content: 'Order #1001 delivered', timestamp: new Date(2026, 0, 2, 10, 0) },
  ];

  it('lists the results and calls onResultSelected on click', () => {
    const onResultSelected = vi.fn();
    render(<MessageSearchBar onSearch={() => {}} results={results} onResultSelected={onResultSelected} />);
    fireEvent.change(screen.getByPlaceholderText('Search messages...'), { target: { value: 'Order' } });

    expect(screen.getByText('1 of 2')).toBeTruthy();
    expect(screen.getByText('Jordan')).toBeTruthy();
    fireEvent.click(screen.getByText(/delivered/).closest('button')!);
    expect(onResultSelected).toHaveBeenCalledWith(results[1]);
  });

  it('a query with regex characters does not crash the highlight', () => {
    render(<HighlightedText text="Order #1001 (paid)" query="(paid" />);
    expect(screen.getByText('(paid')).toBeTruthy();
  });
});

describe('MessageContextMenu uses the message', () => {
  it('a message not yet sent (or failed) offers only Copy', () => {
    render(
      <MessageContextMenu message={message('m1', { senderUserId: 'user-42', isFailed: true })} isMe onAction={() => {}} />,
    );
    expect(screen.getByText('Copy')).toBeTruthy();
    for (const label of ['Reply', 'Edit', 'Delete', 'Pin', 'React']) {
      expect(screen.queryByText(label)).toBeNull();
    }
  });

  it('a message without text has no Copy', () => {
    render(<MessageContextMenu message={message('m1', { content: '' })} isMe={false} onAction={() => {}} />);
    expect(screen.queryByText('Copy')).toBeNull();
    expect(screen.getByText('Reply')).toBeTruthy();
  });

  it('availableActions still decides when given', () => {
    render(
      <MessageContextMenu message={message('m1', { isPending: true })} isMe availableActions={['delete']} onAction={() => {}} />,
    );
    expect(screen.getByText('Delete')).toBeTruthy();
  });
});
