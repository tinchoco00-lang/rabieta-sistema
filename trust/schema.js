'use strict';

/*
 * Trust Event Contract V1 — deliberately separado del estado operativo
 * (state.mesas/analytics) y de cualquier "ledger" improvisado previo.
 *
 * Un Trust Event es un hecho auditable, append-only, con identidad honesta:
 * nunca afirma más certeza sobre "quién hizo esto" de la que el sistema
 * realmente autenticó (ver trust/identity.js).
 *
 * Este módulo NO decide cuándo emitir eventos (eso vive en server.js, en los
 * puntos de integración explícitos de #45A). Solo define la forma del
 * evento, la valida, y aplica el allowlist de privacidad sobre
 * before/after/metadata antes de que lleguen a cualquier store.
 */

const crypto = require('crypto');

const SCHEMA_VERSION = 'trust-event-v1';

const VALID_DATA_CLASSES = new Set(['operational', 'demo', 'synthetic']);
const VALID_ACTOR_KINDS = new Set(['staff', 'mesa_client', 'system']);
const VALID_IDENTITY_ASSURANCE = new Set([
  'shared_credential', // PIN de rol compartido — no identifica a una persona
  'mesa_token', // token HMAC de mesa (MESA_TOKEN_SECRET configurado)
  'unauthenticated_legacy', // compatibilidad sin MESA_TOKEN_SECRET — explícito, no se disfraza de autenticado
  'system', // generado por el propio proceso (arranque, migraciones, etc.)
]);

// Allowlist positiva GLOBAL: el techo absoluto de claves que antes/después/
// metadata pueden llegar a tener, sea cual sea la acción. Nunca una lista
// negra. Se mantiene exportada por compatibilidad y como fallback para una
// acción que todavía no tiene su propio allowlist más angosto abajo.
const ALLOWED_PAYLOAD_KEYS = new Set([
  'role',
  'estado',
  'ocupada',
  'numero',
  'mesa',
  'mesaSessionId',
  'authSessionId',
  'actorId',
  'identityAssurance',
  'modo',
  'medio',
  'accion',
  'allowedViews',
  'motivo',
]);

// Allowlist POR ACTION (Trust Foundation #45A P0-5): antes esto era un único
// set global, lo que permitía que cualquier acción arrastrara cualquier
// clave "permitida en general" aunque no tuviera nada que ver con lo que esa
// acción realmente cambia. Cada acción declara acá exactamente qué campos
// tiene sentido que antes/después/metadata contengan — nunca un snapshot
// completo del estado, y nunca menos de lo necesario para que el cambio se
// entienda. Una acción sin entrada acá cae al allowlist global (fallback),
// no a "nada permitido", para no romper antes de que se termine de mapear
// cada acción existente.
const PAYLOAD_KEYS_BY_ACTION = {
  staff_login: new Set(['role']),
  mesa_session_started: new Set(['mesa', 'mesaSessionId']),
  mesa_session_ended: new Set(['mesa', 'mesaSessionId']),
};

function allowedKeysForAction(action) {
  return PAYLOAD_KEYS_BY_ACTION[action] || ALLOWED_PAYLOAD_KEYS;
}

const MAX_STRING_VALUE_LENGTH = 120;

function sanitizePayload(value, action) {
  if (value === null || value === undefined) return null;
  if (typeof value !== 'object' || Array.isArray(value)) return null;
  const allowedKeys = allowedKeysForAction(action);
  const out = {};
  for (const [key, raw] of Object.entries(value)) {
    if (!allowedKeys.has(key)) continue;
    if (raw === null) { out[key] = null; continue; }
    const type = typeof raw;
    if (type === 'number' || type === 'boolean') { out[key] = raw; continue; }
    if (type === 'string' && raw.length <= MAX_STRING_VALUE_LENGTH) { out[key] = raw; continue; }
    if (Array.isArray(raw) && raw.every(item => typeof item === 'string' && item.length <= MAX_STRING_VALUE_LENGTH)) {
      out[key] = raw.slice(0, 20);
    }
    // Cualquier otra forma (objetos anidados, strings largos, etc.) se descarta:
    // el allowlist es de claves Y de forma, no solo de nombres.
  }
  return Object.keys(out).length ? out : null;
}

function isNonEmptyString(value) {
  return typeof value === 'string' && value.length > 0;
}

function validateActor(actor) {
  if (!actor || typeof actor !== 'object') return 'actor requerido';
  if (!isNonEmptyString(actor.actorId)) return 'actor.actorId requerido';
  if (!VALID_ACTOR_KINDS.has(actor.kind)) return `actor.kind inválido: ${actor.kind}`;
  if (!isNonEmptyString(actor.label)) return 'actor.label requerido';
  if (!VALID_IDENTITY_ASSURANCE.has(actor.identityAssurance)) {
    return `actor.identityAssurance inválido: ${actor.identityAssurance}`;
  }
  return null;
}

/**
 * Construye y valida un Trust Event a partir de un input parcial.
 * NO asigna `sequence` — eso lo hace el store en el momento del append,
 * de forma atómica y específica a cada backend de almacenamiento.
 *
 * Devuelve { ok: true, event } o { ok: false, error }.
 */
function buildTrustEvent(input) {
  if (!input || typeof input !== 'object') return { ok: false, error: 'input inválido' };

  if (!isNonEmptyString(input.tenantId)) return { ok: false, error: 'tenantId requerido' };
  if (!isNonEmptyString(input.localId)) return { ok: false, error: 'localId requerido' };
  if (!isNonEmptyString(input.action)) return { ok: false, error: 'action requerido' };
  if (!isNonEmptyString(input.source)) return { ok: false, error: 'source requerido' };
  if (!VALID_DATA_CLASSES.has(input.dataClass)) return { ok: false, error: `dataClass inválido: ${input.dataClass}` };

  const actorError = validateActor(input.actor);
  if (actorError) return { ok: false, error: actorError };

  if (!input.entity || typeof input.entity !== 'object' || !isNonEmptyString(input.entity.type) || !isNonEmptyString(String(input.entity.id ?? ''))) {
    return { ok: false, error: 'entity {type, id} requerido' };
  }

  if (input.dataClass === 'demo' && !isNonEmptyString(input.demoRunId)) {
    return { ok: false, error: 'demoRunId requerido cuando dataClass es demo' };
  }

  const event = {
    schemaVersion: SCHEMA_VERSION,
    eventId: crypto.randomUUID(),
    // sequence: asignado por el store en el append.
    timestamp: new Date().toISOString(), // UTC real de wall-clock, nunca state.clockMs
    occurredAt: isNonEmptyString(input.occurredAt) ? input.occurredAt : null,
    tenantId: input.tenantId,
    localId: input.localId,
    actor: {
      actorId: input.actor.actorId,
      kind: input.actor.kind,
      label: input.actor.label,
      identityAssurance: input.actor.identityAssurance,
    },
    role: isNonEmptyString(input.role) ? input.role : null,
    authSessionId: isNonEmptyString(input.authSessionId) ? input.authSessionId : null,
    mesa: Number.isInteger(input.mesa) ? input.mesa : null,
    mesaSessionId: isNonEmptyString(input.mesaSessionId) ? input.mesaSessionId : null,
    pedidoId: isNonEmptyString(input.pedidoId) ? input.pedidoId : null,
    entity: { type: input.entity.type, id: String(input.entity.id) },
    action: input.action,
    before: sanitizePayload(input.before, input.action),
    after: sanitizePayload(input.after, input.action),
    reason: isNonEmptyString(input.reason) ? input.reason.slice(0, 200) : null,
    source: input.source,
    dataClass: input.dataClass,
    demoRunId: isNonEmptyString(input.demoRunId) ? input.demoRunId : null,
    correlationId: isNonEmptyString(input.correlationId) ? input.correlationId : null,
    idempotencyId: isNonEmptyString(input.idempotencyId) ? input.idempotencyId : null,
    requestId: isNonEmptyString(input.requestId) ? input.requestId : null,
    stateVersion: isNonEmptyString(input.stateVersion) ? input.stateVersion : null,
    causationEventId: isNonEmptyString(input.causationEventId) ? input.causationEventId : null,
    correctsEventId: isNonEmptyString(input.correctsEventId) ? input.correctsEventId : null,
    metadata: sanitizePayload(input.metadata, input.action),
  };

  return { ok: true, event };
}

module.exports = {
  SCHEMA_VERSION,
  VALID_DATA_CLASSES,
  VALID_ACTOR_KINDS,
  VALID_IDENTITY_ASSURANCE,
  ALLOWED_PAYLOAD_KEYS,
  PAYLOAD_KEYS_BY_ACTION,
  allowedKeysForAction,
  sanitizePayload,
  buildTrustEvent,
};
