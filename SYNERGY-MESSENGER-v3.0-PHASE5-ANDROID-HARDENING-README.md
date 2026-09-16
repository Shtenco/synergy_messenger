# SYNERGY Messenger v3.0.0-alpha.8 — Phase 5 Android Native Hardening

Phase 5 добавляет нативную защитную оболочку для Android поверх serverless P2P Messenger. Это **hardening overlay**, а не вручную сфабрикованный Capacitor scaffold.

## Security boundary

- `android.allowMixedContent=false`.
- Fresh Android installs используют injected `SynergySecurity` / Android Keystore AES-256-GCM Vault.
- Existing installs с `vault-v1` остаются на читаемом legacy WebCrypto Vault до явной миграции; runtime выставляет `migrationRequired=true` вместо потери данных.
- Native plugin не предоставляет generic `getPrivateKey`, `exportPrivateKey`, `signTransaction` или raw signing API.
- Deep links и system share только заполняют invite/composer; auto-send отсутствует.
- Foreground P2P window запускается пользователем, видимо через notification, `START_NOT_STICKY`, без wakelock и максимум на 5 часов.

## Native overlay

Исходники находятся в `native/android/`, а `scripts/apply-android-hardening.mjs` накладывает их только на настоящий `android/` от Capacitor. Если scaffold отсутствует, скрипт fail-closed с `ANDROID_PROJECT_REQUIRED`.

## Build limitation of this artifact

В текущем окружении `npm install` не смог получить зависимости из registry, поэтому официальный `npx cap add android`, Gradle build, APK/AAB и physical-device tests **не выполнялись**. Runtime/overlay проверяются Node/static regression tests; production Android status требует отдельной сборочной машины с Android SDK.
