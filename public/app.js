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
// Umbrales de espera para priorizar Mozo/Dueño (cuándo algo pasa de "normal"
// a "importante" a "urgente/rojo"). Son valores de demo elegidos para que la
// priorización se vea razonable con datos sintéticos — NO son un SLA
// confirmado por Rabieta. Antes de usarlos como objetivo operativo real hay
// que validarlos con el local; mientras tanto viven acá, centralizados, en
// vez de repetidos como números sueltos por el código.
const DEMO_UMBRALES_ESPERA_SEG = {
  atencionSeg: 60,     // por debajo de esto, ni figura como pendiente
  urgenteSeg: 180,      // 3min+ sin resolver pasa a la prioridad más alta
  cocinaLentaSeg: 480,  // 8min+ "preparando" se marca como cocina/barra lenta
};
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
let conexionVistaIniciada = false;
let conexionRecoveryTimer = null;
let STAFF_TOKEN = null;
let STAFF_ROLE = null;
let STAFF_ALLOWED_VIEWS = [];
let MESA_TOKEN = null;

function emptyAnalytics(){
  return {
    pagosConfirmados:0,ventasDemo:0,tiempoPagoTotalSec:0,itemsVendidos:0,
    itemsListos:0,itemsEntregados:0,tiempoPreparacionTotalSec:0,tiempoPaseTotalSec:0,
    destinos:{cocina:{itemsListos:0,tiempoPreparacionTotalSec:0},barra:{itemsListos:0,tiempoPreparacionTotalSec:0}},
    productos:{},resenas:[],crmContactos:[],actividad:[]
  };
}

let state = {
  clockMs:0, mesas:[], analytics:emptyAnalytics(), integraciones:null, mercadoPagoDisponible:false,
  // ui local, no viene del servidor:
  role:null, clienteMesa:null, clienteCat:null, clienteFiltroSinTacc:false, clienteAccesoInvalido:false,
  clienteCart:[], clienteCartRecuperado:'', clienteExpand:null, clienteProductoDrafts:{}, clienteHelpOpen:false, clienteSplashDismissed:false,
  clienteAsistenteOpen:false, clientePreferencia:null, clienteAsistenteConsulta:'', clienteAsistenteRespuesta:null,
  clienteAsistenteHistorial:[], clienteAsistenteConsultaMostrada:'',
  clienteAsistenteAgregado:null, clienteResenaError:'', clienteResenaEnviando:false,
  clienteRepetirAviso:'', clientePedidoEnviando:false, clientePedidoError:'',
  clienteServicioEnviando:false, clienteServicioError:'',
  clienteAyudaDraft:'', clienteAyudaEnviando:false, clienteAyudaError:'', clienteAyudaPendiente:null,
  clientePagoMedio:'tarjeta', clientePagoEnviando:false, clientePagoError:'',
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
// Reloj MM:SS para la lista viva de Mozo: ahí el tiempo tiene que leerse de
// un vistazo como un cronómetro (00:42), no en la forma conversacional
// "hace 42s" que usa el resto del sistema.
function fmtClock(s){ const m=Math.floor(s/60), r=s%60; return String(m).padStart(2,'0')+':'+String(r).padStart(2,'0'); }
function findMesa(n){ return state.mesas.find(m=>m.numero===n); }
function findProducto(id){ for(const c of MENU_DATA.categorias) for(const p of c.productos) if(p.id===id) return p; }
function todosLosProductos(){ const out=[]; MENU_DATA.categorias.forEach(c=>c.productos.forEach(p=>out.push({...p,categoriaId:c.id}))); return out; }
function precioBase(p){ if(p.variantes && p.variantes.length) return p.variantes[0].precio; return p.precio; }
function carritoStorageKey(){ return Number.isInteger(state.clienteMesa)?'rabietaCart:'+state.clienteMesa:null; }
function guardarCarritoLocal(){
  const key=carritoStorageKey(); if(!key) return;
  try{
    if(state.clienteCart.length) sessionStorage.setItem(key,JSON.stringify(state.clienteCart));
    else sessionStorage.removeItem(key);
  }catch(e){}
}
function recuperarCarritoLocal(){
  const key=carritoStorageKey(); if(!key || !MENU_DATA) return;
  try{
    const saved=JSON.parse(sessionStorage.getItem(key)||'[]');
    if(!Array.isArray(saved)) return;
    state.clienteCart=saved.slice(0,50).map(raw=>{
      if(!raw || typeof raw!=='object' || typeof raw.productoId!=='string') return null;
      const producto=findProducto(raw.productoId); if(!producto) return null;
      let nombre=producto.nombre, precio=precioBase(producto), variante=null, opcion=null;
      if(producto.variantes){
        const encontrada=producto.variantes.find(item=>item.nombre===raw.variante); if(!encontrada) return null;
        variante=encontrada.nombre; precio=encontrada.precio; nombre+=' — '+variante;
      }
      if(producto.opciones){
        if(!producto.opciones.includes(raw.opcion)) return null;
        opcion=raw.opcion; nombre+=' ('+opcion+')';
      }
      const observacion=typeof raw.observacion==='string'?raw.observacion.trim().slice(0,500):'';
      const cantidad=Number.isInteger(raw.cantidad)?Math.min(20,Math.max(1,raw.cantidad)):1;
      return {productoId:producto.id,variante,opcion,observacion,nombre,precio,notas:observacion,cantidad};
    }).filter(Boolean);
    if(state.clienteCart.length) state.clienteCartRecuperado=`Recuperamos ${cantidadCarrito()} unidad(es) de esta pestaña.`;
    guardarCarritoLocal();
  }catch(e){ try{ sessionStorage.removeItem(key); }catch(ignore){} }
}
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
    if(typeof msg.mercadoPagoDisponible==='boolean') state.mercadoPagoDisponible = msg.mercadoPagoDisponible;
    if(msg.integraciones) state.integraciones = msg.integraciones;
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
  return state.role==='cliente' && active && typeof active.closest==='function' && Boolean(active.closest('.review-card, .ai-assistant, .dish-detail, .help-panel'));
}
function conectar(onFirstSnapshot){
  if(state.role==='cliente'){
    conectarMesa(onFirstSnapshot);
    return;
  }
  conectarStaff(onFirstSnapshot);
}
async function conectarMesa(onFirstSnapshot){
  while(state.role==='cliente' && !state.clienteAccesoInvalido){
    const headers = {};
    if(MESA_TOKEN) headers['X-Mesa-Token'] = MESA_TOKEN;
    let accesoInvalido=false;
    try{
      const response = await fetch('/events?mesa=' + encodeURIComponent(state.clienteMesa), {headers});
      if(response.status===400 || response.status===401 || response.status===403){ accesoInvalido=true; }
      else{ onFirstSnapshot = await consumirStream(response, onFirstSnapshot, ()=>state.role==='cliente'); }
    }catch(e){}
    liveReady=false;
    if(accesoInvalido){
      // 400/401/403 significa que el servidor rechazó explícitamente este pedido
      // de mesa (número fuera de rango, identidad faltante o que no coincide):
      // reintentar con el mismo link roto nunca se va a resolver solo, así que
      // dejamos de mostrar "sin conexión" y avisamos algo accionable en vez de
      // reintentar para siempre en silencio.
      state.clienteAccesoInvalido = true;
      hideConnStatus();
      render();
      break;
    }
    setConnPill(false);
    if(state.role==='cliente') await new Promise(resolve=>setTimeout(resolve,1000));
  }
}
async function conectarStaff(onFirstSnapshot){
  while(STAFF_TOKEN){
    let expirado=false;
    try{
      const response = await fetch('/api/staff-events', {headers:{Authorization:'Bearer ' + STAFF_TOKEN}});
      if(response.status===401){ expirado=true; }
      else{ onFirstSnapshot = await consumirStream(response, onFirstSnapshot, ()=>!!STAFF_TOKEN); }
    }catch(e){}
    liveReady=false;
    if(expirado){
      // Igual que con el acceso de mesa: un 401 es un rechazo explícito y
      // permanente de este token, no un corte de red. La pantalla de login ya
      // explica "tu sesión venció"; el banner genérico de "sin conexión,
      // estamos intentando volver" sería contradictorio, así que lo ocultamos.
      hideConnStatus();
      staffSessionExpired();
      break;
    }
    setConnPill(false);
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
const STAFF_SESSION_KEY = 'rabieta_staff_session_v1';
function setStaffSession(token,role,allowedViews,persist){
  STAFF_TOKEN = token;
  STAFF_ROLE = role;
  STAFF_ALLOWED_VIEWS = Array.isArray(allowedViews) ? allowedViews : [role];
  if(persist!==false){
    try{ localStorage.setItem(STAFF_SESSION_KEY, JSON.stringify({token,role,allowedViews:STAFF_ALLOWED_VIEWS})); }catch(e){}
  }
}
function loadStoredStaffSession(){
  try{
    const raw = localStorage.getItem(STAFF_SESSION_KEY);
    if(!raw) return null;
    const data = JSON.parse(raw);
    if(!data || typeof data.token!=='string' || !data.token || typeof data.role!=='string') return null;
    return data;
  }catch(e){ return null; }
}
function clearStaffSession(){
  STAFF_TOKEN = null; STAFF_ROLE = null; STAFF_ALLOWED_VIEWS = [];
  try{ localStorage.removeItem(STAFF_SESSION_KEY); }catch(e){}
}
function staffSessionExpired(){
  const hadSession = Boolean(STAFF_TOKEN);
  clearStaffSession();
  if(hadSession && typeof window!=='undefined' && typeof window.onStaffSessionEnded==='function') window.onStaffSessionEnded('expired');
}
function staffLogout(){
  const token = STAFF_TOKEN;
  clearStaffSession();
  if(token) fetch('/api/staff-logout', {method:'POST', headers:{Authorization:'Bearer '+token}}).catch(()=>{});
  if(typeof window!=='undefined' && typeof window.onStaffSessionEnded==='function') window.onStaffSessionEnded('logout');
}
function setMesaToken(token){ MESA_TOKEN = token || null; }
function setConnPill(on){
  let el = document.getElementById('connPill');
  if(!el){ el=document.createElement('div'); el.id='connPill'; el.className='conn-pill'; document.body.appendChild(el); }
  el.className = 'conn-pill ' + (on?'on':'off');
  el.textContent = on ? '● en vivo' : '● sin conexión…';
  let banner = document.getElementById('connBanner');
  if(!banner){
    banner=document.createElement('div'); banner.id='connBanner'; banner.setAttribute('role','status');
    banner.setAttribute('aria-live','polite'); document.body.appendChild(banner);
  }
  if(conexionRecoveryTimer){ clearTimeout(conexionRecoveryTimer); conexionRecoveryTimer=null; }
  if(on){
    if(conexionVistaIniciada){
      banner.className='conn-banner recovered';
      banner.innerHTML='<strong>Conexión recuperada</strong><span>La pantalla volvió a estar al día.</span>';
      conexionRecoveryTimer=setTimeout(()=>{ banner.className='conn-banner'; banner.innerHTML=''; },15000);
    }else{
      banner.className='conn-banner'; banner.innerHTML='';
    }
    conexionVistaIniciada=true;
  }else{
    banner.className='conn-banner offline';
    banner.innerHTML='<strong>Sin conexión con Rabieta</strong><span>Estamos intentando volver. Tu carrito y lo que estabas completando quedan guardados.</span>';
  }
}
function hideConnStatus(){
  if(conexionRecoveryTimer){ clearTimeout(conexionRecoveryTimer); conexionRecoveryTimer=null; }
  const el = document.getElementById('connPill'); if(el) el.remove();
  const banner = document.getElementById('connBanner'); if(banner) banner.remove();
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
    <span>${ic(r.icon)}</span><span>${r.label}</span><span class="dot ${n>0?'show':''}"></span></button>`).join('')
    + `<button class="logout-btn" onclick="staffLogout()" title="Cerrar sesión en este dispositivo"><span>${ic('lock')}</span><span>Cerrar sesión</span></button>`;
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
  await cargarInfoRed();
  if(state.role==='qrs' || state.role==='encargado') render();
}
// Si Encargado abrió el panel como "localhost", los QR generados con esa
// palabra literal no sirven desde ningún celular (ahí "localhost" es el
// celular mismo). Se detecta la IP de red real del servidor una sola vez y
// se usa para armar los enlaces, sin que Encargado tenga que saber de redes.
let LAN_INFO = null;
async function cargarInfoRed(){
  const esLocalhost = location.hostname==='localhost' || location.hostname==='127.0.0.1';
  if(!esLocalhost || LAN_INFO) return;
  try{
    const response = await fetch('/api/network-info', {headers:{Authorization:'Bearer ' + STAFF_TOKEN}});
    if(!response.ok) return;
    const payload = await response.json();
    if(payload.lanIps && payload.lanIps.length) LAN_INFO = payload;
  }catch(e){}
}
function mesaOrigin(){
  const esLocalhost = location.hostname==='localhost' || location.hostname==='127.0.0.1';
  if(esLocalhost && LAN_INFO && LAN_INFO.lanIps.length) return `${location.protocol}//${LAN_INFO.lanIps[0]}:${LAN_INFO.port}`;
  return location.origin;
}
function mesaAccessUrl(path){ return mesaOrigin() + path; }
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
function lanBannerHtml(){
  const esLocalhost = location.hostname==='localhost' || location.hostname==='127.0.0.1';
  if(!esLocalhost) return '';
  if(!LAN_INFO || !LAN_INFO.lanIps.length){
    return `<div class="mock-banner">${ic('warning')} Estás en "localhost": los códigos QR no van a abrir desde ningún celular (ahí "localhost" es el propio celular). No se pudo detectar automáticamente la dirección de red de esta PC; para armar la demo, abrí este panel escribiendo la IP de tu PC en la red en vez de localhost.</div>`;
  }
  const origen = mesaOrigin();
  return `<div class="mock-banner">${ic('checkring')} Detectamos que abriste esto como "localhost": los enlaces y QR de abajo ya se armaron con <b>${escapeHtml(origen)}</b> para que funcionen en cualquier celular de esta misma red. La próxima vez, para evitar este aviso, abrí el panel directo desde esa dirección.</div>`;
}
function viewMesaQrs(){
  if(!state.mesaLinks && !state.mesaLinksError) return `<h1 class="view-title">QR / MESAS</h1><div class="empty">Generando accesos de mesa…</div>`;
  if(state.mesaLinksError) return `<h1 class="view-title">QR / MESAS</h1><div class="card qr-error">${escapeHtml(state.mesaLinksError)}</div><button class="btn primary sm" onclick="cargarMesaLinks()">Reintentar</button>`;
  const links=state.mesaLinks;
  setTimeout(montarMesaQrs,0);
  return `<section class="qr-screen"><div class="qr-print-only qr-print-header"><strong>RABIETA</strong><span>CARTA Y PEDIDOS · ACCESOS POR MESA</span></div>
    <h1 class="view-title">QR / MESAS</h1>
    <p class="view-sub">Accesos únicos para imprimir o probar cada mesa. Solo el panel autenticado puede verlos.</p>
    <div class="${links.secure?'secure-banner':'mock-banner'}">${ic(links.secure?'lock':'warning')} ${links.secure?'Identidad segura activa: cada QR queda vinculado a una sola mesa.':'Modo compatible: activá la identidad segura de mesas antes de imprimir los QR definitivos.'}</div>
    ${lanBannerHtml()}
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
// En cuanto exista un .glb real con el nombre del producto en public/models/
// (ver public/models/LEEME.md), se usa automáticamente acá en vez del
// genérico — sin tocar código. El servidor lo informa en cada /api/menu.
function modelosRealesDisponibles(){ return (MENU_DATA && MENU_DATA._modelos3d) || {}; }
function modeloParaPlato(id){
  const real = modelosRealesDisponibles()[id];
  if(real && real.glb){
    return {url:'/models/'+id+'.glb', usdz: real.usdz ? '/models/'+id+'.usdz' : null, esReal:true, nombre:'el modelo real de este plato'};
  }
  const lista = [...CANDIDATOS_3D];
  const idx = lista.indexOf(id);
  const generico = MODELOS_3D_GENERICOS[(idx<0?0:idx) % MODELOS_3D_GENERICOS.length];
  return {url:generico.url, usdz:null, esReal:false, nombre:generico.nombre};
}
function renderModal(){
  const root = document.getElementById('modalRoot');
  if(!root) return;
  if(!state.modal){ root.innerHTML=''; delete root.dataset.modalKey; return; }
  const transientModalKey = state.modal.type==='cart'
    ? ':'+state.clienteCart.map(item=>cantidadLinea(item)).join(',')+':'+state.clientePedidoEnviando+':'+state.clientePedidoError
    : (state.modal.type==='confirm-mozo'||state.modal.type==='confirm-cuenta')
      ? ':'+state.clienteServicioEnviando+':'+state.clienteServicioError+':'+cantidadCarrito()
      : state.modal.type==='checkout'
        ? ':'+state.clientePagoMedio+':'+state.clientePagoEnviando+':'+state.clientePagoError
        : '';
  const modalKey=`${state.modal.type}:${state.modal.id||state.modal.numero||''}${transientModalKey}`;
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
            ${modelo.usdz?`ios-src="${modelo.usdz}"`:''}
            poster="${poster}" alt="Vista 3D ${modelo.esReal?'real':'genérica'} para ${escapeHtml(state.modal.nombre)}" loading="eager" reveal="auto"
            onload="modelo3dListo()" onerror="modelo3dError()"
            style="width:100%;height:100%;background:transparent;"></model-viewer>
          <div id="fallback3d" class="fallback3d" hidden>
            <img src="${poster}" alt="Foto de ${escapeHtml(state.modal.nombre)}">
            <span>La foto real queda disponible aunque el modelo 3D no cargue.</span>
          </div>
        </div>
        <div class="body3d">
          <span class="badge-preview ${modelo.esReal?'real':''}">${modelo.esReal?'Modelo 3D real de Rabieta':'Prototipo técnico · modelo genérico, no representa este plato'}</span>
          <h3>${escapeHtml(state.modal.nombre)}</h3>
          <p>Activá la cámara, enfocá tu mesa, y el plato aparece ahí arriba en tamaño real — como si ya te lo hubieran servido. También podés arrastrar acá abajo para girarlo sin cámara.</p>
          <button class="btn callout block" onclick="activarAR()">${ic('cube')} Ver en mi mesa con la cámara</button>
          <div id="arStatus" class="ar-status" aria-live="polite">Cargando la experiencia 3D…</div>
          <p class="ar-fineprint">${modelo.esReal
            ? `Modelo real escaneado para Rabieta.${modelo.usdz?'':' Todavía falta el archivo USDZ para que abra la cámara AR directamente en iPhone.'}`
            : `Esta prueba valida interacción y cámara, no la apariencia del plato. Para publicar <b>${state.modal.nombre}</b> faltan su modelo GLB real, su USDZ real y una medida de escala verificada. El modelo visible ahora es ${modelo.nombre}.`}</p>
          <button class="btn dark block" onclick="closeModal()">Cerrar</button>
        </div>
      </div></div>`;
  } else if(state.modal.type==='cart'){
    const unidades=cantidadCarrito();
    const total=totalCarrito();
    const pendientes=state.clienteCart.reduce((sum,item)=>sum+(item.precio===null?cantidadLinea(item):0),0);
    root.innerHTML = `<div class="modal-bg" onclick="closeModal(event)"><div class="modal cart-modal" onclick="event.stopPropagation()">
      <div class="cart-modal-head"><div><span class="presentation-kicker">Antes de enviar</span><h3>Revisá tu carrito</h3></div><button class="btn ghost sm" onclick="closeModal()">Seguir eligiendo</button></div>
      <ul class="cart-review-list">${state.clienteCart.map((item,index)=>{ const cantidad=cantidadLinea(item); return `<li><div><strong>${escapeHtml(item.nombre)}</strong>${item.notas?`<span>“${escapeHtml(item.notas)}”</span>`:''}</div><div class="cart-qty" aria-label="Cantidad de ${escapeHtml(item.nombre)}"><button aria-label="Restar uno" ${state.clientePedidoEnviando?'disabled':''} onclick="cambiarCantidadCarrito(${index},-1)">−</button><span aria-live="polite">${cantidad}</span><button aria-label="Sumar uno" ${cantidad>=20||state.clientePedidoEnviando?'disabled':''} onclick="cambiarCantidadCarrito(${index},1)">+</button></div><b>${cantidad>1&&item.precio!==null?`${cantidad} × ${money(item.precio)} · `:''}${money(item.precio===null?null:item.precio*cantidad)}</b><button class="cart-remove" aria-label="Quitar ${escapeHtml(item.nombre)}" ${state.clientePedidoEnviando?'disabled':''} onclick="quitarDelCarrito(${index})">×</button></li>`; }).join('')}</ul>
      <div class="cart-review-total"><span>${unidades} unidad(es)${pendientes?' · '+pendientes+' a confirmar':''}</span><strong>${money(total)}${pendientes?' + pendientes':''}</strong></div>
      ${state.clientePedidoError?`<div class="cart-send-error" role="alert">${ic('warning')} <span><strong>No se envió el pedido.</strong>${escapeHtml(state.clientePedidoError)} Tu carrito sigue intacto.</span></div>`:''}
      <div class="cart-modal-actions"><button class="btn ghost" ${state.clientePedidoEnviando?'disabled':''} onclick="vaciarCarrito()">Vaciar</button><button class="btn primary" ${state.clientePedidoEnviando?'disabled':''} aria-busy="${state.clientePedidoEnviando?'true':'false'}" onclick="enviarPedido()">${state.clientePedidoEnviando?'Enviando…':state.clientePedidoError?'Reintentar envío →':`Enviar ${findMesa(state.clienteMesa)&&findMesa(state.clienteMesa).pedido?'otra ronda':'pedido'} a cocina →`}</button></div>
    </div></div>`;
  } else if(state.modal.type==='pedido-enviado'){
    root.innerHTML = `<div class="modal-bg"><div class="modal order-sent-modal">
      <div class="icon">${ic('checkring')}</div>
      <span class="presentation-kicker">Pedido confirmado</span>
      <h3>${state.modal.esRonda?'Nueva ronda enviada':'¡Ya lo recibió el equipo!'}</h3>
      <p>Enviamos ${state.modal.unidades} unidad(es) de la Mesa ${state.clienteMesa}. Podés seguir el avance de cada producto en vivo desde la carta.</p>
      <button class="btn good block" onclick="closeModal()">Ver estado del pedido</button>
    </div></div>`;
  } else if(state.modal.type==='confirm-mozo'){
    root.innerHTML = `<div class="modal-bg" onclick="closeModal(event)">
      <div class="modal" onclick="event.stopPropagation()">
        <div class="icon">${ic('bell')}</div>
        <h3>¿Llamar al mozo?</h3>
        <p>Se le va a avisar al mozo que la <b>Mesa ${state.clienteMesa}</b> necesita atención. Confirmá solo si de verdad lo necesitás, así no camina de mesa en mesa por un toque sin querer.</p>
        ${state.clienteServicioError?`<div class="review-error" role="alert">${escapeHtml(state.clienteServicioError)} Tu solicitud todavía no fue enviada.</div>`:''}
        <div style="display:flex;gap:10px;">
          <button class="btn ghost" style="flex:1;" ${state.clienteServicioEnviando?'disabled':''} onclick="closeModal()">Cancelar</button>
          <button class="btn callout" style="flex:1;" ${state.clienteServicioEnviando?'disabled':''} aria-busy="${state.clienteServicioEnviando?'true':'false'}" onclick="confirmarLlamarMozo()">${state.clienteServicioEnviando?'Enviando…':state.clienteServicioError?'Reintentar llamado':'Sí, llamar'}</button>
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
  } else if(state.modal.type==='ayuda-enviada'){
    root.innerHTML = `<div class="modal-bg" onclick="closeModal(event)">
      <div class="modal" onclick="event.stopPropagation()">
        <div class="icon">${ic('checkring')}</div>
        <span class="presentation-kicker">Solicitud confirmada</span>
        <h3>Salón ya recibió tu aviso</h3>
        <p><b>${escapeHtml(state.modal.label)}</b>${state.modal.mensaje?` · “${escapeHtml(state.modal.mensaje)}”`:''}. El equipo puede verlo ahora y acercarse a la <b>Mesa ${state.clienteMesa}</b>.</p>
        <button class="btn good block" onclick="closeModal()">Volver a la carta</button>
      </div></div>`;
  } else if(state.modal.type==='confirm-cuenta'){
    const unidades=cantidadCarrito();
    root.innerHTML = `<div class="modal-bg" onclick="closeModal(event)">
      <div class="modal" onclick="event.stopPropagation()">
        <div class="icon">${ic('receipt')}</div>
        <h3>¿Pedir la cuenta?</h3>
        <p>Salón recibirá la solicitud de la <b>Mesa ${state.clienteMesa}</b> y habilitará el checkout sandbox.</p>
        ${unidades?`<div class="mock-banner">${ic('warning')} Tenés ${unidades} unidad(es) sin enviar. Solo se quitarán del carrito cuando la cuenta sea solicitada con éxito.</div>`:''}
        ${state.clienteServicioError?`<div class="review-error" role="alert">${escapeHtml(state.clienteServicioError)} Tu carrito sigue intacto.</div>`:''}
        <div style="display:flex;gap:10px;">
          <button class="btn ghost" style="flex:1;" ${state.clienteServicioEnviando?'disabled':''} onclick="closeModal()">Seguir pidiendo</button>
          <button class="btn primary" style="flex:1;" ${state.clienteServicioEnviando?'disabled':''} aria-busy="${state.clienteServicioEnviando?'true':'false'}" onclick="confirmarPedirCuenta()">${state.clienteServicioEnviando?'Enviando…':state.clienteServicioError?'Reintentar cuenta':'Sí, pedir cuenta'}</button>
        </div>
      </div></div>`;
  } else if(state.modal.type==='cuenta-enviada'){
    root.innerHTML = `<div class="modal-bg"><div class="modal">
      <div class="icon">${ic('checkring')}</div><h3>Cuenta solicitada</h3>
      <p>Salón recibió el aviso de la <b>Mesa ${state.clienteMesa}</b>. El total y el checkout sandbox aparecerán en vivo.</p>
      <button class="btn primary block" onclick="closeModal()">Ver mi cuenta</button>
    </div></div>`;
  } else if(state.modal.type==='checkout'){
    const mesa = findMesa(state.clienteMesa);
    const total = mesa ? pedidoTotal(mesa) : 0;
    const usaMercadoPagoReal = state.clientePagoMedio==='mercado_pago' && state.mercadoPagoDisponible;
    root.innerHTML = `<div class="modal-bg" onclick="closeModal(event)">
      <div class="modal checkout-modal" onclick="event.stopPropagation()">
        <div class="checkout-head"><span class="checkout-lock">${ic('lock')} ${usaMercadoPagoReal?'MERCADO PAGO · MODO DE PRUEBA':'SANDBOX SEGURO'}</span><h3>Pagá desde la mesa</h3><p>${usaMercadoPagoReal?'Vas a completar el pago en Mercado Pago con credenciales de prueba del local. No es dinero real.':'Simulación completa para la demo. No se cobra dinero ni se solicitan datos reales.'}</p></div>
        <div class="checkout-summary">
          ${(mesa&&mesa.pedido?mesa.pedido.items:[]).map(item=>`<div><span>${escapeHtml(item.nombre)}</span><b>${money(item.precio)}</b></div>`).join('')}
          <div class="checkout-total"><span>Total</span><b>${money(total)}</b></div>
        </div>
        <div class="checkout-label">Elegí cómo ${state.mercadoPagoDisponible?'pagar':'simular el pago'}</div>
        <div class="payment-methods">
          <button class="${state.clientePagoMedio==='tarjeta'?'active':''}" onclick="elegirMedioPago('tarjeta')"><b>Tarjeta demo</b><span>•••• 4242</span></button>
          <button class="${state.clientePagoMedio==='mercado_pago'?'active':''}" onclick="elegirMedioPago('mercado_pago')"><b>Mercado Pago</b><span>${state.mercadoPagoDisponible?'Modo de prueba, sin dinero real':'Cuenta sandbox'}</span></button>
        </div>
        ${state.clientePagoError?`<div class="review-error">${escapeHtml(state.clientePagoError)}</div>`:''}
        <button class="btn primary block" ${state.clientePagoEnviando?'disabled':''} onclick="confirmarPagoSandbox()">${state.clientePagoEnviando?'Procesando…':usaMercadoPagoReal?'Ir a pagar con Mercado Pago':'Confirmar pago demo por '+money(total)}</button>
        <button class="btn ghost block" style="margin-top:8px;" onclick="closeModal()">Volver</button>
      </div></div>`;
  }
}
function openModal3d(id, nombre){ state.modal = {type:'3d', id, nombre}; render(); }
function closeModal(e){
  const envioActivo = state.modal && ((state.modal.type==='cart' && state.clientePedidoEnviando)
    || ((state.modal.type==='confirm-mozo'||state.modal.type==='confirm-cuenta') && state.clienteServicioEnviando)
    || (state.modal.type==='checkout' && state.clientePagoEnviando));
  if(envioActivo) return;
  state.modal=null; render();
}
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
        ${p.imagen ? `<img class="tile3d-img" src="${p.imagen}" alt="${p.nombre}">` : `<span class="tile3d-placeholder">${ic('plate')}<small>Foto pronto</small></span>`}
        <span class="nm">${p.nombre}</span><span class="cta">Probar demo 3D</span></button>`).join('')}
    </div></div>`;
}

const AI_EJEMPLOS = ['Una pizza barata', 'Algo liviano', 'Sin TACC hasta $3.000'];
function asistenteCartaHtml(bloqueado){
  if(!state.clienteAsistenteOpen){
    return `<div class="ai-assistant compact" id="ai-assistant-anchor"><div><span class="ai-badge">${ic('help')} IA de Rabieta</span>
      <strong>¿No sabés qué pedir?</strong><p>Te orientamos con la carta real de Rabieta, sin inventar platos ni precios.</p></div>
      <button class="btn primary sm" onclick="toggleAsistente()">Ayudame a elegir</button></div>`;
  }
  const respuesta = state.clienteAsistenteRespuesta;
  return `<div class="ai-assistant" id="ai-assistant-anchor">
    <div class="ai-head"><div><span class="ai-badge">${ic('help')} IA de Rabieta</span><strong>¿Qué te pinta hoy?</strong></div>
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
      ${respuesta.warning ? `<p class="ai-warning">${ic('warning')} ${escapeHtml(respuesta.warning)}</p>` : ''}`
      : `<p class="ai-empty">Probá con un ejemplo:</p><div class="ai-examples">${AI_EJEMPLOS.map(ej=>`<button onclick="probarEjemploAsistente('${ej.replace(/'/g,"\\'")}')">${escapeHtml(ej)}</button>`).join('')}</div>`}
    ${state.clienteAsistenteHistorial.length ? `<div class="ai-history"><span class="ai-history-label">Antes preguntaste</span>${state.clienteAsistenteHistorial.map(h=>`<div class="ai-history-item"><b>${escapeHtml(h.consulta)}</b><span>${escapeHtml(h.message)}</span></div>`).join('')}</div>` : ''}
    <p class="ai-fineprint">Funciona en este dispositivo con reglas sobre la carta real; no inventa platos, precios ni disponibilidad, y no envía datos a ningún servicio externo.</p>
  </div>`;
}
function toggleAsistente(){ state.clienteAsistenteOpen=!state.clienteAsistenteOpen; render(); }
function actualizarConsultaAsistente(value){ state.clienteAsistenteConsulta=value; }
// Guarda el intercambio anterior (pregunta + respuesta real) antes de
// reemplazarlo, para que el panel se sienta como una conversación con
// memoria corta en vez de un buscador que olvida lo último que preguntaste.
function registrarRespuestaAsistente(consulta, respuesta){
  // clienteAsistenteConsulta es el texto vivo del input (cambia con cada
  // tecla); clienteAsistenteConsultaMostrada queda "congelado" a la consulta
  // que generó la respuesta actual, así el historial no confunde lo que ya
  // se escribió después con lo que realmente se preguntó antes.
  if(state.clienteAsistenteRespuesta){
    state.clienteAsistenteHistorial.unshift({consulta: state.clienteAsistenteConsultaMostrada, message: state.clienteAsistenteRespuesta.message});
    state.clienteAsistenteHistorial.length = Math.min(state.clienteAsistenteHistorial.length, 4);
  }
  state.clienteAsistenteConsulta = consulta;
  state.clienteAsistenteConsultaMostrada = consulta;
  state.clienteAsistenteRespuesta = respuesta;
}
function probarEjemploAsistente(query){
  state.clientePreferencia=null; state.clienteAsistenteAgregado=null;
  registrarRespuestaAsistente(query, window.RabietaRecommender.recommend(MENU_DATA,query));
  render();
}
function abrirAsistenteDesdeSplash(){
  state.clienteSplashDismissed=true;
  state.clienteAsistenteOpen=true;
  render();
  const anchor=document.getElementById('ai-assistant-anchor');
  if(anchor) anchor.scrollIntoView({behavior:'smooth',block:'start'});
}
function consultarAsistente(event){
  if(event) event.preventDefault();
  state.clientePreferencia=null; state.clienteAsistenteAgregado=null;
  registrarRespuestaAsistente(state.clienteAsistenteConsulta, window.RabietaRecommender.recommend(MENU_DATA,state.clienteAsistenteConsulta));
  render();
}
function setPreferenciaAsistente(perfil){
  const option = ASISTENTE_OPCIONES.find(op=>op.id===perfil);
  if(!option) return;
  state.clientePreferencia=perfil;
  state.clienteAsistenteAgregado=null;
  registrarRespuestaAsistente(option.label, window.RabietaRecommender.recommend(MENU_DATA,option.label));
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
    <button class="btn ghost splash-ai-btn" onclick="abrirAsistenteDesdeSplash()">${ic('help')} Preguntale a la IA de Rabieta qué pedir</button>
    <button class="splash-skip" onclick="dismissSplash()">Ver toda la carta →</button>
  </div>`;
}
function dismissSplash(){ state.clienteSplashDismissed = true; render(); }

function accesoInvalidoHtml(){
  return `<div class="card access-invalid">
    <div class="access-invalid-icon">${ic('warning')}</div>
    <strong>Este acceso no es válido</strong>
    <p>El enlace de esta mesa venció, ya se usó desde otro dispositivo o no coincide con el QR. No es un corte de conexión: reintentar solo no lo va a resolver.</p>
    <p><b>Pedile a un mozo que te ayude</b> o volvé a escanear el código QR pegado en tu mesa para conseguir un acceso nuevo.</p>
  </div>`;
}
function viewCliente(){
  if(state.clienteAccesoInvalido) return accesoInvalidoHtml();
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
      ? `<div class="payment-receipt"><span>${ic('checkring')}</span><div><b>${mesa.pago.modo==='mercadopago'?'Pago con Mercado Pago aprobado':'Pago demo aprobado'}</b><small>${money(mesa.pago.total)} · ${mesa.pago.modo==='mercadopago'?'Mercado Pago':mesa.pago.medio==='mercado_pago'?'Mercado Pago sandbox':mesa.pago.medio==='tarjeta'?'Tarjeta demo •••• 4242':'Confirmado por staff'}<br>Comprobante ${escapeHtml(mesa.pago.referencia||'demo')}</small></div></div>${resenaHtml(mesa)}`
      : mesa.pago && mesa.pago.estado==='pendiente' && mesa.pago.modo==='mercadopago'
        ? `<div class="checkout-callout mp-pending"><div><b>${ic('lock')} Esperando confirmación de Mercado Pago</b><span>Total ${money(mesa.pago.total)} · si ya pagaste, esto se actualiza solo apenas Mercado Pago nos confirme.</span></div><button class="btn primary sm" data-mp-checkout-url="${escapeHtml(mesa.pago.checkoutUrl)}" onclick="abrirCheckoutMercadoPago(this)">Abrir Mercado Pago</button></div>`
        : mesa.cuentaPedida
          ? `<div class="checkout-callout"><div><b>${ic('receipt')} Tu cuenta está lista</b><span>Total ${money(pedidoTotal(mesa))} · podés completar el flujo sin dinero real.</span></div><button class="btn primary sm" onclick="abrirCheckout()">Pagar en sandbox</button></div>`
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

  const cartTotal = totalCarrito();
  const cartUnidades = cantidadCarrito();
  const cartPendientes = state.clienteCart.reduce((sum,item)=>sum+(item.precio===null?cantidadLinea(item):0),0);

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
        ? `<button class="btn good" disabled>${ic('checkring')} ${mesa.pago.modo==='mercadopago'?'Pago con Mercado Pago confirmado':'Pago demo confirmado'}</button>`
        : mesa.pago && mesa.pago.estado==='pendiente'
          ? `<button class="btn dark" data-mp-checkout-url="${escapeHtml(mesa.pago.checkoutUrl)}" onclick="abrirCheckoutMercadoPago(this)">${ic('lock')} Esperando Mercado Pago</button>`
          : mesa.cuentaPedida
            ? `<button class="btn primary" onclick="abrirCheckout()">${ic('lock')} Abrir pago sandbox</button>`
            : `<button class="btn dark" onclick="pedirCuenta()">${ic('receipt')} Pedir la cuenta</button>`}
      <button class="btn critical" onclick="toggleHelp()">${ic('help')} Necesito ayuda</button>
    </div>
    ${state.clienteHelpOpen ? helpPanelHtml() : ''}
    ${state.clienteCartRecuperado?`<div class="cart-recovered" role="status">${ic('refresh')} <span><strong>Tu carrito sigue acá</strong>${escapeHtml(state.clienteCartRecuperado)}</span></div>`:''}
    ${state.clienteCart.length && !mesa.cuentaPedida ? `<div class="cart-bar">
      <div><div class="cart-total">${money(cartTotal)}${cartPendientes?' + '+cartPendientes+' a confirmar':''}</div>
      <div class="cart-info">${cartUnidades} unidad(es) en el carrito</div></div>
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
  const draft = obtenerProductoDraft(p);
  let variantePicker = '';
  if(p.variantes){
    variantePicker = `<div class="opt-label">Elegí versión</div>` + p.variantes.map((v,i)=>`
      <div class="opt-row"><label><input type="radio" name="var_${p.id}" value="${i}" ${draft.variante===i?'checked':''} onchange="actualizarProductoDraft('${p.id}','variante',${i})"> ${v.nombre} — ${money(v.precio)}</label></div>`).join('');
  }
  let opcionPicker = '';
  if(p.opciones){
    opcionPicker = `<div class="opt-label">Elegí una opción</div>` + p.opciones.map((o,i)=>`
      <div class="opt-row"><label><input type="radio" name="op_${p.id}" value="${i}" ${draft.opcion===i?'checked':''} onchange="actualizarProductoDraft('${p.id}','opcion',${i})"> ${o}</label></div>`).join('');
  }
  return `<div class="dish-detail">
    ${variantePicker}${opcionPicker}
    <input type="text" class="nota" id="nota_${p.id}" maxlength="500" value="${escapeHtml(draft.observacion)}" oninput="actualizarProductoDraft('${p.id}','observacion',this.value)" placeholder="Observación para cocina (ej: sin cebolla)…">
    <div style="margin-top:10px;display:flex;gap:8px;">
      <button class="btn primary sm" onclick="agregarAlCarrito('${p.id}')">Agregar</button>
      <button class="btn ghost sm" onclick="toggleDish(null)">Cerrar</button>
    </div></div>`;
}

function setCat(c){ state.clienteCat=c; state.clienteExpand=null; render(); }
function toggleFiltroSinTacc(){ state.clienteFiltroSinTacc=!state.clienteFiltroSinTacc; render(); }
function toggleDish(id){ state.clienteExpand = state.clienteExpand===id?null:id; render(); }
function obtenerProductoDraft(producto){
  if(!state.clienteProductoDrafts[producto.id]) state.clienteProductoDrafts[producto.id]={variante:0,opcion:0,observacion:''};
  return state.clienteProductoDrafts[producto.id];
}
function actualizarProductoDraft(id,campo,valor){
  const producto=findProducto(id);
  if(!producto || !['variante','opcion','observacion'].includes(campo)) return;
  const draft=obtenerProductoDraft(producto);
  draft[campo]=campo==='observacion'?String(valor).slice(0,500):Number(valor);
}
function toggleHelp(){
  if(state.clienteAyudaEnviando) return;
  state.clienteHelpOpen=!state.clienteHelpOpen;
  state.clienteAyudaError='';
  if(!state.clienteHelpOpen) state.clienteAyudaPendiente=null;
  render();
}

function agregarAlCarrito(id){
  const p = findProducto(id);
  if(!p) return;
  const draft = obtenerProductoDraft(p);
  let nombre = p.nombre, precio = precioBase(p);
  let variante = null, opcion = null;
  if(p.variantes){
    const idx = Number.isInteger(draft.variante) && p.variantes[draft.variante] ? draft.variante : 0;
    variante = p.variantes[idx].nombre;
    nombre += ' — ' + variante; precio = p.variantes[idx].precio;
  }
  if(p.opciones){
    const op = p.opciones[Number.isInteger(draft.opcion) && p.opciones[draft.opcion] ? draft.opcion : 0];
    if(op){ opcion = op; nombre += ' (' + op + ')'; }
  }
  const nota = draft.observacion.trim();
  agregarLineaCarrito({productoId:id, variante, opcion, observacion:nota, nombre, precio, notas:nota});
  delete state.clienteProductoDrafts[id];
  state.clienteRepetirAviso='';
  state.clienteExpand = null;
  render();
}
function abrirCarrito(){ if(state.clienteCart.length){ state.clienteCartRecuperado=''; state.modal={type:'cart'}; render(); } }
function cantidadLinea(item){ return Number.isInteger(item.cantidad) && item.cantidad>0 ? item.cantidad : 1; }
function cantidadCarrito(){ return state.clienteCart.reduce((sum,item)=>sum+cantidadLinea(item),0); }
function totalCarrito(){ return state.clienteCart.reduce((sum,item)=>sum+(item.precio||0)*cantidadLinea(item),0); }
function agregarLineaCarrito(item){
  const existente=state.clienteCart.find(linea=>linea.productoId===item.productoId && linea.variante===item.variante && linea.opcion===item.opcion && linea.observacion===item.observacion);
  if(existente) existente.cantidad=Math.min(20,cantidadLinea(existente)+1);
  else state.clienteCart.push({...item,cantidad:1});
  guardarCarritoLocal();
  state.clientePedidoError='';
}
function cambiarCantidadCarrito(index,delta){
  if(state.clientePedidoEnviando || index<0 || index>=state.clienteCart.length || !Number.isInteger(delta)) return;
  const cantidad=Math.min(20,cantidadLinea(state.clienteCart[index])+delta);
  if(cantidad<=0){ quitarDelCarrito(index); return; }
  state.clienteCart[index].cantidad=cantidad;
  guardarCarritoLocal();
  state.clientePedidoError='';
  render();
}
function quitarDelCarrito(index){
  if(state.clientePedidoEnviando || index<0 || index>=state.clienteCart.length) return;
  state.clienteCart.splice(index,1);
  guardarCarritoLocal();
  state.clientePedidoError='';
  if(!state.clienteCart.length) state.modal=null;
  render();
}
function vaciarCarrito(){ if(state.clientePedidoEnviando) return; state.clienteCart=[]; state.clienteCartRecuperado=''; guardarCarritoLocal(); state.modal=null; state.clienteRepetirAviso=''; state.clientePedidoError=''; render(); }
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
    agregarLineaCarrito({
      productoId:p.id, variante:variante?variante.nombre:null, opcion:opcion||null,
      observacion:item.notas||'', nombre, precio, notas:item.notas||'',
    });
    agregados++;
  });
  state.clienteRepetirAviso=agregados ? `${agregados} ítem(s) agregados${omitidos?' · '+omitidos+' requieren elegir de nuevo':''}` : 'Esta ronda requiere elegir sus opciones de nuevo.';
  render();
}
async function enviarPedido(){
  if(!state.clienteCart.length || state.clientePedidoEnviando) return;
  const esRonda=Boolean(findMesa(state.clienteMesa)&&findMesa(state.clienteMesa).pedido);
  const unidades=cantidadCarrito();
  const items = state.clienteCart.flatMap(item=>Array.from({length:cantidadLinea(item)},()=>{
    const payload = {productoId:item.productoId, observacion:item.observacion};
    if(item.variante) payload.variante = item.variante;
    if(item.opcion) payload.opcion = item.opcion;
    return payload;
  }));
  state.clientePedidoEnviando=true;
  state.clientePedidoError='';
  render();
  try{
    const response=await send({type:'pedido_nuevo', mesa:state.clienteMesa, items});
    let payload={};
    if(response){ try{ payload=await response.json(); }catch(e){} }
    if(!response || !response.ok) throw new Error(payload.error || 'No pudimos conectar con Rabieta. Revisá tu conexión y probá de nuevo.');
    state.clienteCart=[]; guardarCarritoLocal();
    state.clienteRepetirAviso='';
    state.modal={type:'pedido-enviado',unidades,esRonda};
  }catch(error){
    state.clientePedidoError=error && error.message ? error.message : 'No pudimos enviar el pedido. Probá de nuevo.';
    state.modal={type:'cart'};
  }finally{
    state.clientePedidoEnviando=false;
    render();
  }
}
function llamarMozo(){ state.clienteServicioError=''; state.modal = {type:'confirm-mozo'}; render(); }
async function confirmarLlamarMozo(){
  if(state.clienteServicioEnviando) return;
  state.clienteServicioEnviando=true; state.clienteServicioError=''; render();
  const response=await send({type:'llamar_mozo', mesa:state.clienteMesa});
  state.clienteServicioEnviando=false;
  if(!response || !response.ok){
    let payload={}; if(response){ try{ payload=await response.json(); }catch(e){} }
    state.clienteServicioError=payload.error || 'No pudimos avisar a salón. Revisá tu conexión y probá de nuevo.'; render(); return;
  }
  state.modal = {type:'mozo-enviado'}; render();
  setTimeout(()=>{ if(state.modal && state.modal.type==='mozo-enviado'){ state.modal=null; render(); } }, 4500);
}
function pedirCuenta(){ state.clienteServicioError=''; state.modal={type:'confirm-cuenta'}; render(); }
async function confirmarPedirCuenta(){
  if(state.clienteServicioEnviando) return;
  state.clienteServicioEnviando=true; state.clienteServicioError=''; render();
  const response=await send({type:'pedir_cuenta', mesa:state.clienteMesa});
  state.clienteServicioEnviando=false;
  if(!response || !response.ok){
    let payload={}; if(response){ try{ payload=await response.json(); }catch(e){} }
    state.clienteServicioError=payload.error || 'No pudimos pedir la cuenta. Revisá tu conexión y probá de nuevo.'; render(); return;
  }
  state.clienteCart=[]; guardarCarritoLocal(); state.clienteRepetirAviso=''; state.clientePedidoError='';
  state.modal={type:'cuenta-enviada'}; render();
}
function abrirCheckout(){ state.clientePagoError=''; state.modal={type:'checkout'}; render(); }
function elegirMedioPago(medio){ state.clientePagoMedio=medio; render(); }
function abrirCheckoutMercadoPago(el){
  const url = el && el.dataset && el.dataset.mpCheckoutUrl;
  if(url) window.open(url, '_blank', 'noopener');
}
async function confirmarPagoSandbox(){
  if(state.clientePagoEnviando) return;
  state.clientePagoEnviando=true; state.clientePagoError=''; render();
  const usaMercadoPagoReal = state.clientePagoMedio==='mercado_pago' && state.mercadoPagoDisponible;
  const response = await send(usaMercadoPagoReal
    ? {type:'pago_mercadopago_iniciar', mesa:state.clienteMesa}
    : {type:'pago_sandbox_confirmar', mesa:state.clienteMesa, medio:state.clientePagoMedio});
  state.clientePagoEnviando=false;
  if(!response || !response.ok){
    let payload={}; try{ payload=await response.json(); }catch(e){}
    state.clientePagoError=payload.error || (usaMercadoPagoReal ? 'No pudimos iniciar el pago con Mercado Pago. Probá de nuevo.' : 'No pudimos completar el pago demo. Probá de nuevo.');
    render(); return;
  }
  state.modal=null; render();
}
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
  agregarLineaCarrito({productoId:id,variante:null,opcion:null,observacion:'',nombre:p.nombre,precio,notas:''});
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
    crmConsentimiento,
    // El draft siempre trae un crmCanal por defecto ('whatsapp') para que el
    // selector no arranque vacío el día que se tilde el consentimiento — pero
    // si nunca se tildó, mandarlo igual hacía que el servidor viera "hay datos
    // de contacto" y exigiera consentimiento para calificar sin querer
    // compartir nada. Solo van si el cliente aceptó de verdad.
    ...(crmConsentimiento ? {crmCanal, crmContacto, crmNombre} : {}),
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
function nuevaSolicitudAyudaId(){
  if(globalThis.crypto && typeof globalThis.crypto.randomUUID==='function') return globalThis.crypto.randomUUID();
  return 'ayuda-'+Date.now().toString(36)+'-'+Math.random().toString(36).slice(2);
}
function actualizarAyudaDraft(value){
  state.clienteAyudaDraft=value;
  const button=document.getElementById('sendFreeHelp');
  if(button) button.disabled=!value.trim() || state.clienteAyudaEnviando;
}
async function enviarAyuda(id,mensaje='',reintento=false){
  if(state.clienteAyudaEnviando) return;
  const categoria=HELP_CATEGORIAS.find(item=>item.id===id);
  if(!categoria && id!=='otro') return;
  const limpio=String(mensaje||'').trim();
  if(id==='otro' && !limpio) return;
  if(!reintento || !state.clienteAyudaPendiente){
    state.clienteAyudaPendiente={categoria:id,mensaje:limpio,solicitudId:nuevaSolicitudAyudaId(),label:categoria?categoria.label:'Mensaje a salón'};
  }
  const pendiente=state.clienteAyudaPendiente;
  state.clienteAyudaEnviando=true; state.clienteAyudaError=''; render();
  const response=await send({type:'ayuda',mesa:state.clienteMesa,categoria:pendiente.categoria,mensaje:pendiente.mensaje,solicitudId:pendiente.solicitudId});
  state.clienteAyudaEnviando=false;
  if(!response || !response.ok){
    let payload={}; if(response){ try{ payload=await response.json(); }catch(e){} }
    state.clienteAyudaError=payload.error || 'No pudimos avisar a salón. Revisá tu conexión y probá de nuevo.';
    state.clienteHelpOpen=true; render(); return;
  }
  state.clienteAyudaDraft=''; state.clienteAyudaPendiente=null; state.clienteHelpOpen=false;
  state.modal={type:'ayuda-enviada',label:pendiente.label,mensaje:pendiente.mensaje}; render();
}
function reintentarAyuda(){
  const pendiente=state.clienteAyudaPendiente;
  if(pendiente) enviarAyuda(pendiente.categoria,pendiente.mensaje,true);
}
function enviarAyudaLibre(){ enviarAyuda('otro',state.clienteAyudaDraft); }
function helpPanelHtml(){
  const pendiente=state.clienteAyudaPendiente;
  return `<div class="card help-panel" aria-busy="${state.clienteAyudaEnviando?'true':'false'}" style="margin-top:14px;">
    <div class="help-panel-head"><div><strong>¿En qué te podemos ayudar?</strong><span>El aviso llega directamente a Salón.</span></div>${state.clienteAyudaEnviando?'<span class="help-sending">Enviando…</span>':''}</div>
    ${state.clienteAyudaError?`<div class="help-send-error" role="alert">${ic('warning')}<div><strong>No se envió la solicitud.</strong><span>${escapeHtml(state.clienteAyudaError)} Tu elección y mensaje siguen acá.</span><button class="btn critical sm" onclick="reintentarAyuda()">Reintentar solicitud</button></div></div>`:''}
    <div class="help-cats">${HELP_CATEGORIAS.map(h=>`<button ${state.clienteAyudaEnviando?'disabled':''} onclick="enviarAyuda('${h.id}')">${state.clienteAyudaEnviando&&pendiente&&pendiente.categoria===h.id?'Enviando…':h.label}</button>`).join('')}</div>
    <div style="font-size:12px;color:var(--ink-muted);margin-bottom:6px;">O contanos con tus palabras:</div>
    <textarea class="nota help-message" id="freeHelp" maxlength="500" ${state.clienteAyudaEnviando?'disabled':''} placeholder='Ej: "Pedí sin cebolla y vino con cebolla"' oninput="actualizarAyudaDraft(this.value)">${escapeHtml(state.clienteAyudaDraft)}</textarea>
    <div style="margin-top:8px;display:flex;gap:8px;">
      <button class="btn critical sm" id="sendFreeHelp" ${state.clienteAyudaEnviando||!state.clienteAyudaDraft.trim()?'disabled':''} onclick="enviarAyudaLibre()">${state.clienteAyudaEnviando&&pendiente&&pendiente.categoria==='otro'?'Enviando…':'Enviar mensaje'}</button>
      <button class="btn ghost sm" ${state.clienteAyudaEnviando?'disabled':''} onclick="toggleHelp()">Cancelar</button>
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
// Mozo se lee parado, con una mano, entre mesas — así que en vez del viejo
// dashboard de tarjetas (tus alertas / cola de entrega / tus mesas, cada una
// con su propio bloque) esto junta TODO lo que un mozo tiene que resolver
// ahora en una sola lista viva, ordenada por urgencia y después por espera:
// MESA + qué necesita + hace cuánto + un solo botón de acción. Las mesas
// tranquilas (sin nada pendiente) ni aparecen — no hay nada que decidir ahí.
function mozoEventos(mozo){
  const eventos=[];
  todasAlertasAbiertas().filter(x=>x.mesa.mozo===mozo).forEach(({mesa,alerta})=>{
    const enDemo = state.presentacionCargada && STAFF_ALLOWED_VIEWS.includes('encargado');
    eventos.push({
      numero: mesa.numero,
      label: alerta.label.toUpperCase(),
      mensaje: alerta.mensaje,
      tiempo: timeAgoSec(alerta.creadoTs),
      severidad: alerta.prioridad==='urgente'?0:alerta.prioridad==='importante'?1:2,
      escalado: alerta.escalado,
      accion: alerta.estado==='recibido'?'ATENDER':'RESOLVER',
      onclick: alerta.estado==='recibido'?`marcarAtencion(${alerta.id})`:`resolverAlerta(${alerta.id})`,
      demoBadge: enDemo && mesa.numero===4 ? 'Paso 3 · resolvé este reclamo' : enDemo && mesa.numero===7 ? 'Paso 3 · atendé este llamado' : null,
    });
  });
  itemsListosParaEntregar(mozo).forEach(({mesa,item})=>{
    const enDemo = state.presentacionCargada && STAFF_ALLOWED_VIEWS.includes('encargado');
    const tiempo = timeAgoSec((item.estadoTs&&item.estadoTs.listo)||item.enviadoTs);
    eventos.push({
      numero: mesa.numero,
      label: 'PEDIDO LISTO',
      mensaje: item.nombre,
      tiempo,
      severidad: tiempo>DEMO_UMBRALES_ESPERA_SEG.urgenteSeg?0:tiempo>DEMO_UMBRALES_ESPERA_SEG.atencionSeg?1:2,
      escalado:false,
      accion:'ENTREGAR',
      onclick:`confirmarEntrega(${mesa.numero},${item.id})`,
      demoBadge: enDemo && mesa.numero===1 ? 'Paso 3 · entregá este ítem' : null,
    });
  });
  return eventos.sort((a,b)=>a.severidad-b.severidad || b.tiempo-a.tiempo);
}
const MOZO_SEV=['urgente','importante','normal'];
function mozoEventoHtml(ev){
  return `<div class="mozo-event sev-${MOZO_SEV[ev.severidad]}">
    ${ev.demoBadge?`<span class="demo-target-badge">${ev.demoBadge}</span>`:''}
    <div class="mozo-event-row">
      <div class="mozo-event-mesa">MESA<b>${String(ev.numero).padStart(2,'0')}</b></div>
      <div class="mozo-event-mid"><span class="mozo-event-label">${escapeHtml(ev.label)}</span>${ev.mensaje?`<span class="mozo-event-msg">${ev.accion==='ENTREGAR'?escapeHtml(ev.mensaje):'“'+escapeHtml(ev.mensaje)+'”'}</span>`:''}${ev.escalado?`<span class="mozo-event-esc">${ic('warning')} ESCALADO</span>`:''}</div>
      <div class="mozo-event-time">${fmtClock(ev.tiempo)}</div>
      <button class="mozo-event-btn" onclick="${ev.onclick}">${ev.accion}</button>
    </div>
  </div>`;
}
function viewMozo(){
  const eventos = mozoEventos(state.mozoActivo);
  const mesasActivas = state.mesas.filter(m=>m.mozo===state.mozoActivo && m.ocupada).length;
  return `<h1 class="view-title">MOZO</h1>
    <p class="view-sub">Sos: <select onchange="cambiarMozo(this.value)">${MOZOS.map(m=>`<option ${m===state.mozoActivo?'selected':''}>${m}</option>`).join('')}</select> · ${mesasActivas} mesa(s) activa(s)</p>
    <div class="mozo-feed">${eventos.length ? eventos.map(mozoEventoHtml).join('') : `<div class="empty">${ic('checkring')} Todo tranquilo en tus mesas — nada pendiente ahora mismo.</div>`}</div>`;
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
function alertRowHtml(mesa,a,acciones){
  const edad = timeAgoSec(a.creadoTs);
  const enDemo = state.presentacionCargada && STAFF_ALLOWED_VIEWS.includes('encargado') && acciones;
  const demoTarget = enDemo && mesa.numero===4;
  const demoTargetLlamado = enDemo && mesa.numero===7;
  return `<div class="alert-row ${a.escalado?'escalado':''}${demoTarget||demoTargetLlamado?' demo-target':''}">
    <div><div class="msg">Mesa ${mesa.numero} — ${escapeHtml(a.label)}${a.mensaje?`: "${escapeHtml(a.mensaje)}"`:''}</div>
    ${demoTarget?'<span class="demo-target-badge">Paso 3 · resolvé este reclamo</span>':demoTargetLlamado?'<span class="demo-target-badge">Paso 3 · atendé este llamado</span>':''}<div class="meta"><span class="pill ${a.prioridad}">${a.prioridad.toUpperCase()}</span> hace ${fmtSec(edad)} ${a.escalado?` · ${ic('warning')} ESCALADO`:''} ${a.estado==='atencion'?' · en atención':''}</div></div>
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
      <article class="presentation-step${demoStepClass(3)}"><span class="step-number">${state.demoPasosVistos.has(3)?ic('checkring'):'3'}</span><div><strong>Salón · Sofía</strong><p>Retirá Mesa 1, atendé el llamado al mozo de Mesa 7 y resolvé el reclamo urgente de Mesa 4.</p></div><button class="btn dark sm" onclick="irPasoDemo('mozo','Sofía',3)">${ic('plate')} Abrir Salón</button></article>
      <article class="presentation-step${demoStepClass(4)}"><span class="step-number">${state.demoPasosVistos.has(4)?ic('checkring'):'4'}</span><div><strong>Cliente · Cuenta y pago</strong><p>Mesa 3: ${escapeHtml(demoStepStatus(3))}. Elegí Mercado Pago o tarjeta demo para cerrarla — pago de prueba, sin dinero real.</p></div>${mesaDemoLinkHtml(3,'Abrir cuenta','dark','receipt',4)}</article>
      <article class="presentation-step${demoStepClass(5)}"><span class="step-number">${state.demoPasosVistos.has(5)?ic('checkring'):'5'}</span><div><strong>Dueño · Resultado</strong><p>Mesa 5: ${escapeHtml(demoStepStatus(5))}. Mirá el feed de actividad en vivo — analytics y CRM son sintéticos.</p></div><button class="btn good sm" onclick="irPasoDemo('dueno',null,5)">${ic('chart')} Abrir analytics</button></article>
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
// "Ahora en Lomitas": el pulso del turno en 4 números grandes, arriba de
// todo. Nada de compararlo contra ayer ni contra un objetivo — no hay datos
// reales para eso todavía — así que son cifras planas, sin flechitas de
// crecimiento ni color de más. El color se guarda para "qué mirar ahora".
function duenoAhoraHtml(analytics, mesasOcupadas, preparacionPromedio, ticketPromedio){
  return `<span class="dueno-hero-kicker">Ahora en Lomitas</span>
    <div class="dueno-hero">
      <div class="dueno-hero-tile"><span class="dueno-hero-value">${money(analytics.ventasDemo)}</span><span class="dueno-hero-label">Vendido</span></div>
      <div class="dueno-hero-tile"><span class="dueno-hero-value">${mesasOcupadas}<small> / ${MESAS_TOTAL}</small></span><span class="dueno-hero-label">Mesas activas</span></div>
      <div class="dueno-hero-tile"><span class="dueno-hero-value">${money(ticketPromedio)}</span><span class="dueno-hero-label">Ticket promedio</span></div>
      <div class="dueno-hero-tile"><span class="dueno-hero-value">${fmtSec(preparacionPromedio)}</span><span class="dueno-hero-label">Tiempo promedio de cocina</span></div>
    </div>`;
}
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
  const flujo = [
    {label:'Sin pedido',value:state.mesas.filter(m=>m.ocupada&&!m.pedido).length,hint:'mesas sentadas'},
    {label:'En producción',value:state.mesas.filter(m=>m.pedido&&!m.cuentaPedida&&m.pedido.items.some(i=>i.estado==='enviado'||i.estado==='preparando')).length,hint:'cocina o barra'},
    {label:'Esperando salón',value:itemsEsperandoSalon.length,hint:'ítems listos'},
    {label:'Cuenta abierta',value:state.mesas.filter(m=>m.cuentaPedida&&!m.pago).length,hint:'esperando pago'},
    {label:'Pagadas',value:state.mesas.filter(m=>m.pago&&m.pago.estado==='confirmado').length,hint:'listas para liberar'},
  ];
  const cuello = flujo.reduce((mayor,paso)=>paso.value>mayor.value?paso:mayor,flujo[0]);
  // "En 3 segundos": primero el pulso del turno (ahora en Lomitas), después
  // qué requiere una decisión (qué mirar ahora) — recién debajo de eso viene
  // el detalle/analytics acumulado, que ya estaba armado y sigue igual, solo
  // que deja de ser lo primero que se ve al entrar.
  return `<h1 class="view-title">DUEÑO</h1>
    <p class="view-sub">Panel de negocio de esta sesión. ${productosPendientes} productos todavía sin precio confirmado.</p>
    ${state.presentacionCargada?`<div class="mock-banner">${ic('checkring')} Escenario sintético de presentación activo. Estas métricas no corresponden a clientes ni ventas reales.</div>`:''}
    <div class="mock-banner">${ic('clipboard')} Los cobros son confirmaciones de demostración acumuladas por este sistema. No hay caja, POS ni dinero real conectado.</div>
    ${duenoAhoraHtml(analytics, mesasOcupadas, preparacionPromedio, ticketPromedio)}
    ${mesasAtencionHtml()}
    <div class="section-h">Embudo operativo ahora</div>
    <div class="owner-funnel">
      ${flujo.map((paso,index)=>`<div class="funnel-step ${paso.value?'active':''}"><span class="funnel-index">${index+1}</span><div><b>${paso.label}</b><small>${paso.hint}</small></div><strong>${paso.value}</strong></div>`).join('')}
    </div>
    <div class="owner-focus ${cuello.value?'attention':''}">${cuello.value?`${ic('warning')} Foco sugerido: <b>${cuello.label}</b> concentra ${cuello.value} unidad(es) ahora.`:`${ic('checkring')} No hay cuellos de botella activos en este momento.`}</div>
    ${actividadRecienteHtml(analytics)}
    <div class="section-h">Detalle de la sesión</div>
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
    ${viewPagosReadinessHtml()}
    ${view3dReadinessHtml()}`;
}
function viewPagosReadinessHtml(){
  const mp = (state.integraciones && state.integraciones.mercadoPago) || {accessToken:false,publicKey:false,webhookSecret:false};
  const items = [
    {label:'Cobro sandbox en la demo', ready:true, detail:'Tarjeta demo y Mercado Pago sandbox ya funcionan en el flujo de cuenta. No mueven dinero real.'},
    {label:'Access Token de Mercado Pago', ready:mp.accessToken, detail:mp.accessToken?'Variable de entorno MERCADOPAGO_ACCESS_TOKEN configurada en este servidor.':'Falta cargar MERCADOPAGO_ACCESS_TOKEN como variable de entorno del servidor. Nunca debe escribirse en el repositorio.'},
    {label:'Public Key de Mercado Pago', ready:mp.publicKey, detail:mp.publicKey?'Variable de entorno MERCADOPAGO_PUBLIC_KEY configurada en este servidor.':'Falta cargar MERCADOPAGO_PUBLIC_KEY para el checkout del cliente.'},
    {label:'Webhook de confirmación firmado', ready:mp.webhookSecret, detail:mp.webhookSecret?'MERCADOPAGO_WEBHOOK_SECRET configurado; falta implementar la verificación real de la firma.':'Falta MERCADOPAGO_WEBHOOK_SECRET y el endpoint que valide notificaciones reales de pago.'},
    {label:'Conciliación con caja/POS', ready:false, detail:'Pendiente de Fase 3 del roadmap; requiere decisión del dueño sobre el POS a integrar.'},
  ];
  const listas = items.filter(i=>i.ready).length;
  return `<div class="section-h">Preparación de Mercado Pago</div>
    <div class="mock-banner">${ic('clipboard')} Ningún pago real se procesa todavía. Activar Mercado Pago en producción requiere credenciales propias de Rabieta y aprobación del dueño antes de mover dinero real.</div>
    <div class="grid cols-3 asset-summary">
      ${statTile('Listo para producción', `${listas} / ${items.length}`, listas<items.length?'faltan pasos por confirmar':'checklist completo', listas<items.length?'downAlert':null)}
    </div>
    <div class="asset-grid">${items.map(i=>`<article class="asset-card"><div class="asset-card-head"><strong>${escapeHtml(i.label)}</strong><span class="pill ${i.ready?'normal':'importante'}">${i.ready?'Listo':'Falta'}</span></div>
      <p>${escapeHtml(i.detail)}</p></article>`).join('')}</div>`;
}
function view3dReadinessHtml(){
  const platos=platosDestacadosData();
  const conFoto=platos.filter(p=>Boolean(p.imagen));
  const sinFoto=platos.filter(p=>!p.imagen);
  const reales=modelosRealesDisponibles();
  const conGlb=platos.filter(p=>reales[p.id] && reales[p.id].glb);
  const conUsdz=platos.filter(p=>reales[p.id] && reales[p.id].usdz);
  const publicables=platos.filter(p=>reales[p.id] && reales[p.id].glb && reales[p.id].usdz);
  return `<div class="section-h">Preparación 3D/AR por plato</div>
    <div class="${conGlb.length?'secure-banner':'mock-banner'}">${ic(conGlb.length?'checkring':'warning')} ${conGlb.length
      ? `${conGlb.length} de ${platos.length} platos ya tienen un modelo real cargado en public/models/. El resto sigue con el modelo genérico, rotulado como prototipo técnico.`
      : 'Prototipo técnico: hoy se usa un modelo genérico solo para validar cámara e interacción. Ningún plato tiene todavía un modelo 3D real publicable. La infraestructura ya está lista: alcanza con dejar el .glb/.usdz en public/models/ con el nombre exacto del plato (ver public/models/LEEME.md), sin tocar código.'}</div>
    <div class="grid cols-3 asset-summary">
      ${statTile('Modelos 3D reales', `${conGlb.length} / ${platos.length}`, publicables.length===platos.length?'todos publicables':`faltan ${platos.length-conGlb.length} GLB + ${platos.length-conUsdz.length} USDZ`, conGlb.length<platos.length?'downAlert':null)}
      ${statTile('Fotos reales', `${conFoto.length} / ${platos.length}`, sinFoto.length?`faltan ${sinFoto.map(p=>p.nombre).join(' y ')}`:'referencias completas', sinFoto.length?'downAlert':null)}
      ${statTile('Shell AR', 'Listo', 'detecta y usa modelos reales solo', null)}
    </div>
    <div class="asset-grid">${platos.map(p=>{
      const modelo=reales[p.id]||{};
      const publicable=Boolean(modelo.glb && modelo.usdz);
      const missing=[];
      if(!modelo.glb) missing.push(`GLB real de ${p.nombre}`);
      if(!modelo.usdz) missing.push(`USDZ real de ${p.nombre}`);
      if(!p.imagen) missing.push(`foto real de ${p.nombre}`);
      return `<article class="asset-card"><div class="asset-card-head"><strong>${escapeHtml(p.nombre)}</strong><span class="pill ${publicable?'normal':'importante'}">${publicable?'Publicable':'No publicable'}</span></div>
        <div class="asset-line"><span>Foto real de referencia</span><b class="${p.imagen?'ready':'pending'}">${p.imagen?'Lista':'Falta'}</b></div>
        <div class="asset-line"><span>Modelo GLB real</span><b class="${modelo.glb?'ready':'pending'}">${modelo.glb?'Cargado':'Falta'}</b></div>
        <div class="asset-line"><span>Modelo USDZ real (iPhone)</span><b class="${modelo.usdz?'ready':'pending'}">${modelo.usdz?'Cargado':'Falta'}</b></div>
        ${missing.length?`<p><b>Falta exactamente:</b> ${escapeHtml(missing.join(' · '))}.</p>`:'<p><b>Listo para publicar.</b></p>'}</article>`;
    }).join('')}</div>`;
}
function statTile(label,value,delta,deltaClass){
  return `<div class="stat-tile"><div class="label">${label}</div>
    <div class="value ${deltaClass==='downAlert'?'alert':''}">${value}</div>
    ${delta?`<div class="delta ${deltaClass==='up'?'up':deltaClass==='downAlert'?'down':''}">${delta}</div>`:''}</div>`;
}
// Junta, en un solo vistazo, qué mesa concreta necesita algo ahora y qué
// acción resuelve eso — para que el dueño no tenga que traducir "2 alertas
// activas" en cuáles mesas son. Si una mesa tiene más de un problema, se
// muestra solo el más grave para no saturar la lista.
function mesasQueNecesitanAtencion(){
  // Umbrales locales (duplicados a propósito de DEMO_UMBRALES_ESPERA_SEG,
  // más arriba en este archivo): esta función corre aislada en un test que
  // la extrae y la ejecuta en un contexto mínimo sin el resto del módulo, así
  // que no puede depender de esa constante compartida. Mismos valores, misma
  // advertencia — son un umbral de demo razonable, no un SLA confirmado por
  // Rabieta.
  const ATENCION_SEG=60, URGENTE_SEG=180, COCINA_LENTA_SEG=480;
  const candidatos = [];
  todasAlertasAbiertas().forEach(({mesa,alerta})=>{
    candidatos.push({
      numero: mesa.numero,
      severidad: alerta.prioridad==='urgente'?0:alerta.prioridad==='importante'?1:2,
      espera: timeAgoSec(alerta.creadoTs),
      motivo: alerta.label,
      accion: 'Resolver desde Salón',
    });
  });
  itemsListosParaEntregar(null).forEach(({mesa,item})=>{
    const espera = timeAgoSec(item.estadoTs.listo||item.enviadoTs);
    if(espera<ATENCION_SEG) return;
    candidatos.push({
      numero: mesa.numero,
      severidad: espera>URGENTE_SEG?0:1,
      espera,
      motivo: `${item.nombre} esperando en ${DESTINO_LABELS[itemDestino(item)]}`,
      accion: 'Retirar y llevar a la mesa',
    });
  });
  state.mesas.forEach(mesa=>{
    if(!mesa.cuentaPedida || mesa.pago) return;
    const espera = timeAgoSec(mesa.cuentaPedidaTs);
    if(espera<ATENCION_SEG) return;
    candidatos.push({
      numero: mesa.numero,
      severidad: espera>URGENTE_SEG?0:1,
      espera,
      motivo: 'Pidió la cuenta y todavía no se cobró',
      accion: 'Cobrar o confirmar el pago',
    });
  });
  // Cocina/barra lenta: un ítem que sigue "preparando" mucho más de lo normal
  // es exactamente el tipo de cosa que el dueño quiere ver sin tener que
  // preguntarle a nadie. estadoTs.preparando no existe en mesas sin pedido
  // real (p.ej. las que arma el test con datos mínimos), así que esto no
  // agrega nada cuando no hay de dónde sacar la fecha.
  state.mesas.forEach(mesa=>{
    if(!mesa.pedido) return;
    mesa.pedido.items.forEach(item=>{
      if(item.estado!=='preparando') return;
      const desde = item.estadoTs && Number.isFinite(item.estadoTs.preparando) ? item.estadoTs.preparando : item.enviadoTs;
      const espera = timeAgoSec(desde);
      if(espera<COCINA_LENTA_SEG) return;
      candidatos.push({
        numero: mesa.numero,
        severidad: 0,
        espera,
        motivo: `${DESTINO_LABELS[itemDestino(item)]} lleva ${fmtSec(espera)} con ${item.nombre}`,
        accion: 'Revisar con cocina/barra',
      });
    });
  });
  const peorPorMesa = new Map();
  candidatos.forEach(item=>{
    const existente = peorPorMesa.get(item.numero);
    if(!existente || item.severidad<existente.severidad) peorPorMesa.set(item.numero,item);
  });
  return [...peorPorMesa.values()].sort((a,b)=>a.severidad-b.severidad || b.espera-a.espera).slice(0,6);
}
// Además de lo puntual por mesa, un sector entero acumulando pendientes es
// otra cosa que el dueño quiere ver de entrada aunque ninguna mesa individual
// esté todavía "urgente" — 3+ ítems sin salir de cocina o barra ya es una
// señal de que ese sector se está quedando atrás.
function sectoresConCola(){
  const counts = {cocina:0, barra:0};
  state.mesas.forEach(mesa=>{
    if(!mesa.pedido) return;
    mesa.pedido.items.forEach(item=>{
      if(item.estado==='enviado' || item.estado==='preparando') counts[itemDestino(item)]++;
    });
  });
  return ['cocina','barra'].filter(d=>counts[d]>=3).map(d=>({destino:d, label:DESTINO_LABELS[d], cantidad:counts[d]}));
}
function mesasAtencionHtml(){
  const items = mesasQueNecesitanAtencion();
  const sectores = sectoresConCola();
  const SEVERIDAD_LABEL = ['urgente','importante','normal'];
  return `<span class="dueno-watch-kicker">Qué mirar ahora</span>
    <div class="section-h">${ic('warning')} Mesas que necesitan atención</div>
    ${items.length || sectores.length ? `<div class="attention-list">
      ${items.map(it=>`<div class="attention-row sev-${SEVERIDAD_LABEL[it.severidad]}">
        <span class="pill ${SEVERIDAD_LABEL[it.severidad]}">Mesa ${it.numero}</span>
        <span class="attention-motivo">${escapeHtml(it.motivo)}<small>hace ${fmtSec(it.espera)}</small></span>
        <span class="attention-accion">${escapeHtml(it.accion)}</span>
      </div>`).join('')}
      ${sectores.map(s=>`<div class="attention-row sev-importante">
        <span class="pill importante">${escapeHtml(s.label)}</span>
        <span class="attention-motivo">${s.cantidad} ítem(s) pendientes en el sector<small>sin salir todavía</small></span>
        <span class="attention-accion">Reforzar el sector</span>
      </div>`).join('')}
    </div>`
      : `<div class="empty">${ic('checkring')} Ninguna mesa necesita atención ahora mismo.</div>`}`;
}
const ACTIVIDAD_ICONOS = {pedido:'plate', alerta:'bell', cuenta:'receipt', pago:'checkring', resena:'chart', mesa:'refresh'};
function actividadRecienteHtml(analytics){
  const items = (analytics.actividad||[]).slice(0,8);
  return `<div class="section-h">${ic('sound')} Actividad en vivo</div>
    ${items.length ? `<div class="activity-feed">${items.map(item=>`<div class="activity-item"><span class="activity-icon ${item.tipo}">${ic(ACTIVIDAD_ICONOS[item.tipo]||'clipboard')}</span><span class="activity-text">${escapeHtml(item.texto)}</span><span class="activity-time">hace ${fmtSec(timeAgoSec(item.ts))}</span></div>`).join('')}</div>`
      : '<div class="empty">Todavía no pasó nada en esta sesión. Apenas alguien pida, llame al mozo o pague, va a aparecer acá al instante.</div>'}`;
}
