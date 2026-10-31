const FEED_ID=window.TRENDLINE_CONFIG.feedSheetId;
const $=s=>document.querySelector(s), tip=$('#tip');
const fmt=(v,d=1)=>v==null?'—':Number(v).toFixed(d);
function showTip(e,h){tip.innerHTML=h;tip.style.opacity=1;const r=tip.getBoundingClientRect();
  let x=e.clientX+14,y=e.clientY-10;if(x+r.width>innerWidth-8)x=e.clientX-r.width-14;
  if(y+r.height>innerHeight-8)y=innerHeight-r.height-8;tip.style.left=x+'px';tip.style.top=Math.max(8,y)+'px'}
const hideTip=()=>tip.style.opacity=0;
function bindTips(root){root.querySelectorAll('.hit[data-h]').forEach(el=>{
  el.onmousemove=e=>showTip(e,decodeURIComponent(el.dataset.h));el.onmouseleave=hideTip})}
const ticks=(lo,hi,n)=>Array.from({length:n+1},(_,i)=>lo+(hi-lo)/n*i);

/* ---------- rules: one place ---------- */
const SPEC={tirzepatide:[90,110],semaglutide:[90,110],liraglutide:[90,110],glycine:[90,110],
  cyanocobalamin:[95,115],b3:[90,110],b5:[90,110],niacinamide:[90,110],dexpanthenol:[90,110]};
/* a result this far off claim is a compounding or dilution error, not process
   variation, so it is held out of the mean, the rolling line and the y-scale.
   It still counts as a failed batch everywhere a verdict is counted. The
   threshold sits far outside the 90-110 criterion so a near-miss like 112% stays in. */
const GROSS=50;
const specOf=n=>SPEC[String(n||'').toLowerCase()]||[90,110];
const VN=['In control','Outside target','Excursion','Out of spec'];
const VP=['p-ok','p-warn','p-ser','p-crit'], VI=['✓','○','▲','⚠'];
function verdict(pct,analyte){
  if(pct==null)return null;
  const [lo,hi]=specOf(analyte), ctr=(lo+hi)/2;
  if(pct<lo||pct>hi)return 3;
  if(pct<ctr-7||pct>ctr+7)return 2;
  if(pct<ctr-4||pct>ctr+4)return 1;
  return 0;
}
const ING=[{k:'Tirzepatide',c:'var(--i1)'},{k:'Semaglutide',c:'var(--i6)'},{k:'Cyanocobalamin',c:'var(--i2)',alt:'B12'},
           {k:'Glycine',c:'var(--i3)'},{k:'B3',c:'var(--i4)',alt:'niacinamide'},
           {k:'B5',c:'var(--i5)',alt:'dexpanthenol'}]
  .map(g=>{const s=specOf(g.k),ctr=(s[0]+s[1])/2;return{...g,spec:s,ctr,exc:[ctr-7,ctr+7]}});
const ingOf=k=>ING.find(g=>g.k===k);
/* Every ingredient is charted on one 90-110 scale centred on 100. A component
   whose criterion is centred elsewhere (B12, 95-115 centred on 105) is shifted
   by that difference for the chart only -- the tables, the verdicts and the
   exports all keep the result exactly as the CoA reports it. */
const offOf=k=>{const g=ingOf(k);return g?g.ctr-100:0};
const alignV=(k,v)=>v==null?null:+(v-(align?offOf(k):0)).toFixed(4);

/* ---------- CSV ---------- */
function parseCSV(text){
  const rows=[];let f='',row=[],q=false;
  for(let i=0;i<text.length;i++){const c=text[i];
    if(q){ if(c==='"'){ if(text[i+1]==='"'){f+='"';i++} else q=false } else f+=c }
    else if(c==='"')q=true;
    else if(c===','){row.push(f);f=''}
    else if(c==='\n'){row.push(f);f='';rows.push(row);row=[]}
    else if(c!=='\r')f+=c}
  if(f.length||row.length){row.push(f);rows.push(row)}
  return rows.filter(r=>r.some(x=>String(x).trim()!==''));
}
function b64utf8(b64){
  const bin=atob(String(b64).replace(/\s/g,''));
  const bytes=new Uint8Array(bin.length);
  for(let i=0;i<bin.length;i++)bytes[i]=bin.charCodeAt(i);
  return new TextDecoder('utf-8').decode(bytes);
}
const norm=s=>String(s||'').toLowerCase().replace(/[^a-z0-9]/g,'');
/* ISO week (Mon-Sun), the same buckets the workbook uses */
function isoWeek(ds){
  if(!/^\d{4}-\d{2}-\d{2}$/.test(ds||''))return '';
  const d=new Date(ds+'T00:00:00Z'), day=(d.getUTCDay()+6)%7;
  const th=new Date(d); th.setUTCDate(d.getUTCDate()-day+3);
  const first=new Date(Date.UTC(th.getUTCFullYear(),0,4));
  const fday=(first.getUTCDay()+6)%7;
  const w=1+Math.round((th-first-(3-fday)*864e5)/(7*864e5));
  return th.getUTCFullYear()+'-W'+String(w).padStart(2,'0');
}
const weekStart=ds=>{const d=new Date(ds+'T00:00:00Z');
  d.setUTCDate(d.getUTCDate()-((d.getUTCDay()+6)%7));return d.toISOString().slice(0,10)};
/* the Monday of an ISO week key such as 2026-W40. Week 1 is the one holding
   4 January, so counting from that week's Monday gives any week's Monday. */
function weekMonday(key){
  const m=/^(\d{4})-W(\d{2})$/.exec(key||'');
  if(!m)return null;
  const jan4=new Date(Date.UTC(+m[1],0,4));
  const mon=new Date(jan4);
  mon.setUTCDate(jan4.getUTCDate()-((jan4.getUTCDay()+6)%7)+(+m[2]-1)*7);
  return mon.toISOString().slice(0,10);
}
function mapRows(rows){
  if(!rows.length)return [];
  const head=rows[0].map(norm);
  const find=(...cands)=>{for(const c of cands){const i=head.findIndex(h=>h===norm(c));if(i>=0)return i}
    for(const c of cands){const i=head.findIndex(h=>h.startsWith(norm(c)));if(i>=0)return i}return -1};
  const ix={lot:find('Lot'),date:find('Date Compounded','Date'),fid:find('Formula ID','FormulaID'),
    strength:find('Strength'),lab:find('Lab'),
    api:find('API'),apiLab:find('API Label (mg/mL)','APILabel'),apiRes:find('API Result (mg/mL)','APIResult'),
    sec:find('Secondary','Additive'),secLab:find('Sec Label (mg/mL)','AdditiveLabel'),
    secRes:find('Sec Result (mg/mL)','AdditiveResult'),
    endo:find('Endo Result (EU/mL)','Endotoxin'),endoLim:find('Endo Limit (EU/mL)','Endo Limit'),
    ster:find('Sterility Status','Sterility'),
    qa:find('QA Disposition (Drive title)','QA Disposition','QADisposition'),
    who:find('Compounded/Filled By','Compounded'),
    oT:find('API Outlier'),oS:find('Sec Outlier'),oWhy:find('Outlier Reason'),
    ter:find('Tertiary'),terLab:find('Ter Label (mg/mL)'),terRes:find('Ter Result (mg/mL)')};
  if(ix.lot<0||ix.apiRes<0)return [];
  const num=v=>{const x=parseFloat(String(v==null?'':v).replace(/[^0-9.\-]/g,''));return isFinite(x)?x:null};
  const full={C:'Cyanocobalamin',G:'Glycine',P:'Pharmetric',M:'Miraxis'};
  const out=[];
  for(let i=1;i<rows.length;i++){
    const r=rows[i], at=j=>j>=0?String(r[j]==null?'':r[j]).trim():'';
    const lot=at(ix.lot); if(!lot||!/\d/.test(lot))continue;
    const apiRes=num(at(ix.apiRes)), apiLab=num(at(ix.apiLab));
    if(apiRes==null||!apiLab)continue;
    let secName=at(ix.sec); secName=SECNAME[secName]||full[secName]||secName;
    const secRes=num(at(ix.secRes)), secLab=num(at(ix.secLab));
    const apiName=at(ix.api)||'Tirzepatide';
    const T=+(apiRes/apiLab*100).toFixed(2);
    const S=(secRes!=null&&secLab)?+(secRes/secLab*100).toFixed(2):null;
    const TV=verdict(T,apiName), SV=verdict(S,secName);
    let d=at(ix.date);
    const m=d.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
    if(m)d=`${m[3]}-${String(m[1]).padStart(2,'0')}-${String(m[2]).padStart(2,'0')}`;
    if(!/^\d{4}-\d{2}-\d{2}$/.test(d)){
      const lm=lot.match(/^(\d{2})(\d{2})(\d{4})/);
      d=lm?`${lm[3]}-${lm[1]}-${lm[2]}`:'';
    }
    if(!d)continue;
    /* the feed carries the outlier columns when the mirrored tab has them;
       otherwise the same rule is applied here, so the page never silently
       averages in a not-detected or several-times-claim result */
    const yes=j=>j>=0&&/^y/i.test(at(j));
    const has=ix.oT>=0&&at(ix.oT)!=='';
    const oT=has?yes(ix.oT):(apiRes===0||Math.abs(T-100)>GROSS);
    const oS=(S==null)?false:(ix.oS>=0&&at(ix.oS)!==''?yes(ix.oS):(secRes===0||Math.abs(S-100)>GROSS));
    /* third component of a three-component product (B5): judged like the others,
       so a lot with a good API and B3 but B5 out of spec still reads as failed */
    let terName=at(ix.ter); terName=SECNAME[terName]||terName;
    const terRes=num(at(ix.terRes)), terLab=num(at(ix.terLab));
    const R3=(terName&&terRes!=null&&terLab)?+(terRes/terLab*100).toFixed(2):null;
    const RV=verdict(R3,terName);
    const oR=R3!=null&&(terRes===0||Math.abs(R3-100)>GROSS);
    const why=at(ix.oWhy)||((oT&&apiRes===0)||(oS&&secRes===0)?'Not detected'
      :(oT||oS)?'Gross deviation (>'+GROSS+' points off claim)':'');
    out.push({lot,date:d,fid:at(ix.fid),strength:at(ix.strength),lab:full[at(ix.lab)]||at(ix.lab),
      apiName,T,TV,secName:S!=null?secName:'',add:S,addV:SV,
      endo:num(at(ix.endo)),endoLimit:num(at(ix.endoLim)),
      ster:(at(ix.ster)||'').toUpperCase().startsWith('P')?'PASS':(at(ix.ster)||null),
      qa:at(ix.qa),v:Math.max(TV||0,SV==null?0:SV,RV==null?0:RV),
      terName:R3!=null?terName:'',ter:R3,terV:RV,oR,
      oT,oS,oWhy:why,
      who:(at(ix.who)&&at(ix.who)!==UNASSIGNED?at(ix.who):(SNAPWHO[lot]||'')),
      week:isoWeek(d)});
  }
  return out;
}
const SECNAME={C:'Cyanocobalamin',G:'Glycine','3':'B3','5':'B5'};
/* the GitHub build carries no embedded data: names come from the feed's
   Compounded/Filled By column only */
const SNAPWHO={};
const UNASSIGNED='— unassigned —';

/* ---------- state ---------- */
/* ALL is every lot; LOTS is what the formulation filter lets through, and every
   view on the page reads LOTS. The compounding-day axis is rebuilt from LOTS so
   filtering to one formulation still leaves no gaps. */
let ALL=[],LOTS=[],DAYS=[],WEEKS=[],P0=0,P1=0,win={a:0,b:0},LIVE=false,READAT=null;
const PMIN=1, ingOn={Tirzepatide:true,Semaglutide:true,Cyanocobalamin:true,Glycine:true,B3:true,B5:true};
let smooth=true, selDay=null, selWeek=null, fidOn={}, FIDS=[];
let align=true;   /* B12 shifted onto the 100% scale for charting */
let dropOut=true; /* gross errors out of the mean, the line and the y-scale */
let pmode='day';  /* the summary tab: one day or one ISO week */
function loadRows(rows,live){
  ALL=rows.slice().sort((a,b)=>a.date<b.date?-1:a.date>b.date?1:(a.lot<b.lot?-1:1));
  ALL.forEach(l=>{if(!l.week)l.week=isoWeek(l.date)});
  LIVE=live;
  FIDS=[...new Set(ALL.map(l=>l.fid))].sort();
  const prev=fidOn; fidOn={};
  FIDS.forEach(f=>fidOn[f]=(f in prev)?prev[f]:true);
  if(!FIDS.some(f=>fidOn[f]))FIDS.forEach(f=>fidOn[f]=true);
  layout(true);
}
function layout(reset){
  LOTS=ALL.filter(l=>fidOn[l.fid]);
  DAYS=[...new Set(LOTS.map(l=>l.date))].sort();
  const idx={};DAYS.forEach((d,i)=>idx[d]=i);
  const by={};LOTS.forEach(l=>{(by[l.date]=by[l.date]||[]).push(l)});
  Object.values(by).forEach(a=>a.forEach((l,i)=>l.p=idx[l.date]+(i+0.5)/a.length));
  LOTS.sort((a,b)=>a.p-b.p);
  WEEKS=[...new Set(LOTS.map(l=>l.week).filter(Boolean))].sort();
  P0=0;P1=DAYS.length;
  if(reset||win.b>P1||win.a>=win.b)win={a:P0,b:P1};
  if(!DAYS.includes(selDay)){           // keep the nearest day at or before the old pick
    let pick=null;
    if(selDay)DAYS.forEach(d=>{if(d<=selDay)pick=d});
    selDay=pick||DAYS[DAYS.length-1]||null;
  }
  if(!WEEKS.includes(selWeek)){
    let pick=null;
    if(selWeek)WEEKS.forEach(w=>{if(w<=selWeek)pick=w});
    selWeek=pick||WEEKS[WEEKS.length-1]||null;
  }
}
/* ---------- the summary tab reads one of two buckets ---------- */
const periods=()=>pmode==='week'?WEEKS:DAYS;
const selP=()=>pmode==='week'?selWeek:selDay;
const setP=v=>{if(pmode==='week')selWeek=v;else selDay=v};
const inP=(l,v)=>pmode==='week'?l.week===v:l.date===v;
const pLots=v=>LOTS.filter(l=>inP(l,v));
const outOf=(l,k)=>k===l.apiName?!!l.oT:(k===l.secName?!!l.oS:(k===l.terName?!!l.oR:false));
const fidMeta=f=>{
  const g=ALL.filter(l=>l.fid===f);
  const sc={};g.forEach(l=>{if(l.secName)sc[l.secName]=(sc[l.secName]||0)+1});
  const sec=Object.keys(sc).sort((a,b)=>sc[b]-sc[a])[0]||'';
  const st=(g.find(l=>l.strength)||{}).strength||'';
  const SH={Cyanocobalamin:'B12',Glycine:'Gly',B3:'B3',B5:'B5'};
  return {n:g.length,strength:st,short:(st.split('/')[0]||st).trim(),
          sec,secShort:SH[sec]||(sec?sec.slice(0,3):'—'),
          name:(g[0]||{}).apiName?((g[0].apiName)+(sec?'/'+sec:'')):'—'};
};
const dshort=ds=>new Date(ds+'T00:00:00Z').toLocaleDateString('en-US',{month:'short',day:'numeric',timeZone:'UTC'});
function ingVal(l,k){
  if(k===l.apiName)return [l.T,l.TV,!!l.oT];
  if(k===l.secName)return [l.add,l.addV,!!l.oS];
  if(k===l.terName)return [l.ter,l.terV,!!l.oR];
  return [null,null,false];
}
const ingCount=k=>LOTS.filter(l=>ingVal(l,k)[0]!=null).length;
/* the points that actually get plotted and averaged: aligned onto the 100%
   scale, and with held-out gross errors removed */
function ingPts(k){
  const o=[];
  LOTS.forEach(l=>{const [v,vd,out]=ingVal(l,k);
    if(v==null)return;
    if(out&&dropOut)return;
    o.push([l.p,alignV(k,v),vd,out,l]);});
  return o;
}
const heldLots=()=>LOTS.filter(l=>l.oT||l.oS||l.oR);
const dateToPos=(ds,end)=>{if(end){let i=-1;DAYS.forEach((d,j)=>{if(d<=ds)i=j});return i<0?P0:i+1}
  let i=DAYS.length;for(let j=DAYS.length-1;j>=0;j--)if(DAYS[j]>=ds)i=j;return i>=DAYS.length?P1:i};
const roll=(p,w)=>{const o=[];for(let j=0;j<p.length;j++){
  const a=Math.max(0,j-(w>>1)),b=Math.min(p.length-1,j+(w>>1));let s=0,n=0;
  for(let k=a;k<=b;k++){s+=p[k][1];n++}o.push([p[j][0],s/n])}return o};
/* an ingredient the current formulation filter leaves with no lots is not drawn —
   its bands would be a rule with nothing under it */
/* band geometry, shifted when the B12 alignment is on */
const aCtr=g=>align?100:g.ctr;
const aSpec=g=>align?[g.spec[0]-offOf(g.k),g.spec[1]-offOf(g.k)]:g.spec;
const aExc=g=>{const c=aCtr(g);return [c-7,c+7]};
function activeIng(){
  let a=ING.filter(g=>ingOn[g.k]&&ingCount(g.k)>0);
  if(!a.length)a=ING.filter(g=>ingCount(g.k)>0);
  if(!a.length)a=ING.filter(g=>ingOn[g.k]);
  return a;
}
function ingChips(){
  $('#ingchips').innerHTML=ING.map(g=>{const n=ingCount(g.k), off=n===0;
    return `<button class="chip" type="button" aria-pressed="${!off&&!!ingOn[g.k]}" data-ing="${g.k}"`
    +(off?' disabled title="Not part of the formulations selected above"':'')
    +` style="color:${off?'var(--muted)':(ingOn[g.k]?g.c:'var(--ink2)')}">`
    +`<i class="sq" style="background:${off?'var(--muted)':g.c}"></i>${g.k}`
    +(g.alt?`<span class="fsub">${g.alt}</span>`:'')
    +`<span class="n">${n}</span></button>`}).join(' ');
}
function fidChips(rebuild){
  const box=$('#fidchips');
  if(rebuild||box.children.length!==FIDS.length){
    box.innerHTML=FIDS.map(f=>{const m=fidMeta(f),on=!!fidOn[f];
      return `<button class="chip" type="button" aria-pressed="${on}" data-f="${f}" `
        +`title="F${f} — ${m.name} ${m.strength} · ${m.n} lots" `
        +`style="color:${on?'var(--accent)':'var(--ink2)'}">F${f}`
        +`<span class="fsub">${m.short} ${m.secShort}</span>`
        +`<span class="n">${m.n}</span></button>`}).join('');
  }else{
    /* update in place — replacing the markup would detach the node a double-click
       is still travelling through, and the isolate shortcut would never fire */
    FIDS.forEach(f=>{const b=box.querySelector('[data-f="'+f+'"]');if(!b)return;
      b.setAttribute('aria-pressed',!!fidOn[f]);
      b.style.color=fidOn[f]?'var(--accent)':'var(--ink2)'});
  }
  const on=FIDS.filter(f=>fidOn[f]).length;
  $('#fidall').disabled=on===FIDS.length;
  $('#fidcs').textContent=(on===FIDS.length
    ? `all ${FIDS.length} formulations · ${LOTS.length} lots`
    : `${on} of ${FIDS.length} formulations · ${LOTS.length} of ${ALL.length} lots`)
    +' — click to toggle, double-click to isolate one';
}
function refilter(){
  layout(true);
  fidChips(false);ingChips();presetChips();drawPotency();
}
$('#fidchips').onclick=e=>{const b=e.target.closest('.chip');if(!b)return;
  const f=b.dataset.f;
  if(fidOn[f]&&FIDS.filter(k=>fidOn[k]).length===1)return;   // never filter down to nothing
  fidOn[f]=!fidOn[f];refilter()};
$('#fidchips').ondblclick=e=>{const b=e.target.closest('.chip');if(!b)return;
  FIDS.forEach(k=>fidOn[k]=k===b.dataset.f);refilter()};
$('#fidall').onclick=()=>{FIDS.forEach(k=>fidOn[k]=true);refilter()};

function viewChips(){
  const nh=heldLots().length;
  const chip=(on,attr,label,title)=>`<button class="chip" type="button" aria-pressed="${on}" ${attr}`
    +(title?` title="${title}"`:'')+` style="color:${on?'var(--accent)':'var(--ink2)'}">${label}</button>`;
  $('#viewchips').innerHTML=
    chip(smooth,'data-v="1"','Rolling mean')+' '
   +chip(!smooth,'data-v="0"','Raw points')
   +'<span style="display:inline-block;width:10px"></span>'
   +chip(align,'data-a="1"','Align B12 −5',
         'B12 is held to 95-115% centred on 105. Shifting it down 5 points puts every ingredient on one 90-110 band centred on 100. Chart only -- tables and verdicts keep the reported result.')+' '
   +chip(dropOut,'data-o="1"','Hold out outliers'+(nh?' ('+nh+')':''),
         'Keep gross errors -- an analyte not detected, or one more than '+GROSS+' points off claim -- out of the mean, the rolling line and the y-scale. They still count as failures everywhere else.');
}
function presetChips(){
  const months=[...new Set(DAYS.map(d=>d.slice(0,7)))].sort();
  const opts=[{k:'all'},{k:'d14'},{k:'d30'}].concat(months.map(m=>({k:'m'+m})));
  const last=DAYS[DAYS.length-1];
  const minus=(ds,n)=>new Date(Date.parse(ds+'T00:00:00Z')-n*864e5).toISOString().slice(0,10);
  const span=o=>o.k==='all'?[P0,P1]:o.k[0]==='m'
    ?[dateToPos(o.k.slice(1)+'-01',false),dateToPos(o.k.slice(1)+'-31',true)]
    :[dateToPos(minus(last,parseInt(o.k.slice(1))-1),false),P1];
  const lab=o=>o.k==='all'?'All':o.k[0]==='m'
    ?new Date(o.k.slice(1)+'-01T00:00:00Z').toLocaleDateString('en-US',{month:'long',timeZone:'UTC'})
    :'Last '+o.k.slice(1)+' days';
  $('#presets').innerHTML=opts.map(o=>{const [a,b]=span(o);
    const on=Math.abs(win.a-a)<0.01&&Math.abs(win.b-b)<0.01;
    return `<button class="chip" type="button" aria-pressed="${on}" data-a="${a}" data-b="${b}" style="color:${on?'var(--accent)':'var(--ink2)'}">${lab(o)}</button>`}).join(' ');
}
function potChart(){
  const W=1000,H=400,M={t:16,r:152,b:52,l:50},iw=W-M.l-M.r,ih=H-M.t-M.b;
  const act=activeIng();
  const full=act.map(g=>({g,pts:ingPts(g.k)}));
  const inw=p=>p[0]>=win.a&&p[0]<=win.b;
  const shown=full.map(({g,pts})=>({g,pts:pts.filter(inw),rm:roll(pts,15).filter(inw)}));
  const vals=shown.flatMap(s=>s.pts.map(p=>p[1])).concat(act.flatMap(g=>aExc(g)));
  const single=act.length===1?act[0]:null;
  if(single)vals.push(...aSpec(single));
  if(!vals.length)vals.push(93,107);
  /* the acceptance limits -- a lot outside these FAILS -- are always on the chart
     and always inside the y-range, so every point can be read against them */
  const FAILS=[...new Set(act.flatMap(g=>aSpec(g)))].sort((a,b)=>a-b);
  vals.push(...FAILS.map(v=>v<100?v-1:v+1));
  const lo=Math.floor((Math.min(...vals)-2.5)/2)*2,hi=Math.ceil((Math.max(...vals)+2.5)/2)*2;
  const X=p=>M.l+(p-win.a)/(win.b-win.a||1)*iw,Y=v=>M.t+ih-(v-lo)/(hi-lo)*ih;
  let s='';
  if(single){const sp=aSpec(single);
    s+=`<rect x="${M.l}" y="${Y(sp[1])}" width="${iw}" height="${Y(sp[0])-Y(sp[1])}" fill="var(--bandSpec)"/>`}
  const ctrs=[...new Set(act.map(g=>aCtr(g)))].sort((a,b)=>a-b);
  if(ctrs.length===1)s+=`<rect x="${M.l}" y="${Y(ctrs[0]+4)}" width="${iw}" height="${Y(ctrs[0]-4)-Y(ctrs[0]+4)}" fill="var(--bandOk)"/>`;
  ticks(lo,hi,6).forEach(v=>{s+=`<line class="gl" x1="${M.l}" x2="${M.l+iw}" y1="${Y(v)}" y2="${Y(v)}"/>`
    +`<text class="tk" x="${M.l-8}" y="${Y(v)+3.5}" text-anchor="end">${v.toFixed(0)}</text>`});
  const multi=ctrs.length>1, rules=[];
  ctrs.forEach(ct=>{const tag=multi?` (${ct}%)`:'';
    rules.push([ct-4,'var(--warn)','Target −4%'+tag],[ct+4,'var(--warn)','Target +4%'+tag],
               [ct-7,'var(--crit)','Excursion −7%'+tag],[ct+7,'var(--crit)','Excursion +7%'+tag])});
  FAILS.forEach(v=>{const who=act.filter(g=>aSpec(g).includes(v));
    const tag=(!align&&who.length<act.length)?' ('+who.map(g=>g.alt||g.k).join(', ')+')':'';
    rules.push([v,'var(--crit)',(v<100?'Fail <':'Fail >')+v+'%'+tag,1])});
  const dr=rules.filter(([v])=>v>=lo&&v<=hi).map(([v,c,lb,solid])=>({v,c,lb,solid,y:Y(v)})).sort((a,b)=>a.y-b.y);
  let pv=-99; dr.forEach(d=>{const ly=Math.max(d.y,pv+11);pv=ly;
    s+=d.solid
      ?`<line x1="${M.l}" x2="${M.l+iw}" y1="${d.y}" y2="${d.y}" stroke="${d.c}" stroke-width="2.2"/>`
      :`<line x1="${M.l}" x2="${M.l+iw}" y1="${d.y}" y2="${d.y}" stroke="${d.c}" stroke-width="1.4" stroke-dasharray="6 4" opacity=".85"/>`;
    s+=`<text class="tk" x="${M.l+iw+8}" y="${ly+3.5}" style="fill:${d.c}${d.solid?';font-weight:700':''}">${d.lb}</text>`});
  s+=`<line class="ax" x1="${M.l}" x2="${M.l+iw}" y1="${M.t+ih}" y2="${M.t+ih}"/>`;
  const d0=Math.max(0,Math.floor(win.a)),d1=Math.min(DAYS.length-1,Math.ceil(win.b)-1);
  const nd=d1-d0+1,ks=Math.max(1,Math.ceil(nd/14));
  for(let di=d0;di<=d1;di++){
    if(di>d0)s+=`<line class="gl" x1="${X(di)}" x2="${X(di)}" y1="${M.t}" y2="${M.t+ih}" opacity=".5"/>`;
    if((di-d0)%ks===0)s+=`<text class="tk" x="${X(di+0.5)}" y="${M.t+ih+16}" text-anchor="middle">${dshort(DAYS[di])}</text>`}
  s+=`<text class="atitle" x="${M.l+iw/2}" y="${H-8}" text-anchor="middle">Compounding day — days with no production are removed</text>`;
  s+=`<text class="atitle" transform="translate(12,${M.t+ih/2}) rotate(-90)" text-anchor="middle">Potency (% label claim)</text>`;
  s+=`<clipPath id="pc"><rect x="${M.l}" y="${M.t-4}" width="${iw}" height="${ih+8}"/></clipPath><g clip-path="url(#pc)">`;
  shown.forEach(({g,pts,rm})=>{if(!pts.length)return;
    if(smooth){s+=pts.map(q=>`<circle cx="${X(q[0])}" cy="${Y(q[1])}" r="2.3" fill="${g.c}" opacity=".32"/>`).join('');
      if(rm.length>1)s+=`<path d="${rm.map((q,j)=>(j?'L':'M')+X(q[0])+' '+Y(q[1])).join(' ')}" fill="none" stroke="${g.c}" stroke-width="2.5" stroke-linejoin="round" stroke-linecap="round"/>`}
    else s+=pts.map(q=>`<circle cx="${X(q[0])}" cy="${Y(q[1])}" r="3.1" fill="${g.c}" opacity=".9" stroke="var(--surface)" stroke-width="0.8"/>`).join('')});
  shown.forEach(({pts})=>pts.forEach(q=>{
    if(q[3]){const x=X(q[0]),y=Y(q[1]);     // kept in on request: ring it
      s+=`<circle cx="${x}" cy="${y}" r="6.5" fill="none" stroke="var(--crit)" stroke-width="1.6" stroke-dasharray="3 2"/>`}
    if(q[2]===3){const x=X(q[0]),y=Y(q[1]),r=5;
      s+=`<path d="M${x} ${y-r} L${x+r} ${y} L${x} ${y+r} L${x-r} ${y} Z" fill="var(--crit)" stroke="var(--surface)" stroke-width="1.2"/>`}
    else if(q[2]===2){const x=X(q[0]),y=Y(q[1]),r=4.3;
      s+=`<path d="M${x} ${y-r} L${x+r} ${y+r*.85} L${x-r} ${y+r*.85} Z" fill="var(--serious)" stroke="var(--surface)" stroke-width="1.1"/>`}}));
  /* a held-out point has no place on a 90-110 scale, but hiding it entirely
     would lose WHEN it happened, so it is pinned to the edge it ran off */
  const lastHeld={up:-99,dn:-99};
  if(dropOut)heldLots().forEach(l=>{
    if(l.p<win.a||l.p>win.b)return;
    act.forEach(g=>{const [v,,out]=ingVal(l,g.k);
      if(v==null||!out)return;
      /* kept off the very edge so the caret and its label are not clipped */
      const up=v>g.ctr, x=Math.min(Math.max(X(l.p),M.l+14),M.l+iw-14),
            y=up?M.t+8:M.t+ih-8, d=up?-1:1;
      s+=`<path d="M${x} ${y+d*6} L${x+5.5} ${y-d*4} L${x-5.5} ${y-d*4} Z" `
       +`fill="var(--critBg)" stroke="var(--crit)" stroke-width="1.6"/>`;
      const k=up?'up':'dn';
      if(x-lastHeld[k]>34)s+=`<text class="tk" x="${x}" y="${y+(up?15:-9)}" text-anchor="middle" style="fill:var(--crit)">held</text>`;
      lastHeld[k]=x});
  });
  s+=`</g>`;
  const vis=LOTS.filter(l=>l.p>=win.a&&l.p<=win.b),bw=Math.max(7,iw/Math.max(1,vis.length));
  vis.forEach(l=>{let h=`<b>Lot ${l.lot}</b><div class="r"><span>Formulation</span><i>F${l.fid} · ${l.strength}</i></div>`
      +`<div class="r"><span>Compounded</span><i>${l.date}</i></div>`;
    ING.forEach(g=>{const [v,vd,out]=ingVal(l,g.k);if(v==null)return;
      h+=`<div class="r"><span>${g.k}${g.alt?' ('+g.alt+')':''}${ingOn[g.k]?'':' (hidden)'}</span>`
       +`<i>${fmt(v)}% — ${VN[vd]||'—'}${out?' · held out':''}</i></div>`});
    h+=`<div class="r"><span>Lot verdict</span><i>${VI[l.v]} ${VN[l.v]}</i></div>`
      +`<div class="r"><span>Lab</span><i>${l.lab}</i></div>`
      +`<div class="r"><span>Mixer / filler (PK log)</span><i>${l.who||'—'}</i></div>`
      +(l.oWhy?`<div class="r"><span>Held out of the mean</span><i>${l.oWhy}</i></div>`:'')
      +(l.qa?`<div class="r"><span>QA disposition</span><i>${l.qa}</i></div>`:'');
    s+=`<rect class="hit" x="${X(l.p)-bw/2}" y="${M.t}" width="${bw}" height="${ih}" data-h="${encodeURIComponent(h)}"/>`});
  return s;
}
function brushChart(){
  const W=1000,H=74,M={t:8,r:152,b:18,l:50},iw=W-M.l-M.r,ih=H-M.t-M.b;
  const act=activeIng();
  const ser=act.map(g=>({g,rm:roll(ingPts(g.k),15)}));
  const vals=ser.flatMap(s=>s.rm.map(p=>p[1]));
  if(!vals.length)vals.push(99,101);
  const lo=Math.min(...vals)-1,hi=Math.max(...vals)+1;
  const X=p=>M.l+(p-P0)/(P1-P0||1)*iw,Y=v=>M.t+ih-(v-lo)/(hi-lo||1)*ih;
  let s=`<rect x="${M.l}" y="${M.t}" width="${iw}" height="${ih}" fill="var(--sunken)" rx="3"/>`;
  ser.forEach(({g,rm})=>{if(rm.length>1)
    s+=`<path d="${rm.map((q,j)=>(j?'L':'M')+X(q[0])+' '+Y(q[1])).join(' ')}" fill="none" stroke="${g.c}" stroke-width="1.3" opacity=".9"/>`});
  const xa=X(win.a),xb=X(win.b);
  s+=`<rect class="bmask" x="${M.l}" y="${M.t}" width="${Math.max(0,xa-M.l)}" height="${ih}"/>`
   +`<rect class="bmask" x="${xb}" y="${M.t}" width="${Math.max(0,M.l+iw-xb)}" height="${ih}"/>`
   +`<rect class="bwin" id="bwin" x="${xa}" y="${M.t}" width="${Math.max(1,xb-xa)}" height="${ih}"/>`
   +`<rect class="bh" id="bh0" x="${xa-3}" y="${M.t}" width="6" height="${ih}" rx="2"/>`
   +`<rect class="bh" id="bh1" x="${xb-3}" y="${M.t}" width="6" height="${ih}" rx="2"/>`;
  [0,DAYS.length>>1,DAYS.length-1].forEach(i=>{
    s+=`<text class="tk" x="${X(i+0.5)}" y="${H-4}" text-anchor="middle">${dshort(DAYS[i])}</text>`});
  s+=`<text class="tk" x="${M.l+iw+8}" y="${M.t+ih/2+3}">full history</text>`;
  return s;
}
function rangeLabel(){
  const vis=LOTS.filter(l=>l.p>=win.a&&l.p<=win.b);
  const days=new Set(vis.map(l=>l.date)).size;
  const a=vis.length?vis[0].date:DAYS[0],b=vis.length?vis[vis.length-1].date:DAYS[DAYS.length-1];
  $('#rangelabel').textContent=`${a} → ${b} · ${days} compounding days · ${vis.length} lots`;
}
function drawPotency(){
  const act=activeIng();
  const sel=FIDS.filter(f=>fidOn[f]);
  $('#ptitle').textContent='Potency by ingredient, '+(sel.length===FIDS.length?'all formulations'
    :sel.length===1?'F'+sel[0]+' only':sel.length+' of '+FIDS.length+' formulations');
  $('#pot').innerHTML=potChart(); $('#brush').innerHTML=brushChart();
  rangeLabel(); bindTips($('#pot'));
  $('#plg').innerHTML=act.map(g=>`<span><i class="sw" style="background:${g.c}"></i>${g.k}${align&&offOf(g.k)?' −'+offOf(g.k):''}${smooth?' — 15-lot rolling mean':''} <span style="color:var(--muted)">target ${g.ctr}%</span></span>`).join('')
    +(smooth?`<span><i class="sw" style="background:var(--ink2);opacity:.32;height:8px;width:8px;border-radius:50%"></i>individual lots</span>`:'')
    +`<span><i class="sw dia" style="background:var(--crit)"></i>Out of spec — fails</span>`
    +`<span><i class="sw" style="background:var(--serious);height:9px;width:9px;border-radius:2px"></i>Excursion — investigate</span>`
    +(new Set(act.map(g=>g.ctr)).size===1?`<span><i class="sw" style="background:var(--bandOk);height:11px;border-radius:3px"></i>In control (±4%)</span>`:'')
    +`<span style="color:var(--warn)"><i class="sw dash"></i>Target ±4%</span>`
    +`<span style="color:var(--crit)"><i class="sw dash"></i>Excursion ±7%</span>`
    +`<span style="color:var(--crit);font-weight:700"><i class="sw" style="background:var(--crit);height:3px"></i>Fail limit 90 / 110%</span>`;
  const oos=LOTS.filter(l=>l.v===3).length, exc=LOTS.filter(l=>l.v===2).length;
  const selF=FIDS.filter(f=>fidOn[f]), nf=selF.length;
  $('#pcs').textContent=(nf===FIDS.length?''
      :nf<=4?`F${selF.join(', F')} only · `
      :`${nf} of ${FIDS.length} formulations · `)
    +`${LOTS.length} lots · ${DAYS.length} compounding days · ${WEEKS.length} weeks · ${exc} excursions, ${oos} out of spec · `
    +(act.length===1?`${act[0].k} only, spec ${act[0].spec[0]}–${act[0].spec[1]}%, target ${act[0].ctr}% ±4%`
      :align?`one 90–110 band centred on 100, with B12 shifted −5 so its 95–115 criterion lines up`
      :`control bands centred on each ingredient's own target (B12 105%, the others 100%)`);
  heldNote();
  drawTiles(); drawExc(); periodChips(); drawPeriod(); drawLB();
}
/* what was held out, named, so an exclusion is never silent */
function heldNote(){
  const h=heldLots();
  if(!h.length||!dropOut){$('#heldnote').innerHTML='';return}
  const bits=h.map(l=>{
    const which=[l.oT?(l.apiName||'API'):null,l.oS?(l.secName||'secondary'):null,l.oR?(l.terName||'third component'):null].filter(Boolean).join(' and ');
    const v=l.oT?l.T:l.add;
    return `<b>${l.lot}</b> (${l.date}, F${l.fid}) — ${which} ${v===0?'not detected':fmt(v)+'%'}`}).join(' · ');
  $('#heldnote').innerHTML=`<div class="held">${h.length} lot${h.length===1?'':'s'} held out of the mean, `
    +`the rolling line and the y-scale: ${bits}. Still counted as `
    +`${h.filter(l=>l.v===3).length} out of spec in every tile and on the Excursions tab.</div>`;
}
$('#ingchips').onclick=e=>{const b=e.target.closest('.chip');if(!b)return;const k=b.dataset.ing;
  if(ingOn[k]&&ING.filter(g=>ingOn[g.k]).length===1)return;
  ingOn[k]=!ingOn[k];ingChips();drawPotency()};
$('#viewchips').onclick=e=>{const b=e.target.closest('.chip');if(!b)return;
  if(b.dataset.a)align=!align;
  else if(b.dataset.o)dropOut=!dropOut;
  else smooth=b.dataset.v==='1';
  viewChips();drawPotency()};
$('#presets').onclick=e=>{const b=e.target.closest('.chip');if(!b)return;
  win={a:Math.max(+b.dataset.a,P0),b:Math.min(+b.dataset.b,P1)};
  if(win.b-win.a<PMIN)win.b=Math.min(P1,win.a+PMIN);
  presetChips();drawPotency()};
(function brushSetup(){
  const svg=$('#brush'),W=1000,M={l:50,r:152},iw=W-M.l-M.r;
  const toP=cx=>{const r=svg.getBoundingClientRect();const px=(cx-r.left)/r.width*W;
    return P0+Math.min(1,Math.max(0,(px-M.l)/iw))*(P1-P0)};
  let mode=null,anchor=null,off=0;
  svg.addEventListener('pointerdown',e=>{const id=e.target.id,t=toP(e.clientX);
    if(id==='bh0')mode='a';else if(id==='bh1')mode='b';
    else if(id==='bwin'){mode='pan';off=t-win.a}
    else{mode='new';anchor=t;win={a:t,b:Math.min(P1,t+PMIN)}}
    svg.setPointerCapture(e.pointerId);e.preventDefault();drawPotency();presetChips()});
  svg.addEventListener('pointermove',e=>{if(!mode)return;const t=toP(e.clientX);
    if(mode==='a')win.a=Math.min(t,win.b-PMIN);
    else if(mode==='b')win.b=Math.max(t,win.a+PMIN);
    else if(mode==='new'){win.a=Math.min(anchor,t);win.b=Math.max(anchor,t);
      if(win.b-win.a<PMIN)win.b=win.a+PMIN}
    else{const w=win.b-win.a;win.a=t-off;win.b=win.a+w;
      if(win.a<P0){win.a=P0;win.b=P0+w}if(win.b>P1){win.b=P1;win.a=P1-w}}
    win.a=Math.max(P0,win.a);win.b=Math.min(P1,win.b);drawPotency()});
  const up=()=>{if(mode){mode=null;presetChips()}};
  svg.addEventListener('pointerup',up);svg.addEventListener('pointercancel',up);
  svg.addEventListener('dblclick',()=>{win={a:P0,b:P1};presetChips();drawPotency()});
})();


/* ---------- tiles + excursion table ---------- */
function drawTiles(){
  const n=LOTS.length, oos=LOTS.filter(l=>l.v===3).length, exc=LOTS.filter(l=>l.v===2).length;
  const inc=LOTS.filter(l=>l.v===0).length, ot=LOTS.filter(l=>l.v===1).length;
  /* tirzepatide and semaglutide are different actives; the headline mean is
     tirzepatide's, and semaglutide has its own line on the chart */
  /* when the filter leaves only semaglutide formulations, the tile follows it */
  const AP=LOTS.some(l=>l.apiName==='Tirzepatide')?'Tirzepatide':((LOTS[0]||{}).apiName||'Tirzepatide');
  const api=LOTS.filter(l=>l.apiName===AP&&l.T!=null&&!(dropOut&&l.oT)).map(l=>l.T);
  const mean=api.length?api.reduce((a,b)=>a+b,0)/api.length:null;
  const nfid=new Set(LOTS.map(l=>l.fid)).size;
  const nh=heldLots().filter(l=>l.oT&&l.apiName===AP).length;
  const t=[['Lots trended',n,nfid+(nfid===1?' formulation':' formulations'),0],
    ['Mean '+AP.toLowerCase(),mean==null?'—':fmt(mean)+'%',
      'of label claim'+(dropOut&&nh?` · ${nh} held out`:''),0],
    ['In control',inc,'within ±4% of target',0],
    ['Outside target',ot,'±4–7%, trending',0],
    ['Excursions',exc,'investigate, do not fail',0],
    ['Out of spec',oos,'batch fails',1]];
  $('#tiles').innerHTML=t.map(([l,v,s,c])=>
    `<div class="tile${c&&v?' crit':''}"><div class="lab">${l}</div><div class="val">${v}</div><div class="sub">${s}</div></div>`).join('');
}
function drawExc(){
  const rows=LOTS.filter(l=>l.v>=2).slice().reverse();
  $('#texc').textContent=rows.length;
  $('#excs').textContent=`${rows.length} of ${LOTS.length} lots need QA attention — `
    +`${rows.filter(l=>l.v===2).length} excursions, ${rows.filter(l=>l.v===3).length} out of spec`
    +(heldLots().length?`, including ${heldLots().length} held out of the trend math but still failing.`:'.');
  if(!rows.length){$('#exc').innerHTML='<tbody><tr><td style="color:var(--muted)">Every lot is within the ±7% control limit.</td></tr></tbody>';return}
  $('#exc').innerHTML='<thead><tr>'+['Date','Lot','Formula','Strength','API','API (%)','Additive','Additive (%)','Third','Third (%)','Verdict','Driver','QA disposition','Lab']
    .map((h,i)=>`<th${[5,7,9].includes(i)?' style="text-align:right"':''}>${h}</th>`).join('')+'</tr></thead><tbody>'
    +rows.map(l=>{const lv=l.v;
      const drv=[['API',l.TV],['Additive',l.addV],[l.terName||'Third',l.terV]].filter(([,x])=>x===lv).map(([n])=>n).join(' + ')||'—';
      return `<tr><td>${l.date}</td><td class="lot">${l.lot}</td><td>F${l.fid}</td><td>${l.strength||'—'}</td>`
      +`<td>${l.apiName}</td><td class="n">${l.T===0?'ND':fmt(l.T)}</td><td>${l.secName||'—'}</td><td class="n">${fmt(l.add)}</td>`
      +`<td>${l.terName||'—'}</td><td class="n">${fmt(l.ter)}</td>`
      +`<td><span class="pill ${VP[l.v]}">${VI[l.v]} ${VN[l.v]}</span></td><td>${drv}</td>`
      +`<td style="color:var(--ink2)">${l.qa||'<span style="color:var(--muted)">not flagged</span>'}</td><td>${l.lab||'—'}</td></tr>`}).join('')
    +'</tbody>';
}
/* ---------- the summary tab: one day or one ISO week ---------- */
const DTGT={Tirzepatide:100,Semaglutide:100,Cyanocobalamin:105,Glycine:100,B3:100,B5:100};
const tgtOf=n=>DTGT[n]!=null?DTGT[n]:(specOf(n)[0]+specOf(n)[1])/2;
const dlong=ds=>new Date(ds+'T00:00:00Z').toLocaleDateString('en-US',
  {weekday:'long',month:'long',day:'numeric',year:'numeric',timeZone:'UTC'});
function plabel(v){
  if(!v)return '—';
  if(pmode!=='week')return dlong(v);
  const a=weekMonday(v);
  if(!a)return v;
  const e=new Date(Date.parse(a+'T00:00:00Z')+6*864e5).toISOString().slice(0,10);
  return v+'  ·  '+dshort(a)+' – '+dshort(e);
}
const pshort=v=>pmode==='week'?'W'+v.slice(6):dshort(v);
function periodChips(){
  const P=periods();
  if(!P.length){$('#daychips').innerHTML='';return}
  $('#daychips').innerHTML=P.map(v=>{const on=v===selP();
    return `<button class="chip" type="button" aria-pressed="${on}" data-d="${v}" `
      +`title="${plabel(v)}" style="color:${on?'var(--accent)':'var(--ink2)'}">${pshort(v)}`
      +`<span class="n">${pLots(v).length}</span></button>`}).join('');
  const el=$('#daychips').querySelector('[aria-pressed="true"]');
  if(el&&el.scrollIntoView)el.scrollIntoView({block:'nearest',inline:'center'});
}
function drawPeriod(){
  const P=periods(), v=selP(), g=pLots(v), i=P.indexOf(v);
  const word=pmode==='week'?'week':'day';
  $('#dprev').disabled=i<=0; $('#dnext').disabled=i<0||i>=P.length-1; $('#dlast').disabled=i===P.length-1;
  $('#dlast').textContent='Latest '+word;
  $('#dlabel').textContent=plabel(v);
  $('#dlotshead').textContent='Every lot compounded in this '+word;
  if(!g.length){
    $('#daycs').textContent='No lots on file for this '+word+'.';
    ['#dtiles','#ding','#dother','#dlots'].forEach(k=>$(k).innerHTML='');
    return;
  }
  /* means drop a component's own gross errors; counts keep every lot */
  const api=g.filter(l=>l.apiName==='Tirzepatide'&&l.T!=null&&!(dropOut&&l.oT)).map(l=>l.T);
  const mean=api.length?api.reduce((a,b)=>a+b,0)/api.length:null;
  const cnt=k=>g.filter(l=>l.v===k).length;
  const both=g.filter(l=>l.T!=null&&Math.abs(l.T-100)<=1&&l.add!=null&&l.secName
                          &&Math.abs(l.add-tgtOf(l.secName))<=1).length;
  const fids=new Set(g.map(l=>l.fid)).size;
  const held=g.filter(l=>l.oT||l.oS).length;
  const days=new Set(g.map(l=>l.date)).size;
  $('#daycs').textContent=`${g.length} lot${g.length===1?'':'s'} across ${fids} formulation${fids===1?'':'s'}`
    +(pmode==='week'?` on ${days} compounding day${days===1?'':'s'}`:'')
    +` · ${word} ${i+1} of ${P.length} · tirzepatide ${mean==null?'—':fmt(mean)+'%'} of label claim`
    +(held?` · ${held} result${held===1?'':'s'} held out of the means`:'');

  const tiles=[['Lots tested',g.length,fids+(fids===1?' formulation':' formulations'),0],
    ['In control',cnt(0),'within ±4% of target',0],
    ['Outside target',cnt(1),'±4–7%, trending',0],
    ['Excursions',cnt(2),'investigate, do not fail',0],
    ['Out of spec',cnt(3),'batch fails',1],
    ['Both within ±1',both,'of '+g.length+' lots, tightest band',0]];
  $('#dtiles').innerHTML=tiles.map(([l,x,s,c])=>
    `<div class="tile${c&&x?' crit':''}"><div class="lab">${l}</div><div class="val">${x}</div>`
    +`<div class="sub">${s}</div></div>`).join('');

  const ingRows=ING.map(gr=>{
    const all=g.map(l=>ingVal(l,gr.k)).filter(p=>p[0]!=null);
    if(!all.length)return null;
    const kept=all.filter(p=>!(dropOut&&p[2]));
    const ps=kept.map(p=>p[0]), vs=all.map(p=>p[1]);
    const t=tgtOf(gr.k);
    const m=ps.length?ps.reduce((a,b)=>a+b,0)/ps.length:null;
    const w=tol=>ps.filter(x=>Math.abs(x-t)<=tol).length;
    const mix=[0,1,2,3].map(k=>vs.filter(x=>x===k).length);
    return {k:gr.k,alt:gr.alt,c:gr.c,t,n:all.length,held:all.length-kept.length,m,
            lo:ps.length?Math.min(...ps):null,hi:ps.length?Math.max(...ps):null,
            d:m==null?null:m-t,w1:w(1),w2:w(2),mix};
  }).filter(Boolean);
  const num=x=>x==null?'—':fmt(x,2);
  $('#ding').innerHTML='<thead><tr>'
    +['Ingredient','Target','Lots','Mean','Range','Mean dev','±1','±2','Verdicts']
      .map((h,j)=>`<th${j>=3&&j<=7?' style="text-align:right"':''}>${h}</th>`).join('')
    +'</tr></thead><tbody>'
    +ingRows.map(r=>`<tr><td><i class="sq" style="background:${r.c};display:inline-block;width:9px;height:9px;`
      +`border-radius:2px;margin-right:6px"></i>${r.k}${r.alt?' <span style="color:var(--muted)">('+r.alt+')</span>':''}</td>`
      +`<td>${r.t}%</td>`
      +`<td class="n">${r.n}${r.held?` <span style="color:var(--critFg)" title="held out of the mean">−${r.held}</span>`:''}</td>`
      +`<td class="n">${num(r.m)}%</td>`
      +`<td class="n">${r.lo==null?'—':fmt(r.lo)+'–'+fmt(r.hi)}</td>`
      +`<td class="n dev${r.d!=null&&Math.abs(r.d)>4?' hi':''}">${r.d==null?'—':(r.d>=0?'+':'')+fmt(r.d,2)}</td>`
      +`<td class="n">${r.w1}</td><td class="n">${r.w2}</td>`
      +`<td>${r.mix.map((n,k)=>n?`<span class="pill ${VP[k]}" style="margin-right:4px">${VI[k]} ${n}</span>`:'').join('')}</td></tr>`).join('')
    +'</tbody>';

  const withEndo=g.filter(l=>l.endo!=null), endoPass=withEndo.length;
  const maxEndo=withEndo.length?Math.max(...withEndo.map(l=>l.endo)):null;
  const endoLim=withEndo.map(l=>l.endoLimit).filter(x=>x!=null);
  const st=g.filter(l=>l.ster), stPass=st.filter(l=>String(l.ster).toUpperCase()==='PASS').length;
  const labs={};g.forEach(l=>{if(l.lab)labs[l.lab]=(labs[l.lab]||0)+1});
  const flagged=g.filter(l=>l.qa).length;
  const people={};g.forEach(l=>{(l.who||'').split(' / ').forEach(n=>{
    n=n.trim(); if(n&&n!==UNASSIGNED)people[n]=(people[n]||0)+1})});
  const noname=g.filter(l=>!l.who||l.who===UNASSIGNED).length;
  const kv=[
    ['Endotoxin, USP &lt;85&gt;', withEndo.length
      ? `${endoPass} of ${withEndo.length} pass`+(maxEndo!=null?` · highest ${maxEndo} EU/mL`
        +(endoLim.length?` against a ${Math.max(...endoLim)} EU/mL limit`:''):'')
      : 'no result on file'],
    ['Sterility, ScanRDI', st.length?`${stPass} of ${st.length} pass`:'no result on file'],
    ['Lab', Object.keys(labs).length?Object.entries(labs).map(([k,x])=>`${x} ${k}`).join(' · '):'—'],
    ['Compounded / filled by', Object.keys(people).length
      ? Object.entries(people).sort((a,b)=>b[1]-a[1]).map(([k,x])=>`${k} (${x})`).join(' · ')
        +(noname?` · <span style="color:var(--warnFg)">${noname} lot${noname===1?'':'s'} with no name logged</span>`:'')
      : `<span style="color:var(--warnFg)">no names logged</span>`],
    ['Titled as a failure in Drive', flagged?`${flagged} lot${flagged===1?'':'s'}`:'none'],
    ['Held out of the means', held?`${held} result${held===1?'':'s'} — still counted as failures`:'none'],
    ['Strengths compounded', [...new Set(g.map(l=>l.strength).filter(Boolean))].sort().join(', ')||'—'],
  ];
  $('#dother').innerHTML='<tbody>'+kv.map(([k,x])=>`<tr><th>${k}</th><td>${x}</td></tr>`).join('')+'</tbody>';

  $('#dlots').innerHTML='<thead><tr>'
    +['Lot','Formula','Date','Strength','API','API (%)','Dev','Secondary','Secondary (%)','Dev','Third','Third (%)',
      'Verdict','Held out','Endo','Sterility','QA disposition','Lab','Compounded/Filled By']
      .map((h,j)=>`<th${[5,6,8,9,11].includes(j)?' style="text-align:right"':''}>${h}</th>`).join('')
    +'</tr></thead><tbody>'
    +g.slice().sort((a,b)=>a.date<b.date?-1:a.date>b.date?1:(a.lot<b.lot?-1:1)).map(l=>{
      const dt=l.T==null?null:l.T-100;
      const ds=(l.add==null||!l.secName)?null:l.add-tgtOf(l.secName);
      const cell=d=>d==null?'<td class="n">—</td>'
        :`<td class="n dev${Math.abs(d)>4?' hi':''}">${d>=0?'+':''}${fmt(d)}</td>`;
      const nameless=!l.who||l.who===UNASSIGNED;
      return `<tr><td class="lot">${l.lot}</td><td>F${l.fid}</td><td>${l.date}</td><td>${l.strength||'—'}</td>`
        +`<td>${l.apiName}</td><td class="n">${l.T===0?'ND':fmt(l.T)}</td>`+cell(dt)
        +`<td>${l.secName||'—'}</td><td class="n">${fmt(l.add)}</td>`+cell(ds)
        +`<td>${l.terName||'—'}</td><td class="n${l.terV>=2?' dev hi':''}">${fmt(l.ter)}</td>`
        +`<td><span class="pill ${VP[l.v]}">${VI[l.v]} ${VN[l.v]}</span></td>`
        +`<td style="color:var(--critFg)">${l.oWhy||''}</td>`
        +`<td>${l.endo!=null?l.endo:'—'}</td><td>${l.ster||'—'}</td>`
        +`<td style="color:var(--ink2)">${l.qa||'<span style="color:var(--muted)">not flagged</span>'}</td>`
        +`<td>${l.lab||'—'}</td>`
        +`<td class="who${nameless?' none':''}" title="${l.who||''}">${nameless?UNASSIGNED:l.who}</td></tr>`}).join('')
    +'</tbody>';
}
function stepPeriod(n){const P=periods(), i=P.indexOf(selP())+n;
  if(i<0||i>=P.length)return; setP(P[i]); periodChips(); drawPeriod()}
$('#dprev').onclick=()=>stepPeriod(-1);
$('#dnext').onclick=()=>stepPeriod(1);
$('#dlast').onclick=()=>{const P=periods();setP(P[P.length-1]);periodChips();drawPeriod()};
$('#daychips').onclick=e=>{const b=e.target.closest('.chip');if(!b)return;
  setP(b.dataset.d);periodChips();drawPeriod()};
$('#pmode').onchange=e=>{
  /* carry the selection across: the week that holds the chosen day, or that
     week's last compounding day */
  const was=selP();
  pmode=e.target.value;
  if(pmode==='week'&&was){const w=isoWeek(was);if(WEEKS.includes(w))selWeek=w}
  else if(pmode==='day'&&was){let pick=null;DAYS.forEach(d=>{if(isoWeek(d)===was)pick=d});if(pick)selDay=pick}
  periodChips();drawPeriod();
};

/* ---------- compounder leaderboard ----------
   Every lot is credited to each person named on it in the
   "Compounded/Filled By" column (Personnel tab) (or, with the Credit control, only to the
   person named first -- the compounder -- or second -- the filler).
   Ranked on the share of lots that came back In control (every component
   within +/-4% of its target), ties broken by the smaller average distance
   of the API from 100%. Someone needs LBMIN lots in the period to be ranked,
   so two lucky lots never top the board. Gross-error outliers count as the
   failures they are, but stay out of the average distance. */
const LBMIN=10;
/* every lot earns points by its verdict; a failure costs points because it is a
   lost batch, not just a lot that missed. Change these to retune the board. */
const LBPTS=[100,70,30,-50];   // In control, Outside target, Excursion, Failed
function lbWindow(per){
  const last=DAYS[DAYS.length-1]; if(!last)return [null,null,null,null];
  const minus=(ds,n)=>new Date(Date.parse(ds+'T00:00:00Z')-n*864e5).toISOString().slice(0,10);
  if(per==='all')return ['0000-00-00',last,null,null];
  if(per==='m'){const a=last.slice(0,8)+'01';
    const pm=new Date(Date.parse(a+'T00:00:00Z')-864e5).toISOString().slice(0,8)+'01';
    return [a,last,pm,minus(a,1)]}
  const n=+per; const a=minus(last,n-1);
  return [a,last,minus(a,n),minus(a,1)];
}
function lbPeople(l,role){
  const w=(l.who||'').trim(); if(!w||w===UNASSIGNED)return [];
  const ps=w.split(' / ').map(x=>x.trim()).filter(Boolean);
  return role==='c'?ps.slice(0,1):role==='f'?ps.slice(1,2):ps;
}
function lbStats(rows){
  const n=rows.length, inc=rows.filter(l=>l.v===0).length;
  const dev=rows.filter(l=>l.T!=null&&!l.oT).map(l=>Math.abs(l.T-100));
  const md=dev.length?dev.reduce((a,b)=>a+b,0)/dev.length:null;
  const money=rows.filter(l=>l.T!=null&&!l.oT&&Math.abs(l.T-100)<=1).length;
  const exc=rows.filter(l=>l.v===2).length, oos=rows.filter(l=>l.v===3).length;
  /* current streak: consecutive In-control lots counting back from the latest */
  const ord=rows.slice().sort((a,b)=>a.date<b.date?1:a.date>b.date?-1:(a.lot<b.lot?1:-1));
  let streak=0; for(const l of ord){if(l.v===0)streak++;else break}
  let best=0,run=0; ord.slice().reverse().forEach(l=>{run=l.v===0?run+1:0;best=Math.max(best,run)});
  const score=n?rows.reduce((a,l)=>a+LBPTS[l.v||0],0)/n:null;
  return {n,inc,rate:n?inc/n:null,score,md,money,exc,oos,streak,best};
}
function drawLB(){
  if(!$('#lbt'))return;
  const per=$('#lbper').value, role=$('#lbrole').value;
  const [a,b,pa,pb]=lbWindow(per);
  const inW=l=>l.date>=a&&l.date<=b, inP=l=>pa&&l.date>=pa&&l.date<=pb;
  const by={},prev={};
  LOTS.forEach(l=>{const ps=lbPeople(l,role);
    if(inW(l))ps.forEach(p=>(by[p]=by[p]||[]).push(l));
    if(inP(l))ps.forEach(p=>(prev[p]=prev[p]||[]).push(l))});
  const nameless=LOTS.filter(l=>inW(l)&&!lbPeople(l,'any').length).length;
  const rows=Object.entries(by).map(([p,g])=>{const st=lbStats(g);
    const pv=prev[p]&&prev[p].length>=LBMIN?lbStats(prev[p]):null;
    return {p,...st,delta:pv&&st.score!=null?(st.score-pv.score):null}});
  const ranked=rows.filter(r=>r.n>=LBMIN).sort((x,y)=>(y.score-x.score)||((x.md??99)-(y.md??99)));
  const rest=rows.filter(r=>r.n<LBMIN).sort((x,y)=>y.n-x.n);
  const teamLots=LOTS.filter(l=>inW(l)&&lbPeople(l,role).length);
  const team=lbStats(teamLots);
  const pct=x=>x==null?'—':(x*100).toFixed(0)+'%';
  const span=per==='all'?'all time':`${a} → ${b}`;
  $('#lbcs').textContent=`${span} · ${teamLots.length} lots with a name logged`
    +(nameless?` · ${nameless} with no name, not counted`:'')
    +` · ranked on quality score; at least ${LBMIN} lots to be ranked`;
  /* hero cards */
  const top=ranked[0];
  const streak=rows.filter(r=>r.n>=3).sort((x,y)=>y.best-x.best||y.n-x.n)[0];
  const imp=ranked.filter(r=>r.delta!=null).sort((x,y)=>y.delta-x.delta)[0];
  const card=(lab,who,sub)=>`<div class="lbcard"><div class="lab">${lab}</div><span class="who">${who}</span><div class="sub">${sub}</div></div>`;
  $('#lbhero').innerHTML=
     card('Top of the board',top?top.p:'—',top?`score ${top.score.toFixed(1)} · ${pct(top.rate)} of ${top.n} lots in control · ${top.oos} failed`:`nobody has ${LBMIN} lots in this period yet`)
    +card('Longest in-control run',streak&&streak.best?streak.p:'—',streak&&streak.best?`${streak.best} lots in a row came back in control`:'no in-control lots yet')
    +card('Most improved',imp&&imp.delta>0?imp.p:'—',imp&&imp.delta>0?`score up ${imp.delta.toFixed(1)} on the previous ${per==='m'?'month':per+' days'}`:(per==='all'?'not available for all time':'no improvement to show yet'))
    +card('Team',team.score==null?'—':'score '+team.score.toFixed(1),`${team.n} lots · ${pct(team.rate)} in control · ${team.oos} failed`);
  const head=['#','Name','Score','Lots','In control','On the money (±1)','Avg distance','Excursions','Failed','Best run','vs previous'];
  const num=[3,4,5,6,7,8,9,10];
  const sbar=x=>`<div class="rate"><span class="bar"><i style="width:${Math.max(0,Math.min(100,x||0)).toFixed(1)}%"></i></span><b>${x==null?'—':x.toFixed(1)}</b></div>`;
  const row=(r,i)=>{
    const rk=i==null?'':`<span class="medal${i<3?' g'+(i+1):''}">${i+1}</span>`;
    const d=r.delta==null?'<span class="delta flat">—</span>'
      :`<span class="delta ${r.delta>0.5?'up':r.delta<-0.5?'dn':'flat'}">${r.delta>0?'▲ +':r.delta<0?'▼ ':''}${r.delta.toFixed(1)}</span>`;
    return `<tr${i==null?' class="unranked"':''}><td>${rk}</td><td><b>${r.p}</b></td><td>${sbar(r.score)}</td><td class="n">${r.n}</td>`
      +`<td class="n">${pct(r.rate)}</td>`
      +`<td class="n">${r.money}</td><td class="n">${r.md==null?'—':r.md.toFixed(2)+' pts'}</td>`
      +`<td class="n">${r.exc}</td><td class="n"${r.oos?' style="color:var(--critFg);font-weight:700"':''}>${r.oos}</td>`
      +`<td class="n">${r.best}</td><td class="n">${d}</td></tr>`};
  $('#lbt').innerHTML='<thead><tr>'+head.map((h,j)=>`<th${num.includes(j)?' class="n"':''}>${h}</th>`).join('')+'</tr></thead><tbody>'
    +(ranked.length?ranked.map((r,i)=>row(r,i)).join(''):`<tr><td colspan="11" style="color:var(--muted)">Nobody has ${LBMIN} lots in this period yet.</td></tr>`)
    +`<tr class="team"><td></td><td>Team</td><td>${sbar(team.score)}</td><td class="n">${team.n}</td><td class="n">${pct(team.rate)}</td>`
    +`<td class="n">${team.money}</td><td class="n">${team.md==null?'—':team.md.toFixed(2)+' pts'}</td><td class="n">${team.exc}</td><td class="n">${team.oos}</td><td></td><td></td></tr>`
    +(rest.length?`<tr><td colspan="11" class="lbsub">Building up — fewer than ${LBMIN} lots in this period, not ranked yet</td></tr>`+rest.map(r=>row(r,null)).join(''):'')
    +'</tbody>';
  $('#lbnote').innerHTML='<b>How this is scored.</b> Every lot earns points by its verdict: <b>In control 100</b> (every component within ±4% of target), <b>Outside target 70</b>, <b>Excursion 30</b>, <b>Failed −50</b> — a failure costs points because it is a lost batch, not just a miss. The score is the average over the person’s lots, so 100 means every lot in control. '
    +'<i>In control</i> is the share of lots with that top verdict. '
    +'<i>On the money</i> counts lots with the API within ±1% of label claim. <i>Avg distance</i> is how far the API landed from 100% on average; lower is better, and gross-error outliers are left out of it but still count as failures. '
    +'Ties go to the smaller average distance. <i>Best run</i> is the longest string of consecutive in-control lots in the period. <i>vs previous</i> is the change in score against the same length of time just before. '
    +'A lot is credited to everyone named on it, so partners share results. Some causes are shared by everyone working that week — the API lot, the stock solution, the lab run — '
    +'so the board is fairest read within one period, not across months. The formulation filter at the top applies here too.';
}
$('#lbper').onchange=drawLB; $('#lbrole').onchange=drawLB;
/* ---------- view tabs ---------- */
function showView(v){
  ['trend','sum','lb','exc'].forEach(k=>{
    $('#v-'+k).hidden=k!==v;
    $('#tab-'+k).setAttribute('aria-selected',String(k===v))});
  if(v==='sum'){periodChips();drawPeriod()}
  if(v==='lb')drawLB();
  if(v==='trend')drawPotency();
}
$('.tabs').onclick=e=>{const b=e.target.closest('.tab');if(b)showView(b.dataset.v)};

function setLive(state,text){
  const d=$('#dot');d.className='livedot'+(state==='on'?' on':state==='err'?' err':'');
  $('#livetext').textContent=text;
}
function note(){
  $('#pnote').innerHTML=(LIVE
    ? 'Read live from the <strong>Formulation Trendline — live feed</strong> sheet in Drive, which mirrors the “All Data” tab of your PerfectionRx_Formulation_CoA_Trending workbook. Edit the workbook and this page follows.'
    : 'No data loaded yet.')
    +' Potency % is computed here as result mg/mL ÷ label mg/mL × 100, so the sheet only has to carry the CoA numbers. '
    +'Acceptance criteria: active ingredients 90–110% of label claim (cGMP ±10%), B12 95–115% (monograph); every component named in the label claim counts as active. '
    +'The ±4% target and ±7% excursion limits are control limits centred on the midpoint of each ingredient’s criteria — crossing ±7% triggers a QA investigation but does not fail the batch. '
    +'B3 is niacinamide and B5 dexpanthenol. On three-component products every component is judged and the lot verdict is the worst of the three; B5 is assayed on CoAs from October onward. Semaglutide is trended on its own line and kept out of the tirzepatide mean. '
    +'<strong>Align B12 −5</strong> shifts B12 onto the same 90–110 band as the others for charting only — the tables, the verdicts and the workbook all keep the result as reported against 95–115%. '
    +'<strong>Hold out outliers</strong> keeps a gross error — an analyte not detected, or one more than '+GROSS+' points off claim — out of the mean, the rolling line and the y-scale, while still counting it as a failed batch in every tile and on the Excursions tab. '
    +'Who compounded each lot comes from the Personnel tab of the trending sheet — edit a name there and it shows here on the next load.';
}
function showErr(title,body,crit){
  $('#liveerr').innerHTML=`<div class="banner${crit?' crit':''}"><b>${title}.</b> ${body}</div>`;
}
const FEED_URL='https://docs.google.com/spreadsheets/d/'+FEED_ID+'/edit';
function needsAllow(){
  setLive('err','Live feed not authorised yet');
  showErr('The live feed needs one click to start',
    'The feed sheet pulls your trending workbook with IMPORTRANGE, and Google asks the owner to approve that once. '
    +'Open <a href="'+FEED_URL+'" target="_blank" rel="noopener" style="color:inherit">Formulation Trendline — live feed</a>, '
    +'click <strong>Allow access</strong> on cell A1, then press Refresh here.',true);
}
