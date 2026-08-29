'use strict';

const assert = require('node:assert/strict');
const { test } = require('node:test');
const { createPersistence } = require('../persistence');

function fakePoolClass({ storedState = null, failure = null } = {}) {
  return class FakePool {
    static instances = [];

    constructor(options) {
      this.options = options;
      this.queries = [];
      this.ended = false;
      FakePool.instances.push(this);
    }

    async query(sql, params) {
      this.queries.push({ sql, params });
      if (failure) throw failure;
      if (sql.includes('SELECT state')) return { rows: storedState ? [{ state: storedState }] : [] };
      return { rows: [] };
    }

    async end() { this.ended = true; }
  };
}

test('sin DATABASE_URL usa memoria y conserva el comportamiento actual', async () => {
  const state = { clockMs: 0, mesas: [] };
  const persistence = createPersistence({ databaseUrl: '' });
  assert.equal(persistence.enabled, false);
  assert.equal(await persistence.initialize(state), state);
  await persistence.save(state);
  await persistence.close(state);
});

test('PostgreSQL crea la tabla y guarda la fila inicial cuando falta', async () => {
  const FakePool = fakePoolClass();
  const state = { clockMs: 3, mesas: [{ numero: 1, pedido: null, alertas: [] }] };
  const persistence = createPersistence({ databaseUrl: 'postgres://example/test', PoolClass: FakePool });
  assert.equal(await persistence.initialize(state), state);
  const pool = FakePool.instances[0];
  assert.equal(pool.options.connectionString, 'postgres://example/test');
  assert.ok(pool.queries.some(entry => entry.sql.includes('CREATE TABLE IF NOT EXISTS rabieta_estado')));
  const insert = pool.queries.find(entry => entry.sql.includes('INSERT INTO rabieta_estado'));
  assert.equal(insert.params[0], JSON.stringify(state));
});

test('PostgreSQL recupera el estado existente y lo guarda antes de cerrar', async () => {
  const storedState = { clockMs: 9, mesas: [{ numero: 1, ocupada: true, pedido: { items: [] }, alertas: [] }] };
  const FakePool = fakePoolClass({ storedState });
  const persistence = createPersistence({ databaseUrl: 'postgres://example/test', PoolClass: FakePool });
  assert.deepEqual(await persistence.initialize({ clockMs: 0, mesas: [] }), storedState);
  await persistence.close(storedState);
  const pool = FakePool.instances[0];
  const lastWrite = pool.queries.filter(entry => entry.sql.includes('INSERT INTO rabieta_estado')).at(-1);
  assert.equal(lastWrite.params[0], JSON.stringify(storedState));
  assert.equal(pool.ended, true);
});

test('una falla PostgreSQL configurada se propaga y no usa memoria silenciosamente', async () => {
  const failure = new Error('database unavailable');
  const FakePool = fakePoolClass({ failure });
  const persistence = createPersistence({ databaseUrl: 'postgres://example/test', PoolClass: FakePool });
  await assert.rejects(persistence.initialize({ clockMs: 0, mesas: [] }), /database unavailable/);
  assert.equal(FakePool.instances[0].ended, true);
});
