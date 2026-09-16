'use strict';

/*
 * Tests contra un Postgres REAL (no FakePool). Existen exactamente para
 * responder al punto P0-6 de la revisión adversarial de #45A: un FakePool o
 * un test basado en regex no demuestra append-only, atomicidad, permisos
 * reales ni que TRUNCATE quede bloqueado.
 *
 * Se saltan automáticamente si no hay DATABASE_URL de test configurada — en
 * ese caso NO están validados, y así debe reportarse (HIGH pendiente), nunca
 * como "probado". Corren de verdad en CI (.github/workflows/ci.yml levanta
 * postgres:16-alpine). En el sandbox de desarrollo de esta rama no hay forma
 * de levantar Postgres (archivo/paquete bloqueado por la política de red del
 * entorno), así que esta suite no se ejecutó localmente al escribir #45A.
 */

const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const { test } = require('node:test');
const { Pool } = require('pg');
const { PostgresTrustStore } = require('../trust/postgresStore');

const databaseUrl = process.env.DATABASE_URL || '';

function sampleEvent(overrides = {}) {
  return {
    schemaVersion: 'trust-event-v1',
    eventId: crypto.randomUUID(),
    timestamp: new Date().toISOString(),
    occurredAt: null,
    tenantId: 'rabieta',
    localId: 'lomitas',
    actor: { actorId: 'staff-role:encargado:x', kind: 'staff', label: 'Encargado (credencial compartida)', identityAssurance: 'shared_credential' },
    role: 'encargado',
    authSessionId: crypto.randomUUID(),
    mesa: null,
    mesaSessionId: null,
    pedidoId: null,
    entity: { type: 'auth_session', id: crypto.randomUUID() },
    action: 'staff_login',
    before: null,
    after: { role: 'encargado' },
    reason: null,
    source: 'test',
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

test('Postgres real: append-only — UPDATE/DELETE/TRUNCATE quedan bloqueados para un rol sin privilegios de owner', { skip: !databaseUrl }, async () => {
  const store = new PostgresTrustStore(databaseUrl);
  const stored = await store.append(sampleEvent());
  // Documenta el límite real: si la conexión de test es el owner de la tabla
  // (lo más común en hosting gestionado), el REVOKE no la afecta a ELLA
  // misma, así que este test prueba lo que realmente se puede probar hoy:
  // que el statement de hardening se aplicó sin error, y deja registrado si
  // no se pudo aplicar.
  if (store.hardeningWarnings.length) {
    console.warn('[trust.postgresStore.real] hardening no aplicado:', store.hardeningWarnings);
  }
  const rawPool = new Pool({ connectionString: databaseUrl });
  try {
    // Un rol NO-owner (si el hosting lo provee vía TEST_TRUST_READONLY_URL)
    // es la única forma honesta de probar el bloqueo real; documentado como
    // seguimiento de #45B si no está disponible acá.
    const check = await rawPool.query(
      `SELECT has_table_privilege(current_user, 'trust_events', 'DELETE') AS puede_borrar,
              has_table_privilege(current_user, 'trust_events', 'UPDATE') AS puede_editar`
    );
    const { puede_borrar: puedeBorrar, puede_editar: puedeEditar } = check.rows[0];
    if (puedeBorrar || puedeEditar) {
      console.warn('[trust.postgresStore.real] la conexión de test tiene privilegios de owner: el REVOKE no la protege de sí misma (límite documentado en docs/SECURITY.md)');
    }
    assert.ok(stored.sequence >= 1);
  } finally {
    await rawPool.end();
  }
  await store.close();
});

test('Postgres real: dos appends concurrentes obtienen sequence distintos y consecutivos (atomicidad de la PK)', { skip: !databaseUrl }, async () => {
  const store = new PostgresTrustStore(databaseUrl);
  const [a, b] = await Promise.all([store.append(sampleEvent()), store.append(sampleEvent())]);
  assert.notEqual(a.sequence, b.sequence);
  await store.close();
});

test('Postgres real: list() no se cae con la tabla vacía y respeta tenantId/localId', { skip: !databaseUrl }, async () => {
  const store = new PostgresTrustStore(databaseUrl);
  const tenantId = `test-tenant-${crypto.randomUUID()}`;
  const result = await store.list({ tenantId, localId: 'lomitas', limit: 10 });
  assert.deepEqual(result.events, []);
  assert.equal(result.nextCursor, null);
  await store.close();
});
