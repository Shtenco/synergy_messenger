import { fromBase64Url, toBase64Url, utf8, utf8Decode } from './bytes.js';

export const CRYPTO_ENVELOPE_VERSION = 1;
export const CRYPTO_ENVELOPE_TYPES = Object.freeze(['prekey', 'ratchet']);

function fail(detail) {
  const error = new Error(`CRYPTO_ENVELOPE_INVALID: ${detail}`);
  error.code = 'CRYPTO_ENVELOPE_INVALID';
  throw error;
}

function pack(value) {
  if (value instanceof Uint8Array) return { $bytes:toBase64Url(value) };
  if (Array.isArray(value)) return value.map(pack);
  if (value && typeof value === 'object') {
    const out = {};
    for (const [key, child] of Object.entries(value)) out[key] = pack(child);
    return out;
  }
  return value;
}

function unpack(value) {
  if (Array.isArray(value)) return value.map(unpack);
  if (value && typeof value === 'object') {
    if (Object.keys(value).length === 1 && typeof value.$bytes === 'string') return fromBase64Url(value.$bytes);
    const out = {};
    for (const [key, child] of Object.entries(value)) out[key] = unpack(child);
    return out;
  }
  return value;
}

function nonEmpty(value) { return typeof value === 'string' && value.length > 0; }

export function validateEnvelope(envelope) {
  if (!envelope || envelope.version !== CRYPTO_ENVELOPE_VERSION) fail('version');
  if (!CRYPTO_ENVELOPE_TYPES.includes(envelope.type)) fail('type');
  if (!nonEmpty(envelope.sessionId) || !nonEmpty(envelope.senderDeviceId) || !nonEmpty(envelope.recipientDeviceId)) fail('routing');
  const ratchet = envelope.ratchet;
  if (!ratchet || ratchet.version !== 1 || !(ratchet.header?.dh instanceof Uint8Array) || ratchet.header.dh.byteLength !== 32) fail('ratchet header');
  if (!(ratchet.iv instanceof Uint8Array) || ratchet.iv.byteLength !== 12 || !(ratchet.ciphertext instanceof Uint8Array) || ratchet.ciphertext.byteLength < 16) fail('ratchet ciphertext');
  if (!Number.isSafeInteger(ratchet.header.pn) || ratchet.header.pn < 0 || !Number.isSafeInteger(ratchet.header.n) || ratchet.header.n < 0) fail('ratchet counters');
  if (envelope.type === 'prekey') {
    const initiation = envelope.initiation;
    if (!initiation || initiation.version !== 1 || !initiation.senderIdentity || !(initiation.ephemeralPublicKey instanceof Uint8Array) || !(initiation.signature instanceof Uint8Array)) fail('prekey initiation');
    if (initiation.senderIdentity.deviceId !== envelope.senderDeviceId || initiation.recipientDeviceId !== envelope.recipientDeviceId) fail('prekey routing mismatch');
  }
  return envelope;
}

export function encodeEnvelope(envelope) {
  validateEnvelope(envelope);
  return utf8(JSON.stringify(pack(envelope)));
}

export function decodeEnvelope(bytes) {
  if (!(bytes instanceof Uint8Array)) fail('encoded bytes');
  let parsed;
  try { parsed = JSON.parse(utf8Decode(bytes)); }
  catch { fail('malformed json'); }
  return validateEnvelope(unpack(parsed));
}
