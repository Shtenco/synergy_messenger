export const DB_NAME = 'synergy-messenger-v3';
export const DB_VERSION = 7;

function requestToPromise(request) {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error('IndexedDB request failed'));
  });
}

function transactionDone(tx) {
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error || new Error('IndexedDB transaction failed'));
    tx.onabort = () => reject(tx.error || new Error('IndexedDB transaction aborted'));
  });
}

export class BrowserDb {
  constructor(db) { this.db = db; }
  async get(store, key) { const tx=this.db.transaction(store,'readonly'); return requestToPromise(tx.objectStore(store).get(key)); }
  async put(store, value) { const tx=this.db.transaction(store,'readwrite'); tx.objectStore(store).put(value); await transactionDone(tx); return value; }
  async delete(store,key){const tx=this.db.transaction(store,'readwrite');tx.objectStore(store).delete(key);await transactionDone(tx);}
  async getAll(store){const tx=this.db.transaction(store,'readonly');return requestToPromise(tx.objectStore(store).getAll());}
  async addIfAbsent(store,key,value){const tx=this.db.transaction(store,'readwrite');const objectStore=tx.objectStore(store);try{objectStore.add(value);await transactionDone(tx);return true;}catch(error){if(error?.name==='ConstraintError'||tx.error?.name==='ConstraintError')return false;throw error;}}
  close(){this.db.close();}
}

export async function openSynergyDb(options={}){
  const indexedDBFactory=options.indexedDB||globalThis.indexedDB;if(!indexedDBFactory)throw new Error('INDEXEDDB_UNAVAILABLE');const request=indexedDBFactory.open(DB_NAME,DB_VERSION);
  request.onupgradeneeded=()=>{const db=request.result;
    if(!db.objectStoreNames.contains('messages'))db.createObjectStore('messages',{keyPath:'messageId'});
    if(!db.objectStoreNames.contains('outbox')){const outbox=db.createObjectStore('outbox',{keyPath:'messageId'});outbox.createIndex('byNextAttemptAt','nextAttemptAt',{unique:false});}
    if(!db.objectStoreNames.contains('inbox'))db.createObjectStore('inbox',{keyPath:'messageId'});
    if(!db.objectStoreNames.contains('transportPeers'))db.createObjectStore('transportPeers',{keyPath:'peerKey'});
    if(!db.objectStoreNames.contains('cryptoKeys'))db.createObjectStore('cryptoKeys',{keyPath:'keyId'});
    if(!db.objectStoreNames.contains('identities'))db.createObjectStore('identities',{keyPath:'identityId'});
    if(!db.objectStoreNames.contains('prekeys'))db.createObjectStore('prekeys',{keyPath:'preKeyId'});
    if(!db.objectStoreNames.contains('cryptoSessions'))db.createObjectStore('cryptoSessions',{keyPath:'sessionId'});
    if(!db.objectStoreNames.contains('trust'))db.createObjectStore('trust',{keyPath:'peerDeviceId'});
    if(!db.objectStoreNames.contains('contacts'))db.createObjectStore('contacts',{keyPath:'peerDeviceId'});
    if(!db.objectStoreNames.contains('conversations'))db.createObjectStore('conversations',{keyPath:'chatId'});
    if(!db.objectStoreNames.contains('uiHistory')){const history=db.createObjectStore('uiHistory',{keyPath:'messageId'});history.createIndex('byChatCreatedAt',['chatId','createdAt'],{unique:false});}
    if(!db.objectStoreNames.contains('mediaObjects'))db.createObjectStore('mediaObjects',{keyPath:'mediaId'});
    if(!db.objectStoreNames.contains('mediaChunks')){const chunks=db.createObjectStore('mediaChunks',{keyPath:'chunkId'});chunks.createIndex('byMediaId','mediaId',{unique:false});}
    if(!db.objectStoreNames.contains('mediaTransfers')){const transfers=db.createObjectStore('mediaTransfers',{keyPath:'transferId'});transfers.createIndex('byMediaId','mediaId',{unique:false});}
    if(!db.objectStoreNames.contains('groups'))db.createObjectStore('groups',{keyPath:'groupId'});
    if(!db.objectStoreNames.contains('groupEpochStates'))db.createObjectStore('groupEpochStates',{keyPath:'stateId'});
    if(!db.objectStoreNames.contains('groupMembers'))db.createObjectStore('groupMembers',{keyPath:'memberId'});
    if(!db.objectStoreNames.contains('groupPolicies'))db.createObjectStore('groupPolicies',{keyPath:'groupId'});
    if(!db.objectStoreNames.contains('groupInvites'))db.createObjectStore('groupInvites',{keyPath:'inviteId'});
    if(!db.objectStoreNames.contains('payments')){const payments=db.createObjectStore('payments',{keyPath:'paymentId'});payments.createIndex('byChatUpdatedAt',['chatId','updatedAt'],{unique:false});}
    if(!db.objectStoreNames.contains('accountRoots'))db.createObjectStore('accountRoots',{keyPath:'rootId'});
    if(!db.objectStoreNames.contains('deviceCertificates'))db.createObjectStore('deviceCertificates',{keyPath:'certificateId'});
    if(!db.objectStoreNames.contains('deviceRevocations'))db.createObjectStore('deviceRevocations',{keyPath:'revocationId'});
    if(!db.objectStoreNames.contains('replicaCapabilities'))db.createObjectStore('replicaCapabilities',{keyPath:'capabilityId'});
    if(!db.objectStoreNames.contains('securityReplay')){const replay=db.createObjectStore('securityReplay',{keyPath:'replayId'});replay.createIndex('bySeenAt','seenAt',{unique:false});}
  };
  const db=await requestToPromise(request);return new BrowserDb(db);
}
export async function deleteSynergyDb(options={}){const indexedDBFactory=options.indexedDB||globalThis.indexedDB;if(!indexedDBFactory)throw new Error('INDEXEDDB_UNAVAILABLE');await requestToPromise(indexedDBFactory.deleteDatabase(DB_NAME));}
