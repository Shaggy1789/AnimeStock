
(function(global){
  'use strict';
  const Data = global.AnimeStockData;
  const UI = global.AnimeStockUI;
  const Charts = global.AnimeStockCharts || {};

  const $ = function(s,sc){ return (sc||document).querySelector(s); };
  const $$ = function(s,sc){ return Array.prototype.slice.call((sc||document).querySelectorAll(s)); };

  const state = {
    from: null, to: null,
    data: null,
    loaded: false
  };

  function fmtMoney(n){ return UI ? UI.formatCurrency(n) : ('$'+Math.round(n||0)); }
  function fmtPct(n){ var v=Math.round((n||0)*10)/10; return (v>=0?'+':'') + v.toFixed(1)+'%'; }
  function dateToISO(d){ var y=d.getFullYear(); var mo=String(d.getMonth()+1).padStart(2,'0'); var da=String(d.getDate()).padStart(2,'0'); return y+'-'+mo+'-'+da; }
  function isoToDate(s){ if(!s) return new Date(); var d=new Date(s); if(isNaN(d.getTime())){ var m=s.match(/(\d{4})-(\d{2})-(\d{2})/); if(m) return new Date(m[1],m[2]-1,m[3]); } return d; }
  function addMonths(d,n){ var x=new Date(d); x.setMonth(x.getMonth()+n); return x; }
  function startOfMonth(d){ var x=new Date(d); x.setDate(1); x.setHours(0,0,0,0); return x; }
  function endOfDay(d){ var x=new Date(d); x.setHours(23,59,59,999); return x; }

  function setStatus(msg,busy){
    const st=$('#reportsStatus'); if(st){ st.textContent=msg||''; st.hidden=!msg; st.setAttribute('aria-busy', busy?'true':'false'); }
    const p=$('#panel-reports'); if(p) p.setAttribute('aria-busy', busy?'true':'false');
  }

  function initPeriod(){
    const now=new Date(); const f=$('#reportsFrom'), t=$('#reportsTo');
    if(f && !f.value) f.value = dateToISO(startOfMonth(now));
    if(t && !t.value) t.value = dateToISO(now);
    state.from=f.value; state.to=t.value;
  }

  async function load(){
    setStatus('Cargando reportes...', true);
    try{ state.data = await Data.fetchReports({from:state.from,to:state.to}); renderAll(); setStatus('',false); state.loaded=true; }
    catch(e){ console.error(e); setStatus('No se pudieron cargar los reportes.',false); }
  }

  function renderKpis(k){
    const host=$('#reportsKpis'); if(!host||!k) return; host.textContent='';
    const items=[
      {l:'Ingresos totales', v:k.revenue, d:k.deltas.revenue, tone:k.deltas.revenue>=0?'ok':'danger'},
      {l:'Ganancia neta', v:k.profit, d:k.deltas.profit, tone:k.deltas.profit>=0?'ok':'danger'},
      {l:'Ticket promedio', v:k.avgTicket, d:k.deltas.avgTicket, tone:k.deltas.avgTicket>=0?'ok':'danger'},
      {l:'Margen %', v:(k.margin||0).toFixed(1)+'%', d:k.deltas.margin, tone:k.deltas.margin>=0?'ok':'danger'}
    ];
    items.forEach(function(it,i){
      const el=UI.el('article',{className:'mini-kpi mini-kpi--'+it.tone, attrs:{role:'listitem'}});
      el.style.setProperty('--i', String(i));
      el.innerHTML='<span class="mini-kpi__icon">📊</span><div class="mini-kpi__body"><p class="mini-kpi__label"></p><p class="mini-kpi__value"></p><p class="mini-kpi__sub"></p></div>';
      $('.mini-kpi__label',el).textContent=it.l; $('.mini-kpi__value',el).textContent=fmtMoney(it.v);
      $('.mini-kpi__sub',el).textContent=fmtPct(it.d)+' vs período anterior';
      host.appendChild(el);
    });
  }

  function renderSalesTable(d){
    const body=$('#reportsSalesRows'); if(!body) return; body.textContent='';
    const e=$('#reportsSalesEmpty'), c=$('#reportsSalesCard');
    if(!d||d.length===0){ if(e)e.hidden=false; if(c)c.hidden=true; return; }
    if(e)e.hidden=true; if(c)c.hidden=false;
    d.forEach(function(s){
      const tr=UI.el('tr');
      var itemsTxt = '';
      try{ itemsTxt = ((s.items||[]).map(function(it){return 'x'+it.quantity;}).join(', ')).slice(0,60); }catch(er){}
      tr.innerHTML='<td>'+(s.soldAt||s.date||'').slice(0,10)+'</td><td class="receipt-code">'+(s.receiptNumber||'')+'</td><td>'+(s.customer&&s.customer.name||'Consumidor final')+'</td><td class="table__items">'+itemsTxt+'</td><td>'+(s.paymentMethod||s.payment||'')+'</td><td>'+(s.status||'')+'</td><td class="table__num">'+fmtMoney(s.total||0)+'</td>';
      body.appendChild(tr);
    });
  }

  function renderAll(){ if(!state.data) return; renderKpis(state.data.kpis); renderSalesTable(state.data.sales); }

  function init(){ initPeriod(); }
  function show(){ init(); if(!state.loaded){ setStatus('Cargando reportes...', true); } load(); }
  function refresh(){ init(); return load(); }

  global.AnimeStockReports = { init:init, show:show, refresh:refresh, state:state };
  if(Data && typeof Data.onDataChange==='function'){ Data.onDataChange(function(r){ if(state.loaded && (r.indexOf('sale:')===0||r==='cash:created')) refresh(); }); }
})(typeof window!=='undefined'?window:globalThis);