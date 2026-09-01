/* =========================================================
   RABIETA — servidor real (MVP), CERO dependencias externas.
   Usa solo módulos nativos de Node (http, fs, path, url) para
   que "node server.js" alcance en cualquier hosting, sin paso
   de instalación que pueda fallar.

   Cómo se sincronizan los celulares en vivo, sin WebSocket:
   - Cada mesa abre un stream Server-Sent Events (SSE) a
     GET /events?mesa=N y recibe solamente su propio estado.
     El personal usa GET /api/staff-events con Bearer token
     para recibir el estado operativo completo.
   - Las acciones (pedir, llamar al mozo, marcar listo, etc.)
     viajan como POST /api/action — HTTP normal, nada exótico.

   IMPORTANTE — límite honesto de este MVP:
   Sin DATABASE_URL el estado vive solamente en memoria. Con
   DATABASE_URL se conserva como una fila JSONB de continuidad,
   que todavía no es el modelo relacional ni multi-tenant final.
   ========================================================= */
const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { URL } = require('url');
const { createPersistence } = require('./persistence');
const { createClientIpResolver, createRateLimiters, errorFields, logEvent } = require('./operational');

const MENU_DATA = JSON.parse(fs.readFileSync(path.join(__dirname, 'menu-rabieta.json'), 'utf8'));
const MESAS_TOTAL = MENU_DATA._meta.mesas.placeholder_sugerido; // ver _meta.mesas — número real pendiente de confirmar con el local
const MOZOS = ['Martín', 'Sofía', 'Lucas'];
const SLA = { urgente: 20, importante: 40, normal: 65 }; // segundos — comprimido para demo, configurable

// Cada sesión de staff queda ligada a un rol. Para la demo todos los roles
// pueden compartir STAFF_PIN; en el piloto se configura un PIN distinto por
// rol sin cambiar el producto.
const STAFF_PIN = process.env.STAFF_PIN || '1234';
const STAFF_ROLES = new Set(['mozo', 'cocina', 'encargado', 'dueno']);
const STAFF_PINS = {
  mozo: process.env.STAFF_PIN_MOZO || STAFF_PIN,
  cocina: process.env.STAFF_PIN_COCINA || STAFF_PIN,
  encargado: process.env.STAFF_PIN_ENCARGADO || STAFF_PIN,
  dueno: process.env.STAFF_PIN_DUENO || STAFF_PIN,
};
const STAFF_ROLE_VIEWS = {
  mozo: ['mozo'],
  cocina: ['cocina'],
  encargado: ['encargado', 'mozo', 'cocina', 'dueno', 'qrs'],
  dueno: ['dueno'],
};
const configuredTokenTtl = Number(process.env.STAFF_TOKEN_TTL_MS);
const STAFF_TOKEN_TTL_MS = Number.isFinite(configuredTokenTtl) && configuredTokenTtl > 0
  ? configuredTokenTtl
  : 8 * 60 * 60 * 1000;
const STAFF_TOKENS = new Map();
const MESA_TOKEN_SECRET = process.env.MESA_TOKEN_SECRET || null;
const MAX_BODY_BYTES = 32 * 1024;
const PUBLIC_ACTIONS = new Set(['pedido_nuevo', 'llamar_mozo', 'pedir_cuenta', 'ayuda', 'resena_enviar', 'pago_sandbox_confirmar']);
const STAFF_ACTIONS = new Set(['pedido_estado', 'alerta_atender', 'alerta_resolver', 'pago_demo_confirmar', 'mesa_liberar', 'demo_escenario_cargar', 'reset_demo']);
const MESA_ACTIONS = new Set(['pedido_nuevo', 'pedido_estado', 'llamar_mozo', 'pedir_cuenta', 'ayuda', 'resena_enviar', 'pago_sandbox_confirmar', 'pago_demo_confirmar', 'mesa_liberar']);
const PAGO_SANDBOX_MEDIOS = new Set(['tarjeta', 'mercado_pago']);
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
// Configuración inicial para la demo: las bebidas se muestran en Barra y el
// resto en Cocina. No es una asignación operativa confirmada por Rabieta.
const DESTINO_POR_CATEGORIA = {
  'bebidas-sin-alcohol': 'barra', vinos: 'barra', whisky: 'barra', tragos: 'barra',
  'cervezas-rabieta': 'barra', 'merchandising-y-para-llevar': 'barra',
};
const DESTINOS_PRODUCCION = new Set(['cocina', 'barra']);
const DESTINO_DEFAULT = 'cocina';
const PRODUCTOS = new Map();
MENU_DATA.categorias.forEach(categoria => {
  const destino = DESTINO_POR_CATEGORIA[categoria.id] || DESTINO_DEFAULT;
  categoria.productos.forEach(producto => PRODUCTOS.set(producto.id, { ...producto, destino }));
});
const persistence = createPersistence();
const resolveClientIp = createClientIpResolver();
const rateLimiters = createRateLimiters();

let uidCounter = 1;
function uid() { return uidCounter++; }

function seedAnalytics() {
  return {
    pagosConfirmados: 0,
    ventasDemo: 0,
    tiempoPagoTotalSec: 0,
    itemsVendidos: 0,
    itemsListos: 0,
    itemsEntregados: 0,
    tiempoPreparacionTotalSec: 0,
    tiempoPaseTotalSec: 0,
    destinos: {
      cocina: { itemsListos: 0, tiempoPreparacionTotalSec: 0 },
      barra: { itemsListos: 0, tiempoPreparacionTotalSec: 0 },
    },
    productos: {},
    resenas: [],
    crmContactos: [],
  };
}

function seedState() {
  const mesas = [];
  for (let i = 1; i <= MESAS_TOTAL; i++) {
    mesas.push({ numero: i, mozo: MOZOS[i % MOZOS.length], ocupada: false, pedido: null, cuentaPedida: false, cuentaPedidaTs: null, pago: null, resenaEnviada: false, alertas: [] });
  }
  return { clockMs: 0, mesas, analytics: seedAnalytics(), presentacionCargada: false };
}
let state = seedState();
let mutationQueue = Promise.resolve();

function enqueueMutation(task) {
  const operation = mutationQueue.then(task);
  mutationQueue = operation.catch(() => {});
  return operation;
}

function pruneExpiredStaffTokens(now = Date.now()) {
  for (const [token, session] of STAFF_TOKENS) {
    if (session.expiresAt <= now) STAFF_TOKENS.delete(token);
  }
}

function staffRoleCan(role, msg) {
  if (role === 'encargado') return true;
  if (role === 'mozo') {
    return ['alerta_atender', 'alerta_resolver', 'pago_demo_confirmar', 'mesa_liberar'].includes(msg.type)
      || (msg.type === 'pedido_estado' && msg.estado === 'entregado');
  }
  if (role === 'cocina') return msg.type === 'pedido_estado' && msg.estado !== 'entregado';
  return false;
}

function findMesa(n) { return state.mesas.find(m => m.numero === Number(n)); }
function validMesaNumber(value) {
  return Number.isInteger(value) && value >= 1 && value <= MESAS_TOTAL;
}

function authorizeMesaRequest(req, mesa) {
  if (!MESA_TOKEN_SECRET) return { ok: true };
  const token = req.headers['x-mesa-token'];
  if (typeof token !== 'string' || !token) return { ok: false, status: 401 };
  if (!validMesaNumber(mesa) || !/^[a-f0-9]{64}$/i.test(token)) return { ok: false, status: 403 };
  const expected = crypto.createHmac('sha256', MESA_TOKEN_SECRET).update(`mesa:${mesa}`).digest();
  const supplied = Buffer.from(token, 'hex');
  return crypto.timingSafeEqual(expected, supplied) ? { ok: true } : { ok: false, status: 403 };
}

function accessTokenForMesa(mesa) {
  if (!MESA_TOKEN_SECRET || !validMesaNumber(mesa)) return null;
  return crypto.createHmac('sha256', MESA_TOKEN_SECRET).update(`mesa:${mesa}`).digest('hex');
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

function normalizeCrmContact(msg) {
  const hasContactData = msg.crmCanal != null || msg.crmContacto != null || msg.crmNombre != null;
  if (msg.crmConsentimiento !== true) {
    return hasContactData
      ? actionError(400, 'El consentimiento es obligatorio para guardar un contacto')
      : { ok: true, value: null };
  }
  if (!['whatsapp', 'email'].includes(msg.crmCanal)) return actionError(400, 'Canal de contacto inválido');
  const contacto = normalizeOptionalText(msg.crmContacto, 'Contacto', 160);
  if (!contacto.ok) return contacto;
  if (!contacto.value) return actionError(400, 'El contacto es obligatorio al aceptar novedades');
  if (msg.crmCanal === 'email' && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contacto.value)) {
    return actionError(400, 'Email inválido');
  }
  if (msg.crmCanal === 'whatsapp') {
    const digits = contacto.value.replace(/\D/g, '');
    if (digits.length < 8 || digits.length > 15 || !/^[+\d\s().-]+$/.test(contacto.value)) {
      return actionError(400, 'WhatsApp inválido');
    }
  }
  const nombre = normalizeOptionalText(msg.crmNombre, 'Nombre', 80);
  if (!nombre.ok) return nombre;
  return { ok: true, value: { canal: msg.crmCanal, contacto: contacto.value, nombre: nombre.value } };
}

function buildPedidoItem(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) return actionError(400, 'Ítem inválido');
  if (typeof input.productoId !== 'string') return actionError(400, 'productoId inválido');

  const producto = PRODUCTOS.get(input.productoId);
  if (!producto) return actionError(400, 'Producto inexistente');

  let nombre = producto.nombre;
  let precio = producto.precio;
  let varianteSeleccionada = null;
  let opcionSeleccionada = null;

  if (Array.isArray(producto.variantes) && producto.variantes.length) {
    if (typeof input.variante !== 'string') return actionError(400, 'Variante requerida');
    const variante = producto.variantes.find(candidate => candidate.nombre === input.variante);
    if (!variante) return actionError(400, 'Variante inválida');
    varianteSeleccionada = variante.nombre;
    nombre += ' — ' + variante.nombre;
    precio = variante.precio;
  } else if (input.variante != null) {
    return actionError(400, 'Variante inválida');
  }

  if (Array.isArray(producto.opciones) && producto.opciones.length) {
    if (typeof input.opcion !== 'string' || !producto.opciones.includes(input.opcion)) {
      return actionError(400, 'Opción inválida');
    }
    opcionSeleccionada = input.opcion;
    nombre += ' (' + input.opcion + ')';
  } else if (input.opcion != null) {
    return actionError(400, 'Opción inválida');
  }

  const observacion = normalizeOptionalText(input.observacion, 'Observación');
  if (!observacion.ok) return observacion;

  return {
    ok: true,
    item: {
      productoId: producto.id, nombre, precio, notas: observacion.value, destino: producto.destino,
      variante: varianteSeleccionada, opcion: opcionSeleccionada,
    },
  };
}

function syncPedidoEstado(pedido) {
  if (!pedido || !Array.isArray(pedido.items) || !pedido.items.length) return;
  const earliestStateIndex = pedido.items.reduce((earliest, item) => {
    const index = PEDIDO_ESTADOS.indexOf(item.estado);
    return Math.min(earliest, index === -1 ? 0 : index);
  }, PEDIDO_ESTADOS.length - 1);
  pedido.estado = PEDIDO_ESTADOS[earliestStateIndex];
}

function recordPaymentAnalytics(mesa, analytics = state.analytics, clock = state.clockMs) {
  const total = mesa.pedido.items.reduce((sum, item) => sum + item.precio, 0);
  const paymentTime = Number.isFinite(mesa.cuentaPedidaTs)
    ? Math.max(0, clock - mesa.cuentaPedidaTs)
    : 0;
  analytics.pagosConfirmados++;
  analytics.ventasDemo += total;
  analytics.tiempoPagoTotalSec += paymentTime;
  analytics.itemsVendidos += mesa.pedido.items.length;
  mesa.pedido.items.forEach(item => {
    const current = analytics.productos[item.productoId] || { nombre: item.nombre, cantidad: 0, total: 0 };
    current.cantidad++;
    current.total += item.precio;
    analytics.productos[item.productoId] = current;
  });
}

function recordItemAnalytics(item, estado, analytics = state.analytics, clock = state.clockMs) {
  if (estado === 'listo') {
    const preparationTime = Math.max(0, clock - item.enviadoTs);
    analytics.itemsListos++;
    analytics.tiempoPreparacionTotalSec += preparationTime;
    const destination = DESTINOS_PRODUCCION.has(item.destino) ? item.destino : DESTINO_DEFAULT;
    analytics.destinos[destination].itemsListos++;
    analytics.destinos[destination].tiempoPreparacionTotalSec += preparationTime;
  }
  if (estado === 'entregado') {
    const readyTs = item.estadoTs && Number.isFinite(item.estadoTs.listo) ? item.estadoTs.listo : clock;
    analytics.itemsEntregados++;
    analytics.tiempoPaseTotalSec += Math.max(0, clock - readyTs);
  }
}

function normalizeAnalytics(value) {
  const analytics = seedAnalytics();
  if (!value || typeof value !== 'object' || Array.isArray(value)) return analytics;
  for (const field of [
    'pagosConfirmados', 'ventasDemo', 'tiempoPagoTotalSec', 'itemsVendidos',
    'itemsListos', 'itemsEntregados', 'tiempoPreparacionTotalSec', 'tiempoPaseTotalSec',
  ]) {
    if (Number.isFinite(value[field]) && value[field] >= 0) analytics[field] = value[field];
  }
  if (value.destinos && typeof value.destinos === 'object' && !Array.isArray(value.destinos)) {
    for (const destino of DESTINOS_PRODUCCION) {
      const metrics = value.destinos[destino];
      if (!metrics || typeof metrics !== 'object' || Array.isArray(metrics)) continue;
      for (const field of ['itemsListos', 'tiempoPreparacionTotalSec']) {
        if (Number.isFinite(metrics[field]) && metrics[field] >= 0) analytics.destinos[destino][field] = metrics[field];
      }
    }
  }
  if (value.productos && typeof value.productos === 'object' && !Array.isArray(value.productos)) {
    Object.entries(value.productos).forEach(([productoId, metrics]) => {
      const producto = PRODUCTOS.get(productoId);
      if (!producto || !metrics || typeof metrics !== 'object') return;
      if (!Number.isFinite(metrics.cantidad) || metrics.cantidad < 0 || !Number.isFinite(metrics.total) || metrics.total < 0) return;
      analytics.productos[productoId] = { nombre: producto.nombre, cantidad: metrics.cantidad, total: metrics.total };
    });
  }
  if (Array.isArray(value.resenas)) {
    analytics.resenas = value.resenas.slice(-100).flatMap(review => {
      if (!review || typeof review !== 'object' || !Number.isInteger(review.puntuacion) || review.puntuacion < 1 || review.puntuacion > 5) return [];
      if (!validMesaNumber(review.mesa) || !Number.isFinite(review.creadoTs)) return [];
      const comentario = typeof review.comentario === 'string' ? review.comentario.trim().slice(0, 500) : '';
      return [{ id: Number.isInteger(review.id) && review.id > 0 ? review.id : null, mesa: review.mesa, puntuacion: review.puntuacion, comentario, creadoTs: review.creadoTs }];
    });
  }
  if (Array.isArray(value.crmContactos)) {
    analytics.crmContactos = value.crmContactos.slice(-100).flatMap(contact => {
      if (!contact || typeof contact !== 'object' || !validMesaNumber(contact.mesa) || !Number.isFinite(contact.consentimientoTs)) return [];
      if (!['whatsapp', 'email'].includes(contact.canal)) return [];
      const contacto = typeof contact.contacto === 'string' ? contact.contacto.trim().slice(0, 160) : '';
      const nombre = typeof contact.nombre === 'string' ? contact.nombre.trim().slice(0, 80) : '';
      if (!contacto) return [];
      return [{
        id: Number.isInteger(contact.id) && contact.id > 0 ? contact.id : null,
        mesa: contact.mesa,
        canal: contact.canal,
        contacto,
        nombre,
        consentimientoTs: contact.consentimientoTs,
        origen: 'post_pago',
      }];
    });
  }
  return analytics;
}

function normalizeRecoveredState(recoveredState) {
  const hadAnalytics = recoveredState.analytics && typeof recoveredState.analytics === 'object';
  recoveredState.analytics = normalizeAnalytics(recoveredState.analytics);
  recoveredState.presentacionCargada = recoveredState.presentacionCargada === true;
  let highestId = 0;
  const normalizedItemIds = new Set();
  recoveredState.analytics.resenas.forEach(review => {
    if (Number.isInteger(review.id) && review.id > highestId) highestId = review.id;
  });
  recoveredState.analytics.crmContactos.forEach(contact => {
    if (Number.isInteger(contact.id) && contact.id > highestId) highestId = contact.id;
  });
  recoveredState.mesas.forEach(mesa => {
    mesa.resenaEnviada = mesa.resenaEnviada === true;
    mesa.alertas.forEach(alerta => {
      if (Number.isInteger(alerta.id) && alerta.id > highestId) highestId = alerta.id;
    });
    if (!mesa.pedido || !Array.isArray(mesa.pedido.items)) return;
    mesa.pedido.items.forEach(item => {
      if (Number.isInteger(item.id) && item.id > highestId) highestId = item.id;
    });
  });
  uidCounter = Math.max(uidCounter, highestId + 1);
  recoveredState.analytics.resenas.forEach(review => {
    if (!Number.isInteger(review.id) || review.id <= 0) review.id = uid();
  });
  recoveredState.analytics.crmContactos.forEach(contact => {
    if (!Number.isInteger(contact.id) || contact.id <= 0) contact.id = uid();
  });

  recoveredState.mesas.forEach(mesa => {
    if (!mesa.pago || mesa.pago.modo !== 'demo' || mesa.pago.estado !== 'confirmado') mesa.pago = null;
    const cuentaAlert = mesa.alertas.find(alerta => alerta.tipo === 'cuenta');
    mesa.cuentaPedidaTs = mesa.cuentaPedida
      ? (Number.isFinite(mesa.cuentaPedidaTs) ? mesa.cuentaPedidaTs : (cuentaAlert && Number.isFinite(cuentaAlert.creadoTs) ? cuentaAlert.creadoTs : recoveredState.clockMs))
      : null;
    const pedido = mesa.pedido;
    if (!pedido || !Array.isArray(pedido.items)) return;
    const legacyState = PEDIDO_ESTADOS.includes(pedido.estado) ? pedido.estado : 'enviado';
    pedido.items.forEach(item => {
      if (!Number.isInteger(item.id) || item.id <= 0 || normalizedItemIds.has(item.id)) item.id = uid();
      normalizedItemIds.add(item.id);
      if (!PEDIDO_ESTADOS.includes(item.estado)) item.estado = legacyState;
      if (!Number.isInteger(item.ronda) || item.ronda < 1) item.ronda = 1;
      const producto = PRODUCTOS.get(item.productoId);
      item.destino = producto && DESTINOS_PRODUCCION.has(producto.destino) ? producto.destino : DESTINO_DEFAULT;
      if (!Number.isFinite(item.enviadoTs)) {
        item.enviadoTs = Number.isFinite(pedido.enviadoTs) ? pedido.enviadoTs : recoveredState.clockMs;
      }
      if (!item.estadoTs || typeof item.estadoTs !== 'object' || Array.isArray(item.estadoTs)) item.estadoTs = {};
      if (!Number.isFinite(item.estadoTs.enviado)) item.estadoTs.enviado = item.enviadoTs;
      const itemStateIndex = PEDIDO_ESTADOS.indexOf(item.estado);
      for (let index = 1; index <= itemStateIndex; index++) {
        const stage = PEDIDO_ESTADOS[index];
        if (!Number.isFinite(item.estadoTs[stage])) item.estadoTs[stage] = item.enviadoTs;
      }
    });
    if (!Number.isFinite(pedido.enviadoTs)) {
      pedido.enviadoTs = pedido.items.reduce((earliest, item) => Math.min(earliest, item.enviadoTs), recoveredState.clockMs);
    }
    syncPedidoEstado(pedido);
  });
  if (!hadAnalytics) {
    recoveredState.mesas.forEach(mesa => {
      if (mesa.pago && mesa.pedido && mesa.pedido.items.every(item => Number.isFinite(item.precio))) {
        recordPaymentAnalytics(mesa, recoveredState.analytics, recoveredState.clockMs);
      }
    });
  }
  return recoveredState;
}

function seedPresentationScenario() {
  const previousState = state;
  state = seedState();
  const run = message => {
    const result = handleAction(message);
    if (!result.ok) state = previousState;
    return result;
  };
  const advance = (mesa, itemId, estado) => run({ type: 'pedido_estado', mesa, itemId, estado });

  state.clockMs = 15;
  let result = run({ type: 'pedido_nuevo', mesa: 1, items: [{ productoId: 'hummus-rabieta' }, { productoId: 'agua' }] });
  if (!result.ok) return result;
  const mesaUno = findMesa(1);
  state.clockMs = 55;
  result = advance(1, mesaUno.pedido.items[0].id, 'preparando'); if (!result.ok) return result;
  result = advance(1, mesaUno.pedido.items[1].id, 'preparando'); if (!result.ok) return result;
  state.clockMs = 105;
  result = advance(1, mesaUno.pedido.items[1].id, 'listo'); if (!result.ok) return result;

  state.clockMs = 125;
  result = run({ type: 'pedido_nuevo', mesa: 2, items: [{ productoId: 'burger-rabieta' }, { productoId: 'papas-rabieta' }] });
  if (!result.ok) return result;

  state.clockMs = 145;
  result = run({ type: 'pedido_nuevo', mesa: 3, items: [{ productoId: 'hummus-rabieta' }] });
  if (!result.ok) return result;
  const mesaTresItem = findMesa(3).pedido.items[0].id;
  result = advance(3, mesaTresItem, 'preparando'); if (!result.ok) return result;
  state.clockMs = 180;
  result = advance(3, mesaTresItem, 'listo'); if (!result.ok) return result;
  state.clockMs = 195;
  result = advance(3, mesaTresItem, 'entregado'); if (!result.ok) return result;
  result = run({ type: 'pedir_cuenta', mesa: 3 }); if (!result.ok) return result;

  state.clockMs = 220;
  result = run({ type: 'ayuda', mesa: 4, categoria: 'incorrecto', mensaje: 'Escenario demo: revisar el pedido' });
  if (!result.ok) return result;

  state.clockMs = 235;
  result = run({ type: 'pedido_nuevo', mesa: 5, items: [{ productoId: 'brownie' }] });
  if (!result.ok) return result;
  const mesaCincoItem = findMesa(5).pedido.items[0].id;
  result = advance(5, mesaCincoItem, 'preparando'); if (!result.ok) return result;
  state.clockMs = 260;
  result = advance(5, mesaCincoItem, 'listo'); if (!result.ok) return result;
  state.clockMs = 275;
  result = advance(5, mesaCincoItem, 'entregado'); if (!result.ok) return result;
  result = run({ type: 'pedir_cuenta', mesa: 5 }); if (!result.ok) return result;
  state.clockMs = 285;
  result = run({ type: 'pago_demo_confirmar', mesa: 5 }); if (!result.ok) return result;
  result = run({
    type: 'resena_enviar', mesa: 5, puntuacion: 5, comentario: 'Escenario de presentación listo',
    crmConsentimiento: true, crmCanal: 'email', crmContacto: 'demo@rabieta.local', crmNombre: 'Cliente demo',
  });
  if (!result.ok) return result;

  state.clockMs = 300;
  state.presentacionCargada = true;
  return actionOk();
}

const sseClients = new Set();
function estadoPayload(client) {
  let visibleState;
  if (client.kind === 'staff') {
    visibleState = ['encargado', 'dueno'].includes(client.role) ? state : { clockMs: state.clockMs, mesas: state.mesas };
  } else {
    visibleState = { clockMs: state.clockMs, mesas: [findMesa(client.mesa)] };
  }
  const message = client.kind === 'staff'
    ? { type: 'estado', state: visibleState, mesasTotal: MESAS_TOTAL, role: client.role, allowedViews: STAFF_ROLE_VIEWS[client.role] }
    : { type: 'estado', state: visibleState };
  return 'data: ' + JSON.stringify(message) + '\n\n';
}
function closeSseClient(client) {
  sseClients.delete(client);
  try { client.res.end(); } catch (_) {}
}
function broadcast() {
  sseClients.forEach(client => {
    if (client.kind === 'staff' && !validStaffToken(client.token)) {
      closeSseClient(client);
      return;
    }
    try { client.res.write(estadoPayload(client)); } catch (_) { closeSseClient(client); }
  });
}

function handleAction(msg) {
  if (!msg || typeof msg !== 'object' || Array.isArray(msg)) return actionError(400, 'Acción inválida');
  if (!PUBLIC_ACTIONS.has(msg.type) && !STAFF_ACTIONS.has(msg.type)) return actionError(400, 'Tipo de acción inválido');

  if (MESA_ACTIONS.has(msg.type) && !validMesaNumber(msg.mesa)) return actionError(400, 'Mesa inválida');
  const m = MESA_ACTIONS.has(msg.type) ? findMesa(msg.mesa) : null;

  switch (msg.type) {
    case 'pedido_nuevo': {
      if (!Array.isArray(msg.items) || !msg.items.length) return actionError(400, 'El pedido no contiene ítems');
      if (m.cuentaPedida) return actionError(409, 'La cuenta ya fue solicitada');
      const ronda = m.pedido
        ? m.pedido.items.reduce((max, item) => Math.max(max, Number.isInteger(item.ronda) ? item.ronda : 1), 1) + 1
        : 1;
      const items = [];
      for (const input of msg.items) {
        const built = buildPedidoItem(input);
        if (!built.ok) return built;
        items.push({ ...built.item, id: uid(), ronda, estado: 'enviado', enviadoTs: state.clockMs, estadoTs: { enviado: state.clockMs } });
      }
      m.ocupada = true;
      if (m.pedido) {
        m.pedido.items.push(...items);
        syncPedidoEstado(m.pedido);
      } else {
        m.pedido = { items, estado: 'enviado', enviadoTs: state.clockMs };
      }
      break;
    }
    case 'pedido_estado': {
      if (!PEDIDO_ESTADOS.includes(msg.estado)) return actionError(400, 'Estado de pedido inválido');
      if (!m.pedido) return actionError(404, 'La mesa no tiene un pedido activo');
      let item = null;
      if (Number.isInteger(msg.itemId)) item = m.pedido.items.find(candidate => candidate.id === msg.itemId);
      else if (m.pedido.items.length === 1) [item] = m.pedido.items;
      else return actionError(400, 'itemId es obligatorio para pedidos con varios items');
      if (!item) return actionError(404, 'Item de pedido inexistente');
      const currentIndex = PEDIDO_ESTADOS.indexOf(item.estado);
      if (msg.estado !== PEDIDO_ESTADOS[currentIndex + 1]) return actionError(409, 'Transición de pedido inválida');
      item.estado = msg.estado;
      if (!item.estadoTs || typeof item.estadoTs !== 'object' || Array.isArray(item.estadoTs)) item.estadoTs = {};
      item.estadoTs[msg.estado] = state.clockMs;
      recordItemAnalytics(item, msg.estado);
      syncPedidoEstado(m.pedido);
      break;
    }
    case 'llamar_mozo': {
      if (!m) return;
      m.alertas.push({ id: uid(), tipo: 'mozo', label: 'Llamado al mozo', prioridad: 'normal', mensaje: '', estado: 'recibido', creadoTs: state.clockMs, escalado: false });
      break;
    }
    case 'pedir_cuenta': {
      if (!m.pedido || !m.pedido.items.length) return actionError(409, 'La mesa no tiene consumos');
      if (m.cuentaPedida) return actionError(409, 'La cuenta ya fue solicitada');
      m.cuentaPedida = true;
      m.cuentaPedidaTs = state.clockMs;
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
      let alerta = null;
      for (const mesa of state.mesas) {
        const found = mesa.alertas.find(candidate => candidate.id === msg.alertaId);
        if (found) { alerta = found; break; }
      }
      if (!alerta) return actionError(404, 'Alerta inexistente');
      if (alerta.estado === 'resuelto') return actionError(409, 'La alerta ya está resuelta');
      alerta.estado = 'resuelto';
      break;
    }
    case 'resena_enviar': {
      if (!m.pago || m.pago.modo !== 'demo' || m.pago.estado !== 'confirmado') {
        return actionError(409, 'La reseña se habilita después de confirmar el pago');
      }
      if (m.resenaEnviada) return actionError(409, 'La mesa ya envió una reseña');
      if (!Number.isInteger(msg.puntuacion) || msg.puntuacion < 1 || msg.puntuacion > 5) {
        return actionError(400, 'Puntuación inválida');
      }
      const comentario = normalizeOptionalText(msg.comentario, 'Comentario');
      if (!comentario.ok) return comentario;
      const crmContact = normalizeCrmContact(msg);
      if (!crmContact.ok) return crmContact;
      state.analytics.resenas.push({ id: uid(), mesa: m.numero, puntuacion: msg.puntuacion, comentario: comentario.value, creadoTs: state.clockMs });
      if (state.analytics.resenas.length > 100) state.analytics.resenas.splice(0, state.analytics.resenas.length - 100);
      if (crmContact.value) {
        state.analytics.crmContactos.push({
          id: uid(),
          mesa: m.numero,
          ...crmContact.value,
          consentimientoTs: state.clockMs,
          origen: 'post_pago',
        });
        if (state.analytics.crmContactos.length > 100) state.analytics.crmContactos.splice(0, state.analytics.crmContactos.length - 100);
      }
      m.resenaEnviada = true;
      break;
    }
    case 'pago_sandbox_confirmar':
    case 'pago_demo_confirmar': {
      if (!m.pedido || !m.cuentaPedida) return actionError(409, 'La cuenta no fue solicitada');
      if (m.pago) return actionError(409, 'El pago demo ya fue confirmado');
      if (m.pedido.items.some(item => !Number.isFinite(item.precio))) {
        return actionError(409, 'Hay precios pendientes de confirmar');
      }
      const medio = msg.type === 'pago_sandbox_confirmar' ? msg.medio : 'staff';
      if (msg.type === 'pago_sandbox_confirmar' && !PAGO_SANDBOX_MEDIOS.has(medio)) {
        return actionError(400, 'Medio de pago sandbox inválido');
      }
      const total = m.pedido.items.reduce((sum, item) => sum + item.precio, 0);
      m.pago = {
        modo: 'demo', estado: 'confirmado', medio, total,
        referencia: `RAB-${String(m.numero).padStart(2, '0')}-${String(uid()).padStart(6, '0')}`,
        confirmadoTs: state.clockMs,
      };
      recordPaymentAnalytics(m);
      m.alertas.forEach(alertaCuenta => {
        if (alertaCuenta.tipo === 'cuenta' && alertaCuenta.estado !== 'resuelto') alertaCuenta.estado = 'resuelto';
      });
      break;
    }
    case 'mesa_liberar': {
      if (!m.pago || m.pago.modo !== 'demo' || m.pago.estado !== 'confirmado') {
        return actionError(409, 'La mesa solo puede liberarse después de confirmar el pago');
      }
      m.ocupada = false; m.pedido = null; m.cuentaPedida = false; m.cuentaPedidaTs = null; m.pago = null; m.resenaEnviada = false; m.alertas = [];
      break;
    }
    case 'demo_escenario_cargar': {
      const result = seedPresentationScenario();
      if (!result.ok) return result;
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
      rateLimiters.login.prune();
      rateLimiters.action.prune();
      state.clockMs++;
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
    }).catch(error => logEvent('error', 'automatic_persistence_error', errorFields(error)));
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
  const responsePayload = status >= 400 && res.requestId
    ? { ...payload, requestId: res.requestId }
    : payload;
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(responsePayload));
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
  return validStaffToken(token) ? token : null;
}

function validStaffToken(token) {
  const session = token ? STAFF_TOKENS.get(token) : null;
  if (!session) return false;
  if (session.expiresAt <= Date.now()) {
    STAFF_TOKENS.delete(token);
    return false;
  }
  return true;
}

function staffSession(req) {
  const token = extractBearerToken(req);
  return token ? { token, ...STAFF_TOKENS.get(token) } : null;
}

function applyRateLimit(req, res, limiter, scope) {
  const result = limiter.check(`${scope}:${req.clientIp}`);
  if (result.allowed) return true;
  res.setHeader('Retry-After', String(result.retryAfterSeconds));
  sendJson(res, 429, { ok: false, error: 'Demasiadas solicitudes' });
  return false;
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

function handleHttpRequest(req, res) {
  const u = new URL(req.url, 'http://internal');

  if (u.pathname === '/healthz' && req.method === 'GET') {
    sendJson(res, 200, { ok: true });
    return;
  }
  if (u.pathname === '/api/menu' && req.method === 'GET') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(MENU_DATA));
    return;
  }
  if (u.pathname === '/api/staff-login' && req.method === 'POST') {
    if (!applyRateLimit(req, res, rateLimiters.login, 'staff-login')) return;
    if (!acceptsJson(req)) { sendJson(res, 415, { ok: false, error: 'Content-Type debe ser application/json' }); return; }
    readJsonBody(req, (error, body) => {
      if (error) { sendJson(res, error.status, { ok: false, error: error.error }); return; }
      if (!body || typeof body !== 'object' || Array.isArray(body) || typeof body.pin !== 'string') {
        sendJson(res, 400, { ok: false, error: 'PIN inválido' });
        return;
      }
      const role = body.role == null ? 'encargado' : body.role;
      if (typeof role !== 'string' || !STAFF_ROLES.has(role)) {
        sendJson(res, 400, { ok: false, error: 'Rol inválido' });
        return;
      }
      if (body.pin !== STAFF_PINS[role]) { sendJson(res, 401, { ok: false }); return; }
      pruneExpiredStaffTokens();
      const token = crypto.randomBytes(32).toString('hex');
      STAFF_TOKENS.set(token, { expiresAt: Date.now() + STAFF_TOKEN_TTL_MS, role });
      sendJson(res, 200, { ok: true, token, role, allowedViews: STAFF_ROLE_VIEWS[role] });
    });
    return;
  }
  if (u.pathname === '/api/staff-logout' && req.method === 'POST') {
    const token = extractBearerToken(req);
    if (!token) { sendJson(res, 401, { ok: false, error: 'Autenticación requerida' }); return; }
    STAFF_TOKENS.delete(token);
    sseClients.forEach(client => {
      if (client.kind === 'staff' && client.token === token) closeSseClient(client);
    });
    sendJson(res, 200, { ok: true });
    return;
  }
  if (u.pathname === '/api/mesa-links' && req.method === 'GET') {
    const session = staffSession(req);
    if (!session) {
      sendJson(res, 401, { ok: false, error: 'Autenticación requerida' });
      return;
    }
    if (session.role !== 'encargado') {
      sendJson(res, 403, { ok: false, error: 'El rol no tiene acceso a los QR de mesa' });
      return;
    }
    const mesas = state.mesas.map(mesa => {
      const accessToken = accessTokenForMesa(mesa.numero);
      const path = `/mesa.html?mesa=${mesa.numero}${accessToken ? `#token=${accessToken}` : ''}`;
      return { numero: mesa.numero, mozo: mesa.mozo, ocupada: mesa.ocupada, path };
    });
    sendJson(res, 200, { ok: true, secure: Boolean(MESA_TOKEN_SECRET), mesas });
    return;
  }
  if (u.pathname === '/api/action' && req.method === 'POST') {
    if (!applyRateLimit(req, res, rateLimiters.action, 'action')) return;
    if (!acceptsJson(req)) { sendJson(res, 415, { ok: false, error: 'Content-Type debe ser application/json' }); return; }
    readJsonBody(req, (error, body) => {
      if (error) { sendJson(res, error.status, { ok: false, error: error.error }); return; }
      if (body && PUBLIC_ACTIONS.has(body.type)) {
        const mesaAuthorization = authorizeMesaRequest(req, body.mesa);
        if (!mesaAuthorization.ok) {
          sendJson(res, mesaAuthorization.status, { ok: false, error: 'Identidad de mesa inválida' });
          return;
        }
      }
      if (body && STAFF_ACTIONS.has(body.type)) {
        const session = staffSession(req);
        if (!session) {
          sendJson(res, 401, { ok: false, error: 'Autenticación requerida' });
          return;
        }
        if (!staffRoleCan(session.role, body)) {
          sendJson(res, 403, { ok: false, error: 'El rol no puede realizar esta acción' });
          return;
        }
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
          logEvent('error', 'action_persistence_error', { requestId: req.requestId, ...errorFields(error) });
          sendJson(res, 503, { ok: false, error: 'Persistencia no disponible' });
          return;
        }
        broadcast();
        sendJson(res, 200, { ok: true });
      }).catch(error => {
        logEvent('error', 'action_processing_error', { requestId: req.requestId, ...errorFields(error) });
        if (!res.headersSent) sendJson(res, 500, { ok: false, error: 'Error interno' });
      });
    });
    return;
  }
  if (u.pathname === '/events' && req.method === 'GET') {
    const mesa = Number(u.searchParams.get('mesa'));
    if (!validMesaNumber(mesa)) {
      sendJson(res, 400, { ok: false, error: 'Mesa inválida' });
      return;
    }
    const mesaAuthorization = authorizeMesaRequest(req, mesa);
    if (!mesaAuthorization.ok) {
      sendJson(res, mesaAuthorization.status, { ok: false, error: 'Identidad de mesa inválida' });
      return;
    }
    const client = { kind: 'mesa', mesa, res };
    res.writeHead(200, {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no',
    });
    res.write(estadoPayload(client));
    sseClients.add(client);
    req.on('close', () => sseClients.delete(client));
    return;
  }
  if (u.pathname === '/api/staff-events' && req.method === 'GET') {
    const session = staffSession(req);
    if (!session) {
      sendJson(res, 401, { ok: false, error: 'Autenticación requerida' });
      return;
    }
    const client = { kind: 'staff', token: session.token, role: session.role, res };
    res.writeHead(200, {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no',
    });
    res.write(estadoPayload(client));
    sseClients.add(client);
    req.on('close', () => sseClients.delete(client));
    return;
  }

  serveStatic(req, res);
}

const server = http.createServer((req, res) => {
  const startedAt = process.hrtime.bigint();
  const requestId = crypto.randomUUID();
  req.requestId = requestId;
  req.clientIp = resolveClientIp(req);
  res.requestId = requestId;
  res.setHeader('X-Request-Id', requestId);
  res.once('finish', () => {
    const durationMs = Number(process.hrtime.bigint() - startedAt) / 1e6;
    let requestPath = '/invalid-url';
    try { requestPath = new URL(req.url, 'http://internal').pathname; } catch (_) {}
    logEvent('log', 'request', {
      requestId,
      method: req.method,
      path: requestPath,
      status: res.statusCode,
      durationMs: Number(durationMs.toFixed(2)),
      clientIp: req.clientIp,
    });
  });
  try {
    handleHttpRequest(req, res);
  } catch (error) {
    logEvent('error', 'unexpected_request_error', { requestId, ...errorFields(error) });
    if (!res.headersSent) sendJson(res, 500, { ok: false, error: 'Error interno' });
    else res.end();
  }
});

server.on('clientError', (error, socket) => {
  const requestId = crypto.randomUUID();
  logEvent('error', 'client_protocol_error', { requestId, ...errorFields(error) });
  if (socket.writable) {
    socket.end(`HTTP/1.1 400 Bad Request\r\nX-Request-Id: ${requestId}\r\nConnection: close\r\n\r\n`);
  }
});

const PORT = process.env.PORT || 3000;
let shuttingDown = false;
async function shutdown(signal) {
  if (shuttingDown) return;
  shuttingDown = true;
  logEvent('log', 'shutdown_started', { signal, persistenceMode: persistence.enabled ? 'postgresql' : 'memory' });
  if (clockTimer) clearInterval(clockTimer);
  sseClients.forEach(closeSseClient);
  await new Promise(resolve => server.close(resolve));
  try {
    await mutationQueue;
    await persistence.close(state);
    logEvent('log', 'shutdown_completed', { signal, persistenceMode: persistence.enabled ? 'postgresql' : 'memory' });
    process.exit(0);
  } catch (error) {
    logEvent('error', 'shutdown_error', { signal, persistenceMode: persistence.enabled ? 'postgresql' : 'memory', ...errorFields(error) });
    process.exit(1);
  }
}

process.once('SIGTERM', () => shutdown('SIGTERM'));
process.once('SIGINT', () => shutdown('SIGINT'));

async function start() {
  state = normalizeRecoveredState(await persistence.initialize(state));
  if (MESA_TOKEN_SECRET) logEvent('log', 'mesa_identity_active');
  else logEvent('warn', 'mesa_identity_inactive', { warning: 'MESA_TOKEN_SECRET no configurado; compatibilidad legacy activa' });
  startClock();
  server.listen(PORT, () => {
    const mode = persistence.enabled ? 'PostgreSQL' : 'memoria';
    logEvent('log', 'server_started', { port: Number(PORT), persistenceMode: mode === 'PostgreSQL' ? 'postgresql' : 'memory' });
  });
}

start().catch(error => {
  logEvent('error', 'startup_error', { persistenceMode: persistence.enabled ? 'postgresql' : 'memory', ...errorFields(error) });
  process.exitCode = 1;
});
