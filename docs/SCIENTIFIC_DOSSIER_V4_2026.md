# SYNERGY MESSENGER / PRIVATE COMMUNICATION

## Исследовательский замысел

**Local-first P2P, Double Ratchet, MLS groups, media and Finance Bridge.** Repository README and package manifest describe a 3.0.0-alpha.9 design: WebRTC primary connectivity, decentralized fallback, authenticated one-to-one sessions, secure media chunks, multi-device identity and non-custodial payment intents. RELEASE-MANIFEST reports 249/249 historical tests, but the inspected main tree presents a compact publication shell rather than all claimed runtime modules as separately visible source files.

## Техническая модель и доказательная основа

A secure messaging system requires confidentiality, integrity, forward secrecy, post-compromise recovery, replay resistance and proper device revocation. The protocol's receipt of a finance intent must never authorize payment without explicit wallet confirmation.

## Оригинальные возможности и научный потенциал

Ключевая ценность этого проекта — предметная специализация внутри федерации: он не подменяет авторизацию, бухгалтерию и соседние сервисы. Это позволяет независимо совершенствовать алгоритм, собирать воспроизводимые артефакты и развивать пользовательскую/исследовательскую практику при сохранении формальных границ.

## Последовательность сильного исследования

Reconstruct and verify the complete versioned alpha source from its declared release artifact; validate SHA256SUMS, test ratchet/MLS vectors and device-revocation state, packet loss, offline recovery and Android signed binaries on multiple physical devices.

## Источники и проверяемость

- [package.json](../package.json)
- [RELEASE-MANIFEST.json](../RELEASE-MANIFEST.json)
- [CAPACITOR-ANDROID.md](../CAPACITOR-ANDROID.md)
- [README.md](../README.md)

Научный материал основан на изученных исходниках и manifest, не утверждает нового запуска, benchmark или реальных финансовых результатов. Полный предыдущий README сохраняется.
