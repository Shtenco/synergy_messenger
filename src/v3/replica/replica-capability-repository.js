import { fromBase64Url, toBase64Url, utf8, utf8Decode } from '../crypto/bytes.js';

function encode(value){if(value instanceof Uint8Array)return {__synergyBytes:toBase64Url(value)};if(Array.isArray(value))return value.map(encode);if(value&&typeof value==='object'){const out={};for(const [k,v] of Object.entries(value))out[k]=encode(v);return out;}return value;}
function decode(value){if(value&&typeof value==='object'&&Object.keys(value).length===1&&typeof value.__synergyBytes==='string')return fromBase64Url(value.__synergyBytes);if(Array.isArray(value))return value.map(decode);if(value&&typeof value==='object'){const out={};for(const [k,v] of Object.entries(value))out[k]=decode(v);return out;}return value;}
const aad=id=>utf8(`SYNERGY-REPLICA-CAPABILITY-V1|${id}`);

export class ReplicaCapabilityRepository {
  constructor({db,vault}={}){if(!db||!vault)throw new Error('REPLICA_CAPABILITY_REPOSITORY_DEPENDENCY_REQUIRED');this.db=db;this.vault=vault;}
  async put(record){if(!record?.capabilityId||!record?.replica||!Number.isFinite(record.replica.expiresAt))throw new Error('REPLICA_CAPABILITY_INVALID');const sealed=await this.vault.seal(utf8(JSON.stringify(encode(record))),aad(record.capabilityId));await this.db.put('replicaCapabilities',{capabilityId:record.capabilityId,expiresAt:record.replica.expiresAt,updatedAt:record.updatedAt??Date.now(),sealed});return record;}
  async get(capabilityId){const row=await this.db.get('replicaCapabilities',capabilityId);if(!row)return null;return decode(JSON.parse(utf8Decode(await this.vault.open(row.sealed,aad(capabilityId)))));}
  async delete(capabilityId){return this.db.delete('replicaCapabilities',capabilityId);}
  async list(){const out=[];for(const row of await this.db.getAll('replicaCapabilities')){const item=await this.get(row.capabilityId);if(item)out.push(item);}return out;}
  async deleteExpired(now=Date.now()){let removed=0;for(const row of await this.db.getAll('replicaCapabilities')){if(!Number.isFinite(row.expiresAt)||row.expiresAt<=now){await this.db.delete('replicaCapabilities',row.capabilityId);removed+=1;}}return removed;}
}
