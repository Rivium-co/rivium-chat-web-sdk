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

## Example App

The `web_ecommerce/` directory contains a complete e-commerce chat example built with React and Vite.

## Links

- [Rivium Chat](https://rivium.co/cloud/rivium-chat) - Learn more about Rivium Chat
- [Documentation](https://rivium.co/cloud/rivium-chat/docs/quick-start) - Full documentation and guides
- [Rivium Console](https://console.rivium.co) - Manage your chat rooms

## License

MIT
