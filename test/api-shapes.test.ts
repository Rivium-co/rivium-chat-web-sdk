import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { RiviumChatClient } from '../src/RiviumChatClient';
import { RealtimeService } from '../src/services/RealtimeService';
import { normalizeConfig } from '../src/RiviumChatConfig';
import type { AuthErrorEvent } from '../src/events/events';

const message = (id: string, content: string) => ({
  id,
  roomId: 'room-1',
  senderUserId: 'bob',
  content,
  type: 'text',
  createdAt: '2026-10-01T10:00:00.000Z',
});

describe('API shapes', () => {
  let calls: Array<{ url: string; init: RequestInit }>;
  let body: unknown;

  beforeEach(() => {
    calls = [];
    body = [];
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string, init: RequestInit) => {
        calls.push({ url, init });
        return new Response(JSON.stringify(body), { status: 200 });
      }),
    );
  });
  afterEach(() => vi.unstubAllGlobals());

  const client = () => new RiviumChatClient({ apiKey: 'rv_live_test', userId: 'alice' });

  it('searchMessages returns the API total (and the old fields from it)', async () => {
    body = { messages: [message('m1', 'hello'), message('m2', 'hello again')], total: 5 };

    const result = await client().searchMessages('room-1', 'hello', { limit: 2 });

    expect(result.messages.map((m) => m.id)).toEqual(['m1', 'm2']);
    expect(result.total).toBe(5);
    expect(result.totalCount).toBe(5);
    expect(result.hasMore).toBe(true);
  });

  it('getMentions fills the old field names from what the API sends', async () => {
    body = [
      {
        id: 'mention-1',
        messageId: 'm1',
        roomId: 'room-1',
        mentionedUserId: 'alice',
        createdAt: '2026-10-01T10:00:01.000Z',
        message: message('m1', '@alice look'),
      },
    ];

    const [mention] = await client().getMentions('room-1');

    expect(mention.mentionedUserId).toBe('alice');
    expect(mention.userId).toBe('alice');
    expect(mention.mentionedAt).toBe('2026-10-01T10:00:01.000Z');
    expect(mention.message.content).toBe('@alice look');
  });

  it('uploadFile fails clearly without calling a route that does not exist', async () => {
    await expect(client().uploadFile('room-1', new Blob(['x']), 'x.txt')).rejects.toThrow(
      /not supported.*send its URL as an attachment/,
    );
    expect(calls).toHaveLength(0);
  });

  it('updateRoom fails clearly without calling a route that does not exist', async () => {
    await expect(client().updateRoom('room-1', { name: 'x' })).rejects.toThrow(/not supported/);
    expect(calls).toHaveLength(0);
  });
});

describe('realtime', () => {
  it('a failing tokenProvider during connect() is reported as token_provider_failed', async () => {
    const authErrors: AuthErrorEvent[] = [];
    const c = new RiviumChatClient({
      apiKey: 'rv_live_test',
      userId: 'alice',
      tokenProvider: async () => {
        throw new Error('your server is down');
      },
    });
    c.on('authError', (e) => authErrors.push(e));

    await expect(c.connect()).rejects.toThrow('your server is down');
    expect(authErrors.map((e) => e.code)).toEqual(['token_provider_failed']);
  });

  it('typing is throttled per room, not across rooms', async () => {
    const service = new RealtimeService(
      normalizeConfig({ apiKey: 'rv_live_test', userId: 'alice' }),
      async () => 'token',
    );
    const published: string[] = [];
    const subs = (service as unknown as { subscriptions: Map<string, unknown> }).subscriptions;
    for (const room of ['r1', 'r2']) {
      subs.set(`typing:room_${room}`, { publish: async () => published.push(room) });
    }

    await service.publishTyping('r1');
    await service.publishTyping('r2');
    await service.publishTyping('r1'); // within 2 s of the first: dropped

    expect(published).toEqual(['r1', 'r2']);
  });
});
