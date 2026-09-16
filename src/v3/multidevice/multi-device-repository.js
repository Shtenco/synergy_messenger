import { fromBase64Url, toBase64Url, utf8, utf8Decode } from '../crypto/bytes.js';

function encode(value){if(value instanceof Uint8Array)return {__synergyBytes:toBase64Url(value)};if(Array.isArray(value))return value.map(encode);if(value&&typeof value==='object'){const out={};for(const [k,v] of Object.entries(value))out[k]=encode(v);return out;}return value;}
function decode(value){if(value&&typeof value==='object'&&Object.keys(value).length===1&&typeof value.__synergyBytes==='string')return fromBase64Url(value.__synergyBytes);if(Array.isArray(value))return value.map(decode);if(value&&typeof value==='object'){const out={};for(const [k,v] of Object.entries(value))out[k]=decode(v);return out;}return value;}
const certId=c=>`${c.accountId}:${c.deviceId}`;const revId=r=>`${r.accountId}:${r.deviceId}`;
const aad=(kind,id)=>utf8(`SYNERGY-MULTIDEVICE-${kind}-V1|${id}`);
export class MultiDeviceRepository{
  constructor({db,vault}={}){if(!db||!vault)throw new Error('MULTIDEVICE_REPOSITORY_DEPENDENCY_REQUIRED');this.db=db;this.vault=vault;}
  async putCertificate({certificate,bundle}){const id=certId(certificate);const sealed=await this.vault.seal(utf8(JSON.stringify(encode({certificate,bundle}))),aad('CERT',id));await this.db.put('deviceCertificates',{certificateId:id,updatedAt:Date.now(),sealed});return {certificate,bundle};}
  async getCertificate(accountId,deviceId){const id=`${accountId}:${deviceId}`,row=await this.db.get('deviceCertificates',id);if(!row)return null;return decode(JSON.parse(utf8Decode(await this.vault.open(row.sealed,aad('CERT',id)))));}
  async listCertificates(){const out=[];for(const row of await this.db.getAll('deviceCertificates')){const [accountId,...rest]=String(row.certificateId).split(':');const deviceId=rest.join(':');const item=await this.getCertificate(accountId,deviceId);if(item)out.push(item);}return out;}
  async putRevocation(revocation){const id=revId(revocation);const sealed=await this.vault.seal(utf8(JSON.stringify(revocation)),aad('REV',id));await this.db.put('deviceRevocations',{revocationId:id,updatedAt:Date.now(),sealed});return revocation;}
  async getRevocation(accountId,deviceId){const id=`${accountId}:${deviceId}`,row=await this.db.get('deviceRevocations',id);if(!row)return null;return JSON.parse(utf8Decode(await this.vault.open(row.sealed,aad('REV',id))));}
  async listRevocations(){const out=[];for(const row of await this.db.getAll('deviceRevocations')){const [accountId,...rest]=String(row.revocationId).split(':');const item=await this.getRevocation(accountId,rest.join(':'));if(item)out.push(item);}return out;}
}
