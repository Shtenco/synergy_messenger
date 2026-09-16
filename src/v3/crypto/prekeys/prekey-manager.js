import { concatBytes, fromBase64Url, toBase64Url, utf8 } from '../bytes.js';
import { deriveIdentityMetadata } from '../identity/identity-manager.js';

const SIGNED_TTL_MS = 7 * 24 * 60 * 60 * 1000;

function uuid(randomUUID) {
  const fn = randomUUID || globalThis.crypto?.randomUUID?.bind(globalThis.crypto);
  if (!fn) throw new Error('RANDOM_UUID_UNAVAILABLE');
  return fn();
}

function signedPreKeyTranscript({ deviceId, id, publicKey, createdAt, expiresAt }) {
  return concatBytes(
    utf8('SYNERGY-SIGNED-PREKEY-V1\0'), utf8(deviceId), utf8('\0'), utf8(id), utf8('\0'),
    utf8(String(createdAt)), utf8('\0'), utf8(String(expiresAt)), utf8('\0'), publicKey
  );
}

export class PreKeyManager {
  constructor({ db, provider, identityManager, clock = { now: () => Date.now() }, randomUUID = null } = {}) {
    if (!db || !provider || !identityManager) throw new Error('PREKEY_DEPENDENCY_REQUIRED');
    this.db = db; this.provider = provider; this.identityManager = identityManager; this.clock = clock; this.randomUUID = randomUUID;
  }

  async #rows() { return this.db.getAll('prekeys'); }
  async getOneTimePreKey(id) { const row = await this.db.get('prekeys', id); return row?.type === 'one-time' ? row : null; }
  async getSignedPreKey(id) { const row = await this.db.get('prekeys', id); return row?.type === 'signed' ? row : null; }

  async #ensureSignedPreKey(identityRecord) {
    const now = this.clock.now();
    const rows = await this.#rows();
    let row = rows.find(item => item.type === 'signed' && item.expiresAt > now);
    if (row) return row;
    const pair = await this.provider.generateDhKeyPair();
    const publicKey = await this.provider.exportPublicKey(pair.publicKey);
    const id = `spk:${uuid(this.randomUUID)}`;
    const createdAt = now;
    const expiresAt = now + SIGNED_TTL_MS;
    const signature = await this.provider.sign(identityRecord.signingPrivateKey, signedPreKeyTranscript({
      deviceId:identityRecord.deviceId, id, publicKey, createdAt, expiresAt
    }));
    row = { preKeyId:id, id, type:'signed', privateKey:pair.privateKey, publicKey, signature, createdAt, expiresAt, consumedAt:null };
    await this.db.put('prekeys', row);
    return row;
  }

  async #ensureOneTime(count) {
    const rows = await this.#rows();
    const available = rows.filter(item => item.type === 'one-time' && item.consumedAt == null);
    for (let i = available.length; i < count; i += 1) {
      const pair = await this.provider.generateDhKeyPair();
      const publicKey = await this.provider.exportPublicKey(pair.publicKey);
      const id = `opk:${uuid(this.randomUUID)}`;
      const row = { preKeyId:id, id, type:'one-time', privateKey:pair.privateKey, publicKey, createdAt:this.clock.now(), consumedAt:null };
      await this.db.put('prekeys', row);
      available.push(row);
    }
    return available.slice(0, count);
  }

  async ensureBundle({ oneTimeCount = 10 } = {}) {
    await this.identityManager.ensureIdentity();
    const identityRecord = await this.identityManager.getLocalRecord();
    const signed = await this.#ensureSignedPreKey(identityRecord);
    const oneTimes = await this.#ensureOneTime(oneTimeCount);
    return {
      version:1,
      identity:this.identityManager.toPublicIdentity(identityRecord),
      signedPreKey:{ id:signed.id, publicKey:new Uint8Array(signed.publicKey), signature:new Uint8Array(signed.signature), createdAt:signed.createdAt, expiresAt:signed.expiresAt },
      oneTimePreKeys:oneTimes.map(row => ({ id:row.id, publicKey:new Uint8Array(row.publicKey) }))
    };
  }

  async verifyBundle(bundle) {
    try {
      if (!bundle || bundle.version !== 1 || !bundle.identity || !bundle.signedPreKey) return false;
      if (!Number.isFinite(bundle.signedPreKey.expiresAt) || bundle.signedPreKey.expiresAt <= this.clock.now()) return false;
      if (!Number.isFinite(bundle.signedPreKey.createdAt) || bundle.signedPreKey.createdAt >= bundle.signedPreKey.expiresAt) return false;
      const metadata = await deriveIdentityMetadata(this.provider, bundle.identity);
      if (metadata.mailbox !== bundle.identity.mailbox || metadata.fingerprint !== bundle.identity.fingerprint) return false;
      const signingPublic = await this.provider.importSigningPublic(bundle.identity.signingPublicKey);
      return this.provider.verify(signingPublic, bundle.signedPreKey.signature, signedPreKeyTranscript({
        deviceId:bundle.identity.deviceId,
        id:bundle.signedPreKey.id,
        publicKey:bundle.signedPreKey.publicKey,
        createdAt:bundle.signedPreKey.createdAt,
        expiresAt:bundle.signedPreKey.expiresAt
      }));
    } catch { return false; }
  }

  async consumeOneTimePreKey(id) {
    const row = await this.getOneTimePreKey(id);
    if (!row || row.consumedAt != null) return false;
    await this.db.put('prekeys', { ...row, consumedAt:this.clock.now() });
    return true;
  }
}

export { signedPreKeyTranscript };
