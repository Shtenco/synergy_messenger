import { encodeSecurePayload, decodeSecurePayload } from './core/secure-payload.js';
import { encodeEnvelope, decodeEnvelope } from './crypto/envelope.js';

export class SecureMessengerCore {
  constructor({ p2pCore, cryptoEngine, clock = { now:()=>Date.now() } } = {}) {
    if (!p2pCore || !cryptoEngine) throw new Error('SECURE_MESSENGER_DEPENDENCY_REQUIRED');
    this.p2pCore=p2pCore; this.cryptoEngine=cryptoEngine; this.clock=clock; this.handlers=new Set(); this.offPacket=null;
  }
  async start(options={}) { await this.p2pCore.start(options); this.offPacket=this.p2pCore.onPacket(async p=>{try{const e=decodeEnvelope(p.body);const opened=await this.cryptoEngine.decrypt(e);const payload=decodeSecurePayload(opened.plaintext);for(const h of this.handlers)await h({packet:p,envelope:e,payload,peerFingerprint:opened.peerFingerprint});}catch{}}); }
  async stop(){this.offPacket?.();this.offPacket=null;return this.p2pCore.stop();}
  onMessage(handler){this.handlers.add(handler);return()=>this.handlers.delete(handler);}
  async sendPayload(peerBundle,payload,{messageId=null,expiresAt=null}={}){const plain=encodeSecurePayload(payload);const envelope=await this.cryptoEngine.encrypt(peerBundle,plain,{messageId});return this.p2pCore.send(peerBundle.identity.mailbox,encodeEnvelope(envelope),{kind:'message',messageId:envelope.messageId,expiresAt});}
  sendText(peerBundle,text,options={}){return this.sendPayload(peerBundle,{version:1,type:'text',text,...(options.logicalMessageId?{logicalMessageId:options.logicalMessageId}:{}),...(options.reply?{reply:options.reply}:{}),...(options.expiresAt?{expiresAt:options.expiresAt}:{})},options);}
  sendReceipt(peerBundle,receipt,options={}){return this.sendPayload(peerBundle,{version:1,type:'receipt',...receipt},options);}
  getPublicBundle(options={}){return this.cryptoEngine.getPublicBundle(options);}
}
