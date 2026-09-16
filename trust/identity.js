'use strict';

/*
 * Identidad honesta para actores del Trust Ledger.
 *
 * Regla central: nunca afirmar identidad personal que el sistema no
 * autenticó. Hoy, staff entra con un PIN por ROL (compartido entre todas
 * las personas que cumplen ese rol) — así que la identidad real que el
 * sistema puede probar es "alguien con el PIN de encargado", no "Sofía".
 * Por eso el actor de staff nunca usa MOZOS ni ningún nombre propio.
 */

const crypto = require('crypto');

const ROLE_LABELS = {
  mozo: 'Mozo',
  cocina: 'Cocina',
  encargado: 'Encargado',
  dueno: 'Dueño',
};

// actorId estable por rol durante la vida del proceso: la credencial es
// compartida, así que la identidad honesta es "el rol", no una persona.
// Se regenera si el proceso reinicia (no hay reconstrucción retroactiva).
const roleActorIds = new Map();

function actorIdForRole(role) {
  if (!roleActorIds.has(role)) {
    roleActorIds.set(role, `staff-role:${role}:${crypto.randomUUID()}`);
  }
  return roleActorIds.get(role);
}

function buildStaffActor(role) {
  return {
    actorId: actorIdForRole(role),
    kind: 'staff',
    label: `${ROLE_LABELS[role] || role} (credencial compartida)`,
    identityAssurance: 'shared_credential',
  };
}

function newAuthSessionId() {
  return crypto.randomUUID();
}

/**
 * Actor para acciones que llegan desde el dispositivo de una mesa
 * (autoservicio del cliente). No hay identidad personal — la única prueba
 * de "quién" es la sesión de mesa (token HMAC si MESA_TOKEN_SECRET está
 * configurado; si no, ni siquiera eso, y se declara explícitamente).
 */
function buildMesaActor(mesaNumero, mesaSessionId, secured) {
  const idParts = ['mesa', String(mesaNumero)];
  if (mesaSessionId) idParts.push(mesaSessionId);
  return {
    actorId: idParts.join(':'),
    kind: 'mesa_client',
    label: `Mesa ${mesaNumero}`,
    identityAssurance: secured ? 'mesa_token' : 'unauthenticated_legacy',
  };
}

function buildSystemActor(label) {
  return {
    actorId: 'system',
    kind: 'system',
    label: label || 'Sistema',
    identityAssurance: 'system',
  };
}

module.exports = {
  ROLE_LABELS,
  buildStaffActor,
  buildMesaActor,
  buildSystemActor,
  newAuthSessionId,
};
