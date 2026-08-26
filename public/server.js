/* =========================================================
   RABIETA — servidor real (MVP), CERO dependencias externas.
   Usa solo módulos nativos de Node (http, fs, path, url) para
   que "node server.js" alcance en cualquier hosting, sin paso
   de instalación que pueda fallar.

   Cómo se sincronizan los celulares en vivo, sin WebSocket:
   - Cada cliente abre un stream Server-Sent Events (SSE) a
     GET /events y se queda escuchando. Cuando el estado
     cambia, el servidor le escribe el nuevo estado a TODOS
     los streams abiertos — así el mozo ve en su celular, en
     tiempo real, lo que pasó en el celular del cliente.
   - Las acciones (pedir, llamar al mozo, marcar listo, etc.)
     viajan como POST /api/action — HTTP normal, nada exótico.

   IMPORTANTE — límite honesto de este MVP:
   El estado vive en la MEMORIA del proceso. Si el servidor se
   reinicia (se cae, se redeploya), se pierde el estado en curso
   (vuelve a las mesas vacías). Para un piloto real de un día
   esto alcanza. Para producción de verdad, el siguiente paso es
   mover este `state` a una base de datos (ver README-DEPLOY.md).
   ========================================================= */
const http = require('http');
const fs = require('fs');
const path = require('path');
const { URL } = require('url');

const MENU_DATA = JSON.parse(fs.readFileSync(path.join(__dirname, 'menu-rabieta.json'), 'utf8'));
const MESAS_TOTAL = MENU_DATA._meta.mesas.placeholder_sugerido; // ver _meta.mesas — número real pendiente de confirmar con el local
const MOZOS = ['Martín', 'Sofía', 'Lucas'];
const SLA = { urgente: 20, importante: 40, normal: 65 }; // segundos — comprimido para demo, configurable

// PIN de acceso al panel de personal. Esto NO es seguridad real (no hay
// usuarios, ni contraseñas por persona, ni cifrado de sesión) — es un
// candado simple para que un cliente que adivina la URL no entre directo.
// Antes de un uso real hace falta autenticación de verdad (ver README).
const STAFF_PIN = process.env.STAFF_PIN || '1234';

let uidCounter = 1;
function uid() { return uidCounter++; }

function seedState() {
  const mesas = [];
  for (let i = 1; i <= MESAS_TOTAL; i++) {
    mesas.push({ numero: i, mozo: MOZOS[i % MOZOS.length], ocupada: false, pedido: null, cuentaPedida: false, alertas: [] });
  }
  return { clockMs: 0, mesas };
}
let state = seedState();

function findMesa(n) { return state.mesas.find(m => m.numero === Number(n)); }

const sseClients = new Set();
function estadoPayload() {
  return 'data: ' + JSON.stringify({ type: 'estado', state, mesasTotal: MESAS_TOTAL }) + '\n\n';
}
function broadcast() {
  const payload = estadoPayload();
  sseClients.forEach(res => { try { res.write(payload); } catch (e) { sseClients.delete(res); } });
}

function handleAction(msg) {
  const m = msg.mesa != null ? findMesa(msg.mesa) : null;
  switch (msg.type) {
    case 'pedido_nuevo': {
      if (!m) return;
      const items = Array.isArray(msg.items) ? msg.items : [];
      if (!items.length) return;
      m.ocupada = true;
      if (m.pedido && m.pedido.estado !== 'entregado') {
        m.pedido.items.push(...items);
      } else {
        m.pedido = { items, estado: 'enviado', enviadoTs: state.clockMs };
      }
      break;
    }
    case 'pedido_estado': {
      if (!m || !m.pedido) return;
      m.pedido.estado = msg.estado;
      break;
    }
    case 'llamar_mozo': {
      if (!m) return;
      m.alertas.push({ id: uid(), tipo: 'mozo', label: 'Llamado al mozo', prioridad: 'normal', mensaje: '', estado: 'recibido', creadoTs: state.clockMs, escalado: false });
      break;
    }
    case 'pedir_cuenta': {
      if (!m) return;
      m.cuentaPedida = true;
      m.alertas.push({ id: uid(), tipo: 'cuenta', label: 'Pidió la cuenta', prioridad: 'importante', mensaje: '', estado: 'recibido', creadoTs: state.clockMs, escalado: false });
      break;
    }
    case 'ayuda': {
      if (!m) return;
      m.alertas.push({ id: uid(), tipo: msg.categoria || 'otro', label: msg.label || 'Reclamo', prioridad: msg.prioridad || 'normal', mensaje: msg.mensaje || '', estado: 'recibido', creadoTs: state.clockMs, escalado: false });
      break;
    }
    case 'alerta_atender': {
      state.mesas.forEach(mm => mm.alertas.forEach(a => { if (a.id === msg.alertaId) a.estado = 'atencion'; }));
      break;
    }
    case 'alerta_resolver': {
      state.mesas.forEach(mm => mm.alertas.forEach(a => {
        if (a.id === msg.alertaId) {
          a.estado = 'resuelto';
          if (a.tipo === 'cuenta') { mm.pedido = null; mm.ocupada = false; mm.cuentaPedida = false; }
        }
      }));
      break;
    }
    case 'mesa_liberar': {
      if (!m) return;
      m.ocupada = false; m.pedido = null; m.cuentaPedida = false; m.alertas = [];
      break;
    }
    case 'reset_demo': {
      state = seedState();
      break;
    }
    default:
      return;
  }
  broadcast();
}

setInterval(() => {
  state.clockMs++;
  state.mesas.forEach(m => {
    if (m.pedido && m.pedido.estado === 'enviado' && (state.clockMs - m.pedido.enviadoTs) > 6) m.pedido.estado = 'preparando';
  });
  state.mesas.forEach(m => m.alertas.forEach(a => {
    if (a.estado === 'recibido' && !a.escalado && (state.clockMs - a.creadoTs) > SLA[a.prioridad]) a.escalado = true;
  }));
  broadcast();
}, 1000);

/* ---------------- servidor HTTP (estático + API + SSE) ---------------- */
const PUBLIC_DIR = path.join(__dirname, 'public');
const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.webp': 'image/webp',
};

function readJsonBody(req, cb) {
  const chunks = [];
  req.on('data', c => chunks.push(c));
  req.on('end', () => {
    try { cb(JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}')); }
    catch (e) { cb({}); }
  });
}

function serveStatic(req, res) {
  let urlPath = decodeURIComponent(new URL(req.url, 'http://internal').pathname);
  if (urlPath === '/' || urlPath === '') urlPath = '/mesa.html';
  const filePath = path.normalize(path.join(PUBLIC_DIR, urlPath));
  if (!filePath.startsWith(PUBLIC_DIR)) { res.writeHead(403); res.end('Prohibido'); return; }
  fs.readFile(filePath, (err, data) => {
    if (err) { res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' }); res.end('No encontrado'); return; }
    res.writeHead(200, { 'Content-Type': MIME[path.extname(filePath)] || 'application/octet-stream' });
    res.end(data);
  });
}

const server = http.createServer((req, res) => {
  const u = new URL(req.url, 'http://internal');

  if (u.pathname === '/api/menu' && req.method === 'GET') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(MENU_DATA));
    return;
  }
  if (u.pathname === '/api/staff-login' && req.method === 'POST') {
    readJsonBody(req, body => {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ ok: body.pin === STAFF_PIN }));
    });
    return;
  }
  if (u.pathname === '/api/action' && req.method === 'POST') {
    readJsonBody(req, body => {
      handleAction(body);
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end('{"ok":true}');
    });
    return;
  }
  if (u.pathname === '/events' && req.method === 'GET') {
    res.writeHead(200, {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no',
    });
    res.write(estadoPayload());
    sseClients.add(res);
    req.on('close', () => sseClients.delete(res));
    return;
  }

  serveStatic(req, res);
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log('Rabieta — servidor real escuchando en el puerto ' + PORT));
