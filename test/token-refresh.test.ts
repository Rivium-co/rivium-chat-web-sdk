import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { RiviumChatClient } from '../src/RiviumChatClient';
import { TokenManager } from '../src/services/TokenManager';
import type { AuthErrorEvent } from '../src/events/events';

/** A JWT-shaped token expiring at `expMs`; only the payload matters to the SDK. */
function jwt(id: string, expMs: number): string {
  const b64 = (o: unknown) => Buffer.from(JSON.stringify(o)).toString('base64url');
  return `${b64({ alg: 'HS256' })}.${b64({ sub: id, exp: Math.floor(expMs / 1000) })}.sig`;
}
const inAnHour = () => Date.now() + 3_600_000;

/** Answers like the chat server: accepts only tokens in `valid`. */
function fakeServer() {
  const server = {
    valid: new Set<string>(),
    rejectCode: 'token_expired',
    seenTokens: [] as (string | undefined)[],
    fetch: vi.fn(async (_url: string, init: RequestInit) => {
      const token = (init.headers as Record<string, string>)['X-User-Token'];
      server.seenTokens.push(token);
      if (token !== undefined && !server.valid.has(token)) {
        return new Response(JSON.stringify({ statusCode: 401, code: server.rejectCode, message: 'nope' }), { status: 401 });
      }
      return new Response('[]', { status: 200 });
    }),
  };
  return server;
}

describe('user tokens', () => {
  let server: ReturnType<typeof fakeServer>;
  let issued: string[];
  let authErrors: AuthErrorEvent[];

  /** Issues t1, t2, ... and makes the server accept only the newest one. */
  const provider = async () => {
    await new Promise((r) => setTimeout(r, 5));
    const token = jwt(`t${issued.length + 1}`, inAnHour());
    issued.push(token);
    server.valid.clear();
    server.valid.add(token);
    return token;
  };

  const client = (tokenProvider?: () => Promise<string>) => {
    const c = new RiviumChatClient({ apiKey: 'rv_live_test', userId: 'alice', tokenProvider });
    c.on('authError', (e) => authErrors.push(e));
    return c;
  };

  beforeEach(() => {
    server = fakeServer();
    issued = [];
    authErrors = [];
    vi.stubGlobal('fetch', server.fetch);
  });
  afterEach(() => vi.unstubAllGlobals());

  it('without a tokenProvider no user token is sent (legacy unchanged)', async () => {
    await client().listRooms();
    expect(server.seenTokens).toEqual([undefined]);
  });

  it('sends the token and reuses it across requests', async () => {
    const c = client(provider);
    await c.listRooms();
    await c.listRooms();
    await c.listRooms();
    expect(issued).toHaveLength(1);
    expect(server.seenTokens.every((t) => t === issued[0])).toBe(true);
  });

  it('expired token: refreshes and retries once — the call succeeds', async () => {
    const c = client(provider);
    await c.listRooms();
    server.valid.clear();

    await c.listRooms();

    expect(issued).toHaveLength(2);
    expect(server.seenTokens).toEqual([issued[0], issued[0], issued[1]]);
    expect(authErrors).toEqual([]);
  });

  it('a burst of requests with an expired token triggers ONE refresh', async () => {
    const c = client(provider);
    await c.listRooms();
    server.valid.clear();

    await Promise.all(Array.from({ length: 8 }, () => c.listRooms()));

    expect(issued).toHaveLength(2);
    expect(authErrors).toEqual([]);
  });

  it('token about to expire is refreshed before the request (no 401 at all)', async () => {
    let n = 0;
    const shortLived = async () => {
      n++;
      const token = jwt(`s${n}`, n === 1 ? Date.now() + 30_000 : inAnHour());
      server.valid.add(token);
      return token;
    };
    const c = client(shortLived);
    await c.listRooms();
    await c.listRooms();
    expect(n).toBe(2);
    expect(server.fetch).toHaveBeenCalledTimes(2);
  });

  it('retries only once: still expired after refresh → error + one auth event', async () => {
    const c = client(async () => {
      const token = jwt(`never-${issued.length}`, inAnHour());
      issued.push(token);
      return token;
    });
    await expect(c.listRooms()).rejects.toMatchObject({ statusCode: 401 });
    expect(issued).toHaveLength(2);
    expect(authErrors.map((e) => e.code)).toEqual(['token_expired']);
  });

  it('revoked token: no retry, auth error for the app to log the user out', async () => {
    const c = client(provider);
    await c.listRooms();
    server.valid.clear();
    server.rejectCode = 'token_revoked';

    await expect(c.listRooms()).rejects.toMatchObject({ statusCode: 401 });
    expect(issued).toHaveLength(1);
    expect(authErrors.map((e) => e.code)).toEqual(['token_revoked']);
  });

  it('tokenProvider failing surfaces as an auth error, not a hang', async () => {
    const c = client(async () => {
      throw new Error('your server is down');
    });
    await expect(c.listRooms()).rejects.toThrow('tokenProvider failed');
    expect(authErrors.map((e) => e.code)).toEqual(['token_provider_failed']);
    expect(server.fetch).not.toHaveBeenCalled();
  });

  it('TokenManager.expiryOf reads exp and tolerates junk', () => {
    expect(TokenManager.expiryOf(jwt('x', 1_800_000_000_000))).toBe(1_800_000_000_000);
    expect(TokenManager.expiryOf('not-a-jwt')).toBeUndefined();
  });
});
