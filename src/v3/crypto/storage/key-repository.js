export class KeyRepository {
  constructor(db) { this.db = db; }
  get(keyId) { return this.db.get('cryptoKeys', keyId); }
  put(record) { return this.db.put('cryptoKeys', record); }
  delete(keyId) { return this.db.delete('cryptoKeys', keyId); }
}
