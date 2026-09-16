'use strict';

const assert = require('node:assert/strict');
const { test } = require('node:test');
const { buildTrustEvent, sanitizePayload, allowedKeysForAction } = require('../trust/schema');

function validInput(overrides = {}) {
  return {
    tenantId: 'rabieta',
    localId: 'lomitas',
    actor: { actorId: 'staff-role:encargado:x', kind: 'staff', label: 'Encargado (credencial compartida)', identityAssurance: 'shared_credential' },
    entity: { type: 'auth_session', id: 'auth-1' },
    action: 'staff_login',
    source: 'staff-login',
    dataClass: 'operational',
    ...overrides,
  };
}

test('buildTrustEvent: eventId es un UUID real (crypto.randomUUID), nunca uid()', () => {
  const { ok, event } = buildTrustEvent(validInput());
  assert.ok(ok);
  assert.match(event.eventId, /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i);
});

test('buildTrustEvent: timestamp es UTC real de wall-clock, no depende de clockMs', () => {
  const before = Date.now();
  const { event } = buildTrustEvent(validInput());
  const parsed = Date.parse(event.timestamp);
  assert.ok(parsed >= before && parsed <= Date.now() + 1000);
});

test('buildTrustEvent: rechaza sin tenantId/localId/actor/entity/action/source/dataClass válidos', () => {
  assert.equal(buildTrustEvent(validInput({ tenantId: '' })).ok, false);
  assert.equal(buildTrustEvent(validInput({ localId: '' })).ok, false);
  assert.equal(buildTrustEvent(validInput({ actor: null })).ok, false);
  assert.equal(buildTrustEvent(validInput({ entity: null })).ok, false);
  assert.equal(buildTrustEvent(validInput({ action: '' })).ok, false);
  assert.equal(buildTrustEvent(validInput({ source: '' })).ok, false);
  assert.equal(buildTrustEvent(validInput({ dataClass: 'algo-inventado' })).ok, false);
});

test('buildTrustEvent: dataClass demo exige demoRunId', () => {
  assert.equal(buildTrustEvent(validInput({ dataClass: 'demo' })).ok, false);
  assert.equal(buildTrustEvent(validInput({ dataClass: 'demo', demoRunId: 'run-1' })).ok, true);
});

test('buildTrustEvent: actor.identityAssurance debe venir de la lista honesta, nunca inventarse', () => {
  const result = buildTrustEvent(validInput({
    actor: { actorId: 'x', kind: 'staff', label: 'x', identityAssurance: 'confirmado_100_por_ciento' },
  }));
  assert.equal(result.ok, false);
});

test('sanitizePayload: allowlist por action — staff_login solo deja pasar "role"', () => {
  const out = sanitizePayload({ role: 'encargado', authSessionId: 'secreto-de-sesion', mesaSessionId: 'no-corresponde' }, 'staff_login');
  assert.deepEqual(out, { role: 'encargado' });
});

test('sanitizePayload: allowlist por action — mesa_session_started solo deja pasar mesa/mesaSessionId', () => {
  const out = sanitizePayload({ mesa: 3, mesaSessionId: 'abc', role: 'no-debería-viajar-acá' }, 'mesa_session_started');
  assert.deepEqual(out, { mesa: 3, mesaSessionId: 'abc' });
});

test('sanitizePayload: canarios de datos sensibles (PIN, bearer, email) nunca sobreviven aunque vengan bajo una clave permitida', () => {
  // Aunque "role" es una clave permitida para staff_login, el valor debe
  // seguir pasando por las reglas de forma/tipo — y ninguna clave por fuera
  // del allowlist puede colar un canario sin importar su nombre.
  const out = sanitizePayload({
    role: 'encargado',
    pin: 'TEST_SECRET_PIN_123',
    token: 'TEST_BEARER_XYZ',
    email: 'test@example.com',
    freeText: 'contenido malicioso <script>alert(1)</script>',
  }, 'staff_login');
  const serialized = JSON.stringify(out);
  assert.ok(!serialized.includes('TEST_SECRET_PIN_123'));
  assert.ok(!serialized.includes('TEST_BEARER_XYZ'));
  assert.ok(!serialized.includes('test@example.com'));
  assert.ok(!serialized.includes('script'));
  assert.deepEqual(out, { role: 'encargado' });
});

test('sanitizePayload: una acción sin allowlist propio cae al allowlist global (fallback), no a "todo permitido"', () => {
  const out = sanitizePayload({ mesa: 5, secretoInventado: 'x' }, 'accion_sin_mapear_todavia');
  assert.deepEqual(out, { mesa: 5 });
});

test('sanitizePayload: objetos vacíos o sin ninguna clave permitida devuelven null (antes que un objeto vacío ambiguo)', () => {
  assert.equal(sanitizePayload({ claveNoPermitida: 1 }, 'staff_login'), null);
  assert.equal(sanitizePayload(null, 'staff_login'), null);
  assert.equal(sanitizePayload(undefined, 'staff_login'), null);
});

test('sanitizePayload: descarta objetos anidados y strings demasiado largos aunque la clave esté permitida', () => {
  const out = sanitizePayload({ mesa: { anidado: true } }, 'mesa_session_started');
  assert.equal(out, null);
  const largo = 'x'.repeat(500);
  const out2 = sanitizePayload({ mesa: largo }, 'mesa_session_started');
  assert.equal(out2, null);
});

test('allowedKeysForAction: expone el mapeo para que server.js y los tests puedan auditar cobertura', () => {
  assert.ok(allowedKeysForAction('staff_login').has('role'));
  assert.ok(allowedKeysForAction('mesa_session_ended').has('mesaSessionId'));
});
