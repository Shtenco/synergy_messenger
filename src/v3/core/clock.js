export class SystemClock {
  now() {
    return Date.now();
  }

  setTimeout(handler, delayMs) {
    return globalThis.setTimeout(handler, delayMs);
  }

  clearTimeout(handle) {
    globalThis.clearTimeout(handle);
  }
}
