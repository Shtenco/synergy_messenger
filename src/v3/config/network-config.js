export const DEFAULT_NETWORK_CONFIG = Object.freeze({
  waku: Object.freeze({
    useDefaultBootstrap: true,
    bootstrapPeers: Object.freeze([]),
    contentTopicPrefix: '/synergy/3'
  }),
  webrtc: Object.freeze({
    iceServers: Object.freeze([]),
    connectTimeoutMs: 10000
  })
});

function fail(detail) {
  const error = new Error(`NETWORK_CONFIG_INVALID: ${detail}`);
  error.code = 'NETWORK_CONFIG_INVALID';
  throw error;
}

export function validateNetworkConfig(input = DEFAULT_NETWORK_CONFIG) {
  if (!input?.waku || !input?.webrtc) fail('waku and webrtc sections are required');
  const waku = {
    useDefaultBootstrap: input.waku.useDefaultBootstrap === true,
    bootstrapPeers: [...(input.waku.bootstrapPeers || [])],
    contentTopicPrefix: input.waku.contentTopicPrefix || '/synergy/3'
  };
  const webrtc = {
    iceServers: [...(input.webrtc.iceServers || [])],
    connectTimeoutMs: Number(input.webrtc.connectTimeoutMs)
  };
  if (!waku.useDefaultBootstrap && waku.bootstrapPeers.length === 0) fail('at least one Waku discovery path is required');
  if (!waku.contentTopicPrefix.startsWith('/')) fail('contentTopicPrefix must begin with /');
  if (!Number.isFinite(webrtc.connectTimeoutMs) || webrtc.connectTimeoutMs <= 0) fail('connectTimeoutMs must be positive');
  return { waku, webrtc };
}
