import { fromBase64Url, toBase64Url, utf8, utf8Decode } from '../bytes.js';

function encodeMaybe(bytes) { return bytes == null ? null : toBase64Url(bytes); }
function decodeMaybe(value) { return value == null ? null : fromBase64Url(value); }

function serializeState(state) {
  const skipped = {};
  for (const [key, value] of Object.entries(state.skipped || {})) skipped[key] = toBase64Url(value);
  return utf8(JSON.stringify({
    version:state.version,
    rootKey:toBase64Url(state.rootKey),
    sendChainKey:encodeMaybe(state.sendChainKey),
    recvChainKey:encodeMaybe(state.recvChainKey),
    dhSelfPublicKey:toBase64Url(state.dhSelf.publicKey),
    dhRemote:encodeMaybe(state.dhRemote),
    ns:state.ns,
    nr:state.nr,
    pn:state.pn,
    skipped
  }));
}

function deserializeState(bytes, dhPrivateKey) {
  const parsed = JSON.parse(utf8Decode(bytes));
  const skipped = {};
  for (const [key, value] of Object.entries(parsed.skipped || {})) skipped[key] = fromBase64Url(value);
  return {
    version:parsed.version,
    rootKey:fromBase64Url(parsed.rootKey),
    sendChainKey:decodeMaybe(parsed.sendChainKey),
    recvChainKey:decodeMaybe(parsed.recvChainKey),
    dhSelf:{ privateKey:dhPrivateKey, publicKey:fromBase64Url(parsed.dhSelfPublicKey) },
    dhRemote:decodeMaybe(parsed.dhRemote),
    ns:parsed.ns,
    nr:parsed.nr,
    pn:parsed.pn,
    skipped
  };
}

export class SessionRepository {
  constructor({ db, vault, clock = { now: () => Date.now() } } = {}) {
    if (!db || !vault) throw new Error('SESSION_REPOSITORY_DEPENDENCY_REQUIRED');
    this.db = db;
    this.vault = vault;
    this.clock = clock;
  }

  #aad(sessionId, peerDeviceId) { return utf8(`SYNERGY-SESSION-V1|${sessionId}|${peerDeviceId}`); }

  async save({ sessionId, peerDeviceId, state, metadata = undefined }) {
    if (!sessionId || !peerDeviceId || !state?.dhSelf?.privateKey) throw new Error('SESSION_INVALID');
    const sealed = await this.vault.seal(serializeState(state), this.#aad(sessionId, peerDeviceId));
    const now = this.clock.now();
    const existing = await this.db.get('cryptoSessions', sessionId);
    const row = {
      sessionId,
      peerDeviceId,
      dhPrivateKey:state.dhSelf.privateKey,
      sealedState:sealed,
      metadata:metadata === undefined ? (existing?.metadata || {}) : metadata,
      createdAt:existing?.createdAt ?? now,
      updatedAt:now
    };
    await this.db.put('cryptoSessions', row);
    return { sessionId, peerDeviceId };
  }

  async load(sessionId) {
    const row = await this.db.get('cryptoSessions', sessionId);
    if (!row) return null;
    const plaintext = await this.vault.open(row.sealedState, this.#aad(row.sessionId, row.peerDeviceId));
    return {
      sessionId:row.sessionId,
      peerDeviceId:row.peerDeviceId,
      state:deserializeState(plaintext, row.dhPrivateKey),
      metadata:row.metadata || {},
      createdAt:row.createdAt,
      updatedAt:row.updatedAt
    };
  }

  async findByPeer(peerDeviceId) {
    const rows = await this.db.getAll('cryptoSessions');
    const matches = rows
      .filter(row => row.peerDeviceId === peerDeviceId)
      .sort((a,b) => {
        const responderBias = Number(b.metadata?.role === 'responder') - Number(a.metadata?.role === 'responder');
        return responderBias || (b.updatedAt - a.updatedAt) || a.sessionId.localeCompare(b.sessionId);
      });
    return matches.length ? this.load(matches[0].sessionId) : null;
  }

  delete(sessionId) { return this.db.delete('cryptoSessions', sessionId); }
}
