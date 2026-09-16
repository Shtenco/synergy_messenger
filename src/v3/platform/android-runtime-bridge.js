export class AndroidRuntimeBridge {
  constructor({ plugin } = {}) {
    if (!plugin || typeof plugin.getLaunchIntent !== 'function' || typeof plugin.startOnlineWindow !== 'function' || typeof plugin.stopOnlineWindow !== 'function') throw new Error('ANDROID_RUNTIME_PLUGIN_INVALID');
    this.plugin = plugin;
  }
  getLaunchIntent() { return this.plugin.getLaunchIntent(); }
  startOnlineWindow() { return this.plugin.startOnlineWindow(); }
  stopOnlineWindow() { return this.plugin.stopOnlineWindow(); }
  async onIntent(handler) {
    if (typeof handler !== 'function') throw new Error('ANDROID_INTENT_HANDLER_REQUIRED');
    if (typeof this.plugin.addListener !== 'function') throw new Error('ANDROID_INTENT_EVENTS_UNAVAILABLE');
    const handle = await this.plugin.addListener('intentReceived', handler);
    return () => handle?.remove?.();
  }
}
