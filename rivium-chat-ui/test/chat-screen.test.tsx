import React from 'react';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ChatScreen } from '../src/components/ChatScreen';
import { ChatMessageBubble } from '../src/components/ChatMessageBubble';
import { RiviumChatProvider } from '../src/state/RiviumChatProvider';
import { RiviumChatThemeProvider, defaultDarkColors } from '../src/theme/RiviumChatTheme';
import { fakeClient, history, message } from './fakeClient';

/** jsdom has no layout: give every element a fixed scroll box we can move. */
const scrollTops = new WeakMap<Element, number>();
beforeEach(() => {
  Object.defineProperty(HTMLElement.prototype, 'scrollHeight', { configurable: true, get: () => 2000 });
  Object.defineProperty(HTMLElement.prototype, 'clientHeight', { configurable: true, get: () => 500 });
  Object.defineProperty(HTMLElement.prototype, 'scrollTop', {
    configurable: true,
    get() { return scrollTops.get(this) ?? 0; },
    set(v: number) { scrollTops.set(this, v); },
  });
  Element.prototype.scrollIntoView = vi.fn();
});
afterEach(() => cleanup());

function renderScreen(client: ReturnType<typeof fakeClient>, wrap?: (ui: React.ReactElement) => React.ReactElement) {
  const ui = (
    <RiviumChatProvider client={client as any}>
      <ChatScreen roomId="room-1" currentUserId="user-42" />
    </RiviumChatProvider>
  );
  return render(wrap ? wrap(ui) : ui);
}

describe('ChatScreen inside RiviumChatProvider (autoConnect)', () => {
  it('loads the messages and follows the room once the connection is up', async () => {
    const client = fakeClient();
    renderScreen(client);

    expect(await screen.findByText(/Order #1001 update m3/)).toBeTruthy();
    expect(screen.queryByText('Failed to load messages')).toBeNull();
    await waitFor(() => expect(client.subscribeToRoom).toHaveBeenLastCalledWith('room-1'));
    // the call that counted came after connect() finished
    const ok = client.subscribeToRoom.mock.results.filter((r) => r.type === 'return');
    expect(ok.length).toBeGreaterThan(0);
  });

  it('follows the room again after a reconnect, and reloads what was missed', async () => {
    const client = fakeClient();
    renderScreen(client);
    await screen.findByText(/Order #1001 update m3/);
    await waitFor(() => expect(client.subscribeToRoom.mock.results.some((r) => r.type === 'return')).toBe(true));
    const before = client.subscribeToRoom.mock.results.filter((r) => r.type === 'return').length;

    client.store = [...client.store, message('m4')];
    act(() => client.disconnect());
    await act(async () => {
      await client.connect();
    });

    await waitFor(() =>
      expect(client.subscribeToRoom.mock.results.filter((r) => r.type === 'return').length).toBeGreaterThan(before),
    );
    expect(await screen.findByText(/Order #1001 update m4/)).toBeTruthy();
  });

  it('recoveryFailed for the room reloads its history', async () => {
    const client = fakeClient();
    renderScreen(client);
    await screen.findByText(/Order #1001 update m3/);

    client.store = [...client.store, message('m4')];
    act(() => client.emit('recoveryFailed', { roomId: 'other-room' }));
    act(() => client.emit('recoveryFailed', { roomId: 'room-1' }));

    expect(await screen.findByText(/Order #1001 update m4/)).toBeTruthy();
    expect(client.getMessages).toHaveBeenCalledTimes(2);
  });
});

describe('ChatScreen scrolling', () => {
  it('does not page back through history before the first scroll to the bottom', async () => {
    const client = fakeClient(history(120));
    // A smooth scrollIntoView starts from the top: the browser fires scroll
    // events while scrollTop is still 0.
    Element.prototype.scrollIntoView = vi.fn(function (this: Element) {
      const list = document.querySelector('.overflow-y-auto');
      if (list) fireEvent.scroll(list);
    });
    const { container } = renderScreen(client);
    await screen.findByText(/Order #1001 update m120/);
    const list = container.querySelector('.overflow-y-auto')!;
    fireEvent.scroll(list);
    await new Promise((r) => setTimeout(r, 20));

    expect(client.getMessages).toHaveBeenCalledTimes(1);
    expect(list.scrollTop).toBe(2000);
  });

  it('loads older messages when the user scrolls up to the top', async () => {
    const client = fakeClient(history(120));
    const { container } = renderScreen(client);
    await screen.findByText(/Order #1001 update m120/);
    const list = container.querySelector('.overflow-y-auto')!;

    list.scrollTop = 0;
    fireEvent.scroll(list);

    await waitFor(() => expect(client.getMessages).toHaveBeenCalledTimes(2));
    expect(client.getMessages.mock.calls[1][1]).toMatchObject({ before: 'm71' });
    expect(await screen.findByText(/Order #1001 update m21$/)).toBeTruthy();
  });
});

describe('Pin', () => {
  it('the Pin action pins the message through the client and shows it pinned', async () => {
    const client = fakeClient();
    renderScreen(client);
    const text = await screen.findByText(/Order #1001 update m3/);

    fireEvent.contextMenu(text);
    fireEvent.click(await screen.findByText('Pin'));

    await waitFor(() => expect(client.pinMessage).toHaveBeenCalledWith('m3'));
    expect(await screen.findByLabelText('Pinned')).toBeTruthy();

    fireEvent.contextMenu(screen.getByText(/Order #1001 update m3/));
    fireEvent.click(await screen.findByText('Unpin'));
    await waitFor(() => expect(client.unpinMessage).toHaveBeenCalledWith('m3'));
    await waitFor(() => expect(screen.queryByLabelText('Pinned')).toBeNull());
  });

  it('a pin made elsewhere (realtime event) shows up', async () => {
    const client = fakeClient();
    renderScreen(client);
    await screen.findByText(/Order #1001 update m2/);

    act(() => client.emit('messagePinChanged', { messageId: 'm2', roomId: 'room-1', userId: 'user-7', pinned: true }));
    expect(await screen.findByLabelText('Pinned')).toBeTruthy();
  });
});

describe('Failed message', () => {
  it('shows a Retry button that calls onRetry', () => {
    const onRetry = vi.fn();
    render(
      <ChatMessageBubble
        message={message('m1', { senderUserId: 'user-42', isFailed: true })}
        isMe
        onRetry={onRetry}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Retry' }));
    expect(onRetry).toHaveBeenCalledTimes(1);
  });
});

describe('Dark mode', () => {
  it('ChatScreen and the input bar use the theme background, not white', async () => {
    const client = fakeClient();
    const { container } = renderScreen(client, (ui) => <RiviumChatThemeProvider dark>{ui}</RiviumChatThemeProvider>);
    await screen.findByText(/Order #1001 update m3/);

    const root = container.firstElementChild as HTMLElement;
    expect(root.className).not.toMatch(/\bbg-white\b/);
    expect(root.style.backgroundColor).toBe('rgb(0, 0, 0)');
    expect(defaultDarkColors.background).toBe('#000000');

    const bar = container.querySelector('textarea')!.parentElement!.parentElement as HTMLElement;
    expect(bar.className).not.toMatch(/\bbg-white\b/);
    expect(bar.style.backgroundColor).toBe('rgb(0, 0, 0)');
  });
});

describe('Display names', () => {
  it('typing and "Replying to" use the participant display name, falling back to the id', async () => {
    const client = fakeClient();
    client.getRoom.mockResolvedValue({
      id: 'room-1',
      participants: [
        { id: 'p1', externalUserId: 'user-7', displayName: 'Jordan', locale: null, role: 'member', lastReadAt: null, joinedAt: '' },
        { id: 'p2', externalUserId: 'user-42', displayName: null, locale: null, role: 'member', lastReadAt: null, joinedAt: '' },
      ],
    } as any);
    renderScreen(client);
    const text = await screen.findByText(/Order #1001 update m3/);
    await waitFor(() => expect(client.getRoom).toHaveBeenCalled());

    act(() => client.emit('typing', { roomId: 'room-1', userId: 'user-7', isTyping: true }));
    expect(await screen.findByText(/Jordan is typing/)).toBeTruthy();
    expect(screen.queryByText(/user-7 is typing/)).toBeNull();

    fireEvent.contextMenu(text);
    fireEvent.click(await screen.findByText('Reply'));
    expect(await screen.findByText('Replying to Jordan')).toBeTruthy();

    act(() => client.emit('typing', { roomId: 'room-1', userId: 'user-9', isTyping: true }));
    expect(await screen.findByText(/user-9/)).toBeTruthy();
  });
});
