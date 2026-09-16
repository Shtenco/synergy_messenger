# Phase 6 Hardening Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add decentralized encrypted replicas, signed multi-device authorization, and bounded abuse/replay controls without introducing a central server.

**Architecture:** Media replicas operate only on already-encrypted Phase4A chunks. Multi-device uses a non-extractable account-root signing key that certifies independent device identities; messages fan out over existing per-device E2E sessions. Security guards wrap existing ingress and persistence paths and fail closed.

**Tech Stack:** JavaScript ES modules, WebCrypto Ed25519/HMAC/SHA-256, IndexedDB, existing Vault/MediaManager/Double Ratchet/MLS layers, node:test.

**Spec:** `docs/superpowers/specs/2026-09-16-synergy-messenger-v3-phase6-hardening-design.md`

## Global Constraints

- No mandatory central server or hidden CDN.
- Replica providers never receive mediaKey/plaintext metadata.
- Account-root private key is non-extractable and never transferred to linked devices.
- Revocation is monotonic and fail-closed.
- Existing Phase1–5 behavior must remain backward compatible.

---

### Task 1: Replica protocol and coordinator
- [ ] Write failing tests for ciphertext-only publish/read, quorum, expiry, quota and corruption.
- [ ] Implement provider contract, in-memory test provider, sealed capability repository and coordinator.
- [ ] Integrate optional replica publish/fallback into MediaManager.
- [ ] Run media + replica tests.

### Task 2: Account root and device certificates
- [ ] Write failing tests for root creation, signed certificate verification and non-extractable root key.
- [ ] Implement account-root manager and canonical certificate signatures.
- [ ] Add root-signed monotonic revocation.
- [ ] Persist sealed account/device state in schema v7.

### Task 3: Multi-device directory and fanout
- [ ] Write failing tests for two active devices, revoked exclusion and duplicate logical message IDs.
- [ ] Implement directory queries and fanout adapter over existing secure core factory.
- [ ] Add encrypted-at-rest device metadata tests.

### Task 4: Security guards
- [ ] Write failing token-bucket/replay/quota/cleanup tests.
- [ ] Implement rate limiter, replay guard, maintenance service and diagnostics.
- [ ] Bound future MLS buffers.

### Task 5: Runtime/settings/release
- [ ] Expose optional capabilities and security diagnostics without leaking secrets.
- [ ] Upgrade DB schema to v7 and release metadata to alpha.9.
- [ ] Build `www`, run full tests, syntax/privacy/source-mirror audits and package verified ZIP.
