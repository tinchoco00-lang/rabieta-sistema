'use strict';

const { Pool } = require('pg');

const CREATE_TABLE_SQL = `
  CREATE TABLE IF NOT EXISTS rabieta_estado (
    id SMALLINT PRIMARY KEY CHECK (id = 1),
    state JSONB NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )
`;

class MemoryPersistence {
  constructor() { this.enabled = false; }
  async initialize(defaultState) { return defaultState; }
  async save() {}
  async close() {}
}

class PostgresPersistence {
  constructor(databaseUrl, PoolClass = Pool) {
    this.enabled = true;
    this.pool = new PoolClass({ connectionString: databaseUrl });
  }

  async initialize(defaultState) {
    try {
      await this.pool.query(CREATE_TABLE_SQL);
      const result = await this.pool.query('SELECT state FROM rabieta_estado WHERE id = 1');
      if (result.rows.length) {
        const storedState = result.rows[0].state;
        if (!storedState || typeof storedState !== 'object' || !Array.isArray(storedState.mesas)) {
          throw new Error('El estado persistido en PostgreSQL no tiene un formato válido');
        }
        return storedState;
      }
      await this.save(defaultState);
      return defaultState;
    } catch (error) {
      await this.pool.end().catch(() => {});
      throw error;
    }
  }

  async save(state) {
    await this.pool.query(
      `INSERT INTO rabieta_estado (id, state, updated_at)
       VALUES (1, $1::jsonb, NOW())
       ON CONFLICT (id) DO UPDATE
       SET state = EXCLUDED.state, updated_at = EXCLUDED.updated_at`,
      [JSON.stringify(state)]
    );
  }

  async close(state) {
    await this.save(state);
    await this.pool.end();
  }
}

function createPersistence({ databaseUrl = process.env.DATABASE_URL, PoolClass = Pool } = {}) {
  return databaseUrl ? new PostgresPersistence(databaseUrl, PoolClass) : new MemoryPersistence();
}

module.exports = { createPersistence };
