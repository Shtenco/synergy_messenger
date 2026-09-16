# SYNERGY Messenger V3 Phase 3 — Messenger UI Integration Design

## Goal
Replace the v2.1 demo chat state with the real V3 P2P + Crypto engine while preserving the existing visual shell.

## Constraints
- No central SYNERGY API, account database, or mandatory directory service.
- 1:1 secret chats only in Phase 3; groups/media/Finance remain Phase 4.
- Existing v2.1 visual language, emoji/reply/forward UI, stories, and layout stay recognizable.
- Plaintext message history must be encrypted at rest with the existing V3 Vault.
- Transport/outbox stores continue to contain ciphertext packets only.
- A short Public ID is for human verification, not centralized discovery.
- Contact establishment uses a self-contained signed P2P Contact Card that can be copied or encoded as QR.

## Data model
IndexedDB schema v3 adds:
- `contacts` keyed by `peerDeviceId`: local display name + public signed contact bundle.
- `conversations` keyed by `chatId`: peerDeviceId, local metadata, timestamps. No plaintext preview.
- `uiHistory` keyed by `messageId`: chatId/direction/timestamp in clear metadata, full display record sealed by Vault AES-GCM.

`uiHistory` plaintext records contain text, reply metadata, status, read state and expiry. The IndexedDB row never contains message text.

## Secure application payload
Crypto plaintext becomes a versioned application payload before Double Ratchet encryption:
- `text`: message text plus optional reply metadata.
- `receipt`: target message ID + `delivered` or `read`.

Legacy Phase-2 raw text decrypt remains readable for backwards compatibility, but new sends always use the versioned payload.

## Delivery state
Outbound UI status is monotonic:
`sending -> sent -> delivered -> read`, with `failed` as terminal failure.

- `sent`: local P2P Core handed ciphertext to WebRTC/Waku.
- `delivered`: recipient decrypted, persisted encrypted local history, then sent encrypted delivery receipt.
- `read`: recipient opened the chat and sent encrypted read receipt.

## Contact bootstrap
- Public ID: local `SYN3-...` fingerprint.
- Contact Card: compact `synergy://contact/v1/<base64url-json>` containing identity + signed prekey and no one-time prekeys. The 3-DH path makes it usable without a server-side prekey lookup.
- QR: locally generated from the short SYN3 Public ID for visual/offline verification. The full self-contained Contact Card remains the copyable P2P Invite in alpha.3; no HTTP QR service or central lookup is used.

## UI integration
`js/app.js` becomes a thin DOM adapter around `MessengerController`:
- no `DEMO_CHATS_SEED`;
- no `simulateReply()`;
- chat list and messages load from encrypted repositories;
- sending calls controller -> SecureMessengerCore;
- new contact modal imports Contact Card;
- settings display Public ID, local Public-ID QR and the full copyable P2P Invite;
- statuses render from real transport/receipt state.

## Non-goals
Phase 3 does not implement group encryption, media transfer, Finance transactions, push infrastructure, multi-device Sesame, or production security certification.
