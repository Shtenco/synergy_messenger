# SYNERGY Messenger V3 — Phase 4B Voice

Version: **3.0.0-alpha.5**

Phase 4B adds private voice messages on top of the existing Phase 4A encrypted resumable Media Plane. It does **not** add a central audio server, cloud transcoder, speech API, or a second messaging transport.

## Recording

- microphone capture begins only after a direct tap on the microphone button
- preferred format is `audio/webm;codecs=opus` when `MediaRecorder.isTypeSupported()` reports it
- supported local fallbacks are selected only through runtime feature detection
- recording UI includes live level waveform, elapsed time, pause/resume, cancel, and send
- microphone tracks are stopped after send/cancel/error
- long recordings are capped by the UI around 15 minutes

## Encryption and transport

Voice bytes are ordinary Phase-4A media bytes:

`MediaRecorder Blob -> MediaManager -> per-chunk AES-GCM -> synergy-media-v1 WebRTC -> integrity verify -> local playback`

The voice manifest is sent through the existing Double Ratchet control plane. `durationMs`, waveform, codec, filename and the media key are therefore not plaintext transport metadata.

## Playback

Voice bubbles provide play/pause, seek, elapsed/total time and speed cycling `1x -> 1.5x -> 2x`. The player only receives data via `MessengerController.readMedia()`, after MediaManager authentication and final SHA-256 verification.

## Persistence / disappearing media

Voice messages reuse encrypted `uiHistory`, resumable transfer state, encrypted media chunks and the Phase-4A expiration purge path. A disappearing voice message removes its encrypted history record, media object, transfer state and ciphertext chunks.

## Alpha boundary

This is still an alpha security/product build. Physical Android testing must verify WebView codec support, microphone permissions, interruption behavior (calls/headsets/Bluetooth), background lifecycle and real cross-network WebRTC/Waku behavior before a production claim.

## Verification snapshot

Release gate for this archive:

- `npm run build:www`: PASS
- full automated suite: **154/154 PASS, 0 failures**
- runtime JavaScript syntax sweep: PASS
- source/Capacitor mirror hashes match for `js/app.js`, `index.html`, and `src/v3/voice/browser-voice-recorder.js`
- runtime voice privacy audit: no central audio/upload/transcription endpoint and no voice-module console logging
