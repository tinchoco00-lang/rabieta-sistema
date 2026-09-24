'use strict';

/*
 * Unit tests de PostgresTrustStore con un Pool inyectado (FakePool), mismo
 * patrón que test/persistence.test.js. Esto prueba la FORMA del SQL emitido
 * y el mapeo evento<->fila — NO prueba append-only real, atomicidad,
 * permisos de DB ni que TRUNCATE quede bloqueado (eso requiere un Postgres
 * real; ver test/trust.postgresStore.real.test.js y docs/SECURITY.md).
 */

const assert = require('node:assert/strict');
const { test } = require('node:test');
const { PostgresTrustStore, HARDENING_STATEMENTS } = require('../trust/postgresStore');

function fakePoolClass({ failHardening = false } = {}) {
  return class FakePool {
    static instances = [];

    constructor(options) {
      this.options = options;
      this.queries = [];
      this.ended = false;
      this._sequence = 0;
      this._rows = [];
      FakePool.instances.push(this);
    }

    async query(sql, params) {
      this.queries.push({ sql, params });
      if (failHardening && HARDENING_STATEMENTS.includes(sql)) {
        throw new Error('permiso insuficiente (simulado): el rol no es owner de la tabla');
      }
      if (sql.startsWith('INSERT INTO trust_events')) {
        this._sequence += 1;
        const row = {
          sequence: this._sequence,
          event_id: params[0],
          schema_version: params[1],
          timestamp: params[2],
          occurred_at: params[3],
          tenant_id: params[4],
          local_id: params[5],
          actor: JSON.parse(params[6]),
          role: params[7],
          auth_session_id: params[8],
          mesa: params[9],
          mesa_session_id: params[10],
          pedido_id: params[11],
          entity: JSON.parse(params[12]),
          action: params[13],
          before_state: params[14] ? JSON.parse(params[14]) : null,
          after_state: params[15] ? JSON.parse(params[15]) : null,
          reason: params[16],
          source: params[17],
          data_class: params[18],
          demo_run_id: params[19],
          correlation_id: params[20],
          idempotency_id: params[21],
          request_id: params[22],
          state_version: params[23],
          causation_event_id: params[24],
          corrects_event_id: params[25],
          metadata: params[26] ? JSON.parse(params[26]) : null,
        };
        this._rows.push(row);
        return { rows: [{ sequence: row.sequence }] };
      }
      if (sql.startsWith('SELECT * FROM trust_events')) {
        const after = params[0];
        const rows = this._rows.filter(r => r.sequence > after).slice(0, params[params.length - 1]);
        return { rows };
      }
      if (sql.startsWith('SELECT COUNT')) {
        return { rows: [{ count: this._rows.length }] };
      }
      return { rows: [] };
    }

    async end() { this.ended = true; }
  };
}

function sampleEvent(overrides = {}) {
  return {
    schemaVersion: 'trust-event-v1',
    eventId: 'evt-1',
    timestamp: '2026-01-01T00:00:00.000Z',
    occurredAt: null,
    tenantId: 'rabieta',
    localId: 'lomitas',
    actor: { actorId: 'staff-role:encargado:x', kind: 'staff', label: 'Encargado (credencial compartida)', identityAssurance: 'shared_credential' },
    role: 'encargado',
    authSessionId: 'auth-1',
    mesa: null,
    mesaSessionId: null,
    pedidoId: null,
    entity: { type: 'auth_session', id: 'auth-1' },
    action: 'staff_login',
    before: null,
    after: { role: 'encargado' },
    reason: null,
    source: 'staff-login',
    dataClass: 'operational',
    demoRunId: null,
    correlationId: null,
    idempotencyId: null,
    requestId: null,
    stateVersion: null,
    causationEventId: null,
    correctsEventId: null,
    metadata: null,
    ...overrides,
  };
}

test('append: crea la tabla, el índice, intenta el hardening y hace INSERT', async () => {
  const FakePool = fakePoolClass();
  const store = new PostgresTrustStore('postgres://example/test', FakePool);
  const stored = await store.append(sampleEvent());
  assert.equal(stored.sequence, 1);
  const pool = FakePool.instances[0];
  assert.ok(pool.queries.some(q => q.sql.includes('CREATE TABLE IF NOT EXISTS trust_events')));
  assert.ok(pool.queries.some(q => q.sql.includes('trust_events_tenant_local_sequence_idx')));
  assert.ok(pool.queries.some(q => HARDENING_STATEMENTS.includes(q.sql)));
  assert.ok(pool.queries.some(q => q.sql.startsWith('INSERT INTO trust_events')));
});

test('append: sequence la asigna la base, nunca el cliente', async () => {
  const FakePool = fakePoolClass();
  const store = new PostgresTrustStore('postgres://example/test', FakePool);
  const first = await store.append(sampleEvent({ eventId: 'evt-1' }));
  const second = await store.append(sampleEvent({ eventId: 'evt-2' }));
  assert.equal(first.sequence, 1);
  assert.equal(second.sequence, 2);
});

test('hardening: si el REVOKE falla (rol sin permiso), se registra como warning y NO revienta el append', async () => {
  const FakePool = fakePoolClass({ failHardening: true });
  const store = new PostgresTrustStore('postgres://example/test', FakePool);
  const stored = await store.append(sampleEvent());
  assert.equal(stored.sequence, 1);
  assert.ok(store.hardeningWarnings.length >= 1, 'debe quedar documentado que el hardening no se pudo aplicar');
  assert.ok(store.hardeningWarnings[0].includes('REVOKE') || store.hardeningWarnings[0].includes('permiso'));
});

test('list: pagina por sequence con cursor estable, nunca por timestamp', async () => {
  const FakePool = fakePoolClass();
  const store = new PostgresTrustStore('postgres://example/test', FakePool);
  for (let i = 0; i < 5; i++) await store.append(sampleEvent({ eventId: `evt-${i}` }));
  const page1 = await store.list({ tenantId: 'rabieta', localId: 'lomitas', limit: 2 });
  assert.equal(page1.events.length, 2);
  assert.equal(page1.nextCursor, 2);
  const page2 = await store.list({ tenantId: 'rabieta', localId: 'lomitas', limit: 2, after: page1.nextCursor });
  assert.equal(page2.events.length, 2);
  assert.deepEqual(page2.events.map(e => e.sequence), [3, 4]);
  const pool = FakePool.instances[0];
  const selectQuery = pool.queries.find(q => q.sql.startsWith('SELECT * FROM trust_events'));
  assert.ok(selectQuery.sql.includes('ORDER BY sequence ASC'));
});

test('count: refleja la cantidad total de eventos append-eados', async () => {
  const FakePool = fakePoolClass();
  const store = new PostgresTrustStore('postgres://example/test', FakePool);
  await store.append(sampleEvent({ eventId: 'a' }));
  await store.append(sampleEvent({ eventId: 'b' }));
  assert.equal(await store.count(), 2);
});

test('close: termina el pool', async () => {
  const FakePool = fakePoolClass();
  const store = new PostgresTrustStore('postgres://example/test', FakePool);
  await store.close();
  assert.equal(FakePool.instances[0].ended, true);
});
