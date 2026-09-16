import { concatBytes, utf8 } from '../bytes.js';
import { deriveIdentityMetadata } from '../identity/identity-manager.js';
import { signedPreKeyTranscript } from '../prekeys/prekey-manager.js';

function fail(code, detail = '') {
  const error = new Error(`${code}${detail ? `: ${detail}` : ''}`);
  error.code = code;
  throw error;
}

function initiationTranscript(initiation) {
  const i = initiation;
  return concatBytes(
    utf8('SYNERGY-X3DH-INIT-V1\0'),
    utf8(i.senderIdentity.deviceId), utf8('\0'),
    i.senderIdentity.signingPublicKey,
    i.senderIdentity.identityDhPublicKey,
    utf8(i.recipientDeviceId), utf8('\0'),
    utf8(i.recipientSignedPreKeyId), utf8('\0'),
    utf8(i.recipientOneTimePreKeyId || ''), utf8('\0'),
    i.ephemeralPublicKey
  );
}

async function verifyRemoteBundle(provider, bundle) {
  if (!bundle || bundle.version !== 1 || !bundle.identity || !bundle.signedPreKey) fail('PREKEY_BUNDLE_INVALID');
  const metadata = await deriveIdentityMetadata(provider, bundle.identity);
  if (metadata.mailbox !== bundle.identity.mailbox || metadata.fingerprint !== bundle.identity.fingerprint) fail('PREKEY_BUNDLE_INVALID');
  const signingPublic = await provider.importSigningPublic(bundle.identity.signingPublicKey);
  const ok = await provider.verify(signingPublic, bundle.signedPreKey.signature, signedPreKeyTranscript({
    deviceId:bundle.identity.deviceId,
    id:bundle.signedPreKey.id,
    publicKey:bundle.signedPreKey.publicKey,
    createdAt:bundle.signedPreKey.createdAt,
    expiresAt:bundle.signedPreKey.expiresAt
  }));
  if (!ok) fail('PREKEY_SIGNATURE_INVALID');
}

async function deriveSecret(provider, dhParts) {
  return provider.hkdf(concatBytes(...dhParts), {
    salt:new Uint8Array(32),
    info:utf8('SYNERGY-X3DH-V1'),
    length:32
  });
}

export async function createInitiation({ provider, localIdentityRecord, remoteBundle }) {
  if (!provider || !localIdentityRecord) fail('HANDSHAKE_INPUT_INVALID');
  await verifyRemoteBundle(provider, remoteBundle);

  const remoteSpk = await provider.importDhPublic(remoteBundle.signedPreKey.publicKey);
  const remoteIdentityDh = await provider.importDhPublic(remoteBundle.identity.identityDhPublicKey);
  const oneTime = remoteBundle.oneTimePreKeys?.[0] || null;
  const remoteOneTime = oneTime ? await provider.importDhPublic(oneTime.publicKey) : null;
  const ephemeral = await provider.generateDhKeyPair();
  const ephemeralPublicKey = await provider.exportPublicKey(ephemeral.publicKey);

  const dhParts = [
    await provider.dh(localIdentityRecord.identityDhPrivateKey, remoteSpk),
    await provider.dh(ephemeral.privateKey, remoteIdentityDh),
    await provider.dh(ephemeral.privateKey, remoteSpk)
  ];
  if (remoteOneTime) dhParts.push(await provider.dh(ephemeral.privateKey, remoteOneTime));
  const sharedSecret = await deriveSecret(provider, dhParts);

  const initiation = {
    version:1,
    senderIdentity:{
      version:1,
      deviceId:localIdentityRecord.deviceId,
      mailbox:localIdentityRecord.mailbox,
      fingerprint:localIdentityRecord.fingerprint,
      signingPublicKey:new Uint8Array(localIdentityRecord.signingPublicKey),
      identityDhPublicKey:new Uint8Array(localIdentityRecord.identityDhPublicKey)
    },
    recipientDeviceId:remoteBundle.identity.deviceId,
    recipientSignedPreKeyId:remoteBundle.signedPreKey.id,
    recipientOneTimePreKeyId:oneTime?.id || null,
    ephemeralPublicKey,
    signature:null
  };
  initiation.signature = await provider.sign(localIdentityRecord.signingPrivateKey, initiationTranscript(initiation));
  return { sharedSecret, ephemeralKeyPair:ephemeral, initiation };
}

export async function acceptInitiation({ provider, localIdentityRecord, signedPreKeyRecord, oneTimePreKeyRecord = null, initiation }) {
  if (!provider || !localIdentityRecord || !signedPreKeyRecord || !initiation || initiation.version !== 1) fail('HANDSHAKE_INPUT_INVALID');
  if (initiation.recipientDeviceId !== localIdentityRecord.deviceId) fail('HANDSHAKE_WRONG_RECIPIENT');
  if (initiation.recipientSignedPreKeyId !== signedPreKeyRecord.id) fail('HANDSHAKE_PREKEY_MISMATCH');
  if ((initiation.recipientOneTimePreKeyId || null) !== (oneTimePreKeyRecord?.id || null)) fail('HANDSHAKE_PREKEY_MISMATCH');

  const senderMetadata = await deriveIdentityMetadata(provider, initiation.senderIdentity).catch(() => null);
  if (!senderMetadata || senderMetadata.mailbox !== initiation.senderIdentity.mailbox || senderMetadata.fingerprint !== initiation.senderIdentity.fingerprint) {
    fail('HANDSHAKE_AUTH_FAILED');
  }
  const senderSigning = await provider.importSigningPublic(initiation.senderIdentity.signingPublicKey);
  const signatureOk = await provider.verify(senderSigning, initiation.signature, initiationTranscript(initiation)).catch(() => false);
  if (!signatureOk) fail('HANDSHAKE_AUTH_FAILED');

  const senderIdentityDh = await provider.importDhPublic(initiation.senderIdentity.identityDhPublicKey);
  const senderEphemeral = await provider.importDhPublic(initiation.ephemeralPublicKey);
  const dhParts = [
    await provider.dh(signedPreKeyRecord.privateKey, senderIdentityDh),
    await provider.dh(localIdentityRecord.identityDhPrivateKey, senderEphemeral),
    await provider.dh(signedPreKeyRecord.privateKey, senderEphemeral)
  ];
  if (oneTimePreKeyRecord) dhParts.push(await provider.dh(oneTimePreKeyRecord.privateKey, senderEphemeral));
  const sharedSecret = await deriveSecret(provider, dhParts);
  return { sharedSecret, senderIdentity:initiation.senderIdentity };
}

export { initiationTranscript };
