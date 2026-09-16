import { utf8 } from './bytes.js';

function ensureBytes(value, name) {
  if (!(value instanceof Uint8Array)) throw new TypeError(`${name} must be Uint8Array`);
  return value;
}

export class WebCryptoProvider {
  constructor({ crypto = globalThis.crypto } = {}) {
    if (!crypto?.subtle || !crypto?.getRandomValues) throw new Error('WEBCRYPTO_UNAVAILABLE');
    this.crypto = crypto;
    this.subtle = crypto.subtle;
  }

  randomBytes(length) {
    const out = new Uint8Array(length);
    this.crypto.getRandomValues(out);
    return out;
  }

  async generateSigningKeyPair() {
    try { return await this.subtle.generateKey('Ed25519', false, ['sign', 'verify']); }
    catch (cause) { throw Object.assign(new Error('CRYPTO_ALGORITHM_UNAVAILABLE: Ed25519'), { code:'CRYPTO_ALGORITHM_UNAVAILABLE', cause }); }
  }

  async generateDhKeyPair() {
    try { return await this.subtle.generateKey('X25519', false, ['deriveBits']); }
    catch (cause) { throw Object.assign(new Error('CRYPTO_ALGORITHM_UNAVAILABLE: X25519'), { code:'CRYPTO_ALGORITHM_UNAVAILABLE', cause }); }
  }

  exportPublicKey(publicKey) { return this.subtle.exportKey('raw', publicKey).then(value => new Uint8Array(value)); }
  importSigningPublic(raw) { return this.subtle.importKey('raw', ensureBytes(raw,'raw'), 'Ed25519', true, ['verify']); }
  importDhPublic(raw) { return this.subtle.importKey('raw', ensureBytes(raw,'raw'), 'X25519', true, []); }
  sign(privateKey, data) { return this.subtle.sign('Ed25519', privateKey, ensureBytes(data,'data')).then(value => new Uint8Array(value)); }
  verify(publicKey, signature, data) { return this.subtle.verify('Ed25519', publicKey, ensureBytes(signature,'signature'), ensureBytes(data,'data')); }

  async dh(privateKey, publicKey) {
    const key = publicKey instanceof Uint8Array ? await this.importDhPublic(publicKey) : publicKey;
    const bits = await this.subtle.deriveBits({ name:'X25519', public:key }, privateKey, 256);
    return new Uint8Array(bits);
  }

  async sha256(data) { return new Uint8Array(await this.subtle.digest('SHA-256', ensureBytes(data,'data'))); }

  async hkdf(ikm, { salt = new Uint8Array(), info = new Uint8Array(), length = 32 } = {}) {
    const key = await this.subtle.importKey('raw', ensureBytes(ikm,'ikm'), 'HKDF', false, ['deriveBits']);
    const bits = await this.subtle.deriveBits({ name:'HKDF', hash:'SHA-256', salt:ensureBytes(salt,'salt'), info:ensureBytes(info,'info') }, key, length * 8);
    return new Uint8Array(bits);
  }

  async hmac(keyBytes, data) {
    const key = await this.subtle.importKey('raw', ensureBytes(keyBytes,'keyBytes'), { name:'HMAC', hash:'SHA-256' }, false, ['sign']);
    return new Uint8Array(await this.subtle.sign('HMAC', key, ensureBytes(data,'data')));
  }

  async generateAesKey() { return this.subtle.generateKey({ name:'AES-GCM', length:256 }, false, ['encrypt','decrypt']); }
  async importAesKey(raw, extractable = false) { return this.subtle.importKey('raw', ensureBytes(raw,'raw'), 'AES-GCM', extractable, ['encrypt','decrypt']); }

  async aesGcmEncrypt(key, plaintext, { iv = this.randomBytes(12), aad = new Uint8Array() } = {}) {
    const ciphertext = await this.subtle.encrypt({ name:'AES-GCM', iv:ensureBytes(iv,'iv'), additionalData:ensureBytes(aad,'aad'), tagLength:128 }, key, ensureBytes(plaintext,'plaintext'));
    return { iv:new Uint8Array(iv), ciphertext:new Uint8Array(ciphertext) };
  }

  async aesGcmDecrypt(key, ciphertext, { iv, aad = new Uint8Array() } = {}) {
    const plaintext = await this.subtle.decrypt({ name:'AES-GCM', iv:ensureBytes(iv,'iv'), additionalData:ensureBytes(aad,'aad'), tagLength:128 }, key, ensureBytes(ciphertext,'ciphertext'));
    return new Uint8Array(plaintext);
  }
}
