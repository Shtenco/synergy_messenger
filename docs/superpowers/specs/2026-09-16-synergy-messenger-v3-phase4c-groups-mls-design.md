# SYNERGY Messenger V3 Phase-4C Groups / MLS Design

## Goal
Add decentralized E2E groups without a central group database: membership epochs, add/remove, role policy, encrypted receipts, group text/media/voice, and deterministic commit coordination.

## Security boundary
- Group cryptography is provided only through `GroupCryptoProvider`.
- Production runtime MUST use an RFC 9420-capable provider (OpenMLS/WASM target). No fallback to legacy sender-key or shared-key crypto.
- Test-only deterministic provider may exercise orchestration but MUST NOT be bundled by `build:www`.
- Group state, member roster, policy, titles and epoch routing data are sealed at rest with the existing Vault except for routing-minimum opaque identifiers.
- Removed members must not receive future epoch secrets/mailboxes.

## Architecture
`GroupService` owns application policy and orchestration. `GroupCryptoProvider` owns MLS create/join/proposal/commit/encrypt/decrypt/export/import. `GroupRepository` persists sealed group records. `GroupTransport` sends opaque group packets over the existing P2P core. A deterministic epoch coordinator elects one admin device to serialize membership commits in a serverless environment.

## Runtime behavior
- Create: owner creates MLS group, adds initial member KeyPackages, publishes Welcome messages pairwise and group Commit on epoch mailbox.
- Join: invitee processes Welcome, persists local group state, subscribes to epoch mailbox.
- Membership changes: admins issue signed app proposals; epoch coordinator creates/merges MLS Commit and rotates mailbox.
- Application messages: text/receipt/media manifests/voice manifests are encoded as group application payload and encrypted by MLS provider.
- Media bytes continue to use Phase-4A direct encrypted media plane; only media manifests/keys travel inside MLS.
- Policy roles: owner/admin/member; membership-changing and role-changing actions require policy authorization before invoking provider.

## Epoch ordering
MLS handshake messages require strict per-group ordering. SYNERGY uses `epoch + commitSeq` and deterministic coordinator. Non-coordinator admins submit proposals to the coordinator. Failover advances to next sorted admin after lease timeout; tie-break is deterministic hash of groupId/epoch/adminDeviceId.

## Storage schema v5
Adds `groups`, `groupEpochStates`, `groupMembers`, `groupPolicies`, `groupInvites`. Sensitive records are sealed with Vault. Raw rows expose only opaque keys, epoch number, sealed bytes and timestamps.

## Definition of Done
Create/join/restart; text to 3 members; outsider rejection; add member; remove member; old/new epoch isolation; roles; coordinator determinism/failover; duplicate/out-of-order application messages; receipt/reply; disappearing messages; group media and voice manifest transport; DB privacy; no central group endpoint; old 154 tests remain green.

## Alpha.6 implementation boundary
The application implements the MLS provider boundary and all surrounding group orchestration but does not bundle an OpenMLS/WASM backend in this release. Runtime groups therefore fail closed unless `SYNERGY_OPENMLS_BACKEND` supplies the complete provider contract. The deterministic provider under `tests/` is test-only.

The implemented serverless commit strategy serializes membership commits through the deterministic epoch coordinator. Non-coordinator membership operations are rejected with `GROUP_NOT_COMMIT_COORDINATOR`; deterministic failover is available when callers mark coordinators failed. Automatic distributed lease/timeout detection and proposal forwarding are deferred to later hardening rather than being simulated in alpha.6.

Future-epoch commits and application messages are buffered locally so Waku Store reordering (`application(E+1)` before `commit(E+1)`) does not lose the application message.
