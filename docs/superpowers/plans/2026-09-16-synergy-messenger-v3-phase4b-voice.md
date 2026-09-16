# SYNERGY Messenger V3 Phase 4B Voice Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add encrypted resumable Opus-first voice messages and custom playback controls on top of Phase 4A Media.

**Architecture:** A browser-only recorder produces an audio Blob and compact waveform metadata. Voice is represented as an optional validated field on the existing E2E media manifest, so transfer, integrity, retry, TTL and encrypted storage are reused unchanged.

**Tech Stack:** Browser MediaRecorder/getUserMedia/Web Audio feature detection, existing WebCrypto/Double Ratchet/MediaManager, Node `node:test` with fakes.

**Spec:** `docs/superpowers/specs/2026-09-16-synergy-messenger-v3-phase4b-voice-design.md`

## Global Constraints

- No central server or cloud transcoder.
- Opus/WebM preferred but never assumed without feature detection.
- Microphone permission occurs only on explicit user action.
- Voice bytes travel only through encrypted Phase4A media transport.
- Existing text/media flows and all baseline tests must remain compatible.

---

### Task 1: Voice metadata and waveform contract
**Files:** Create `src/v3/voice/voice-waveform.js`; modify `src/v3/media/media-manifest.js`; test `tests/v3/voice/voice-contract.test.js`.
- [ ] Write failing tests for normalized waveform and voice manifest validation.
- [ ] Run them and confirm RED due to missing voice modules/validation.
- [ ] Implement minimal contract and rerun GREEN.

### Task 2: Browser recorder lifecycle
**Files:** Create `src/v3/voice/browser-voice-recorder.js`; test `tests/v3/voice/browser-voice-recorder.test.js`.
- [ ] Test MIME selection, recording, pause/resume duration, cancel cleanup, stop result and unsupported failure.
- [ ] Run RED.
- [ ] Implement MediaRecorder wrapper with injected browser dependencies and track cleanup.
- [ ] Run GREEN.

### Task 3: Messenger voice integration
**Files:** Modify `src/v3/media/media-manager.js`, `src/v3/ui/messenger-controller.js`; test `tests/v3/voice/messenger-voice.test.js`.
- [ ] Test outbound voice history/manifest and inbound voice classification.
- [ ] Run RED.
- [ ] Pass voice metadata through media prepare and controller send/receive paths.
- [ ] Run GREEN plus media regressions.

### Task 4: Browser runtime and UI
**Files:** Modify `js/v3-bootstrap.js`, `js/app.js`, `index.html`, `css/app.css`; test `tests/v3/voice/voice-app-regression.test.js`.
- [ ] Test recorder composition and presence of recording/playback controls with no Phase4B placeholder.
- [ ] Run RED.
- [ ] Wire recording controls, waveform, pause/resume/cancel/send, playback seek and speed.
- [ ] Run GREEN.

### Task 5: Release regression
**Files:** Modify `package.json`, `manifest.json`, `sw.js`, README/CAPACITOR docs.
- [ ] Bump to `3.0.0-alpha.5` and service-worker namespace.
- [ ] Run `npm run build:www`.
- [ ] Run complete `npm test` and syntax checks.
- [ ] Audit for central audio/upload endpoints and accidental microphone auto-start.
- [ ] Package verified tree and compute SHA-256.
