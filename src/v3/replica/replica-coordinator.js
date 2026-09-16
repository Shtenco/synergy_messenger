import { bytesEqual, concatBytes, fromBase64Url, toBase64Url, utf8 } from '../crypto/bytes.js';

function u64(value){
  if(!Number.isSafeInteger(value)||value<0)throw new Error('REPLICA_INTEGER_INVALID');
  const out=new Uint8Array(8);let n=BigInt(value);for(let i=7;i>=0;i-=1){out[i]=Number(n&255n);n>>=8n;}return out;
}
function cloneChunk(row){return {iv:new Uint8Array(row.iv),ciphertext:new Uint8Array(row.ciphertext),plaintextLength:row.plaintextLength};}
function validateReplica(replica){
  if(replica?.version!==1||typeof replica.accessToken!=='string'||!Array.isArray(replica.providerIds)||!replica.providerIds.length||!Number.isSafeInteger(replica.chunkCount)||replica.chunkCount<1||!Number.isFinite(replica.expiresAt))throw new Error('REPLICA_DESCRIPTOR_INVALID');
  const token=fromBase64Url(replica.accessToken);if(token.byteLength!==32)throw new Error('REPLICA_DESCRIPTOR_INVALID');return token;
}

export class ReplicaCoordinator {
  constructor({cryptoProvider,providers=[],writeQuorum=1,randomBytes=null,clock={now:()=>Date.now()},maxReplicaBytes=2*1024*1024*1024,capabilityRepository=null}={}){
    if(!cryptoProvider)throw new Error('REPLICA_CRYPTO_REQUIRED');
    this.cryptoProvider=cryptoProvider;this.providers=new Map(providers.map(p=>[p?.id,p]).filter(([id,p])=>id&&p));this.writeQuorum=writeQuorum;this.randomBytes=randomBytes||cryptoProvider.randomBytes?.bind(cryptoProvider);this.clock=clock;this.maxReplicaBytes=maxReplicaBytes;this.capabilityRepository=capabilityRepository;
    if(!this.randomBytes)throw new Error('REPLICA_RANDOM_REQUIRED');if(!Number.isInteger(writeQuorum)||writeQuorum<1)throw new Error('REPLICA_QUORUM_INVALID');
  }
  async #objectId(token,index){return toBase64Url(await this.cryptoProvider.hmac(token,concatBytes(utf8('SYNERGY-REPLICA-ID-V1|'),u64(index))));}
  async #proof(token,index,row){return this.cryptoProvider.hmac(token,concatBytes(utf8('SYNERGY-REPLICA-PROOF-V1|'),u64(index),u64(row.plaintextLength),row.iv,row.ciphertext));}
  async publish({mediaId,chunkCount,expiresAt=null,readChunk}={}){
    if(!mediaId||!Number.isSafeInteger(chunkCount)||chunkCount<1||typeof readChunk!=='function')throw new Error('REPLICA_PUBLISH_INVALID');
    const now=this.clock.now(),expiry=expiresAt==null?now+7*24*60*60*1000:expiresAt;if(!(expiry>now))throw new Error('REPLICA_EXPIRED');
    if(this.providers.size<this.writeQuorum)return null;
    const token=this.randomBytes(32);if(!(token instanceof Uint8Array)||token.byteLength!==32)throw new Error('REPLICA_TOKEN_INVALID');
    const active=[];for(const provider of this.providers.values())active.push(provider);
    const alive=new Set(active.map(p=>p.id));let totalBytes=0;
    for(let index=0;index<chunkCount;index+=1){
      const row=await readChunk(index);if(!row?.iv||!row?.ciphertext||!Number.isSafeInteger(row?.plaintextLength))throw new Error('REPLICA_CHUNK_INVALID');
      totalBytes+=row.iv.byteLength+row.ciphertext.byteLength;if(totalBytes>this.maxReplicaBytes)throw new Error('REPLICA_QUOTA_EXCEEDED');
      const objectId=await this.#objectId(token,index),proof=await this.#proof(token,index,row);
      for(const provider of active){if(!alive.has(provider.id))continue;try{await provider.putChunk({objectId,chunkIndex:index,iv:new Uint8Array(row.iv),ciphertext:new Uint8Array(row.ciphertext),plaintextLength:row.plaintextLength,proof:new Uint8Array(proof),expiresAt:expiry});}catch{alive.delete(provider.id);}}
      if(alive.size<this.writeQuorum){await this.#bestEffortRemove(token,chunkCount,[...alive]);throw new Error('REPLICA_WRITE_QUORUM_FAILED');}
    }
    const capabilityDigest=await this.cryptoProvider.sha256(concatBytes(utf8('SYNERGY-REPLICA-CAPABILITY-V1|'),token));
    const capabilityId=`rep-${toBase64Url(capabilityDigest.subarray(0,16))}`;
    const replica={version:1,capabilityId,accessToken:toBase64Url(token),providerIds:[...alive],chunkCount,expiresAt:expiry};
    if(this.capabilityRepository)await this.capabilityRepository.put({capabilityId,mediaId,replica,createdAt:now,updatedAt:now});
    return replica;
  }
  async fetchChunk({replica,chunkIndex}={}){
    const token=validateReplica(replica);if(this.clock.now()>=replica.expiresAt)throw new Error('REPLICA_EXPIRED');if(!Number.isSafeInteger(chunkIndex)||chunkIndex<0||chunkIndex>=replica.chunkCount)throw new Error('REPLICA_CHUNK_INDEX_INVALID');
    const objectId=await this.#objectId(token,chunkIndex);let sawCorruption=false;
    for(const id of replica.providerIds){const provider=this.providers.get(id);if(!provider)continue;let row;try{row=await provider.getChunk({objectId});}catch{continue;}if(!row)continue;
      try{
        if(row.expiresAt!=null&&this.clock.now()>=row.expiresAt)continue;
        if(!(row.iv instanceof Uint8Array)||!(row.ciphertext instanceof Uint8Array)||!(row.proof instanceof Uint8Array)||!Number.isSafeInteger(row.plaintextLength))throw new Error('bad');
        const expected=await this.#proof(token,chunkIndex,row);if(!bytesEqual(expected,row.proof)){sawCorruption=true;continue;}
        return cloneChunk(row);
      }catch{sawCorruption=true;}
    }
    if(sawCorruption)throw new Error('REPLICA_PROOF_INVALID');throw new Error('REPLICA_CHUNK_UNAVAILABLE');
  }
  async remove({replica}={}){const token=validateReplica(replica);await this.#bestEffortRemove(token,replica.chunkCount,replica.providerIds);if(replica.capabilityId&&this.capabilityRepository)await this.capabilityRepository.delete(replica.capabilityId);return true;}
  async #bestEffortRemove(token,chunkCount,providerIds){for(let i=0;i<chunkCount;i+=1){const objectId=await this.#objectId(token,i);for(const id of providerIds){const provider=this.providers.get(id);try{await provider?.deleteChunk?.({objectId});}catch{}}}}
}
