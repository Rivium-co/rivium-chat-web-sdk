## [0.1.2] - 2026-09-26

- Added: `lastMessage` and `unreadCount` on `Room`. A chat list can show the
  latest message and an unread badge from `listRooms()` alone, with no extra
  calls.

## [0.1.1] - 2026-09-11

- Added: `tokenProvider` for secure user identity. Tokens are refreshed automatically before they expire and after an expired-token response.
- Added: `authError` event for identity errors a refresh cannot fix.

## [0.1.0] - 2026-04-26

- Initial release
