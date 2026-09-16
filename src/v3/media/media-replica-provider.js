export class NullMediaReplicaProvider {
  async publish() { return null; }
  async fetchChunk() { throw new Error('REPLICA_UNAVAILABLE'); }
  async locate() { return []; }
  async remove() { return false; }
}
