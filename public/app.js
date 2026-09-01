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
let STAFF_ROLE = null;
let STAFF_ALLOWED_VIEWS = [];
let MESA_TOKEN = null;

function emptyAnalytics(){
  return {
    pagosConfirmados:0,ventasDemo:0,tiempoPagoTotalSec:0,itemsVendidos:0,
    itemsListos:0,itemsEntregados:0,tiempoPreparacionTotalSec:0,tiempoPaseTotalSec:0,
    destinos:{cocina:{itemsListos:0,tiempoPreparacionTotalSec:0},barra:{itemsListos:0,tiempoPreparacionTotalSec:0}},
    productos:{},resenas:[],crmContactos:[]
  };
}

let state = {
  clockMs:0, mesas:[], analytics:emptyAnalytics(),
  // ui local, no viene del servidor:
  role:null, clienteMesa:null, clienteCat:null, clienteFiltroSinTacc:false,
  clienteCart:[], clienteExpand:null, clienteHelpOpen:false, clienteSplashDismissed:false,
  clienteAsistenteOpen:false, clientePreferencia:null, clienteAsistenteConsulta:'', clienteAsistenteRespuesta:null,
  clienteAsistenteAgregado:null, clienteResenaError:'', clienteResenaEnviando:false,
  clienteRepetirAviso:'',
  clienteResenaDraft:{puntuacion:null,comentario:'',crmConsentimiento:false,crmCanal:'whatsapp',crmContacto:'',crmNombre:''},
  mozoActivo:MOZOS[0], modal:null, mesaLinks:null, mesaLinksLoading:false, mesaLinksError:'', presentacionCargada:false,
  demoPasoActual:1, demoPasosVistos:new Set(),
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
    state.analytics = msg.state.analytics || emptyAnalytics();
    state.presentacionCargada = msg.state.presentacionCargada === true;
    if(msg.role) STAFF_ROLE = msg.role;
    if(Array.isArray(msg.allowedViews)) STAFF_ALLOWED_VIEWS = msg.allowedViews;
    detectarNuevasAlertas();
    if(onFirstSnapshot){ onFirstSnapshot(); onFirstSnapshot=null; }
    if(!clienteEditandoFormulario()) render();
  }
  return onFirstSnapshot;
}
function clienteEditandoFormulario(){
  const active = document.activeElement;
  return state.role==='cliente' && active && typeof active.closest==='function' && Boolean(active.closest('.review-card, .ai-assistant'));
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
function setStaffSession(token,role,allowedViews){
  STAFF_TOKEN = token;
  STAFF_ROLE = role;
  STAFF_ALLOWED_VIEWS = Array.isArray(allowedViews) ? allowedViews : [role];
}
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
  if(hayNueva && STAFF_ROLE!=='dueno' && state.role && state.role!=='cliente') alertaFisica();
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
  else if(state.role==='qrs') app.innerHTML = viewMesaQrs();
  if(state.presentacionCargada && state.role!=='encargado' && state.role!=='cliente' && STAFF_ALLOWED_VIEWS.includes('encargado')){
    app.insertAdjacentHTML('afterbegin', demoDockHtml());
  }
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
    {id:'qrs',label:'QR / Mesas',icon:'lock'},
  ].filter(role=>STAFF_ALLOWED_VIEWS.includes(role.id));
  const n = todasAlertasAbiertas().length;
  nav.innerHTML = roles.map(r=>`<button class="${state.role===r.id?'active':''}" onclick="setRole('${r.id}')">
    <span>${ic(r.icon)}</span><span>${r.label}</span><span class="dot ${n>0?'show':''}"></span></button>`).join('');
}
function setRole(id){
  if(!STAFF_ALLOWED_VIEWS.includes(id)) return;
  state.role=id;
  render();
  if(id==='qrs' && !state.mesaLinks) cargarMesaLinks();
}

async function cargarMesaLinks(){
  if(state.mesaLinksLoading) return;
  state.mesaLinksLoading=true;
  state.mesaLinksError='';
  try{
    const response = await fetch('/api/mesa-links', {headers:{Authorization:'Bearer ' + STAFF_TOKEN}});
    const payload = await response.json();
    if(!response.ok) throw new Error(payload.error || 'No se pudieron generar los accesos.');
    state.mesaLinks=payload;
  }catch(error){
    state.mesaLinksError=error.message || 'No se pudieron generar los accesos.';
  }
  state.mesaLinksLoading=false;
  if(state.role==='qrs' || state.role==='encargado') render();
}
function mesaAccessUrl(path){ return location.origin + path; }
function mesaPreviewUrl(path){
  const hashAt=path.indexOf('#');
  const base=hashAt===-1?path:path.slice(0,hashAt);
  const hash=hashAt===-1?'':path.slice(hashAt);
  return mesaAccessUrl(`${base}${base.includes('?')?'&':'?'}preview=1${hash}`);
}
function mesaLink(numero){
  return state.mesaLinks && state.mesaLinks.mesas.find(mesa=>mesa.numero===numero);
}
function mesaDemoLinkHtml(numero,label,kind,icon,paso){
  const mesa=mesaLink(numero);
  if(!mesa) return `<button class="btn ${kind} sm" disabled>${ic(icon)} Preparando acceso…</button>`;
  return `<button class="btn ${kind} sm" onclick="abrirVistaMesaDemo(${numero}${paso?','+paso:''})">${ic(icon)} ${escapeHtml(label)}</button>`;
}
function abrirVistaMesaDemo(numero,paso){
  const mesa=mesaLink(numero);
  if(!mesa) return;
  if(paso) marcarPasoDemo(paso,false);
  state.modal={type:'mesa-preview',numero,path:mesa.path};
  render();
}
async function copiarMesaLink(numero,path){
  const value=mesaAccessUrl(path);
  try{
    await navigator.clipboard.writeText(value);
    const button=document.querySelector(`[data-copy-mesa="${numero}"]`);
    if(button){ button.textContent='Copiado'; setTimeout(()=>{ button.textContent='Copiar enlace'; },1800); }
  }catch(e){ window.prompt('Copiá este enlace seguro:', value); }
}
function montarMesaQrs(){
  if(state.role!=='qrs' || !state.mesaLinks || typeof qrcode!=='function') return;
  state.mesaLinks.mesas.forEach(mesa=>{
    const target=document.getElementById('mesaQr'+mesa.numero);
    if(!target || target.dataset.rendered==='true') return;
    const code=qrcode(0,'M');
    code.addData(mesaAccessUrl(mesa.path));
    code.make();
    target.innerHTML=code.createSvgTag({
      cellSize:3,
      margin:4,
      alt:{text:`QR de Mesa ${mesa.numero}`,id:`mesa-qr-description-${mesa.numero}`},
    });
    target.dataset.rendered='true';
  });
}
function imprimirMesaQrs(){
  if(!state.mesaLinks || !state.mesaLinks.secure) return;
  montarMesaQrs();
  document.body.classList.add('printing-qrs');
  window.print();
}
window.addEventListener('afterprint',()=>document.body.classList.remove('printing-qrs'));
function viewMesaQrs(){
  if(!state.mesaLinks && !state.mesaLinksError) return `<h1 class="view-title">QR / MESAS</h1><div class="empty">Generando accesos de mesa…</div>`;
  if(state.mesaLinksError) return `<h1 class="view-title">QR / MESAS</h1><div class="card qr-error">${escapeHtml(state.mesaLinksError)}</div><button class="btn primary sm" onclick="cargarMesaLinks()">Reintentar</button>`;
  const links=state.mesaLinks;
  setTimeout(montarMesaQrs,0);
  return `<section class="qr-screen"><div class="qr-print-only qr-print-header"><strong>RABIETA</strong><span>CARTA Y PEDIDOS · ACCESOS POR MESA</span></div>
    <h1 class="view-title">QR / MESAS</h1>
    <p class="view-sub">Accesos únicos para imprimir o probar cada mesa. Solo el panel autenticado puede verlos.</p>
    <div class="${links.secure?'secure-banner':'mock-banner'}">${ic(links.secure?'lock':'warning')} ${links.secure?'Identidad segura activa: cada QR queda vinculado a una sola mesa.':'Modo compatible: activá la identidad segura de mesas antes de imprimir los QR definitivos.'}</div>
    <div class="qr-toolbar"><div><strong>Señalética lista para las ${links.mesas.length} mesas</strong><span>Genera una hoja A4 limpia, sin controles internos, para imprimir o guardar como PDF.</span></div><button class="btn primary" ${links.secure?'onclick="imprimirMesaQrs()"':'disabled'}>${ic('receipt')} ${links.secure?'Imprimir todos los QR':'Impresión bloqueada sin identidad segura'}</button></div>
    <div class="qr-grid">${links.mesas.map(mesa=>`<article class="qr-card">
      <div class="qr-title"><strong>Mesa ${mesa.numero}</strong><span>${escapeHtml(mesa.mozo)}</span></div><div class="qr-print-only qr-instruction">Escaneá para ver la carta, pedir y llamar al salón.</div>
      <div class="qr-code" id="mesaQr${mesa.numero}"><span>Generando QR…</span></div>
      <div class="qr-state"><span class="pill ${mesa.ocupada?'ocupada':'libre'}">${mesa.ocupada?'Ocupada':'Libre'}</span></div>
      <div class="qr-actions"><button class="btn primary sm" data-copy-mesa="${mesa.numero}" onclick="copiarMesaLink(${mesa.numero},'${mesa.path}')">Copiar enlace</button>
      <a class="btn ghost sm" href="${mesa.path}" target="_blank" rel="noopener">Abrir mesa</a></div>
    </article>`).join('')}</div></section>`;
}

/* ================= MODAL 3D — REAL, no mock ================= */
function modeloParaPlato(id){
  const lista = [...CANDIDATOS_3D];
  const idx = lista.indexOf(id);
  return MODELOS_3D_GENERICOS[(idx<0?0:idx) % MODELOS_3D_GENERICOS.length];
}
function renderModal(){
  const root = document.getElementById('modalRoot');
  if(!root) return;
  if(!state.modal){ root.innerHTML=''; delete root.dataset.modalKey; return; }
  const modalKey=`${state.modal.type}:${state.modal.id||state.modal.numero||''}${state.modal.type==='cart'?':'+state.clienteCart.length:''}`;
  if(root.dataset.modalKey===modalKey && root.firstElementChild) return;
  root.dataset.modalKey=modalKey;
  if(state.modal.type==='mesa-preview'){
    const demoActions = state.presentacionCargada && STAFF_ALLOWED_VIEWS.includes('encargado')
      ? (state.modal.numero===1
        ? `<div class="mesa-preview-next"><span>La vista cambia en vivo cuando Cocina y Barra avanzan el pedido.</span><button class="btn primary sm" onclick="closeModal();irPasoDemo('cocina',null,2)">${ic('flame')} Seguir a Cocina + Barra</button></div>`
        : state.modal.numero===3
          ? `<div class="mesa-preview-next"><span>La cuenta conserva el pedido completo y muestra el total confirmado.</span><button class="btn good sm" onclick="closeModal();irPasoDemo('dueno',null,5)">${ic('chart')} Ver resultado final</button></div>`
          : '')
      : '';
    root.innerHTML = `<div class="modal-bg mesa-preview-bg" onclick="closeModal(event)">
      <div class="modal mesa-preview-modal" onclick="event.stopPropagation()">
        <div class="mesa-preview-head"><div><span class="presentation-kicker">Vista cliente en vivo</span><strong>Mesa ${state.modal.numero}</strong></div><button class="btn ghost sm" onclick="closeModal()">Cerrar</button></div>
        <iframe src="${escapeHtml(mesaPreviewUrl(state.modal.path))}" title="Vista cliente de Mesa ${state.modal.numero}"></iframe>${demoActions}
      </div></div>`;
  } else if(state.modal.type==='3d'){
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
          <span class="badge-preview">Prototipo técnico · modelo genérico, no representa este plato</span>
          <h3>${escapeHtml(state.modal.nombre)}</h3>
          <p>Activá la cámara, enfocá tu mesa, y el plato aparece ahí arriba en tamaño real — como si ya te lo hubieran servido. También podés arrastrar acá abajo para girarlo sin cámara.</p>
          <button class="btn callout block" onclick="activarAR()">${ic('cube')} Ver en mi mesa con la cámara</button>
          <div id="arStatus" class="ar-status" aria-live="polite">Cargando la experiencia 3D…</div>
          <p class="ar-fineprint">Esta prueba valida interacción y cámara, no la apariencia del plato. Para publicar <b>${state.modal.nombre}</b> faltan su modelo GLB real, su USDZ real y una medida de escala verificada. El modelo visible ahora es ${modelo.nombre}.</p>
          <button class="btn dark block" onclick="closeModal()">Cerrar</button>
        </div>
      </div></div>`;
  } else if(state.modal.type==='cart'){
    const total=state.clienteCart.reduce((sum,item)=>sum+(item.precio||0),0);
    const pendientes=state.clienteCart.filter(item=>item.precio===null).length;
    root.innerHTML = `<div class="modal-bg" onclick="closeModal(event)"><div class="modal cart-modal" onclick="event.stopPropagation()">
      <div class="cart-modal-head"><div><span class="presentation-kicker">Antes de enviar</span><h3>Revisá tu carrito</h3></div><button class="btn ghost sm" onclick="closeModal()">Seguir eligiendo</button></div>
      <ul class="cart-review-list">${state.clienteCart.map((item,index)=>`<li><div><strong>${escapeHtml(item.nombre)}</strong>${item.notas?`<span>“${escapeHtml(item.notas)}”</span>`:''}</div><b>${money(item.precio)}</b><button class="cart-remove" aria-label="Quitar ${escapeHtml(item.nombre)}" onclick="quitarDelCarrito(${index})">×</button></li>`).join('')}</ul>
      <div class="cart-review-total"><span>${state.clienteCart.length} ítem(s)${pendientes?' · '+pendientes+' a confirmar':''}</span><strong>${money(total)}${pendientes?' + pendientes':''}</strong></div>
      <div class="cart-modal-actions"><button class="btn ghost" onclick="vaciarCarrito()">Vaciar</button><button class="btn primary" onclick="enviarPedido()">Enviar ${findMesa(state.clienteMesa)&&findMesa(state.clienteMesa).pedido?'otra ronda':'pedido'} a cocina →</button></div>
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
      <div class="txt"><strong>Prototipo 3D/AR en desarrollo</strong><span>Probá la interacción técnica; los modelos reales de estos ${platos.length} platos todavía faltan</span></div></div>
    <div class="tiles3d">
      ${platos.map(p=>`<button onclick="openModal3d('${p.id}','${p.nombre.replace(/'/g,"\\'")}')">
        ${p.imagen ? `<img class="tile3d-img" src="${p.imagen}" alt="${p.nombre}">` : `<span class="em">${ic('plate')}</span>`}
        <span class="nm">${p.nombre}</span><span class="cta">Probar demo 3D</span></button>`).join('')}
    </div></div>`;
}

function asistenteCartaHtml(bloqueado){
  if(!state.clienteAsistenteOpen){
    return `<div class="ai-assistant compact"><div><span class="ai-badge">Recomendación inteligente · demo local</span>
      <strong>¿No sabés qué pedir?</strong><p>Te orientamos con la carta real de Rabieta.</p></div>
      <button class="btn primary sm" onclick="toggleAsistente()">Ayudame a elegir</button></div>`;
  }
  const respuesta = state.clienteAsistenteRespuesta;
  return `<div class="ai-assistant">
    <div class="ai-head"><div><span class="ai-badge">Asistente Rabieta · local</span><strong>¿Qué te pinta hoy?</strong></div>
      <button class="btn ghost sm" onclick="toggleAsistente()">Cerrar</button></div>
    <form class="ai-query" onsubmit="consultarAsistente(event)">
      <label for="ai-query-input">Escribí como hablarías con el mozo</label>
      <div><input id="ai-query-input" type="text" maxlength="120" autocomplete="off" placeholder="Ej: algo para compartir por menos de $4.000" value="${escapeHtml(state.clienteAsistenteConsulta)}" oninput="actualizarConsultaAsistente(this.value)">
      <button class="btn primary sm" type="submit">Recomendar</button></div>
    </form>
    <div class="ai-options">${ASISTENTE_OPCIONES.map(op=>`<button class="${state.clientePreferencia===op.id?'active':''}" onclick="setPreferenciaAsistente('${op.id}')">${op.label}</button>`).join('')}</div>
    ${respuesta ? `<p class="ai-message">${escapeHtml(respuesta.message)}</p>
      ${respuesta.items.length ? `<div class="ai-results">${respuesta.items.map(({product:p,reason})=>`<article>
        <button class="ai-result-main" onclick="abrirRecomendacion('${p.id}')"><span><strong>${escapeHtml(p.nombre)}</strong><small>${escapeHtml(reason)}</small></span><b>${money(precioBase(p))}</b></button>
        <button class="ai-add" ${bloqueado?'disabled':''} onclick="agregarRecomendacion('${p.id}')">${state.clienteAsistenteAgregado===p.id?'Sumado ✓':(p.variantes||p.opciones?'Elegir':'Sumar')}</button>
      </article>`).join('')}</div>` : ''}
      ${respuesta.warning ? `<p class="ai-warning">${ic('warning')} ${escapeHtml(respuesta.warning)}</p>` : ''}` : '<p class="ai-empty">Probá “una pizza barata”, “algo liviano” o “Sin TACC hasta $3.000”.</p>'}
    <p class="ai-fineprint">Funciona localmente con reglas sobre la carta; no envía datos ni usa un servicio externo.</p>
  </div>`;
}
function toggleAsistente(){ state.clienteAsistenteOpen=!state.clienteAsistenteOpen; render(); }
function actualizarConsultaAsistente(value){ state.clienteAsistenteConsulta=value; }
function consultarAsistente(event){
  if(event) event.preventDefault();
  state.clientePreferencia=null; state.clienteAsistenteAgregado=null;
  state.clienteAsistenteRespuesta=window.RabietaRecommender.recommend(MENU_DATA,state.clienteAsistenteConsulta);
  render();
}
function setPreferenciaAsistente(perfil){
  const option = ASISTENTE_OPCIONES.find(op=>op.id===perfil);
  if(!option) return;
  state.clientePreferencia=perfil; state.clienteAsistenteConsulta=option.label;
  state.clienteAsistenteAgregado=null;
  state.clienteAsistenteRespuesta=window.RabietaRecommender.recommend(MENU_DATA,option.label);
  render();
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
      <p class="splash-sub">Mirá la foto real del plato y probá cómo funcionará la experiencia 3D, o pasá directo a la carta.</p>
    </div>
    <div class="splash-arrow">
      <svg viewBox="0 0 56 64"><path d="M28 4 C 16 18, 40 30, 26 44"/><path d="M16 40 L 26 52 L 36 41"/></svg>
    </div>
    <div class="splash-stage">
      ${destacado.imagen ? `<img class="splash-stage-img" src="${destacado.imagen}" alt="${destacado.nombre}">` : ''}
      <div class="splash-stage-scrim"></div>
      <div class="splash-stage-tag">Plato destacado de hoy</div>
      <div class="splash-stage-name">${destacado.nombre}</div>
      <button class="btn callout splash-3d-btn" onclick="openModal3d('${destacado.id}','${destacado.nombre.replace(/'/g,"\\'")}')">${ic('cube')} Probar demo técnica 3D</button>
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
    const variasRondas = mesa.pedido.items.some(it=>(it.ronda||1)>1);
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
      <ul class="customer-order-items">
        ${mesa.pedido.items.map(it=>`<li><div>${variasRondas?`<span class="item-round">Ronda ${it.ronda||1}</span>`:''}${escapeHtml(it.nombre)}${it.notas?` — "${escapeHtml(it.notas)}"`:''}</div>
          <div class="customer-order-meta"><span class="pill ${itemEstadoClass(it.estado)}">${PEDIDO_LABELS[it.estado]}</span><span>${itemElapsedLabel(it)}</span></div></li>`).join('')}
      </ul>${!mesa.cuentaPedida?`<div class="repeat-order-row"><button class="btn ghost sm" onclick="repetirUltimaRonda()">${ic('refresh')} Agregar última ronda al carrito</button><span aria-live="polite">${escapeHtml(state.clienteRepetirAviso)}</span></div>`:''}${pagoHtml}</div>`;
  }
  const openAlerts = alertasAbiertas(mesa);
  const resolvedAlerts = mesa.alertas.filter(a=>a.estado==='resuelto').slice(-2).reverse();
  const alertHtml = openAlerts.length || resolvedAlerts.length ? `<div class="card" style="border-color:${openAlerts.length?'var(--warning)':'var(--line-strong)'};">
    <div style="font-weight:800;font-size:13px;margin-bottom:6px;">Tus solicitudes</div>
    ${openAlerts.map(a=>`<div style="display:flex;justify-content:space-between;align-items:center;font-size:13px;margin-bottom:6px;">
      <span>${escapeHtml(a.label)}${a.mensaje?': "'+escapeHtml(a.mensaje)+'"':''}</span>
      <span class="pill ${a.estado==='atencion'?'importante':a.prioridad}">${a.estado==='atencion'?'En atención':'Enviado'}</span></div>`).join('')}
    ${resolvedAlerts.map(a=>`<div class="resolved-request"><span>${escapeHtml(a.label)}</span><span class="pill libre">${ic('checkring')} Resuelto</span></div>`).join('')}
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
    ${asistenteCartaHtml(mesa.cuentaPedida)}
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
      <button class="btn primary" onclick="abrirCarrito()">Revisar y ${mesa.pedido?'enviar otra ronda':'enviar pedido'} →</button></div>` : ''}
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
    ${esDestacado?`<button class="btn-3d" onclick="openModal3d('${p.id}','${p.nombre.replace(/'/g,"\\'")}')">${ic('cube')} Probar demo 3D</button>`:''}
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
  state.clienteRepetirAviso='';
  state.clienteExpand = null;
  render();
}
function abrirCarrito(){ if(state.clienteCart.length){ state.modal={type:'cart'}; render(); } }
function quitarDelCarrito(index){
  if(index<0 || index>=state.clienteCart.length) return;
  state.clienteCart.splice(index,1);
  if(!state.clienteCart.length) state.modal=null;
  render();
}
function vaciarCarrito(){ state.clienteCart=[]; state.modal=null; state.clienteRepetirAviso=''; render(); }
function repetirUltimaRonda(){
  const mesa=findMesa(state.clienteMesa);
  if(!mesa || !mesa.pedido || mesa.cuentaPedida) return;
  const ultima=Math.max(...mesa.pedido.items.map(item=>item.ronda||1));
  const items=mesa.pedido.items.filter(item=>(item.ronda||1)===ultima);
  let agregados=0, omitidos=0;
  items.forEach(item=>{
    const p=findProducto(item.productoId);
    if(!p){ omitidos++; return; }
    const variante=p.variantes && p.variantes.find(candidate=>candidate.nombre===item.variante);
    const opcion=p.opciones && p.opciones.find(candidate=>candidate===item.opcion);
    if((p.variantes && !variante) || (p.opciones && !opcion)){ omitidos++; return; }
    const precio=variante?variante.precio:precioBase(p);
    if(!Number.isFinite(precio)){ omitidos++; return; }
    const nombre=p.nombre+(variante?' — '+variante.nombre:'')+(opcion?' ('+opcion+')':'');
    state.clienteCart.push({
      productoId:p.id, variante:variante?variante.nombre:null, opcion:opcion||null,
      observacion:item.notas||'', nombre, precio, notas:item.notas||'',
    });
    agregados++;
  });
  state.clienteRepetirAviso=agregados ? `${agregados} ítem(s) agregados${omitidos?' · '+omitidos+' requieren elegir de nuevo':''}` : 'Esta ronda requiere elegir sus opciones de nuevo.';
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
  state.clienteRepetirAviso='';
  state.modal=null;
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
  const draft = state.clienteResenaDraft;
  if(mesa.resenaEnviada) return `<div class="review-card review-thanks">${ic('checkring')} Gracias. Tu opinión ya llegó al equipo de Rabieta.</div>`;
  return `<div class="review-card">
    <div class="review-title">¿Cómo estuvo tu experiencia?</div>
    <div class="review-sub">Tu respuesta queda en este panel demo y ayuda a detectar qué mejorar.</div>
    <div class="rating-pick" role="radiogroup" aria-label="Puntuación del 1 al 5">
      ${[1,2,3,4,5].map(n=>`<label><input type="radio" name="puntuacion-resena" value="${n}" ${draft.puntuacion===n?'checked':''} onchange="updateResenaDraft('puntuacion',${n})"><span>${n}</span></label>`).join('')}
    </div>
    <textarea class="nota review-comment" id="comentarioResena" maxlength="500" placeholder="Contanos qué te gustó o qué mejorarías (opcional)" oninput="updateResenaDraft('comentario',this.value)">${escapeHtml(draft.comentario)}</textarea>
    <label class="crm-consent">
      <input type="checkbox" id="crmConsentimiento" ${draft.crmConsentimiento?'checked':''} onchange="toggleCrmFields(this.checked)">
      <span>Quiero recibir novedades y beneficios de Rabieta. Autorizo usar mi contacto solo para ese fin.</span>
    </label>
    <div class="crm-fields" id="crmFields" aria-hidden="${draft.crmConsentimiento?'false':'true'}">
      <input class="nota" id="crmNombre" maxlength="80" placeholder="Tu nombre (opcional)" value="${escapeHtml(draft.crmNombre)}" ${draft.crmConsentimiento?'':'disabled'} oninput="updateResenaDraft('crmNombre',this.value)">
      <select class="nota" id="crmCanal" ${draft.crmConsentimiento?'':'disabled'} onchange="updateCrmCanal(this.value)">
        <option value="whatsapp" ${draft.crmCanal==='whatsapp'?'selected':''}>WhatsApp</option>
        <option value="email" ${draft.crmCanal==='email'?'selected':''}>Email</option>
      </select>
      <input class="nota" id="crmContacto" maxlength="160" inputmode="${draft.crmCanal==='email'?'email':'tel'}" autocomplete="${draft.crmCanal==='email'?'email':'tel'}" placeholder="${draft.crmCanal==='email'?'vos@ejemplo.com':'Ej. +54 11 5555 5555'}" value="${escapeHtml(draft.crmContacto)}" ${draft.crmConsentimiento?'':'disabled'} oninput="updateResenaDraft('crmContacto',this.value)">
      <div class="crm-note">Demo local: no se envían mensajes ni se conecta un proveedor externo.</div>
    </div>
    ${state.clienteResenaError?`<div class="review-error">${escapeHtml(state.clienteResenaError)}</div>`:''}
    <button class="btn primary sm" ${state.clienteResenaEnviando?'disabled':''} onclick="enviarResena()">${state.clienteResenaEnviando?'Enviando…':'Enviar opinión'}</button>
  </div>`;
}
function agregarRecomendacion(id){
  const p = findProducto(id);
  if(!p) return;
  if(p.variantes || p.opciones){ abrirRecomendacion(id); return; }
  const precio = precioBase(p);
  if(!Number.isFinite(precio)) return;
  state.clienteCart.push({productoId:id,variante:null,opcion:null,observacion:'',nombre:p.nombre,precio,notas:''});
  state.clienteAsistenteAgregado=id;
  render();
}
function updateResenaDraft(field,value){ state.clienteResenaDraft[field]=value; }
function toggleCrmFields(enabled){
  updateResenaDraft('crmConsentimiento',enabled);
  const fields = document.getElementById('crmFields');
  if(!fields) return;
  fields.setAttribute('aria-hidden',enabled?'false':'true');
  fields.querySelectorAll('input,select').forEach(control=>{ control.disabled=!enabled; });
  if(enabled) updateCrmCanal(state.clienteResenaDraft.crmCanal);
}
function updateCrmCanal(value){
  updateResenaDraft('crmCanal',value);
  const contacto = document.getElementById('crmContacto');
  if(!contacto) return;
  const email = value==='email';
  contacto.placeholder = email?'vos@ejemplo.com':'Ej. +54 11 5555 5555';
  contacto.inputMode = email?'email':'tel';
  contacto.autocomplete = email?'email':'tel';
}
async function enviarResena(){
  const draft = state.clienteResenaDraft;
  if(!draft.puntuacion){ state.clienteResenaError='Elegí una puntuación del 1 al 5.'; render(); return; }
  const {comentario,crmConsentimiento,crmCanal,crmContacto,crmNombre} = draft;
  state.clienteResenaError=''; state.clienteResenaEnviando=true; render();
  const response = await send({
    type:'resena_enviar', mesa:state.clienteMesa, puntuacion:draft.puntuacion, comentario,
    crmConsentimiento, crmCanal, crmContacto, crmNombre,
  });
  state.clienteResenaEnviando=false;
  if(!response || !response.ok){
    let payload={}; try{ payload=await response.json(); }catch(e){}
    state.clienteResenaError=payload.error || 'No pudimos enviar tu opinión. Probá de nuevo.';
    render();
  }else{
    const mesa = state.mesas.find(m=>m.numero===state.clienteMesa);
    if(mesa && mesa.resenaEnviada){
      state.clienteResenaDraft={puntuacion:null,comentario:'',crmConsentimiento:false,crmCanal:'whatsapp',crmContacto:'',crmNombre:''};
    }
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
  const demoTarget = state.presentacionCargada && STAFF_ALLOWED_VIEWS.includes('encargado') && m.numero===1;
  return `<div class="ticket ${late?'late':''}${demoTarget?' demo-target':''}">
    <div class="head"><span class="mesa">MESA ${m.numero}</span>
      <span class="pill ${itemEstadoClass(m.pedido.estado)}">${estadoPedidoLabel(m)}</span></div>
    ${demoTarget?`<span class="demo-target-badge">Paso 2 · tocá esta tarjeta</span>`:''}
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
    <div class="handoff-grid">${listos.length?listos.map(({mesa,item})=>`<article class="handoff-card ${state.presentacionCargada && STAFF_ALLOWED_VIEWS.includes('encargado') && mesa.numero===1?'demo-target':''}">
      <div class="handoff-top"><strong>Mesa ${mesa.numero}</strong><span class="pill normal">${DESTINO_LABELS[itemDestino(item)]}</span></div>
      ${state.presentacionCargada && STAFF_ALLOWED_VIEWS.includes('encargado') && mesa.numero===1?'<span class="demo-target-badge">Paso 3 · entregá este ítem</span>':''}
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
  const demoTarget = state.presentacionCargada && STAFF_ALLOWED_VIEWS.includes('encargado') && mesa.numero===4 && acciones;
  return `<div class="alert-row ${a.escalado?'escalado':''}${demoTarget?' demo-target':''}">
    <div><div class="msg">Mesa ${mesa.numero} — ${escapeHtml(a.label)}${a.mensaje?`: "${escapeHtml(a.mensaje)}"`:''}</div>
    ${demoTarget?'<span class="demo-target-badge">Paso 3 · resolvé este reclamo</span>':''}<div class="meta"><span class="pill ${a.prioridad}">${a.prioridad.toUpperCase()}</span> hace ${fmtSec(edad)} ${a.escalado?` · ${ic('warning')} ESCALADO`:''} ${a.estado==='atencion'?' · en atención':''}</div></div>
    ${acciones?`<div class="actions">${a.estado==='recibido'?`<button class="btn dark sm" onclick="marcarAtencion(${a.id})">En atención</button>`:''}
      <button class="btn good sm" onclick="resolverAlerta(${a.id})">Resolver</button></div>`:''}</div>`;
}
function marcarAtencion(ai){ send({type:'alerta_atender', alertaId:ai}); }
function resolverAlerta(ai){ send({type:'alerta_resolver', alertaId:ai}); }

/* ---------------- ENCARGADO ---------------- */
function viewEncargado(){
  const todas = todasAlertasAbiertas();
  const escaladas = todas.filter(x=>x.alerta.escalado);
  if(!state.mesaLinks && !state.mesaLinksLoading && !state.mesaLinksError) setTimeout(cargarMesaLinks,0);
  return `<h1 class="view-title">ENCARGADO</h1><p class="view-sub">Centro de control del salón — ${MESAS_TOTAL} mesas (placeholder, confirmar número real con el local).</p>
    ${state.presentacionCargada?presentacionGuideHtml():`<div class="presentation-launch card">
      <div><span class="presentation-kicker">Demo de punta a punta</span><strong>Prepará la presentación en un toque</strong><p>Carga mesas sintéticas en distintas etapas, una alerta, una cuenta, analytics y CRM demo.</p></div>
      <button class="btn primary" onclick="cargarEscenarioDemo()">${ic('clipboard')} Cargar y empezar</button>
    </div>`}
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
    <button class="btn primary sm" onclick="cargarEscenarioDemo()">${ic('clipboard')} Volver a cargar escenario de presentación</button>
    <button class="btn ghost sm" onclick="resetTodo()">${ic('refresh')} Reiniciar todo (afecta a todos los dispositivos conectados)</button>`;
}
function demoStepStatus(numero){
  const mesa=findMesa(numero);
  if(!mesa) return '';
  if(numero===1){
    const cocina=mesa.pedido && mesa.pedido.items.find(item=>itemDestino(item)==='cocina');
    const barra=mesa.pedido && mesa.pedido.items.find(item=>itemDestino(item)==='barra');
    return cocina && barra ? `${PEDIDO_LABELS[cocina.estado]} en Cocina · ${PEDIDO_LABELS[barra.estado]} en Barra` : 'Pedido mixto listo para mostrar';
  }
  if(numero===3) return mesa.cuentaPedida ? `Cuenta solicitada · ${money(pedidoTotal(mesa))}` : 'Cuenta lista para solicitar';
  if(numero===4) return alertasAbiertas(mesa).length ? 'Reclamo urgente esperando atención' : 'Reclamo resuelto';
  if(numero===5) return mesa.pago ? `Pago demo confirmado · reseña ${state.analytics.resenas[0] ? state.analytics.resenas[0].puntuacion+'/5' : 'lista'}` : 'Cierre demo listo';
  return estadoPedidoLabel(mesa);
}
const DEMO_PASOS = {
  1:{titulo:'Cliente · Mesa 1'}, 2:{titulo:'Cocina + Barra'}, 3:{titulo:'Salón · Sofía'},
  4:{titulo:'Cliente · Cuenta'}, 5:{titulo:'Dueño · Resultado'},
};
function marcarPasoDemo(paso,redibujar=true){
  state.demoPasoActual=paso;
  state.demoPasosVistos.add(paso);
  if(redibujar) render();
}
function irPasoDemo(role,mozo,paso){
  if(mozo) state.mozoActivo=mozo;
  if(paso) marcarPasoDemo(paso,false);
  setRole(role);
  window.scrollTo({top:0,behavior:'smooth'});
}
function volverRecorridoDemo(){
  setRole('encargado');
  window.scrollTo({top:0,behavior:'smooth'});
}
function siguientePasoDemo(){
  const actual=state.demoPasoActual;
  if(actual===2) return irPasoDemo('mozo','Sofía',3);
  if(actual===3){ marcarPasoDemo(4,false); return abrirVistaMesaDemo(3); }
  if(actual===5){ marcarPasoDemo(5,false); return volverRecorridoDemo(); }
  volverRecorridoDemo();
}
function reiniciarRecorridoVisual(){
  state.demoPasosVistos.clear();
  state.demoPasoActual=1;
  render();
}
function demoDockHtml(){
  const paso=state.demoPasoActual;
  const meta=DEMO_PASOS[paso] || DEMO_PASOS[1];
  const siguiente=paso===2?'Seguir a Salón':paso===3?'Abrir cuenta cliente':paso===5?'Finalizar recorrido':'Volver al recorrido';
  return `<aside class="presentation-dock" aria-label="Control del recorrido de demostración">
    <div><span class="presentation-kicker">Modo presentador · paso ${paso} de 5</span><strong>${escapeHtml(meta.titulo)}</strong></div>
    <div class="presentation-dock-actions"><button class="btn ghost sm" onclick="volverRecorridoDemo()">Ver recorrido</button><button class="btn primary sm" onclick="siguientePasoDemo()">${escapeHtml(siguiente)}</button></div>
  </aside>`;
}
function demoStepClass(paso){
  return `${state.demoPasoActual===paso?' active':''}${state.demoPasosVistos.has(paso)?' visited':''}`;
}
function presentacionGuideHtml(){
  const vistos=state.demoPasosVistos.size;
  const completo=vistos===5;
  return `<section class="presentation-panel" aria-label="Recorrido de presentación">
    <div class="presentation-head"><div><span class="presentation-kicker">Escenario sintético activo</span><h2>Recorrido de demo · 5 minutos</h2><p>Abrí cada estación en orden. Un control visible mantiene el hilo entre roles y previews.</p></div><span class="pill libre">${ic('checkring')} ${completo?'Recorrido completo':'Listo para presentar'}</span></div>
    <div class="presentation-progress"><div><span style="width:${vistos*20}%"></span></div><b>${vistos}/5 estaciones recorridas</b>${completo?'<button class="btn ghost sm" onclick="reiniciarRecorridoVisual()">Repetir recorrido</button>':''}</div>
    ${state.mesaLinksError?`<div class="presentation-error">${escapeHtml(state.mesaLinksError)} <button class="btn ghost sm" onclick="cargarMesaLinks()">Reintentar</button></div>`:''}
    <div class="presentation-steps">
      <article class="presentation-step${demoStepClass(1)}"><span class="step-number">${state.demoPasosVistos.has(1)?ic('checkring'):'1'}</span><div><strong>Cliente · Mesa 1</strong><p>${escapeHtml(demoStepStatus(1))}</p></div>${mesaDemoLinkHtml(1,state.demoPasosVistos.has(1)?'Volver a abrir':'Empezar demo','primary','user',1)}</article>
      <article class="presentation-step${demoStepClass(2)}"><span class="step-number">${state.demoPasosVistos.has(2)?ic('checkring'):'2'}</span><div><strong>Cocina + Barra</strong><p>Avanzá Hummus y Agua en colas separadas.</p></div><button class="btn dark sm" onclick="irPasoDemo('cocina',null,2)">${ic('flame')} Abrir KDS</button></article>
      <article class="presentation-step${demoStepClass(3)}"><span class="step-number">${state.demoPasosVistos.has(3)?ic('checkring'):'3'}</span><div><strong>Salón · Sofía</strong><p>Retirá Agua de Mesa 1 y atendé ${demoStepStatus(4).toLowerCase()}.</p></div><button class="btn dark sm" onclick="irPasoDemo('mozo','Sofía',3)">${ic('plate')} Abrir Salón</button></article>
      <article class="presentation-step${demoStepClass(4)}"><span class="step-number">${state.demoPasosVistos.has(4)?ic('checkring'):'4'}</span><div><strong>Cliente · Cuenta</strong><p>Mesa 3: ${escapeHtml(demoStepStatus(3))}.</p></div>${mesaDemoLinkHtml(3,'Abrir cuenta','dark','receipt',4)}</article>
      <article class="presentation-step${demoStepClass(5)}"><span class="step-number">${state.demoPasosVistos.has(5)?ic('checkring'):'5'}</span><div><strong>Dueño · Resultado</strong><p>Mesa 5: ${escapeHtml(demoStepStatus(5))}. Analytics y CRM son sintéticos.</p></div><button class="btn good sm" onclick="irPasoDemo('dueno',null,5)">${ic('chart')} Abrir analytics</button></article>
    </div>
  </section>`;
}
function cargarEscenarioDemo(){
  if(confirm('Esto reemplaza el estado demo actual para TODOS los dispositivos conectados con un escenario de presentación. ¿Confirmás?')){
    state.demoPasosVistos.clear(); state.demoPasoActual=1; send({type:'demo_escenario_cargar'});
  }
}
function resetTodo(){
  if(confirm('Esto reinicia el estado para TODOS los dispositivos conectados ahora mismo (mesas, pedidos, alertas). ¿Confirmás?')) send({type:'reset_demo'});
}

/* ---------------- DUEÑO ---------------- */
function viewDueno(){
  const mesasOcupadas = state.mesas.filter(m=>m.ocupada).length;
  const alertasN = todasAlertasAbiertas().length;
  const urgentes = todasAlertasAbiertas().filter(x=>x.alerta.prioridad==='urgente').length;
  const analytics = state.analytics || emptyAnalytics();
  const pedidosActivos = state.mesas.filter(m=>m.pedido).length;
  const itemsEsperandoSalon = itemsListosParaEntregar(null);
  const esperaSalonMax = itemsEsperandoSalon.reduce((max,{item})=>Math.max(max,timeAgoSec((item.estadoTs&&item.estadoTs.listo)||item.enviadoTs)),0);
  const ticketPromedio = analytics.pagosConfirmados ? Math.round(analytics.ventasDemo/analytics.pagosConfirmados) : 0;
  const tiempoPagoPromedio = analytics.pagosConfirmados ? Math.round(analytics.tiempoPagoTotalSec/analytics.pagosConfirmados) : 0;
  const preparacionPromedio = analytics.itemsListos ? Math.round(analytics.tiempoPreparacionTotalSec/analytics.itemsListos) : 0;
  const pasePromedio = analytics.itemsEntregados ? Math.round(analytics.tiempoPaseTotalSec/analytics.itemsEntregados) : 0;
  const destinos = analytics.destinos || emptyAnalytics().destinos;
  const topProductos = Object.values(analytics.productos||{}).sort((a,b)=>b.cantidad-a.cantidad).slice(0,5);
  const resenas = Array.isArray(analytics.resenas) ? analytics.resenas : [];
  const ratingPromedio = resenas.length ? (resenas.reduce((sum,r)=>sum+r.puntuacion,0)/resenas.length).toFixed(1) : '—';
  const resenasCriticas = resenas.filter(r=>r.puntuacion<=3).length;
  const resenasRecientes = [...resenas].reverse().slice(0,6);
  const crmContactos = Array.isArray(analytics.crmContactos) ? analytics.crmContactos : [];
  const crmRecientes = [...crmContactos].reverse().slice(0,6);
  const productosPendientes = todosLosProductos().filter(p=>precioBase(p)===null).length;
  return `<h1 class="view-title">DUEÑO</h1>
    <p class="view-sub">Panel de negocio de esta sesión. ${productosPendientes} productos todavía sin precio confirmado.</p>
    ${state.presentacionCargada?`<div class="mock-banner">${ic('checkring')} Escenario sintético de presentación activo. Estas métricas no corresponden a clientes ni ventas reales.</div>`:''}
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
      ${statTile('CRM consentido', String(crmContactos.length), crmContactos.length?'contactos captados':'sin contactos todavía', null)}
    </div>
    <div class="section-h">Rendimiento operativo acumulado</div>
    <div class="grid cols-4">
      ${statTile('Preparación promedio', fmtSec(preparacionPromedio), analytics.itemsListos+' ítem(s) listos', null)}
      ${statTile('Pase a la mesa', fmtSec(pasePromedio), analytics.itemsEntregados+' ítem(s) entregados', pasePromedio>120?'downAlert':null)}
      ${statTile('Cocina', fmtSec(destinos.cocina.itemsListos?Math.round(destinos.cocina.tiempoPreparacionTotalSec/destinos.cocina.itemsListos):0), destinos.cocina.itemsListos+' ítem(s) listos', null)}
      ${statTile('Barra', fmtSec(destinos.barra.itemsListos?Math.round(destinos.barra.tiempoPreparacionTotalSec/destinos.barra.itemsListos):0), destinos.barra.itemsListos+' ítem(s) listos', null)}
    </div>
    <div class="section-h">Más vendidos de la sesión</div>
    <div class="grid cols-3">
      ${topProductos.length ? topProductos.map((p,index)=>`<div class="insight"><span>${index+1}. ${escapeHtml(p.nombre)}</span><b>${p.cantidad} · ${money(p.total)}</b></div>`).join('') : '<div class="empty">Los productos aparecerán cuando se confirme el primer pago demo.</div>'}
    </div>
    <div class="section-h">Opiniones post-pago</div>
    <div class="grid cols-3">
      ${resenasRecientes.length ? resenasRecientes.map(r=>`<div class="insight review-insight"><span>Mesa ${r.mesa} · ${r.puntuacion}/5 · hace ${fmtSec(timeAgoSec(r.creadoTs))}</span><b>${r.comentario?escapeHtml(r.comentario):'Sin comentario'}</b></div>`).join('') : '<div class="empty">Las opiniones aparecerán después de un pago demo confirmado.</div>'}
    </div>
    <div class="section-h">CRM con consentimiento</div>
    <div class="mock-banner">${ic('clipboard')} Captación post-pago en sandbox. Los contactos quedan solo en este sistema demo y no se envían campañas.</div>
    <div class="grid cols-3">
      ${crmRecientes.length ? crmRecientes.map(c=>`<div class="insight review-insight"><span>Mesa ${c.mesa} · ${c.canal==='email'?'Email':'WhatsApp'} · hace ${fmtSec(timeAgoSec(c.consentimientoTs))}</span><b>${c.nombre?escapeHtml(c.nombre)+' · ':''}${escapeHtml(c.contacto)}</b></div>`).join('') : '<div class="empty">Los contactos aparecerán solo cuando una persona acepte recibir novedades.</div>'}
    </div>
    ${view3dReadinessHtml()}`;
}
function view3dReadinessHtml(){
  const platos=platosDestacadosData();
  const conFoto=platos.filter(p=>Boolean(p.imagen));
  const sinFoto=platos.filter(p=>!p.imagen);
  return `<div class="section-h">Preparación 3D/AR por plato</div>
    <div class="mock-banner">${ic('warning')} Prototipo técnico: hoy se usa un modelo genérico solo para validar cámara e interacción. Ningún plato tiene todavía un modelo 3D real publicable.</div>
    <div class="grid cols-3 asset-summary">
      ${statTile('Modelos 3D reales', `0 / ${platos.length}`, `faltan ${platos.length} GLB + ${platos.length} USDZ`, 'downAlert')}
      ${statTile('Fotos reales', `${conFoto.length} / ${platos.length}`, sinFoto.length?`faltan ${sinFoto.map(p=>p.nombre).join(' y ')}`:'referencias completas', sinFoto.length?'downAlert':null)}
      ${statTile('Shell AR', 'Listo', 'cámara, fallback y escala por validar', null)}
    </div>
    <div class="asset-grid">${platos.map(p=>{
      const missing=[`GLB real de ${p.nombre}`,`USDZ real de ${p.nombre}`,'medida real de escala'];
      if(!p.imagen) missing.push(`foto real de ${p.nombre}`);
      return `<article class="asset-card"><div class="asset-card-head"><strong>${escapeHtml(p.nombre)}</strong><span class="pill importante">No publicable</span></div>
        <div class="asset-line"><span>Foto real de referencia</span><b class="${p.imagen?'ready':'pending'}">${p.imagen?'Lista':'Falta'}</b></div>
        <div class="asset-line"><span>Modelo del plato</span><b class="pending">Falta</b></div>
        <p><b>Assets exactos:</b> ${escapeHtml(missing.join(' · '))}.</p></article>`;
    }).join('')}</div>`;
}
function statTile(label,value,delta,deltaClass){
  return `<div class="stat-tile"><div class="label">${label}</div>
    <div class="value ${deltaClass==='downAlert'?'alert':''}">${value}</div>
    ${delta?`<div class="delta ${deltaClass==='up'?'up':deltaClass==='downAlert'?'down':''}">${delta}</div>`:''}</div>`;
}
