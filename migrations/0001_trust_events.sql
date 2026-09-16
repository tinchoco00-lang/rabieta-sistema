-- Trust Event Contract V1 — tabla independiente.
--
-- Esta migración documenta exactamente lo que trust/postgresStore.js aplica
-- en runtime (CREATE TABLE IF NOT EXISTS + índice + intento de hardening).
-- No se ejecuta un runner de migraciones separado en este MVP: el store la
-- aplica de forma idempotente al primer uso, igual que persistence.js hace
-- con rabieta_estado. Este archivo existe para que el DBA/hosting pueda
-- revisar el esquema sin leer JS, y para dejar documentado el límite real
-- del hardening append-only.

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
);

CREATE INDEX IF NOT EXISTS trust_events_tenant_local_sequence_idx
  ON trust_events (tenant_id, local_id, sequence);

-- Hardening append-only — LÍMITE HONESTO:
-- Esto revoca UPDATE/DELETE/TRUNCATE de PUBLIC, pero NO de:
--   (a) el rol dueño/owner de la tabla (siempre puede hacer DDL/DML), ni
--   (b) cualquier rol con privilegios de superusuario o BYPASSRLS.
-- En la mayoría de hostings gestionados (Railway, Render, Supabase, RDS con
-- el usuario "admin" por defecto) la conexión de la app corre justamente
-- como owner de la tabla, así que esta REVOKE no impide que esa misma
-- conexión borre o edite filas si el código lo permitiera (el código de
-- trust/index.js y trust/postgresStore.js no expone ningún método de
-- update/delete — la protección real hoy es "no existe la API", no
-- "la base de datos la bloquea"). Una protección real a nivel de DB
-- requiere un rol de aplicación separado del owner, con GRANT INSERT, SELECT
-- únicamente — eso queda para cuando el hosting definitivo esté decidido
-- (documentado como pendiente, no prometido como ya resuelto).
REVOKE UPDATE, DELETE, TRUNCATE ON trust_events FROM PUBLIC;
