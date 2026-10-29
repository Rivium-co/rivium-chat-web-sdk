import React from 'react';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ChatScreen } from '../src/components/ChatScreen';
import { RiviumChatProvider, type Message } from '../src/state/RiviumChatProvider';
import { fakeClient, history, message } from './fakeClient';

beforeEach(() => {
  Object.defineProperty(HTMLElement.prototype, 'scrollHeight', { configurable: true, get: () => 2000 });
  Object.defineProperty(HTMLElement.prototype, 'clientHeight', { configurable: true, get: () => 500 });
  Element.prototype.scrollIntoView = vi.fn();
});
afterEach(() => cleanup());

const CMID = '0b6d1c1e-8a3f-4f7e-9c1d-2a5b6c7d8e9f';

/** What the core client returns for a send it queued offline. */
function queued(content: string, clientMessageId = CMID): Message {
  return message('q1', {
    id: `local_${clientMessageId}`,
    senderUserId: 'user-42',
    content,
    clientMessageId,
    isPending: true,
    createdAt: new Date(2026, 0, 1, 13, 0, 0).toISOString(),
  });
}

/** The stored message the server answers / publishes. */
function stored(content: string, clientMessageId = CMID): Message {
  return message('m99', {
    senderUserId: 'user-42',
    content,
    clientMessageId,
    createdAt: new Date(2026, 0, 1, 13, 0, 0).toISOString(),
  });
}

async function renderAndSend(client: ReturnType<typeof fakeClient>, text: string) {
  render(
    <RiviumChatProvider client={client as any}>
      <ChatScreen roomId="room-1" currentUserId="user-42" />
    </RiviumChatProvider>,
  );
  await screen.findByText(/Order #1001 update m3/);
  const input = screen.getByPlaceholderText('Type a message...');
  fireEvent.change(input, { target: { value: text } });
  fireEvent.keyDown(input, { key: 'Enter' });
}

function count(text: string) {
  return screen.queryAllByText((_, el) => el?.tagName === 'P' && (el.textContent ?? '').includes(text)).length;
}

describe('UI kit with queueOfflineMessages on', () => {
  it('a queued message shows "Waiting for network…" (not failed) and is replaced on messageSent', async () => {
    const client = fakeClient(history(3), { queueOfflineMessages: true });
    client.sendMessage.mockImplementation(async () => queued('Order #1001 is ready'));
    await renderAndSend(client, 'Order #1001 is ready');

    expect(await screen.findByText('Waiting for network…')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Retry' })).toBeNull();

    act(() =>
      client.emit('messageSent', { localId: `local_${CMID}`, clientMessageId: CMID, message: stored('Order #1001 is ready') }),
    );
    await waitFor(() => expect(screen.queryByText('Waiting for network…')).toBeNull());
    expect(count('Order #1001 is ready')).toBe(1);

    // then the live event for the same message: still shown once
    act(() => client.emit('message', { message: stored('Order #1001 is ready') }));
    expect(count('Order #1001 is ready')).toBe(1);
  });

  it('the live message event arriving before messageSent: shown once', async () => {
    const client = fakeClient(history(3), { queueOfflineMessages: true });
    client.sendMessage.mockImplementation(async () => queued('Order #1001 is ready'));
    await renderAndSend(client, 'Order #1001 is ready');
    await screen.findByText('Waiting for network…');

    act(() => client.emit('message', { message: stored('Order #1001 is ready') }));
    await waitFor(() => expect(screen.queryByText('Waiting for network…')).toBeNull());
    act(() =>
      client.emit('messageSent', { localId: `local_${CMID}`, clientMessageId: CMID, message: stored('Order #1001 is ready') }),
    );
    expect(count('Order #1001 is ready')).toBe(1);
  });

  it('online: the live event comes before sendMessage resolves: shown once', async () => {
    const client = fakeClient(history(3), { queueOfflineMessages: true });
    let resolve!: (m: Message) => void;
    client.sendMessage.mockImplementation(() => new Promise<Message>((r) => (resolve = r)));
    await renderAndSend(client, 'Order #1001 is ready');

    act(() => client.emit('message', { message: stored('Order #1001 is ready') }));
    await act(async () => resolve(stored('Order #1001 is ready')));
    expect(count('Order #1001 is ready')).toBe(1);
  });

  it('two queued messages with the same text are matched by clientMessageId', async () => {
    const client = fakeClient(history(3), { queueOfflineMessages: true });
    const ids = ['11111111-1111-4111-8111-111111111111', '22222222-2222-4222-8222-222222222222'];
    let n = 0;
    client.sendMessage.mockImplementation(async () => queued('ok', ids[n++]));
    await renderAndSend(client, 'ok');
    const input = screen.getByPlaceholderText('Type a message...');
    fireEvent.change(input, { target: { value: 'ok' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    await waitFor(() => expect(screen.getAllByText('Waiting for network…')).toHaveLength(2));

    act(() => client.emit('message', { message: message('m50', { senderUserId: 'user-42', content: 'ok', clientMessageId: ids[0] }) }));
    await waitFor(() => expect(screen.getAllByText('Waiting for network…')).toHaveLength(1));
    expect(count('ok')).toBe(2);
  });

  it('messageFailed shows Retry; Retry sends it again', async () => {
    const client = fakeClient(history(3), { queueOfflineMessages: true });
    client.sendMessage.mockImplementationOnce(async () => queued('Order #1001 is ready'));
    await renderAndSend(client, 'Order #1001 is ready');
    await screen.findByText('Waiting for network…');

    act(() =>
      client.emit('messageFailed', {
        localId: `local_${CMID}`,
        clientMessageId: CMID,
        roomId: 'room-1',
        error: new Error('HTTP error 403'),
        reason: 'rejected',
      }),
    );
    const retry = await screen.findByRole('button', { name: 'Retry' });
    expect(screen.queryByText('Waiting for network…')).toBeNull();

    client.sendMessage.mockImplementationOnce(async () => stored('Order #1001 is ready', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'));
    fireEvent.click(retry);
    await waitFor(() => expect(screen.queryByRole('button', { name: 'Retry' })).toBeNull());
    expect(count('Order #1001 is ready')).toBe(1);
  });

  it('shows messages still waiting in the outbox when the screen opens; a reload with the stored copy drops it', async () => {
    const client = fakeClient(history(3), { queueOfflineMessages: true });
    (client as any).pending = [queued('Order #1001 is ready')];
    render(
      <RiviumChatProvider client={client as any}>
        <ChatScreen roomId="room-1" currentUserId="user-42" />
      </RiviumChatProvider>,
    );
    expect(await screen.findByText('Waiting for network…')).toBeTruthy();

    // reconnect: the history now holds the stored message
    client.store = [...client.store, stored('Order #1001 is ready')];
    act(() => client.emit('recoveryFailed', { roomId: 'room-1' }));
    await waitFor(() => expect(screen.queryByText('Waiting for network…')).toBeNull());
    expect(count('Order #1001 is ready')).toBe(1);
  });
});

describe('UI kit with queueOfflineMessages off: unchanged', () => {
  it('a send that rejects shows Retry, never "Waiting for network…"', async () => {
    const client = fakeClient();
    client.sendMessage.mockImplementation(async () => {
      throw new TypeError('Failed to fetch');
    });
    await renderAndSend(client, 'Order #1001 is ready');
    expect(await screen.findByRole('button', { name: 'Retry' })).toBeTruthy();
    expect(screen.queryByText('Waiting for network…')).toBeNull();
  });
});
