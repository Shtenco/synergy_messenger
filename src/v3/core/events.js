export class CoreEventEmitter {
  #listeners = new Map();

  on(type, handler) {
    if (typeof handler !== 'function') throw new TypeError('handler must be a function');
    const listeners = this.#listeners.get(type) || new Set();
    listeners.add(handler);
    this.#listeners.set(type, listeners);
    return () => {
      listeners.delete(handler);
      if (listeners.size === 0) this.#listeners.delete(type);
    };
  }

  emit(type, value) {
    for (const handler of [...(this.#listeners.get(type) || [])]) handler(value);
  }

  async emitAsync(type, value) {
    for (const handler of [...(this.#listeners.get(type) || [])]) await handler(value);
  }

  clear() {
    this.#listeners.clear();
  }
}
