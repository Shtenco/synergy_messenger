export const PACKET_VERSION = 3;
export const PACKET_MAX_BYTES = 256 * 1024;
export const PACKET_KINDS = Object.freeze(['message', 'receipt', 'signal', 'control']);

const encoder = new TextEncoder();
const decoder = new TextDecoder();

function fail(code, detail) {
  const error = new Error(`${code}: ${detail}`);
  error.code = code;
  throw error;
}

function isNonEmptyString(value) {
  return typeof value === 'string' && value.trim().length > 0;
}

function bytesToBase64(bytes) {
  let binary = '';
  const chunkSize = 0x8000;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
  }
  return btoa(binary);
}

function base64ToBytes(value) {
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

export function validatePacket(packet) {
  if (!packet || typeof packet !== 'object') fail('PACKET_INVALID', 'packet must be an object');
  if (packet.version !== PACKET_VERSION) fail('PACKET_INVALID', 'unsupported packet version');
  if (!isNonEmptyString(packet.messageId)) fail('PACKET_INVALID', 'messageId is required');
  if (!PACKET_KINDS.includes(packet.kind)) fail('PACKET_INVALID', 'unsupported packet kind');
  if (!isNonEmptyString(packet.senderDeviceId)) fail('PACKET_INVALID', 'senderDeviceId is required');
  if (!isNonEmptyString(packet.recipientMailbox)) fail('PACKET_INVALID', 'recipientMailbox is required');
  if (!Number.isFinite(packet.createdAt) || packet.createdAt < 0) fail('PACKET_INVALID', 'createdAt is invalid');
  if (packet.expiresAt !== null && packet.expiresAt !== undefined) {
    if (!Number.isFinite(packet.expiresAt) || packet.expiresAt <= packet.createdAt) {
      fail('PACKET_INVALID', 'expiresAt must be greater than createdAt');
    }
  }
  if (!(packet.body instanceof Uint8Array)) fail('PACKET_INVALID', 'body must be Uint8Array');
  if (packet.body.byteLength > PACKET_MAX_BYTES) fail('PACKET_TOO_LARGE', 'packet body exceeds 256 KiB');
  return packet;
}

export function createPacket(input, dependencies = {}) {
  const randomUUID = dependencies.randomUUID || globalThis.crypto?.randomUUID?.bind(globalThis.crypto);
  if (!randomUUID && !isNonEmptyString(input?.messageId)) fail('PACKET_INVALID', 'randomUUID is unavailable');
  const packet = Object.freeze({
    version: PACKET_VERSION,
    messageId: input?.messageId || randomUUID(),
    kind: input?.kind,
    senderDeviceId: input?.senderDeviceId,
    recipientMailbox: input?.recipientMailbox,
    createdAt: input?.createdAt,
    expiresAt: input?.expiresAt ?? null,
    body: input?.body instanceof Uint8Array ? new Uint8Array(input.body) : input?.body
  });
  return validatePacket(packet);
}

export function encodePacket(packet) {
  validatePacket(packet);
  const wire = {
    version: packet.version,
    messageId: packet.messageId,
    kind: packet.kind,
    senderDeviceId: packet.senderDeviceId,
    recipientMailbox: packet.recipientMailbox,
    createdAt: packet.createdAt,
    expiresAt: packet.expiresAt ?? null,
    body: bytesToBase64(packet.body)
  };
  const bytes = encoder.encode(JSON.stringify(wire));
  if (bytes.byteLength > PACKET_MAX_BYTES) fail('PACKET_TOO_LARGE', 'encoded packet exceeds 256 KiB');
  return bytes;
}

export function decodePacket(bytes) {
  if (!(bytes instanceof Uint8Array)) fail('PACKET_INVALID', 'encoded packet must be Uint8Array');
  if (bytes.byteLength > PACKET_MAX_BYTES) fail('PACKET_TOO_LARGE', 'encoded packet exceeds 256 KiB');
  let wire;
  try {
    wire = JSON.parse(decoder.decode(bytes));
  } catch {
    fail('PACKET_INVALID', 'encoded packet is malformed');
  }
  let body;
  try {
    body = base64ToBytes(wire.body);
  } catch {
    fail('PACKET_INVALID', 'encoded body is malformed');
  }
  return createPacket({ ...wire, body });
}
