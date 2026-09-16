import { toBase64Url, fromBase64Url } from '../crypto/bytes.js';

function assertBytes(value, code) { if (!(value instanceof Uint8Array)) throw new Error(code); return value; }

export class NativeSecurityVault {
  constructor({ plugin } = {}) {
    if (!plugin || typeof plugin.seal !== 'function' || typeof plugin.open !== 'function' || typeof plugin.securityStatus !== 'function') throw new Error('NATIVE_SECURITY_PLUGIN_INVALID');
    this.plugin = plugin;
  }
  status() { return this.plugin.securityStatus(); }
  async seal(plaintext, aad = new Uint8Array()) {
    assertBytes(plaintext, 'VAULT_PLAINTEXT_INVALID'); assertBytes(aad, 'VAULT_AAD_INVALID');
    const result = await this.plugin.seal({ plaintextBase64:toBase64Url(plaintext), aadBase64:toBase64Url(aad) });
    if (!result || result.version !== 1 || typeof result.ivBase64 !== 'string' || typeof result.ciphertextBase64 !== 'string') throw new Error('NATIVE_SECURITY_SEAL_INVALID');
    return { version:1, iv:fromBase64Url(result.ivBase64), ciphertext:fromBase64Url(result.ciphertextBase64), native:true };
  }
  async open(sealed, aad = new Uint8Array()) {
    if (!sealed || sealed.version !== 1 || !(sealed.iv instanceof Uint8Array) || !(sealed.ciphertext instanceof Uint8Array)) throw new Error('VAULT_BLOB_INVALID');
    assertBytes(aad, 'VAULT_AAD_INVALID');
    const result = await this.plugin.open({ version:1, ivBase64:toBase64Url(sealed.iv), ciphertextBase64:toBase64Url(sealed.ciphertext), aadBase64:toBase64Url(aad) });
    if (!result || typeof result.plaintextBase64 !== 'string') throw new Error('NATIVE_SECURITY_OPEN_INVALID');
    return fromBase64Url(result.plaintextBase64);
  }
}
