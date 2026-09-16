# SYNERGY Messenger V3 Phase 4B Voice Design

**Goal:** Add private voice messages without creating a new network/storage path: browser recording feeds the existing encrypted resumable Media Plane and Double Ratchet control plane.

## Architecture

`getUserMedia` -> `BrowserVoiceRecorder` -> Blob + `{durationMs,waveform,codec}` -> `MessengerController.sendVoice()` -> `MediaManager.prepare(...voice)` -> E2E media manifest -> dedicated `synergy-media-v1` ciphertext chunks.

Incoming manifests with `manifest.voice` are rendered as voice messages. Playback reads only verified local plaintext from `MediaManager.readBlob()` after the encrypted transfer reaches ready.

## Security and privacy

- Microphone is requested only after a direct user gesture.
- Tracks are stopped on send, cancel, recorder error, and app teardown.
- No cloud speech API, transcoder, upload endpoint, or analytics dependency.
- Voice metadata is inside the ratcheted media manifest and encrypted history.
- Ciphertext media cache and disappearing-message purge behavior are inherited from Phase 4A.
- Unsupported recording formats fail closed; runtime feature detection chooses an actually supported local container/codec.

## Format selection

Preference order: `audio/webm;codecs=opus`, `audio/ogg;codecs=opus`, then `audio/mp4` only when the user agent explicitly reports support. The selected actual MIME is stored in the manifest. `codec` is descriptive metadata, never trusted instead of MIME/type validation.

## Voice metadata

`manifest.voice = { version:1, durationMs, waveform, codec }` where waveform is 32 normalized integer peaks in `[0,100]`; accepted range is 8..64 samples for forwards compatibility. Maximum recorded duration is 15 minutes.

## UX

Composer: tap microphone to start; recording strip shows duration and live waveform; pause/resume, cancel, and send are explicit. Voice bubbles provide play/pause, seek, duration/current time, and speed cycle `1x -> 1.5x -> 2x -> 1x`.

## Definition of Done

- recorder codec selection and fail-closed unsupported behavior
- pause/resume duration excludes paused time
- cancel never sends and always stops tracks
- stop returns Blob + normalized waveform metadata
- voice manifest validates and remains E2E encrypted
- controller sends/receives voice using existing MediaManager
- restart-safe history and Phase4A resume remain intact
- playback seek/speed UI is wired to verified local Blob
- all previous 139 tests remain green
