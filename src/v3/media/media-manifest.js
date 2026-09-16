export const MEDIA_PROTOCOL_VERSION = 1;
export const DEFAULT_MEDIA_CHUNK_SIZE = 48 * 1024;
export const HARD_MAX_MEDIA_BYTES = 2 * 1024 * 1024 * 1024;
const SAFE_INLINE = new Set(['image/jpeg','image/png','image/webp','image/gif']);
export const VOICE_MAX_DURATION_MS = 15 * 60 * 1000;

function fail(code) { throw new Error(code); }
export function isSafePreviewMime(mime) { return SAFE_INLINE.has(String(mime || '').toLowerCase()); }
export function sanitizeMediaName(value) {
  const name = String(value || 'file').replace(/[\\/\0-\x1f\x7f]+/g,'_').replace(/^\.+$/,'file').trim();
  return (name || 'file').slice(0,180);
}

function validateVoiceMetadata(voice,mime){
  if(voice==null)return null;
  if(!voice||voice.version!==1)fail('VOICE_METADATA_VERSION_INVALID');
  if(!String(mime||'').toLowerCase().startsWith('audio/'))fail('VOICE_METADATA_MIME_INVALID');
  if(!Number.isSafeInteger(voice.durationMs)||voice.durationMs<1||voice.durationMs>VOICE_MAX_DURATION_MS)fail('VOICE_DURATION_INVALID');
  if(!Array.isArray(voice.waveform)||voice.waveform.length<8||voice.waveform.length>64||voice.waveform.some(v=>!Number.isInteger(v)||v<0||v>100))fail('VOICE_WAVEFORM_INVALID');
  if(typeof voice.codec!=='string'||!voice.codec||voice.codec.length>40)fail('VOICE_CODEC_INVALID');
  return voice;
}


function validateReplicaDescriptor(replica,chunkCount,createdAt){
  if(replica==null)return null;
  if(!replica||replica.version!==1)fail('MEDIA_REPLICA_VERSION_INVALID');
  if(typeof replica.accessToken!=='string'||replica.accessToken.length<32||replica.accessToken.length>128)fail('MEDIA_REPLICA_TOKEN_INVALID');
  if(!Array.isArray(replica.providerIds)||!replica.providerIds.length||replica.providerIds.length>16||replica.providerIds.some(x=>typeof x!=='string'||!x||x.length>128))fail('MEDIA_REPLICA_PROVIDERS_INVALID');
  if(replica.chunkCount!==chunkCount)fail('MEDIA_REPLICA_CHUNK_COUNT_INVALID');
  if(!Number.isFinite(replica.expiresAt)||replica.expiresAt<=createdAt)fail('MEDIA_REPLICA_EXPIRY_INVALID');
  return replica;
}

export function validateMediaManifest(input) {
  const m = input;
  if (!m || m.version !== MEDIA_PROTOCOL_VERSION || typeof m.mediaId !== 'string' || !m.mediaId || m.mediaId.length > 128) fail('MEDIA_MANIFEST_INVALID');
  if (typeof m.name !== 'string' || !m.name || m.name !== sanitizeMediaName(m.name)) fail('MEDIA_MANIFEST_NAME_INVALID');
  if (typeof m.mime !== 'string' || m.mime.length > 128) fail('MEDIA_MANIFEST_MIME_INVALID');
  if (!Number.isSafeInteger(m.size) || m.size < 0 || m.size > HARD_MAX_MEDIA_BYTES) fail('MEDIA_MANIFEST_SIZE_INVALID');
  if (!Number.isSafeInteger(m.chunkSize) || m.chunkSize < 1024 || m.chunkSize > 64*1024) fail('MEDIA_MANIFEST_CHUNK_SIZE_INVALID');
  const expectedCount = Math.max(1, Math.ceil(m.size / m.chunkSize));
  if (!Number.isSafeInteger(m.chunkCount) || m.chunkCount !== expectedCount) fail('MEDIA_MANIFEST_CHUNK_COUNT_INVALID');
  if (typeof m.contentHash !== 'string' || m.contentHash.length < 8 || m.contentHash.length > 128) fail('MEDIA_MANIFEST_HASH_INVALID');
  if (typeof m.mediaKey !== 'string' || m.mediaKey.length < 8 || m.mediaKey.length > 128) fail('MEDIA_MANIFEST_KEY_INVALID');
  if (!Number.isFinite(m.createdAt)) fail('MEDIA_MANIFEST_CREATED_AT_INVALID');
  const expectedPolicy = isSafePreviewMime(m.mime) ? 'inline' : 'download';
  if (m.previewPolicy !== expectedPolicy) fail('MEDIA_MANIFEST_PREVIEW_POLICY_INVALID');
  if (m.expiresAt != null && (!Number.isFinite(m.expiresAt) || m.expiresAt <= m.createdAt)) fail('MEDIA_MANIFEST_EXPIRY_INVALID');
  validateVoiceMetadata(m.voice,m.mime);
  validateReplicaDescriptor(m.replica,m.chunkCount,m.createdAt);
  return m;
}

export function createMediaManifest(input) {
  const manifest = {
    version:MEDIA_PROTOCOL_VERSION,
    mediaId:String(input?.mediaId || ''),
    name:sanitizeMediaName(input?.name),
    mime:String(input?.mime || 'application/octet-stream').toLowerCase(),
    size:Number(input?.size),
    chunkSize:Number(input?.chunkSize || DEFAULT_MEDIA_CHUNK_SIZE),
    chunkCount:Number(input?.chunkCount),
    contentHash:String(input?.contentHash || ''),
    mediaKey:String(input?.mediaKey || ''),
    createdAt:Number(input?.createdAt),
    previewPolicy:input?.previewPolicy || (isSafePreviewMime(input?.mime) ? 'inline' : 'download'),
    ...(input?.voice != null ? { voice:{version:Number(input.voice.version),durationMs:Number(input.voice.durationMs),waveform:Array.from(input.voice.waveform||[],Number),codec:String(input.voice.codec||'')} } : {}),
    ...(input?.expiresAt != null ? { expiresAt:Number(input.expiresAt) } : {}),
    ...(input?.replica != null ? { replica:{version:Number(input.replica.version),accessToken:String(input.replica.accessToken||''),providerIds:Array.from(input.replica.providerIds||[],String),chunkCount:Number(input.replica.chunkCount),expiresAt:Number(input.replica.expiresAt)} } : {})
  };
  return validateMediaManifest(manifest);
}
