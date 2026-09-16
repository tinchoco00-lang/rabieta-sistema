'use strict';

const assert = require('node:assert/strict');
const { test } = require('node:test');
const { MemoryTrustStore } = require('../trust/memoryStore');

function event(overrides = {}) {
  return { tenantId: 'rabieta', localId: 'lomitas', action: 'staff_login', ...overrides };
}

test('ledger vacío: count 0, list devuelve [] y nextCursor null', async () => {
  const store = new MemoryTrustStore();
  assert.equal(await store.count(), 0);
  const result = await store.list({ tenantId: 'rabieta', localId: 'lomitas' });
  assert.deepEqual(result.events, []);
  assert.equal(result.nextCursor, null);
});

test('append: asigna sequence estrictamente creciente, nunca provisto por el caller', async () => {
  const store = new MemoryTrustStore();
  const a = await store.append(event({ sequence: 999 })); // el caller intenta forzarlo
  const b = await store.append(event({ sequence: 1 }));
  assert.equal(a.sequence, 1, 'la store debe ignorar cualquier sequence entrante y asignar la propia');
  assert.equal(b.sequence, 2);
});

test('list: pagina por sequence, no por timestamp; el cursor no repite ni salta eventos', async () => {
  const store = new MemoryTrustStore();
  for (let i = 0; i < 5; i++) await store.append(event({ n: i }));
  const page1 = await store.list({ tenantId: 'rabieta', localId: 'lomitas', limit: 2 });
  assert.equal(page1.events.length, 2);
  assert.deepEqual(page1.events.map(e => e.sequence), [1, 2]);
  assert.equal(page1.nextCursor, 2);
  const page2 = await store.list({ tenantId: 'rabieta', localId: 'lomitas', limit: 2, after: page1.nextCursor });
  assert.deepEqual(page2.events.map(e => e.sequence), [3, 4]);
  const page3 = await store.list({ tenantId: 'rabieta', localId: 'lomitas', limit: 2, after: page2.nextCursor });
  assert.deepEqual(page3.events.map(e => e.sequence), [5]);
  assert.equal(page3.nextCursor, null, 'una página incompleta no debe ofrecer más cursor');
});

test('list: inserciones concurrentes DESPUÉS de leer la página 1 no alteran ni duplican la página 2', async () => {
  const store = new MemoryTrustStore();
  for (let i = 0; i < 3; i++) await store.append(event({ n: i }));
  const page1 = await store.list({ tenantId: 'rabieta', localId: 'lomitas', limit: 2 });
  // Insertar más eventos "concurrentemente" (en la práctica: entre que se
  // leyó la página 1 y se pide la página 2, que es exactamente la ventana
  // que un cursor inestable podría manejar mal).
  await Promise.all([store.append(event({ n: 'nuevo-1' })), store.append(event({ n: 'nuevo-2' }))]);
  const page2 = await store.list({ tenantId: 'rabieta', localId: 'lomitas', limit: 10, after: page1.nextCursor });
  const seenInPage1 = new Set(page1.events.map(e => e.sequence));
  page2.events.forEach(e => assert.ok(!seenInPage1.has(e.sequence), 'la página 2 no debe repetir eventos ya vistos en la página 1'));
  assert.deepEqual(page2.events.map(e => e.sequence), [3, 4, 5], 'debe incluir tanto el evento pendiente de antes como los insertados durante la paginación, en orden estable');
});

test('list: filtra por tenantId/localId', async () => {
  const store = new MemoryTrustStore();
  await store.append(event({ tenantId: 'rabieta', localId: 'lomitas' }));
  await store.append(event({ tenantId: 'otro-tenant', localId: 'otro-local' }));
  const result = await store.list({ tenantId: 'rabieta', localId: 'lomitas', limit: 50 });
  assert.equal(result.events.length, 1);
});

test('_clearForTests: solo la usa la suite de tests, nunca el código de la app', async () => {
  const store = new MemoryTrustStore();
  await store.append(event());
  store._clearForTests();
  assert.equal(await store.count(), 0);
});
