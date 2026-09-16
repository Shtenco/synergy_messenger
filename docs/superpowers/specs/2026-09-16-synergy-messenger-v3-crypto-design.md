# SYNERGY Messenger V3 Crypto Design

## Status
Approved architecture extension for Phase 2. This phase builds cryptographic identity, asynchronous session establishment, Double Ratchet message encryption, encrypted session persistence, fingerprints, and a secure facade over the Phase-1 P2P core. It does not alter the v2.1 UI.

## Security boundary

Phase 2 is a **security alpha**. It uses browser-native Web Crypto primitives and follows the published X3DH/Double Ratchet structure, but it is not claimed to be Signal-compatible, Signal-certified, independently audited, or post-quantum secure.

No application plaintext may be passed to Phase-1 transport. The only Phase-1 `packet.body` values created by the secure facade are encoded cryptographic envelopes.

## Algorithms

- Identity signature: Ed25519.
- Identity DH and ratchet DH: X25519.
- Root/chain KDF: HKDF-SHA-256 and HMAC-SHA-256.
- Message AEAD and local vault: AES-256-GCM with fresh 96-bit nonces.
- Fingerprints/mailboxes: SHA-256 over versioned public identity material, Base64URL encoded.
- Private asymmetric keys: non-extractable `CryptoKey` objects.

If Ed25519 or X25519 is unavailable, initialization fails closed with `CRYPTO_ALGORITHM_UNAVAILABLE`; Phase 2 does not silently downgrade algorithms.

## Identity

Each installation/device owns one local identity record:

- random `deviceId`;
- non-extractable Ed25519 signing private key;
- public Ed25519 signing key;
- non-extractable X25519 identity-DH private key;
- public X25519 identity-DH key;
- derived mailbox;
- human-verifiable fingerprint.

Public keys are exportable raw bytes. Private key material is never exported by production code.

## Prekeys

Each identity maintains:

- one current X25519 signed prekey with id, createdAt, expiresAt;
- an Ed25519 signature over the signed-prekey transcript;
- a pool of X25519 one-time prekeys.

A public `PreKeyBundle` contains identity public keys, the signed prekey and selected one-time public prekeys. A receiver verifies the signed-prekey signature before using the bundle.

One-time prekeys are marked consumed only after an authenticated initial message decrypts successfully.

## Asynchronous handshake

The initial encrypted message is a `prekey` envelope so it is self-contained and does not depend on network ordering.

Initiator X3DH-style secret:

- DH1 = initiator identity-DH × recipient signed prekey;
- DH2 = initiator ephemeral × recipient identity-DH;
- DH3 = initiator ephemeral × recipient signed prekey;
- DH4 = initiator ephemeral × recipient one-time prekey when present.

The concatenated DH outputs are fed through HKDF-SHA-256 using a versioned application info string.

The prekey envelope carries only public identity material, ids, public ephemeral/ratchet keys, signatures, counters, nonces, and ciphertext. It contains no private key or application plaintext. Until the initiator receives an authenticated peer response, the same public initiation is repeated with each new ratchet ciphertext so offline Store delivery may arrive out of order without a missing-session failure.

## Double Ratchet

After the initial shared secret is established:

- each sent message advances the sending chain;
- each received message advances the receiving chain;
- a newly observed remote ratchet public key triggers a DH ratchet step;
- old message keys are not retained after successful use;
- skipped keys are bounded by `MAX_SKIP=256` and removed after use;
- associated data authenticates session id, sender/recipient device ids and ratchet header.

The implementation exposes no API that returns message keys.

## Session persistence

The existing IndexedDB schema is upgraded to v2 with stores:

- `cryptoKeys` — non-extractable local vault key and other device key handles;
- `identities` — local identity metadata plus CryptoKey handles;
- `prekeys` — signed/one-time prekey metadata plus CryptoKey handles;
- `cryptoSessions` — encrypted symmetric ratchet state plus non-extractable ratchet DH private CryptoKey;
- `trust` — TOFU/verified peer fingerprint records.

Root keys, chain keys and skipped message keys are serialized then encrypted under a non-extractable AES-GCM vault key before persistence.

## Trust model

Contacts use trust-on-first-use by default:

- first public identity is pinned to `peerDeviceId`;
- a changed fingerprint causes `IDENTITY_CHANGED` and message encryption/decryption fails closed until explicitly re-trusted;
- callers may mark a fingerprint `verified` after QR/manual comparison.

## Secure P2P facade

`SecureMessengerCore` wraps the Phase-1 `SyncEngine`.

Outbound flow:

`plaintext -> CryptoEngine.encrypt -> opaque SynergyPacket -> SyncEngine.enqueue`

Inbound flow:

`SyncEngine.onPacket -> CryptoEngine.decrypt -> SecureMessengerCore.onMessage`

The facade never emits ciphertext as a user message and never passes plaintext into `SyncEngine` or transport. Text is capped at 128 KiB and rejected before cryptographic state advances. If both devices initiate simultaneously, both sessions may coexist and outbound selection prefers a responder session until a future Sesame-style session manager replaces this Phase-2 policy.

## Out of scope for Phase 2

- UI wiring and migration of v2.1 demo chats;
- groups/MLS/sender keys;
- attachments/media encryption;
- Android hardware-backed Keystore integration;
- cloud/seed backup and account recovery;
- post-quantum handshake/ratchet;
- independent cryptographic audit.
