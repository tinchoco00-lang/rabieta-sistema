'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const net = require('node:net');
const { spawn } = require('node:child_process');
const { test } = require('node:test');
const root = path.resolve(__dirname, '..');
const source = fs.readFileSync(path.join(root, 'public/app.js'), 'utf8');
function client(fetchImpl) {
  const ctx = {
    state: { role: 'cliente', clienteMesa: 99, mesas: [] },
    STAFF_TOKEN: '', MESA_TOKEN: '', fetch: fetchImpl,
    liveReady: false, MESAS_TOTAL: 12, setConnPill() {},
    detectarAvancesPedidoCliente() {}, emptyAnalytics: () => ({}), emptyBaseline: () => ({}),
    detectarNuevasAlertas() {}, clienteEditandoFormulario: () => false, render() {},
  };
  vm.createContext(ctx);
  for (const name of ['send', 'aplicarMensajeRealtime']) {
    const fn = source.match(new RegExp(`function ${name}\\([^]*?\\r?\\n\\}`));
    assert.ok(fn, `${name} must exist`);
    vm.runInContext(fn[0], ctx);
  }
  return ctx;
}

test('RVO send: target table, immutable payload, staff, empty IDs and concurrent captures', async () => {
  const requests = [];
  const c = client(async (url, options) => { requests.push(JSON.parse(options.body)); return { status: 200 }; });
  c.state.mesas = [{ numero: 1, mesaSessionId: 'A' }, { numero: 2, mesaSessionId: 'B' }];
  const payload = Object.freeze({ type: 'ayuda', mesa: 2 });
  await c.send(payload);
  assert.equal(requests.at(-1).mesaSessionId, 'B');
  assert.equal(payload.mesaSessionId, undefined);
  await Promise.all([c.send({ mesa: 1 }), c.send({ mesa: 2 })]);
  assert.deepEqual(requests.slice(-2).map(r => r.mesaSessionId), ['A', 'B']);
  for (const id of [null, '', undefined]) {
    c.state.mesas = [{ numero: 1, mesaSessionId: id }];
    await c.send({ mesa: 1 });
    assert.equal(Object.hasOwn(requests.at(-1), 'mesaSessionId'), false);
  }
  await c.send({ mesa: 3 });
  assert.equal(Object.hasOwn(requests.at(-1), 'mesaSessionId'), false);
  c.state.mesas = [{ numero: 1, mesaSessionId: 'A' }];
  c.state.role = 'encargado';
  await c.send({ mesa: 1, type: 'mesa_liberar' });
  assert.equal(Object.hasOwn(requests.at(-1), 'mesaSessionId'), false);
  // Snapshot is authoritative even if a caller accidentally supplies an old ID.
  c.state.role = 'cliente';
  await c.send({ mesa: 1, mesaSessionId: 'old' });
  assert.equal(requests.at(-1).mesaSessionId, 'A');
});

test('RVO real HTTP/SSE: free -> A -> rounds -> close -> B -> stale replay -> reconnect/reload', { timeout: 20000 }, async t => {
  const probe = net.createServer();
  await new Promise(resolve => probe.listen(0, '127.0.0.1', resolve));
  const port = probe.address().port;
  await new Promise(resolve => probe.close(resolve));
  const url = `http://127.0.0.1:${port}`;
  const proc = spawn(process.execPath, ['server.js'], {
    cwd: root,
    env: { ...process.env, PORT: String(port), STAFF_PIN: '4455', DATABASE_URL: '', MESA_TOKEN_SECRET: '', NODE_ENV: 'test' },
    stdio: 'ignore',
  });
  t.after(async () => {
    if (proc.exitCode !== null) return;
    await new Promise(resolve => { proc.once('exit', resolve); proc.kill(); });
  });
  let ready = false;
  for (let i = 0; i < 100; i++) {
    try { if ((await fetch(`${url}/api/menu`)).ok) { ready = true; break; } } catch {}
    await new Promise(resolve => setTimeout(resolve, 30));
  }
  assert.ok(ready, 'server ready');
  const sent = [];
  const transport = (route, opts) => { sent.push(JSON.parse(opts.body)); return fetch(url + route, opts); };
  const c = client(transport);
  async function snapshot(target = c, mesa = 1) {
    const response = await fetch(`${url}/events?mesa=${mesa}`, { signal: AbortSignal.timeout(5000) });
    assert.equal(response.status, 200);
    const reader = response.body.getReader();
    let body = '';
    try {
      while (!body.includes('\n\n')) {
        const chunk = await reader.read();
        assert.equal(chunk.done, false);
        body += new TextDecoder().decode(chunk.value);
      }
    } finally { await reader.cancel(); }
    const data = body.split('\n').find(line => line.startsWith('data: ')).slice(6);
    target.aplicarMensajeRealtime(data, null);
    return target.state.mesas[0];
  }
  async function raw(payload, token) {
    return fetch(`${url}/api/action`, {
      method: 'POST', headers: { 'content-type': 'application/json', ...(token ? { authorization: `Bearer ${token}` } : {}) },
      body: JSON.stringify(payload),
    });
  }
  const order = { type: 'pedido_nuevo', mesa: 1, items: [{ productoId: 'hummus-rabieta' }] };
  assert.equal((await snapshot()).mesaSessionId, null);
  assert.equal((await c.send(order)).status, 200);
  assert.equal(Object.hasOwn(sent.at(-1), 'mesaSessionId'), false);
  const A = (await snapshot()).mesaSessionId;
  assert.ok(A);
  assert.equal((await c.send(order)).status, 200);
  assert.equal(sent.at(-1).mesaSessionId, A);
  const rounds = await Promise.all([c.send(order), c.send(order)]);
  assert.deepEqual(rounds.map(r => r.status), [200, 200]);
  assert.ok(sent.slice(-2).every(r => r.mesaSessionId === A));
  assert.equal((await c.send({ type: 'pedir_cuenta', mesa: 1 })).status, 200);
  assert.equal(sent.at(-1).mesaSessionId, A);
  const login = await fetch(`${url}/api/staff-login`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ pin: '4455', role: 'encargado' }) });
  assert.equal(login.status, 200);
  const { token } = await login.json();
  const staff = client(transport);
  staff.state.role = 'encargado'; staff.STAFF_TOKEN = token; staff.state.mesas = c.state.mesas;
  for (const type of ['pago_demo_confirmar', 'mesa_liberar']) {
    assert.equal((await staff.send({ type, mesa: 1 })).status, 200);
    assert.equal(Object.hasOwn(sent.at(-1), 'mesaSessionId'), false);
  }
  assert.equal((await snapshot()).mesaSessionId, null);
  assert.equal((await c.send(order)).status, 200);
  const B = (await snapshot()).mesaSessionId;
  assert.ok(B); assert.notEqual(B, A);
  const before = JSON.parse(JSON.stringify(c.state.mesas[0]));
  const replays = await Promise.all([raw({ type: 'pedir_cuenta', mesa: 1, mesaSessionId: A }), raw({ ...order, mesaSessionId: A })]);
  assert.deepEqual(replays.map(r => r.status), [409, 409]);
  assert.deepEqual(JSON.parse(JSON.stringify(await snapshot())), before, 'rejected replays leave the entire target table intact');
  assert.equal((await snapshot()).mesaSessionId, B, 'reconnect snapshot');
  const reloaded = client(transport);
  assert.equal((await snapshot(reloaded)).mesaSessionId, B, 'new client reload snapshot');
  assert.equal((await reloaded.send(order)).status, 200);
  assert.equal(sent.at(-1).mesaSessionId, B);
  assert.equal((await raw({ ...order, mesa: 2 })).status, 200);
  const other = (await snapshot(client(transport), 2)).mesaSessionId;
  assert.notEqual(other, B);
  assert.equal((await raw({ type: 'pedir_cuenta', mesa: 1, mesaSessionId: other })).status, 409);
  for (const id of [undefined, null, '']) {
    assert.equal((await raw({ ...order, mesaSessionId: id })).status, 200, 'LIMITATION: legacy/empty ID accepted');
  }
  assert.equal((await reloaded.send({ type: 'pedir_cuenta', mesa: 1 })).status, 200);
  assert.equal(sent.at(-1).mesaSessionId, B);
});
