import { concatBytes, toBase64Url, utf8 } from '../bytes.js';

const IDENTITY_ID = 'local-v1';

function uuidOrFail(randomUUID) {
  const fn = randomUUID || globalThis.crypto?.randomUUID?.bind(globalThis.crypto);
  if (!fn) throw new Error('RANDOM_UUID_UNAVAILABLE');
  return fn();
}

function formatFingerprint(hash) {
  const hex = [...hash].map(byte => byte.toString(16).padStart(2, '0').toUpperCase()).join('');
  return `SYN3-${hex.match(/.{1,4}/g).join('-')}`;
}

export async function deriveIdentityMetadata(provider, { deviceId, signingPublicKey, identityDhPublicKey }) {
  if (!deviceId || !(signingPublicKey instanceof Uint8Array) || !(identityDhPublicKey instanceof Uint8Array)) {
    throw new Error('PUBLIC_IDENTITY_INVALID');
  }
  const identityHash = await provider.sha256(concatBytes(
    utf8('SYNERGY-IDENTITY-V1\0'), utf8(deviceId), utf8('\0'), signingPublicKey, identityDhPublicKey
  ));
  const mailboxHash = await provider.sha256(concatBytes(
    utf8('SYNERGY-MAILBOX-V1\0'), utf8(deviceId), utf8('\0'), signingPublicKey, identityDhPublicKey
  ));
  return {
    mailbox: `syn3:${toBase64Url(mailboxHash.subarray(0, 20))}`,
    fingerprint: formatFingerprint(identityHash)
  };
}

export class IdentityManager {
  constructor({ db, provider, clock = { now: () => Date.now() }, randomUUID = null } = {}) {
    if (!db || !provider) throw new Error('IDENTITY_DEPENDENCY_REQUIRED');
    this.db = db;
    this.provider = provider;
    this.clock = clock;
    this.randomUUID = randomUUID;
  }

  getLocalRecord() { return this.db.get('identities', IDENTITY_ID); }

  async ensureIdentity() {
    let record = await this.getLocalRecord();
    if (!record) {
      const signing = await this.provider.generateSigningKeyPair();
      const identityDh = await this.provider.generateDhKeyPair();
      const signingPublicKey = await this.provider.exportPublicKey(signing.publicKey);
      const identityDhPublicKey = await this.provider.exportPublicKey(identityDh.publicKey);
      const deviceId = uuidOrFail(this.randomUUID);
      const metadata = await deriveIdentityMetadata(this.provider, { deviceId, signingPublicKey, identityDhPublicKey });
      record = {
        identityId: IDENTITY_ID,
        version: 1,
        deviceId,
        ...metadata,
        signingPrivateKey: signing.privateKey,
        signingPublicKey,
        identityDhPrivateKey: identityDh.privateKey,
        identityDhPublicKey,
        createdAt: this.clock.now()
      };
      await this.db.put('identities', record);
    }
    return this.toPublicIdentity(record);
  }

  toPublicIdentity(record) {
    if (!record) return null;
    return {
      version: 1,
      deviceId: record.deviceId,
      mailbox: record.mailbox,
      fingerprint: record.fingerprint,
      signingPublicKey: new Uint8Array(record.signingPublicKey),
      identityDhPublicKey: new Uint8Array(record.identityDhPublicKey)
    };
  }
}
