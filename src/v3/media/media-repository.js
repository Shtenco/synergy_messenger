import { utf8, utf8Decode } from '../crypto/bytes.js';

function objectAad(mediaId) { return utf8(`SYNERGY-MEDIA-OBJECT-V1|${mediaId}`); }
function transferAad(transferId) { return utf8(`SYNERGY-MEDIA-TRANSFER-V1|${transferId}`); }
function assertObject(record) {
  if (!record?.mediaId || !Number.isFinite(record?.createdAt) || !Number.isFinite(record?.updatedAt)) throw new Error('MEDIA_OBJECT_INVALID');
}
function assertTransfer(record) {
  if (!record?.transferId || !record?.mediaId || !record?.direction || !Number.isFinite(record?.createdAt) || !Number.isFinite(record?.updatedAt)) throw new Error('MEDIA_TRANSFER_INVALID');
}

export class MediaRepository {
  constructor({ db, vault } = {}) {
    if (!db || !vault) throw new Error('MEDIA_REPOSITORY_DEPENDENCY_REQUIRED');
    this.db=db; this.vault=vault;
  }

  async putObject(record) {
    assertObject(record);
    const sealed=await this.vault.seal(utf8(JSON.stringify(record)),objectAad(record.mediaId));
    await this.db.put('mediaObjects',{ mediaId:record.mediaId, createdAt:record.createdAt, updatedAt:record.updatedAt, sealed });
    return record;
  }

  async getObject(mediaId) {
    const row=await this.db.get('mediaObjects',mediaId); if(!row)return null;
    const plain=await this.vault.open(row.sealed,objectAad(row.mediaId));
    return JSON.parse(utf8Decode(plain));
  }

  async deleteObject(mediaId) { return this.db.delete('mediaObjects',mediaId); }

  async putTransfer(record) {
    assertTransfer(record);
    const sealed=await this.vault.seal(utf8(JSON.stringify(record)),transferAad(record.transferId));
    await this.db.put('mediaTransfers',{ transferId:record.transferId, mediaId:record.mediaId, createdAt:record.createdAt, updatedAt:record.updatedAt, sealed });
    return record;
  }

  async getTransfer(transferId) {
    const row=await this.db.get('mediaTransfers',transferId); if(!row)return null;
    const plain=await this.vault.open(row.sealed,transferAad(row.transferId));
    return JSON.parse(utf8Decode(plain));
  }

  async updateTransfer(transferId, updater) {
    const current=await this.getTransfer(transferId); if(!current)return null;
    const next=await updater(current);
    if(!next || next.transferId!==current.transferId || next.mediaId!==current.mediaId) throw new Error('MEDIA_TRANSFER_UPDATE_INVALID');
    await this.putTransfer(next); return next;
  }

  async listTransfersByMedia(mediaId) {
    const rows=(await this.db.getAll('mediaTransfers')).filter(row=>row.mediaId===mediaId);
    const out=[]; for(const row of rows){ const item=await this.getTransfer(row.transferId); if(item)out.push(item); }
    return out;
  }

  async listTransfers() {
    const rows=await this.db.getAll('mediaTransfers');
    const out=[]; for(const row of rows){ const item=await this.getTransfer(row.transferId); if(item)out.push(item); }
    return out;
  }

  async deleteTransfer(transferId) { return this.db.delete('mediaTransfers',transferId); }
}
