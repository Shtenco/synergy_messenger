# SYNERGY Messenger V3 Crypto Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add device identity, prekeys, asynchronous encrypted session establishment, Double Ratchet message encryption, protected session persistence, trust fingerprints, and a secure facade over the existing Phase-1 P2P core.

**Architecture:** Browser-native Web Crypto supplies Ed25519, X25519, SHA-256, HKDF/HMAC-SHA-256 and AES-256-GCM. Crypto state is isolated under `src/v3/crypto/`; symmetric session state is vault-encrypted before IndexedDB persistence, while private asymmetric CryptoKeys remain non-extractable structured-clone handles. `SecureMessengerCore` is the only plaintext-facing integration surface.

**Tech Stack:** JavaScript ES modules, Web Crypto API, IndexedDB, Node `node:test` for deterministic TDD.

**Spec:** `docs/superpowers/specs/2026-09-16-synergy-messenger-v3-crypto-design.md`

## Global Constraints

- No central SYNERGY server is introduced.
- No plaintext may enter Phase-1 packet/transport code.
- Private asymmetric keys are generated non-extractable.
- No algorithm downgrade: Ed25519/X25519 absence fails closed.
- `MAX_SKIP=256`.
- Existing v2.1 UI source remains byte-identical.
- Phase 2 is security alpha, not independently audited or post-quantum secure.

---

### Task 1: Crypto bytes and WebCrypto provider
**Files:** create `src/v3/crypto/bytes.js`, `src/v3/crypto/webcrypto-provider.js`; test `tests/v3/crypto/webcrypto-provider.test.js`.
**Produces:** Base64URL/canonical byte helpers and a provider for key generation, signing, verification, X25519 DH, HKDF/HMAC, SHA-256 and AES-GCM.
- [ ] Write provider tests first, including non-extractable private keys, signature verify/fail, symmetric DH, HKDF determinism, and AEAD tamper rejection.
- [ ] Run targeted test and confirm RED because modules are missing.
- [ ] Implement the minimal provider.
- [ ] Run targeted test to GREEN.

### Task 2: IndexedDB v2 crypto stores and vault
**Files:** modify `src/v3/storage/db.js`, `tests/v3/helpers/memory-db.js`; create `src/v3/crypto/storage/key-repository.js`, `src/v3/crypto/storage/vault.js`; test `tests/v3/crypto/vault.test.js`.
**Produces:** DB v2 stores plus `KeyRepository` and `Vault` that protects raw symmetric state.
- [ ] Write failing persistence/encryption tests.
- [ ] Verify RED.
- [ ] Upgrade schema and implement vault.
- [ ] Verify GREEN and Phase-1 regression.

### Task 3: Identity, fingerprint, trust and prekeys
**Files:** create `src/v3/crypto/identity/identity-manager.js`, `src/v3/crypto/identity/trust-store.js`, `src/v3/crypto/prekeys/prekey-manager.js`; test `tests/v3/crypto/identity-prekeys.test.js`.
**Produces:** `IdentityManager.ensureIdentity()`, `PreKeyManager.ensureBundle()`, signed-prekey verification, one-time-prekey consumption, TOFU pinning/identity-change detection.
- [ ] Write failing behavior tests.
- [ ] Verify RED.
- [ ] Implement minimal identity/prekey/trust code.
- [ ] Verify GREEN.

### Task 4: X3DH-style initial secret and authenticated prekey transcript
**Files:** create `src/v3/crypto/handshake/x3dh.js`; test `tests/v3/crypto/x3dh.test.js`.
**Produces:** initiator/responder shared-secret derivation and signed transcript verification.
- [ ] Write test proving both sides derive identical 32-byte secret and tampering/signature mismatch fails.
- [ ] Verify RED.
- [ ] Implement four-DH/three-DH HKDF derivation.
- [ ] Verify GREEN.

### Task 5: Double Ratchet state machine
**Files:** create `src/v3/crypto/ratchet/double-ratchet.js`; test `tests/v3/crypto/double-ratchet.test.js`.
**Produces:** initiator/responder initialization, encrypt/decrypt, DH ratchet, bounded skipped keys and AEAD AD binding.
- [ ] Write Alice/Bob conversation tests, out-of-order tests, tamper tests and skip-limit test.
- [ ] Verify RED.
- [ ] Implement minimal ratchet from the approved spec.
- [ ] Verify GREEN.

### Task 6: Vault-encrypted session repository
**Files:** create `src/v3/crypto/storage/session-repository.js`; test `tests/v3/crypto/session-repository.test.js`.
**Produces:** save/load/delete of ratchet sessions with encrypted symmetric state and non-extractable DH private CryptoKey handle.
- [ ] Write test proving persisted rows do not contain serialized root/chain key plaintext and reopen restores working session.
- [ ] Verify RED.
- [ ] Implement repository.
- [ ] Verify GREEN.

### Task 7: CryptoEngine prekey + ratchet envelopes
**Files:** create `src/v3/crypto/crypto-engine.js`, `src/v3/crypto/envelope.js`; test `tests/v3/crypto/crypto-engine.test.js`.
**Produces:** `encryptForPeer()`, `decryptEnvelope()`, prekey-first-message handling, subsequent ratchet messages, trust enforcement and session persistence.
- [ ] Write two-device end-to-end crypto tests before code.
- [ ] Verify RED.
- [ ] Implement envelope/engine.
- [ ] Verify GREEN.

### Task 8: SecureMessengerCore integration
**Files:** create `src/v3/secure-messenger-core.js`; modify `src/v3/index.js`; test `tests/v3/integration/secure-messenger-core.test.js`.
**Produces:** plaintext-facing `sendText(peerBundle,text)` and `onMessage(handler)` facade whose underlying Phase-1 packet body is always ciphertext envelope bytes.
- [ ] Write failing integration test that captures transport packet and asserts plaintext bytes/string are absent.
- [ ] Verify RED.
- [ ] Implement secure facade and exports.
- [ ] Verify GREEN.

### Task 9: Documentation, build regression and full verification
**Files:** create `docs/V3-CRYPTO.md`; modify `package.json` version to `3.0.0-alpha.2`; update `tests/v3/build-regression.test.js` only if needed.
- [ ] Run complete `npm test`.
- [ ] Run `npm run build:www` and rerun complete tests.
- [ ] Verify legacy `js/app.js` SHA-256 unchanged.
- [ ] Scan `src/v3` for private-key export calls, hardcoded secrets, plaintext logging and central endpoints.
- [ ] Package verified tree as `SYNERGY-MESSENGER-v3.0-PHASE2-CRYPTO.zip` and compute SHA-256.
