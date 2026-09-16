import { fromBase64Url, toBase64Url, utf8 } from '../crypto/bytes.js';

const ROOT_ID='local-v1';
function canonicalLinkRequest(r){return utf8(JSON.stringify({version:1,deviceId:r.deviceId,fingerprint:r.fingerprint,signingPublicKey:r.signingPublicKey,mailbox:r.mailbox||null,nonce:r.nonce,createdAt:r.createdAt}));}
function canonicalCertificate(c){return utf8(JSON.stringify({version:1,accountId:c.accountId,deviceId:c.deviceId,fingerprint:c.fingerprint,signingPublicKey:c.signingPublicKey,mailbox:c.mailbox||null,issuedAt:c.issuedAt,expiresAt:c.expiresAt,generation:c.generation}));}
function canonicalRevocation(r){return utf8(JSON.stringify({version:1,accountId:r.accountId,deviceId:r.deviceId,generation:r.generation,revokedAt:r.revokedAt,reason:r.reason||null}));}
function asB64(value){return value instanceof Uint8Array?toBase64Url(value):String(value||'');}

export async function createDeviceLinkRequest(provider,identity,{nonce=null,createdAt=Date.now()}={}){
  if(!provider||!identity?.deviceId||!identity?.fingerprint||!(identity.signingPublicKey instanceof Uint8Array)||!identity.signingPrivateKey)throw new Error('DEVICE_LINK_IDENTITY_INVALID');
  const n=nonce||provider.randomBytes(32);if(!(n instanceof Uint8Array)||n.byteLength!==32)throw new Error('DEVICE_LINK_NONCE_INVALID');
  const request={version:1,deviceId:identity.deviceId,fingerprint:identity.fingerprint,signingPublicKey:toBase64Url(identity.signingPublicKey),...(identity.mailbox?{mailbox:String(identity.mailbox)}:{}),nonce:toBase64Url(n),createdAt:Number(createdAt)};
  request.proof=toBase64Url(await provider.sign(identity.signingPrivateKey,canonicalLinkRequest(request)));
  return request;
}
export async function verifyDeviceLinkRequest(provider,request,{now=null,maxAgeMs=10*60*1000}={}){
  try{
    if(request?.version!==1||!request.deviceId||!request.fingerprint||!request.signingPublicKey||!request.nonce||!request.proof||!Number.isFinite(request.createdAt))return false;
    if(fromBase64Url(request.nonce).byteLength!==32)return false;if(now!=null&&(request.createdAt>now+60_000||now-request.createdAt>maxAgeMs))return false;
    const pub=await provider.importSigningPublic(fromBase64Url(request.signingPublicKey));return await provider.verify(pub,fromBase64Url(request.proof),canonicalLinkRequest(request));
  }catch{return false;}
}
export async function verifyDeviceCertificate(provider,certificate,rootPublicKey,{now=null}={}){
  try{
    if(certificate?.version!==1||!certificate.accountId||!certificate.deviceId||!certificate.fingerprint||!certificate.signingPublicKey||!certificate.signature||!Number.isSafeInteger(certificate.generation)||certificate.generation<1||!Number.isFinite(certificate.issuedAt)||!Number.isFinite(certificate.expiresAt)||certificate.expiresAt<=certificate.issuedAt)return false;
    if(now!=null&&(now<certificate.issuedAt||now>=certificate.expiresAt))return false;
    const pub=rootPublicKey instanceof Uint8Array?await provider.importSigningPublic(rootPublicKey):rootPublicKey;
    return await provider.verify(pub,fromBase64Url(certificate.signature),canonicalCertificate(certificate));
  }catch{return false;}
}
export async function verifyDeviceRevocation(provider,revocation,rootPublicKey){
  try{
    if(revocation?.version!==1||!revocation.accountId||!revocation.deviceId||!Number.isSafeInteger(revocation.generation)||revocation.generation<1||!Number.isFinite(revocation.revokedAt)||!revocation.signature)return false;
    const pub=rootPublicKey instanceof Uint8Array?await provider.importSigningPublic(rootPublicKey):rootPublicKey;
    return await provider.verify(pub,fromBase64Url(revocation.signature),canonicalRevocation(revocation));
  }catch{return false;}
}

export class AccountRootManager {
  constructor({db,provider,clock={now:()=>Date.now()}}={}){if(!db||!provider)throw new Error('ACCOUNT_ROOT_DEPENDENCY_REQUIRED');this.db=db;this.provider=provider;this.clock=clock;}
  async getRoot(){const row=await this.db.get('accountRoots',ROOT_ID);if(!row)return null;return {version:1,accountId:row.accountId,rootPublicKey:new Uint8Array(row.rootPublicKey),createdAt:row.createdAt,hasPrivateKey:!!row.rootPrivateKey};}
  async ensureRoot(localIdentity){
    let row=await this.db.get('accountRoots',ROOT_ID);if(!row){if(!localIdentity?.deviceId)throw new Error('ACCOUNT_ROOT_LOCAL_IDENTITY_REQUIRED');const pair=await this.provider.generateSigningKeyPair();const rootPublicKey=await this.provider.exportPublicKey(pair.publicKey);const digest=await this.provider.sha256(utf8(`SYNERGY-ACCOUNT-ROOT-V1|${toBase64Url(rootPublicKey)}`));const accountId=`SYNACC-${toBase64Url(digest.subarray(0,20))}`;row={rootId:ROOT_ID,version:1,accountId,rootPrivateKey:pair.privateKey,rootPublicKey,createdAt:this.clock.now(),primaryDeviceId:localIdentity.deviceId};await this.db.put('accountRoots',row);}
    return {version:1,accountId:row.accountId,rootPublicKey:new Uint8Array(row.rootPublicKey),createdAt:row.createdAt,hasPrivateKey:!!row.rootPrivateKey};
  }
  async importPublicRoot({accountId,rootPublicKey,createdAt=0}={}){if(!accountId||!(rootPublicKey instanceof Uint8Array))throw new Error('ACCOUNT_ROOT_PUBLIC_INVALID');const existing=await this.db.get('accountRoots',ROOT_ID);if(existing?.rootPrivateKey&&existing.accountId!==accountId)throw new Error('ACCOUNT_ROOT_CONFLICT');await this.db.put('accountRoots',{rootId:ROOT_ID,version:1,accountId,rootPublicKey:new Uint8Array(rootPublicKey),createdAt,rootPrivateKey:existing?.accountId===accountId?existing.rootPrivateKey:null});return this.getRoot();}
  async issueDeviceCertificate(request,{expiresAt,generation}={}){
    const row=await this.db.get('accountRoots',ROOT_ID);if(!row?.rootPrivateKey)throw new Error('ACCOUNT_ROOT_PRIVATE_UNAVAILABLE');const now=this.clock.now();if(!await verifyDeviceLinkRequest(this.provider,request,{now}))throw new Error('DEVICE_LINK_PROOF_INVALID');if(!Number.isFinite(expiresAt)||expiresAt<=now||!Number.isSafeInteger(generation)||generation<1)throw new Error('DEVICE_CERTIFICATE_POLICY_INVALID');
    const cert={version:1,accountId:row.accountId,deviceId:request.deviceId,fingerprint:request.fingerprint,signingPublicKey:request.signingPublicKey,...(request.mailbox?{mailbox:request.mailbox}:{}),issuedAt:now,expiresAt,generation};cert.signature=toBase64Url(await this.provider.sign(row.rootPrivateKey,canonicalCertificate(cert)));return cert;
  }
  async createRevocation({deviceId,generation,reason=null}={}){const row=await this.db.get('accountRoots',ROOT_ID);if(!row?.rootPrivateKey)throw new Error('ACCOUNT_ROOT_PRIVATE_UNAVAILABLE');if(!deviceId||!Number.isSafeInteger(generation)||generation<1)throw new Error('DEVICE_REVOCATION_INVALID');const rev={version:1,accountId:row.accountId,deviceId,generation,revokedAt:this.clock.now(),reason:reason?String(reason).slice(0,80):null};rev.signature=toBase64Url(await this.provider.sign(row.rootPrivateKey,canonicalRevocation(rev)));return rev;}
}
