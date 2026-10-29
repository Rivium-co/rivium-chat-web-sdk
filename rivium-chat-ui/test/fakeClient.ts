import { vi } from 'vitest';
import type { Message } from '../src/state/RiviumChatProvider';

type Listener = (event: any) => void;

export function message(id: string, overrides: Partial<Message> = {}): Message {
  return {
    id,
    roomId: 'room-1',
    senderUserId: 'user-7',
    content: `Order #1001 update ${id}`,
    type: 'text',
    attachments: [],
    metadata: null,
    replyToId: null,
    replyTo: null,
    isDeleted: false,
    createdAt: new Date(2026, 0, 1, 12, 0, Number(id.replace(/\D/g, '')) || 0).toISOString(),
    isEdited: false,
    editedAt: null,
    editHistory: null,
    isPinned: false,
    pinnedAt: null,
    pinnedBy: null,
    reactions: [],
    ...overrides,
  };
}

/** Pages of history, newest page first; each page is oldest → newest like the API. */
export function history(total: number): Message[] {
  return Array.from({ length: total }, (_, i) => message(`m${i + 1}`));
}

/**
 * Behaves like the core client: subscribeToRoom() throws until connect()
 * has created the realtime client.
 */
export function fakeClient(all: Message[] = history(3), opts: { queueOfflineMessages?: boolean } = {}) {
  const listeners = new Map<string, Set<Listener>>();
  const add = (name: string) => (cb: Listener) => {
    if (!listeners.has(name)) listeners.set(name, new Set());
    listeners.get(name)!.add(cb);
    return () => listeners.get(name)!.delete(cb);
  };
  let connected = false;
  const client = {
    store: all,
    emit(name: string, event: any) {
      (listeners.get(name) ?? new Set()).forEach((cb) => cb(event));
    },
    connect: vi.fn(async () => {
      await new Promise((r) => setTimeout(r, 5));
      connected = true;
      client.emit('connectionState', { state: 'connecting' });
      client.emit('connectionState', { state: 'connected' });
    }),
    disconnect: vi.fn(() => {
      connected = false;
      client.emit('connectionState', { state: 'disconnected' });
    }),
    subscribeToRoom: vi.fn((_roomId: string) => {
      if (!connected) throw new Error('Not connected. Call connect() first.');
    }),
    unsubscribeFromRoom: vi.fn(),
    leaveRoom: vi.fn(),
    getMessages: vi.fn(async (_roomId: string, options?: { limit?: number; before?: string }) => {
      const limit = options?.limit ?? 50;
      const end = options?.before ? client.store.findIndex((m) => m.id === options.before) : client.store.length;
      return { messages: client.store.slice(Math.max(0, end - limit), end) };
    }),
    sendMessage: vi.fn(async () => message('sent')),
    deleteMessage: vi.fn(async () => {}),
    editMessage: vi.fn(async () => message('edited')),
    addReaction: vi.fn(async () => ({ id: 'r', messageId: 'm', userId: 'user-42', emoji: '👍', createdAt: '' })),
    removeReaction: vi.fn(async () => {}),
    pinMessage: vi.fn(async (id: string) => message(id, { isPinned: true })),
    unpinMessage: vi.fn(async () => {}),
    publishTyping: vi.fn(async () => {}),
    markAsRead: vi.fn(async () => {}),
    getRoom: vi.fn(async () => ({ id: 'room-1', participants: [] }) as any),
    getRoomPresence: vi.fn(async () => new Set<string>()),
    onMessage: add('message'),
    onMessageDeleted: add('messageDeleted'),
    onMessageEdited: add('messageEdited'),
    onReaction: add('reaction'),
    onTyping: add('typing'),
    onPresenceChange: add('presence'),
    onReadReceipt: add('readReceipt'),
    onSubscriptionState: add('subscriptionState'),
    onRecoveryFailed: add('recoveryFailed'),
    onConnectionStateChange: add('connectionState'),
    onMessagePinChanged: add('messagePinChanged'),
  };
  if (opts.queueOfflineMessages) {
    // What the core client adds with queueOfflineMessages: true
    Object.assign(client, {
      queueOfflineMessages: true,
      pending: [] as Message[],
      getPendingMessages: vi.fn(async (roomId?: string) =>
        (client as any).pending.filter((m: Message) => !roomId || m.roomId === roomId),
      ),
      onMessageSent: add('messageSent'),
      onMessageFailed: add('messageFailed'),
    });
  }
  return client;
}
