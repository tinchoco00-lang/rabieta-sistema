'use strict';

/*
 * MemoryTrustStore — ledger en memoria, deliberadamente FUERA de `state`.
 *
 * `state` se reemplaza entero en reset_demo (`state = seedState()`) y en la
 * recuperación de persistencia. Si el ledger viviera dentro de `state`,
 * cualquiera de esas dos rutas lo borraría por accidente. Este store es un
 * módulo aparte con su propio ciclo de vida: solo se vacía si alguien llama
 * explícitamente a _clearForTests(), nunca como efecto colateral de una
 * acción operativa.
 */

class MemoryTrustStore {
  constructor() {
    this._events = [];
    this._sequence = 0;
  }

  async append(event) {
    this._sequence += 1;
    const stored = { ...event, sequence: this._sequence };
    this._events.push(stored);
    return stored;
  }

  async list({ tenantId, localId, limit = 50, after = 0 } = {}) {
    const capped = Math.min(Math.max(Number(limit) || 50, 1), 200);
    const afterSeq = Number(after) || 0;
    const filtered = this._events.filter(event => (
      (!tenantId || event.tenantId === tenantId)
      && (!localId || event.localId === localId)
      && event.sequence > afterSeq
    ));
    const events = filtered.slice(0, capped);
    const nextCursor = events.length === capped ? events[events.length - 1].sequence : null;
    return { events, nextCursor };
  }

  async count() {
    return this._events.length;
  }

  async close() {}

  // Solo para tests: nunca invocado por el código de la aplicación.
  _clearForTests() {
    this._events = [];
    this._sequence = 0;
  }
}

module.exports = { MemoryTrustStore };
