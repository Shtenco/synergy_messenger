import { bytesEqual, concatBytes, toBase64Url, utf8 } from '../bytes.js';

export const MAX_SKIP = 256;
const ZERO32 = new Uint8Array(32);

function fail(code, detail = '') {
  const error = new Error(`${code}${detail ? `: ${detail}` : ''}`);
  error.code = code;
  throw error;
}

function validateKey32(value, name) {
  if (!(value instanceof Uint8Array) || value.byteLength !== 32) fail('RATCHET_STATE_INVALID', `${name} must be 32 bytes`);
}

function headerBytes(header) {
  if (!(header?.dh instanceof Uint8Array) || header.dh.byteLength !== 32) fail('RATCHET_MESSAGE_INVALID', 'header.dh');
  if (!Number.isSafeInteger(header.pn) || header.pn < 0 || !Number.isSafeInteger(header.n) || header.n < 0) {
    fail('RATCHET_MESSAGE_INVALID', 'header counters');
  }
  const counters = new Uint8Array(16);
  const view = new DataView(counters.buffer);
  view.setBigUint64(0, BigInt(header.pn), false);
  view.setBigUint64(8, BigInt(header.n), false);
  return concatBytes(utf8('SYNERGY-DR-HEADER-V1\0'), header.dh, counters);
}

function messageAad(ad, header) {
  if (!(ad instanceof Uint8Array)) fail('RATCHET_MESSAGE_INVALID', 'associated data must be bytes');
  return concatBytes(ad, utf8('\0SYNERGY-DR-AAD-V1\0'), headerBytes(header));
}

function skippedId(dh, n) { return `${toBase64Url(dh)}:${n}`; }

function cloneState(state) {
  return structuredClone(state);
}

function commitState(target, source) {
  for (const key of Object.keys(target)) delete target[key];
  Object.assign(target, source);
}

export class DoubleRatchet {
  constructor({ provider } = {}) {
    if (!provider) throw new Error('RATCHET_PROVIDER_REQUIRED');
    this.provider = provider;
  }

  async #kdfRoot(rootKey, dhOut) {
    validateKey32(rootKey, 'rootKey');
    validateKey32(dhOut, 'dhOut');
    const material = await this.provider.hkdf(dhOut, {
      salt:rootKey,
      info:utf8('SYNERGY-DOUBLE-RATCHET-RK-V1'),
      length:64
    });
    return { rootKey:material.slice(0,32), chainKey:material.slice(32,64) };
  }

  async #kdfChain(chainKey) {
    validateKey32(chainKey, 'chainKey');
    const nextChainKey = await this.provider.hmac(chainKey, Uint8Array.of(0x01));
    const messageKey = await this.provider.hmac(chainKey, Uint8Array.of(0x02));
    return { chainKey:nextChainKey, messageKey };
  }

  async initInitiator({ sharedSecret, remoteRatchetPublicKey }) {
    validateKey32(sharedSecret, 'sharedSecret');
    validateKey32(remoteRatchetPublicKey, 'remoteRatchetPublicKey');
    const dhSelfPair = await this.provider.generateDhKeyPair();
    const dhSelfPublic = await this.provider.exportPublicKey(dhSelfPair.publicKey);
    const dhOut = await this.provider.dh(dhSelfPair.privateKey, remoteRatchetPublicKey);
    const derived = await this.#kdfRoot(sharedSecret, dhOut);
    return {
      version:1,
      rootKey:derived.rootKey,
      sendChainKey:derived.chainKey,
      recvChainKey:null,
      dhSelf:{ privateKey:dhSelfPair.privateKey, publicKey:dhSelfPublic },
      dhRemote:new Uint8Array(remoteRatchetPublicKey),
      ns:0, nr:0, pn:0,
      skipped:{}
    };
  }

  async initResponder({ sharedSecret, localRatchetKeyPair }) {
    validateKey32(sharedSecret, 'sharedSecret');
    if (!localRatchetKeyPair?.privateKey) fail('RATCHET_STATE_INVALID', 'responder private key');
    validateKey32(localRatchetKeyPair.publicKey, 'responder public key');
    return {
      version:1,
      rootKey:new Uint8Array(sharedSecret),
      sendChainKey:null,
      recvChainKey:null,
      dhSelf:{ privateKey:localRatchetKeyPair.privateKey, publicKey:new Uint8Array(localRatchetKeyPair.publicKey) },
      dhRemote:null,
      ns:0, nr:0, pn:0,
      skipped:{}
    };
  }

  async encrypt(state, plaintext, associatedData = new Uint8Array()) {
    if (!(plaintext instanceof Uint8Array)) fail('RATCHET_MESSAGE_INVALID', 'plaintext must be bytes');
    if (!state?.sendChainKey) fail('RATCHET_SEND_CHAIN_UNAVAILABLE');
    const next = cloneState(state);
    const step = await this.#kdfChain(next.sendChainKey);
    next.sendChainKey = step.chainKey;
    const n = next.ns;
    next.ns += 1;
    const header = { dh:new Uint8Array(next.dhSelf.publicKey), pn:next.pn, n };
    const aesKey = await this.provider.importAesKey(step.messageKey, false);
    const sealed = await this.provider.aesGcmEncrypt(aesKey, plaintext, { aad:messageAad(associatedData, header) });
    commitState(state, next);
    return { version:1, header, iv:sealed.iv, ciphertext:sealed.ciphertext };
  }

  async #trySkipped(state, header) {
    const id = skippedId(header.dh, header.n);
    const messageKey = state.skipped[id];
    if (!messageKey) return null;
    delete state.skipped[id];
    return messageKey;
  }

  async #skipMessageKeys(state, until) {
    if (!Number.isSafeInteger(until) || until < 0) fail('RATCHET_MESSAGE_INVALID', 'invalid counter');
    if (state.nr + MAX_SKIP < until) fail('RATCHET_TOO_MANY_SKIPPED');
    if (!state.recvChainKey) return;
    while (state.nr < until) {
      const step = await this.#kdfChain(state.recvChainKey);
      state.recvChainKey = step.chainKey;
      if (!state.dhRemote) fail('RATCHET_STATE_INVALID', 'missing remote ratchet key');
      state.skipped[skippedId(state.dhRemote, state.nr)] = step.messageKey;
      state.nr += 1;
    }
  }

  async #dhRatchet(state, header) {
    state.pn = state.ns;
    state.ns = 0;
    state.nr = 0;
    state.dhRemote = new Uint8Array(header.dh);
    const recvDh = await this.provider.dh(state.dhSelf.privateKey, state.dhRemote);
    const recvDerived = await this.#kdfRoot(state.rootKey, recvDh);
    state.rootKey = recvDerived.rootKey;
    state.recvChainKey = recvDerived.chainKey;

    const newPair = await this.provider.generateDhKeyPair();
    const newPublic = await this.provider.exportPublicKey(newPair.publicKey);
    state.dhSelf = { privateKey:newPair.privateKey, publicKey:newPublic };
    const sendDh = await this.provider.dh(state.dhSelf.privateKey, state.dhRemote);
    const sendDerived = await this.#kdfRoot(state.rootKey, sendDh);
    state.rootKey = sendDerived.rootKey;
    state.sendChainKey = sendDerived.chainKey;
  }

  async #receiveMessageKey(state, header) {
    const skipped = await this.#trySkipped(state, header);
    if (skipped) return skipped;
    if (!state.dhRemote || !bytesEqual(header.dh, state.dhRemote)) {
      await this.#skipMessageKeys(state, header.pn);
      await this.#dhRatchet(state, header);
    }
    await this.#skipMessageKeys(state, header.n);
    if (!state.recvChainKey) fail('RATCHET_RECEIVE_CHAIN_UNAVAILABLE');
    const step = await this.#kdfChain(state.recvChainKey);
    state.recvChainKey = step.chainKey;
    state.nr += 1;
    return step.messageKey;
  }

  async decrypt(state, message, associatedData = new Uint8Array()) {
    if (!message || message.version !== 1 || !(message.iv instanceof Uint8Array) || !(message.ciphertext instanceof Uint8Array)) {
      fail('RATCHET_MESSAGE_INVALID');
    }
    headerBytes(message.header);
    const next = cloneState(state);
    const messageKey = await this.#receiveMessageKey(next, message.header);
    const aesKey = await this.provider.importAesKey(messageKey, false);
    const plaintext = await this.provider.aesGcmDecrypt(aesKey, message.ciphertext, {
      iv:message.iv,
      aad:messageAad(associatedData, message.header)
    });
    commitState(state, next);
    return plaintext;
  }
}
