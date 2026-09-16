# SYNERGY Messenger V3 Phase-4C Groups / MLS Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [x]`) syntax for tracking.

**Goal:** Build decentralized MLS group orchestration on top of the existing P2P, encrypted media and voice layers.

**Architecture:** Separate RFC 9420 crypto behind `GroupCryptoProvider`; keep roles, deterministic commit coordination, storage and UI in application code. Production must fail closed without a real MLS provider; a deterministic provider exists only under tests.

**Tech Stack:** ES modules, WebCrypto/Vault, IndexedDB schema v5, existing SyncEngine/MediaManager/Voice stack, OpenMLS-compatible provider boundary.

**Spec:** `docs/superpowers/specs/2026-09-16-synergy-messenger-v3-phase4c-groups-mls-design.md`

## Global Constraints
- No central group/user/key server.
- No legacy sender-key fallback in production.
- All group application payloads must be opaque before transport.
- Existing 154 tests must remain green.
- Test provider must live only in `tests/`.

---

### Task 1: Group persistence and policy
**Files:** create `src/v3/groups/group-repository.js`, `group-policy.js`, `commit-coordinator.js`; modify `src/v3/storage/db.js`; tests under `tests/v3/groups/`.
- [x] Write schema/privacy/policy/coordinator failing tests.
- [x] Run tests and verify RED.
- [x] Implement sealed repositories and deterministic coordinator.
- [x] Run tests and verify GREEN.
- [x] Commit.

### Task 2: MLS provider boundary
**Files:** create `group-crypto-provider.js`, `openmls-provider.js`; test-only `tests/v3/groups/deterministic-mls-provider.js`.
- [x] Write contract tests for create/join/add/remove/encrypt/decrypt/export/import.
- [x] Verify RED.
- [x] Implement provider boundary and fail-closed OpenMLS adapter.
- [x] Verify GREEN with test provider; ensure test provider is excluded from runtime.
- [x] Commit.

### Task 3: Group transport and service
**Files:** create `group-payload.js`, `group-transport.js`, `group-service.js`.
- [x] Test create/join, app messaging, duplicate/out-of-order, epoch routing.
- [x] Verify RED.
- [x] Implement GroupService and opaque group packet routing.
- [x] Verify GREEN.
- [x] Commit.

### Task 4: Membership epochs and roles
- [x] Test add/remove, removed-member exclusion, authorization, coordinator failover.
- [x] Verify RED.
- [x] Implement proposal/commit orchestration and policy revision.
- [x] Verify GREEN.
- [x] Commit.

### Task 5: UI/controller integration
**Files:** modify `src/v3/ui/messenger-controller.js`, `js/app.js`, `index.html`; add `group-controller.js` if needed.
- [x] Test group list/chat/message/receipt/media/voice behavior.
- [x] Verify RED.
- [x] Implement UI bridge while preserving 1:1 flows.
- [x] Verify GREEN.
- [x] Commit.

### Task 6: Release gate
- [x] Bump DB/schema/runtime cache/package to `3.0.0-alpha.6`.
- [x] `npm run build:www`.
- [x] `npm test` with 0 failures.
- [x] JS syntax sweep and privacy/central-endpoint audit.
- [x] Build ZIP and SHA-256.
