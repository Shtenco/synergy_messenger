# Android Native Hardening Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add Android Keystore sealing, intent/deep-link/share integration and a policy-compliant user-started foreground online window.

**Architecture:** Browser interfaces remain dependency-injected. On Android, Capacitor native plugins provide Keystore seal/open and lifecycle/intent services. A generated Android scaffold receives a deterministic overlay.

**Tech Stack:** Capacitor 6, Java, Android Keystore AES-GCM, IndexedDB/WebCrypto fallback, node:test.

**Spec:** `docs/superpowers/specs/2026-09-16-synergy-messenger-v3-phase5-android-hardening-design.md`

## Global Constraints
- No hand-built fake Capacitor scaffold.
- No private-key export/generic signing API.
- No mixed content.
- No hidden background service start.
- No wakelock or microphone access from the foreground service.
- Browser/PWA fallback must remain supported.

### Task 1: Native vault adapter
- [ ] Write RED tests for seal/open and invalid plugin.
- [ ] Implement `NativeSecurityVault` and runtime selection.
- [ ] Verify GREEN.

### Task 2: Android intent/runtime bridge
- [ ] Write RED tests for launch/deep-link/share and online-window calls.
- [ ] Implement browser wrapper and UI hooks.
- [ ] Verify GREEN.

### Task 3: Native overlay
- [ ] Write static RED tests for manifest/plugin/service/apply-script invariants.
- [ ] Implement Java plugins/service and idempotent overlay script.
- [ ] Verify GREEN.

### Task 4: Release hardening
- [ ] Disable mixed content.
- [ ] Update release metadata/cache/docs.
- [ ] build:www, full tests, syntax/audit, package.
