# SYNERGY Messenger V3 — Phase 2 Crypto

Phase 2 adds the cryptographic identity/session layer on top of the Phase-1 local-first P2P core. The legacy v2.1 UI is still intentionally untouched; UI migration is Phase 3.

## Security status

This is **security alpha**, not an independently audited production cryptosystem and not a claim of full Signal/PQXDH compatibility. It follows the published X3DH/Double Ratchet structure using browser-native Web Crypto primitives, but it still requires external review before production security claims.

Implemented primitives:

- Ed25519 identity signatures;
- X25519 identity/prekey/ratchet DH;
- HKDF-SHA-256 root derivation;
- HMAC-SHA-256 chain derivation;
- AES-256-GCM message and local-vault encryption;
- fail-closed behavior when Ed25519/X25519 is unavailable.

No algorithm downgrade is implemented.

## Device identity

Each installation creates one device-local identity with:

- random `deviceId`;
- device-specific `syn3:` mailbox;
- Ed25519 signing key pair;
- X25519 identity-DH key pair;
- `SYN3-....` fingerprint.

Private keys are generated with `extractable=false`. Public keys are raw 32-byte values and may be shared inside public identity/prekey bundles.

The trust layer uses TOFU: the first seen fingerprint for a device is pinned. A later fingerprint change raises `IDENTITY_CHANGED` until application/UI code explicitly re-trusts that peer.

## Prekeys and first message

A public bundle contains:

- public device identity;
- signed X25519 prekey;
- optional X25519 one-time prekeys.

The signed prekey is Ed25519-authenticated and bundles past their signed-prekey expiry are rejected for new outbound sessions.

The first encrypted message is one self-contained `prekey` envelope. It carries the public authenticated handshake material plus a Double Ratchet ciphertext, so Waku/WebRTC delivery order does not depend on a separate handshake packet arriving first.

While the initiator has not yet received an authenticated reply, subsequent outbound messages repeat the same public prekey initiation and carry the next ratchet ciphertext. This allows an offline recipient to receive `n=1` before `n=0`, derive the session from `n=1`, retain the skipped key for `n=0`, and decrypt the older packet later.

After the first authenticated peer response, outbound envelopes switch to compact `ratchet` form.

## X3DH-style handshake

With a one-time prekey:

1. local identity-DH × remote signed prekey;
2. local ephemeral × remote identity-DH;
3. local ephemeral × remote signed prekey;
4. local ephemeral × remote one-time prekey.

Without a one-time prekey, the first three DH outputs are used.

The concatenated DH values are expanded with HKDF-SHA-256 under the versioned application context `SYNERGY-X3DH-V1`.

The initiator signs the handshake transcript with Ed25519. The responder validates the public identity metadata and signature before accepting the shared secret.

One-time prekeys are marked consumed only after the initial ciphertext authenticates and decrypts successfully.

### Decentralized one-time-prekey limitation

A central atomic prekey server is intentionally absent. Therefore a public bundle copied to multiple initiators cannot guarantee server-style atomic one-time-prekey reservation. Reuse is prevented on the receiving device after first successful consumption, but a stale copied bundle can cause another initiator to attempt an already-consumed key. Phase 3/4 should add live peer-to-peer prekey reservation/refresh for stronger delivery guarantees while retaining the 3-DH fallback for offline bootstrap.

## Double Ratchet

Implemented behavior includes:

- separate sending and receiving chains;
- DH ratchet on new remote ratchet key;
- per-message chain-key advancement;
- authenticated header binding through AEAD associated data;
- skipped-message keys for out-of-order delivery;
- `MAX_SKIP = 256`;
- skipped keys removed after one successful use;
- receive-state changes committed only after AES-GCM authentication succeeds.

A forged/tampered message therefore does not advance the stored receiving ratchet.

## Simultaneous first messages

If both devices initiate before seeing the other side's message, both independently authenticated sessions are retained. For follow-up outbound traffic, `SessionRepository.findByPeer()` prefers a **responder** session when one exists. This lets each side send on a session that the remote side definitely initiated, avoiding an endless repeated-prekey mode without discarding either user's first message.

Full multi-device/session arbitration (Sesame-style) remains outside Phase 2.

## Persistence

IndexedDB schema is now version 2 and adds:

- `cryptoKeys`;
- `identities`;
- `prekeys`;
- `cryptoSessions`;
- `trust`.

A non-extractable AES-GCM vault key is stored as a structured-clone `CryptoKey` handle. Symmetric ratchet material (`rootKey`, sending/receiving chain keys and skipped message keys) is serialized only inside an AES-GCM `sealedState` blob.

The current ratchet X25519 private key is also non-extractable and stored as a CryptoKey handle. Android hardware-backed Keystore integration is reserved for Phase 5.

## SecureMessengerCore

`SecureMessengerCore` is the plaintext-facing facade.

Outbound:

```text
sendText(text)
  -> UTF-8 bytes
  -> CryptoEngine.encryptForPeer()
  -> encrypted prekey/ratchet envelope
  -> SynergyPacket.body
  -> durable Phase-1 outbox
  -> WebRTC / Waku
```

Inbound:

```text
WebRTC / Waku
  -> SynergyPacket.body
  -> CryptoEngine.decryptEnvelope()
  -> authenticated UTF-8 text
  -> onMessage()
```

Phase-1 message/outbox/inbox storage sees encrypted envelope bytes, not application plaintext.

Text payloads above 128 KiB are rejected before ratchet state advances, leaving large media/files to the future chunked encrypted media subsystem.

## Restart and offline behavior

Ratchet sessions persist across a simulated restart and continue interoperating with the remote session. Phase-1 durable outbox continues to retry the already-encrypted packet rather than re-encrypting plaintext on every network retry.

## Test coverage in this phase

The automated suite covers:

- non-extractable Ed25519/X25519 keys;
- fail-closed unsupported algorithms;
- Ed25519 tamper rejection;
- X25519 shared-secret agreement;
- HKDF context separation;
- AES-GCM tamper/AAD rejection;
- identity stability and device-specific mailbox/fingerprint derivation;
- signed-prekey verification and expiry;
- one-time-prekey consumption semantics;
- TOFU identity-change rejection;
- 3-DH and 4-DH handshake agreement;
- authenticated handshake tamper rejection;
- multi-turn Double Ratchet;
- out-of-order delivery and skipped-key single use;
- AEAD-failure state rollback;
- `MAX_SKIP` enforcement;
- vault-encrypted ratchet persistence;
- engine restart continuation;
- repeated prekey envelopes for offline reordering;
- simultaneous first-message sessions;
- plaintext absence from Phase-1 packet/transport storage;
- text-size rejection before crypto-state advancement;
- all existing Phase-1 P2P regression tests.

## Remaining security work

Before a production security claim, the project still needs at minimum:

1. independent cryptographic review/audit;
2. Android Keystore-backed root/device secrets;
3. dedicated P2P prekey refresh/reservation;
4. explicit session-reset/recovery UX;
5. multi-device session management;
6. encrypted local user-message history rather than only encrypted transport packets;
7. groups/media cryptography;
8. real two-device Android/WebView/Waku interoperability testing;
9. eventually a post-quantum handshake/ratchet strategy if required by the product security target.
