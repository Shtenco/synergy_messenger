export class ReplayGuard{
  constructor({db,ttlMs=24*60*60*1000,maxEntries=10000}={}){if(!db)throw new Error('REPLAY_GUARD_DB_REQUIRED');this.db=db;this.ttlMs=ttlMs;this.maxEntries=maxEntries;}
  async claim(replayId,now=Date.now()){if(!replayId)throw new Error('REPLAY_ID_REQUIRED');const existing=await this.db.get('securityReplay',replayId);if(existing&&now-existing.seenAt<this.ttlMs)return false;await this.db.put('securityReplay',{replayId,seenAt:now});await this.prune(now);return true;}
  async prune(now=Date.now()){let rows=await this.db.getAll('securityReplay');for(const row of rows){if(now-row.seenAt>=this.ttlMs)await this.db.delete('securityReplay',row.replayId);}rows=(await this.db.getAll('securityReplay')).sort((a,b)=>a.seenAt-b.seenAt);while(rows.length>this.maxEntries){const row=rows.shift();await this.db.delete('securityReplay',row.replayId);}return rows.length;}
}
