export class TokenBucketRateLimiter{
  constructor({capacity=120,refillPerSecond=2,maxKeys=2048}={}){if(!(capacity>0)||!(refillPerSecond>0)||!(maxKeys>0))throw new Error('RATE_LIMITER_CONFIG_INVALID');this.capacity=capacity;this.refillPerSecond=refillPerSecond;this.maxKeys=maxKeys;this.buckets=new Map();}
  allow(key,cost=1,now=Date.now()){if(!key||!(cost>0))return false;let b=this.buckets.get(key);if(!b){if(this.buckets.size>=this.maxKeys)this.buckets.delete(this.buckets.keys().next().value);b={tokens:this.capacity,at:now};}const elapsed=Math.max(0,now-b.at)/1000;b.tokens=Math.min(this.capacity,b.tokens+elapsed*this.refillPerSecond);b.at=now;if(b.tokens<cost){this.buckets.set(key,b);return false;}b.tokens-=cost;this.buckets.delete(key);this.buckets.set(key,b);return true;}
  clear(){this.buckets.clear();}
}
