import { utf8 } from './bytes.js';
import { createInitiation, acceptInitiation } from './handshake/x3dh.js';
import { decodeEnvelope, encodeEnvelope } from './envelope.js';

function fail(code, detail = '') {
  const error = new Error(`${code}${detail ? `: ${detail}` : ''}`);
  error.code = code;
  throw error;
}

export class CryptoEngine {
  constructor({ db, provider, identityManager, trustStore, preKeyManager, sessionRepository, ratchet, randomUUID = null, clock = { now: () => Date.now() } } = {}) {
    if (!db || !provider || !identityManager || !trustStore || !preKeyManager || !sessionRepository || !ratchet) {
      throw new Error('CRYPTO_ENGINE_DEPENDENCY_REQUIRED');
    }
    this.db = db;
    this.provider = provider;
    this.identityManager = identityManager;
    this.trustStore = trustStore;
    this.preKeyManager = preKeyManager;
    this.sessionRepository = sessionRepository;
    this.ratchet = ratchet;
    this.randomUUID = randomUUID || globalThis.crypto?.randomUUID?.bind(globalThis.crypto);
    this.clock = clock;
    this.identity = null;
  }

  async initialize() {
    this.identity = await this.identityManager.ensureIdentity();
    return this.identity;
  }

  async getPublicBundle(options = {}) {
    if (!this.identity) await this.initialize();
    return this.preKeyManager.ensureBundle(options);
  }

  #aad(sessionId, senderDeviceId, recipientDeviceId) {
    return utf8(`SYNERGY-MESSAGE-V1|${sessionId}|${senderDeviceId}|${recipientDeviceId}`);
  }

  async #assertOutboundPeer(bundle) {
    if (!bundle?.identity?.deviceId || !bundle.identity.fingerprint) fail('PREKEY_BUNDLE_INVALID');
    const existing = await this.trustStore.get(bundle.identity.deviceId);
    if (existing && existing.fingerprint !== bundle.identity.fingerprint) {
      await this.trustStore.assertTrusted(bundle.identity);
    }
    if (!(await this.preKeyManager.verifyBundle(bundle))) fail('PREKEY_BUNDLE_INVALID');
    await this.trustStore.assertTrusted(bundle.identity);
  }

  async encryptForPeer(peerBundle, plaintext) {
    if (!(plaintext instanceof Uint8Array)) fail('PLAINTEXT_MUST_BE_BYTES');
    if (!this.identity) await this.initialize();
    if (!peerBundle?.identity?.deviceId || !peerBundle.identity.fingerprint) fail('PREKEY_BUNDLE_INVALID');
    const peerDeviceId = peerBundle.identity.deviceId;
    const existing = await this.sessionRepository.findByPeer(peerDeviceId);

    if (existing) {
      await this.trustStore.assertTrusted(peerBundle.identity);
      const ratchetMessage = await this.ratchet.encrypt(existing.state, plaintext, this.#aad(existing.sessionId, this.identity.deviceId, peerDeviceId));
      await this.sessionRepository.save({ sessionId:existing.sessionId, peerDeviceId, state:existing.state, metadata:existing.metadata });
      const prekeyPending = existing.metadata?.role === 'initiator' && existing.metadata?.prekeyPending === true;
      return encodeEnvelope({
        version:1,
        type:prekeyPending ? 'prekey' : 'ratchet',
        sessionId:existing.sessionId,
        senderDeviceId:this.identity.deviceId,
        recipientDeviceId:peerDeviceId,
        ...(prekeyPending ? { initiation:existing.metadata.initiation } : {}),
        ratchet:ratchetMessage
      });
    }

    await this.#assertOutboundPeer(peerBundle);
    if (!this.randomUUID) fail('RANDOM_UUID_UNAVAILABLE');
    const { sharedSecret, initiation } = await createInitiation({
      provider:this.provider,
      localIdentityRecord:await this.identityManager.getLocalRecord(),
      remoteBundle:peerBundle
    });
    const sessionId = this.randomUUID();
    const state = await this.ratchet.initInitiator({ sharedSecret, remoteRatchetPublicKey:peerBundle.signedPreKey.publicKey });
    const ratchetMessage = await this.ratchet.encrypt(state, plaintext, this.#aad(sessionId, this.identity.deviceId, peerDeviceId));
    await this.sessionRepository.save({ sessionId, peerDeviceId, state, metadata:{ role:'initiator', prekeyPending:true, initiation } });
    return encodeEnvelope({
      version:1,
      type:'prekey',
      sessionId,
      senderDeviceId:this.identity.deviceId,
      recipientDeviceId:peerDeviceId,
      initiation,
      ratchet:ratchetMessage
    });
  }

  async decryptEnvelope(encoded) {
    if (!this.identity) await this.initialize();
    const envelope = decodeEnvelope(encoded);
    if (envelope.recipientDeviceId !== this.identity.deviceId) fail('CRYPTO_WRONG_RECIPIENT');

    if (envelope.type === 'prekey') return this.#decryptPreKey(envelope);
    return this.#decryptRatchet(envelope);
  }

  async #decryptPreKey(envelope) {
    const existingSession = await this.sessionRepository.load(envelope.sessionId);
    if (existingSession) {
      if (existingSession.peerDeviceId !== envelope.senderDeviceId) fail('CRYPTO_SENDER_MISMATCH');
      const plaintext = await this.ratchet.decrypt(
        existingSession.state,
        envelope.ratchet,
        this.#aad(envelope.sessionId, envelope.senderDeviceId, envelope.recipientDeviceId)
      );
      await this.sessionRepository.save({ sessionId:existingSession.sessionId, peerDeviceId:existingSession.peerDeviceId, state:existingSession.state, metadata:existingSession.metadata });
      return { sessionId:existingSession.sessionId, senderDeviceId:existingSession.peerDeviceId, plaintext, initial:false };
    }
    const initiation = envelope.initiation;
    const senderIdentity = initiation.senderIdentity;
    if (senderIdentity.deviceId !== envelope.senderDeviceId) fail('CRYPTO_SENDER_MISMATCH');

    const existingTrust = await this.trustStore.get(senderIdentity.deviceId);
    if (existingTrust && existingTrust.fingerprint !== senderIdentity.fingerprint) {
      await this.trustStore.assertTrusted(senderIdentity);
    }

    const signedPreKey = await this.preKeyManager.getSignedPreKey(initiation.recipientSignedPreKeyId);
    if (!signedPreKey) fail('SIGNED_PREKEY_NOT_FOUND');
    let oneTimePreKey = null;
    if (initiation.recipientOneTimePreKeyId) {
      oneTimePreKey = await this.preKeyManager.getOneTimePreKey(initiation.recipientOneTimePreKeyId);
      if (!oneTimePreKey) fail('ONE_TIME_PREKEY_NOT_FOUND');
      if (oneTimePreKey.consumedAt != null) fail('ONE_TIME_PREKEY_ALREADY_USED');
    }

    const accepted = await acceptInitiation({
      provider:this.provider,
      localIdentityRecord:await this.identityManager.getLocalRecord(),
      signedPreKeyRecord:signedPreKey,
      oneTimePreKeyRecord:oneTimePreKey,
      initiation
    });
    await this.trustStore.assertTrusted(accepted.senderIdentity);

    const state = await this.ratchet.initResponder({
      sharedSecret:accepted.sharedSecret,
      localRatchetKeyPair:{ privateKey:signedPreKey.privateKey, publicKey:signedPreKey.publicKey }
    });
    const plaintext = await this.ratchet.decrypt(
      state,
      envelope.ratchet,
      this.#aad(envelope.sessionId, envelope.senderDeviceId, envelope.recipientDeviceId)
    );

    if (oneTimePreKey) {
      const consumed = await this.preKeyManager.consumeOneTimePreKey(oneTimePreKey.id);
      if (!consumed) fail('ONE_TIME_PREKEY_ALREADY_USED');
    }
    await this.sessionRepository.save({ sessionId:envelope.sessionId, peerDeviceId:envelope.senderDeviceId, state, metadata:{ role:'responder', prekeyPending:false } });
    return { sessionId:envelope.sessionId, senderDeviceId:envelope.senderDeviceId, plaintext, initial:true };
  }

  async #decryptRatchet(envelope) {
    const session = await this.sessionRepository.load(envelope.sessionId);
    if (!session) fail('SESSION_NOT_FOUND');
    if (session.peerDeviceId !== envelope.senderDeviceId) fail('CRYPTO_SENDER_MISMATCH');
    const plaintext = await this.ratchet.decrypt(
      session.state,
      envelope.ratchet,
      this.#aad(envelope.sessionId, envelope.senderDeviceId, envelope.recipientDeviceId)
    );
    const metadata = session.metadata?.role === 'initiator' && session.metadata?.prekeyPending
      ? { ...session.metadata, prekeyPending:false }
      : session.metadata;
    await this.sessionRepository.save({ sessionId:session.sessionId, peerDeviceId:session.peerDeviceId, state:session.state, metadata });
    return { sessionId:session.sessionId, senderDeviceId:session.peerDeviceId, plaintext, initial:false };
  }
}
