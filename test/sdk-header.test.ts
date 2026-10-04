import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { version } from '../package.json';
import { RiviumChatClient, SDK_NAME, SDK_VERSION } from '../src';

describe('X-Rivium-SDK', () => {
  let calls: Array<{ url: string; init: RequestInit }>;

  beforeEach(() => {
    calls = [];
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string, init: RequestInit) => {
        calls.push({ url, init });
        return new Response('[]', { status: 200 });
      }),
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('the version is the package version', () => {
    expect(SDK_NAME).toBe('web');
    expect(SDK_VERSION).toBe(version);
  });

  it('is sent on every request, and nothing else about the request changes', async () => {
    const client = new RiviumChatClient({ apiKey: 'rv_live_test', userId: 'alice' });
    await client.listRooms();

    expect(calls).toHaveLength(1);
    expect(calls[0].url).toBe('https://chat.rivium.co/api/v1/rooms?userId=alice');
    expect(calls[0].init.method).toBe('GET');
    expect(calls[0].init.body).toBeUndefined();
    expect(calls[0].init.headers).toEqual({
      'Content-Type': 'application/json',
      'X-API-Key': 'rv_live_test',
      'X-User-ID': 'alice',
      'X-Rivium-SDK': `web/${version}`,
    });
  });

  it('is sent together with the user token', async () => {
    const client = new RiviumChatClient({ apiKey: 'rv_live_test', userId: 'alice', tokenProvider: async () => 'a.b.c' });
    await client.listRooms();

    const headers = calls[calls.length - 1].init.headers as Record<string, string>;
    expect(headers['X-Rivium-SDK']).toBe(`web/${version}`);
    expect(headers['X-User-Token']).toBe('a.b.c');
  });
});
