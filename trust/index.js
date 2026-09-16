'use strict';

const { MemoryTrustStore } = require('./memoryStore');
const { PostgresTrustStore } = require('./postgresStore');
const { buildTrustEvent } = require('./schema');
const { canQueryTrustLedger, QUERY_ALLOWED_ROLES } = require('./query');

function createTrustStore({ databaseUrl = process.env.DATABASE_URL, PoolClass } = {}) {
  return databaseUrl ? new PostgresTrustStore(databaseUrl, PoolClass) : new MemoryTrustStore();
}

/**
 * Fachada delgada sobre un store: valida + sanitiza (schema.js) antes de
 * escribir, y expone lectura paginada. No hay API de update/delete — el
 * único método de escritura es `record`, que siempre agrega.
 */
class TrustLedger {
  constructor(store) {
    this.store = store;
  }

  async record(input) {
    const built = buildTrustEvent(input);
    if (!built.ok) return built;
    const stored = await this.store.append(built.event);
    return { ok: true, event: stored };
  }

  async query(params) {
    return this.store.list(params);
  }

  async count() {
    return this.store.count();
  }

  async close() {
    return this.store.close();
  }
}

module.exports = {
  createTrustStore,
  TrustLedger,
  MemoryTrustStore,
  PostgresTrustStore,
  canQueryTrustLedger,
  QUERY_ALLOWED_ROLES,
};
