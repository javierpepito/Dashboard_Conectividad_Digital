/* =====================================================================
   CONFIGURACIÓN
   ===================================================================== */
// Servido desde el propio Flask -> mismo origen ("").
const API_BASE   = "";          // mismo origen
const REFRESH_MS = 30000;       // auto-refresco cada 30 s (0 = desactivado)

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

// Bloque de mensaje "sin datos" reutilizable.
function msgHTML(txt){
  return `<div style="display:flex;align-items:center;justify-content:center;height:100%;`+
         `min-height:80px;color:var(--text-3);font-size:12px;text-align:center;padding:12px">${txt}</div>`;
}

async function fetchJSON(path){
  try{
    const r = await fetch(API_BASE + path, {cache:"no-store"});
    if(!r.ok) throw new Error(r.status);
    return await r.json();
  }catch(e){ return null; }   // -> se mostrará "sin datos"
}

/* =====================================================================
   RENDER
   ===================================================================== */
const SLA_DEF = [
  ["uptime","Uptime","≥ 99%"],["freshness","Freshness","≤ 20 días"],
  ["completitud","Completitud","≥ 97%"],["latencia","Latencia ETL","≤ 5000 ms"],
  ["error","Tasa error","≤ 0,5%"]
];

function renderSLA(sla){
  if(!sla){
    $("slaGrid").innerHTML = msgHTML("No se recibieron datos del SLA desde la base de datos.");
    const pill = $("globalPill");
    pill.style.background = "";
    pill.style.color = "";
    pill.querySelector(".led").style.background = "var(--amber)";
    $("globalTxt").textContent = "Global · sin datos";
    return;
  }
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
  if(!k){
    $("heroVal").textContent = "—";
    $("heroVal").style.color = "var(--text-3)";
    $("heroLed").style.background = "var(--amber)";
    $("heroDesc").textContent = "No se recibieron datos desde la base de datos.";
    $("heroGrupo").textContent = "—";
    $("heroVelRango").textContent = "—";
    $("heroMedia").textContent = "—";
    return;
  }
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

function emptyCard(el, name){
  $(el).innerHTML =
    `<div class="top-row"><div><div class="name">${name}</div><div class="sub">sin datos</div></div>`+
    `<span class="led" style="background:var(--amber)"></span></div>`+
    msgHTML("Sin datos desde la BD");
}

function renderCards(k, sla){
  if(k){
    const accEst = k.pct_sin_acceso<=3.5 ? "verde" : (k.pct_sin_acceso<=6?"amarillo":"rojo");
    kpiCard("kpiAcceso",{name:"% sin acceso a internet",sub:"AVG sobre tiene_acceso",
      value:k.pct_sin_acceso.toFixed(1),unit:"%",meta:"ref. SUBTEL 3,5%",estado:accEst});

    const volEst = k.volumen>=60 ? "verde" : "rojo";
    kpiCard("kpiVolumen",{name:"Volumen de registros",sub:"COUNT(*) del dataset",
      value:k.volumen,unit:"",meta:"mínimo requerido ≥ 60",estado:volEst,
      tagTxt: volEst==="verde"?"Suficiente":"Insuficiente"});
  }else{
    emptyCard("kpiAcceso","% sin acceso a internet");
    emptyCard("kpiVolumen","Volumen de registros");
  }

  if(sla){
    const comp = sla.completitud;
    const compEst = comp.estado || calcEstado(comp.valor,comp.umbral,"min");
    kpiCard("kpiCompletitud",{name:"Completitud de campos",sub:"reglas de calidad DMBOK",
      value:comp.valor.toFixed(1),unit:"%",meta:"umbral SLA ≥ 97%",estado:compEst});

    const lat = sla.latencia;
    const latEst = lat.estado || calcEstado(lat.valor,lat.umbral,"max");
    kpiCard("kpiLatencia",{name:"Latencia último ETL",sub:"job Pentaho · log_etl",
      value:Math.round(lat.valor),unit:" ms",meta:"umbral SLA ≤ 5000 ms",estado:latEst});
  }else{
    emptyCard("kpiCompletitud","Completitud de campos");
    emptyCard("kpiLatencia","Latencia último ETL");
  }
}

/* ---------- Gráficos ---------- */
let charts = {};
function destroy(){ Object.values(charts).forEach(c=>c&&c.destroy()); charts={}; }

// Contenedor de cada gráfico (se guarda una vez para poder alternar entre
// el <canvas> y el mensaje "sin datos" en cada refresco).
const CHART_IDS = ["velChart","distChart","histChart","horasChart"];
const BOX = {};
CHART_IDS.forEach(id=>{ const cv=$(id); if(cv) BOX[id]=cv.parentElement; });

// Devuelve el <canvas> si hay datos (recreándolo si antes se reemplazó por un
// mensaje); si no, pinta el mensaje "sin datos" y devuelve null.
function canvasOrMsg(id, hayDatos){
  const box = BOX[id];
  if(!box) return null;
  if(hayDatos){
    if(!$(id)) box.innerHTML = `<canvas id="${id}"></canvas>`;
    return $(id);
  }
  box.innerHTML = msgHTML("Sin datos desde la BD");
  return null;
}

function renderCharts(k, dist, hist){
  destroy();
  Chart.defaults.font.family = "'IBM Plex Mono', monospace";
  Chart.defaults.font.size = 10;
  Chart.defaults.color = TXT;

  const velCv = canvasOrMsg("velChart", !!(k && k.velocidad_rango && k.velocidad_rango.length));
  if(velCv) charts.vel = new Chart(velCv,{type:"bar",
    data:{labels:k.velocidad_rango.map(r=>r.rango),
      datasets:[{data:k.velocidad_rango.map(r=>r.download),
        backgroundColor:k.velocidad_rango.map(r=>r.rango===k.grupo_afectado?C.rojo:"#2DD4BF"),
        borderRadius:4,barThickness:26}]},
    options:{responsive:true,maintainAspectRatio:false,
      plugins:{legend:{display:false},tooltip:{callbacks:{label:c=>c.parsed.y+" Mbps"}}},
      scales:{y:{grid:{color:GRID},ticks:{callback:v=>v}},x:{grid:{display:false}}}}});

  const distCv = canvasOrMsg("distChart", !!(dist && dist.tipos && dist.tipos.length));
  if(distCv) charts.dist = new Chart(distCv,{type:"doughnut",
    data:{labels:dist.tipos.map(t=>t.tipo),
      datasets:[{data:dist.tipos.map(t=>t.cantidad),
        backgroundColor:["#2DD4BF","#3B82F6","#A78BFA","#F59E0B","#6B7685"],
        borderColor:"#161B22",borderWidth:2}]},
    options:{responsive:true,maintainAspectRatio:false,cutout:"58%",
      plugins:{legend:{position:"right",labels:{boxWidth:10,boxHeight:10,padding:9,font:{size:11}}}}}});

  const histCv = canvasOrMsg("histChart", !!(hist && hist.ciclos && hist.ciclos.length));
  if(histCv) charts.hist = new Chart(histCv,{type:"line",
    data:{labels:hist.ciclos.map(c=>c.etiqueta),
      datasets:[
        {data:hist.ciclos.map(c=>c.valor),borderColor:"#2DD4BF",
          backgroundColor:"rgba(45,212,191,.1)",borderWidth:2,fill:true,tension:.35,
          pointRadius:3,pointBackgroundColor:"#2DD4BF"},
        {data:hist.ciclos.map(()=>hist.umbral),borderColor:C.amarillo,borderWidth:1,
          borderDash:[5,4],pointRadius:0,fill:false}
      ]},
    options:{responsive:true,maintainAspectRatio:false,
      plugins:{legend:{display:false},tooltip:{callbacks:{label:c=>c.dataset.borderDash?"umbral "+c.parsed.y+"%":c.parsed.y+"%"}}},
      scales:{y:{min:94,max:100,grid:{color:GRID},ticks:{callback:v=>v+"%"}},x:{grid:{display:false}}}}});

  const horasCv = canvasOrMsg("horasChart", !!(k && k.horas_rango && k.horas_rango.length));
  if(horasCv) charts.horas = new Chart(horasCv,{type:"bar",
    data:{labels:k.horas_rango.map(r=>r.rango),
      datasets:[{data:k.horas_rango.map(r=>r.horas),backgroundColor:"#A78BFA",borderRadius:4,barThickness:22}]},
    options:{indexAxis:"y",responsive:true,maintainAspectRatio:false,
      plugins:{legend:{display:false},tooltip:{callbacks:{label:c=>c.parsed.x+" h/día"}}},
      scales:{x:{grid:{color:GRID},ticks:{callback:v=>v+"h"}},y:{grid:{display:false}}}}});
}

function renderQuality(comp){
  if(!comp || !comp.campos){
    $("qualityBody").innerHTML =
      `<tr><td colspan="3" style="text-align:center;color:var(--text-3);padding:16px">`+
      `Sin datos desde la BD</td></tr>`;
    return;
  }
  $("qualityBody").innerHTML = comp.campos.map(c=>{
    const est = c.completitud>=97?"verde":(c.completitud>=90?"amarillo":"rojo");
    const col = pintar(est);
    return `<tr>
      <td class="campo">${c.campo}</td>
      <td class="r"><div class="bar-cell">
        <span>${c.completitud.toFixed(1)}%</span>
        <span class="bar-track"><span class="bar-fill" style="width:${c.completitud}%;background:${col}"></span></span>
      </div></td>
      <td class="r" style="color:${c.nulos>3?C.amarillo:'var(--text-3)'}">${c.nulos.toFixed(1)}%</td>
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
function marcarFuente(any, all){
  const f = $("feed");
  f.className = "feed " + (all ? "live" : "demo");
  $("feedText").textContent = all
    ? "datos en vivo"
    : (any ? "datos parciales (algún endpoint sin respuesta)"
           : "sin datos: la base de datos no respondió");
}

async function loadAll(){
  $("refreshBtn").disabled = true;
  const [sla,kpi,dist,comp,hist] = await Promise.all([
    fetchJSON("/sla"), fetchJSON("/kpi_principal"), fetchJSON("/distribucion"),
    fetchJSON("/completitud"), fetchJSON("/historico")
  ]);
  const datos = [sla,kpi,dist,comp,hist];
  marcarFuente(datos.some(x=>x!==null), datos.every(x=>x!==null));

  renderSLA(sla);
  renderHero(kpi);
  renderCards(kpi, sla);
  renderCharts(kpi, dist, hist);
  renderQuality(comp);
  animateNumbers();
  $("refreshBtn").disabled = false;
}

loadAll();
if(REFRESH_MS>0) setInterval(loadAll, REFRESH_MS);
