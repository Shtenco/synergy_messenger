function identityChanged(peerDeviceId) {
  const error = new Error(`IDENTITY_CHANGED: ${peerDeviceId}`);
  error.code = 'IDENTITY_CHANGED';
  return error;
}

export class TrustStore {
  constructor(db) { if (!db) throw new Error('TRUST_DB_REQUIRED'); this.db = db; }
  get(peerDeviceId) { return this.db.get('trust', peerDeviceId); }

  async assertTrusted(peerIdentity) {
    if (!peerIdentity?.deviceId || !peerIdentity?.fingerprint) throw new Error('PEER_IDENTITY_INVALID');
    const existing = await this.get(peerIdentity.deviceId);
    if (existing && existing.fingerprint !== peerIdentity.fingerprint) throw identityChanged(peerIdentity.deviceId);
    if (!existing) {
      const row = {
        peerDeviceId: peerIdentity.deviceId,
        fingerprint: peerIdentity.fingerprint,
        mailbox: peerIdentity.mailbox || null,
        verified: false,
        firstSeenAt: Date.now(),
        lastSeenAt: Date.now()
      };
      await this.db.put('trust', row);
      return row;
    }
    const updated = { ...existing, mailbox:peerIdentity.mailbox || existing.mailbox, lastSeenAt:Date.now() };
    await this.db.put('trust', updated);
    return updated;
  }

  async markVerified(peerDeviceId, fingerprint) {
    const existing = await this.get(peerDeviceId);
    if (!existing || existing.fingerprint !== fingerprint) throw identityChanged(peerDeviceId);
    const updated = { ...existing, verified:true, verifiedAt:Date.now() };
    await this.db.put('trust', updated);
    return updated;
  }
}
