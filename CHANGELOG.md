## [0.2.0] - 2026-10-30

- Fixed: a request that times out now rejects with `RiviumChatError` code `timeout` in browsers too (it could reject with the browser's `AbortError`).
- Fixed (UI kit): scrolling up quickly no longer loads the same older page twice.

- Added: sending while offline (opt-in). With `queueOfflineMessages: true`, a message that cannot be sent now (no network, timeout, 408, 429, 5xx) is kept and sent when the connection is back, in order and never twice; `sendMessage()` returns it as pending (`isPending: true`, `id: "local_<clientMessageId>"`) instead of rejecting. A message the Chat API refuses still rejects. New events `messageSent` and `messageFailed` (`reason` `'rejected'` or `'expired'` after 24 hours), helpers `onMessageSent()` / `onMessageFailed()`, and `getPendingMessages()`, `retryPendingMessages()`, `cancelPendingMessage()` and `clearPendingMessages()`. Messages carry `clientMessageId`. Needs the current Chat API. Without the option nothing changes.
- Added: `outboxStore: 'localStorage'` keeps the offline outbox across page reloads (one entry per API key and user); or pass your own store with `load()` / `save(items)`.
- UI kit: with `queueOfflineMessages` on, a queued message shows "Waiting for network…" instead of failing, is replaced when it is sent (shown once, also when the live message arrives first), and shows Retry when it fails. Messages still waiting are shown when the chat opens.
- Fixed: `searchMessages()` returns `total`, the number of matching messages. `totalCount` (same value) and `hasMore` still work but are deprecated.
- Fixed: `getMentions()` results carry `mentionedUserId` and `createdAt`; the older `userId` and `mentionedAt` fields are filled from them and deprecated.
- Changed: `uploadFile()` is not supported and now rejects with a clear `RiviumChatError` instead of an HTTP 404. Rivium Chat does not store files: upload the file to your own storage and send its URL as an attachment with `sendMessage()`.
- Changed: `updateRoom()` is not supported and now rejects with a clear `RiviumChatError` instead of an HTTP 404. Set the name and metadata when you create the room.
- Fixed: when `tokenProvider` fails during `connect()`, the `authError` event now reports `token_provider_failed`, as it already did for other calls.
- Fixed: `publishTyping()` is throttled per room, so typing in one room no longer hides typing in another for 2 seconds.
- Fixed: `removeParticipant()` works with user ids that contain characters such as `/` or spaces.
- Fixed: `connect()` now emits `connectionState` `error` when it cannot get a connection token (unknown API key, project requires a user token, API unreachable, failing `tokenProvider`), as well as rejecting. `authError` with `token_provider_failed` is unchanged.
- Fixed: a room subscription the server refuses (for example `Not a participant in this room`) is now reported: `recoveryFailed` fires with `code` and `reason`, and `subscriptionState` `unsubscribed` carries `roomId`, `code` and `reason`. A later `subscribeToRoom()` for that room tries again.
- Added: requests to the Chat API time out after 30 seconds (as in the Android and iOS SDKs) and reject with a `RiviumChatError` whose `code` is `'timeout'`. Change the limit with the `requestTimeoutMs` option.
- Added: `onRecoveryFailed()`, `onConnectionStateChange()` and `onMessagePinChanged()` helpers, each returning an unsubscribe function.
- UI kit: `ChatScreen` inside `RiviumChatProvider` no longer shows "Failed to load messages / Not connected": messages load right away and the room is followed once the connection is up, and again after a reconnect (missed messages are reloaded).
- UI kit: when a room's live updates are lost after a long offline gap (`recoveryFailed`), the chat screen reloads its messages.
- UI kit: a failed message shows a Retry button.
- UI kit: the Pin / Unpin menu action now pins and unpins the message; pinned messages are marked, also when pinned by someone else. `useChatChannel()` adds `pinMessage()`, `unpinMessage()` and `refresh()`.
- UI kit: `VoiceMessageRecorder` reports the real recording length to `onRecordingComplete` (it was always 0).
- UI kit: `@rivium/web-chat-ui/styles.css` is now included in the package (only the kit's classes, no CSS reset).
- UI kit: opening a chat no longer loads the whole history at once; older messages load when you scroll up, and your place is kept.
- UI kit: in dark mode the chat screen, input bar and menus use the theme colors instead of white. New theme colors `background`, `surface` and `border`.
- UI kit: `RiviumChatThemeProvider` accepts `dark="system"` to follow the device's light / dark setting, live. The default stays light.
- UI kit: typing indicators, "Replying to" and quoted replies show the participant's display name from the room, falling back to the user id. Names passed in `userDisplayNames` still win.
- UI kit: `RiviumChatProvider` no longer reconnects when `onConnected` / `onConnectionError` are new functions on each render.
- UI kit: `MessageSearchBar` lists `results` (sender, time, highlighted text) and calls `onResultSelected` on click. `totalResults` defaults to the number of results.
- UI kit: `HighlightedText` (search highlight) no longer crashes on queries with characters such as `(` or `*`.
- UI kit: `MessageContextMenu` offers only Copy for a message that is still sending or failed, and no Copy for a message without text. `availableActions` still decides when given.

## [0.1.3] - 2026-10-05

- Added: requests send an `X-Rivium-SDK` header (`web/<version>`); `SDK_NAME` and `SDK_VERSION` are exported.

## [0.1.2] - 2026-09-26

- Added: `lastMessage` and `unreadCount` on `Room`. A chat list can show the
  latest message and an unread badge from `listRooms()` alone, with no extra
  calls.

## [0.1.1] - 2026-09-11

- Added: `tokenProvider` for secure user identity. Tokens are refreshed automatically before they expire and after an expired-token response.
- Added: `authError` event for identity errors a refresh cannot fix.

## [0.1.0] - 2026-04-26

- Initial release
