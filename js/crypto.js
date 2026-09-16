/**
 * SYNERGY MESSENGER — Crypto Module v2
 * Double Ratchet (Signal-style) + X3DH-inspired handshake
 */

const DB_NAME = 'synergy-messenger-crypto-v2';
const DB_VERSION = 2;
const STORE_KEYS = 'keys';

const encoder = new TextEncoder();
const decoder = new TextDecoder();

function bufToHex(buf) {
  return [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, '0')).join('');
}
function hexToBuf(hex) {
  const a = new Uint8Array(hex.length / 2);
  for (let i = 0; i < a.length; i++) a[i] = parseInt(hex.substr(i * 2, 2), 16);
  return a.buffer;
}
function bufToB64(buf) {
  return btoa(String.fromCharCode(...new Uint8Array(buf)));
}
function b64ToBuf(b64) {
  return Uint8Array.from(atob(b64), c => c.charCodeAt(0)).buffer;
}
function randomBytes(n) {
  const a = new Uint8Array(n);
  crypto.getRandomValues(a);
  return a;
}
function concatBufs(...bufs) {
  const total = bufs.reduce((s, b) => s + b.byteLength, 0);
  const out = new Uint8Array(total);
  let off = 0;
  for (const b of bufs) {
    out.set(new Uint8Array(b), off);
    off += b.byteLength;
  }
  return out.buffer;
}

async function hkdf(ikm, salt, info, length = 32) {
  const key = await crypto.subtle.importKey('raw', ikm, 'HKDF', false, ['deriveBits']);
  return crypto.subtle.deriveBits(
    { name: 'HKDF', hash: 'SHA-256', salt, info: encoder.encode(info) },
    key,
    length * 8
  );
}

async function kdfCk(chainKey) {
  const mk = await hkdf(chainKey, new Uint8Array(32), 'SynergyMK', 32);
  const nextCk = await hkdf(chainKey, new Uint8Array(32), 'SynergyCK', 32);
  return { messageKey: mk, nextChainKey: nextCk };
}

async function kdfRk(rootKey, dhOut) {
  const material = await hkdf(concatBufs(rootKey, dhOut), new Uint8Array(32), 'SynergyRK', 64);
  return {
    rootKey: material.slice(0, 32),
    chainKey: material.slice(32, 64)
  };
}

async function generateECDH() {
  return crypto.subtle.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, true, ['deriveBits']);
}

async function exportPublicRaw(key) {
  return bufToHex(await crypto.subtle.exportKey('raw', key));
}

async function importPublicRaw(hex) {
  return crypto.subtle.importKey('raw', hexToBuf(hex), { name: 'ECDH', namedCurve: 'P-256' }, true, []);
}

async function exportPrivateJwk(key) {
  return crypto.subtle.exportKey('jwk', key);
}

async function importPrivateJwk(jwk) {
  return crypto.subtle.importKey('jwk', jwk, { name: 'ECDH', namedCurve: 'P-256' }, true, ['deriveBits']);
}

async function ecdh(privateKey, publicKey) {
  return crypto.subtle.deriveBits({ name: 'ECDH', public: publicKey }, privateKey, 256);
}

async function fingerprint(publicKeyOrHex) {
  let raw;
  if (typeof publicKeyOrHex === 'string') raw = hexToBuf(publicKeyOrHex);
  else raw = await crypto.subtle.exportKey('raw', publicKeyOrHex);
  const hash = await crypto.subtle.digest('SHA-256', raw);
  return bufToHex(hash).slice(0, 40).match(/.{1,4}/g).join(' ').toUpperCase();
}

let identity = null;
const sessions = new Map();

async function generateIdentity() {
  const pair = await generateECDH();
  const signedPreKey = await generateECDH();
  const pubHex = await exportPublicRaw(pair.publicKey);
  const fp = await fingerprint(pair.publicKey);
  return {
    pair,
    pubHex,
    fingerprint: fp,
    signedPreKey,
    signedPreKeyPub: await exportPublicRaw(signedPreKey.publicKey)
  };
}

function emptySession() {
  return {
    DHs: null,
    DHr: null,
    RK: null,
    CKs: null,
    CKr: null,
    Ns: 0,
    Nr: 0,
    PN: 0,
    MKSKIPPED: {},
    peerIdentityPub: null,
    established: false
  };
}

async function x3dhInitiate(myIdentity, peerIdentityPubHex, peerSignedPreKeyPubHex) {
  const peerIdPub = await importPublicRaw(peerIdentityPubHex);
  const peerSpk = await importPublicRaw(peerSignedPreKeyPubHex || peerIdentityPubHex);
  const EK = await generateECDH();
  const dh1 = await ecdh(myIdentity.pair.privateKey, peerSpk);
  const dh2 = await ecdh(EK.privateKey, peerIdPub);
  const dh3 = await ecdh(EK.privateKey, peerSpk);
  const master = await hkdf(concatBufs(dh1, dh2, dh3), new Uint8Array(32), 'SynergyX3DH', 32);
  return {
    sharedSecret: master,
    ephemeralPub: await exportPublicRaw(EK.publicKey),
    ephemeralPair: EK
  };
}

async function x3dhRespond(myIdentity, peerIdentityPubHex, peerEphemeralPubHex) {
  const peerIdPub = await importPublicRaw(peerIdentityPubHex);
  const peerEK = await importPublicRaw(peerEphemeralPubHex);
  const dh1 = await ecdh(myIdentity.signedPreKey.privateKey, peerIdPub);
  const dh2 = await ecdh(myIdentity.pair.privateKey, peerEK);
  const dh3 = await ecdh(myIdentity.signedPreKey.privateKey, peerEK);
  return hkdf(concatBufs(dh1, dh2, dh3), new Uint8Array(32), 'SynergyX3DH', 32);
}

async function ratchetInitAlice(session, sharedSecret, peerRatchetPubHex) {
  const p = await generateECDH();
  session.DHs = {
    privateKey: p.privateKey,
    publicKey: p.publicKey,
    pubHex: await exportPublicRaw(p.publicKey)
  };
  session.DHr = peerRatchetPubHex;
  session.RK = sharedSecret;
  const peerPub = await importPublicRaw(peerRatchetPubHex);
  const dhOut = await ecdh(session.DHs.privateKey, peerPub);
  const { rootKey, chainKey } = await kdfRk(session.RK, dhOut);
  session.RK = rootKey;
  session.CKs = chainKey;
  session.established = true;
  return session;
}

async function ratchetInitBob(session, sharedSecret, myRatchetPair) {
  session.DHs = {
    privateKey: myRatchetPair.privateKey,
    publicKey: myRatchetPair.publicKey,
    pubHex: await exportPublicRaw(myRatchetPair.publicKey)
  };
  session.RK = sharedSecret;
  session.established = true;
  return session;
}

async function dhRatchet(session, peerDhPubHex) {
  session.PN = session.Ns;
  session.Ns = 0;
  session.Nr = 0;
  session.DHr = peerDhPubHex;
  const peerPub = await importPublicRaw(peerDhPubHex);
  let dhOut = await ecdh(session.DHs.privateKey, peerPub);
  let derived = await kdfRk(session.RK, dhOut);
  session.RK = derived.rootKey;
  session.CKr = derived.chainKey;
  const newDHs = await generateECDH();
  session.DHs = {
    privateKey: newDHs.privateKey,
    publicKey: newDHs.publicKey,
    pubHex: await exportPublicRaw(newDHs.publicKey)
  };
  dhOut = await ecdh(session.DHs.privateKey, peerPub);
  derived = await kdfRk(session.RK, dhOut);
  session.RK = derived.rootKey;
  session.CKs = derived.chainKey;
}

async function ratchetEncrypt(session, plaintext) {
  if (!session.established || !session.CKs) throw new Error('Session not ready');
  const { messageKey, nextChainKey } = await kdfCk(session.CKs);
  session.CKs = nextChainKey;
  const header = { dh: session.DHs.pubHex, pn: session.PN, n: session.Ns };
  session.Ns += 1;
  const iv = randomBytes(12);
  const aesKey = await crypto.subtle.importKey('raw', messageKey, 'AES-GCM', false, ['encrypt']);
  const ad = encoder.encode(JSON.stringify(header));
  const cipherBuf = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv, additionalData: ad },
    aesKey,
    encoder.encode(plaintext)
  );
  return { header, ciphertext: bufToB64(cipherBuf), iv: bufToB64(iv) };
}

async function decryptWithMk(messageKey, header, ciphertextB64, ivB64) {
  const aesKey = await crypto.subtle.importKey('raw', messageKey, 'AES-GCM', false, ['decrypt']);
  const ad = encoder.encode(JSON.stringify(header));
  const plain = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: new Uint8Array(b64ToBuf(ivB64)), additionalData: ad },
    aesKey,
    b64ToBuf(ciphertextB64)
  );
  return decoder.decode(plain);
}

async function trySkipped(session, header, ciphertext, iv) {
  const keyId = header.dh + '|' + header.n;
  const mk = session.MKSKIPPED[keyId];
  if (!mk) return null;
  delete session.MKSKIPPED[keyId];
  return decryptWithMk(mk, header, ciphertext, iv);
}

async function skipMessageKeys(session, until) {
  if (!session.CKr) return;
  while (session.Nr < until) {
    const { messageKey, nextChainKey } = await kdfCk(session.CKr);
    session.CKr = nextChainKey;
    session.MKSKIPPED[session.DHr + '|' + session.Nr] = messageKey;
    session.Nr += 1;
    if (Object.keys(session.MKSKIPPED).length > 100) {
      delete session.MKSKIPPED[Object.keys(session.MKSKIPPED)[0]];
    }
  }
}

async function ratchetDecrypt(session, pkg) {
  const { header, ciphertext, iv } = pkg;
  const skipped = await trySkipped(session, header, ciphertext, iv);
  if (skipped !== null) return skipped;
  if (header.dh !== session.DHr) {
    await skipMessageKeys(session, header.pn);
    await dhRatchet(session, header.dh);
  }
  await skipMessageKeys(session, header.n);
  const { messageKey, nextChainKey } = await kdfCk(session.CKr);
  session.CKr = nextChainKey;
  session.Nr += 1;
  return decryptWithMk(messageKey, header, ciphertext, iv);
}

async function openDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE_KEYS)) db.createObjectStore(STORE_KEYS);
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function saveIdentityToDB(id) {
  const data = {
    pubHex: id.pubHex,
    privJwk: await exportPrivateJwk(id.pair.privateKey),
    fingerprint: id.fingerprint,
    signedPreKeyPub: id.signedPreKeyPub,
    spkPrivJwk: await exportPrivateJwk(id.signedPreKey.privateKey)
  };
  try {
    const db = await openDB();
    const tx = db.transaction(STORE_KEYS, 'readwrite');
    tx.objectStore(STORE_KEYS).put(data, 'identity');
    await new Promise((r, j) => { tx.oncomplete = r; tx.onerror = () => j(tx.error); });
  } catch {
    localStorage.setItem('synergy_id_v2', JSON.stringify(data));
  }
}

async function loadIdentityFromDB() {
  let data = null;
  try {
    const db = await openDB();
    const tx = db.transaction(STORE_KEYS, 'readonly');
    const req = tx.objectStore(STORE_KEYS).get('identity');
    data = await new Promise((r, j) => { req.onsuccess = () => r(req.result); req.onerror = () => j(req.error); });
  } catch {
    const raw = localStorage.getItem('synergy_id_v2');
    if (raw) data = JSON.parse(raw);
  }
  if (!data) return null;
  const privateKey = await importPrivateJwk(data.privJwk);
  const publicKey = await importPublicRaw(data.pubHex);
  const spkPriv = await importPrivateJwk(data.spkPrivJwk);
  const spkPub = await importPublicRaw(data.signedPreKeyPub);
  return {
    pair: { privateKey, publicKey },
    pubHex: data.pubHex,
    fingerprint: data.fingerprint,
    signedPreKey: { privateKey: spkPriv, publicKey: spkPub },
    signedPreKeyPub: data.signedPreKeyPub
  };
}

async function ensureIdentity() {
  identity = await loadIdentityFromDB();
  if (!identity) {
    identity = await generateIdentity();
    await saveIdentityToDB(identity);
  }
  return {
    pubHex: identity.pubHex,
    fingerprint: identity.fingerprint,
    signedPreKeyPub: identity.signedPreKeyPub
  };
}

function getIdentity() { return identity; }
function getFingerprint() { return identity ? identity.fingerprint : null; }

async function createDemoSession(chatId) {
  const peerId = await generateIdentity();
  const x3dh = await x3dhInitiate(identity, peerId.pubHex, peerId.signedPreKeyPub);
  const session = emptySession();
  session.peerIdentityPub = peerId.pubHex;
  await ratchetInitAlice(session, x3dh.sharedSecret, peerId.pubHex);
  sessions.set(chatId, session);

  const peerSession = emptySession();
  peerSession.peerIdentityPub = identity.pubHex;
  const shared = await x3dhRespond(peerId, identity.pubHex, x3dh.ephemeralPub);
  const peerRatchet = await generateECDH();
  await ratchetInitBob(peerSession, shared, peerRatchet);
  sessions.set(chatId + ':peer', peerSession);
  sessions.set(chatId + ':peerIdentity', peerId);

  return {
    peerPub: peerId.pubHex,
    peerFingerprint: peerId.fingerprint,
    session
  };
}

async function encryptForChat(chatId, plaintext) {
  const session = sessions.get(chatId);
  if (!session) throw new Error('No session for chat ' + chatId);
  return ratchetEncrypt(session, plaintext);
}

async function decryptForChat(chatId, pkg) {
  const session = sessions.get(chatId);
  if (!session) throw new Error('No session for chat ' + chatId);
  return ratchetDecrypt(session, pkg);
}

async function encryptAsPeer(chatId, plaintext) {
  const peerSession = sessions.get(chatId + ':peer');
  if (!peerSession) throw new Error('No peer session');
  if (!peerSession.CKs) {
    const ourSession = sessions.get(chatId);
    if (ourSession && ourSession.DHs && ourSession.DHs.pubHex) {
      await dhRatchet(peerSession, ourSession.DHs.pubHex);
    }
  }
  return ratchetEncrypt(peerSession, plaintext);
}

async function createGroupSenderKey(groupId) {
  const chainKey = randomBytes(32);
  return {
    groupId,
    chainKey: bufToHex(chainKey),
    generation: 0,
    counter: 0
  };
}

async function groupEncrypt(senderKeyState, plaintext) {
  const ck = hexToBuf(senderKeyState.chainKey);
  const { messageKey, nextChainKey } = await kdfCk(ck);
  senderKeyState.chainKey = bufToHex(nextChainKey);
  senderKeyState.counter += 1;
  const iv = randomBytes(12);
  const aesKey = await crypto.subtle.importKey('raw', messageKey, 'AES-GCM', false, ['encrypt']);
  const cipherBuf = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    aesKey,
    encoder.encode(plaintext)
  );
  return {
    generation: senderKeyState.generation,
    counter: senderKeyState.counter - 1,
    ciphertext: bufToB64(cipherBuf),
    iv: bufToB64(iv)
  };
}

export {
  ensureIdentity,
  getIdentity,
  getFingerprint,
  createDemoSession,
  encryptForChat,
  decryptForChat,
  encryptAsPeer,
  createGroupSenderKey,
  groupEncrypt,
  fingerprint,
  exportPublicRaw,
  generateECDH
};
