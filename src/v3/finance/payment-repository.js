import { utf8, utf8Decode } from '../crypto/bytes.js';
import { validatePaymentIntent, validatePaymentReceipt } from './payment-protocol.js';
function aad(id){return utf8(`SYNERGY-PAYMENT-V1|${id}`);}
function validateRecord(r){if(!r?.paymentId||!r?.chatId||!r?.state||!Number.isFinite(r?.createdAt)||!Number.isFinite(r?.updatedAt))throw new Error('PAYMENT_RECORD_INVALID');validatePaymentIntent(r.intent);if(r.intent.paymentId!==r.paymentId||r.intent.chatId!==r.chatId)throw new Error('PAYMENT_RECORD_BINDING_INVALID');if(r.receipt)validatePaymentReceipt(r.receipt);return r;}
export class PaymentRepository{
  constructor({db,vault}={}){if(!db||!vault)throw new Error('PAYMENT_REPOSITORY_DEPENDENCY_REQUIRED');this.db=db;this.vault=vault;}
  async put(record){validateRecord(record);const sealed=await this.vault.seal(utf8(JSON.stringify(record)),aad(record.paymentId));await this.db.put('payments',{paymentId:record.paymentId,chatId:record.chatId,updatedAt:record.updatedAt,sealed});return record;}
  async get(paymentId){const row=await this.db.get('payments',paymentId);if(!row)return null;const plain=await this.vault.open(row.sealed,aad(row.paymentId));return validateRecord(JSON.parse(utf8Decode(plain)));}
  async listByChat(chatId){const rows=(await this.db.getAll('payments')).filter(x=>x.chatId===chatId).sort((a,b)=>(a.updatedAt||0)-(b.updatedAt||0));const out=[];for(const row of rows){const item=await this.get(row.paymentId);if(item)out.push(item);}return out;}
  async update(paymentId,fn){const cur=await this.get(paymentId);if(!cur)return null;const next=await fn(structuredClone(cur));if(!next||next.paymentId!==paymentId)throw new Error('PAYMENT_RECORD_UPDATE_INVALID');await this.put(next);return next;}
  async delete(paymentId){return this.db.delete('payments',paymentId);}
}
