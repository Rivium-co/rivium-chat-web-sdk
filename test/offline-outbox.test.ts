import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

/** A stand-in for the realtime transport: the test fires 'connected' / 'disconnected'. */
const fake = vi.hoisted(() => {
  type Handler = (ctx?: any) => void;
  const state = { clients: [] as any[] };
  class FakeRealtimeClient {
    handlers = new Map<string, Handler[]>();
    constructor(public url: string, public options: any) {
      state.clients.push(this);
    }
    on(event: string, handler: Handler) {
      this.handlers.set(event, [...(this.handlers.get(event) ?? []), handler]);
      return this;
    }
    fire(event: string, ctx?: any) {
      (this.handlers.get(event) ?? []).forEach((h) => h(ctx));
    }
    connect = vi.fn();
    disconnect = vi.fn();
    newSubscription() {
      throw new Error('not used');
    }
  }
  return { state, FakeRealtimeClient };
});
vi.mock('centrifuge', () => ({ Centrifuge: fake.FakeRealtimeClient }));

import { RiviumChatClient } from '../src/RiviumChatClient';
import { RiviumChatError } from '../src/services/ApiService';
import type { MessageFailedEvent, MessageSentEvent } from '../src/events/events';
import type { OutboxStore, PendingMessage } from '../src/services/Outbox';

/**
 * A Chat API that stores each (room, sender, clientMessageId) once, like the
 * real one, and can be switched offline (fetch rejects, as browsers do).
 */
function fakeApi() {
  const api = {
    offline: false,
    /** HTTP status to answer the next sends with (instead of storing). */
    failWith: undefined as number | undefined,
    /** Store the message but lose the answer (the network drops after the server stored it). */
    loseNextAnswer: false,
    stored: [] as any[],
    posts: [] as any[],
    seq: 0,
  };
  const fetchMock = vi.fn(async (url: string, init: RequestInit) => {
    if (api.offline) throw new TypeError('Failed to fetch');
    if (url.endsWith('/centrifugo/token')) return new Response(JSON.stringify({ token: 't' }), { status: 200 });
    const match = /\/rooms\/([^/]+)\/messages$/.exec(url);
    if (match && init.method === 'POST') {
      const body = JSON.parse(String(init.body));
      api.posts.push(body);
      if (api.failWith) return new Response(JSON.stringify({ message: 'no' }), { status: api.failWith });
      const existing = body.clientMessageId
        ? api.stored.find(
            (m) => m.roomId === match[1] && m.senderUserId === body.senderUserId && m.clientMessageId === body.clientMessageId,
          )
        : undefined;
      const message = existing ?? {
        id: `msg-${++api.seq}`,
        roomId: match[1],
        senderUserId: body.senderUserId,
        content: body.content,
        type: body.type,
        ...(body.clientMessageId && { clientMessageId: body.clientMessageId }),
        isDeleted: false,
        isEdited: false,
        isPinned: false,
        createdAt: new Date().toISOString(),
      };
      if (!existing) api.stored.push(message);
      if (api.loseNextAnswer) {
        api.loseNextAnswer = false;
        throw new TypeError('Network connection was lost');
      }
      return new Response(JSON.stringify(message), { status: existing ? 200 : 201 });
    }
    return new Response('{}', { status: 200 });
  });
  vi.stubGlobal('fetch', fetchMock);
  return api;
}

function record(client: RiviumChatClient) {
  const sent: MessageSentEvent[] = [];
  const failed: MessageFailedEvent[] = [];
  client.onMessageSent((e) => sent.push(e));
  client.onMessageFailed((e) => failed.push(e));
  return { sent, failed };
}

async function connected(client: RiviumChatClient) {
  await client.connect();
  const rt = fake.state.clients[fake.state.clients.length - 1];
  rt.fire('connected');
  await vi.advanceTimersByTimeAsync(0);
  return rt;
}

const config = { apiKey: 'rv_live_demo_app', userId: 'user-42', queueOfflineMessages: true };

describe('offline outbox (queueOfflineMessages: true)', () => {
  beforeEach(() => {
    fake.state.clients = [];
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-10-29T12:00:00Z'));
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it('online: sends with a UUID v4 clientMessageId and returns the stored message', async () => {
    const api = fakeApi();
    const client = new RiviumChatClient(config);
    const message = await client.sendMessage('room-1', 'Order #1001 is ready');
    expect(api.posts[0].clientMessageId).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
    expect(message.id).toBe('msg-1');
    expect(message.clientMessageId).toBe(api.posts[0].clientMessageId);
    expect(message.isPending).toBeUndefined();
  });

  it('offline send is queued and returned as pending; sent once on reconnect', async () => {
    const api = fakeApi();
    const client = new RiviumChatClient(config);
    const rt = await connected(client);
    const { sent } = record(client);

    rt.fire('disconnected');
    api.offline = true;
    const pending = await client.sendMessage('room-1', 'Order #1001 is ready');

    expect(pending.isPending).toBe(true);
    expect(pending.id).toBe(`local_${pending.clientMessageId}`);
    expect(pending.senderUserId).toBe('user-42');
    expect(pending.createdAt).toBe('2026-10-29T12:00:00.000Z');
    expect(await client.getPendingMessages('room-1')).toHaveLength(1);

    api.offline = false;
    rt.fire('connected');
    rt.fire('connected'); // a second connect event while the first flush runs
    await client.retryPendingMessages();
    await vi.advanceTimersByTimeAsync(120_000);

    expect(api.stored).toHaveLength(1);
    expect(api.posts.filter((p) => p.clientMessageId === pending.clientMessageId).length).toBe(1);
    expect(sent).toHaveLength(1);
    expect(sent[0]).toMatchObject({ localId: pending.id, clientMessageId: pending.clientMessageId });
    expect(sent[0].message.id).toBe('msg-1');
    expect(sent[0].message.clientMessageId).toBe(pending.clientMessageId);
    expect(await client.getPendingMessages()).toHaveLength(0);
  });

  it('the same clientMessageId sent twice is stored once (answer lost, then retried)', async () => {
    const api = fakeApi();
    const client = new RiviumChatClient(config);
    const { sent } = record(client);
    api.loseNextAnswer = true;

    const pending = await client.sendMessage('room-1', 'Order #1001 is ready');
    expect(pending.isPending).toBe(true);
    expect(api.stored).toHaveLength(1);

    await vi.advanceTimersByTimeAsync(2_000); // first back-off
    expect(api.posts).toHaveLength(2);
    expect(api.posts[1].clientMessageId).toBe(api.posts[0].clientMessageId);
    expect(api.stored).toHaveLength(1);
    expect(sent).toHaveLength(1);
    expect(sent[0].message.id).toBe(api.stored[0].id);
  });

  it('keeps the order across several queued messages and rooms', async () => {
    const api = fakeApi();
    const client = new RiviumChatClient(config);
    const rt = await connected(client);
    rt.fire('disconnected');
    api.offline = true;

    await client.sendMessage('room-1', 'a1');
    await client.sendMessage('room-2', 'b1');
    await client.sendMessage('room-1', 'a2');
    await client.sendMessage('room-2', 'b2');
    await client.sendMessage('room-1', 'a3');
    expect((await client.getPendingMessages('room-1')).map((m) => m.content)).toEqual(['a1', 'a2', 'a3']);

    api.offline = false;
    // Back online, but the queue for room-1 is not sent yet: a new message waits behind it.
    const later = await client.sendMessage('room-1', 'a4');
    expect(later.isPending).toBe(true);

    rt.fire('connected');
    await vi.advanceTimersByTimeAsync(0);
    await client.retryPendingMessages();

    expect(api.stored.map((m) => m.content)).toEqual(['a1', 'b1', 'a2', 'b2', 'a3', 'a4']);
    expect(api.stored.filter((m) => m.roomId === 'room-1').map((m) => m.content)).toEqual(['a1', 'a2', 'a3', 'a4']);
  });

  it('a transient failure while flushing stops (order kept) and backs off 2 s, 4 s, 8 s ... max 60 s', async () => {
    const api = fakeApi();
    const client = new RiviumChatClient(config);
    api.offline = true;
    await client.sendMessage('room-1', 'a1');
    await client.sendMessage('room-1', 'a2');
    api.offline = false;
    api.failWith = 503;

    const times: number[] = [];
    const start = Date.now();
    const count = () => api.posts.length;
    let last = count();
    for (let t = 0; t < 200_000; t += 1_000) {
      await vi.advanceTimersByTimeAsync(1_000);
      if (count() !== last) {
        times.push(Date.now() - start);
        last = count();
      }
    }
    // a1 is retried on its own each time (a2 waits behind it)
    expect(api.posts.every((p) => p.content === 'a1')).toBe(true);
    const gaps = times.map((t, i) => t - (times[i - 1] ?? 0));
    expect(gaps.slice(0, 6)).toEqual([2_000, 4_000, 8_000, 16_000, 32_000, 60_000]);
    expect(gaps[6]).toBe(60_000);

    api.failWith = undefined;
    await client.retryPendingMessages();
    expect(api.stored.map((m) => m.content)).toEqual(['a1', 'a2']);
  });

  it('timeout, 429 and 5xx are queued', async () => {
    for (const status of [429, 500, 502, 503]) {
      const api = fakeApi();
      api.failWith = status;
      const client = new RiviumChatClient(config);
      const result = await client.sendMessage('room-1', 'x');
      expect(result.isPending).toBe(true);
      client.dispose();
    }
    vi.stubGlobal('fetch', vi.fn(() => new Promise<Response>(() => {})));
    const client = new RiviumChatClient({ ...config, requestTimeoutMs: 1_000 });
    const result = client.sendMessage('room-1', 'x');
    await vi.advanceTimersByTimeAsync(1_000);
    expect((await result).isPending).toBe(true);
  });

  it('a permanent error is not queued: it throws as before', async () => {
    for (const status of [400, 401, 403, 404, 413]) {
      const api = fakeApi();
      api.failWith = status;
      const client = new RiviumChatClient(config);
      const error = await client.sendMessage('room-1', 'x').catch((e) => e);
      expect(error).toBeInstanceOf(RiviumChatError);
      expect(error.statusCode).toBe(status);
      expect(await client.getPendingMessages()).toHaveLength(0);
    }
  });

  it('a permanent error while flushing: the message leaves the queue as failed (rejected), the next is sent', async () => {
    const api = fakeApi();
    const client = new RiviumChatClient(config);
    const { sent, failed } = record(client);
    api.offline = true;
    const first = await client.sendMessage('room-1', 'a1');
    await client.sendMessage('room-1', 'a2');
    api.offline = false;

    api.failWith = 403;
    let calls = 0;
    const realFetch = globalThis.fetch;
    vi.stubGlobal('fetch', vi.fn(async (url: string, init: RequestInit) => {
      if (calls++ === 1) api.failWith = undefined; // only a1 is refused
      return realFetch(url, init);
    }));
    await client.retryPendingMessages();

    expect(failed).toHaveLength(1);
    expect(failed[0]).toMatchObject({ localId: first.id, clientMessageId: first.clientMessageId, roomId: 'room-1', reason: 'rejected' });
    expect(failed[0].error).toBeInstanceOf(RiviumChatError);
    expect(sent.map((e) => e.message.content)).toEqual(['a2']);
  });

  it('a message older than 24 hours fails with reason expired', async () => {
    const api = fakeApi();
    const client = new RiviumChatClient(config);
    const { sent, failed } = record(client);
    api.offline = true;
    const pending = await client.sendMessage('room-1', 'Order #1001 is ready');

    await vi.advanceTimersByTimeAsync(24 * 60 * 60 * 1000 + 60_000);
    api.offline = false;
    await client.retryPendingMessages();

    expect(failed).toHaveLength(1);
    expect(failed[0]).toMatchObject({ localId: pending.id, reason: 'expired', roomId: 'room-1' });
    expect(sent).toHaveLength(0);
    expect(api.stored).toHaveLength(0);
  });

  it('cancelPendingMessage removes it and emits nothing', async () => {
    const api = fakeApi();
    const client = new RiviumChatClient(config);
    const { sent, failed } = record(client);
    api.offline = true;
    const pending = await client.sendMessage('room-1', 'Order #1001 is ready');

    expect(await client.cancelPendingMessage(pending.id)).toBe(true);
    expect(await client.cancelPendingMessage(pending.id)).toBe(false);
    api.offline = false;
    await client.retryPendingMessages();
    await vi.advanceTimersByTimeAsync(120_000);

    expect(api.stored).toHaveLength(0);
    expect(sent).toHaveLength(0);
    expect(failed).toHaveLength(0);
  });

  it('dispose() forgets the queue in memory; clearPendingMessages() also empties the store', async () => {
    const api = fakeApi();
    const saved: PendingMessage[][] = [];
    const store: OutboxStore = { load: () => [], save: (items) => void saved.push(items) };
    const client = new RiviumChatClient({ ...config, outboxStore: store });
    api.offline = true;
    await client.sendMessage('room-1', 'x');
    expect(saved[saved.length - 1]).toHaveLength(1);

    await client.clearPendingMessages();
    expect(saved[saved.length - 1]).toEqual([]);
    expect(await client.getPendingMessages()).toHaveLength(0);

    await client.sendMessage('room-1', 'y');
    client.dispose();
    expect(await client.getPendingMessages()).toHaveLength(0);
    expect(saved[saved.length - 1]).toHaveLength(1); // the store keeps it for the next session
  });
});

describe('offline outbox storage', () => {
  beforeEach(() => {
    fake.state.clients = [];
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  function memoryLocalStorage() {
    const data = new Map<string, string>();
    return {
      data,
      getItem: (k: string) => data.get(k) ?? null,
      setItem: (k: string, v: string) => void data.set(k, v),
      removeItem: (k: string) => void data.delete(k),
    };
  }

  it("'localStorage' keeps the queue across a reload, one key per API key and user", async () => {
    const api = fakeApi();
    const ls = memoryLocalStorage();
    vi.stubGlobal('localStorage', ls);
    api.offline = true;
    const first = new RiviumChatClient({ ...config, outboxStore: 'localStorage' });
    const pending = await first.sendMessage('room-1', 'Order #1001 is ready');
    first.dispose();
    expect([...ls.data.keys()]).toEqual(['rivium_chat_outbox:rv_live_demo_app:user-42']);

    // another user on the same device does not get it
    const other = new RiviumChatClient({ ...config, userId: 'user-7', outboxStore: 'localStorage' });
    expect(await other.getPendingMessages()).toHaveLength(0);
    other.dispose();

    api.offline = false;
    const second = new RiviumChatClient({ ...config, outboxStore: 'localStorage' });
    const { sent } = record(second);
    expect((await second.getPendingMessages()).map((m) => m.id)).toEqual([pending.id]);
    await second.retryPendingMessages();
    expect(sent.map((e) => e.localId)).toEqual([pending.id]);
    expect(api.stored).toHaveLength(1);
    expect(ls.data.size).toBe(0);
  });

  it('works when localStorage throws', async () => {
    const api = fakeApi();
    const throwing = {
      getItem: () => { throw new Error('SecurityError'); },
      setItem: () => { throw new Error('QuotaExceededError'); },
      removeItem: () => { throw new Error('SecurityError'); },
    };
    vi.stubGlobal('localStorage', throwing);
    api.offline = true;
    const client = new RiviumChatClient({ ...config, outboxStore: 'localStorage' });
    const pending = await client.sendMessage('room-1', 'x');
    expect(pending.isPending).toBe(true);
    api.offline = false;
    await client.retryPendingMessages();
    expect(api.stored).toHaveLength(1);
  });

  it('a store whose load or save throws (or rejects) never breaks sending', async () => {
    const api = fakeApi();
    api.offline = true;
    const store: OutboxStore = {
      load: async () => { throw new Error('broken'); },
      save: async () => { throw new Error('broken'); },
    };
    const client = new RiviumChatClient({ ...config, outboxStore: store });
    expect((await client.sendMessage('room-1', 'x')).isPending).toBe(true);
    api.offline = false;
    await client.retryPendingMessages();
    expect(api.stored).toHaveLength(1);
  });
});

describe('queueOfflineMessages off (default): unchanged', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('an offline send rejects, nothing is queued, no clientMessageId is sent', async () => {
    const api = fakeApi();
    const client = new RiviumChatClient({ apiKey: 'rv_live_demo_app', userId: 'user-42' });
    expect(client.queueOfflineMessages).toBe(false);

    await client.sendMessage('room-1', 'Order #1001 is ready');
    expect(api.posts[0]).toEqual({ senderUserId: 'user-42', content: 'Order #1001 is ready', type: 'text' });

    api.offline = true;
    await expect(client.sendMessage('room-1', 'again')).rejects.toBeInstanceOf(TypeError);
    expect(await client.getPendingMessages()).toEqual([]);

    api.offline = false;
    api.failWith = 503;
    const error = await client.sendMessage('room-1', 'x').catch((e) => e);
    expect(error).toBeInstanceOf(RiviumChatError);
    expect(error.statusCode).toBe(503);
  });
});
