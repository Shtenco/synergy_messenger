# SYNERGY Messenger v3.0.0-alpha.6 — Phase 4C Groups / MLS

Phase 4C adds a serverless group orchestration layer on top of the existing P2P, Double Ratchet, encrypted media and private voice stack.

## Security model

- Production group cryptography is accessed only through `GroupCryptoProvider` / `OpenMlsProvider`.
- Runtime does **not** bundle the deterministic test provider and does not silently fall back to sender keys or a shared group key.
- Groups are enabled only when an RFC 9420-capable backend is injected as `globalThis.SYNERGY_OPENMLS_BACKEND`.
- Without that backend, 1:1 messaging, encrypted media and voice remain available; group creation is disabled fail-closed.
- Group records (title, membership, roles, MLS state and past epoch state) are Vault-sealed at rest in IndexedDB schema v5.
- Transport sender metadata is never trusted for group authorization; controller authorization uses the sender authenticated by the MLS provider.

## Implemented orchestration

- Create and join via MLS KeyPackage / Welcome.
- Pairwise E2E delivery of Welcome messages through the existing Double Ratchet channel.
- Add/remove member epoch rotation.
- Rotating per-epoch group mailbox derived through an MLS exporter secret.
- Current plus two past epoch states for delayed application messages.
- Deterministic membership-commit coordinator among owner/admin devices with explicit failover exclusion support.
- Out-of-order future Commit buffering and ordered application.
- Future-epoch application-message buffering so Waku Store reordering does not lose messages that arrive before their Commit.
- Owner/admin/member application policy with monotonic policy revision.
- Owner-authenticated role updates transported as encrypted group application messages.
- Encrypted group text, replies, delivered/read receipts, media manifests and voice manifests.
- Group history remains encrypted at rest through the existing `uiHistory` Vault layer.
- Shared group media: one encrypted media object/chunk set may serve multiple authorized member P2P routes without re-encrypting the file N times.
- Unified controller routes `peer` chats through Double Ratchet and `group:<groupId>` through the group layer.
- Browser UI for group creation, group roster/security info, add/remove member and role controls.

## Serverless onboarding

There is no central user, group or KeyPackage directory. A contact invite may carry an MLS KeyPackage. New-member Welcome data is sent over the already-established 1:1 E2E channel. Contact cards without a KeyPackage remain valid for direct messaging but cannot be added to a group until a fresh group-capable invite is exchanged.

## Important alpha boundaries

`alpha.6` intentionally does **not** claim that RFC 9420 cryptography is live in the default bundle. The OpenMLS/WASM backend is a required external production capability and was not compiled/bundled in this build. Unit/integration orchestration tests use a deterministic provider located only under `tests/`; it is not a security implementation and is excluded from runtime.

KeyPackage replenishment/one-time consumption still needs production lifecycle integration. Coordinator liveness is deterministic but automatic distributed lease/timeout detection is not yet implemented; callers can supply failed coordinators and retry with deterministic failover. Removed-member local UX/archive semantics, full MLS proposal queues, multi-device credentials and physical-device Waku/OpenMLS tests remain later hardening work.

## Release verification

See the release output for the fresh full test count, `build:www`, syntax/privacy audit, ZIP integrity and SHA-256. Do not infer production security certification from automated orchestration tests; independent MLS/backend security review remains required before a production claim.
