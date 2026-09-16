import { CoreEventEmitter } from '../core/events.js';
import { validatePacket } from '../core/packet.js';
import { openSynergyDb } from '../storage/db.js';
import { MessageRepository } from '../storage/message-repository.js';
import { OutboxRepository } from '../storage/outbox-repository.js';
import { InboxRepository } from '../storage/inbox-repository.js';
import { PeerRepository } from '../storage/peer-repository.js';
import { InboxWorker } from './inbox-worker.js';
import { OutboxWorker } from './outbox-worker.js';
import { TokenBucketRateLimiter } from '../security/token-bucket-rate-limiter.js';
import { ReplayGuard } from '../security/replay-guard.js';
import { IngressSecurityGuard } from '../security/ingress-security-guard.js';

export class SyncEngine {
  constructor({ db = null, openDb = openSynergyDb, transport, clock = { now: () => Date.now() }, random = Math.random, autoWorker = true, ingressGuard = null, security = {} } = {}) {
    if (!transport) throw new Error('TRANSPORT_REQUIRED');
    this.db = db; this.openDb = openDb; this.transport = transport; this.clock = clock; this.random = random; this.autoWorker = autoWorker; this.ingressGuard = ingressGuard; this.security = security || {}; this.events = new CoreEventEmitter(); this.started = false; this.ownsDb = !db; if (db) this.#setupRepositories();
  }
  #setupRepositories() { this.messageRepo=new MessageRepository(this.db);this.outboxRepo=new OutboxRepository(this.db);this.inboxRepo=new InboxRepository(this.db);this.peerRepo=new PeerRepository(this.db);if(!this.ingressGuard&&this.security.enabled!==false){this.rateLimiter=new TokenBucketRateLimiter({capacity:this.security.capacity??120,refillPerSecond:this.security.refillPerSecond??2,maxBuckets:this.security.maxBuckets??1024,clock:this.clock});this.replayGuard=new ReplayGuard({db:this.db,clock:this.clock,retentionMs:this.security.replayRetentionMs??24*60*60*1000,maxRows:this.security.maxReplayRows??20_000});this.ingressGuard=new IngressSecurityGuard({rateLimiter:this.rateLimiter,replayGuard:this.replayGuard});}this.inboxWorker=new InboxWorker({inboxRepo:this.inboxRepo,messageRepo:this.messageRepo,clock:this.clock,onPacket:packet=>this.events.emitAsync('packet',packet),ingressGuard:this.ingressGuard});this.outboxWorker=new OutboxWorker({repo:this.outboxRepo,transport:this.transport,clock:this.clock,random:this.random,onStatus:event=>this.events.emit('status',event)}); }
  async start(){if(this.started)return;if(!this.db){this.db=await this.openDb();this.#setupRepositories();}await this.outboxRepo.repairStaleSending(this.clock.now());await this.transport.start((packet,sourceTransport=this.transport.name||'transport')=>this.inboxWorker.process(packet,sourceTransport));this.started=true;await this.syncHistory();if(this.autoWorker)this.outboxWorker.start();this.events.emit('status',{state:'ready'});}
  async stop(){if(!this.started)return;this.outboxWorker?.stop();await this.transport.stop();this.started=false;this.events.emit('status',{state:'stopped'});if(this.ownsDb){this.db?.close?.();this.db=null;this.messageRepo=this.outboxRepo=this.inboxRepo=this.peerRepo=null;this.inboxWorker=this.outboxWorker=null;this.rateLimiter=this.replayGuard=null;if(!this.security?.preserveInjectedGuard)this.ingressGuard=null;}}
  async enqueue(packet){validatePacket(packet);if(!this.outboxRepo)throw new Error('CORE_NOT_STARTED');const now=this.clock.now();await this.outboxRepo.enqueue(packet,now);await this.messageRepo.put({messageId:packet.messageId,chatId:null,direction:'out',kind:packet.kind,createdAt:packet.createdAt,transportState:'queued',packet,updatedAt:now});await this.outboxWorker.runOnce();return {messageId:packet.messageId};}
  async flush(){if(!this.outboxWorker)throw new Error('CORE_NOT_STARTED');return this.outboxWorker.runOnce();}
  onPacket(handler){return this.events.on('packet',handler);} onStatus(handler){return this.events.on('status',handler);} async syncHistory(){if(!this.started)return;return this.transport.syncHistory?.();}
}
