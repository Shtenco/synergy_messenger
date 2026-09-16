import { toBase64Url } from '../crypto/bytes.js';
import { verifyDeviceCertificate, verifyDeviceRevocation } from './account-root-manager.js';

function sameBundle(cert,bundle){const i=bundle?.identity;return !!i&&i.deviceId===cert.deviceId&&i.fingerprint===cert.fingerprint&&toBase64Url(i.signingPublicKey)===cert.signingPublicKey&&(cert.mailbox==null||i.mailbox===cert.mailbox);}
export class MultiDeviceDirectory{
  constructor({repository,provider,accountId,rootPublicKey,verifyBundle=null,clock={now:()=>Date.now()}}={}){if(!repository||!provider||!accountId||!(rootPublicKey instanceof Uint8Array))throw new Error('MULTIDEVICE_DIRECTORY_DEPENDENCY_REQUIRED');this.repository=repository;this.provider=provider;this.accountId=accountId;this.rootPublicKey=rootPublicKey;this.verifyBundle=verifyBundle;this.clock=clock;}
  async addDevice({certificate,bundle}={}){
    if(certificate?.accountId!==this.accountId||!sameBundle(certificate,bundle))throw new Error('DEVICE_BUNDLE_CERTIFICATE_MISMATCH');
    if(!await verifyDeviceCertificate(this.provider,certificate,this.rootPublicKey,{now:this.clock.now()}))throw new Error('DEVICE_CERTIFICATE_INVALID');
    if(this.verifyBundle&&!(await this.verifyBundle(bundle)))throw new Error('DEVICE_BUNDLE_INVALID');
    const rev=await this.repository.getRevocation(this.accountId,certificate.deviceId);if(rev&&rev.generation>=certificate.generation)throw new Error('DEVICE_REVOKED');
    const current=await this.repository.getCertificate(this.accountId,certificate.deviceId);if(current&&current.certificate.generation>certificate.generation)throw new Error('DEVICE_CERTIFICATE_STALE');
    await this.repository.putCertificate({certificate,bundle});return {certificate,bundle};
  }
  async applyRevocation(revocation){
    const existing=await this.repository.getRevocation(this.accountId,revocation?.deviceId);if(existing&&revocation.generation<=existing.generation)throw new Error('DEVICE_REVOCATION_STALE');
    if(revocation?.accountId!==this.accountId||!await verifyDeviceRevocation(this.provider,revocation,this.rootPublicKey))throw new Error('DEVICE_REVOCATION_INVALID');
    await this.repository.putRevocation(revocation);return revocation;
  }
  async listActiveDevices(){const now=this.clock.now(),out=[];for(const item of await this.repository.listCertificates()){const c=item.certificate;if(c.accountId!==this.accountId||now<c.issuedAt||now>=c.expiresAt)continue;const rev=await this.repository.getRevocation(this.accountId,c.deviceId);if(rev&&rev.generation>=c.generation)continue;out.push(item);}return out.sort((a,b)=>a.certificate.deviceId.localeCompare(b.certificate.deviceId));}
}
