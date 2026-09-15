# Синергия-Мессенджер — Android (Capacitor)

## Быстрый старт

```bash
cd synergy-messenger
npm install
npm run build:www
npx cap add android
npx cap sync android
npx cap open android
```

В Android Studio: Run на устройстве/эмуляторе.

## Package

- Application ID: `ai.sinergy.messenger`
- App name: Синергия-Мессенджер
- Min SDK: 22+ (Capacitor 6 default)
- Theme: dark `#020403`

## Плагины

- SplashScreen (зелёный/тёмный)
- StatusBar dark
- Haptics (можно добавить на отправку)
- Keyboard

## Подпись релиза

Используй тот же keystore, что и для Синергия-Финанс (SINERGY Persistent Release), либо создай новый:

```bash
keytool -genkey -v -keystore synergy-messenger.keystore -alias synergy -keyalg RSA -keysize 2048 -validity 10000
```

## Иконки

Уже лежат в `icons/`. После `cap sync` можно заменить в `android/app/src/main/res/`.

## Phase 4A — P2P Media

`alpha.4` добавляет отдельный `synergy-media-v1` WebRTC DataChannel для зашифрованных resumable-вложений. Обычный HTML file picker не требует широкого разрешения на всё хранилище Android. Для больших файлов production-версия должна перейти на native/OPFS streaming storage вместо удержания больших Blob в WebView.

## Phase 4B — Private Voice

`alpha.5` добавляет локальную запись голосовых сообщений через `MediaRecorder` и существующий encrypted `synergy-media-v1` transport. Микрофон запрашивается только после нажатия кнопки записи; облачного speech/transcoding сервиса нет.

После генерации Android-проекта проверь разрешение:

```xml
<uses-permission android:name="android.permission.RECORD_AUDIO" />
```

в `android/app/src/main/AndroidManifest.xml`. На Android runtime доступ к микрофону должен оставаться user-mediated. Phase 5 добавит отдельную native permission/Keystore/background hardening проверку на физических устройствах.

## Phase 4C — MLS Groups (alpha.6)

`alpha.6` добавляет децентрализованный group orchestration layer. Production runtime не включает тестовую group crypto: группы активируются только если приложению передан RFC 9420-capable backend через `globalThis.SYNERGY_OPENMLS_BACKEND`. Целевой backend — OpenMLS/WASM adapter, реализующий контракт `OpenMlsProvider`. При отсутствии или неполном backend 1:1/Media/Voice продолжают работать, а Groups fail-closed и недоступны.

Для serverless onboarding P2P Contact Card может содержать MLS KeyPackage. KeyPackage должен считаться расходуемым материалом: production Android-интеграция должна уметь генерировать/обновлять свежие KeyPackages при создании нового invite. Центральный KeyPackage directory не используется.

## Phase 5 — Android native hardening (alpha.8)

`alpha.8` добавляет проверяемый native-hardening overlay, но **не подменяет официальный Capacitor Android scaffold**. В этой среде npm registry не позволил скачать/сгенерировать `android/`, поэтому Gradle/APK/AAB здесь не собирались.

На машине с рабочим npm/Android SDK порядок такой:

```bash
npm install
npm run build:www
npx cap add android            # только один раз, если android/ ещё нет
npm run android:harden         # накладывает Keystore/intent/FGS/manifest hardening
npx cap sync android
# затем Android Studio или ./gradlew assembleDebug / bundleRelease
```

Для последующих обновлений после существующего `android/`:

```bash
npm run android:prepare
```

Hardening overlay включает:

- Android Keystore AES-256-GCM plugin `SynergySecurity` для fresh installs;
- сохранение legacy WebCrypto Vault на upgrade без молчаливой потери истории (`migrationRequired`);
- `SynergyAndroid` bridge для `synergy://contact`, `synergy://chat` и system share intents;
- share/deep-link **никогда не отправляет сообщение автоматически**;
- user-started `dataSync` foreground service с видимой нотификацией, `START_NOT_STICKY` и жёстким окном до 5 часов;
- `INTERNET`, `ACCESS_NETWORK_STATE`, `RECORD_AUDIO`, `POST_NOTIFICATIONS`, `FOREGROUND_SERVICE`, `FOREGROUND_SERVICE_DATA_SYNC`;
- `android.allowMixedContent = false`.

Android 14+ требует тип/permission foreground service; Android 15 ограничивает суммарное время `dataSync` FGS. Поэтому SYNERGY не заявляет бесконечную фоновую P2P-доставку: online-window запускается пользователем и является best-effort transport window.

Перед production-release обязательны реальный Gradle build, lint, physical-device tests (Android 12–15+), lock/unlock, process death, Bluetooth audio, notification permission, deep-links/share targets и проверка двух устройств в разных сетях.

## Phase 6 — final hardening (alpha.9)

`alpha.9` adds runtime ingress replay/rate guards, optional ciphertext-only replica providers and multi-device authorization primitives. These additions do not change the Phase 5 requirement: an official Capacitor Android scaffold and real Gradle/device verification are still required before APK/AAB release. Replica providers are injected capabilities; no central media endpoint is bundled.
