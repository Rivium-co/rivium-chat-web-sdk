import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { RiviumChatClient } from '../src/RiviumChatClient';
import { RiviumChatError } from '../src/services/ApiService';

/** A server that never answers; it only notices when the request is aborted. */
function hangingFetch() {
  return vi.fn((_url: string, init: RequestInit) => new Promise<Response>((_, reject) => {
    init.signal?.addEventListener('abort', () => reject(new DOMException('aborted', 'AbortError')));
  }));
}

describe('request timeout', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it('an API that never answers fails after 30 seconds with code "timeout"', async () => {
    const fetchMock = hangingFetch();
    vi.stubGlobal('fetch', fetchMock);
    const client = new RiviumChatClient({ apiKey: 'rv_live_test', userId: 'user-42' });

    const result = client.listRooms().catch((e) => e);
    await vi.advanceTimersByTimeAsync(29_999);
    let settled = false;
    result.then(() => (settled = true));
    await Promise.resolve();
    expect(settled).toBe(false);

    await vi.advanceTimersByTimeAsync(1);
    const error = await result;
    expect(error).toBeInstanceOf(RiviumChatError);
    expect(error.code).toBe('timeout');
    expect((fetchMock.mock.calls[0][1] as RequestInit).signal?.aborted).toBe(true);
  });

  it('requestTimeoutMs changes the limit', async () => {
    vi.stubGlobal('fetch', hangingFetch());
    const client = new RiviumChatClient({ apiKey: 'rv_live_test', userId: 'user-42', requestTimeoutMs: 5_000 });

    const result = client.listRooms().catch((e) => e);
    await vi.advanceTimersByTimeAsync(5_000);
    expect((await result).code).toBe('timeout');
  });

  it('also fails when fetch ignores the abort signal', async () => {
    vi.stubGlobal('fetch', vi.fn(() => new Promise<Response>(() => {})));
    const client = new RiviumChatClient({ apiKey: 'rv_live_test', userId: 'user-42' });

    const result = client.listRooms().catch((e) => e);
    await vi.advanceTimersByTimeAsync(30_000);
    expect((await result).code).toBe('timeout');
  });

  it('connect() to an unreachable API reports connectionState error after the timeout', async () => {
    vi.stubGlobal('fetch', hangingFetch());
    const client = new RiviumChatClient({ apiKey: 'rv_live_test', userId: 'user-42' });
    const states: string[] = [];
    client.on('connectionState', (e) => states.push(e.state));

    const result = client.connect().catch((e) => e);
    await vi.advanceTimersByTimeAsync(30_000);
    expect((await result).code).toBe('timeout');
    expect(states).toEqual(['error']);
  });

  it('answers in time are unchanged', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('[]', { status: 200 })));
    const client = new RiviumChatClient({ apiKey: 'rv_live_test', userId: 'user-42' });
    await expect(client.listRooms()).resolves.toEqual([]);
  });
});
