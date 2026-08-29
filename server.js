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
const crypto = require('crypto');
const { URL } = require('url');
const { createPersistence } = require('./persistence');

const MENU_DATA = JSON.parse(fs.readFileSync(path.join(__dirname, 'menu-rabieta.json'), 'utf8'));
const MESAS_TOTAL = MENU_DATA._meta.mesas.placeholder_sugerido; // ver _meta.mesas — número real pendiente de confirmar con el local
const MOZOS = ['Martín', 'Sofía', 'Lucas'];
const SLA = { urgente: 20, importante: 40, normal: 65 }; // segundos — comprimido para demo, configurable

// PIN de acceso al panel de personal. Esto NO es seguridad real (no hay
// usuarios, ni contraseñas por persona, ni cifrado de sesión) — es un
// candado simple para que un cliente que adivina la URL no entre directo.
// Antes de un uso real hace falta autenticación de verdad (ver README).
const STAFF_PIN = process.env.STAFF_PIN || '1234';
const configuredTokenTtl = Number(process.env.STAFF_TOKEN_TTL_MS);
const STAFF_TOKEN_TTL_MS = Number.isFinite(configuredTokenTtl) && configuredTokenTtl > 0
  ? configuredTokenTtl
  : 8 * 60 * 60 * 1000;
const STAFF_TOKENS = new Map();
const MAX_BODY_BYTES = 32 * 1024;
const PUBLIC_ACTIONS = new Set(['pedido_nuevo', 'llamar_mozo', 'pedir_cuenta', 'ayuda']);
const STAFF_ACTIONS = new Set(['pedido_estado', 'alerta_atender', 'alerta_resolver', 'mesa_liberar', 'reset_demo']);
const MESA_ACTIONS = new Set(['pedido_nuevo', 'pedido_estado', 'llamar_mozo', 'pedir_cuenta', 'ayuda', 'mesa_liberar']);
const PEDIDO_ESTADOS = ['enviado', 'preparando', 'listo', 'entregado'];
const HELP_CATEGORIES = {
  no_llego: { label: 'No llegó mi pedido', prioridad: 'urgente' },
  incorrecto: { label: 'Mi pedido está incorrecto', prioridad: 'urgente' },
  falta: { label: 'Falta algo', prioridad: 'importante' },
  mozo: { label: 'Necesito al mozo', prioridad: 'normal' },
  cambiar: { label: 'Quiero cambiar algo', prioridad: 'importante' },
  cuenta: { label: 'Quiero pedir la cuenta', prioridad: 'importante' },
  otro: { label: 'Reclamo', prioridad: null },
};
const KEYWORDS_URGENTE = ['no llegó', 'no llego', 'frío', 'fria', 'crudo', 'cruda', 'alerg', 'mal estado', 'equivocado', 'equivocada'];
const KEYWORDS_IMPORTANTE = ['falta', 'cambiar', 'sin ', 'error', 'cuenta'];
const PRODUCTOS = new Map();
MENU_DATA.categorias.forEach(categoria => {
  categoria.productos.forEach(producto => PRODUCTOS.set(producto.id, producto));
});
const persistence = createPersistence();

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
let mutationQueue = Promise.resolve();

function enqueueMutation(task) {
  const operation = mutationQueue.then(task);
  mutationQueue = operation.catch(() => {});
  return operation;
}

function pruneExpiredStaffTokens(now = Date.now()) {
  for (const [token, expiresAt] of STAFF_TOKENS) {
    if (expiresAt <= now) STAFF_TOKENS.delete(token);
  }
}

function findMesa(n) { return state.mesas.find(m => m.numero === Number(n)); }
function validMesaNumber(value) {
  return Number.isInteger(value) && value >= 1 && value <= MESAS_TOTAL;
}

function actionError(status, error) { return { ok: false, status, error }; }
function actionOk() { return { ok: true, status: 200 }; }

function clasificarTextoLibre(value) {
  const text = value.toLowerCase();
  if (KEYWORDS_URGENTE.some(keyword => text.includes(keyword))) return 'urgente';
  if (KEYWORDS_IMPORTANTE.some(keyword => text.includes(keyword))) return 'importante';
  return 'normal';
}

function normalizeOptionalText(value, field, maxLength = 500) {
  if (value == null || value === '') return { ok: true, value: '' };
  if (typeof value !== 'string') return actionError(400, `${field} inválida`);
  const normalized = value.trim();
  if (normalized.length > maxLength) return actionError(400, `${field} demasiado larga`);
  return { ok: true, value: normalized };
}

function buildPedidoItem(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) return actionError(400, 'Ítem inválido');
  if (typeof input.productoId !== 'string') return actionError(400, 'productoId inválido');

  const producto = PRODUCTOS.get(input.productoId);
  if (!producto) return actionError(400, 'Producto inexistente');

  let nombre = producto.nombre;
  let precio = producto.precio;

  if (Array.isArray(producto.variantes) && producto.variantes.length) {
    if (typeof input.variante !== 'string') return actionError(400, 'Variante requerida');
    const variante = producto.variantes.find(candidate => candidate.nombre === input.variante);
    if (!variante) return actionError(400, 'Variante inválida');
    nombre += ' — ' + variante.nombre;
    precio = variante.precio;
  } else if (input.variante != null) {
    return actionError(400, 'Variante inválida');
  }

  if (Array.isArray(producto.opciones) && producto.opciones.length) {
    if (typeof input.opcion !== 'string' || !producto.opciones.includes(input.opcion)) {
      return actionError(400, 'Opción inválida');
    }
    nombre += ' (' + input.opcion + ')';
  } else if (input.opcion != null) {
    return actionError(400, 'Opción inválida');
  }

  const observacion = normalizeOptionalText(input.observacion, 'Observación');
  if (!observacion.ok) return observacion;

  return {
    ok: true,
    item: { productoId: producto.id, nombre, precio, notas: observacion.value },
  };
}

const sseClients = new Set();
function estadoPayload() {
  return 'data: ' + JSON.stringify({ type: 'estado', state, mesasTotal: MESAS_TOTAL }) + '\n\n';
}
function broadcast() {
  const payload = estadoPayload();
  sseClients.forEach(res => { try { res.write(payload); } catch (e) { sseClients.delete(res); } });
}

function handleAction(msg) {
  if (!msg || typeof msg !== 'object' || Array.isArray(msg)) return actionError(400, 'Acción inválida');
  if (!PUBLIC_ACTIONS.has(msg.type) && !STAFF_ACTIONS.has(msg.type)) return actionError(400, 'Tipo de acción inválido');

  if (MESA_ACTIONS.has(msg.type) && !validMesaNumber(msg.mesa)) return actionError(400, 'Mesa inválida');
  const m = MESA_ACTIONS.has(msg.type) ? findMesa(msg.mesa) : null;

  switch (msg.type) {
    case 'pedido_nuevo': {
      if (!Array.isArray(msg.items) || !msg.items.length) return actionError(400, 'El pedido no contiene ítems');
      const items = [];
      for (const input of msg.items) {
        const built = buildPedidoItem(input);
        if (!built.ok) return built;
        items.push(built.item);
      }
      m.ocupada = true;
      if (m.pedido && m.pedido.estado !== 'entregado') {
        m.pedido.items.push(...items);
      } else {
        m.pedido = { items, estado: 'enviado', enviadoTs: state.clockMs };
      }
      break;
    }
    case 'pedido_estado': {
      if (!PEDIDO_ESTADOS.includes(msg.estado)) return actionError(400, 'Estado de pedido inválido');
      if (!m.pedido) return actionError(404, 'La mesa no tiene un pedido activo');
      const currentIndex = PEDIDO_ESTADOS.indexOf(m.pedido.estado);
      if (msg.estado !== PEDIDO_ESTADOS[currentIndex + 1]) return actionError(409, 'Transición de pedido inválida');
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
      if (typeof msg.categoria !== 'string' || !HELP_CATEGORIES[msg.categoria]) return actionError(400, 'Categoría de ayuda inválida');
      const message = normalizeOptionalText(msg.mensaje, 'Mensaje');
      if (!message.ok) return message;
      if (msg.categoria === 'otro' && !message.value) return actionError(400, 'El mensaje es obligatorio');
      const category = HELP_CATEGORIES[msg.categoria];
      const prioridad = category.prioridad || clasificarTextoLibre(message.value);
      m.alertas.push({ id: uid(), tipo: msg.categoria, label: category.label, prioridad, mensaje: message.value, estado: 'recibido', creadoTs: state.clockMs, escalado: false });
      break;
    }
    case 'alerta_atender': {
      if (!Number.isInteger(msg.alertaId)) return actionError(400, 'alertaId inválido');
      const alerta = state.mesas.flatMap(mm => mm.alertas).find(candidate => candidate.id === msg.alertaId);
      if (!alerta) return actionError(404, 'Alerta inexistente');
      if (alerta.estado !== 'recibido') return actionError(409, 'La alerta no puede pasar a atención');
      alerta.estado = 'atencion';
      break;
    }
    case 'alerta_resolver': {
      if (!Number.isInteger(msg.alertaId)) return actionError(400, 'alertaId inválido');
      let owner = null;
      let alerta = null;
      for (const mesa of state.mesas) {
        const found = mesa.alertas.find(candidate => candidate.id === msg.alertaId);
        if (found) { owner = mesa; alerta = found; break; }
      }
      if (!alerta) return actionError(404, 'Alerta inexistente');
      if (alerta.estado === 'resuelto') return actionError(409, 'La alerta ya está resuelta');
      alerta.estado = 'resuelto';
      if (alerta.tipo === 'cuenta') { owner.pedido = null; owner.ocupada = false; owner.cuentaPedida = false; }
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
      return actionError(400, 'Tipo de acción inválido');
  }
  return actionOk();
}

let clockTimer = null;
function startClock() {
  clockTimer = setInterval(() => {
    enqueueMutation(async () => {
      const previousState = structuredClone(state);
      let operationalChange = false;
      pruneExpiredStaffTokens();
      state.clockMs++;
      state.mesas.forEach(m => {
        if (m.pedido && m.pedido.estado === 'enviado' && (state.clockMs - m.pedido.enviadoTs) > 6) {
          m.pedido.estado = 'preparando';
          operationalChange = true;
        }
      });
      state.mesas.forEach(m => m.alertas.forEach(a => {
        if (a.estado === 'recibido' && !a.escalado && (state.clockMs - a.creadoTs) > SLA[a.prioridad]) {
          a.escalado = true;
          operationalChange = true;
        }
      }));
      if (operationalChange) {
        try {
          await persistence.save(state);
        } catch (error) {
          state = previousState;
          throw error;
        }
      }
      broadcast();
    }).catch(error => console.error('No se pudo persistir un cambio automático:', error.message));
  }, 1000);
}

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
  let totalBytes = 0;
  let tooLarge = false;
  let completed = false;
  function finish(error, body) {
    if (completed) return;
    completed = true;
    cb(error, body);
  }
  req.on('data', chunk => {
    totalBytes += chunk.length;
    if (totalBytes > MAX_BODY_BYTES) {
      tooLarge = true;
      chunks.length = 0;
      return;
    }
    if (!tooLarge) chunks.push(chunk);
  });
  req.on('end', () => {
    if (tooLarge) { finish(actionError(413, 'Body demasiado grande')); return; }
    try {
      const raw = Buffer.concat(chunks).toString('utf8');
      if (!raw.trim()) { finish(actionError(400, 'JSON inválido')); return; }
      finish(null, JSON.parse(raw));
    } catch (e) {
      finish(actionError(400, 'JSON inválido'));
    }
  });
  req.on('error', () => finish(actionError(400, 'No se pudo leer el body')));
}

function sendJson(res, status, payload) {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(payload));
}

function acceptsJson(req) {
  const contentType = req.headers['content-type'];
  if (typeof contentType !== 'string') return false;
  return contentType.split(';', 1)[0].trim().toLowerCase() === 'application/json';
}

function extractBearerToken(req) {
  const authorization = req.headers.authorization;
  if (typeof authorization !== 'string' || !authorization.startsWith('Bearer ')) return null;
  const token = authorization.slice(7);
  const expiresAt = token ? STAFF_TOKENS.get(token) : null;
  if (!expiresAt) return null;
  if (expiresAt <= Date.now()) {
    STAFF_TOKENS.delete(token);
    return null;
  }
  return token;
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
    if (!acceptsJson(req)) { sendJson(res, 415, { ok: false, error: 'Content-Type debe ser application/json' }); return; }
    readJsonBody(req, (error, body) => {
      if (error) { sendJson(res, error.status, { ok: false, error: error.error }); return; }
      if (!body || typeof body !== 'object' || Array.isArray(body) || typeof body.pin !== 'string') {
        sendJson(res, 400, { ok: false, error: 'PIN inválido' });
        return;
      }
      if (body.pin !== STAFF_PIN) { sendJson(res, 401, { ok: false }); return; }
      pruneExpiredStaffTokens();
      const token = crypto.randomBytes(32).toString('hex');
      STAFF_TOKENS.set(token, Date.now() + STAFF_TOKEN_TTL_MS);
      sendJson(res, 200, { ok: true, token });
    });
    return;
  }
  if (u.pathname === '/api/action' && req.method === 'POST') {
    if (!acceptsJson(req)) { sendJson(res, 415, { ok: false, error: 'Content-Type debe ser application/json' }); return; }
    readJsonBody(req, (error, body) => {
      if (error) { sendJson(res, error.status, { ok: false, error: error.error }); return; }
      if (body && STAFF_ACTIONS.has(body.type) && !extractBearerToken(req)) {
        sendJson(res, 401, { ok: false, error: 'Autenticación requerida' });
        return;
      }
      enqueueMutation(async () => {
        const previousState = structuredClone(state);
        const result = handleAction(body);
        if (!result.ok) {
          sendJson(res, result.status, { ok: false, error: result.error });
          return;
        }
        try {
          await persistence.save(state);
        } catch (error) {
          state = previousState;
          console.error('No se pudo persistir la acción:', error.message);
          sendJson(res, 503, { ok: false, error: 'Persistencia no disponible' });
          return;
        }
        broadcast();
        sendJson(res, 200, { ok: true });
      }).catch(error => {
        console.error('Error al procesar la acción:', error.message);
        if (!res.headersSent) sendJson(res, 500, { ok: false, error: 'Error interno' });
      });
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
let shuttingDown = false;
async function shutdown(signal) {
  if (shuttingDown) return;
  shuttingDown = true;
  if (clockTimer) clearInterval(clockTimer);
  sseClients.forEach(res => res.end());
  await new Promise(resolve => server.close(resolve));
  try {
    await mutationQueue;
    await persistence.close(state);
    process.exit(0);
  } catch (error) {
    console.error(`No se pudo guardar el estado antes de cerrar (${signal}):`, error.message);
    process.exit(1);
  }
}

process.once('SIGTERM', () => shutdown('SIGTERM'));
process.once('SIGINT', () => shutdown('SIGINT'));

async function start() {
  state = await persistence.initialize(state);
  startClock();
  server.listen(PORT, () => {
    const mode = persistence.enabled ? 'PostgreSQL' : 'memoria';
    console.log(`Rabieta — servidor real escuchando en el puerto ${PORT} (${mode})`);
  });
}

start().catch(error => {
  console.error('No se pudo iniciar la persistencia:', error.message);
  process.exitCode = 1;
});
