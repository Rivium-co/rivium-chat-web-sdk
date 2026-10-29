import React from 'react';
import { act, cleanup, renderHook, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { RiviumChatProvider } from '../src/state/RiviumChatProvider';
import { useChatChannel } from '../src/hooks/useChatChannel';
import { fakeClient, history } from './fakeClient';

afterEach(() => cleanup());

/** Two scroll events in the same moment (before React re-renders) must load the older page once, never twice. */
describe('useChatChannel loadMore', () => {
  it('two calls at once load one page and show no message twice', async () => {
    const client = fakeClient(history(150));
    const wrapper = ({ children }: { children: React.ReactNode }) => <RiviumChatProvider client={client as any}>{children}</RiviumChatProvider>;
    const { result } = renderHook(() => useChatChannel('room-1', 'user-42'), { wrapper });
    await waitFor(() => expect(result.current.messages.length).toBe(50));
    const before = client.getMessages.mock.calls.length;

    await act(async () => { await Promise.all([result.current.loadMore(), result.current.loadMore()]); });

    expect(client.getMessages.mock.calls.length - before).toBe(1);
    const ids = result.current.messages.map((m) => m.id);
    expect(ids.length).toBe(100);
    expect(new Set(ids).size).toBe(100);
  });
});
