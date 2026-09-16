'use strict';

/*
 * Quién puede leer el ledger de confianza. Deliberadamente restrictivo:
 * el ledger completo NUNCA se manda por SSE ni se mezcla en `state` — la
 * única forma de leerlo es esta API paginada, y solo para estos roles.
 */
const QUERY_ALLOWED_ROLES = new Set(['dueno', 'encargado']);

function canQueryTrustLedger(role) {
  return QUERY_ALLOWED_ROLES.has(role);
}

module.exports = { QUERY_ALLOWED_ROLES, canQueryTrustLedger };
