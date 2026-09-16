export class IngressSecurityGuard{
  constructor({rateLimiter,replayGuard,clock={now:()=>Date.now()},maxClockSkewMs=5*60*1000,maxFutureTtlMs=30*24*60*60*1000}={}){if(!rateLimiter||!replayGuard)throw new Error('INGRESS_SECURITY_DEPENDENCY_REQUIRED');this.rateLimiter=rateLimiter;this.replayGuard=replayGuard;this.clock=clock;this.maxClockSkewMs=maxClockSkewMs;this.maxFutureTtlMs=maxFutureTtlMs;}
  async evaluate(packet,source='unknown'){
    const now=this.clock.now();
    if(!packet?.messageId||!packet?.senderDeviceId||!Number.isFinite(packet.createdAt))return {accepted:false,reason:'MALFORMED'};
    if(packet.createdAt>now+this.maxClockSkewMs)return {accepted:false,reason:'CLOCK_SKEW'};
    if(packet.expiresAt!=null&&(packet.expiresAt<=now||packet.expiresAt>now+this.maxFutureTtlMs))return {accepted:false,reason:'TTL_INVALID'};
    const key=`${source}:${packet.senderDeviceId}`;if(!this.rateLimiter.allow(key,1,now))return {accepted:false,reason:'RATE_LIMIT'};
    const fresh=await this.replayGuard.claim(`${packet.senderDeviceId}:${packet.messageId}`,now);if(!fresh)return {accepted:false,reason:'REPLAY'};
    return {accepted:true};
  }
}
