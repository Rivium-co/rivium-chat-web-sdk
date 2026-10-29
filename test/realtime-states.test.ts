import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * A stand-in for the realtime transport: records every subscription so a test
 * can play the server's answers (subscribed, refused, ...) on it.
 */
const fake = vi.hoisted(() => {
  type Handler = (ctx?: any) => void;
  class Emitter {
    handlers = new Map<string, Handler[]>();
    on(event: string, handler: Handler) {
      this.handlers.set(event, [...(this.handlers.get(event) ?? []), handler]);
      return this;
    }
    fire(event: string, ctx?: any) {
      (this.handlers.get(event) ?? []).forEach((h) => h(ctx));
    }
    removeAllListeners() {
      this.handlers.clear();
    }
  }
  class FakeSubscription extends Emitter {
    constructor(public channel: string) {
      super();
    }
    subscribe = vi.fn();
    unsubscribe = vi.fn();
    publish = vi.fn(async () => ({}));
    presence = vi.fn(async () => ({ clients: {} }));
  }
  const state = { clients: [] as any[] };
  class FakeCentrifuge extends Emitter {
    subs = new Map<string, FakeSubscription>();
    constructor(public url: string, public options: any) {
      super();
      state.clients.push(this);
    }
    connect = vi.fn();
    disconnect = vi.fn();
    newSubscription(channel: string) {
      if (this.subs.has(channel)) throw new Error(`Subscription to the channel ${channel} already exists`);
      const sub = new FakeSubscription(channel);
      this.subs.set(channel, sub);
      return sub;
    }
    removeSubscription(sub: FakeSubscription) {
      this.subs.delete(sub.channel);
    }
  }
  return { state, FakeCentrifuge };
});

vi.mock('centrifuge', () => ({ Centrifuge: fake.FakeCentrifuge }));

import { RiviumChatClient } from '../src/RiviumChatClient';
import type { AuthErrorEvent, ConnectionStateEvent, RecoveryFailedEvent, SubscriptionStateEvent } from '../src/events/events';

function record(client: RiviumChatClient) {
  const seen = {
    states: [] as ConnectionStateEvent[],
    subs: [] as SubscriptionStateEvent[],
    recovery: [] as RecoveryFailedEvent[],
    auth: [] as AuthErrorEvent[],
  };
  client.on('connectionState', (e) => seen.states.push(e));
  client.on('subscriptionState', (e) => seen.subs.push(e));
  client.on('recoveryFailed', (e) => seen.recovery.push(e));
  client.on('authError', (e) => seen.auth.push(e));
  return seen;
}

describe('connect(): a connection token that cannot be fetched', () => {
  beforeEach(() => {
    fake.state.clients = [];
  });
  afterEach(() => vi.unstubAllGlobals());

  it('unknown key (401): rejects AND reports connectionState error', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ message: 'Invalid API key' }), { status: 401 })));
    const client = new RiviumChatClient({ apiKey: 'rv_live_unknown', userId: 'user-42' });
    const seen = record(client);

    await expect(client.connect()).rejects.toBeTruthy();
    expect(seen.states).toHaveLength(1);
    expect(seen.states[0].state).toBe('error');
    expect(seen.states[0].error).toBeInstanceOf(Error);
  });

  it('project requires tokens, no tokenProvider (403): reports connectionState error', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response(JSON.stringify({ code: 'server_secret_required', message: 'A server secret is required' }), { status: 403 })),
    );
    const client = new RiviumChatClient({ apiKey: 'rv_live_test', userId: 'user-42' });
    const seen = record(client);

    await expect(client.connect()).rejects.toBeTruthy();
    expect(seen.states.map((s) => s.state)).toEqual(['error']);
  });

  it('API unreachable: reports connectionState error', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => { throw new TypeError('Failed to fetch'); }));
    const client = new RiviumChatClient({ apiKey: 'rv_live_test', userId: 'user-42' });
    const seen = record(client);

    await expect(client.connect()).rejects.toBeTruthy();
    expect(seen.states.map((s) => s.state)).toEqual(['error']);
  });

  it('tokenProvider throws: authError token_provider_failed AND connectionState error', async () => {
    const client = new RiviumChatClient({
      apiKey: 'rv_live_test',
      userId: 'user-42',
      tokenProvider: async () => { throw new Error('offline'); },
    });
    const seen = record(client);

    await expect(client.connect()).rejects.toThrow('offline');
    expect(seen.auth.map((a) => a.code)).toEqual(['token_provider_failed']);
    expect(seen.states.map((s) => s.state)).toEqual(['error']);
  });

  it('after a failed connect, connect() can be tried again', async () => {
    let fail = true;
    const client = new RiviumChatClient({
      apiKey: 'rv_live_test',
      userId: 'user-42',
      tokenProvider: async () => {
        if (fail) throw new Error('offline');
        return 'token';
      },
    });
    await expect(client.connect()).rejects.toThrow();
    fail = false;
    await client.connect();
    expect(fake.state.clients).toHaveLength(1);
    expect(fake.state.clients[0].connect).toHaveBeenCalled();
  });
});

describe('room subscriptions the server refuses', () => {
  let client: RiviumChatClient;
  let seen: ReturnType<typeof record>;
  const chatSub = () => fake.state.clients[0].subs.get('chat:room_room-1');

  beforeEach(async () => {
    fake.state.clients = [];
    client = new RiviumChatClient({ apiKey: 'rv_live_test', userId: 'user-42', tokenProvider: async () => 'token' });
    seen = record(client);
    await client.connect();
    client.subscribeToRoom('room-1');
  });

  it('a permanent refusal reports recoveryFailed and the code + reason', () => {
    chatSub().fire('subscribing', { code: 0, reason: 'subscribe called' });
    chatSub().fire('unsubscribed', { channel: 'chat:room_room-1', code: 403, reason: 'Not a participant in this room' });

    expect(seen.subs.at(-1)).toMatchObject({
      channel: 'chat:room_room-1',
      roomId: 'room-1',
      state: 'unsubscribed',
      code: 403,
      reason: 'Not a participant in this room',
    });
    expect(seen.recovery).toEqual([{ roomId: 'room-1', code: 403, reason: 'Not a participant in this room' }]);
  });

  it('after a refusal, subscribeToRoom() tries again instead of keeping the dead subscription', () => {
    const first = chatSub();
    first.fire('unsubscribed', { channel: 'chat:room_room-1', code: 403, reason: 'Not a participant in this room' });

    const typing = fake.state.clients[0].subs.get('typing:room_room-1');
    typing.fire('unsubscribed', { channel: 'typing:room_room-1', code: 403, reason: 'Not a participant in this room' });

    client.subscribeToRoom('room-1');
    expect(chatSub()).not.toBe(first);
    expect(chatSub().subscribe).toHaveBeenCalled();
    expect(fake.state.clients[0].subs.get('typing:room_room-1')).not.toBe(typing);
  });

  it('onRecoveryFailed() helper receives the refusal and can be removed', () => {
    const got: RecoveryFailedEvent[] = [];
    const off = client.onRecoveryFailed((e) => got.push(e));
    chatSub().fire('unsubscribed', { channel: 'chat:room_room-1', code: 403, reason: 'Not a participant in this room' });
    off();
    client.subscribeToRoom('room-1');
    chatSub().fire('unsubscribed', { channel: 'chat:room_room-1', code: 403, reason: 'Not a participant in this room' });
    expect(got).toHaveLength(1);
  });

  it('leaving the room yourself is not reported as a failure', () => {
    chatSub().fire('unsubscribed', { channel: 'chat:room_room-1', code: 0, reason: 'unsubscribe called' });
    expect(seen.recovery).toEqual([]);
    expect(seen.subs.at(-1)).toMatchObject({ state: 'unsubscribed', code: 0 });
  });
});
