import { validatePaymentEvent } from '../finance/payment-protocol.js';
import { validateMediaManifest } from '../media/media-manifest.js';
import { concatBytes, utf8, utf8Decode } from '../crypto/bytes.js';

const MAGIC = utf8('SYNERGY-APP-V1\0');
const RECEIPT_STATES = new Set(['delivered','read']);

function startsWith(bytes, prefix) {
  if (!(bytes instanceof Uint8Array) || bytes.byteLength < prefix.byteLength) return false;
  for (let i=0;i<prefix.byteLength;i+=1) if (bytes[i] !== prefix[i]) return false;
  return true;
}

function validate(payload) {
  if (!payload || payload.version !== 1) throw new Error('SECURE_PAYLOAD_VERSION_INVALID');
  if (payload.type === 'text') {
    if (typeof payload.text !== 'string' || payload.text.length === 0) throw new Error('SECURE_PAYLOAD_TEXT_INVALID');
    if (payload.reply != null && (typeof payload.reply !== 'object' || Array.isArray(payload.reply))) throw new Error('SECURE_PAYLOAD_REPLY_INVALID');
    if (payload.expiresAt != null && !Number.isFinite(payload.expiresAt)) throw new Error('SECURE_PAYLOAD_EXPIRY_INVALID');
    if (payload.logicalMessageId != null && (typeof payload.logicalMessageId !== 'string' || !payload.logicalMessageId || payload.logicalMessageId.length > 128)) throw new Error('SECURE_PAYLOAD_LOGICAL_ID_INVALID');
    return payload;
  }
  if (payload.type === 'receipt') {
    if (typeof payload.targetMessageId !== 'string' || payload.targetMessageId.length === 0 || !RECEIPT_STATES.has(payload.state)) {
      throw new Error('SECURE_PAYLOAD_RECEIPT_INVALID');
    }
    return payload;
  }
  if (payload.type === 'media') {
    validateMediaManifest(payload.manifest);
    return payload;
  }
  if (payload.type === 'payment') {
    validatePaymentEvent(payload.payment);
    return payload;
  }
  if (payload.type === 'group-control') {
    const c=payload.control;
    if(!c||c.action!=='welcome'||typeof c.groupId!=='string'||!c.groupId||typeof c.title!=='string'||typeof c.ownerDeviceId!=='string'||!c.ownerDeviceId||typeof c.welcome!=='string'||!c.welcome) throw new Error('SECURE_PAYLOAD_GROUP_CONTROL_INVALID');
    return payload;
  }
  throw new Error('SECURE_PAYLOAD_TYPE_INVALID');
}

export function encodeSecurePayload(payload) {
  validate(payload);
  return concatBytes(MAGIC, utf8(JSON.stringify(payload)));
}

export function decodeSecurePayload(bytes) {
  if (!(bytes instanceof Uint8Array)) throw new Error('SECURE_PAYLOAD_BYTES_REQUIRED');
  if (!startsWith(bytes, MAGIC)) return { version:0, type:'text', text:utf8Decode(bytes), legacy:true };
  let payload;
  try { payload = JSON.parse(utf8Decode(bytes.subarray(MAGIC.byteLength))); }
  catch { throw new Error('SECURE_PAYLOAD_JSON_INVALID'); }
  return validate(payload);
}
