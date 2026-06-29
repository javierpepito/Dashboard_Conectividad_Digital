/* =====================================================================
   CONFIGURACIÓN
   ===================================================================== */
// Servido desde el propio Flask -> mismo origen ("").
// Si abres el HTML aparte y Flask corre en otro puerto, pon p.ej.
// "http://localhost:5000" y habilita CORS en Flask.
const API_BASE   = "";          // mismo origen
const REFRESH_MS = 30000;       // auto-refresco cada 30 s (0 = desactivado)

/* =====================================================================
   DATOS DEMO DE RESPALDO (si la API/DWH no responde, el panel no queda en blanco)
   ===================================================================== */
const DEMO = {
  sla: {
    uptime:      { valor:99.6, umbral:99,  unidad:"%",    dir:"min", estado:"verde"  },
    freshness:   { valor:4,    umbral:20,  unidad:" días",dir:"max", estado:"verde"  },
    completitud: { valor:98.2, umbral:97,  unidad:"%",    dir:"min", estado:"verde"  },
    latencia:    { valor:1.4,  umbral:2,   unidad:" min", dir:"max", estado:"verde"  },
    error:       { valor:0.3,  umbral:0.5, unidad:"%",    dir:"max", estado:"verde"  },
    global:"verde"
  },
  kpi_principal: {
    indice_brecha:48.3, estado:"rojo", grupo_afectado:"60+",
    media_general_mbps:87.4, vel_grupo_mbps:45.2,
    pct_sin_acceso:3.1, volumen:64,
    velocidad_rango:[
      {rango:"14-24",download:121.5},{rango:"25-40",download:104.8},
      {rango:"41-60",download:77.9},{rango:"60+",download:45.2}
    ],
    horas_rango:[
      {rango:"14-24",horas:7.2},{rango:"25-40",horas:6.1},
      {rango:"41-60",horas:4.3},{rango:"60+",horas:2.8}
    ]
  },
  distribucion: { tipos:[
    {tipo:"Fibra óptica",cantidad:24},{tipo:"Banda ancha hogar",cantidad:14},
    {tipo:"Móvil 4G",cantidad:13},{tipo:"Móvil 5G",cantidad:9},{tipo:"Sin acceso",cantidad:4}
  ]},
  completitud: { global_pct:98.2, campos:[
    {campo:"edad",completitud:100,nulos:0},
    {campo:"tipo_conexion",completitud:98.4,nulos:1.6},
    {campo:"velocidad_bajada",completitud:96.9,nulos:3.1},
    {campo:"velocidad_subida",completitud:95.3,nulos:4.7},
    {campo:"horas_uso",completitud:98.4,nulos:1.6},
    {campo:"proposito_uso",completitud:97.8,nulos:2.2}
  ]},
  historico: { umbral:97, ciclos:[
    {etiqueta:"c-9",valor:96.8},{etiqueta:"c-8",valor:97.2},{etiqueta:"c-7",valor:97.9},
    {etiqueta:"c-6",valor:98.1},{etiqueta:"c-5",valor:97.5},{etiqueta:"c-4",valor:98.4},
    {etiqueta:"c-3",valor:98.0},{etiqueta:"c-2",valor:98.3},{etiqueta:"c-1",valor:98.6},
    {etiqueta:"ahora",valor:98.2}
  ]}
};

/* =====================================================================
   UTILIDADES
   ===================================================================== */
const C = { verde:"#3FB950", amarillo:"#D9A521", rojo:"#F85149",
            verdeBg:"rgba(63,185,80,.13)", amarilloBg:"rgba(217,165,33,.14)", rojoBg:"rgba(248,81,73,.14)" };
const TXT = "#9BA7B5", GRID = "rgba(255,255,255,.05)";
const $ = id => document.getElementById(id);

function calcEstado(v, umbral, dir){
  if(dir==="min") return v>=umbral ? "verde" : (v>=umbral*0.95 ? "amarillo" : "rojo");
  return v<=umbral ? "verde" : (v<=umbral*1.1 ? "amarillo" : "rojo");
}
function pintar(estado){ return {verde:C.verde,amarillo:C.amarillo,rojo:C.rojo}[estado]||C.verde; }
function pintarBg(estado){ return {verde:C.verdeBg,amarillo:C.amarilloBg,rojo:C.rojoBg}[estado]||C.verdeBg; }
function etiqueta(estado){ return {verde:"Cumple SLA",amarillo:"Advertencia",rojo:"Incumplimiento"}[estado]; }

async function fetchJSON(path){
  try{
    const r = await fetch(API_BASE + path, {cache:"no-store"});
    if(!r.ok) throw new Error(r.status);
    return await r.json();
  }catch(e){ return null; }   // -> caerá al demo
}

/* =====================================================================
   RENDER
   ===================================================================== */
const SLA_DEF = [
  ["uptime","Uptime","≥ 99%"],["freshness","Freshness","≤ 20 días"],
  ["completitud","Completitud","≥ 97%"],["latencia","Latencia ETL","≤ 2 min"],
  ["error","Tasa error","≤ 0,5%"]
];

function renderSLA(sla){
  $("slaGrid").innerHTML = SLA_DEF.map(([k,lab,thr])=>{
    const d = sla[k];
    const est = d.estado || calcEstado(d.valor, d.umbral, d.dir);
    const col = pintar(est);
    return `<div class="sla-cell" style="border-left:3px solid ${col}">
      <div class="led" style="background:${col}"></div>
      <div class="lab">${lab}</div>
      <div class="val">${d.valor}<span style="font-size:13px;color:var(--text-3)">${d.unidad||""}</span></div>
      <div class="thr">umbral ${thr}</div>
    </div>`;
  }).join("");
  const g = sla.global || "verde";
  const pill = $("globalPill");
  pill.style.background = pintarBg(g);
  pill.style.color = pintar(g);
  pill.querySelector(".led").style.background = pintar(g);
  $("globalTxt").textContent = "Global · "+etiqueta(g);
}

function renderHero(k){
  $("heroVal").textContent = k.indice_brecha.toFixed(1);
  $("heroLed").style.background = pintar(k.estado);
  $("heroVal").style.color = pintar(k.estado);
  $("heroGrupo").textContent = k.grupo_afectado;
  $("heroVelRango").textContent = k.vel_grupo_mbps.toFixed(1)+" Mbps";
  $("heroMedia").textContent = k.media_general_mbps.toFixed(1)+" Mbps";
  $("heroDesc").textContent =
    `El rango ${k.grupo_afectado} navega un ${k.indice_brecha.toFixed(1)}% por debajo de la media general — `+
    (k.estado==="rojo"?"brecha generacional severa.":k.estado==="amarillo"?"brecha a vigilar.":"dentro de lo esperado.");
}

function kpiCard(el,{name,sub,value,unit,meta,estado,tagTxt}){
  const col = pintar(estado);
  $(el).innerHTML = `
    <div class="top-row">
      <div><div class="name">${name}</div><div class="sub">${sub}</div></div>
      <span class="led" style="background:${col}"></span>
    </div>
    <div class="num" style="color:${col}">${value}<small>${unit||""}</small></div>
    <div class="meta">${meta}</div>
    <span class="tag" style="background:${pintarBg(estado)};color:${col}">${tagTxt||etiqueta(estado)}</span>`;
}

function renderCards(k, sla){
  const accEst = k.pct_sin_acceso<=3.5 ? "verde" : (k.pct_sin_acceso<=6?"amarillo":"rojo");
  kpiCard("kpiAcceso",{name:"% sin acceso a internet",sub:"AVG sobre tiene_acceso",
    value:k.pct_sin_acceso.toFixed(1),unit:"%",meta:"ref. SUBTEL 3,5%",estado:accEst});

  const volEst = k.volumen>=60 ? "verde" : "rojo";
  kpiCard("kpiVolumen",{name:"Volumen de registros",sub:"COUNT(*) del dataset",
    value:k.volumen,unit:"",meta:"mínimo requerido ≥ 60",estado:volEst,
    tagTxt: volEst==="verde"?"Suficiente":"Insuficiente"});

  const comp = sla.completitud;
  const compEst = comp.estado || calcEstado(comp.valor,comp.umbral,"min");
  kpiCard("kpiCompletitud",{name:"Completitud de campos",sub:"reglas de calidad DMBOK",
    value:comp.valor.toFixed(1),unit:"%",meta:"umbral SLA ≥ 97%",estado:compEst});

  const lat = sla.latencia;
  const latEst = lat.estado || calcEstado(lat.valor,lat.umbral,"max");
  kpiCard("kpiLatencia",{name:"Latencia último ETL",sub:"job Pentaho · log_etl",
    value:lat.valor.toFixed(1),unit:" min",meta:"umbral SLA ≤ 2 min",estado:latEst});
}

/* ---------- Gráficos ---------- */
let charts = {};
function destroy(){ Object.values(charts).forEach(c=>c&&c.destroy()); charts={}; }
function renderCharts(k, dist, hist){
  destroy();
  Chart.defaults.font.family = "'IBM Plex Mono', monospace";
  Chart.defaults.font.size = 10;
  Chart.defaults.color = TXT;

  charts.vel = new Chart($("velChart"),{type:"bar",
    data:{labels:k.velocidad_rango.map(r=>r.rango),
      datasets:[{data:k.velocidad_rango.map(r=>r.download),
        backgroundColor:k.velocidad_rango.map(r=>r.rango===k.grupo_afectado?C.rojo:"#2DD4BF"),
        borderRadius:4,barThickness:26}]},
    options:{responsive:true,maintainAspectRatio:false,
      plugins:{legend:{display:false},tooltip:{callbacks:{label:c=>c.parsed.y+" Mbps"}}},
      scales:{y:{grid:{color:GRID},ticks:{callback:v=>v}},x:{grid:{display:false}}}}});

  charts.dist = new Chart($("distChart"),{type:"doughnut",
    data:{labels:dist.tipos.map(t=>t.tipo),
      datasets:[{data:dist.tipos.map(t=>t.cantidad),
        backgroundColor:["#2DD4BF","#3B82F6","#A78BFA","#F59E0B","#6B7685"],
        borderColor:"#161B22",borderWidth:2}]},
    options:{responsive:true,maintainAspectRatio:false,cutout:"58%",
      plugins:{legend:{position:"right",labels:{boxWidth:10,boxHeight:10,padding:9,font:{size:11}}}}}});

  charts.hist = new Chart($("histChart"),{type:"line",
    data:{labels:hist.ciclos.map(c=>c.etiqueta),
      datasets:[
        {data:hist.ciclos.map(c=>c.valor),borderColor:"#2DD4BF",
          backgroundColor:"rgba(45,212,191,.1)",borderWidth:2,fill:true,tension:.35,
          pointRadius:3,pointBackgroundColor:"#2DD4BF"},
        {data:hist.ciclos.map(()=>hist.umbral),borderColor:C.amber,borderWidth:1,
          borderDash:[5,4],pointRadius:0,fill:false}
      ]},
    options:{responsive:true,maintainAspectRatio:false,
      plugins:{legend:{display:false},tooltip:{callbacks:{label:c=>c.dataset.borderDash?"umbral "+c.parsed.y+"%":c.parsed.y+"%"}}},
      scales:{y:{min:94,max:100,grid:{color:GRID},ticks:{callback:v=>v+"%"}},x:{grid:{display:false}}}}});

  charts.horas = new Chart($("horasChart"),{type:"bar",
    data:{labels:k.horas_rango.map(r=>r.rango),
      datasets:[{data:k.horas_rango.map(r=>r.horas),backgroundColor:"#A78BFA",borderRadius:4,barThickness:22}]},
    options:{indexAxis:"y",responsive:true,maintainAspectRatio:false,
      plugins:{legend:{display:false},tooltip:{callbacks:{label:c=>c.parsed.x+" h/día"}}},
      scales:{x:{grid:{color:GRID},ticks:{callback:v=>v+"h"}},y:{grid:{display:false}}}}});
}

function renderQuality(comp){
  $("qualityBody").innerHTML = comp.campos.map(c=>{
    const est = c.completitud>=97?"verde":(c.completitud>=90?"amarillo":"rojo");
    const col = pintar(est);
    return `<tr>
      <td class="campo">${c.campo}</td>
      <td class="r"><div class="bar-cell">
        <span>${c.completitud.toFixed(1)}%</span>
        <span class="bar-track"><span class="bar-fill" style="width:${c.completitud}%;background:${col}"></span></span>
      </div></td>
      <td class="r" style="color:${c.nulos>3?C.amber:'var(--text-3)'}">${c.nulos.toFixed(1)}%</td>
    </tr>`;
  }).join("");
}

/* =====================================================================
   ANIMACIÓN DE CONTEO ASCENDENTE (una sola vez)
   ===================================================================== */
function _easeOutCubic(t){return 1-Math.pow(1-t,3);}
function _countUp(node){
  const raw = node.nodeValue;
  const m = raw.match(/^(\s*)(\d+(?:[.,]\d+)?)(.*)$/s);
  if(!m) return;
  const pre=m[1], numStr=m[2].replace(',','.'), suffix=m[3];
  const target=parseFloat(numStr);
  if(isNaN(target)) return;
  const decimals=(numStr.split('.')[1]||'').length;
  const dur=1000, start=performance.now();
  function step(now){
    const t=Math.min(1,(now-start)/dur);
    const v=(target*_easeOutCubic(t)).toFixed(decimals);
    node.nodeValue=pre+v+suffix;
    if(t<1) requestAnimationFrame(step); else node.nodeValue=raw;
  }
  requestAnimationFrame(step);
}
let _counted=false;
function animateNumbers(){
  if(_counted) return; _counted=true;
  try{
    document.querySelectorAll('#heroVal, .kpi .num, .sla-cell .val, .hero-foot .v')
      .forEach(el=>{ const tn=el.firstChild; if(tn&&tn.nodeType===3) _countUp(tn); });
  }catch(e){}
}

/* =====================================================================
   CARGA PRINCIPAL
   ===================================================================== */
function marcarFuente(live){
  const f = $("feed");
  f.className = "feed " + (live?"live":"demo");
  $("feedText").textContent = live ? "datos en vivo" : "datos demo (DWH/API sin respuesta)";
}

async function loadAll(){
  $("refreshBtn").disabled = true;
  const [sla,kpi,dist,comp,hist] = await Promise.all([
    fetchJSON("/sla"), fetchJSON("/kpi_principal"), fetchJSON("/distribucion"),
    fetchJSON("/completitud"), fetchJSON("/historico")
  ]);
  const anyLive = [sla,kpi,dist,comp,hist].some(x=>x!==null);
  marcarFuente(anyLive);

  const S = sla||DEMO.sla, K = kpi||DEMO.kpi_principal,
        D = dist||DEMO.distribucion, Q = comp||DEMO.completitud, H = hist||DEMO.historico;

  renderSLA(S);
  renderHero(K);
  renderCards(K, S);
  renderCharts(K, D, H);
  renderQuality(Q);
  animateNumbers();
  $("refreshBtn").disabled = false;
}

loadAll();
if(REFRESH_MS>0) setInterval(loadAll, REFRESH_MS);
