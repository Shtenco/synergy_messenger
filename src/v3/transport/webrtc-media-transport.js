export const MEDIA_CHANNEL_LABEL = 'synergy-media-v1';

function toBytes(data) {
  if (data instanceof Uint8Array) return data;
  if (data instanceof ArrayBuffer) return new Uint8Array(data);
  throw new TypeError('MEDIA_FRAME_BYTES_REQUIRED');
}

export class WebRtcMediaTransport {
  constructor({ direct, label = MEDIA_CHANNEL_LABEL, highWaterMark = 1024 * 1024, lowWaterMark = 256 * 1024, backpressureTimeoutMs = 5000 } = {}) {
    if (!direct) throw new Error('MEDIA_TRANSPORT_DIRECT_REQUIRED');
    if (!(highWaterMark > lowWaterMark && lowWaterMark >= 0)) throw new Error('MEDIA_BACKPRESSURE_CONFIG_INVALID');
    this.direct = direct;
    this.label = label;
    this.highWaterMark = highWaterMark;
    this.lowWaterMark = lowWaterMark;
    this.backpressureTimeoutMs = backpressureTimeoutMs;
    this.started = false;
    this.unsubscribe = null;
    this.onFrameHandler = async () => {};
  }

  async start(onFrame = () => {}) {
    if (this.started) return;
    this.onFrameHandler = onFrame;
    this.unsubscribe = this.direct.registerDataChannelProtocol(this.label, event => this.onFrameHandler(event), { ordered:false });
    this.started = true;
  }

  async stop() {
    if (!this.started) return;
    try { this.unsubscribe?.(); } catch {}
    this.unsubscribe = null;
    this.started = false;
  }

  async sendFrame(peerMailbox, data) {
    if (!this.started) throw new Error('MEDIA_TRANSPORT_NOT_STARTED');
    const bytes = toBytes(data);
    const channel = await this.direct.openDataChannel(peerMailbox, this.label);
    const max = this.direct.getMaxMessageSize(peerMailbox);
    if (bytes.byteLength > max) throw new Error('MEDIA_FRAME_TOO_LARGE');
    await this.#waitForDrain(channel);
    channel.send(bytes);
    return { status:'sent', transport:'webrtc-media', bytes:bytes.byteLength };
  }

  async #waitForDrain(channel) {
    if ((channel.bufferedAmount || 0) <= this.highWaterMark) return;
    channel.bufferedAmountLowThreshold = this.lowWaterMark;
    await new Promise((resolve,reject) => {
      let settled=false;
      const finish=(error=null)=>{ if(settled)return; settled=true; clearTimeout(timer); cleanup(); error?reject(error):resolve(); };
      const onLow=()=>finish();
      const onClose=()=>finish(new Error('MEDIA_CHANNEL_CLOSED'));
      const cleanup=()=>{
        channel.removeEventListener?.('bufferedamountlow',onLow);
        channel.removeEventListener?.('close',onClose);
        if (channel.onbufferedamountlow === onLow) channel.onbufferedamountlow = null;
      };
      if (channel.addEventListener) {
        channel.addEventListener('bufferedamountlow',onLow,{once:true});
        channel.addEventListener('close',onClose,{once:true});
      } else {
        const prev = channel.onbufferedamountlow;
        channel.onbufferedamountlow = event => { try { prev?.(event); } finally { onLow(); } };
      }
      const timer=setTimeout(()=>finish(new Error('MEDIA_BACKPRESSURE_TIMEOUT')),this.backpressureTimeoutMs);
      if ((channel.bufferedAmount || 0) <= this.lowWaterMark) finish();
    });
  }
}
