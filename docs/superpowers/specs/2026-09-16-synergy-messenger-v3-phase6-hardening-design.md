# SYNERGY Messenger V3 Phase 6 — Replicas, Multi-device and Security Hardening

## Goal

Finish the alpha architecture with three independent hardening layers without introducing a mandatory central server:

1. encrypted media replicas that store ciphertext only;
2. multi-device authorization through signed device certificates and revocation;
3. bounded abuse/replay/quota controls around existing P2P/MLS/media paths.

## 6A — Encrypted replicas

Direct WebRTC remains first choice. Replicas are an optional availability fallback and never receive `mediaKey`, filename, MIME, plaintext hash, chat identity or decrypted bytes.

A replica capability contains a random 256-bit opaque `accessToken`, `mediaId`, expiry and byte/chunk limits. Remote object identifiers are keyed hashes over the opaque token and chunk index, not predictable chat identifiers. Each stored record contains only IV, ciphertext, plaintextLength, encrypted-byte hash and expiry.

`ReplicaCoordinator` may fan encrypted chunks to N replaceable providers and require a configurable write quorum. Reads accept data only after ciphertext hash verification and then still pass through the existing MediaManager AEAD + final plaintext SHA-256 verification. Replica failure never blocks normal direct P2P operation.

Production network providers are injected; only an in-memory provider exists in tests. No implicit IPFS/HTTP/CDN endpoint is shipped.

## 6B — Multi-device

Every installation keeps its existing device identity. A new Account Root signing key authorizes device identities through signed `DeviceCertificate` records. The root private key is non-extractable and is never copied to a newly linked device.

A second device generates its own device identity and a random one-time pairing request. An already-authorized root device verifies the request and signs a certificate containing `accountId`, `deviceId`, device signing key/fingerprint, issue/expiry times and monotonic generation. The new device receives only the certificate and public account root.

Revocation is a root-signed monotonic record. A revoked certificate cannot be reintroduced with an older generation. Contacts can pin an account root and maintain the authorized device set beneath it.

`MultiDeviceDirectory` stores account metadata, device certificates and revocations under Vault sealing. A `FanoutMessenger` resolves all active recipient devices and encrypts the same logical message independently for each existing pairwise device session. One logical application `messageId` is retained for dedupe; per-device transport IDs are distinct.

This phase does not claim automatic account recovery if every authorized root-holding device is lost. Recovery is deliberately outside the alpha security boundary.

## 6C — Security hardening

Add bounded controls:

- token-bucket inbound rate limiting per peer/mailbox;
- replay ledger with retention window and bounded row count;
- bounded future-epoch MLS pending buffers;
- media/replica byte and object quotas;
- periodic cleanup for expired inbox/outbox/media/replica/security records;
- security diagnostics exposing counts/states but never plaintext, keys or payment details.

All limit violations fail closed with stable error codes. No control is allowed to downgrade E2E crypto or silently bypass identity checks.

## Database schema v7

Add sealed stores:

- `accountRoots`
- `deviceCertificates`
- `deviceRevocations`
- `replicaCapabilities`
- `securityReplay`

Raw IndexedDB rows must not expose root/device private material, replica access tokens or certificate policy payloads.

## Runtime rules

- no mandatory central endpoint;
- no bundled test replica/network backend;
- no export of account-root private key;
- replica providers and multi-device transport are replaceable injected capabilities;
- browser/PWA and Android without these optional capabilities continue to run existing 1:1/Media/Voice/Groups/Finance.

## Definition of Done

Tests must cover ciphertext-only replicas, corrupted replica rejection, expiry/quota, direct-to-replica fallback, root/device certificate verification, add/revoke/replay, fanout to two devices, revoked-device exclusion, restart persistence, rate limits, bounded replay cleanup, bounded future MLS buffers and all prior regression tests.
