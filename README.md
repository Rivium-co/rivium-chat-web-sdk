# RiviumChat Web SDK

Real-time messaging SDK for web applications. Add chat to your app with pre-built React UI components, real-time messaging, read receipts, typing indicators, reactions, and push notifications.

## Features

- Real-time messaging via WebSocket (<50ms latency)
- Pre-built React UI components (chat screen, message bubbles, input field, typing indicator, etc.)
- Read receipts with delivery status (sent, delivered, read)
- Emoji reactions and message pinning
- Typing and presence indicators
- Threaded replies
- File and image sharing with inline previews
- Full-text message search
- Unread message counts
- Push notifications via [Rivium Push](https://rivium.co/cloud/rivium-push) for offline users
- Customizable theming
- TypeScript declarations included
- Zero config — just add your API key

## Installation

```bash
npm install @rivium/web-chat
# or
yarn add @rivium/web-chat
```

For React UI components:

```bash
npm install @rivium/web-chat-ui
```

## Quick Start

```typescript
import { RiviumChatClient } from '@rivium/web-chat';

const client = new RiviumChatClient({
  apiKey: 'your_api_key',
  userId: 'user-123',
  userInfo: { displayName: 'John' },
});

await client.connect();
```

### Secure user identity (recommended)

Your API key ships inside the app, so on its own it cannot prove who the user
is. Add a `tokenProvider` that asks **your server** for a user token:

```typescript
const client = new RiviumChatClient({
  apiKey: 'your_api_key',
  userId: 'user-123',
  tokenProvider: () => fetch('/api/chat-token').then((r) => r.json()).then((j) => j.token),
});

client.on('authError', () => signOut()); // revoked or invalid token
```

Your server gets the token with its server secret (never put it in the app):

```http
POST https://chat.rivium.co/api/v1/users/token
x-api-key: your_api_key
x-server-secret: your_server_secret

{ "userId": "user-123" }
```

Tokens last 1 hour. The SDK refreshes them before they expire and retries a
request once if the server reports an expired token, so users never notice.

### Create a Room

```typescript
const room = await client.findOrCreateRoom({
  externalId: 'order-123',
  participants: [
    { externalUserId: 'user-123', displayName: 'John', role: 'member' },
    { externalUserId: 'user-456', displayName: 'Jane', role: 'member' },
  ],
});
```

### Send a Message

```typescript
const message = await client.sendMessage(room.id, 'Hello!');
```

### Listen for Real-Time Events

```typescript
client.on('message', (event) => {
  console.log('New message:', event.message.content);
});

client.on('typing', (event) => {
  console.log(`${event.userId} is typing: ${event.isTyping}`);
});

client.on('presence', (event) => {
  console.log(`${event.userId} is online: ${event.isOnline}`);
});

client.on('readReceipt', (event) => {
  console.log(`${event.userId} read messages at ${event.readAt}`);
});
```

### Sending while offline

Messages written without network can wait in an outbox and be sent when the connection is back, in the order they were written and never twice. It is off by default: without it, `sendMessage()` without network rejects as before.

```typescript
const client = new RiviumChatClient({
  apiKey: 'rv_live_...',
  userId: 'user-42',
  tokenProvider,
  queueOfflineMessages: true,
});
```

With the option on:

- Every message is sent with a `clientMessageId`, so a send that is retried is stored only once.
- When the message cannot be sent now (no network, timeout, 408, 429, 5xx), `sendMessage()` does not reject: it returns the message as pending (`isPending: true`, `id: "local_<clientMessageId>"`). It is sent when the connection comes back, or earlier on a retry (after 2 s, 4 s, 8 s … at most every 60 s).
- When the Chat API refuses the message (400, 401, 403, 404, 413, for example the user is not a member of the room), `sendMessage()` rejects as before.
- A message that waits longer than 24 hours is dropped as failed.
- Attachments are sent as they are: upload the file first and send its URL.
- `queueOfflineMessages` needs the current Chat API.

```typescript
const pending = await client.sendMessage(roomId, 'Order #1001 is ready');

client.onMessageSent(({ localId, clientMessageId, message }) => {
  // the queued message was stored: replace the pending copy (localId) with message
});

client.onMessageFailed(({ localId, roomId, reason, error }) => {
  // reason 'rejected' (the Chat API refused it) or 'expired' (waited over 24 hours)
});

await client.getPendingMessages(roomId); // messages still waiting, oldest first
await client.retryPendingMessages();     // send them now
await client.cancelPendingMessage(pending.id); // remove one (no event)
await client.clearPendingMessages();     // remove all, also from the store: call it on sign-out
```

The live `message` event for a queued message still arrives and carries the same `clientMessageId`, so a screen can match it to its pending copy and show it once. `on('messageSent', ...)` and `on('messageFailed', ...)` work too.

**Storage.** The outbox lives in memory by default: it survives a lost network, not a page reload. To keep it across reloads, use `localStorage` (one entry per API key and user; when the browser blocks storage the outbox stays in memory):

```typescript
const client = new RiviumChatClient({
  apiKey: 'rv_live_...',
  userId: 'user-42',
  queueOfflineMessages: true,
  outboxStore: 'localStorage',
});
```

You can also pass your own store: an object with `load()` and `save(items)` (both may be async).

**UI kit.** With `queueOfflineMessages` on, `ChatScreen` shows a queued message with "Waiting for network…", replaces it when it is sent, and shows Retry when it fails. Without the option, a message that cannot be sent shows Retry as before.

### Mark Messages as Read

```typescript
await client.markAsRead(room.id);
```

## Packages

| Package | Description |
|---------|-------------|
| `@rivium/web-chat` | Core SDK — API client, real-time messaging, models |
| `@rivium/web-chat-ui` | Pre-built React UI components with theming |

## UI Components

`@rivium/web-chat-ui` includes ready-to-use React components:

- `ChatScreen` - Full chat screen with messages, input, and state management
- `ChatMessageBubble` - Message bubble with read receipts, reactions, and reply preview
- `ChatInputField` - Text input with attachment and typing indicator support
- `TypingIndicator` - Animated typing dots
- `PresenceIndicator` - Online/offline status dot
- `UnreadBadge` - Unread message count badge
- `MessageReactionPicker` - Emoji reaction selector
- `ChatRoomListTile` - Room list item with last message preview
- `ReadReceipts` - Delivery status indicators (sent, delivered, read)
- `MessageSearchBar` - Full-text message search

Styles: import the kit's stylesheet once (it contains only the classes the
components use and no CSS reset), or, if your app uses Tailwind CSS, add the
kit to your Tailwind `content` instead:

```typescript
import '@rivium/web-chat-ui/styles.css';
// or, in tailwind.config.js: content: [..., './node_modules/@rivium/web-chat-ui/dist/**/*.{js,mjs}']
```

Dark mode: `<RiviumChatThemeProvider dark>` is always dark, `dark="system"`
follows the device's light / dark setting.

## Example App

The `web_ecommerce/` directory contains a complete e-commerce chat example built with React and Vite.

To run it, copy `web_ecommerce/.env.example` to `web_ecommerce/.env.local`, set
`VITE_RIVIUM_API_KEY` to your project's public key from Rivium Console, then:

```bash
cd web_ecommerce
npm install
npm run dev
```

## Links

- [Rivium Chat](https://rivium.co/cloud/rivium-chat) - Learn more about Rivium Chat
- [Documentation](https://rivium.co/cloud/rivium-chat/docs/quick-start) - Full documentation and guides
- [Rivium Console](https://console.rivium.co) - Manage your chat rooms

## License

MIT
