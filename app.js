/* Real Academy — painel de captação · render puro (sem libs, SVG na mão) sobre window.REALACAD */
(function(){
'use strict';
var D = window.REALACAD || {};
var NAMES = arr(D.names);
function arr(x){ return Array.isArray(x) ? x : (x ? [x] : []); }
var nf0 = new Intl.NumberFormat('pt-BR');
var nf1 = new Intl.NumberFormat('pt-BR',{minimumFractionDigits:1,maximumFractionDigits:1});
var nf2 = new Intl.NumberFormat('pt-BR',{minimumFractionDigits:2,maximumFractionDigits:2});
function money(v){ return 'R$ ' + nf2.format(v||0); }
function money0(v){ return 'R$ ' + nf0.format(Math.round(v||0)); }
function intf(v){ return nf0.format(Math.round(v||0)); }
function pct(v){ return nf1.format(v||0) + '%'; }
function dv(a,b){ return b>0 ? a/b : 0; }
function clamp(x){ return Math.max(0,Math.min(1,x)); }
function el(id){ return document.getElementById(id); }
function esc(s){ return String(s==null?'':s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/"/g,'&quot;'); }
function isDate(x){ return /^\d{4}-\d{2}-\d{2}$/.test(x); }
function fmtBR(iso){ if(!isDate(iso)) return iso; var p=iso.split('-'); return p[2]+'/'+p[1]; }
var COL={green:'#2fe3a0',green2:'#5cf0b8',gold:'#d9b45a',gold2:'#f0d38f',flow:'#46bfe6',flow2:'#7ad4f0',meta:'#8fbef0',muted:'#83b09c',build:'#a78bfa',build2:'#c4b5fd',arr:'#f0993a',arr2:'#f6b968',exp:'#e56db0',exp2:'#f2a6d8'};

/* ---------- funnels ---------- */
function prep(key,label){
  var f = (D.funnels||{})[key] || {};
  f.key=key; f.uilabel=label; f.daily=arr(f.daily); f.totals=f.totals||{tiers:{}};
  f._grain = arr(f.grain).map(function(g){
    return { date:g.d||'', campaign:NAMES[g.c]||'(sem rastreio)', adset:NAMES[g.s]||'(sem rastreio)', ad:NAMES[g.a]||'(sem rastreio)',
      spend:+g.sp||0, spendRaw:+g.spr||0, impr:+g.im||0, clicks:+g.ck||0, lpv:+g.lp||0, leads:+g.ld||0, qual:+g.ql||0 }; });
  return f;
}
var FN = {
  'growth-popup': prep('growth-popup','Growth · Pop-up'),
  'growth-type':  prep('growth-type','Growth · Typeform'),
  'flow-popup':   prep('flow-popup','Flow · Pop-up'),
  'flow-type':    prep('flow-type','Flow · Typeform'),
  'build':        prep('build','Build · Pop-up'),
  'arremate':     prep('arremate','Arremate · Pop-up'),
  'experience':   prep('experience','Experience · Pop-up')
};
var CFG = {
  'growth-popup':{ product:'Growth', kind:'Pop-up',   accent:COL.green, flow:false, hasDisp:false },
  'growth-type': { product:'Growth', kind:'Typeform', accent:COL.green, flow:false, hasDisp:true },
  'flow-popup':  { product:'Flow',   kind:'Pop-up',   accent:COL.flow,  flow:true,  hasDisp:false },
  'flow-type':   { product:'Flow',   kind:'Typeform', accent:COL.flow,  flow:true,  hasDisp:true },
  'build':       { product:'Build',  kind:'Pop-up',   accent:COL.build, flow:false, hasDisp:false, standalone:true, pal:['#c4b5fd','#a78bfa','#8b6fe0','#d9b45a'], rgb:'167,139,250' },
  'arremate':    { product:'Arremate',  kind:'Pop-up', accent:COL.arr, flow:false, hasDisp:false, standalone:true, pal:['#f6b968','#f0993a','#d1701a','#d9b45a'], rgb:'240,153,58' },
  'experience':  { product:'Experience',kind:'Pop-up', accent:COL.exp, flow:false, hasDisp:false, standalone:true, pal:['#f2a6d8','#e56db0','#c44d92','#d9b45a'], rgb:'229,109,176' }
};
/* ---------- visão geral por produto (soma Pop-up + Typeform; split disjunto = sem duplicação) ---------- */
function mergeDistArr(a,b){ var m={}; arr(a).concat(arr(b)).forEach(function(x){ if(!x)return; m[x.label]=(m[x.label]||0)+(x.count||0); });
  return Object.keys(m).map(function(k){return {label:k,count:m[k]};}).sort(function(x,y){return y.count-x.count;}); }
function combineFunnels(key,fa,fb){
  var dm={}; [fa,fb].forEach(function(f){ f.daily.forEach(function(o){ var x=dm[o.date]||(dm[o.date]={date:o.date,sp:0,spr:0,im:0,ck:0,lp:0,ld:0,A:0,B:0,N:0});
    x.sp+=o.sp||0;x.spr+=o.spr||0;x.im+=o.im||0;x.ck+=o.ck||0;x.lp+=o.lp||0;x.ld+=o.ld||0; ['A','B','N'].forEach(function(k){x[k]+=o[k]||0;}); }); });
  var daily=Object.keys(dm).map(function(k){return dm[k];}).sort(function(a,b){return a.date.localeCompare(b.date);});
  var ta=fa.totals||{}, tb=fb.totals||{}; function sm(k){ return (+ta[k]||0)+(+tb[k]||0); }
  var tiers={}; ['A','B','N'].forEach(function(k){ tiers[k]=((ta.tiers||{})[k]||0)+((tb.tiers||{})[k]||0); });
  function mn(a,b){ if(!a)return b; if(!b)return a; return a<b?a:b; } function mx(a,b){ if(!a)return b; if(!b)return a; return a>b?a:b; }
  return { key:key, daily:daily, _grain:arr(fa._grain).concat(arr(fb._grain)),
    totals:{ spend:sm('spend'),spendRaw:sm('spendRaw'),impr:sm('impr'),clicks:sm('clicks'),lpv:sm('lpv'),
      leads:sm('leads'),leadsDated:sm('leadsDated'),leadsEst:sm('leadsEst'),attr:sm('attr'),qualified:sm('qualified'),tiers:tiers },
    capDist:mergeDistArr(fa.capDist,fb.capDist), expDist:mergeDistArr(fa.expDist,fb.expDist), dispDist:mergeDistArr(fa.dispDist,fb.dispDist),
    dateMin:mn(fa.dateMin,fb.dateMin), dateMax:mx(fa.dateMax,fb.dateMax), leadMin:mn(fa.leadMin,fb.leadMin), leadMax:mx(fa.leadMax,fb.leadMax) };
}
FN['growth-all']=combineFunnels('growth-all',FN['growth-type'],FN['growth-popup']);
FN['flow-all']  =combineFunnels('flow-all',  FN['flow-type'],  FN['flow-popup']);
CFG['growth-all']={ product:'Growth', kind:'Visão Geral', accent:COL.green, flow:false, hasDisp:true, isAll:true };
CFG['flow-all']  ={ product:'Flow',   kind:'Visão Geral', accent:COL.flow,  flow:true,  hasDisp:true, isAll:true };
// aba GERAL TOTAL = soma de TODOS os funis (growth-all + flow-all + build + arremate + experience)
FN['total']=combineFunnels('total',
  combineFunnels('_gfba',
    combineFunnels('_gfb', combineFunnels('_gf', FN['growth-all'], FN['flow-all']), FN['build']),
    FN['arremate']),
  FN['experience']);
CFG['total']={ product:'Real Academy', kind:'Visão Geral', accent:COL.gold, flow:false, hasDisp:true, isAll:true, isTotal:true, pal:['#f0d38f','#d9b45a','#b8942f','#2fe3a0'], rgb:'217,180,90' };
// allKey = funil combinado do produto (denominador da conversão) ; salesKey = produto no compare (vendas)
(function(){
  var AK={'growth-popup':'growth-all','growth-type':'growth-all','growth-all':'growth-all','flow-popup':'flow-all','flow-type':'flow-all','flow-all':'flow-all','build':'build','arremate':'arremate','experience':'experience','total':'total'};
  var SK={'growth-popup':'growth','growth-type':'growth','growth-all':'growth','flow-popup':'flow','flow-type':'flow','flow-all':'flow','build':'build','arremate':'arremate','experience':'experience','total':'__all__'};
  Object.keys(CFG).forEach(function(k){ CFG[k].allKey=AK[k]; CFG[k].salesKey=SK[k]; });
})();
var TIER = [
  {k:'A',label:'A · investidor ativo + R$ 500 mil–1 mi',color:'#2fe3a0'},
  {k:'B',label:'B · investidor ativo',color:'#7bd88a'},
  {k:'N',label:'não qualificado',color:'#5f7d70'}
];

/* ---------- período global ---------- */
function bounds(){ var ds=[]; Object.keys(FN).forEach(function(k){ FN[k].daily.forEach(function(d){ if(isDate(d.date))ds.push(d.date); }); }); ds.sort(); return [ds[0]||'',ds[ds.length-1]||'']; }
var B=bounds(), minDate=B[0], maxDate=B[1];
function addDays(iso,n){ var p=iso.split('-'); var dt=new Date(Date.UTC(+p[0],+p[1]-1,+p[2])); dt.setUTCDate(dt.getUTCDate()+n); return dt.toISOString().slice(0,10); }
function daysBetween(a,b){ var pa=a.split('-'),pb=b.split('-'); return Math.round((Date.UTC(+pb[0],+pb[1]-1,+pb[2])-Date.UTC(+pa[0],+pa[1]-1,+pa[2]))/86400000); }
function inRange(dt,r){ return isDate(dt) && dt>=r[0] && dt<=r[1]; }
var PRESETS=[{k:'hoje',label:'Hoje'},{k:'ontem',label:'Ontem'},{k:'mes',label:'Este mês'},{k:'7d',label:'7 dias'},{k:'14d',label:'14 dias'},{k:'30d',label:'30 dias'},{k:'tudo',label:'Tudo'}];
var period='tudo', customRange=null;
function rangeFor(k){
  if(k==='custom'&&customRange) return customRange;
  if(k==='hoje') return [maxDate,maxDate];
  if(k==='ontem'){ var y=addDays(maxDate,-1); return [y,y]; }
  if(k==='mes') return [maxDate.slice(0,7)+'-01',maxDate];
  if(k==='7d') return [addDays(maxDate,-6),maxDate];
  if(k==='14d') return [addDays(maxDate,-13),maxDate];
  if(k==='30d') return [addDays(maxDate,-29),maxDate];
  return [minDate,maxDate];
}
function prevRange(rng){ var len=daysBetween(rng[0],rng[1])+1; var pe=addDays(rng[0],-1); return [addDays(pe,-(len-1)),pe]; }

/* ---------- agregação de um funil ---------- */
function emptyAgg(){ return {spend:0,spendRaw:0,impr:0,clicks:0,lpv:0,leads:0,leadsDated:0,qualified:0,tiers:{A:0,B:0,N:0}}; }
function aggFunnel(fn,rng,isTudo){
  if(isTudo){ var t=fn.totals; return {spend:+t.spend||0,spendRaw:+t.spendRaw||0,impr:+t.impr||0,clicks:+t.clicks||0,lpv:+t.lpv||0,
    leads:+t.leads||0,leadsDated:+t.leadsDated||0,qualified:+t.qualified||0,tiers:t.tiers||{}}; }
  var o=emptyAgg();
  fn.daily.forEach(function(d){ if(!inRange(d.date,rng))return; o.spend+=d.sp||0;o.spendRaw+=d.spr||0;o.impr+=d.im||0;o.clicks+=d.ck||0;o.lpv+=d.lp||0;o.leads+=d.ld||0;
    ['A','B','N'].forEach(function(k){o.tiers[k]+=d[k]||0;}); });
  o.qualified=(o.tiers.A||0)+(o.tiers.B||0); o.leadsDated=o.leads; return o;
}
function daysInRange(fn,rng){ return fn.daily.filter(function(d){return inRange(d.date,rng);}).sort(function(a,b){return a.date.localeCompare(b.date);}); }
function median(xs){ var a=xs.filter(function(x){return x!=null&&isFinite(x)&&x>0;}).sort(function(x,y){return x-y;}); if(!a.length)return 0; var m=Math.floor(a.length/2); return a.length%2?a[m]:(a[m-1]+a[m])/2; }
function trendHTML(cur,prev,higherBetter){ if(prev==null||!isFinite(prev)||prev===0||!isFinite(cur))return ''; var ch=(cur-prev)/Math.abs(prev)*100; if(Math.abs(ch)<0.1)return '';
  var up=ch>0, good=higherBetter?up:!up; return '<span class="trend '+(good?'up':'down')+'">'+(up?'▲':'▼')+nf1.format(Math.abs(ch))+'%</span>'; }

/* =================================================================
   PAINEL DE FUNIL
==================================================================*/
function funnelShell(cfg,fn){
  var acc=cfg.flow?'flow':'g';
  var note='';
  if(cfg.isTotal){ note='<b>Todos os funis somados</b> (Growth + Flow + Build) · leads, investimento, qualificação, vendas e ROAS do Real Academy inteiro (imposto incluso).'; }
  else if(cfg.standalone){ note='Funil <b>'+esc(cfg.product)+'</b> · investimento = todas as campanhas da query (imposto incluso). Funil novo — poucos dias de dados.'; }
  else if(cfg.isAll){ note='<b>Pop-up + Typeform somados</b> · todos os leads, gasto e campanhas do '+esc(cfg.product)+' (imposto incluso).'; }
  else if(cfg.kind==='Typeform'){ note='Investimento = campanhas com <b>"typeform"</b> no nome + todo o gasto antes de 30/06 (quando só existia o Typeform).'; }
  else { note='Investimento = campanhas <b>sem "typeform"</b> a partir de 30/06 (lançamento do Pop-up).'; }
  var est = fn.totals.leadsEst||0;
  var undNote = est>0.15*(fn.totals.leads||1) ? ' · <b>'+intf(est)+'</b> leads com <b>data estimada</b> pela ordem de chegada (Submitted At vazio na planilha)' : '';
  return ''
  +'<div class="editband"><span class="pill '+(cfg.flow?'f':'g')+'">'+esc(cfg.product)+'</span><span class="pill '+(cfg.flow?'f':'g')+'">'+esc(cfg.kind)+'</span> captação Meta Ads &nbsp;·&nbsp; '+note+undNote+'</div>'
  +'<div id="fwarn"></div>'
  +'<div class="kgrid" id="fkpi"></div>'
  +'<div class="funnel-grid">'
  +'  <div class="card" style="margin-bottom:0"><div class="card-h">Funil de captação <span class="hint">Meta Ads · imposto incluso · seta = vs. período anterior</span></div><div id="ffunnel"></div></div>'
  +'  <div class="card" style="margin-bottom:0"><div class="card-h">Leadscore — qualificação <span class="hint">A = investidor ativo + R$ 500 mil–1 mi · B = investidor ativo (qualquer capital) · qualificado = A+B</span></div><div id="fscore"></div></div>'
  +'</div>'
  + ((cfg.isAll||cfg.standalone) ? '<div id="fsales" style="margin-top:16px"></div>' : '')
  +'<div class="row-2" style="margin-top:16px">'
  +'  <div class="card"><div class="card-h">Leads por dia <span class="hint">verde/ouro = qualificado no total</span></div><div id="fchartLeads"></div></div>'
  +'  <div class="card"><div class="card-h">Investimento × CPL por dia <span class="hint">barras = gasto c/ imposto · linha = CPL</span></div><div id="fchartCpl"></div></div>'
  +'</div>'
  +'<div class="card"><div class="card-h">Perfil dos leads <span class="hint">base completa do funil · distribuição das respostas</span></div><div id="fdist"></div></div>'
  +'<div class="card"><div class="card-h">💡 Insights — acelerar &amp; pausar <span class="hint">campanhas que puxam ou encarecem o CPL no período</span></div><div class="ins-grid" id="finsights"></div></div>'
  +'<div class="card"><div class="card-h">Visão diária <span class="hint">CPL colorido vs. mediana do período</span></div><div class="table-scroll"><table class="tbl" id="fdaily"></table></div></div>'
  +'<div class="card"><div class="card-h">Otimização — Campanha › Conjunto › Anúncio <span class="hint">clique numa <b>campanha</b> p/ abrir os conjuntos e num <b>conjunto</b> p/ ver os anúncios · CPL e ação por criativo</span></div>'
  +'  <div class="tree-legend" id="ftreeLegend"></div><div class="table-scroll"><table class="tbl tree" id="ftree"></table></div></div>';
}

function renderKpi(cfg,fn,a,p){
  var cpl=dv(a.spend,a.leads), cplR=dv(a.spendRaw,a.leads);
  var qpct=dv(a.qualified,a.leads)*100, cplq=dv(a.spend,a.qualified);
  var ctr=dv(a.clicks,a.impr)*100, cpm=dv(a.spend,a.impr)*1000, connect=dv(a.lpv,a.clicks)*100;
  var acc=cfg.flow?' flow':'';
  var hero='<div class="kpi-hero'+acc+'"><div class="h-lab">Investimento com imposto</div>'
    +'<div class="h-val">'+money0(a.spend)+'</div>'
    +'<div class="h-foot"><span>Gerenciador <b>'+money0(a.spendRaw)+'</b></span><span>imposto <b>+13,85%</b></span></div></div>';
  function kc(cls,lab,val,sub){ return '<div class="kpi-card'+(cls?' '+cls:'')+'"><div class="k-lab">'+lab+'</div><div class="k-val'+(cls==='gold'?' gold':'')+'">'+val+'</div><div class="k-sub">'+sub+'</div></div>'; }
  var html=hero
    + kc('hl','Leads',intf(a.leads), 'gerenciador '+money(cplR)+' de CPL '+trendHTML(cpl,dv(p.spend,p.leads),false))
    + kc('hl','CPL <span style="color:var(--muted2)">(c/ imposto)</span>', money(cpl), 'custo por lead '+trendHTML(cpl,dv(p.spend,p.leads),false))
    + kc('gold','Qualificados', intf(a.qualified)+' <span style="font-size:13px;color:var(--muted)">· '+nf1.format(qpct)+'%</span>', 'A+B (investidor ativo) · CPL qualif. <b>'+ (a.qualified?money(cplq):'—') +'</b>');
  el('fkpi').innerHTML=html;
  // linha de métricas de topo de funil embaixo do hero — reaproveita subtítulo do hero
  el('fkpi').firstChild.innerHTML += '<div class="h-foot" style="margin-top:9px;border-top:1px solid var(--line);padding-top:8px">'
    +'<span>Impressões <b>'+intf(a.impr)+'</b></span><span>CPM <b>'+money(cpm)+'</b></span><span>Cliques <b>'+intf(a.clicks)+'</b></span><span>CTR <b>'+nf1.format(ctr)+'%</b></span><span>LPV <b>'+intf(a.lpv)+'</b></span></div>';
}

var FN_W=[100,74,52,34], FN_COL=['#5cf0b8','#2fe3a0','#1ba97a','#d9b45a'];
var FN_COL_F=['#7ad4f0','#46bfe6','#2f8fb8','#d9b45a'];
function renderFunnelViz(cfg,a,p,sales){
  var cols=cfg.pal||(cfg.flow?FN_COL_F:FN_COL);
  var stages=[
    {l:'Impressões',v:a.impr,cost:'CPM',cf:dv(a.spend,a.impr)*1000,rate:'CTR',rf:dv(a.clicks,a.impr),pcf:dv(p.spend,p.impr)*1000,prf:dv(p.clicks,p.impr)},
    {l:'Cliques',v:a.clicks,cost:'CPC',cf:dv(a.spend,a.clicks),rate:'Connect',rf:dv(a.lpv,a.clicks),pcf:dv(p.spend,p.clicks),prf:dv(p.lpv,p.clicks)},
    {l:'View LP',v:a.lpv,cost:'Custo/LPV',cf:dv(a.spend,a.lpv),rate:'Conversão',rf:dv(a.leads,a.lpv),pcf:dv(p.spend,p.lpv),prf:dv(p.leads,p.lpv)},
    {l:'Leads',v:a.leads,cost:'CPL',cf:dv(a.spend,a.leads),rate:null,pcf:dv(p.spend,p.leads)}
  ];
  var html='<div class="funnel">';
  for(var i=0;i<stages.length;i++){ var s=stages[i];
    var costHtml='<div class="fs-v">'+money(s.cf)+'</div><div>'+s.cost+' '+trendHTML(s.cf,s.pcf,false)+'</div>';
    var rateHtml=s.rate?('<div class="fs-v">'+nf1.format(s.rf*100)+'%</div><div>'+s.rate+' '+trendHTML(s.rf,s.prf,true)+'</div>'):'';
    html+='<div class="fn-stage"><div class="fn-side right">'+costHtml+'</div>'
      +'<div class="fn-bar-wrap"><div class="fn-bar" style="width:'+FN_W[i]+'%;background:linear-gradient(180deg,'+cols[i]+',rgba(0,0,0,.14))">'
      +'<span class="fn-n">'+intf(s.v)+'</span><span class="fn-l">'+s.l+'</span></div></div>'
      +'<div class="fn-side">'+rateHtml+'</div></div>';
    if(i<stages.length-1) html+='<div class="fn-rate"><span class="ar">↓</span></div>';
  }
  html+='</div>';
  if(sales){ var conv=dv(sales.ing,sales.prodLeads), cpv=dv(a.spend,sales.ing);
    html+='<div class="fn-conv"><span class="ar">↓</span>'
      +'<div class="fn-conv-box"><span class="fc-l">Conversão em vendas</span>'
      +'<span class="fc-v">'+nf2.format(conv*100)+'%</span>'
      +'<span class="fc-s"><b>'+intf(sales.ing)+'</b> venda'+(sales.ing===1?'':'s')+' (ingressos) · custo/venda <b>'+(sales.ing?money0(cpv):'—')+'</b></span></div></div>'; }
  el('ffunnel').innerHTML=html;
}

function renderScore(cfg,fn,a){
  var t=a.tiers||{}, total=a.leads||0, qual=a.qualified||0;
  var cplq=dv(a.spend,qual);
  var bar='<div class="tierbar">';
  TIER.forEach(function(x){ var c=t[x.k]||0, w=total>0?c/total*100:0; if(w>0.4) bar+='<span style="width:'+w.toFixed(2)+'%;background:'+x.color+'" title="'+esc(x.label)+': '+c+'">'+(w>7?intf(c):'')+'</span>'; });
  bar+='</div>';
  var leg='<div class="tierleg">'+TIER.map(function(x){ var c=t[x.k]||0; return '<span class="tl"><span class="sw" style="background:'+x.color+'"></span>'+esc(x.label.split(' · ')[0])+' <b>'+intf(c)+'</b></span>'; }).join('')+'</div>';
  var badge='<div class="qual-badge"><div><div class="qn">'+intf(qual)+'</div></div><div class="ql"><b>'+nf1.format(dv(qual,total)*100)+'%</b> qualificados (A+B · investidor ativo)<br>CPL qualificado <b>'+(qual?money(cplq):'—')+'</b> · de <b>'+intf(total)+'</b> leads no período</div></div>';
  el('fscore').innerHTML=badge+bar+leg;
}

function distBlock(title,list,cls,limit){
  list=arr(list); if(!list.length) return '';
  var tot=list.reduce(function(s,x){return s+(x.count||0);},0)||1;
  var max=Math.max.apply(null,list.map(function(x){return x.count||0;}).concat([1]));
  var rows=list.slice(0,limit||6).map(function(x){ var w=Math.max(2,(x.count/max)*100);
    return '<div class="distrow"><div class="distrow-top"><span class="dl" title="'+esc(x.label)+'">'+esc(x.label)+'</span><span class="dn">'+intf(x.count)+' · '+nf1.format(x.count/tot*100)+'%</span></div>'
      +'<div class="disttrack '+cls+'"><span style="width:'+w.toFixed(1)+'%"></span></div></div>'; }).join('');
  return '<div><div class="card-h" style="font-size:12px;margin-bottom:8px">'+title+'</div><div class="dist">'+rows+'</div></div>';
}
function renderDist(cfg,fn){
  var cols='<div class="ls-wrap">'+distBlock('Capital disponível p/ investir',fn.capDist,'gold',6)+distBlock('Experiência no mercado imobiliário',fn.expDist,cfg.flow?'f':'',6)+'</div>';
  if(cfg.hasDisp && arr(fn.dispDist).length){ cols+='<div style="margin-top:14px">'+distBlock('Disposto a investir R$ 1.000–3.000 em treinamento',fn.dispDist,'',4)+'</div>'; }
  el('fdist').innerHTML=cols;
}

/* ---- charts ---- */
function xticks(days){ var n=days.length; if(n<=1)return [0]; var step=Math.max(1,Math.round(n/7)); var t=[]; for(var i=0;i<n;i+=step)t.push(i); if(t[t.length-1]!==n-1)t.push(n-1); return t; }
var _tip=null;
function tipEl(){ if(!_tip){ _tip=document.createElement('div'); _tip.className='chart-tip'; _tip.style.display='none'; document.body.appendChild(_tip);} return _tip; }
function tipShow(html,x,y){ var t=tipEl(); t.innerHTML=html; t.style.display='block'; var w=t.offsetWidth,h=t.offsetHeight,nx=x+14,ny=y+14; if(nx+w>window.innerWidth-8)nx=x-w-14; if(ny+h>window.innerHeight-8)ny=y-h-14; t.style.left=Math.max(6,nx)+'px'; t.style.top=Math.max(6,ny)+'px'; }
function tipHide(){ if(_tip)_tip.style.display='none'; }
function hitRects(days,pl,gw,pt,ph){ var s=''; for(var i=0;i<days.length;i++){ s+='<rect class="hit" data-i="'+i+'" x="'+(pl+gw*i).toFixed(1)+'" y="'+pt+'" width="'+gw.toFixed(1)+'" height="'+ph+'" fill="transparent" pointer-events="all"/>'; } return s; }
function bindHits(cid,days,fmt){ var c=el(cid); if(!c)return; Array.prototype.forEach.call(c.querySelectorAll('.hit'),function(r){
  r.addEventListener('mousemove',function(e){ var i=+r.getAttribute('data-i'); if(days[i])tipShow(fmt(days[i]),e.clientX,e.clientY); });
  r.addEventListener('mouseleave',tipHide); }); }

function renderChartLeads(cfg,days){
  var W=560,H=200,pl=30,pr=14,pt=12,pb=22,pw=W-pl-pr,ph=H-pt-pb,base=pt+ph;
  var maxV=Math.max.apply(null,days.map(function(d){return d.ld||0;}).concat([1]));
  var n=days.length||1,gw=pw/n,bw=Math.max(2,Math.min(16,gw*0.6));
  var acc=cfg.accent;
  var s='<svg viewBox="0 0 '+W+' '+H+'" preserveAspectRatio="xMidYMid meet">';
  [0,0.5,1].forEach(function(f){ var y=pt+ph*(1-f); s+='<line x1="'+pl+'" y1="'+y+'" x2="'+(W-pr)+'" y2="'+y+'" stroke="#123123" stroke-dasharray="2 3"/>';
    s+='<text x="'+(pl-4)+'" y="'+(y+3)+'" text-anchor="end" fill="#4f7d68" font-size="9">'+Math.round(maxV*f)+'</text>'; });
  days.forEach(function(d,i){ var xc=pl+gw*i+gw/2, vh=ph*dv(d.ld,maxV); if(d.ld>0){
    var q=(d.A||0)+(d.B||0), qh=ph*dv(q,maxV);
    s+='<rect x="'+(xc-bw/2).toFixed(1)+'" y="'+(base-vh).toFixed(1)+'" width="'+bw.toFixed(1)+'" height="'+vh.toFixed(1)+'" rx="1.5" fill="'+acc+'" opacity=".32"/>';
    if(q>0) s+='<rect x="'+(xc-bw/2).toFixed(1)+'" y="'+(base-qh).toFixed(1)+'" width="'+bw.toFixed(1)+'" height="'+qh.toFixed(1)+'" rx="1.5" fill="'+COL.gold+'"/>';
  } });
  xticks(days).forEach(function(i){ var xc=pl+gw*i+gw/2; s+='<text x="'+xc.toFixed(1)+'" y="'+(H-6)+'" text-anchor="middle" fill="#4f7d68" font-size="9">'+fmtBR(days[i].date)+'</text>'; });
  s+=hitRects(days,pl,gw,pt,ph)+'</svg>';
  el('fchartLeads').innerHTML='<div class="chart">'+s+'</div><div class="chart-legend"><span><span class="dot" style="background:'+acc+';opacity:.5"></span>Leads</span><span><span class="dot" style="background:'+COL.gold+'"></span>Qualificados (A+B)</span></div>';
  bindHits('fchartLeads',days,function(d){ var q=(d.A||0)+(d.B||0); return '<div class="tt-d">'+fmtBR(d.date)+'</div><div class="tt-r"><span style="color:'+cfg.accent+'">Leads</span><b>'+intf(d.ld)+'</b></div><div class="tt-r"><span style="color:'+COL.gold2+'">Qualif.</span><b>'+intf(q)+'</b></div><div class="tt-sub">CPL '+(d.ld?money(dv(d.sp,d.ld)):'—')+' · invest '+money0(d.sp)+'</div>'; });
}
function renderChartCpl(cfg,days){
  var W=560,H=200,pl=34,pr=30,pt=12,pb=22,pw=W-pl-pr,ph=H-pt-pb,base=pt+ph;
  var maxS=Math.max.apply(null,days.map(function(d){return d.sp||0;}).concat([1]));
  var cpls=days.map(function(d){return dv(d.sp,d.ld);});
  var maxC=Math.max.apply(null,cpls.concat([1]));
  var n=days.length||1,gw=pw/n,bw=Math.max(2,Math.min(15,gw*0.55));
  var s='<svg viewBox="0 0 '+W+' '+H+'" preserveAspectRatio="xMidYMid meet">';
  [0,0.5,1].forEach(function(f){ var y=pt+ph*(1-f); s+='<line x1="'+pl+'" y1="'+y+'" x2="'+(W-pr)+'" y2="'+y+'" stroke="#123123" stroke-dasharray="2 3"/>';
    s+='<text x="'+(pl-4)+'" y="'+(y+3)+'" text-anchor="end" fill="#4f7d68" font-size="9">'+Math.round(maxS*f)+'</text>';
    s+='<text x="'+(W-pr+3)+'" y="'+(y+3)+'" text-anchor="start" fill="#c98a2a" font-size="9">'+Math.round(maxC*f)+'</text>'; });
  days.forEach(function(d,i){ var xc=pl+gw*i+gw/2, sh=ph*dv(d.sp,maxS); if(d.sp>0) s+='<rect x="'+(xc-bw/2).toFixed(1)+'" y="'+(base-sh).toFixed(1)+'" width="'+bw.toFixed(1)+'" height="'+sh.toFixed(1)+'" rx="1.5" fill="'+cfg.accent+'" opacity=".3"/>'; });
  var pts=[]; days.forEach(function(d,i){ if(d.sp>0&&d.ld>0){ var xc=pl+gw*i+gw/2, y=base-ph*clamp(cpls[i]/maxC); pts.push([xc,y]); } });
  if(pts.length>1) s+='<path d="M'+pts.map(function(p){return p[0].toFixed(1)+' '+p[1].toFixed(1);}).join(' L')+'" fill="none" stroke="'+COL.gold+'" stroke-width="2"/>';
  pts.forEach(function(p){ s+='<circle cx="'+p[0].toFixed(1)+'" cy="'+p[1].toFixed(1)+'" r="2.3" fill="'+COL.gold+'"/>'; });
  xticks(days).forEach(function(i){ var xc=pl+gw*i+gw/2; s+='<text x="'+xc.toFixed(1)+'" y="'+(H-6)+'" text-anchor="middle" fill="#4f7d68" font-size="9">'+fmtBR(days[i].date)+'</text>'; });
  s+=hitRects(days,pl,gw,pt,ph)+'</svg>';
  el('fchartCpl').innerHTML='<div class="chart">'+s+'</div><div class="chart-legend"><span><span class="dot" style="background:'+cfg.accent+';opacity:.5"></span>Investimento</span><span><span class="ln" style="background:'+COL.gold+'"></span>CPL</span></div>';
  bindHits('fchartCpl',days,function(d){ return '<div class="tt-d">'+fmtBR(d.date)+'</div><div class="tt-r"><span style="color:'+cfg.accent+'">Invest.</span><b>'+money0(d.sp)+'</b></div><div class="tt-r"><span style="color:'+COL.gold2+'">CPL</span><b>'+(d.ld?money(dv(d.sp,d.ld)):'—')+'</b></div><div class="tt-sub">Leads '+intf(d.ld)+'</div>'; });
}

/* ---- daily table ---- */
function cplClass(v,med){ if(v==null||!isFinite(v)||v<=0||med<=0)return 'cpl-n'; var r=v/med; if(r<=0.8)return 'cpl-g'; if(r<=1.35)return 'cpl-a'; return 'cpl-r'; }
function heatBg(rgb,frac){ return 'background:rgba('+rgb+','+(0.10+0.4*clamp(frac)).toFixed(3)+')'; }
function renderDaily(cfg,fn,rng){
  var rows=daysInRange(fn,rng).slice().sort(function(a,b){return b.date.localeCompare(a.date);});
  var maxS=Math.max.apply(null,rows.map(function(r){return r.sp||0;}).concat([1]));
  var medCpl=median(rows.map(function(r){return r.ld>0?dv(r.sp,r.ld):null;}));
  var rgb=cfg.rgb||(cfg.flow?'70,191,230':'47,227,160');
  var head='<thead><tr><th>Dia</th><th>Investimento</th><th>Leads</th><th>CPL</th><th>Qualif.</th><th>CPL qualif.</th></tr></thead>';
  var body=rows.map(function(r){ var cpl=r.ld>0?dv(r.sp,r.ld):null; var q=(r.A||0)+(r.B||0); var cq=q>0?dv(r.sp,q):null;
    return '<tr><td>'+fmtBR(r.date)+'</td>'
      +'<td class="num"><span class="heatcell" style="'+heatBg(rgb,r.sp/maxS)+'">'+money0(r.sp)+'</span></td>'
      +'<td class="num">'+intf(r.ld)+'</td>'
      +'<td class="num">'+(cpl!=null?'<span class="cpl-pill '+cplClass(cpl,medCpl)+'">'+money(cpl)+'</span>':'—')+'</td>'
      +'<td class="num">'+intf(q)+'</td>'
      +'<td class="num">'+(cq!=null?money(cq):'—')+'</td></tr>'; }).join('');
  if(!rows.length) body='<tr><td colspan="6" class="empty">Sem dados datados no período.</td></tr>';
  var a=aggFunnel(fn,rng,false), tcpl=dv(a.spend,a.leads), tq=a.qualified, tcq=dv(a.spend,tq);
  var foot='<tfoot><tr><td>Total</td><td class="num">'+money0(a.spend)+'</td><td class="num">'+intf(a.leads)+'</td><td class="num">'+(a.leads?money(tcpl):'—')+'</td><td class="num">'+intf(tq)+'</td><td class="num">'+(tq?money(tcq):'—')+'</td></tr></tfoot>';
  el('fdaily').innerHTML=head+'<tbody>'+body+'</tbody>'+foot;
}

/* ---- optimization tree ---- */
var expanded={}, treeSort={}, treeInit={};
function newNode(name){ return {name:name,spend:0,leads:0,qual:0,impr:0,clicks:0,lpv:0,kids:{}}; }
function accum(n,r){ n.spend+=r.spend||0;n.leads+=r.leads||0;n.qual+=r.qual||0;n.impr+=r.impr||0;n.clicks+=r.clicks||0;n.lpv+=r.lpv||0; }
function buildTree(rows){ var c={}; rows.forEach(function(r){
  var cn=c[r.campaign]||(c[r.campaign]=newNode(r.campaign)); accum(cn,r);
  var sn=cn.kids[r.adset]||(cn.kids[r.adset]=newNode(r.adset)); accum(sn,r);
  var an=sn.kids[r.ad]||(sn.kids[r.ad]=newNode(r.ad)); accum(an,r); }); return c; }
function actTag(n,medCpl){
  if(n.spend>0 && n.leads===0) return {t:'Atenção',c:'act-pause'};
  if(n.spend===0) return {t:'s/ gasto',c:'act-ins'};
  if(n.leads<15) return {t:'Dado insuf.',c:'act-ins'};
  if(medCpl<=0) return {t:'—',c:'act-ins'};
  var r=dv(n.spend,n.leads)/medCpl;
  if(r<=0.8) return {t:'Acelerar',c:'act-acel'};
  if(r>=1.35) return {t:'Revisar',c:'act-rev'};
  return {t:'Manter',c:'act-mant'};
}
function countAccel(n,medCpl){ var c=0; Object.keys(n.kids).forEach(function(k){ var kid=n.kids[k]; if(actTag(kid,medCpl).t==='Acelerar')c++; c+=countAccel(kid,medCpl); }); return c; }
var ACT_RANK={'Acelerar':0,'Manter':1,'Revisar':2,'Atenção':3,'s/ gasto':4,'Dado insuf.':5,'—':6};
var TREE_COLS=[{k:'name',l:'Campanha › Conjunto › Anúncio'},{k:'spend',l:'Invest.'},{k:'cpm',l:'CPM'},{k:'ctr',l:'CTR'},{k:'cpc',l:'CPC'},{k:'lpv',l:'LPV'},{k:'leads',l:'Leads'},{k:'cpl',l:'CPL'},{k:'qual',l:'Qualif.'},{k:'act',l:'Ação'}];
function sortValOf(key,n){
  if(key==='spend') return -(n.spend||0);
  if(key==='leads') return -(n.leads||0);
  if(key==='lpv')   return -(n.lpv||0);
  if(key==='qual')  return -(n.qual||0);
  if(key==='cpl')   return n.leads>0&&n.spend>0?dv(n.spend,n.leads):Infinity;
  if(key==='cpm')   return n.impr>0&&n.spend>0?dv(n.spend,n.impr)*1000:Infinity;   // menor melhor
  if(key==='ctr')   return n.impr>0?-dv(n.clicks,n.impr):Infinity;                 // maior melhor
  if(key==='cpc')   return n.clicks>0&&n.spend>0?dv(n.spend,n.clicks):Infinity;    // menor melhor
  if(key==='act'){ var r=ACT_RANK[actTag(n,_medCpl).t]; return r==null?9:r; }
  return 0;
}
var _medCpl=0, _curFn='';
function prettyName(x){ return (x==='(sem rastreio)'||x==='SEM_RASTREIO')?'— sem rastreio —':x; }
function metricsCells(n,medCpl){ var cpl=(n.leads>0&&n.spend>0)?dv(n.spend,n.leads):null, cq=(n.qual>0&&n.spend>0)?dv(n.spend,n.qual):null, tag=actTag(n,medCpl);
  var cpm=(n.impr>0&&n.spend>0)?dv(n.spend,n.impr)*1000:null, ctr=n.impr>0?dv(n.clicks,n.impr)*100:null, cpc=(n.clicks>0&&n.spend>0)?dv(n.spend,n.clicks):null;
  return '<td class="num">'+money0(n.spend)+'</td>'
    +'<td class="num">'+(cpm!=null?money(cpm):'—')+'</td>'
    +'<td class="num">'+(ctr!=null?nf1.format(ctr)+'%':'—')+'</td>'
    +'<td class="num">'+(cpc!=null?money(cpc):'—')+'</td>'
    +'<td class="num">'+(n.lpv>0?intf(n.lpv):'—')+'</td>'
    +'<td class="num">'+intf(n.leads)+'</td>'
    +'<td class="num">'+(cpl!=null?'<span class="cpl-pill '+cplClass(cpl,medCpl)+'">'+money(cpl)+'</span>':'—')+'</td>'
    +'<td class="num">'+intf(n.qual)+(cq!=null?' <span style="color:var(--muted2);font-size:10px">'+money0(cq)+'</span>':'')+'</td>'
    +'<td class="num"><span class="act '+tag.c+'">'+tag.t+'</span></td>'; }
function treeRow(n,lvl,key,hasKids,medCpl){
  var caret=hasKids?'<span class="caret'+(expanded[_curFn][key]?' open':'')+'">▶</span>':'<span class="caret" style="opacity:.2">•</span>';
  var mark=''; if(hasKids){ var ca=countAccel(n,medCpl); if(ca>0 && actTag(n,medCpl).t!=='Acelerar') mark='<span class="accel-mark" title="tem '+ca+' item(ns) p/ acelerar dentro">▲ '+ca+' acelerar</span>'; }
  return '<tr class="lvl'+lvl+(hasKids?' parent':'')+'" data-key="'+encodeURIComponent(key)+'"><td><span class="name" title="'+esc(n.name)+'">'+caret+' '+esc(prettyName(n.name))+'</span>'+mark+'</td>'+metricsCells(n,medCpl)+'</tr>';
}
function renderTree(cfg,fn,rng,isTudo){
  var fk=fn.key; _curFn=fk;
  if(!expanded[fk])expanded[fk]={}; if(!treeSort[fk])treeSort[fk]={key:'spend',rev:false};
  var ss=treeSort[fk];
  var rows=fn._grain.filter(function(r){ return isTudo ? true : inRange(r.date,rng); });
  var camps=buildTree(rows);
  var leaf=[]; Object.keys(camps).forEach(function(cK){ if(cK==='(sem rastreio)')return; var c=camps[cK]; Object.keys(c.kids).forEach(function(sK){ var sN=c.kids[sK]; Object.keys(sN.kids).forEach(function(aK){ var an=sN.kids[aK]; if(an.spend>0&&an.leads>0)leaf.push(dv(an.spend,an.leads)); }); }); });
  var medCpl=median(leaf); _medCpl=medCpl;
  function cmp(a,b){ if(ss.key==='name'){ var rn=String(a.name).localeCompare(String(b.name),'pt',{numeric:true}); return ss.rev?-rn:rn; }
    var va=sortValOf(ss.key,a),vb=sortValOf(ss.key,b),na=!isFinite(va),nb=!isFinite(vb);
    if(na&&nb)return (b.spend||0)-(a.spend||0); if(na)return 1; if(nb)return -1;
    var r=va-vb; if(r===0)r=(b.spend||0)-(a.spend||0); return ss.rev?-r:r; }
  function skeys(obj){ return Object.keys(obj).sort(function(x,y){return cmp(obj[x],obj[y]);}); }
  var order=skeys(camps);
  if(!treeInit[fk]){ order.slice(0,3).forEach(function(cK){ expanded[fk]['c:'+cK]=true; }); treeInit[fk]=true; }
  var head='<thead><tr>'+TREE_COLS.map(function(c){ var on=ss.key===c.k; return '<th class="sortable'+(on?' sorton':'')+'" data-col="'+c.k+'">'+c.l+(on?' <span class="sarr">'+(ss.rev?'▲':'▼')+'</span>':'')+'</th>'; }).join('')+'</tr></thead>';
  var out=[];
  order.forEach(function(cK){ var c=camps[cK],cKey='c:'+cK,cHas=Object.keys(c.kids).length>0; out.push(treeRow(c,0,cKey,cHas,medCpl));
    if(expanded[fk][cKey]){ skeys(c.kids).forEach(function(sK){ var sN=c.kids[sK],sKey=cKey+'|s:'+sK,sHas=Object.keys(sN.kids).length>0; out.push(treeRow(sN,1,sKey,sHas,medCpl));
      if(expanded[fk][sKey]){ skeys(sN.kids).forEach(function(aK){ out.push(treeRow(sN.kids[aK],2,sKey+'|a:'+aK,false,medCpl)); }); } }); } });
  if(!out.length) out.push('<tr><td colspan="10" class="empty">Sem dados no período.</td></tr>');
  var tEl=el('ftree'); tEl.innerHTML=head+'<tbody>'+out.join('')+'</tbody>';
  el('ftreeLegend').innerHTML='<span><span class="act act-acel">Acelerar</span> CPL ≤ 0,8× a mediana</span><span><span class="act act-rev">Revisar</span> CPL ≥ 1,35×</span><span><span class="act act-pause">Atenção</span> gastou sem lead</span><span style="color:var(--muted2)">mediana CPL do período: '+(medCpl?money(medCpl):'—')+' · clique num cabeçalho p/ ordenar</span>';
  Array.prototype.forEach.call(tEl.querySelectorAll('th.sortable'),function(th){ th.addEventListener('click',function(){ var k=th.getAttribute('data-col'); if(ss.key===k)ss.rev=!ss.rev; else {ss.key=k;ss.rev=false;} renderTree(cfg,fn,rng,isTudo); }); });
  Array.prototype.forEach.call(tEl.querySelectorAll('tr.parent'),function(tr){ tr.addEventListener('click',function(){ var k=decodeURIComponent(tr.getAttribute('data-key')); expanded[fk][k]=!expanded[fk][k]; renderTree(cfg,fn,rng,isTudo); }); });
}

/* ---- insights ---- */
function aggBy(rows,keyf){ var m={}; rows.forEach(function(r){ var k=keyf(r); if(k==null)return; var n=m[k]||(m[k]={key:k,spend:0,leads:0,qual:0}); n.spend+=r.spend||0;n.leads+=r.leads||0;n.qual+=r.qual||0; }); return Object.keys(m).map(function(k){return m[k];}); }
function insCard(kind,icon,tag,title,desc){ return '<div class="ins '+kind+'"><div class="ic">'+icon+'</div><div><div class="it">'+title+'</div><div class="id">'+desc+'</div><span class="tag">'+tag+'</span></div></div>'; }
function renderInsights(cfg,fn,rng,isTudo){
  var rows=fn._grain.filter(function(r){ return isTudo?true:inRange(r.date,rng); });
  var a=aggFunnel(fn,rng,isTudo), accCpl=dv(a.spend,a.leads), out=[];
  var camps=aggBy(rows,function(r){return r.campaign==='(sem rastreio)'?null:r.campaign;}).filter(function(n){return n.spend>0;});
  var leafCpl=camps.filter(function(n){return n.leads>0;}).map(function(n){return dv(n.spend,n.leads);});
  var med=median(leafCpl)||accCpl;
  function cplz(n){return dv(n.spend,n.leads);}
  var accel=camps.filter(function(n){return n.leads>=20 && cplz(n)<=med*0.8;}).sort(function(x,y){return cplz(x)-cplz(y);});
  accel.slice(0,2).forEach(function(n){ out.push(insCard('acel','🚀','Escalar',esc(n.key.length>54?n.key.slice(0,54)+'…':n.key),
    'CPL <b>'+money(cplz(n))+'</b> ('+pct((1-cplz(n)/med)*100)+' abaixo da mediana) · <b>'+intf(n.leads)+'</b> leads · '+intf(n.qual)+' qualif. · gasto '+money0(n.spend)+'. Tem espaço p/ aumentar orçamento.')); });
  var noLead=camps.filter(function(n){return n.leads===0 && n.spend>=(a.spend*0.01);}).sort(function(x,y){return y.spend-x.spend;});
  noLead.slice(0,2).forEach(function(n){ out.push(insCard('pause','⛔','Pausar',esc(n.key.length>54?n.key.slice(0,54)+'…':n.key),
    'Gastou <b>'+money0(n.spend)+'</b> e <b>não gerou lead</b> no período. Candidata a pausa.')); });
  var expensive=camps.filter(function(n){return n.leads>=10 && cplz(n)>=med*1.35;}).sort(function(x,y){return cplz(y)-cplz(x);});
  expensive.slice(0,2).forEach(function(n){ out.push(insCard('pause','⚠️','Revisar',esc(n.key.length>54?n.key.slice(0,54)+'…':n.key),
    'CPL <b>'+money(cplz(n))+'</b> ('+pct((cplz(n)/med-1)*100)+' acima da mediana) · '+intf(n.leads)+' leads · gasto '+money0(n.spend)+'. Reveja criativo/público.')); });
  out.push(insCard('info','📊','Panorama do período',
    'CPL médio '+money(accCpl)+' · '+nf1.format(dv(a.qualified,a.leads)*100)+'% qualificados',
    '<b>'+intf(a.leads)+'</b> leads · <b>'+intf(a.qualified)+'</b> qualificados (CPL qualif. '+(a.qualified?money(dv(a.spend,a.qualified)):'—')+') · investimento '+money0(a.spend)+' c/ imposto.'));
  if(!out.length) out.push('<div class="empty">Sem dados suficientes p/ insights.</div>');
  el('finsights').innerHTML=out.join('');
}

/* ---- Vendas & Faturamento (comercial) — nas abas Geral e Build ---- */
function roasf(v){ return nf2.format(v||0)+'×'; }
function roasCls(r){ if(!isFinite(r)||r<=0)return 'roas-n'; if(r>=1)return 'roas-g'; if(r>=0.7)return 'roas-a'; return 'roas-r'; }
function salesChart(rows,accent){
  var W=560,H=200,pl=36,pr=34,pt=12,pb=22,pw=W-pl-pr,ph=H-pt-pb,base=pt+ph;
  var maxF=Math.max.apply(null,rows.map(function(r){return r.fat||0;}).concat([1]));
  var roas=rows.map(function(r){return dv(r.fat,r.qInvest);});
  var maxR=Math.max.apply(null,roas.concat([1]));
  var n=rows.length||1,gw=pw/n,bw=Math.max(2,Math.min(15,gw*0.55));
  var s='<svg viewBox="0 0 '+W+' '+H+'" preserveAspectRatio="xMidYMid meet">';
  [0,0.5,1].forEach(function(f){ var y=pt+ph*(1-f); s+='<line x1="'+pl+'" y1="'+y+'" x2="'+(W-pr)+'" y2="'+y+'" stroke="#123123" stroke-dasharray="2 3"/>';
    s+='<text x="'+(pl-4)+'" y="'+(y+3)+'" text-anchor="end" fill="#4f7d68" font-size="9">'+Math.round(maxF*f/1000)+'k</text>';
    s+='<text x="'+(W-pr+3)+'" y="'+(y+3)+'" text-anchor="start" fill="#c98a2a" font-size="9">'+nf1.format(maxR*f)+'×</text>'; });
  if(maxR>0){ var y1=base-ph*clamp(1/maxR); s+='<line x1="'+pl+'" y1="'+y1.toFixed(1)+'" x2="'+(W-pr)+'" y2="'+y1.toFixed(1)+'" stroke="rgba(47,227,160,.4)" stroke-dasharray="4 3"/>'; }
  rows.forEach(function(r,i){ var xc=pl+gw*i+gw/2, fh=ph*dv(r.fat,maxF); if(r.fat>0) s+='<rect x="'+(xc-bw/2).toFixed(1)+'" y="'+(base-fh).toFixed(1)+'" width="'+bw.toFixed(1)+'" height="'+fh.toFixed(1)+'" rx="1.5" fill="'+COL.gold+'" opacity=".5"/>'; });
  var pts=[]; rows.forEach(function(r,i){ if(r.qInvest>0){ var xc=pl+gw*i+gw/2, y=base-ph*clamp(roas[i]/maxR); pts.push([xc,y]); } });
  if(pts.length>1) s+='<path d="M'+pts.map(function(p){return p[0].toFixed(1)+' '+p[1].toFixed(1);}).join(' L')+'" fill="none" stroke="'+accent+'" stroke-width="2"/>';
  pts.forEach(function(p){ s+='<circle cx="'+p[0].toFixed(1)+'" cy="'+p[1].toFixed(1)+'" r="2.3" fill="'+accent+'"/>'; });
  xticks(rows).forEach(function(i){ var xc=pl+gw*i+gw/2; s+='<text x="'+xc.toFixed(1)+'" y="'+(H-6)+'" text-anchor="middle" fill="#4f7d68" font-size="9">'+fmtBR(rows[i].d)+'</text>'; });
  s+=hitRects(rows.map(function(r){return {date:r.d};}),pl,gw,pt,ph)+'</svg>';
  return '<div class="chart">'+s+'</div><div class="chart-legend"><span><span class="dot" style="background:'+COL.gold+';opacity:.6"></span>Faturamento</span><span><span class="ln" style="background:'+accent+'"></span>ROAS</span><span style="color:var(--muted2)">tracejado = break-even (1×)</span></div>';
}
function salesRows(salesKey){
  if(salesKey!=='__all__'){ return arr((D.compare||{})[salesKey]); }
  var m={}; ['growth','flow','build','arremate','experience'].forEach(function(pk){ arr((D.compare||{})[pk]).forEach(function(r){ var x=m[r.d]||(m[r.d]={d:r.d,fat:0,ingressos:0,qInvest:0}); x.fat+=r.fat||0; x.ingressos+=r.ingressos||0; x.qInvest+=r.qInvest||0; }); });
  return Object.keys(m).map(function(k){return m[k];}).sort(function(a,b){return a.d.localeCompare(b.d);});
}
function salesAgg(salesKey,rng,isTudo){ var fat=0,ing=0,inv=0; salesRows(salesKey).forEach(function(r){ if(isTudo||inRange(r.d,rng)){ fat+=r.fat||0; ing+=r.ingressos||0; inv+=r.qInvest||0; } }); return {fat:fat,ing:ing,inv:inv}; }
function renderSales(cfg,rng,isTudo){
  var host=el('fsales'); if(!host)return;
  var all=salesRows(cfg.salesKey);
  var last=-1; all.forEach(function(r,i){ if((r.fat||0)>0||(r.ingressos||0)>0||(r.qInvest||0)>0){last=i;} }); all=all.slice(0,last+1);
  var rows = isTudo ? all : all.filter(function(r){return inRange(r.d,rng);});
  var fat=0,ing=0,inv=0; rows.forEach(function(r){ fat+=r.fat||0; ing+=r.ingressos||0; inv+=r.qInvest||0; });
  var roas=dv(fat,inv), ticket=dv(fat,ing), cpa=dv(inv,ing), lucro=fat-inv;
  var tiles='<div class="sales-tiles">'
    +'<div class="stile big"><div class="st-l">Faturamento</div><div class="st-v" style="color:'+COL.gold2+'">'+money0(fat)+'</div><div class="st-s">vendas de ingressos no período</div></div>'
    +'<div class="stile"><div class="st-l">Ingressos vendidos</div><div class="st-v">'+intf(ing)+'</div><div class="st-s">ticket médio '+(ing?money(ticket):'—')+'</div></div>'
    +'<div class="stile big"><div class="st-l">ROAS</div><div class="st-v"><span class="roas-pill '+roasCls(roas)+'" style="font-size:23px;padding:2px 12px">'+roasf(roas)+'</span></div><div class="st-s">faturamento ÷ investimento (c/ imposto)</div></div>'
    +'<div class="stile"><div class="st-l">Investimento</div><div class="st-v">'+money0(inv)+'</div><div class="st-s">c/ imposto · custo/venda '+(ing?money(cpa):'—')+'</div></div>'
    +'<div class="stile"><div class="st-l">Lucro (fat − invest)</div><div class="st-v '+(lucro>=0?'pos':'neg')+'">'+money0(lucro)+'</div><div class="st-s">'+(lucro>=0?'no lucro':'no prejuízo')+'</div></div>'
    +'</div>';
  var body='',chart='';
  if(fat>0||ing>0){
    chart='<div class="row-2" style="margin-top:6px"><div><div class="card-h" style="font-size:12px">Faturamento × ROAS por dia</div>'+salesChart(rows.slice().sort(function(a,b){return a.d.localeCompare(b.d);}),cfg.accent)+'</div>';
    var dr=rows.slice().filter(function(r){return (r.fat||0)>0||(r.ingressos||0)>0;}).sort(function(a,b){return b.d.localeCompare(a.d);});
    var trows=dr.map(function(r){ var rz=dv(r.fat,r.qInvest), tk=dv(r.fat,r.ingressos);
      return '<tr><td>'+fmtBR(r.d)+'</td><td class="num" style="color:'+COL.gold2+'">'+money0(r.fat)+'</td><td class="num">'+intf(r.ingressos)+'</td><td class="num">'+money0(r.qInvest)+'</td><td class="num"><span class="roas-pill '+roasCls(rz)+'">'+roasf(rz)+'</span></td><td class="num">'+(r.ingressos?money(tk):'—')+'</td></tr>'; }).join('');
    if(!trows)trows='<tr><td colspan="6" class="empty">Sem vendas no período.</td></tr>';
    body='<div><div class="card-h" style="font-size:12px">Vendas dia a dia</div><div class="table-scroll" style="max-height:280px;overflow-y:auto"><table class="tbl"><thead><tr><th>Dia</th><th>Faturamento</th><th>Ingressos</th><th>Invest.</th><th>ROAS</th><th>Ticket</th></tr></thead><tbody>'+trows+'</tbody></table></div></div></div>';
  } else {
    chart='<div class="empty" style="padding:16px">Nenhuma venda registrada ainda neste funil (o comercial preenche faturamento e ingressos por dia na planilha).</div>';
  }
  host.innerHTML='<div class="card sales-card"><div class="card-h">🎟️ Vendas &amp; Faturamento <span class="hint">da planilha do comercial · '+esc(cfg.product)+' ('+(cfg.isTotal?'todos os funis somados':'pop-up + typeform somados')+') · ROAS = faturamento ÷ investimento c/ imposto · reage ao filtro de data</span></div>'+tiles+chart+body+'</div>';
}

/* ---- funnel orchestration ---- */
function renderFunnel(fk){
  var fn=FN[fk], cfg=CFG[fk];
  el('host').innerHTML=funnelShell(cfg,fn);
  renderFunnelData(fk);
}
function renderFunnelData(fk){
  var fn=FN[fk], cfg=CFG[fk], isTudo=(period==='tudo'), rng=rangeFor(period), prng=prevRange(rng);
  var a=aggFunnel(fn,rng,isTudo), p=aggFunnel(fn,prng,false), days=daysInRange(fn,rng);
  var warn=el('fwarn');
  if(warn){ var notes=[];
    var est=fn.totals.leadsEst||0;
    if(est>0.15*(fn.totals.leads||1)){ notes.push('ℹ <b>'+intf(est)+'</b> dos '+intf(fn.totals.leads)+' leads deste funil estão com <b>data estimada</b> pela ordem de chegada na planilha (o campo “Submitted At” não vem preenchido na origem). Os <b>totais são exatos</b>; a divisão por dia/mês é aproximada (o mês fecha certo, o dia pode variar 1–2). Preenchendo a data na planilha, fica exato automaticamente.'); }
    var noCamp=(fn.totals.leads||0)-(fn.totals.attr||0);
    if(noCamp>0.4*(fn.totals.leads||1)){ notes.push('ℹ <b>'+intf(noCamp)+'</b> dos '+intf(fn.totals.leads)+' leads (<b>'+nf1.format(100*noCamp/(fn.totals.leads||1))+'%</b>) são de meses cujas campanhas <b>não estão na query atual</b> (histórico removido). Contam como lead, mas sem gasto atribuído — então o <b>CPL do “Tudo” fica subestimado</b>. <b>Os períodos recentes (mês/30 dias) estão corretos.</b>'); }
    warn.innerHTML = notes.length ? notes.map(function(n){return '<div class="warnbar">'+n+'</div>';}).join('') : '';
  }
  var sInfo=salesAgg(cfg.salesKey,rng,isTudo);
  var prodLeads=(FN[cfg.allKey]?aggFunnel(FN[cfg.allKey],rng,isTudo).leads:a.leads);
  renderKpi(cfg,fn,a,p); renderFunnelViz(cfg,a,p,{ing:sInfo.ing,prodLeads:prodLeads}); renderScore(cfg,fn,a);
  if(cfg.isAll||cfg.standalone){ renderSales(cfg,rng,isTudo); }
  renderChartLeads(cfg,days); renderChartCpl(cfg,days); renderDist(cfg,fn);
  renderInsights(cfg,fn,rng,isTudo); renderDaily(cfg,fn,rng); renderTree(cfg,fn,rng,isTudo);
}

/* =================================================================
   COMPARATIVO DIÁRIO (5ª aba)
==================================================================*/
function cmpRows(prod){ var rows=arr((D.compare||{})[prod]); var last=-1;
  rows.forEach(function(r,i){ if((r.qInvest||0)>0||(r.clintLeads||0)>0||(r.planilha||0)>0) last=i; });
  return rows.slice(0,last+1); }
function cmpInRange(prod,rng){ return cmpRows(prod).filter(function(r){ return inRange(r.d,rng); }); }
// invest = das QUERIES (qInvest) ; ger = leads gerenciador = da NOSSA planilha (planilha) ; clint = comercial
function cmpTotals(rows){ var t={invest:0,ger:0,clint:0}; rows.forEach(function(r){ t.invest+=r.qInvest||0;t.ger+=r.planilha||0;t.clint+=r.clintLeads||0; }); return t; }
function cmpChart(rows,accent){
  var W=560,H=210,pl=32,pr=32,pt=12,pb=24,pw=W-pl-pr,ph=H-pt-pb,base=pt+ph;
  var maxL=Math.max.apply(null,rows.map(function(r){return Math.max(r.clintLeads||0,r.planilha||0);}).concat([1]));
  var maxS=Math.max.apply(null,rows.map(function(r){return r.qInvest||0;}).concat([1]));
  var n=rows.length||1,gw=pw/n,bw=Math.max(2,Math.min(14,gw*0.5));
  var s='<svg viewBox="0 0 '+W+' '+H+'" preserveAspectRatio="xMidYMid meet">';
  [0,0.5,1].forEach(function(f){ var y=pt+ph*(1-f); s+='<line x1="'+pl+'" y1="'+y+'" x2="'+(W-pr)+'" y2="'+y+'" stroke="#123123" stroke-dasharray="2 3"/>';
    s+='<text x="'+(pl-4)+'" y="'+(y+3)+'" text-anchor="end" fill="#4f7d68" font-size="9">'+Math.round(maxL*f)+'</text>';
    s+='<text x="'+(W-pr+3)+'" y="'+(y+3)+'" text-anchor="start" fill="#c98a2a" font-size="9">'+Math.round(maxS*f/1000)+'k</text>'; });
  // invest bars (das queries)
  rows.forEach(function(r,i){ var xc=pl+gw*i+gw/2, sh=ph*dv(r.qInvest,maxS); if(r.qInvest>0)s+='<rect x="'+(xc-bw/2).toFixed(1)+'" y="'+(base-sh).toFixed(1)+'" width="'+bw.toFixed(1)+'" height="'+sh.toFixed(1)+'" rx="1.5" fill="'+accent+'" opacity=".16"/>'; });
  // 2 linhas: gerenciador (planilha), clint
  function line(key,col){ var pts=[]; rows.forEach(function(r,i){ var xc=pl+gw*i+gw/2, y=base-ph*clamp((r[key]||0)/maxL); pts.push([xc,y]); }); if(pts.length>1) s+='<path d="M'+pts.map(function(p){return p[0].toFixed(1)+' '+p[1].toFixed(1);}).join(' L')+'" fill="none" stroke="'+col+'" stroke-width="2"/>'; }
  line('planilha',COL.green2); line('clintLeads',COL.gold2);
  xticks(rows).forEach(function(i){ var xc=pl+gw*i+gw/2; s+='<text x="'+xc.toFixed(1)+'" y="'+(H-7)+'" text-anchor="middle" fill="#4f7d68" font-size="9">'+fmtBR(rows[i].d)+'</text>'; });
  s+=hitRects(rows.map(function(r){return {date:r.d};}),pl,gw,pt,ph)+'</svg>';
  return '<div class="chart">'+s+'</div>';
}
function renderCompareProd(prod,cfg,rows){
  var t=cmpTotals(rows), accent=cfg.accent;
  var cplGer=dv(t.invest,t.ger), cplClint=dv(t.invest,t.clint);
  var cls=cfg.flow?'f':'g', chid='cmpchart-'+prod;
  var stats='<div class="cmp-stats">'
    +'<div class="cstat"><div class="cl">Investido (período)</div><div class="cv">'+money0(t.invest)+'</div><div class="cs">das queries · c/ imposto</div></div>'
    +'<div class="cstat"><div class="cl">Leads Gerenciador</div><div class="cv" style="color:'+COL.green2+'">'+intf(t.ger)+'</div><div class="cs">planilha · <b>CPL ger. '+(t.ger?money(cplGer):'—')+'</b></div></div>'
    +'<div class="cstat"><div class="cl">Leads Clint</div><div class="cv" style="color:'+COL.gold2+'">'+intf(t.clint)+'</div><div class="cs">comercial · <b>CPL clint '+(t.clint?money(cplClint):'—')+'</b> · Δ '+(t.clint-t.ger>=0?'+':'')+intf(t.clint-t.ger)+'</div></div>'
    +'</div>';
  var leg='<div class="leadsrc-leg"><span><span class="dot" style="background:'+COL.green2+'"></span>Leads gerenciador (planilha)</span><span><span class="dot" style="background:'+COL.gold2+'"></span>Leads na Clint (comercial)</span><span style="color:var(--muted2)">barra = investimento (queries)</span></div>';
  return '<div class="cmp-prod '+cls+'"><h3><span class="tdot '+(cfg.flow?'f':'g')+'"></span>'+esc(cfg.product)+' <span style="font-size:12px;color:var(--muted);font-weight:500">· Pop-up + Typeform</span></h3>'+stats+leg+'<div id="'+chid+'">'+cmpChart(rows,accent)+'</div></div>';
}
function renderCompareTable(prod,cfg,rows){
  rows=rows.slice().sort(function(a,b){return b.d.localeCompare(a.d);});
  var maxS=Math.max.apply(null,rows.map(function(r){return r.qInvest||0;}).concat([1]));
  var rgb=cfg.flow?'70,191,230':'47,227,160';
  var head='<thead><tr><th>Dia</th><th>Investimento</th><th class="src-plan">Leads Ger.</th><th class="src-plan">CPL Ger.</th><th class="src-clint">Clint</th><th class="src-clint">CPL Clint</th><th>Δ Clint−Ger.</th></tr></thead>';
  var body=rows.map(function(r){ var delta=(r.clintLeads||0)-(r.planilha||0); var cg=r.planilha>0?dv(r.qInvest,r.planilha):null, cc=r.clintLeads>0?dv(r.qInvest,r.clintLeads):null;
    return '<tr><td>'+fmtBR(r.d)+'</td>'
      +'<td class="num"><span class="heatcell" style="'+heatBg(rgb,r.qInvest/maxS)+'">'+money0(r.qInvest)+'</span></td>'
      +'<td class="num src-plan">'+intf(r.planilha)+'</td>'
      +'<td class="num src-plan">'+(cg!=null?money(cg):'—')+'</td>'
      +'<td class="num src-clint">'+intf(r.clintLeads)+'</td>'
      +'<td class="num src-clint">'+(cc!=null?money(cc):'—')+'</td>'
      +'<td class="num deltacell '+(delta>0?'gap-pos':(delta<0?'gap-neg':''))+'">'+(delta>0?'+':'')+intf(delta)+'</td></tr>'; }).join('');
  if(!rows.length) body='<tr><td colspan="7" class="empty">Sem dados no período.</td></tr>';
  var t=cmpTotals(rows);
  var foot='<tfoot><tr><td>Total</td><td class="num">'+money0(t.invest)+'</td><td class="num src-plan">'+intf(t.ger)+'</td><td class="num src-plan">'+(t.ger?money(dv(t.invest,t.ger)):'—')+'</td><td class="num src-clint">'+intf(t.clint)+'</td><td class="num src-clint">'+(t.clint?money(dv(t.invest,t.clint)):'—')+'</td><td class="num">'+(t.clint-t.ger>0?'+':'')+intf(t.clint-t.ger)+'</td></tr></tfoot>';
  return '<div class="card"><div class="card-h"><span class="tdot '+(cfg.flow?'f':'g')+'"></span>'+esc(cfg.product)+' — dia a dia <span class="hint">CPL ger. = invest ÷ leads da planilha · CPL clint = invest ÷ leads na Clint · mais recente no topo</span></div><div class="table-scroll"><table class="tbl">'+head+'<tbody>'+body+'</tbody>'+foot+'</table></div></div>';
}
function splitBar(title,vg,vf){ var tot=vg+vf; if(tot<=0)tot=1; var wg=vg/tot*100, wf=vf/tot*100;
  return '<div style="font-size:11.5px;color:var(--muted);margin:6px 0 3px">'+title+'</div><div class="tierbar" style="height:26px">'
    +(wg>0?'<span style="width:'+wg.toFixed(1)+'%;background:'+COL.green+'">'+(wg>12?'Growth '+nf0.format(Math.round(wg))+'%':'')+'</span>':'')
    +(wf>0?'<span style="width:'+wf.toFixed(1)+'%;background:'+COL.flow+'">'+(wf>12?'Flow '+nf0.format(Math.round(wf))+'%':'')+'</span>':'')+'</div>'; }
function renderCompare(){
  var isTudo=(period==='tudo'), rng=rangeFor(period);
  var gRows = isTudo ? cmpRows('growth') : cmpInRange('growth',rng);
  var fRows = isTudo ? cmpRows('flow')   : cmpInRange('flow',rng);
  var tg=cmpTotals(gRows), tf=cmpTotals(fRows);
  var host=el('host');
  var perLbl;
  if(isTudo){ perLbl='todo o período com dados'; }
  else { var lb=(gRows.concat(fRows)).map(function(r){return r.d;}).sort(); perLbl=(lb.length?fmtBR(lb[0])+' → '+fmtBR(lb[lb.length-1]):fmtBR(rng[0])+' → '+fmtBR(rng[1])); }
  host.innerHTML=''
  +'<div class="editband"><span class="pill g">investimento (queries)</span> &nbsp;·&nbsp; <span class="pill g">leads gerenciador (planilha)</span> vs <span class="pill gold" style="color:var(--gold2)">Clint (comercial)</span> &nbsp;·&nbsp; por dia · <b>'+esc(perLbl)+'</b> · use o filtro de data no topo ↑</div>'
  +'<div class="cmp-head">'+renderCompareProd('growth',CFG['growth-type'],gRows)+renderCompareProd('flow',CFG['flow-type'],fRows)+'</div>'
  +'<div class="card"><div class="card-h">Growth × Flow — participação no período</div>'
  +splitBar('Investimento (das queries, c/ imposto)',tg.invest,tf.invest)
  +splitBar('Leads gerenciador (planilha)',tg.ger,tf.ger)
  +splitBar('Leads na Clint (comercial)',tg.clint,tf.clint)
  +'<div class="mini-legend">Investimento vem sempre das <b>queries</b>. <b>CPL ger.</b> = invest ÷ leads da planilha (nossa captação) · <b>CPL clint</b> = invest ÷ leads que o comercial relatou na Clint. Δ Clint−Ger. &gt; 0 = comercial registrou mais leads do que caíram na planilha (outras origens). Δ &lt; 0 = caíram mais na planilha do que entraram na Clint (possível lead não trabalhado).</div></div>'
  +renderCompareTable('growth',CFG['growth-type'],gRows)
  +renderCompareTable('flow',CFG['flow-type'],fRows);
  function cmpTip(x){ var r=x.r; return '<div class="tt-d">'+fmtBR(r.d)+'</div><div class="tt-r"><span class="src-plan">Gerenciador</span><b>'+intf(r.planilha)+'</b></div><div class="tt-r"><span class="src-clint">Clint</span><b>'+intf(r.clintLeads)+'</b></div><div class="tt-sub">Invest '+money0(r.qInvest)+' · CPL ger. '+(r.planilha>0?money(dv(r.qInvest,r.planilha)):'—')+' · CPL clint '+(r.clintLeads>0?money(dv(r.qInvest,r.clintLeads)):'—')+'</div>'; }
  bindHits('cmpchart-growth',gRows.map(function(r){return {date:r.d,r:r};}),cmpTip);
  bindHits('cmpchart-flow',fRows.map(function(r){return {date:r.d,r:r};}),cmpTip);
}

/* =================================================================
   TABS + PERÍODO
==================================================================*/
var TABS=['total','growth-all','growth-popup','growth-type','flow-all','flow-popup','flow-type','build','arremate','experience','compare'];
var active='total';
function renderActive(){ if(active==='compare'){ renderCompare(); } else { renderFunnel(active); } }
function activateTab(id){ active=id;
  Array.prototype.forEach.call(document.querySelectorAll('.tab'),function(x){ x.classList.toggle('active',x.getAttribute('data-tab')===id); });
  el('periods').style.visibility='visible';
  renderActive();
}
function initTabs(){ Array.prototype.forEach.call(document.querySelectorAll('.tab'),function(t){ t.addEventListener('click',function(){ var id=t.getAttribute('data-tab'); activateTab(id); if(history.replaceState)history.replaceState(null,'','#'+id); }); });
  var h=(location.hash||'').replace('#',''); if(TABS.indexOf(h)>=0)active=h;
  window.addEventListener('hashchange',function(){ var k=(location.hash||'').replace('#',''); if(TABS.indexOf(k)>=0)activateTab(k); }); }

function periodsHTML(){ return PRESETS.map(function(p){return '<button data-k="'+p.k+'" class="pbtn">'+p.label+'</button>';}).join('')
  +'<span class="daterange" id="daterange"><span class="dr-cal">📅</span><span class="dr-l">De</span> <input type="date" id="dtDe" min="'+minDate+'" max="'+maxDate+'"> <span class="dr-l">até</span> <input type="date" id="dtAte" min="'+minDate+'" max="'+maxDate+'"></span>'; }
function syncPeriodUI(){ var rng=rangeFor(period);
  Array.prototype.forEach.call(el('periods').querySelectorAll('.pbtn'),function(b){ b.classList.toggle('on',period===b.getAttribute('data-k')); });
  var dr=el('daterange'); if(dr)dr.classList.toggle('on',period==='custom');
  var de=el('dtDe'),at=el('dtAte'); if(de&&at){ de.value=rng[0]; at.value=rng[1]; } }
function initPeriods(){ el('periods').innerHTML=periodsHTML();
  Array.prototype.forEach.call(el('periods').querySelectorAll('.pbtn'),function(b){ b.addEventListener('click',function(){ period=b.getAttribute('data-k'); customRange=null; syncPeriodUI(); if(active==='compare')renderCompare(); else renderFunnelData(active); }); });
  var de=el('dtDe'),at=el('dtAte');
  function onDate(){ var s=de.value,e=at.value; if(!s||!e)return; if(s>e){var t=s;s=e;e=t;} if(s<minDate)s=minDate; if(e>maxDate)e=maxDate; customRange=[s,e]; period='custom'; syncPeriodUI(); if(active==='compare')renderCompare(); else renderFunnelData(active); }
  de.addEventListener('change',onDate); at.addEventListener('change',onDate); syncPeriodUI(); }

function initCoverage(){ el('updated').textContent=D.generatedAtBR||'—'; if(el('taxf'))el('taxf').textContent=(D.taxMultiplier||1.1385).toFixed(4).replace('.',',');
  var totLeads=0,totQ=0,totSpend=0; ['growth-popup','growth-type','flow-popup','flow-type','build','arremate','experience'].forEach(function(k){ if(!FN[k])return; var t=FN[k].totals; totLeads+=t.leads||0; totQ+=t.qualified||0; totSpend+=t.spend||0; });
  el('coverage').innerHTML='<b>'+intf(totLeads)+'</b> leads captados · <b>'+intf(totQ)+'</b> qualificados · <b>'+money0(totSpend)+'</b> investidos (c/ imposto) · Growth · Flow · Build · Arremate · Experience · janela até '+fmtBR(maxDate)+'. '
    +'Pop-up desde 30/06/2026 · Typeform (campanhas dedicadas) desde 14/05/2026 · Build desde 01/08/2026.'; }

if(!D.funnels){ el('coverage').innerHTML='<b>Sem dados.</b> Rode o build.ps1 para gerar o data.js.'; }
else { initCoverage(); initPeriods(); initTabs(); activateTab(active); }
})();
