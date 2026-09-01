/* RABIETA-BUILD-2026-08-26-SPLASH — si ves esta línea acá arriba en GitHub, subiste la versión correcta. */
/* =========================================================
   RABIETA — cliente real, conectado por WebSocket al servidor
   (server.js). Esta es la MISMA lógica de vistas del prototipo
   original, pero ahora el "estado" no vive en la memoria del
   navegador: lo manda el servidor, y todas las acciones del
   usuario (pedir, llamar al mozo, marcar listo, etc.) se
   mandan al servidor en vez de mutar datos locales. Por eso
   dos celulares distintos ven lo mismo en vivo.
   ========================================================= */

/* ================= ÍCONOS (línea fina, sin emojis) =================
   Rabieta es un bar con onda, no una vidriera de juguetería: nada de
   emojis de colores. Un solo set de íconos de línea, en el color de
   texto de cada lugar (currentColor), tamaño 1em. */
const ICONS = {
  ring:      '<circle cx="12" cy="12" r="7"/>',
  bell:      '<path d="M12 4a5 5 0 0 0-5 5v3.2L5 16h14l-2-3.8V9a5 5 0 0 0-5-5Z"/><path d="M10 19a2 2 0 0 0 4 0"/>',
  receipt:   '<path d="M6 3h12v18l-2.5-1.5L13 21l-2.5-1.5L8 21l-2-1.5Z"/><line x1="8.5" y1="8" x2="15.5" y2="8"/><line x1="8.5" y1="12" x2="15.5" y2="12"/>',
  help:      '<circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="3"/><line x1="12" y1="4" x2="12" y2="9"/><line x1="12" y1="15" x2="12" y2="20"/><line x1="4" y1="12" x2="9" y2="12"/><line x1="15" y1="12" x2="20" y2="12"/>',
  flame:     '<path d="M12 3c1 2.5-3 4-3 8a3 3 0 0 0 6 0c0-1-.5-1.8-1-2 .8 2.6-1 4.3-2 4.3-2.2 0-4.3-1.8-4.3-4.8C7.7 5.3 10.2 4 12 3Z"/>',
  user:      '<circle cx="12" cy="8" r="3.4"/><path d="M5 20c1-4 4-6 7-6s6 2 7 6"/>',
  briefcase: '<rect x="4" y="8" width="16" height="11" rx="1.5"/><path d="M9 8V6a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2"/><line x1="4" y1="13" x2="20" y2="13"/>',
  chart:     '<line x1="5" y1="20" x2="5" y2="12"/><line x1="12" y1="20" x2="12" y2="7"/><line x1="19" y1="20" x2="19" y2="15"/>',
  wheat:     '<path d="M12 4v16"/><path d="M12 7c2 0 3 .9 3 1.9s-1 1.9-3 1.9"/><path d="M12 7c-2 0-3 .9-3 1.9s1 1.9 3 1.9"/><path d="M12 10.8c2 0 3 .9 3 1.9s-1 1.9-3 1.9"/><path d="M12 10.8c-2 0-3 .9-3 1.9s1 1.9 3 1.9"/>',
  cube:      '<path d="M12 3.2 19.5 7.5v9L12 20.8 4.5 16.5v-9Z"/><path d="M4.7 7.6 12 12l7.3-4.4"/><line x1="12" y1="12" x2="12" y2="20.8"/>',
  plate:     '<circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="3.3"/>',
  lock:      '<rect x="5" y="11" width="14" height="9" rx="1.5"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/>',
  sound:     '<path d="M4 9.2v5.6h3.6l4.9 3.7V5.5l-4.9 3.7Z"/><path d="M15.8 9.3a4 4 0 0 1 0 5.4"/><path d="M18.3 7a7.5 7.5 0 0 1 0 10"/>',
  clipboard: '<rect x="5" y="4" width="14" height="17" rx="1.5"/><rect x="9" y="2.3" width="6" height="3" rx="1"/><line x1="8" y1="10.2" x2="16" y2="10.2"/><line x1="8" y1="14.2" x2="16" y2="14.2"/>',
  refresh:   '<path d="M4 12a8 8 0 0 1 14-5"/><polyline points="18 3 18 8 13 8"/><path d="M20 12a8 8 0 0 1-14 5"/><polyline points="6 21 6 16 11 16"/>',
  warning:   '<path d="M12 4 21 19H3Z"/><line x1="12" y1="9.5" x2="12" y2="14"/><circle cx="12" cy="16.6" r="0.9" fill="currentColor" stroke="none"/>',
  checkring: '<circle cx="12" cy="12" r="8"/><polyline points="8.3 12.2 10.8 14.7 15.8 9.2"/>',
};
function ic(name, cls){ return `<svg class="i-ic${cls?' '+cls:''}" viewBox="0 0 24 24">${ICONS[name]||''}</svg>`; }

const PEDIDO_ESTADOS = ['enviado','preparando','listo','entregado'];
const DESTINO_LABELS = {cocina:'Cocina', barra:'Barra'};
const PEDIDO_LABELS = {enviado:'Recibido', preparando:'En preparación', listo:'Listo', entregado:'Entregado'};
const MOZOS = ['Martín','Sofía','Lucas'];
const ASISTENTE_OPCIONES = [
  {id:'compartir',label:'Para compartir'}, {id:'contundente',label:'Algo contundente'},
  {id:'liviano',label:'Algo más liviano'}, {id:'sin_tacc',label:'Sin TACC'},
  {id:'dulce',label:'Un postre'},
];
const HELP_CATEGORIAS = [
  {id:'no_llego',  label:'No llegó mi pedido',        prioridad:'urgente'},
  {id:'incorrecto',label:'Mi pedido está incorrecto',  prioridad:'urgente'},
  {id:'falta',     label:'Falta algo',                 prioridad:'importante'},
  {id:'mozo',      label:'Necesito al mozo',            prioridad:'normal'},
  {id:'cambiar',   label:'Quiero cambiar algo',         prioridad:'importante'},
  {id:'cuenta',    label:'Quiero pedir la cuenta',      prioridad:'importante'},
];
const KEYWORDS_URGENTE = ['no llegó','no llego','frío','fria','crudo','cruda','alerg','mal estado','equivocado','equivocada'];
const KEYWORDS_IMPORTANTE = ['falta','cambiar','sin ','error','cuenta'];
function clasificarTextoLibre(t){
  t = t.toLowerCase();
  if (KEYWORDS_URGENTE.some(k=>t.includes(k))) return 'urgente';
  if (KEYWORDS_IMPORTANTE.some(k=>t.includes(k))) return 'importante';
  return 'normal';
}

// UN solo modelo 3D real verificado (glTF de Khronos, dominio público) que
// usamos como GENÉRICO en TODOS los platos, mientras no exista el escaneo
// real de cada plato de Rabieta. Esto SÍ es 3D real: se gira, se acerca, y
// con el botón de cámara abre AR de verdad en Android. Lo que no es real
// todavía es que sea la foto exacta del plato — por eso siempre el mismo
// modelo genérico (la palta), para que no parezca un error random.
const MODELOS_3D_GENERICOS = [
  { url:'https://raw.githubusercontent.com/KhronosGroup/glTF-Sample-Assets/main/Models/Avocado/glTF-Binary/Avocado.glb', nombre:'palta (modelo genérico)' },
];

let MENU_DATA = null;
let CANDIDATOS_3D = new Set();
let MESAS_TOTAL = 0;
let liveReady = false; // true mientras el stream en vivo (SSE) está conectado
let knownAlertIds = null; // null = todavía no llegó el primer snapshot
let STAFF_TOKEN = null;
let MESA_TOKEN = null;

let state = {
  clockMs:0, mesas:[], analytics:{pagosConfirmados:0,ventasDemo:0,tiempoPagoTotalSec:0,itemsVendidos:0,productos:{},resenas:[]},
  // ui local, no viene del servidor:
  role:null, clienteMesa:null, clienteCat:null, clienteFiltroSinTacc:false,
  clienteCart:[], clienteExpand:null, clienteHelpOpen:false, clienteSplashDismissed:false,
  clienteAsistenteOpen:false, clientePreferencia:null, clienteResenaError:'', clienteResenaEnviando:false,
  mozoActivo:MOZOS[0], modal:null,
};

function money(n){ return n===null || n===undefined ? 'A confirmar' : '$'+n.toLocaleString('es-AR'); }
function escapeHtml(value){
  return String(value == null ? '' : value).replace(/[&<>"']/g, char => ({
    '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;'
  })[char]);
}
function timeAgoSec(ts){ return Math.max(0, Math.floor(state.clockMs - ts)); }
function fmtSec(s){ const m=Math.floor(s/60), r=s%60; return (m>0? m+'m ':'')+r+'s'; }
function findMesa(n){ return state.mesas.find(m=>m.numero===n); }
function findProducto(id){ for(const c of MENU_DATA.categorias) for(const p of c.productos) if(p.id===id) return p; }
function todosLosProductos(){ const out=[]; MENU_DATA.categorias.forEach(c=>c.productos.forEach(p=>out.push({...p,categoriaId:c.id}))); return out; }
function precioBase(p){ if(p.variantes && p.variantes.length) return p.variantes[0].precio; return p.precio; }
function mesaBusy(m){ return !!m.pedido; }
function estadoPedidoLabel(m){
  if(!m.pedido) return 'Libre';
  const entregados = m.pedido.items.filter(it=>it.estado==='entregado').length;
  if(entregados>0 && entregados<m.pedido.items.length) return `${entregados}/${m.pedido.items.length} entregados`;
  return PEDIDO_LABELS[m.pedido.estado];
}
function itemEstadoClass(estado){ return estado==='enviado'?'importante':estado==='preparando'?'normal':'libre'; }
function pedidoTotal(m){ return m.pedido ? m.pedido.items.reduce((sum,item)=>sum+(item.precio||0),0) : 0; }
function alertasAbiertas(m){ return m.alertas.filter(a=>a.estado!=='resuelto'); }
function prioridadMax(alertas){
  if(alertas.some(a=>a.prioridad==='urgente')) return 'urgente';
  if(alertas.some(a=>a.prioridad==='importante')) return 'importante';
  if(alertas.length) return 'normal';
  return null;
}
function todasAlertasAbiertas(){
  let out=[];
  state.mesas.forEach(m=> alertasAbiertas(m).forEach(a=> out.push({mesa:m, alerta:a})));
  const orden={urgente:0,importante:1,normal:2};
  out.sort((a,b)=> (orden[a.alerta.prioridad]-orden[b.alerta.prioridad]) || (a.alerta.creadoTs-b.alerta.creadoTs));
  return out;
}

/* ================= CONEXIÓN EN VIVO (Server-Sent Events) =================
   No usamos WebSocket para evitar depender de paquetes externos en el
   servidor. Las mesas usan EventSource y el staff fetch streaming para
   poder enviar el Bearer token en un header, nunca en la URL. */
function aplicarMensajeRealtime(data, onFirstSnapshot){
  let msg; try{ msg = JSON.parse(data); }catch(e){ return onFirstSnapshot; }
  if(msg.type==='estado'){
    if(!liveReady){ liveReady=true; setConnPill(true); }
    MESAS_TOTAL = msg.mesasTotal || MESAS_TOTAL;
    state.clockMs = msg.state.clockMs;
    state.mesas = msg.state.mesas;
    if(msg.state.analytics) state.analytics = msg.state.analytics;
    detectarNuevasAlertas();
    if(onFirstSnapshot){ onFirstSnapshot(); onFirstSnapshot=null; }
    render();
  }
  return onFirstSnapshot;
}
function conectar(onFirstSnapshot){
  if(state.role==='cliente'){
    conectarMesa(onFirstSnapshot);
    return;
  }
  conectarStaff(onFirstSnapshot);
}
async function conectarMesa(onFirstSnapshot){
  while(state.role==='cliente'){
    const headers = {};
    if(MESA_TOKEN) headers['X-Mesa-Token'] = MESA_TOKEN;
    try{
      const response = await fetch('/events?mesa=' + encodeURIComponent(state.clienteMesa), {headers});
      onFirstSnapshot = await consumirStream(response, onFirstSnapshot, ()=>state.role==='cliente');
    }catch(e){}
    liveReady=false; setConnPill(false);
    if(state.role==='cliente') await new Promise(resolve=>setTimeout(resolve,1000));
  }
}
async function conectarStaff(onFirstSnapshot){
  while(STAFF_TOKEN){
    try{
      const response = await fetch('/api/staff-events', {headers:{Authorization:'Bearer ' + STAFF_TOKEN}});
      onFirstSnapshot = await consumirStream(response, onFirstSnapshot, ()=>!!STAFF_TOKEN);
    }catch(e){}
    liveReady=false; setConnPill(false);
    if(STAFF_TOKEN) await new Promise(resolve=>setTimeout(resolve,1000));
  }
}
async function consumirStream(response, onFirstSnapshot, continuar){
  if(!response.ok || !response.body) throw new Error('stream no autorizado');
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  while(continuar()){
    const {done,value} = await reader.read();
    if(done) break;
    buffer += decoder.decode(value, {stream:true});
    let boundary;
    while((boundary=buffer.indexOf('\n\n'))!==-1){
      const event = buffer.slice(0,boundary); buffer = buffer.slice(boundary+2);
      const line = event.split('\n').find(candidate=>candidate.startsWith('data: '));
      if(line) onFirstSnapshot = aplicarMensajeRealtime(line.slice(6), onFirstSnapshot);
    }
  }
  return onFirstSnapshot;
}
function send(obj){
  const headers = {'Content-Type':'application/json'};
  if(STAFF_TOKEN) headers.Authorization = 'Bearer ' + STAFF_TOKEN;
  if(state.role==='cliente' && MESA_TOKEN) headers['X-Mesa-Token'] = MESA_TOKEN;
  return fetch('/api/action', {method:'POST', headers, body:JSON.stringify(obj)}).catch(()=>{});
}
function setStaffToken(token){ STAFF_TOKEN = token; }
function setMesaToken(token){ MESA_TOKEN = token || null; }
function setConnPill(on){
  let el = document.getElementById('connPill');
  if(!el){ el=document.createElement('div'); el.id='connPill'; el.className='conn-pill'; document.body.appendChild(el); }
  el.className = 'conn-pill ' + (on?'on':'off');
  el.textContent = on ? '● en vivo' : '● sin conexión…';
}

function detectarNuevasAlertas(){
  const idsAhora = new Set();
  state.mesas.forEach(m=> m.alertas.forEach(a=> idsAhora.add(a.id)));
  if(knownAlertIds===null){ knownAlertIds = idsAhora; return; } // primer snapshot: no suena
  let hayNueva = false;
  idsAhora.forEach(id=>{ if(!knownAlertIds.has(id)) hayNueva = true; });
  knownAlertIds = idsAhora;
  if(hayNueva && state.role && state.role!=='cliente') alertaFisica();
}

/* ================= AVISO FÍSICO (sonido + vibración + flash) ================= */
let audioCtx = null;
function unlockAudio(){
  try{
    audioCtx = new (window.AudioContext||window.webkitAudioContext)();
    const o=audioCtx.createOscillator(), g=audioCtx.createGain();
    g.gain.value=0.0001; o.connect(g); g.connect(audioCtx.destination); o.start(); o.stop(audioCtx.currentTime+0.01);
  }catch(e){}
  if(navigator.vibrate) navigator.vibrate(80);
}
function beep(times){
  if(!audioCtx) return;
  let t = audioCtx.currentTime;
  for(let i=0;i<times;i++){
    const o=audioCtx.createOscillator(), g=audioCtx.createGain();
    o.type='sine'; o.frequency.value = 880;
    g.gain.setValueAtTime(0.0001,t);
    g.gain.exponentialRampToValueAtTime(0.55,t+0.02);
    g.gain.exponentialRampToValueAtTime(0.0001,t+0.28);
    o.connect(g); g.connect(audioCtx.destination);
    o.start(t); o.stop(t+0.3);
    t += 0.38;
  }
}
function alertaFisica(){
  beep(3);
  if(navigator.vibrate) navigator.vibrate([250,120,250,120,250]);
  document.body.classList.add('alerta-flash');
  setTimeout(()=>document.body.classList.remove('alerta-flash'), 4200);
  const original = document.title;
  let n=0;
  const iv = setInterval(()=>{
    document.title = (document.title===original) ? '🔔 ¡Atención en una mesa!' : original;
    n++; if(n>8){ clearInterval(iv); document.title=original; }
  }, 500);
}

/* ================= RENDER ================= */
function render(){
  const clockEl = document.getElementById('clockDemo');
  if(clockEl) clockEl.textContent = String(Math.floor(state.clockMs/60)).padStart(2,'0')+':'+String(state.clockMs%60).padStart(2,'0');
  const app = document.getElementById('app');
  if(!app) return;
  // El servidor manda un "tick" de reloj cada 1 segundo, y eso dispara este
  // render() aunque nada haya cambiado para el cliente. Como reescribimos
  // todo el HTML de adentro, sin esto cualquier scroll horizontal (las
  // pestañas de categorías, el carrusel de "ver en 3D") se resetea solo al
  // toque de haber empezado a deslizar. Guardamos y restauramos esa
  // posición para que el swipe no se corte.
  const scrollPos = [];
  app.querySelectorAll('.cat-tabs, .tiles3d').forEach(el=>{ scrollPos.push([el.className, el.scrollLeft]); });
  if(state.role==='cliente') app.innerHTML = viewCliente();
  else if(state.role==='cocina') app.innerHTML = viewCocina();
  else if(state.role==='mozo') app.innerHTML = viewMozo();
  else if(state.role==='encargado') app.innerHTML = viewEncargado();
  else if(state.role==='dueno') app.innerHTML = viewDueno();
  const restoreTargets = app.querySelectorAll('.cat-tabs, .tiles3d');
  restoreTargets.forEach(el=>{
    const match = scrollPos.find(([cls])=>cls===el.className);
    if(match) el.scrollLeft = match[1];
  });
  renderStaffNav();
  renderModal();
}

function renderStaffNav(){
  const nav = document.getElementById('staffNav');
  if(!nav) return;
  const roles = [
    {id:'mozo',label:'Mozo',icon:'user'},
    {id:'cocina',label:'Cocina (KDS)',icon:'flame'},
    {id:'encargado',label:'Encargado',icon:'briefcase'},
    {id:'dueno',label:'Dueño',icon:'chart'},
  ];
  const n = todasAlertasAbiertas().length;
  nav.innerHTML = roles.map(r=>`<button class="${state.role===r.id?'active':''}" onclick="setRole('${r.id}')">
    <span>${ic(r.icon)}</span><span>${r.label}</span><span class="dot ${n>0?'show':''}"></span></button>`).join('');
}
function setRole(id){ state.role=id; render(); }

/* ================= MODAL 3D — REAL, no mock ================= */
function modeloParaPlato(id){
  const lista = [...CANDIDATOS_3D];
  const idx = lista.indexOf(id);
  return MODELOS_3D_GENERICOS[(idx<0?0:idx) % MODELOS_3D_GENERICOS.length];
}
function renderModal(){
  const root = document.getElementById('modalRoot');
  if(!root) return;
  if(!state.modal){ root.innerHTML=''; return; }
  if(state.modal.type==='3d'){
    const modelo = modeloParaPlato(state.modal.id);
    const producto = findProducto(state.modal.id);
    const poster = producto && producto.imagen ? producto.imagen : '/img/hero-barra.jpg';
    root.innerHTML = `<div class="modal-bg" onclick="closeModal(event)">
      <div class="modal modal-3d" onclick="event.stopPropagation()">
        <div class="stage3d-real">
          <model-viewer id="mv3d" src="${modelo.url}" camera-controls auto-rotate auto-rotate-delay="300"
            ar ar-modes="scene-viewer webxr quick-look" shadow-intensity="1" exposure="1"
            poster="${poster}" alt="Vista 3D genérica para ${escapeHtml(state.modal.nombre)}" loading="eager" reveal="auto"
            onload="modelo3dListo()" onerror="modelo3dError()"
            style="width:100%;height:100%;background:transparent;"></model-viewer>
          <div id="fallback3d" class="fallback3d" hidden>
            <img src="${poster}" alt="Foto de ${escapeHtml(state.modal.nombre)}">
            <span>La foto real queda disponible aunque el modelo 3D no cargue.</span>
          </div>
        </div>
        <div class="body3d">
          <span class="badge-preview">3D real · modelo genérico, todavía no es el escaneo del plato</span>
          <h3>${escapeHtml(state.modal.nombre)}</h3>
          <p>Activá la cámara, enfocá tu mesa, y el plato aparece ahí arriba en tamaño real — como si ya te lo hubieran servido. También podés arrastrar acá abajo para girarlo sin cámara.</p>
          <button class="btn callout block" onclick="activarAR()">${ic('cube')} Ver en mi mesa con la cámara</button>
          <div id="arStatus" class="ar-status" aria-live="polite">Cargando la experiencia 3D…</div>
          <p class="ar-fineprint">Funciona con cámara en Android (Chrome). En iPhone y en la compu se ve girando en pantalla por ahora. Lo único pendiente de verdad es reemplazar este modelo genérico — ${modelo.nombre} — por el escaneo 3D real de <b>${state.modal.nombre}</b> — eso es un paso de producción aparte.</p>
          <button class="btn dark block" onclick="closeModal()">Cerrar</button>
        </div>
      </div></div>`;
  } else if(state.modal.type==='confirm-mozo'){
    root.innerHTML = `<div class="modal-bg" onclick="closeModal(event)">
      <div class="modal" onclick="event.stopPropagation()">
        <div class="icon">${ic('bell')}</div>
        <h3>¿Llamar al mozo?</h3>
        <p>Se le va a avisar al mozo que la <b>Mesa ${state.clienteMesa}</b> necesita atención. Confirmá solo si de verdad lo necesitás, así no camina de mesa en mesa por un toque sin querer.</p>
        <div style="display:flex;gap:10px;">
          <button class="btn ghost" style="flex:1;" onclick="closeModal()">Cancelar</button>
          <button class="btn callout" style="flex:1;" onclick="confirmarLlamarMozo()">Sí, llamar</button>
        </div>
      </div></div>`;
  } else if(state.modal.type==='mozo-enviado'){
    root.innerHTML = `<div class="modal-bg" onclick="closeModal(event)">
      <div class="modal" onclick="event.stopPropagation()">
        <div class="icon">${ic('checkring')}</div>
        <h3>Aviso enviado</h3>
        <p>Tu llamado fue recibido. Un mozo se va a acercar a la <b>Mesa ${state.clienteMesa}</b> en breve.</p>
        <button class="btn primary block" onclick="closeModal()">Entendido</button>
      </div></div>`;
  }
}
function openModal3d(id, nombre){ state.modal = {type:'3d', id, nombre}; render(); }
function closeModal(e){ state.modal=null; render(); }
function setArStatus(message, isError){
  const status = document.getElementById('arStatus');
  if(!status) return;
  status.textContent = message;
  status.classList.toggle('error', !!isError);
}
function modelo3dListo(){
  const mv = document.getElementById('mv3d');
  setArStatus(mv && mv.canActivateAR ? 'Modelo listo. Tu dispositivo puede abrir la cámara.' : 'Modelo listo para girar. La cámara AR depende del dispositivo.');
}
function modelo3dError(){
  const mv = document.getElementById('mv3d');
  const fallback = document.getElementById('fallback3d');
  if(mv) mv.hidden = true;
  if(fallback) fallback.hidden = false;
  setArStatus('No se pudo cargar el modelo 3D. Podés seguir viendo la foto y pedir normalmente.', true);
}
async function activarAR(){
  const mv = document.getElementById('mv3d');
  if(!mv || typeof mv.activateAR!=='function'){
    setArStatus('La experiencia 3D todavía está cargando. Probá de nuevo en unos segundos.', true);
    return;
  }
  if(mv.canActivateAR===false){
    setArStatus('Este dispositivo no ofrece cámara AR. Igual podés arrastrar el modelo para verlo en 3D.', true);
    return;
  }
  try{
    await mv.activateAR();
    setArStatus('Cámara AR iniciada. Mové el teléfono para detectar la mesa.');
  }catch(e){
    setArStatus('No se pudo abrir la cámara AR. Revisá el permiso de cámara o usá la vista 3D.', true);
  }
}

/* ---------------- CLIENTE ---------------- */
function platosDestacadosData(){ return [...CANDIDATOS_3D].map(id=>findProducto(id)).filter(Boolean); }
function banner3dHtml(){
  const platos = platosDestacadosData();
  if(!platos.length) return '';
  return `<div class="banner3d">
    <div class="head"><div class="ico">${ic('cube')}</div>
      <div class="txt"><strong>Mirá tu plato en 3D antes de pedir</strong><span>Tocá cualquiera de estos ${platos.length} platos — un solo toque</span></div></div>
    <div class="tiles3d">
      ${platos.map(p=>`<button onclick="openModal3d('${p.id}','${p.nombre.replace(/'/g,"\\'")}')">
        ${p.imagen ? `<img class="tile3d-img" src="${p.imagen}" alt="${p.nombre}">` : `<span class="em">${ic('plate')}</span>`}
        <span class="nm">${p.nombre}</span><span class="cta">Ver en 3D</span></button>`).join('')}
    </div></div>`;
}

function puntuarRecomendacion(p, perfil){
  const categoria = p.categoriaId;
  const texto = `${p.nombre} ${p.descripcion||''}`.toLowerCase();
  if(perfil==='sin_tacc') return p.filtro_dietario && p.filtro_dietario.includes('sin_tacc') ? 20 : -1;
  if(perfil==='dulce') return categoria==='sobremesa' ? 15+(p.candidato_destacado?1:0) : -1;
  let score = 0;
  if(perfil==='compartir'){
    if(p.para_compartir) score += 12;
    if(['tablas-y-picadas','caliente','pizzas'].includes(categoria)) score += 6;
  }
  if(perfil==='contundente'){
    if(['entrepanes','cocina-resistencia','pizzas'].includes(categoria)) score += 8;
    if(/burger|milanesa|bife|bondiola|asado/.test(texto)) score += 5;
  }
  if(perfil==='liviano'){
    if(['mezcolanzas','sin-tacc'].includes(categoria)) score += 10;
    if(/ensalada|rúcula|vegetal|hummus/.test(texto)) score += 4;
  }
  if(score>0 && p.candidato_destacado) score++;
  return score || -1;
}
function recomendacionesAsistente(perfil){
  return todosLosProductos()
    .filter(p=>Number.isFinite(precioBase(p)))
    .map(p=>({p,score:puntuarRecomendacion(p,perfil)}))
    .filter(item=>item.score>0)
    .sort((a,b)=>b.score-a.score || a.p.nombre.localeCompare(b.p.nombre,'es'))
    .slice(0,3).map(item=>item.p);
}
function asistenteCartaHtml(){
  if(!state.clienteAsistenteOpen){
    return `<div class="ai-assistant compact"><div><span class="ai-badge">Recomendación inteligente · demo local</span>
      <strong>¿No sabés qué pedir?</strong><p>Te orientamos con la carta real de Rabieta.</p></div>
      <button class="btn primary sm" onclick="toggleAsistente()">Ayudame a elegir</button></div>`;
  }
  const recomendaciones = state.clientePreferencia ? recomendacionesAsistente(state.clientePreferencia) : [];
  return `<div class="ai-assistant">
    <div class="ai-head"><div><span class="ai-badge">Asistente Rabieta</span><strong>¿Qué te pinta hoy?</strong></div>
      <button class="btn ghost sm" onclick="toggleAsistente()">Cerrar</button></div>
    <div class="ai-options">${ASISTENTE_OPCIONES.map(op=>`<button class="${state.clientePreferencia===op.id?'active':''}" onclick="setPreferenciaAsistente('${op.id}')">${op.label}</button>`).join('')}</div>
    ${state.clientePreferencia ? `<div class="ai-results">
      ${recomendaciones.map(p=>`<button onclick="abrirRecomendacion('${p.id}')"><span><strong>${escapeHtml(p.nombre)}</strong><small>${escapeHtml(MENU_DATA.categorias.find(c=>c.id===p.categoriaId).nombre)}</small></span><b>${money(precioBase(p))}</b></button>`).join('')}
    </div>${state.clientePreferencia==='sin_tacc'?`<p class="ai-warning">${ic('warning')} Según la carta marcada Sin TACC. Confirmá con el personal por contaminación cruzada.</p>`:''}` : '<p class="ai-empty">Elegí una opción y te mostramos hasta tres platos con precio confirmado.</p>'}
    <p class="ai-fineprint">Funciona localmente con reglas sobre la carta; no envía datos ni usa un servicio externo.</p>
  </div>`;
}
function toggleAsistente(){ state.clienteAsistenteOpen=!state.clienteAsistenteOpen; render(); }
function setPreferenciaAsistente(perfil){
  if(ASISTENTE_OPCIONES.some(op=>op.id===perfil)){ state.clientePreferencia=perfil; render(); }
}
function abrirRecomendacion(id){
  const producto = todosLosProductos().find(p=>p.id===id);
  if(!producto) return;
  state.clienteCat=producto.categoriaId; state.clienteExpand=id; state.clienteAsistenteOpen=false; render();
  setTimeout(()=>{ const dish=document.getElementById('dish-'+id); if(dish) dish.scrollIntoView({behavior:'smooth',block:'center'}); },0);
}

function splashHtml(mesa){
  const platos = platosDestacadosData();
  const destacado = platos.find(p=>p.id==='burger-rabieta' && p.imagen) || platos.find(p=>p.imagen);
  // Si todavía no cargó el menú (o ningún destacado tiene foto todavía) no mostramos
  // un splash vacío ni marcamos como "visto" — probamos de nuevo en el próximo render.
  if(!destacado) return '';
  return `<div class="splash">
    <div class="splash-top">
      <span class="badge-mesa">MESA ${mesa.numero}</span>
      <button class="splash-bell" onclick="llamarMozo()" title="Llamar al mozo">${ic('bell')}</button>
    </div>
    <div class="splash-copy">
      <div class="splash-eyebrow">Antes de pedir</div>
      <h1 class="splash-h1">Se come primero<br>con los ojos.</h1>
      <p class="splash-sub">Mirá el plato real antes de pedir — girálo en 3D, o pasá directo a la carta completa.</p>
    </div>
    <div class="splash-arrow">
      <svg viewBox="0 0 56 64"><path d="M28 4 C 16 18, 40 30, 26 44"/><path d="M16 40 L 26 52 L 36 41"/></svg>
    </div>
    <div class="splash-stage">
      ${destacado.imagen ? `<img class="splash-stage-img" src="${destacado.imagen}" alt="${destacado.nombre}">` : ''}
      <div class="splash-stage-scrim"></div>
      <div class="splash-stage-tag">Plato destacado de hoy</div>
      <div class="splash-stage-name">${destacado.nombre}</div>
      <button class="btn callout splash-3d-btn" onclick="openModal3d('${destacado.id}','${destacado.nombre.replace(/'/g,"\\'")}')">${ic('cube')} Girá este plato en 3D</button>
    </div>
    <button class="splash-skip" onclick="dismissSplash()">Ver toda la carta →</button>
  </div>`;
}
function dismissSplash(){ state.clienteSplashDismissed = true; render(); }

function viewCliente(){
  const mesa = findMesa(state.clienteMesa);
  if(!mesa) return `<div class="empty">Este link no tiene una mesa válida asignada.</div>`;
  if(!MENU_DATA) return `<div class="empty">Conectando con el local…</div>`;
  if(!state.clienteSplashDismissed){
    const splash = splashHtml(mesa);
    if(splash) return splash;
  }
  let productos = MENU_DATA.categorias.find(c=>c.id===state.clienteCat).productos;
  if(state.clienteFiltroSinTacc) productos = productos.filter(p=>p.filtro_dietario && p.filtro_dietario.includes('sin_tacc'));

  let pedidoStatusHtml = '';
  if(mesa.pedido){
    const idx = PEDIDO_ESTADOS.indexOf(mesa.pedido.estado);
    const pagoHtml = mesa.pago && mesa.pago.estado==='confirmado'
      ? `<div class="mock-banner" style="margin:12px 0 0;">${ic('checkring')} Pago de demostración confirmado por ${money(mesa.pago.total)}. No se movió dinero real.</div>${resenaHtml(mesa)}`
      : mesa.cuentaPedida
        ? `<div class="mock-banner" style="margin:12px 0 0;">${ic('receipt')} Cuenta solicitada por ${money(pedidoTotal(mesa))}. El personal está preparando el cobro.</div>`
        : '';
    pedidoStatusHtml = `<div class="card">
      <div style="font-weight:800;font-size:13.5px;margin-bottom:4px;">Tu pedido</div>
      <div class="status-stepper">${PEDIDO_ESTADOS.map((s,i)=>`
        <div class="step ${i<idx?'done':i===idx?'current':''}"><div class="bar"></div>
          <div class="circle">${i<idx?'✓':i+1}</div><div class="lbl">${PEDIDO_LABELS[s]}</div></div>`).join('')}
      </div>
      <ul style="font-size:13px;margin:0;padding-left:18px;color:var(--ink-2);">
        ${mesa.pedido.items.map(it=>`<li>${escapeHtml(it.nombre)}${it.notas?` — "${escapeHtml(it.notas)}"`:''} <span class="pill ${itemEstadoClass(it.estado)}">${PEDIDO_LABELS[it.estado]}</span></li>`).join('')}
      </ul>${pagoHtml}</div>`;
  }
  const openAlerts = alertasAbiertas(mesa);
  const alertHtml = openAlerts.length ? `<div class="card" style="border-color:var(--warning);">
    <div style="font-weight:800;font-size:13px;margin-bottom:6px;">Tus solicitudes activas</div>
    ${openAlerts.map(a=>`<div style="display:flex;justify-content:space-between;align-items:center;font-size:13px;margin-bottom:6px;">
      <span>${escapeHtml(a.label)}${a.mensaje?': "'+escapeHtml(a.mensaje)+'"':''}</span>
      <span class="pill ${a.estado==='atencion'?'importante':a.prioridad}">${a.estado==='atencion'?'En atención':'Enviado'}</span></div>`).join('')}
    </div>` : '';

  const cartTotal = state.clienteCart.reduce((s,it)=> s + (it.precio||0), 0);
  const cartPendientes = state.clienteCart.filter(it=>it.precio===null).length;

  return `
    <h1 class="view-title">CARTA</h1>
    <p class="view-sub">Carta real de Rabieta Lomitas. Los precios marcados "a confirmar" todavía no están validados con el local.</p>
    <div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap;margin-bottom:14px;">
      <span class="badge-mesa">MESA ${mesa.numero}</span>
    </div>
    ${banner3dHtml()}
    ${asistenteCartaHtml()}
    ${pedidoStatusHtml}${alertHtml}

    <div class="filter-chips">
      <button class="${state.clienteFiltroSinTacc?'active':''}" onclick="toggleFiltroSinTacc()">${ic('wheat')} Sin TACC</button>
    </div>
    <div class="cat-tabs">
      ${MENU_DATA.categorias.map(c=>`<button class="${c.id===state.clienteCat?'active':''}" onclick="setCat('${c.id}')">${c.nombre}</button>`).join('')}
    </div>
    <div class="dish-list">
      ${productos.length ? productos.map(p=>dishCardHtml(p, mesa.cuentaPedida)).join('') : '<div class="empty">Ningún producto de esta categoría es apto Sin TACC.</div>'}
    </div>
    <div class="action-row">
      <button class="btn callout" onclick="llamarMozo()">${ic('bell')} Llamar al mozo</button>
      ${mesa.pago && mesa.pago.estado==='confirmado'
        ? `<button class="btn good" disabled>${ic('checkring')} Pago demo confirmado</button>`
        : mesa.cuentaPedida
          ? `<button class="btn dark" disabled>${ic('receipt')} Cuenta solicitada</button>`
          : `<button class="btn dark" onclick="pedirCuenta()">${ic('receipt')} Pedir la cuenta</button>`}
      <button class="btn critical" onclick="toggleHelp()">${ic('help')} Necesito ayuda</button>
    </div>
    ${state.clienteHelpOpen ? helpPanelHtml() : ''}
    ${state.clienteCart.length && !mesa.cuentaPedida ? `<div class="cart-bar">
      <div><div class="cart-total">${money(cartTotal)}${cartPendientes?' + '+cartPendientes+' a confirmar':''}</div>
      <div class="cart-info">${state.clienteCart.length} ítem(s) en el carrito</div></div>
      <button class="btn primary" onclick="enviarPedido()">Enviar pedido a cocina →</button></div>` : ''}
  `;
}

function dishCardHtml(p, bloqueado){
  const expanded = state.clienteExpand===p.id;
  const esCombo = p.tipo==='combo';
  const precio = precioBase(p);
  const esDestacado = CANDIDATOS_3D.has(p.id);
  const cuerpo = `
    <div class="row1"><strong>${p.nombre}</strong>
      ${precio===null && !p.variantes ? '<span class="price pending">A confirmar</span>' : `<span class="price">${p.variantes?'desde '+money(precio):money(precio)}</span>`}
    </div>
    ${p.descripcion ? `<div class="desc">${p.descripcion}</div>` : ''}
    <div class="tags">
      ${esDestacado?'<span class="tag destacado">★ Plato destacado</span>':''}
      ${p.filtro_dietario&&p.filtro_dietario.includes('sin_tacc')?`<span class="tag celiaco">${ic('wheat')} Sin TACC</span>`:''}
      ${esCombo?'<span class="tag">Combo plato + bebida</span>':''}
      ${p.para_compartir?'<span class="tag">Para compartir</span>':''}
    </div>
    ${esDestacado?`<button class="btn-3d" onclick="openModal3d('${p.id}','${p.nombre.replace(/'/g,"\\'")}')">${ic('cube')} Ver en 3D</button>`:''}
    ${bloqueado
      ? '<div style="margin-top:8px;"><span class="pill importante">Cuenta en proceso</span></div>'
      : expanded ? dishDetailHtml(p) : `<div style="margin-top:8px;"><button class="btn dark sm" onclick="toggleDish('${p.id}')">Agregar al pedido</button></div>`}
  `;
  if(p.imagen){
    return `<div class="dish" id="dish-${p.id}"><div class="dish-row">
      <img class="dish-thumb" src="${p.imagen}" alt="${p.nombre}">
      <div class="dish-body">${cuerpo}</div>
    </div></div>`;
  }
  return `<div class="dish" id="dish-${p.id}">${cuerpo}</div>`;
}
function dishDetailHtml(p){
  let variantePicker = '';
  if(p.variantes){
    variantePicker = `<div class="opt-label">Elegí versión</div>` + p.variantes.map((v,i)=>`
      <div class="opt-row"><label><input type="radio" name="var_${p.id}" value="${i}" ${i===0?'checked':''}> ${v.nombre} — ${money(v.precio)}</label></div>`).join('');
  }
  let opcionPicker = '';
  if(p.opciones){
    opcionPicker = `<div class="opt-label">Elegí una opción</div>` + p.opciones.map((o,i)=>`
      <div class="opt-row"><label><input type="radio" name="op_${p.id}" value="${o}" ${i===0?'checked':''}> ${o}</label></div>`).join('');
  }
  return `<div class="dish-detail">
    ${variantePicker}${opcionPicker}
    <input type="text" class="nota" id="nota_${p.id}" placeholder="Observación para cocina (ej: sin cebolla)…">
    <div style="margin-top:10px;display:flex;gap:8px;">
      <button class="btn primary sm" onclick="agregarAlCarrito('${p.id}')">Agregar</button>
      <button class="btn ghost sm" onclick="toggleDish(null)">Cerrar</button>
    </div></div>`;
}

function setCat(c){ state.clienteCat=c; state.clienteExpand=null; render(); }
function toggleFiltroSinTacc(){ state.clienteFiltroSinTacc=!state.clienteFiltroSinTacc; render(); }
function toggleDish(id){ state.clienteExpand = state.clienteExpand===id?null:id; render(); }
function toggleHelp(){ state.clienteHelpOpen=!state.clienteHelpOpen; render(); }

function agregarAlCarrito(id){
  const p = findProducto(id);
  let nombre = p.nombre, precio = precioBase(p);
  let variante = null, opcion = null;
  if(p.variantes){
    const idx = parseInt((document.querySelector(`input[name="var_${id}"]:checked`)||{}).value || 0, 10);
    variante = p.variantes[idx].nombre;
    nombre += ' — ' + variante; precio = p.variantes[idx].precio;
  }
  if(p.opciones){
    const op = (document.querySelector(`input[name="op_${id}"]:checked`)||{}).value;
    if(op){ opcion = op; nombre += ' (' + op + ')'; }
  }
  const nota = (document.getElementById('nota_'+id)||{}).value || '';
  state.clienteCart.push({productoId:id, variante, opcion, observacion:nota, nombre, precio, notas:nota});
  state.clienteExpand = null;
  render();
}
function enviarPedido(){
  if(!state.clienteCart.length) return;
  const items = state.clienteCart.map(item=>{
    const payload = {productoId:item.productoId, observacion:item.observacion};
    if(item.variante) payload.variante = item.variante;
    if(item.opcion) payload.opcion = item.opcion;
    return payload;
  });
  send({type:'pedido_nuevo', mesa:state.clienteMesa, items});
  state.clienteCart = [];
  render();
}
function llamarMozo(){ state.modal = {type:'confirm-mozo'}; render(); }
function confirmarLlamarMozo(){
  send({type:'llamar_mozo', mesa:state.clienteMesa});
  state.modal = {type:'mozo-enviado'};
  render();
  setTimeout(()=>{ if(state.modal && state.modal.type==='mozo-enviado'){ state.modal=null; render(); } }, 4500);
}
function pedirCuenta(){ state.clienteCart=[]; send({type:'pedir_cuenta', mesa:state.clienteMesa}); render(); }
function resenaHtml(mesa){
  if(mesa.resenaEnviada) return `<div class="review-card review-thanks">${ic('checkring')} Gracias. Tu opinión ya llegó al equipo de Rabieta.</div>`;
  return `<div class="review-card">
    <div class="review-title">¿Cómo estuvo tu experiencia?</div>
    <div class="review-sub">Tu respuesta queda en este panel demo y ayuda a detectar qué mejorar.</div>
    <div class="rating-pick" role="radiogroup" aria-label="Puntuación del 1 al 5">
      ${[1,2,3,4,5].map(n=>`<label><input type="radio" name="puntuacion-resena" value="${n}"><span>${n}</span></label>`).join('')}
    </div>
    <textarea class="nota review-comment" id="comentarioResena" maxlength="500" placeholder="Contanos qué te gustó o qué mejorarías (opcional)"></textarea>
    ${state.clienteResenaError?`<div class="review-error">${escapeHtml(state.clienteResenaError)}</div>`:''}
    <button class="btn primary sm" ${state.clienteResenaEnviando?'disabled':''} onclick="enviarResena()">${state.clienteResenaEnviando?'Enviando…':'Enviar opinión'}</button>
  </div>`;
}
async function enviarResena(){
  const selected = document.querySelector('input[name="puntuacion-resena"]:checked');
  if(!selected){ state.clienteResenaError='Elegí una puntuación del 1 al 5.'; render(); return; }
  const comentario = (document.getElementById('comentarioResena')||{}).value || '';
  state.clienteResenaError=''; state.clienteResenaEnviando=true; render();
  const response = await send({type:'resena_enviar', mesa:state.clienteMesa, puntuacion:Number(selected.value), comentario});
  state.clienteResenaEnviando=false;
  if(!response || !response.ok){
    let payload={}; try{ payload=await response.json(); }catch(e){}
    state.clienteResenaError=payload.error || 'No pudimos enviar tu opinión. Probá de nuevo.';
    render();
  }
}
function enviarAyuda(id){ send({type:'ayuda', mesa:state.clienteMesa, categoria:id}); state.clienteHelpOpen=false; render(); }
function enviarAyudaLibre(){
  const val = (document.getElementById('freeHelp')||{}).value || '';
  if(!val.trim()) return;
  send({type:'ayuda', mesa:state.clienteMesa, categoria:'otro', mensaje:val.trim()});
  state.clienteHelpOpen=false; render();
}
function helpPanelHtml(){
  return `<div class="card" style="margin-top:14px;">
    <div style="font-weight:800;font-size:13.5px;margin-bottom:10px;">¿En qué te podemos ayudar?</div>
    <div class="help-cats">${HELP_CATEGORIAS.map(h=>`<button onclick="enviarAyuda('${h.id}')">${h.label}</button>`).join('')}</div>
    <div style="font-size:12px;color:var(--ink-muted);margin-bottom:6px;">O contanos con tus palabras:</div>
    <input type="text" class="nota" id="freeHelp" placeholder='Ej: "Pedí sin cebolla y vino con cebolla"'>
    <div style="margin-top:8px;display:flex;gap:8px;">
      <button class="btn critical sm" onclick="enviarAyudaLibre()">Enviar</button>
      <button class="btn ghost sm" onclick="toggleHelp()">Cancelar</button>
    </div></div>`;
}

/* ---------------- COCINA ---------------- */
function itemElapsedLabel(it){
  const stageTs = it.estadoTs && Number.isFinite(it.estadoTs[it.estado]) ? it.estadoTs[it.estado] : it.enviadoTs;
  return `hace ${fmtSec(timeAgoSec(stageTs))} en esta etapa`;
}
function avanzarItem(n,itemId){
  const m=findMesa(n); const item=m.pedido.items.find(it=>it.id===itemId);
  const i=item ? PEDIDO_ESTADOS.indexOf(item.estado) : -1;
  if(i>=0 && i<PEDIDO_ESTADOS.length-1) send({type:'pedido_estado', mesa:n, itemId, estado:PEDIDO_ESTADOS[i+1]});
}
function confirmarEntrega(n,itemId){
  send({type:'pedido_estado', mesa:n, itemId, estado:'entregado'});
}

// Reemplaza el KDS único por dos colas independientes. La clasificación vive
// en el servidor; este panel solo la muestra y conserva las acciones por ítem.
function itemDestino(it){ return it.destino==='barra'?'barra':'cocina'; }
function viewCocina(){
  const activos = state.mesas.filter(m=>m.pedido && m.pedido.items.some(it=>it.estado!=='entregado'));
  const destinos = ['cocina','barra'];
  return `<h1 class="view-title">COCINA + BARRA</h1><p class="view-sub">KDS — colas en vivo separadas por destino. Configuración demo: validar sectores con el local.</p>
    <div class="kds-destinos">${destinos.map(destino=>{
      const tickets = activos.filter(m=>m.pedido.items.some(it=>it.estado!=='entregado' && itemDestino(it)===destino));
      const itemCount = tickets.reduce((count,m)=>count+m.pedido.items.filter(it=>it.estado!=='entregado' && itemDestino(it)===destino).length,0);
      return `<section class="kds-destino"><div class="section-h">${ic(destino==='barra'?'receipt':'flame')} ${DESTINO_LABELS[destino]} <span class="kds-count">${itemCount}</span></div>
        <div class="kds-grid">${tickets.length?tickets.map(m=>ticketHtml(m,destino)).join(''):`<div class="empty">Sin ítems para ${DESTINO_LABELS[destino].toLowerCase()}.</div>`}</div></section>`;
    }).join('')}</div>`;
}
function ticketHtml(m,destino){
  const itemsActivos = m.pedido.items.filter(it=>it.estado!=='entregado' && (!destino || itemDestino(it)===destino));
  const oldestTs = itemsActivos.reduce((oldest,it)=>Math.min(oldest,it.enviadoTs), state.clockMs);
  const edad = timeAgoSec(oldestTs);
  const late = itemsActivos.some(it=>it.estado==='preparando') && edad>240;
  return `<div class="ticket ${late?'late':''}">
    <div class="head"><span class="mesa">MESA ${m.numero}</span>
      <span class="pill ${itemEstadoClass(m.pedido.estado)}">${estadoPedidoLabel(m)}</span></div>
    <div class="timer">hace ${fmtSec(edad)}</div>
    <ul>${itemsActivos.map(it=>`<li style="margin-bottom:10px;">
      <div>${escapeHtml(it.nombre)} <span class="item-mod">${DESTINO_LABELS[itemDestino(it)]}</span>${it.notas?` <span class="item-mod">— "${escapeHtml(it.notas)}"</span>`:''}</div>
      <div style="display:flex;align-items:center;gap:6px;margin-top:5px;">
        <span class="pill ${itemEstadoClass(it.estado)}">${PEDIDO_LABELS[it.estado]}</span>
        <span class="item-mod">${itemElapsedLabel(it)}</span>
        ${it.estado==='enviado'?`<button class="btn primary sm" onclick="avanzarItem(${m.numero},${it.id})">Empezar a preparar</button>`:''}
        ${it.estado==='preparando'?`<button class="btn good sm" onclick="avanzarItem(${m.numero},${it.id})">Marcar listo</button>`:''}
        ${it.estado==='listo'?`<span class="handoff-waiting">Esperando retiro de salón</span>`:''}
      </div></li>`).join('')}</ul></div>`;
}

/* ---------------- MOZO ---------------- */
function itemsListosParaEntregar(mozo){
  const listos=[];
  state.mesas.forEach(mesa=>{
    if(mozo && mesa.mozo!==mozo) return;
    if(!mesa.pedido) return;
    mesa.pedido.items.filter(item=>item.estado==='listo').forEach(item=>listos.push({mesa,item}));
  });
  return listos.sort((a,b)=>(a.item.estadoTs.listo||a.item.enviadoTs)-(b.item.estadoTs.listo||b.item.enviadoTs));
}
function colaEntregaHtml(mozo){
  const listos=itemsListosParaEntregar(mozo);
  return `<div class="section-h">${ic('plate')} Listo para llevar (${listos.length})</div>
    <p class="handoff-help">Cocina y Barra ya terminaron estos ítems. Confirmá la entrega recién cuando lleguen a la mesa.</p>
    <div class="handoff-grid">${listos.length?listos.map(({mesa,item})=>`<article class="handoff-card">
      <div class="handoff-top"><strong>Mesa ${mesa.numero}</strong><span class="pill normal">${DESTINO_LABELS[itemDestino(item)]}</span></div>
      <div class="handoff-item">${escapeHtml(item.nombre)}</div>
      ${item.notas?`<div class="handoff-notes">“${escapeHtml(item.notas)}”</div>`:''}
      <div class="handoff-meta">Listo hace ${fmtSec(timeAgoSec((item.estadoTs&&item.estadoTs.listo)||item.enviadoTs))}</div>
      <button class="btn good sm block" onclick="confirmarEntrega(${mesa.numero},${item.id})">Confirmar entrega en mesa</button>
    </article>`).join(''):'<div class="empty">No hay platos ni bebidas esperando retiro.</div>'}</div>`;
}
function viewMozo(){
  const misMesas = state.mesas.filter(m=>m.mozo===state.mozoActivo && (m.ocupada || alertasAbiertas(m).length));
  const misAlertas = todasAlertasAbiertas().filter(x=>x.mesa.mozo===state.mozoActivo);
  return `<h1 class="view-title">MOZO</h1>
    <p class="view-sub">Sos: <select onchange="cambiarMozo(this.value)">${MOZOS.map(m=>`<option ${m===state.mozoActivo?'selected':''}>${m}</option>`).join('')}</select></p>
    <div class="section-h">${ic('bell')} Tus alertas (${misAlertas.length})</div>
    ${misAlertas.length ? misAlertas.map(({mesa,alerta})=>alertRowHtml(mesa,alerta,true)).join('') : '<div class="empty">Sin alertas pendientes.</div>'}
    ${colaEntregaHtml(state.mozoActivo)}
    <div class="section-h">Tus mesas</div>
    <div class="mesa-grid">${misMesas.length ? misMesas.map(m=>mesaTileHtml(m)).join('') : '<div class="empty">Sin mesas activas.</div>'}</div>`;
}
function cambiarMozo(v){ state.mozoActivo=v; render(); }
function cuentaActionsHtml(m){
  if(!m.cuentaPedida) return '';
  if(m.pago && m.pago.estado==='confirmado'){
    return `<div style="margin-top:10px;"><span class="pill libre">Pago demo confirmado · ${money(m.pago.total)}</span>
      <button class="btn good sm block" style="margin-top:8px;" onclick="liberarMesa(${m.numero})">Cerrar y liberar mesa</button></div>`;
  }
  return `<div style="margin-top:10px;"><strong>${money(pedidoTotal(m))}</strong>
    <button class="btn primary sm block" style="margin-top:8px;" onclick="confirmarPagoDemo(${m.numero})">Confirmar pago demo</button></div>`;
}
function confirmarPagoDemo(n){ send({type:'pago_demo_confirmar', mesa:n}); }
function liberarMesa(n){
  if(confirm(`Esto cierra la cuenta demo y libera la Mesa ${n}. ¿Confirmás?`)) send({type:'mesa_liberar', mesa:n});
}
function mesaTileHtml(m){
  const prio = prioridadMax(alertasAbiertas(m));
  return `<div class="mesa-tile ${prio?'alerta-'+prio:''}"><div class="num">Mesa ${m.numero}</div>
    <div class="estado">${m.pedido?estadoPedidoLabel(m):'Sentados'}${m.cuentaPedida?' · cuenta':''}</div>
    ${alertasAbiertas(m).length?`<span class="pill ${prio}">${alertasAbiertas(m).length} alerta(s)</span>`:`<span class="pill ocupada">OK</span>`}
    ${cuentaActionsHtml(m)}</div>`;
}
function alertRowHtml(mesa,a,acciones){
  const edad = timeAgoSec(a.creadoTs);
  return `<div class="alert-row ${a.escalado?'escalado':''}">
    <div><div class="msg">Mesa ${mesa.numero} — ${escapeHtml(a.label)}${a.mensaje?`: "${escapeHtml(a.mensaje)}"`:''}</div>
    <div class="meta"><span class="pill ${a.prioridad}">${a.prioridad.toUpperCase()}</span> hace ${fmtSec(edad)} ${a.escalado?` · ${ic('warning')} ESCALADO`:''} ${a.estado==='atencion'?' · en atención':''}</div></div>
    ${acciones?`<div class="actions">${a.estado==='recibido'?`<button class="btn dark sm" onclick="marcarAtencion(${a.id})">En atención</button>`:''}
      <button class="btn good sm" onclick="resolverAlerta(${a.id})">Resolver</button></div>`:''}</div>`;
}
function marcarAtencion(ai){ send({type:'alerta_atender', alertaId:ai}); }
function resolverAlerta(ai){ send({type:'alerta_resolver', alertaId:ai}); }

/* ---------------- ENCARGADO ---------------- */
function viewEncargado(){
  const todas = todasAlertasAbiertas();
  const escaladas = todas.filter(x=>x.alerta.escalado);
  return `<h1 class="view-title">ENCARGADO</h1><p class="view-sub">Centro de control del salón — ${MESAS_TOTAL} mesas (placeholder, confirmar número real con el local).</p>
    ${escaladas.length ? `<div class="card" style="border-color:var(--critical);margin-bottom:16px;">
      <div style="font-weight:800;color:#ff9797;font-size:13px;margin-bottom:8px;">${ic('warning')} ${escaladas.length} alerta(s) escalada(s)</div>
      ${escaladas.map(({mesa,alerta})=>alertRowHtml(mesa,alerta,true)).join('')}</div>` : ''}
    ${colaEntregaHtml(null)}
    <div class="section-h">Plano de salón</div>
    <div class="mesa-grid">${state.mesas.map(m=>{
      const prio=prioridadMax(alertasAbiertas(m));
      return `<div class="mesa-tile ${prio?'alerta-'+prio:''}"><div class="num">Mesa ${m.numero}</div>
        <div class="estado">${m.ocupada?(m.pedido?estadoPedidoLabel(m):'Sentados'):'Libre'} · ${m.mozo}</div>
        ${alertasAbiertas(m).length?`<span class="pill ${prio}">${alertasAbiertas(m).length} alerta(s)</span>`:`<span class="pill ${m.ocupada?'ocupada':'libre'}">${m.ocupada?'Ocupada':'Libre'}</span>`}
        ${cuentaActionsHtml(m)}</div>`;
    }).join('')}</div>
    <div class="section-h">Cola de alertas</div>
    ${todas.length ? todas.map(({mesa,alerta})=>alertRowHtml(mesa,alerta,true)).join('') : `<div class="empty">${ic('checkring')} No hay alertas abiertas.</div>`}
    <div class="section-h">Administración</div>
    <button class="btn ghost sm" onclick="resetTodo()">${ic('refresh')} Reiniciar todo (afecta a todos los dispositivos conectados)</button>`;
}
function resetTodo(){
  if(confirm('Esto reinicia el estado para TODOS los dispositivos conectados ahora mismo (mesas, pedidos, alertas). ¿Confirmás?')) send({type:'reset_demo'});
}

/* ---------------- DUEÑO ---------------- */
function viewDueno(){
  const mesasOcupadas = state.mesas.filter(m=>m.ocupada).length;
  const alertasN = todasAlertasAbiertas().length;
  const urgentes = todasAlertasAbiertas().filter(x=>x.alerta.prioridad==='urgente').length;
  const analytics = state.analytics || {pagosConfirmados:0,ventasDemo:0,tiempoPagoTotalSec:0,itemsVendidos:0,productos:{},resenas:[]};
  const pedidosActivos = state.mesas.filter(m=>m.pedido).length;
  const itemsEsperandoSalon = itemsListosParaEntregar(null);
  const esperaSalonMax = itemsEsperandoSalon.reduce((max,{item})=>Math.max(max,timeAgoSec((item.estadoTs&&item.estadoTs.listo)||item.enviadoTs)),0);
  const ticketPromedio = analytics.pagosConfirmados ? Math.round(analytics.ventasDemo/analytics.pagosConfirmados) : 0;
  const tiempoPagoPromedio = analytics.pagosConfirmados ? Math.round(analytics.tiempoPagoTotalSec/analytics.pagosConfirmados) : 0;
  const topProductos = Object.values(analytics.productos||{}).sort((a,b)=>b.cantidad-a.cantidad).slice(0,5);
  const resenas = Array.isArray(analytics.resenas) ? analytics.resenas : [];
  const ratingPromedio = resenas.length ? (resenas.reduce((sum,r)=>sum+r.puntuacion,0)/resenas.length).toFixed(1) : '—';
  const resenasCriticas = resenas.filter(r=>r.puntuacion<=3).length;
  const resenasRecientes = [...resenas].reverse().slice(0,6);
  const productosPendientes = todosLosProductos().filter(p=>precioBase(p)===null).length;
  return `<h1 class="view-title">DUEÑO</h1>
    <p class="view-sub">Panel de negocio de esta sesión. ${productosPendientes} productos todavía sin precio confirmado.</p>
    <div class="mock-banner">${ic('clipboard')} Los cobros son confirmaciones de demostración acumuladas por este sistema. No hay caja, POS ni dinero real conectado.</div>
    <div class="grid cols-4">
      ${statTile('Cobrado demo', money(analytics.ventasDemo), analytics.pagosConfirmados+' cuenta(s)', null)}
      ${statTile('Ticket promedio', money(ticketPromedio), 'cuentas confirmadas', null)}
      ${statTile('Tiempo para pagar', fmtSec(tiempoPagoPromedio), 'promedio desde solicitud', null)}
      ${statTile('Ítems cobrados', String(analytics.itemsVendidos), 'en esta sesión', null)}
    </div>
    <div class="grid cols-4" style="margin-top:14px;">
      ${statTile('Mesas ocupadas', mesasOcupadas+' / '+MESAS_TOTAL, null, null)}
      ${statTile('Pedidos activos', String(pedidosActivos), 'ahora', null)}
      ${statTile('Esperando salón', String(itemsEsperandoSalon.length), itemsEsperandoSalon.length?'máximo '+fmtSec(esperaSalonMax):'sin retiros pendientes', esperaSalonMax>120?'downAlert':null)}
      ${statTile('Alertas activas', String(alertasN), urgentes>0?urgentes+' urgente(s)':'todo tranquilo', urgentes>0?'downAlert':null)}
      ${statTile('Experiencia', ratingPromedio, resenas.length?resenas.length+' opinión(es) · '+resenasCriticas+' a recuperar':'sin opiniones todavía', resenasCriticas?'downAlert':null)}
    </div>
    <div class="section-h">Más vendidos de la sesión</div>
    <div class="grid cols-3">
      ${topProductos.length ? topProductos.map((p,index)=>`<div class="insight"><span>${index+1}. ${escapeHtml(p.nombre)}</span><b>${p.cantidad} · ${money(p.total)}</b></div>`).join('') : '<div class="empty">Los productos aparecerán cuando se confirme el primer pago demo.</div>'}
    </div>
    <div class="section-h">Opiniones post-pago</div>
    <div class="grid cols-3">
      ${resenasRecientes.length ? resenasRecientes.map(r=>`<div class="insight review-insight"><span>Mesa ${r.mesa} · ${r.puntuacion}/5 · hace ${fmtSec(timeAgoSec(r.creadoTs))}</span><b>${r.comentario?escapeHtml(r.comentario):'Sin comentario'}</b></div>`).join('') : '<div class="empty">Las opiniones aparecerán después de un pago demo confirmado.</div>'}
    </div>
    <div class="section-h">Platos con 3D real activado</div>
    <div class="grid cols-3">
      ${[...CANDIDATOS_3D].map(id=>{ const p=findProducto(id); return `<div class="insight"><span>★ ${p.nombre}</span></div>`; }).join('')}
    </div>`;
}
function statTile(label,value,delta,deltaClass){
  return `<div class="stat-tile"><div class="label">${label}</div>
    <div class="value ${deltaClass==='downAlert'?'alert':''}">${value}</div>
    ${delta?`<div class="delta ${deltaClass==='up'?'up':deltaClass==='downAlert'?'down':''}">${delta}</div>`:''}</div>`;
}
