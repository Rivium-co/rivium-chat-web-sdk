import type { Attachment, Message, MessageType } from '../models/types';
import type { MessageFailedEvent, MessageSentEvent } from '../events/events';
import { RiviumChatError } from './ApiService';

/**
 * A message waiting in the offline outbox. It has the shape of a `Message`
 * (so a chat screen can show it right away) with `isPending: true`,
 * `id = "local_<clientMessageId>"` and the `clientMessageId` it will be stored with.
 */
export interface PendingMessage extends Message {
  clientMessageId: string;
  isPending: true;
}

/**
 * Where the offline outbox keeps its messages so they survive an app restart.
 * `load()` is called once when the client is created; `save(items)` after
 * every change with the whole queue (an empty array after the last message
 * is sent or `clearPendingMessages()` is called). Either may be async.
 * Errors are caught: a failing store never breaks sending.
 */
export interface OutboxStore {
  load(): PendingMessage[] | null | undefined | Promise<PendingMessage[] | null | undefined>;
  save(items: PendingMessage[]): void | Promise<void>;
}

/** Messages older than this leave the queue as failed (`reason: 'expired'`). */
export const OUTBOX_MAX_AGE_MS = 24 * 60 * 60 * 1000;
/** First retry after a transient failure; doubles up to `OUTBOX_MAX_BACKOFF_MS`. */
export const OUTBOX_MIN_BACKOFF_MS = 2_000;
export const OUTBOX_MAX_BACKOFF_MS = 60_000;

/** Options of a message send that the outbox keeps. */
export interface OutboxSendOptions {
  type?: MessageType;
  attachments?: Attachment[];
  replyToId?: string;
  metadata?: Record<string, unknown>;
}

/**
 * Transient = worth trying again later: no answer at all (no network, timeout,
 * a tokenProvider that cannot reach your server), 408, 429 or 5xx.
 * Everything else with an HTTP status (400, 401, 403, 404, 413, ...) is permanent.
 */
export function isTransientSendError(error: unknown): boolean {
  if (error instanceof RiviumChatError) {
    const status = error.statusCode;
    if (status === undefined) return true;
    return status === 408 || status === 429 || status >= 500;
  }
  // fetch() rejects with a TypeError (or similar) when there is no network.
  return true;
}

/** UUID v4 without a dependency: crypto when the platform has it, Math.random otherwise. */
export function uuidV4(): string {
  const c = (globalThis as { crypto?: { randomUUID?: () => string; getRandomValues?: (a: Uint8Array) => Uint8Array } })
    .crypto;
  if (c?.randomUUID) {
    try {
      return c.randomUUID();
    } catch {
      // fall through
    }
  }
  const bytes = new Uint8Array(16);
  if (c?.getRandomValues) {
    try {
      c.getRandomValues(bytes);
    } catch {
      for (let i = 0; i < 16; i++) bytes[i] = Math.floor(Math.random() * 256);
    }
  } else {
    for (let i = 0; i < 16; i++) bytes[i] = Math.floor(Math.random() * 256);
  }
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

/** Builds the pending copy `sendMessage()` returns for a queued message. */
export function pendingMessage(
  roomId: string,
  senderUserId: string,
  content: string,
  clientMessageId: string,
  options: OutboxSendOptions | undefined,
  now: number,
): PendingMessage {
  return {
    id: `local_${clientMessageId}`,
    clientMessageId,
    roomId,
    senderUserId,
    content,
    type: options?.type ?? 'text',
    ...(options?.attachments && { attachments: options.attachments }),
    ...(options?.metadata && { metadata: options.metadata }),
    ...(options?.replyToId && { replyToId: options.replyToId }),
    isDeleted: false,
    createdAt: new Date(now).toISOString(),
    isEdited: false,
    isPinned: false,
    isPending: true,
  };
}

interface OutboxDeps {
  userId: string;
  store?: OutboxStore;
  /** Sends one queued message with its clientMessageId. */
  send: (item: PendingMessage) => Promise<Message>;
  onSent: (event: MessageSentEvent) => void;
  onFailed: (event: MessageFailedEvent) => void;
  now?: () => number;
}

/**
 * The offline outbox: keeps messages that could not be sent and sends them,
 * one at a time in the order written, when the connection is back.
 * @internal
 */
export class Outbox {
  private items: PendingMessage[] = [];
  private readonly ready: Promise<void>;
  private flushing: Promise<void> | null = null;
  private flushAgain = false;
  private backoffMs = 0;
  private timer: ReturnType<typeof setTimeout> | null = null;
  /** Bumped by dispose(): a store load still running is then ignored. */
  private generation = 0;
  private readonly now: () => number;

  constructor(private readonly deps: OutboxDeps) {
    this.now = deps.now ?? (() => Date.now());
    this.ready = this.load();
  }

  private async load(): Promise<void> {
    if (!this.deps.store) return;
    try {
      const generation = this.generation;
      const loaded = await this.deps.store.load();
      if (!Array.isArray(loaded) || generation !== this.generation) return;
      const valid = loaded.filter(
        (m) =>
          m &&
          typeof m.clientMessageId === 'string' &&
          typeof m.roomId === 'string' &&
          typeof m.content === 'string' &&
          // Never send another user's leftovers as this user.
          m.senderUserId === this.deps.userId,
      );
      const known = new Set(this.items.map((m) => m.clientMessageId));
      this.items = [...valid.filter((m) => !known.has(m.clientMessageId)), ...this.items];
      if (this.items.length > 0) this.schedule(0);
    } catch {
      // A store that cannot be read starts empty.
    }
  }

  private persist(): void {
    const store = this.deps.store;
    if (!store) return;
    try {
      const result = store.save([...this.items]);
      if (result && typeof (result as Promise<void>).catch === 'function') {
        (result as Promise<void>).catch(() => {});
      }
    } catch {
      // A store that cannot be written keeps the queue in memory only.
    }
  }

  /** Whether the room has messages waiting (a new one must queue behind them). */
  async hasPending(roomId: string): Promise<boolean> {
    await this.ready;
    return this.items.some((m) => m.roomId === roomId);
  }

  /** Adds a message to the end of the queue and plans a retry. */
  async enqueue(item: PendingMessage): Promise<void> {
    await this.ready;
    this.items.push(item);
    this.persist();
    // One retry timer for the whole queue; a new message does not push it back.
    if (this.timer === null && !this.flushing) this.schedule(this.backoffMs || this.nextBackoff());
  }

  async list(roomId?: string): Promise<PendingMessage[]> {
    await this.ready;
    return this.items.filter((m) => roomId === undefined || m.roomId === roomId).map((m) => ({ ...m }));
  }

  /** Removes a message from the queue; emits nothing. */
  async cancel(localId: string): Promise<boolean> {
    await this.ready;
    const before = this.items.length;
    this.items = this.items.filter((m) => m.id !== localId && m.clientMessageId !== localId);
    if (this.items.length === before) return false;
    this.persist();
    if (this.items.length === 0) this.stopTimer();
    return true;
  }

  /** Empties the queue and the store; emits nothing. */
  async clear(): Promise<void> {
    await this.ready;
    this.items = [];
    this.stopTimer();
    this.backoffMs = 0;
    const store = this.deps.store;
    if (!store) return;
    try {
      await store.save([]);
    } catch {
      // ignore
    }
  }

  /** Sends the queue now (on connect and `retryPendingMessages()`); resets the back-off. */
  retryNow(): Promise<void> {
    this.backoffMs = 0;
    this.stopTimer();
    return this.flush();
  }

  /** Forgets the queue in memory and stops retrying; a persistent store keeps it. */
  dispose(): void {
    this.generation++;
    this.backoffMs = 0;
    this.items = [];
    this.stopTimer();
  }

  /** Sends one message at a time in the order written. Never runs twice at once. */
  flush(): Promise<void> {
    if (this.flushing) {
      this.flushAgain = true;
      return this.flushing;
    }
    this.flushing = (async () => {
      try {
        await this.ready;
        do {
          this.flushAgain = false;
          await this.flushOnce();
        } while (this.flushAgain && this.items.length > 0 && this.timer === null);
      } finally {
        this.flushing = null;
      }
    })();
    return this.flushing;
  }

  private async flushOnce(): Promise<void> {
    this.stopTimer();
    while (this.items.length > 0) {
      const item = this.items[0];
      if (this.now() - Date.parse(item.createdAt) > OUTBOX_MAX_AGE_MS) {
        this.remove(item);
        this.deps.onFailed({
          localId: item.id,
          clientMessageId: item.clientMessageId,
          roomId: item.roomId,
          error: new RiviumChatError('The message waited longer than 24 hours and was not sent'),
          reason: 'expired',
        });
        continue;
      }
      let message: Message;
      try {
        message = await this.deps.send(item);
      } catch (error) {
        if (isTransientSendError(error)) {
          // Still offline: stop here so the order is kept; try again later.
          this.schedule(this.nextBackoff());
          return;
        }
        if (this.remove(item)) {
          this.deps.onFailed({
            localId: item.id,
            clientMessageId: item.clientMessageId,
            roomId: item.roomId,
            error: error instanceof Error ? error : new Error(String(error)),
            reason: 'rejected',
          });
        }
        continue;
      }
      this.backoffMs = 0;
      // Cancelled while it was on the way: no event.
      if (this.remove(item)) {
        this.deps.onSent({
          localId: item.id,
          clientMessageId: item.clientMessageId,
          message: { ...message, clientMessageId: message.clientMessageId ?? item.clientMessageId },
        });
      }
    }
  }

  private remove(item: PendingMessage): boolean {
    const index = this.items.findIndex((m) => m.clientMessageId === item.clientMessageId);
    if (index < 0) return false;
    this.items.splice(index, 1);
    this.persist();
    return true;
  }

  private nextBackoff(): number {
    this.backoffMs =
      this.backoffMs === 0 ? OUTBOX_MIN_BACKOFF_MS : Math.min(this.backoffMs * 2, OUTBOX_MAX_BACKOFF_MS);
    return this.backoffMs;
  }

  private schedule(delayMs: number): void {
    this.stopTimer();
    this.timer = setTimeout(() => {
      this.timer = null;
      void this.flush();
    }, delayMs);
  }

  private stopTimer(): void {
    if (this.timer !== null) {
      clearTimeout(this.timer);
      this.timer = null;
    }
  }
}

/**
 * The Web store: `localStorage` under one key per project key and user.
 * Every access is wrapped: private windows, blocked storage or a full quota
 * leave the queue in memory only.
 */
export function localStorageOutboxStore(key: string): OutboxStore {
  const storage = (): { getItem(k: string): string | null; setItem(k: string, v: string): void; removeItem(k: string): void } | undefined => {
    try {
      return (globalThis as { localStorage?: any }).localStorage ?? undefined;
    } catch {
      return undefined;
    }
  };
  return {
    load() {
      try {
        const raw = storage()?.getItem(key);
        if (!raw) return [];
        const parsed = JSON.parse(raw);
        return Array.isArray(parsed) ? parsed : [];
      } catch {
        return [];
      }
    },
    save(items) {
      try {
        const s = storage();
        if (!s) return;
        if (items.length === 0) s.removeItem(key);
        else s.setItem(key, JSON.stringify(items));
      } catch {
        // ignore
      }
    },
  };
}
