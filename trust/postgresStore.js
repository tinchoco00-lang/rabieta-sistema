'use strict';

const { Pool } = require('pg');

/*
 * PostgresTrustStore — tabla independiente `trust_events`.
 *
 * Deliberadamente NO es otro snapshot JSONB como `rabieta_estado`
 * (ver persistence.js): cada evento es una fila propia, append-only,
 * con su propia PK autoincremental (`sequence`) que además sirve como
 * cursor de paginación estable.
 */

const CREATE_TABLE_SQL = `
  CREATE TABLE IF NOT EXISTS trust_events (
    sequence BIGSERIAL PRIMARY KEY,
    event_id UUID NOT NULL UNIQUE,
    schema_version TEXT NOT NULL,
    recorded_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    "timestamp" TIMESTAMPTZ NOT NULL,
    occurred_at TIMESTAMPTZ NULL,
    tenant_id TEXT NOT NULL,
    local_id TEXT NOT NULL,
    actor JSONB NOT NULL,
    role TEXT NULL,
    auth_session_id TEXT NULL,
    mesa INTEGER NULL,
    mesa_session_id TEXT NULL,
    pedido_id TEXT NULL,
    entity JSONB NOT NULL,
    action TEXT NOT NULL,
    before_state JSONB NULL,
    after_state JSONB NULL,
    reason TEXT NULL,
    source TEXT NOT NULL,
    data_class TEXT NOT NULL,
    demo_run_id TEXT NULL,
    correlation_id TEXT NULL,
    idempotency_id TEXT NULL,
    request_id TEXT NULL,
    state_version TEXT NULL,
    causation_event_id UUID NULL,
    corrects_event_id UUID NULL,
    metadata JSONB NULL
  )
`;

const CREATE_INDEX_SQL = [
  `CREATE INDEX IF NOT EXISTS trust_events_tenant_local_sequence_idx
     ON trust_events (tenant_id, local_id, sequence)`,
];

// Intento honesto de append-only a nivel de permisos. Si el rol de la
// conexión no tiene privilegio para revocar (por ejemplo, no es el owner
// de la tabla en el hosting elegido), esto falla y se documenta — no se
// promete más protección de la que realmente existe (ver docs/SECURITY.md
// y el reporte de #45A).
const HARDENING_STATEMENTS = [
  'REVOKE UPDATE, DELETE, TRUNCATE ON trust_events FROM PUBLIC',
];

function toJson(value) {
  return value === null || value === undefined ? null : JSON.stringify(value);
}

function rowToEvent(row) {
  return {
    schemaVersion: row.schema_version,
    eventId: row.event_id,
    sequence: Number(row.sequence),
    timestamp: row.timestamp instanceof Date ? row.timestamp.toISOString() : row.timestamp,
    occurredAt: row.occurred_at instanceof Date ? row.occurred_at.toISOString() : row.occurred_at,
    tenantId: row.tenant_id,
    localId: row.local_id,
    actor: row.actor,
    role: row.role,
    authSessionId: row.auth_session_id,
    mesa: row.mesa,
    mesaSessionId: row.mesa_session_id,
    pedidoId: row.pedido_id,
    entity: row.entity,
    action: row.action,
    before: row.before_state,
    after: row.after_state,
    reason: row.reason,
    source: row.source,
    dataClass: row.data_class,
    demoRunId: row.demo_run_id,
    correlationId: row.correlation_id,
    idempotencyId: row.idempotency_id,
    requestId: row.request_id,
    stateVersion: row.state_version,
    causationEventId: row.causation_event_id,
    correctsEventId: row.corrects_event_id,
    metadata: row.metadata,
  };
}

class PostgresTrustStore {
  constructor(databaseUrl, PoolClass = Pool) {
    this.pool = new PoolClass({ connectionString: databaseUrl });
    this._ready = null;
    this.hardeningWarnings = [];
  }

  async _ensureReady() {
    if (!this._ready) {
      this._ready = (async () => {
        await this.pool.query(CREATE_TABLE_SQL);
        for (const sql of CREATE_INDEX_SQL) {
          await this.pool.query(sql);
        }
        for (const sql of HARDENING_STATEMENTS) {
          try {
            await this.pool.query(sql);
          } catch (error) {
            this.hardeningWarnings.push(`No se pudo aplicar "${sql}": ${error.message}`);
          }
        }
      })();
    }
    return this._ready;
  }

  async append(event) {
    await this._ensureReady();
    const result = await this.pool.query(
      `INSERT INTO trust_events (
        event_id, schema_version, "timestamp", occurred_at, tenant_id, local_id,
        actor, role, auth_session_id, mesa, mesa_session_id, pedido_id, entity,
        action, before_state, after_state, reason, source, data_class, demo_run_id,
        correlation_id, idempotency_id, request_id, state_version,
        causation_event_id, corrects_event_id, metadata
      ) VALUES (
        $1,$2,$3,$4,$5,$6,$7::jsonb,$8,$9,$10,$11,$12,$13::jsonb,$14,$15::jsonb,$16::jsonb,
        $17,$18,$19,$20,$21,$22,$23,$24,$25,$26,$27::jsonb
      ) RETURNING sequence`,
      [
        event.eventId,
        event.schemaVersion,
        event.timestamp,
        event.occurredAt,
        event.tenantId,
        event.localId,
        toJson(event.actor),
        event.role,
        event.authSessionId,
        event.mesa,
        event.mesaSessionId,
        event.pedidoId,
        toJson(event.entity),
        event.action,
        toJson(event.before),
        toJson(event.after),
        event.reason,
        event.source,
        event.dataClass,
        event.demoRunId,
        event.correlationId,
        event.idempotencyId,
        event.requestId,
        event.stateVersion,
        event.causationEventId,
        event.correctsEventId,
        toJson(event.metadata),
      ]
    );
    return { ...event, sequence: Number(result.rows[0].sequence) };
  }

  async list({ tenantId, localId, limit = 50, after = 0 } = {}) {
    await this._ensureReady();
    const capped = Math.min(Math.max(Number(limit) || 50, 1), 200);
    const conditions = ['sequence > $1'];
    const params = [Number(after) || 0];
    if (tenantId) {
      params.push(tenantId);
      conditions.push(`tenant_id = $${params.length}`);
    }
    if (localId) {
      params.push(localId);
      conditions.push(`local_id = $${params.length}`);
    }
    params.push(capped);
    const result = await this.pool.query(
      `SELECT * FROM trust_events WHERE ${conditions.join(' AND ')} ORDER BY sequence ASC LIMIT $${params.length}`,
      params
    );
    const events = result.rows.map(rowToEvent);
    const nextCursor = events.length === capped ? events[events.length - 1].sequence : null;
    return { events, nextCursor };
  }

  async count() {
    await this._ensureReady();
    const result = await this.pool.query('SELECT COUNT(*)::int AS count FROM trust_events');
    return result.rows[0].count;
  }

  async close() {
    await this.pool.end();
  }
}

module.exports = {
  PostgresTrustStore,
  CREATE_TABLE_SQL,
  CREATE_INDEX_SQL,
  HARDENING_STATEMENTS,
};
