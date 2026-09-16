'use strict';

const assert = require('node:assert/strict');
const { test } = require('node:test');
const { buildStaffActor, buildMesaActor, buildSystemActor, newAuthSessionId } = require('../trust/identity');

test('buildStaffActor: identityAssurance siempre shared_credential, nunca personal', () => {
  const actor = buildStaffActor('mozo');
  assert.equal(actor.identityAssurance, 'shared_credential');
  assert.equal(actor.kind, 'staff');
});

test('buildStaffActor: actorId estable para el mismo rol, distinto entre roles', () => {
  const a1 = buildStaffActor('encargado');
  const a2 = buildStaffActor('encargado');
  const a3 = buildStaffActor('dueno');
  assert.equal(a1.actorId, a2.actorId);
  assert.notEqual(a1.actorId, a3.actorId);
});

test('buildStaffActor: el label nunca contiene nombres propios de MOZOS', () => {
  const MOZOS = ['Martín', 'Sofía', 'Lucas'];
  ['mozo', 'cocina', 'encargado', 'dueno'].forEach(role => {
    const actor = buildStaffActor(role);
    MOZOS.forEach(nombre => assert.ok(!actor.label.includes(nombre)));
    MOZOS.forEach(nombre => assert.ok(!actor.actorId.includes(nombre)));
  });
});

test('newAuthSessionId: genera un UUID distinto en cada llamada', () => {
  const ids = new Set(Array.from({ length: 20 }, () => newAuthSessionId()));
  assert.equal(ids.size, 20);
  ids.forEach(id => assert.match(id, /^[0-9a-f-]{36}$/i));
});

test('buildMesaActor: identityAssurance refleja si hay MESA_TOKEN_SECRET real, sin fingir', () => {
  const secured = buildMesaActor(3, 'session-1', true);
  const legacy = buildMesaActor(3, 'session-1', false);
  assert.equal(secured.identityAssurance, 'mesa_token');
  assert.equal(legacy.identityAssurance, 'unauthenticated_legacy');
  assert.equal(secured.kind, 'mesa_client');
});

test('buildSystemActor: identityAssurance system, label configurable', () => {
  const actor = buildSystemActor('Arranque');
  assert.equal(actor.identityAssurance, 'system');
  assert.equal(actor.label, 'Arranque');
});
