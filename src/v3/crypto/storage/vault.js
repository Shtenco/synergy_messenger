export class Vault {
  constructor({ keyRepository, provider, keyId = 'vault-v1' }) {
    if (!keyRepository || !provider) throw new Error('VAULT_DEPENDENCY_REQUIRED');
    this.keyRepository = keyRepository;
    this.provider = provider;
    this.keyId = keyId;
    this.cachedKey = null;
  }

  async ensureKey() {
    if (this.cachedKey) return this.cachedKey;
    const existing = await this.keyRepository.get(this.keyId);
    if (existing?.key) { this.cachedKey = existing.key; return existing.key; }
    const key = await this.provider.generateAesKey();
    await this.keyRepository.put({ keyId:this.keyId, key, algorithm:'AES-GCM', createdAt:Date.now() });
    this.cachedKey = key;
    return key;
  }

  async seal(plaintext, aad = new Uint8Array()) {
    const key = await this.ensureKey();
    const { iv, ciphertext } = await this.provider.aesGcmEncrypt(key, plaintext, { aad });
    return { version:1, iv, ciphertext };
  }

  async open(sealed, aad = new Uint8Array()) {
    if (!sealed || sealed.version !== 1 || !(sealed.iv instanceof Uint8Array) || !(sealed.ciphertext instanceof Uint8Array)) {
      throw new Error('VAULT_BLOB_INVALID');
    }
    const key = await this.ensureKey();
    return this.provider.aesGcmDecrypt(key, sealed.ciphertext, { iv:sealed.iv, aad });
  }
}
