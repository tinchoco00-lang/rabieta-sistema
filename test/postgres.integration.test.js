'use strict';

const assert = require('node:assert/strict');
const { spawn } = require('node:child_process');
const net = require('node:net');
const path = require('node:path');
const { test } = require('node:test');
const { Pool } = require('pg');

const root = path.resolve(__dirname, '..');
const databaseUrl = process.env.DATABASE_URL || '';
const testPin = '8642';

function reservePort() {
  return new Promise((resolve, reject) => {
    const probe = net.createServer();
    probe.unref();
    probe.once('error', reject);
    probe.listen(0, '127.0.0.1', () => {
      const { port } = probe.address();
      probe.close(error => error ? reject(error) : resolve(port));
    });
  });
}

async function startServer(url) {
  const port = await reservePort();
  const baseUrl = `http://127.0.0.1:${port}`;
  let output = '';
  const processHandle = spawn(process.execPath, ['server.js'], {
    cwd: root,
    env: { ...process.env, DATABASE_URL: url, PORT: String(port), STAFF_PIN: testPin },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  processHandle.stdout.on('data', chunk => { output += chunk; });
  processHandle.stderr.on('data', chunk => { output += chunk; });

  const deadline = Date.now() + 8000;
  while (Date.now() < deadline) {
    if (processHandle.exitCode !== null) throw new Error(`El servidor terminó antes de iniciar.\n${output}`);
    try { if ((await fetch(`${baseUrl}/api/menu`)).ok) return { baseUrl, processHandle, getOutput: () => output }; } catch (_) {}
    await new Promise(resolve => setTimeout(resolve, 50));
  }
  processHandle.kill('SIGKILL');
  throw new Error(`El servidor no inició dentro del plazo.\n${output}`);
}

function stopServer(processHandle) {
  if (!processHandle || processHandle.exitCode !== null) return Promise.resolve(processHandle && processHandle.exitCode);
  return new Promise(resolve => {
    const forceStop = setTimeout(() => { if (processHandle.exitCode === null) processHandle.kill('SIGKILL'); }, 4000);
    forceStop.unref();
    processHandle.once('exit', code => { clearTimeout(forceStop); resolve(code); });
    processHandle.kill('SIGTERM');
  });
}

async function post(baseUrl, route, body, token) {
  const headers = { 'content-type': 'application/json' };
  if (token) headers.authorization = `Bearer ${token}`;
  return fetch(`${baseUrl}${route}`, { method: 'POST', headers, body: JSON.stringify(body) });
}

async function getState(baseUrl) {
  const response = await fetch(`${baseUrl}/events?mesa=1`);
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let body = '';
  while (!body.includes('\n\n')) {
    const { done, value } = await reader.read();
    if (done) break;
    body += decoder.decode(value, { stream: true });
  }
  await reader.cancel();
  const line = body.split('\n').find(candidate => candidate.startsWith('data: '));
  assert.ok(line, 'SSE debe entregar el estado recuperado');
  return JSON.parse(line.slice(6)).state;
}

test('PostgreSQL real recupera estado tras reinicio y no persiste tokens', { skip: !databaseUrl }, async () => {
  const adminPool = new Pool({ connectionString: databaseUrl });
  let firstServer;
  let secondServer;
  try {
    await adminPool.query('DROP TABLE IF EXISTS rabieta_estado');

    firstServer = await startServer(databaseUrl);
    const login = await post(firstServer.baseUrl, '/api/staff-login', { pin: testPin });
    assert.equal(login.status, 200);
    const { token } = await login.json();
    assert.match(token, /^[a-f0-9]{64}$/);

    assert.equal((await post(firstServer.baseUrl, '/api/action', {
      type: 'pedido_nuevo', mesa: 1, items: [{ productoId: 'hummus-rabieta', observacion: 'persistir sin cebolla' }],
    })).status, 200);
    assert.equal((await post(firstServer.baseUrl, '/api/action', {
      type: 'ayuda', mesa: 1, categoria: 'otro', mensaje: 'persistir alerta',
    })).status, 200);

    assert.equal(await stopServer(firstServer.processHandle), 0, firstServer.getOutput());
    firstServer = null;

    const stored = await adminPool.query('SELECT state, updated_at FROM rabieta_estado WHERE id = 1');
    assert.equal(stored.rows.length, 1);
    assert.ok(stored.rows[0].updated_at instanceof Date);
    assert.equal(stored.rows[0].state.mesas[0].ocupada, true);

    secondServer = await startServer(databaseUrl);
    const recovered = await getState(secondServer.baseUrl);
    assert.equal(recovered.mesas[0].ocupada, true);
    assert.equal(recovered.mesas[0].pedido.items[0].nombre, 'Hummus Rabieta');
    assert.equal(recovered.mesas[0].pedido.items[0].precio, 4600);
    assert.equal(recovered.mesas[0].pedido.items[0].notas, 'persistir sin cebolla');
    assert.equal(recovered.mesas[0].alertas[0].mensaje, 'persistir alerta');

    const oldToken = await post(secondServer.baseUrl, '/api/action', { type: 'reset_demo' }, token);
    assert.equal(oldToken.status, 401, 'un token del proceso anterior no debe sobrevivir el reinicio');
  } finally {
    if (firstServer) await stopServer(firstServer.processHandle);
    if (secondServer) await stopServer(secondServer.processHandle);
    await adminPool.query('DROP TABLE IF EXISTS rabieta_estado');
    await adminPool.end();
  }
});

test('PostgreSQL normaliza pedidos legacy para operar por item sin perder estado', { skip: !databaseUrl }, async () => {
  const adminPool = new Pool({ connectionString: databaseUrl });
  let server;
  try {
    await adminPool.query('DROP TABLE IF EXISTS rabieta_estado');
    await adminPool.query(`
      CREATE TABLE rabieta_estado (
        id SMALLINT PRIMARY KEY CHECK (id = 1),
        state JSONB NOT NULL,
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);
    const legacyState = {
      clockMs: 42,
      mesas: [{
        numero: 1,
        mozo: 'Sofía',
        ocupada: true,
        pedido: {
          items: [{ productoId: 'hummus-rabieta', nombre: 'Hummus Rabieta', precio: 4600, notas: '' }],
          estado: 'listo',
          enviadoTs: 10,
        },
        cuentaPedida: false,
        alertas: [],
      }],
    };
    await adminPool.query(
      'INSERT INTO rabieta_estado (id, state) VALUES (1, $1::jsonb)',
      [JSON.stringify(legacyState)]
    );

    server = await startServer(databaseUrl);
    const recovered = await getState(server.baseUrl);
    const item = recovered.mesas[0].pedido.items[0];
    assert.ok(Number.isInteger(item.id));
    assert.equal(item.estado, 'listo');
    assert.equal(item.enviadoTs, 10);

    const login = await post(server.baseUrl, '/api/staff-login', { pin: testPin });
    const { token } = await login.json();
    assert.equal((await post(server.baseUrl, '/api/action', {
      type: 'pedido_estado', mesa: 1, itemId: item.id, estado: 'entregado',
    }, token)).status, 200);
    assert.equal((await getState(server.baseUrl)).mesas[0].pedido.estado, 'entregado');
  } finally {
    if (server) await stopServer(server.processHandle);
    await adminPool.query('DROP TABLE IF EXISTS rabieta_estado');
    await adminPool.end();
  }
});

test('DATABASE_URL configurada y no disponible impide iniciar el servidor', { skip: !databaseUrl }, async () => {
  const databasePort = await reservePort();
  const appPort = await reservePort();
  let output = '';
  const processHandle = spawn(process.execPath, ['server.js'], {
    cwd: root,
    env: {
      ...process.env,
      DATABASE_URL: `postgresql://postgres:postgres@127.0.0.1:${databasePort}/inexistente?connect_timeout=1`,
      PORT: String(appPort),
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  processHandle.stdout.on('data', chunk => { output += chunk; });
  processHandle.stderr.on('data', chunk => { output += chunk; });
  const exitCode = await new Promise((resolve, reject) => {
    const timeout = setTimeout(() => { processHandle.kill('SIGKILL'); reject(new Error(`El proceso no falló a tiempo.\n${output}`)); }, 5000);
    processHandle.once('exit', code => { clearTimeout(timeout); resolve(code); });
  });
  assert.notEqual(exitCode, 0);
  assert.match(output, /"event":"startup_error"/);
  assert.doesNotMatch(output, /"event":"server_started"/);
  await assert.rejects(fetch(`http://127.0.0.1:${appPort}/api/menu`));
});
