(function(){
'use strict';
const $=(s,r=document)=>r.querySelector(s), $$=(s,r=document)=>[...r.querySelectorAll(s)];
const FFF=JSON.parse($('#fff-data').textContent);
let SHARED=[];try{SHARED=JSON.parse($('#shared-events').textContent)||[]}catch(e){}
const CLUB_MAIL='benjamin.ducousso@wizbii.com';
const EVENTS_API='https://script.google.com/macros/s/AKfycbw_lyvwhgyF-4i9jM-mNnHTCkdS-q0W92UeU7QGwgmaayAjGTtJCGB1n2K-VlgkKuEGEg/exec'; // URL de l'application web Apps Script (registre partagé Google Sheet) ; vide = envoi par e-mail
const MODE=document.documentElement.dataset.mode||'jeunes'; // 'jeunes' | 'global'
const LS_KEY=MODE==='global'?'paufc_global_calendar_v1':'paufc_rtj_calendar_v1';
const SEASON_START=new Date('2026-08-01T00:00:00'), SEASON_END=new Date('2027-07-05T00:00:00');
const CAT_COLORS={SEN:'#0E2A5C',SENF:'#7A2A6B',U7:'#8E6BBE',U9:'#5C8BD6',U11:'#2BA4A6',U13:'#3B9E5A',U14:'#7AA334',U15:'#D89B1C',U15F:'#C2731C',U14F:'#9C8A2A',U16:'#E07A2C',U17:'#C9484A',U18:'#8F2D56',U18F:'#B8368E',LOISIR:'#5B7A8C',AUTRE:'#6B7280'};
const CAT_LABEL={SEN:'Seniors',SENF:'Seniors F',U14F:'U14 F',U15F:'U15 F',U18F:'U18 F',LOISIR:'Seniors loisir'};
const FORMAT_PITCH={11:1,8:.5,5:1/3,4:.25,3:.25};
const FORMAT_MIN={11:110,8:90,5:75,4:60,3:60};
// Default settings for the FFF teams (id -> label, category, format, vans)
const TEAM_DEFAULTS={
 '2026_1066_SEM_1':{label:'Seniors (Ligue 2)',cat:'SEN',format:11,vans:0,order:1,gender:'H'},
 '2026_1066_SEM_9':{label:'Seniors 2 (N2)',cat:'SEN',format:11,vans:2,order:2,gender:'H'},
 '2026_1066_SEF_7':{label:'Seniors F (R1)',cat:'SENF',format:11,vans:2,order:5,gender:'F'},
 '2026_1066_U19_2':{label:'U18 R1',cat:'U18',format:11,vans:2,order:10,gender:'H'},
 '2026_1066_U18F_8':{label:'U18 F',cat:'U18F',format:11,vans:2,order:12,gender:'F'},
 '2026_1066_U15_11':{label:'U15 F (D2 garçons)',cat:'U15F',format:11,vans:2,order:45,gender:'F'},
 '2026_1066_FL_17':{label:'Seniors loisir (à 7)',cat:'LOISIR',format:8,vans:1,order:200,gender:'H'},
 '2026_1066_U17_3':{label:'U17 R1',cat:'U17',format:11,vans:2,order:20},
 '2026_1066_U17_4':{label:'U16 R1',cat:'U16',format:11,vans:2,order:30},
 '2026_1066_U15_5':{label:'U15 R1',cat:'U15',format:11,vans:2,order:40},
 '2026_1066_U15_6':{label:'U14 Ligue',cat:'U14',format:11,vans:2,order:50},
 '2026_1066_U13_12':{label:'U13 Élite',cat:'U13',format:8,vans:1,order:60},
 '2026_1066_U13_13':{label:'U13 Excellence (éq. 2)',cat:'U13',format:8,vans:1,order:61},
 '2026_1066_U13_14':{label:'U13 Excellence (éq. 3)',cat:'U13',format:8,vans:1,order:62},
};
// Foot Animation (U7/U9/U11) : équipes alimentées automatiquement par la plateforme FAL du district dès publication des plateaux
const MANUAL_DEFAULT_TEAMS=[
 {id:'fal_U11',label:'U11 (plateaux)',cat:'U11',format:8,vans:1,order:70,fal:true,gender:'H'},
 {id:'fal_U9',label:'U9 (plateaux)',cat:'U9',format:5,vans:1,order:80,fal:true,gender:'H'},
 {id:'fal_U7',label:'U7 (plateaux)',cat:'U7',format:4,vans:1,order:90,fal:true,gender:'H'},
];
const CAT_ORDER=['SEN','SENF','U18','U18F','U17','U16','U15','U15F','U14','U14F','U13','U11','U9','U7','LOISIR','AUTRE'];
const GIRLS_IN_BOYS_COMP=['2026_1066_U15_11']; // équipes féminines engagées en compétition masculine (U15 D2 = filles)
const GIRLS_BY_LABEL=[/^U13 - U12 5$/i]; // ex. U14 F engagées en U13 garçons (équipe 5)
function teamGender(t){const st=S&&S.teamSettings&&S.teamSettings[t.id];if(st&&st.gender)return st.gender;const d=TEAM_DEFAULTS[t.id];if(d&&d.gender)return d.gender;if(GIRLS_IN_BOYS_COMP.includes(t.id))return 'F';if(GIRLS_BY_LABEL.some(re=>re.test(t.libelle||'')))return 'F';if(/F_\d+$/.test(t.id||'')||/ F\b/.test(t.lcLib||''))return 'F';if((t.comps||[]).some(c=>c.genre==='F'))return 'F';return 'H'}
const isSenior=t=>/_(SEM|SEF|FL)_/.test(t.id||'');
// Périmètre de la page : 'jeunes' = garçons U13→U18 (+ U7/U9/U11 FAL) ; 'global' = toute l'association
function inScope(t){if(MODE==='global')return true;return teamGender(t)==='H'&&!isSenior(t)}

// ---------- state ----------
let S=load();
function defaultState(){return {snapshot:{fetchedAt:FFF.fetchedAt,teams:FFF.teams,rows:FFF.rows},teamSettings:{},customTeams:MANUAL_DEFAULT_TEAMS.map(t=>({...t})),events:[],overrides:{},alerts:[],seen:{},filters:{ha:'all',type:'all',when:'upcoming',teams:null,gender:'all'},pitches:3,vans:4,newIds:{}};}
function load(){try{const raw=localStorage.getItem(LS_KEY);if(raw){const s=JSON.parse(raw);const d=defaultState();for(const k of Object.keys(d))if(s[k]===undefined)s[k]=d[k];
 const MIG={man_u11:'fal_U11',man_u9:'fal_U9',man_u7:'fal_U7'};s.customTeams=(s.customTeams||[]).filter(t=>!MIG[t.id]);for(const t of MANUAL_DEFAULT_TEAMS)if(!s.customTeams.some(x=>x.id===t.id))s.customTeams.push({...t});for(const e of s.events||[])if(MIG[e.teamId])e.teamId=MIG[e.teamId];if(s.filters&&s.filters.teams)s.filters.teams=s.filters.teams.map(x=>MIG[x]||x);
 // If the embedded data is newer than the stored snapshot, merge it as a sync
 if(FFF.fetchedAt&&(!s.snapshot.fetchedAt||FFF.fetchedAt>s.snapshot.fetchedAt)){const res=applySnapshot(s,{fetchedAt:FFF.fetchedAt,teams:FFF.teams,rows:FFF.rows},true);}
 return s;}}catch(e){console.warn('load',e)}return defaultState();}
function save(){try{localStorage.setItem(LS_KEY,JSON.stringify(S))}catch(e){console.warn('save',e)}}

// ---------- helpers ----------
const pad=n=>String(n).padStart(2,'0');
const DAYS=['dim','lun','mar','mer','jeu','ven','sam'], DAYS_L=['dimanche','lundi','mardi','mercredi','jeudi','vendredi','samedi'];
const MONTHS=['janv','févr','mars','avr','mai','juin','juil','août','sept','oct','nov','déc'];
function fmtDate(d,long){return (long?DAYS_L[d.getDay()]:DAYS[d.getDay()])+' '+d.getDate()+' '+MONTHS[d.getMonth()]}
function fmtTime(d){return d.getHours()+'h'+pad(d.getMinutes())}
function ymd(d){return d.getFullYear()+'-'+pad(d.getMonth()+1)+'-'+pad(d.getDate())}
const TZ='Europe/Paris';const _dtf=new Intl.DateTimeFormat('en-GB',{timeZone:TZ,year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',second:'2-digit',hour12:false});
function toWall(d){ // Date whose local getters equal the Paris wall clock (display everywhere in club time)
 const p={};for(const x of _dtf.formatToParts(d))p[x.type]=x.value;return new Date(+p.year,+p.month-1,+p.day,+p.hour%24,+p.minute,+p.second)}
function fromWall(w){ // Paris wall clock (as local Date) -> real instant
 const utcGuess=Date.UTC(w.getFullYear(),w.getMonth(),w.getDate(),w.getHours(),w.getMinutes(),w.getSeconds());let inst=new Date(utcGuess);for(let i=0;i<2;i++){const wall=toWall(inst);const wallUtc=Date.UTC(wall.getFullYear(),wall.getMonth(),wall.getDate(),wall.getHours(),wall.getMinutes(),wall.getSeconds());inst=new Date(inst.getTime()-(wallUtc-utcGuess))}return inst}
function nowWall(){return toWall(new Date())}
function parseLocal(iso){return toWall(new Date(iso))} // ISO with offset -> Paris wall-clock Date
function weekendKey(d){ // Monday of the ISO week -> key; weekend = Sat/Sun of that week (Fri evening included)
 const x=new Date(d.getFullYear(),d.getMonth(),d.getDate());const dow=(x.getDay()+6)%7; // Mon=0
 x.setDate(x.getDate()-dow);return ymd(x)}
function weekendDates(key){const mon=new Date(key+'T00:00:00');const sat=new Date(mon);sat.setDate(mon.getDate()+5);const sun=new Date(mon);sun.setDate(mon.getDate()+6);return {mon,sat,sun}}
function uid(){return 'ev_'+Date.now().toString(36)+Math.random().toString(36).slice(2,7)}
function esc(s){return String(s==null?'':s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}
function toast(msg){const t=$('#toast');t.textContent=msg;t.classList.add('on');clearTimeout(toast._t);toast._t=setTimeout(()=>t.classList.remove('on'),2600)}
function isPauFC(name){return /^PAU FC( \d)?$/i.test(name||'')}

// ---------- teams ----------
function allTeams(){
 const out=[];const seen=new Set();
for(const t of S.snapshot.teams){if(!inScope(t))continue;const d=TEAM_DEFAULTS[t.id]||guessDefaults(t);const st=S.teamSettings[t.id]||{};out.push({id:t.id,fff:true,gender:teamGender(t),libelleFFF:t.libelle,comps:t.comps,label:st.label||d.label,cat:st.cat||d.cat,format:+(st.format||d.format),vans:st.vans!=null?+st.vans:d.vans,order:d.order||99,hidden:!!st.hidden,color:st.color||CAT_COLORS[st.cat||d.cat]||CAT_COLORS.AUTRE});seen.add(t.id)}
 for(const t of S.customTeams){if(seen.has(t.id))continue;out.push({...t,fff:false,gender:(S.teamSettings[t.id]&&S.teamSettings[t.id].gender)||t.gender||'H',format:+t.format,vans:+t.vans,color:t.color||CAT_COLORS[t.cat]||CAT_COLORS.AUTRE,hidden:!!t.hidden})}
 out.sort((a,b)=>(a.order||99)-(b.order||99)||a.label.localeCompare(b.label));return out}
function guessDefaults(t){if(GIRLS_BY_LABEL.some(re=>re.test(t.libelle||'')))return {label:'U14 F (U13 garçons)',cat:'U14F',format:8,vans:1,order:52};const m=(t.lcLib||'').match(/U(\d+)( F)?/);let cat=m?('U'+m[1]+(m[2]?'F':'')):'AUTRE';if(!m&&/Senior F/i.test(t.lcLib||''))cat='SENF';else if(!m&&/Senior/i.test(t.lcLib||''))cat='SEN';else if(!m&&/Loisir/i.test(t.lcLib||''))cat='LOISIR';const n=(t.libelle||'').match(/(\d+)$/);return {label:(t.lcLib||t.libelle)+(n?' ('+n[1]+')':''),cat,format:cat.startsWith('U13')||cat.startsWith('U12')||cat.startsWith('U11')?8:11,vans:2,order:95}}
function teamById(id){return allTeams().find(t=>t.id===id)||(S.snapshot.teams.some(t=>t.id===id)?{id,fff:true}:null)}

// ---------- items (matches + events) ----------
function buildItems(){
 const teams=allTeams();const tmap=Object.fromEntries(teams.map(t=>[t.id,t]));const items=[];
 const cols=FFF.cols;const ix=Object.fromEntries(cols.map((c,i)=>[c,i]));
 for(const r of S.snapshot.rows){
  const team=tmap[r[ix.team]];if(!team)continue;
  const ov=S.overrides[r[ix.id]]||{};
  const homeSide=r[ix.home], dom=r[ix.dom], ext=r[ix.ext];
  const exempt=!dom||!ext;
  let date=parseLocal(ov.date||r[ix.date]);
  const heureOk=ov.date?true:!!r[ix.heureOk];
  const it={id:'m'+r[ix.id],mid:r[ix.id],kind:'match',team,teamId:team.id,home:homeSide,opponent:homeSide?ext:dom,comp:r[ix.cp],compType:r[ix.type],niveau:r[ix.niveau],poule:r[ix.poule],journee:r[ix.j],tour:r[ix.tour],date,heureOk,statut:r[ix.statut],stade:ov.stade||r[ix.stade],ville:r[ix.ville],surface:r[ix.surface],exempt,joue:!!(ix.joue!=null&&r[ix.joue]),bd:ix.bd!=null?r[ix.bd]:null,be:ix.be!=null?r[ix.be]:null,cancelled:!!ov.cancelled,note:ov.note||'',overridden:!!(ov.date||ov.stade),origDate:r[ix.date],isNew:!!S.newIds[r[ix.id]]};
  if(exempt){it.exempt=true}
  items.push(it)}
 const evs=S.events.concat(SHARED.filter(e=>!(S.hiddenShared||{})[e.id]&&!S.events.some(x=>x.id===e.id)).map(e=>({...e,shared:true})));
 for(const e of evs){const team=e.teamId?tmap[e.teamId]:null;const start=new Date(e.date+'T'+(e.time||'10:00')+':00');
  items.push({id:e.id,kind:'event',evType:e.type||'Tournoi',team:team||{id:'',label:e.teamLabel||'Club',cat:'AUTRE',color:CAT_COLORS.AUTRE,format:11,vans:1},teamId:e.teamId||'',home:e.home!==false,opponent:e.title,comp:e.type||'Événement',compType:'Événement',date:start,heureOk:!!e.time,stade:e.place||'',ville:'',durationMin:e.durationMin||(e.endTime?Math.max(30,(new Date(e.date+'T'+e.endTime+':00')-start)/6e4):180),pitches:e.pitches!=null?+e.pitches:null,vans:e.vans!=null?+e.vans:null,note:e.note||'',shared:!!e.shared,raw:e})}
 items.sort((a,b)=>a.date-b.date);return items}
function pitchNeed(it){if(it.kind==='event')return it.pitches!=null?it.pitches:(it.home?(FORMAT_PITCH[it.team.format]||1):0);return it.home?(FORMAT_PITCH[it.team.format]||1):0}
function vanNeed(it){if(it.kind==='event')return it.vans!=null?it.vans:(it.home?0:(it.team.vans||1));return it.home?0:(it.team.vans||1)}
function durationMin(it){return it.kind==='event'?it.durationMin:(FORMAT_MIN[it.team.format]||110)}

// ---------- filters ----------
function filterItems(items){
 const f=S.filters;const sel=f.teams; // null = all
 const now=nowWall();const todayStart=new Date(now.getFullYear(),now.getMonth(),now.getDate());const keepFrom=new Date(todayStart);keepFrom.setDate(keepFrom.getDate()-7); // « À venir » garde aussi le dernier week-end joué (résultats)
 return items.filter(it=>{
  if(it.exempt)return false;
  if(it.team.hidden)return false;
  if(sel&&!sel.includes(it.teamId))return false;
  if(f.gender&&f.gender!=='all'&&it.team.gender!==f.gender)return false;
  if(f.ha==='home'&&!it.home)return false;if(f.ha==='away'&&it.home)return false;
  if(f.type==='champ'&&!(it.kind==='match'&&/Championnat/i.test(it.compType)))return false;
  if(f.type==='coupe'&&!(it.kind==='match'&&/Coupe/i.test(it.compType)))return false;
  if(f.type==='event'&&it.kind!=='event')return false;
  if(f.when==='upcoming'){const wk=weekendKey(it.date);const {sun}=weekendDates(wk);if(sun<keepFrom)return false}
  return true})}

// ---------- weekend grouping & load ----------
function groupWeekends(items){
 const map=new Map();
 for(const it of items){const k=weekendKey(it.date);if(!map.has(k))map.set(k,{key:k,items:[],...weekendDates(k)});map.get(k).items.push(it)}
 // include empty weekends across the season for the strip
 const all=[];const d=new Date(SEASON_START);d.setDate(d.getDate()-((d.getDay()+6)%7));
 for(;d<SEASON_END;d.setDate(d.getDate()+7)){const k=ymd(d);const w=map.get(k)||{key:k,items:[],...weekendDates(k)};computeLoad(w);all.push(w)}
 return all}
function computeLoad(w){
 const home=w.items.filter(i=>i.home&&!i.cancelled), away=w.items.filter(i=>!i.home&&!i.cancelled);
 // peak simultaneous pitch need
 const ev=[];for(const it of home){const s=+it.date,e=s+durationMin(it)*6e4;ev.push([s,pitchNeed(it)],[e,-pitchNeed(it)])}
 ev.sort((a,b)=>a[0]-b[0]||a[1]-b[1]);let cur=0,peak=0,peakAt=null;for(const [t,v] of ev){cur+=v;if(cur>peak+1e-9){peak=cur;peakAt=t}}
 // vans per day (max over days)
 const byDay={};for(const it of away){const k=ymd(it.date);byDay[k]=(byDay[k]||0)+vanNeed(it)}
 const vansPeak=Math.max(0,...Object.values(byDay));const vansDay=Object.entries(byDay).sort();
 // conflicts: same pitch, overlapping time (matches only, both with stade)
 const conflicts=[];for(let i=0;i<home.length;i++)for(let j=i+1;j<home.length;j++){const a=home[i],b=home[j];if(a.kind!=='match'||b.kind!=='match'||!a.stade||!b.stade||a.stade!==b.stade)continue;if(!a.heureOk||!b.heureOk)continue;const as=+a.date,ae=as+durationMin(a)*6e4,bs=+b.date,be=bs+durationMin(b)*6e4;if(as<be&&bs<ae&&(a.team.format>8||b.team.format>8))conflicts.push([a,b])}
 const tbd=home.filter(i=>i.kind==='match'&&!i.stade).length;
 const total=w.items.filter(i=>!i.cancelled).length;
 let level=0;if(total>0)level=1;if(total>=3)level=2;if(total>=6)level=3;if(total>=9)level=4;
 Object.assign(w,{home,away,peak:Math.round(peak*100)/100,peakAt,vansPeak,vansDay,conflicts,tbd,total,level});return w}
const LEVEL_LBL=['rien','calme','normal','chargé','très chargé'];
function fmtPitch(n){if(Math.abs(n-Math.round(n))<.01)return String(Math.round(n));return n.toFixed(1).replace('.',',')}

// ---------- render ----------
let ITEMS=[],WEEKENDS=[],selectedWE=null;
function renderAll(){ITEMS=buildItems();const filtered=filterItems(ITEMS);WEEKENDS=groupWeekends(filtered);renderSidebar();renderStrip();renderWeekends();renderList(filtered);renderAlerts();renderSettings();updateSyncStatus();save()}

function renderSidebar(){
 const teams=allTeams();const sel=S.filters.teams;const host=$('#team-filters');host.innerHTML='';
 const cats={};for(const t of teams){(cats[t.cat]=cats[t.cat]||[]).push(t)}
 const order=[...CAT_ORDER,...Object.keys(cats).filter(c=>!CAT_ORDER.includes(c))];
 for(const c of order){if(!cats[c])continue;const box=document.createElement('div');box.className='cat';
  const allOn=cats[c].every(t=>!sel||sel.includes(t.id));
  box.innerHTML=`<div class="cat-h"><i class="dot" style="background:${CAT_COLORS[c]||CAT_COLORS.AUTRE}"></i><span style="flex:1">${esc(CAT_LABEL[c]||c)}</span><button class="link" style="font-size:11px;font-family:var(--font);text-transform:none;letter-spacing:0" data-cat="${esc(c)}">${allOn?'seule':'toutes'}</button></div>`;
  for(const t of cats[c]){const on=!sel||sel.includes(t.id);const row=document.createElement('label');row.className='team-row'+(on?'':' off');
   const n=ITEMS.filter(i=>i.teamId===t.id&&!i.exempt).length;
   row.innerHTML=`<input type="checkbox" ${on?'checked':''} data-team="${esc(t.id)}"><span class="lbl">${esc(t.label)}</span><span class="meta num">${n}${t.hidden?' · masquée':''}</span>`;box.appendChild(row)}
  host.appendChild(box)}
 host.onchange=e=>{const id=e.target.dataset.team;if(!id)return;const ids=allTeams().map(t=>t.id);let cur=S.filters.teams?[...S.filters.teams]:[...ids];if(e.target.checked){if(!cur.includes(id))cur.push(id)}else cur=cur.filter(x=>x!==id);S.filters.teams=cur.length===ids.length?null:cur;renderAll()};
 host.onclick=e=>{const c=e.target.dataset.cat;if(!c)return;e.preventDefault();const teams=allTeams();const catIds=teams.filter(t=>t.cat===c).map(t=>t.id);const sel=S.filters.teams;const allOn=catIds.every(id=>!sel||sel.includes(id));
  if(allOn&&(!sel||sel.length>catIds.length)){S.filters.teams=catIds}else if(allOn){S.filters.teams=null}else{const cur=sel?[...sel]:[];for(const id of catIds)if(!cur.includes(id))cur.push(id);S.filters.teams=cur.length===teams.length?null:cur}renderAll()};
 $$('#seg-ha button').forEach(b=>b.classList.toggle('on',b.dataset.v===S.filters.ha));
 $$('#seg-type button').forEach(b=>b.classList.toggle('on',b.dataset.v===S.filters.type));
 $$('#seg-when button').forEach(b=>b.classList.toggle('on',b.dataset.v===S.filters.when));
 $$('#seg-gender button').forEach(b=>b.classList.toggle('on',b.dataset.v===(S.filters.gender||'all')));
 $('#seg-gender').hidden=$('#seg-gender-gap').hidden=MODE!=='global';
 }

function renderKpis(filtered){
 const act=filtered.filter(i=>!i.cancelled);const home=act.filter(i=>i.home).length,away=act.length-home;
 const wes=WEEKENDS.filter(w=>S.filters.when==='all'||w.sun>=nowWall());
 const busy=wes.filter(w=>w.level>=3).length,free=wes.filter(w=>w.level===0).length;
 const tbd=act.filter(i=>i.kind==='match'&&(!i.heureOk||(i.home&&!i.stade))).length;
 $('#kpis').innerHTML=`
  <div class="kpi"><div class="v num">${act.length}</div><div class="l">rencontres ${S.filters.when==='upcoming'?'à venir':'sur la saison'}</div></div>
  <div class="kpi home"><div class="v num">${home}</div><div class="l">à domicile</div></div>
  <div class="kpi away"><div class="v num">${away}</div><div class="l">à l'extérieur</div></div>
  <div class="kpi warn"><div class="v num">${busy}</div><div class="l">week-ends chargés</div></div>
  <div class="kpi"><div class="v num">${free}</div><div class="l">week-ends sans rien</div></div>
  <div class="kpi"><div class="v num">${tbd}</div><div class="l">horaire / terrain à confirmer</div></div>`}

function renderStrip(){
 const host=$('#strip');host.innerHTML='';const todayK=weekendKey(nowWall());const NOW=nowWall();
 for(const w of WEEKENDS){const c=document.createElement('button');c.className='we-cell l'+w.level+(w.key===todayK?' today':'')+(w.sun<NOW&&w.key!==todayK?' past':'')+(selectedWE===w.key?' sel':'');
  c.title=`WE ${fmtDate(w.sat)}–${w.sun.getDate()} · ${w.home.length} à domicile · ${w.away.length} déplacement(s)`;
  c.innerHTML=`${w.sat.getDate()<=7?`<span class="m">${MONTHS[w.sat.getMonth()]}</span>`:''}<b class="num">${w.sat.getDate()}</b>`;
  c.onclick=()=>{selectedWE=w.key;renderStrip();const el=document.getElementById('we-'+w.key);if(el){el.scrollIntoView({behavior:'smooth',block:'start'});el.animate([{boxShadow:'0 0 0 3px var(--accent)'},{boxShadow:'none'}],{duration:1600})}else toast('Rien ce week-end pour la sélection')};
  host.appendChild(c)}
 // cale la bande sur ce que la liste affiche : dernier week-end passé à gauche, puis les suivants
 const cells=[...host.children];let i=cells.findIndex(c=>!c.classList.contains('past'));if(i<0)i=cells.length-1;const t=cells[Math.max(0,i-1)];
 if(t){const prev=host.style.scrollBehavior;host.style.scrollBehavior='auto';host.scrollLeft=Math.max(0,t.offsetLeft-host.offsetLeft-4);host.style.scrollBehavior=prev}
 if(window.__updStrip)setTimeout(window.__updStrip,50)}

function scoreHtml(it,cls){if(it.kind!=='match'||!it.joue||it.bd==null||it.be==null)return '';const us=it.home?it.bd:it.be,them=it.home?it.be:it.bd;const res=us>them?'win':us<them?'loss':'draw';return `<span class="score ${res}${cls?' '+cls:''}" title="Résultat (${it.home?'domicile':'extérieur'})"><span class="num">${it.bd}</span> – <span class="num">${it.be}</span></span>`}
function teamTag(t){return `<span class="tm" style="background:${t.color}">${esc(t.label)}</span>`}
function itemRow(it,showTeamAlways){
 const time=it.heureOk?fmtTime(it.date):'—';const day=DAYS[it.date.getDay()];
 let who,where;
 if(it.kind==='event'){who=`${teamTag(it.team)}${esc(it.opponent)} <span class="pill ev">${esc(it.evType||'Événement')}</span>`;where=[it.stade,it.note].filter(Boolean).map(esc).join(' · ')}
 else{const opp=esc(it.opponent);who=`${teamTag(it.team)}${it.home?`Pau FC <span class="muted">vs</span> ${opp}`:`${opp} <span class="muted">vs</span> Pau FC`}`;
  const compShort=esc(it.comp.replace(/COUPE GAMBARDELLA CRÉDIT AGRICOLE/i,'Gambardella').replace(/MATCHES AMICAUX \/ U19 DISTRICT/i,'Amical'))+(it.journee&&/Championnat/i.test(it.compType)?` · J${esc(it.journee)}`:it.tour?` · ${esc(it.tour)}`:'');
  where=`${compShort}${it.stade?` · ${esc(it.stade)}${it.ville&&!it.home?` (${esc(it.ville.replace(/^\d{5}\s*/,''))})`:''}`:it.home?' · <b>terrain à définir</b>':''}${it.note?` · ${esc(it.note)}`:''}`}
 const flags=[];if(it.cancelled)flags.push('<span class="flag crit">annulé</span>');if(!it.heureOk&&!it.cancelled)flags.push('<span class="flag">heure à confirmer</span>');if(it.overridden)flags.push('<span class="flag">ajusté</span>');if(it.isNew)flags.push('<span class="flag new">nouveau</span>');if(it.shared)flags.push(`<span class="flag" style="background:var(--ev-bg);color:var(--ev-ink)" title="Événement partagé à tout le club">club${it.raw&&it.raw.author?' · '+esc(it.raw.author):''}</span>`);
 const acts=it.kind==='event'&&it.shared?`<button class="icon-btn" data-act="hide-ev" data-id="${esc(it.id)}" title="Événement partagé à tout le club — masquer pour moi">👁</button>`:it.kind==='event'?`<button class="icon-btn" data-act="edit-ev" data-id="${esc(it.id)}" title="Modifier">✎</button><button class="icon-btn" data-act="del-ev" data-id="${esc(it.id)}" title="Supprimer">🗑</button>`:`<button class="icon-btn" data-act="adjust" data-id="${esc(it.id)}" title="Ajuster (report, terrain, annulation)">✎</button>`;
 return `<div class="m-row${it.kind==='event'?' ev':''}${it.cancelled?' cancel':''}" data-id="${esc(it.id)}"><div class="t num">${time}<small>${day}${it.date.getDay()!==6&&it.date.getDay()!==0?' '+it.date.getDate():''}</small></div><div><div class="who">${who}${flags.join('')}</div><div class="where">${where}</div></div><div style="display:flex;align-items:center;gap:6px">${scoreHtml(it)}<div class="acts no-print">${acts}</div></div></div>`}

function renderWeekends(){
 const host=$('#we-list');host.innerHTML='';const now=nowWall();
 const keepFrom=new Date(now.getFullYear(),now.getMonth(),now.getDate());keepFrom.setDate(keepFrom.getDate()-7);
 const list=WEEKENDS.filter(w=>w.items.length&&(S.filters.when==='all'||w.sun>=keepFrom));
 if(!list.length){host.innerHTML='<div class="panel"><div class="bd empty">Aucune rencontre pour cette sélection.</div></div>';return}
 for(const w of list){
  const past=w.sun<now;const sec=document.createElement('section');sec.className='we'+(past?' past':'');sec.id='we-'+w.key;
  const midweek=w.items.some(i=>i.date.getDay()>=1&&i.date.getDay()<=4);
  const needs=[];
  needs.push(`<span class="need home"><b class="num">${w.home.length}</b> à domicile</span>`);
  needs.push(`<span class="need away"><b class="num">${w.away.length}</b> déplacement${w.away.length>1?'s':''}</span>`);
  sec.innerHTML=`<div class="we-hd"><div class="we-date"><span>WE ${fmtDate(w.sat)} – ${w.sun.getDate()}</span>${midweek?'<small>+ semaine</small>':''}</div><div></div><div class="needs">${needs.join('')}</div></div>
   <div class="we-bd"><div class="col"><div class="col-h"><i class="home"></i>Domicile <span class="num muted">${w.home.length}</span></div>${w.home.length?w.home.concat(w.items.filter(i=>i.home&&i.cancelled)).map(i=>itemRow(i)).join(''):'<div class="empty">Personne à domicile</div>'}</div>
   <div class="col"><div class="col-h"><i class="away"></i>Extérieur <span class="num muted">${w.away.length}</span></div>${w.away.length?w.away.concat(w.items.filter(i=>!i.home&&i.cancelled)).map(i=>itemRow(i)).join(''):'<div class="empty">Aucun déplacement</div>'}</div></div>
`;
  host.appendChild(sec)}
 host.onclick=e=>{const b=e.target.closest('[data-act]');if(!b)return;const it=ITEMS.find(i=>i.id===b.dataset.id);if(!it)return;if(b.dataset.act==='hide-ev'){S.hiddenShared=S.hiddenShared||{};S.hiddenShared[it.id]=1;renderAll();toast('Masqué pour vous uniquement');return}if(b.dataset.act==='edit-ev')openEventModal(it.raw);else if(b.dataset.act==='del-ev'){if(confirm('Supprimer cet événement ?')){S.events=S.events.filter(x=>x.id!==it.id);renderAll();toast('Événement supprimé')}}else if(b.dataset.act==='adjust')openAdjustModal(it)};
 $('#print-meta').textContent=`Édité le ${fmtDate(nowWall(),true)} · ${S.filters.ha==='home'?'domicile uniquement':S.filters.ha==='away'?'extérieur uniquement':'domicile + extérieur'} · ${S.filters.teams?S.filters.teams.length+' équipe(s) sélectionnée(s)':'toutes les équipes'} · source FFF du ${S.snapshot.fetchedAt?S.snapshot.fetchedAt.slice(0,10):'—'}`}

function renderList(filtered){
 const t=$('#list-table');const rows=filtered.filter(i=>!i.exempt);
 t.innerHTML=`<thead><tr><th>Date</th><th>Heure</th><th>Équipe</th><th></th><th>Rencontre</th><th>Compétition</th><th>Lieu</th><th>Score</th></tr></thead><tbody>${rows.map(i=>`<tr${i.cancelled?' style="opacity:.5"':''}><td class="num" style="white-space:nowrap">${fmtDate(i.date)}</td><td class="num">${i.heureOk?fmtTime(i.date):'<span class="muted">à conf.</span>'}</td><td><span class="tm" style="background:${i.team.color}">${esc(i.team.label)}</span></td><td><span class="pill ${i.kind==='event'?'ev':i.home?'home':'away'}">${i.kind==='event'?esc(i.evType||'Évén.'):i.home?'DOM':'EXT'}</span></td><td>${i.kind==='event'?esc(i.opponent):esc(i.opponent)}${i.cancelled?' <span class="flag crit">annulé</span>':''}</td><td class="muted">${esc(i.comp)}${i.journee&&/Championnat/i.test(i.compType)?' · J'+esc(i.journee):''}</td><td class="muted">${esc(i.stade||(i.home?'à définir':''))}${i.ville&&!i.home?', '+esc(i.ville.replace(/^\d{5}\s*/,'')):''}</td><td>${scoreHtml(i)}</td></tr>`).join('')}</tbody>`;
 if(!rows.length)t.innerHTML='<tbody><tr><td class="empty">Aucune rencontre pour cette sélection.</td></tr></tbody>'}

function renderAlerts(){
 const unread=S.alerts.filter(a=>!a.read).length;for(const id of ['#alert-count','#alert-count-2']){const el=$(id);el.textContent=unread;el.hidden=!unread}
 const host=$('#alerts-list');
 const html=[];
 for(const a of [...S.alerts].reverse())html.push(`<div class="alert${a.read?' read':''}"><div class="ic ${a.type}">${a.type==='date'?'↻':a.type==='new'?'+':a.type==='conflict'?'!':'i'}</div><div class="txt">${a.text}<div class="when">${new Date(a.ts).toLocaleString('fr-FR')}</div></div><div>${a.read?'':`<button class="btn small" data-ack="${esc(a.id)}">Lu</button>`}</div></div>`);
 host.innerHTML=html.join('')||'<div class="bd empty">Aucune alerte pour l\'instant. À chaque mise à jour FFF, les dates, horaires ou terrains modifiés s\'affichent ici.</div>';
 host.onclick=e=>{const id=e.target.dataset.ack;if(!id)return;const a=S.alerts.find(x=>x.id===id);if(a){a.read=true;renderAll()}}}

function renderSettings(){
 const host=$('#team-settings');host.innerHTML='';
 const outOfScope=MODE==='jeunes'?S.snapshot.teams.filter(t=>!inScope(t)&&!isSenior(t)).map(t=>({id:t.id,fff:true,libelleFFF:t.libelle,comps:t.comps,label:(S.teamSettings[t.id]||{}).label||(TEAM_DEFAULTS[t.id]||guessDefaults(t)).label,gender:teamGender(t),format:11,color:'#9AA3B8',hidden:true,outOfScope:true})):[];
 for(const t of allTeams().concat(outOfScope)){const row=document.createElement('div');row.className='set-team';
  row.innerHTML=`<i class="sw" style="background:${t.color}"></i><div><input value="${esc(t.label)}" data-f="label" data-id="${esc(t.id)}" aria-label="Libellé"><div class="help" style="font-size:11px">${t.outOfScope?'Équipe féminine — hors périmètre de cette page (modifiez le genre pour la réintégrer)':t.fff?'FFF · '+esc(t.libelleFFF)+' · '+esc((t.comps||[]).map(c=>c.nom).join(', ')):t.fal?'District · Foot Animation (FAL) — plateaux publiés par le district en cours de saison':'ajoutée manuellement'}</div></div>
   <select data-f="format" data-id="${esc(t.id)}" class="hide-s" aria-label="Format">${[11,8,5,4,3].map(f=>`<option value="${f}"${t.format===f?' selected':''}>à ${f}</option>`).join('')}</select>
   <select data-f="gender" data-id="${esc(t.id)}" class="hide-s" aria-label="Genre"><option value="H"${t.gender==='H'?' selected':''}>Hommes</option><option value="F"${t.gender==='F'?' selected':''}>Féminines</option></select>
   <div style="display:flex;gap:4px">${t.outOfScope?'':`<button class="btn small" data-toggle="${esc(t.id)}">${t.hidden?'Afficher':'Masquer'}</button>`}${t.fff||t.fal?'':`<button class="btn small danger" data-del="${esc(t.id)}">✕</button>`}</div>`;host.appendChild(row)}
 host.onchange=e=>{const f=e.target.dataset.f,id=e.target.dataset.id;if(!f)return;const t=teamById(id);const v=(f==='label'||f==='gender')?e.target.value.trim():+e.target.value;if(t.fff||f==='gender'){S.teamSettings[id]=S.teamSettings[id]||{};S.teamSettings[id][f]=v}else{const c=S.customTeams.find(x=>x.id===id);if(c)c[f]=v}renderAll()};
 host.onclick=e=>{const tg=e.target.dataset.toggle,del=e.target.dataset.del;if(tg){const t=teamById(tg);if(t.fff){S.teamSettings[tg]=S.teamSettings[tg]||{};S.teamSettings[tg].hidden=!t.hidden}else{const c=S.customTeams.find(x=>x.id===tg);c.hidden=!c.hidden}renderAll()}
  if(del){if(confirm('Supprimer cette équipe et ses événements ?')){S.customTeams=S.customTeams.filter(x=>x.id!==del);S.events=S.events.filter(ev=>ev.teamId!==del);if(S.filters.teams)S.filters.teams=S.filters.teams.filter(x=>x!==del);renderAll()}}}}

function updateSyncStatus(){const d=S.snapshot.fetchedAt?new Date(S.snapshot.fetchedAt):null;const txt=d?`Données FFF du ${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`:'Données FFF : —';$('#sync-status span').textContent=txt;$('#sync-date').textContent=d?d.toLocaleString('fr-FR'):'—';
 const age=d?(Date.now()-d)/864e5:99;$('#sync-status i').style.background=age<10?'var(--ok)':age<25?'var(--warn)':'var(--crit)'}

// ---------- modal ----------
function openModal(title,bodyHtml,buttons){$('#modal-title').textContent=title;$('#modal-body').innerHTML=bodyHtml;const ft=$('#modal-foot');ft.innerHTML='';for(const b of buttons){const el=document.createElement('button');el.className='btn '+(b.cls||'');el.textContent=b.label;el.onclick=()=>{const r=b.onClick&&b.onClick();if(r!==false)closeModal()};ft.appendChild(el)}$('#modal').classList.add('on');const f=$('#modal-body input,#modal-body select,#modal-body textarea');if(f)setTimeout(()=>f.focus(),50)}
function closeModal(){$('#modal').classList.remove('on')}
$('#modal-close').onclick=closeModal;$('#modal').addEventListener('click',e=>{if(e.target.id==='modal')closeModal()});
document.addEventListener('keydown',e=>{if(e.key==='Escape')closeModal()});

function openEventModal(ev){
 const isNew=!ev;ev=ev||{id:uid(),title:'',type:'Tournoi',date:ymd(nowWall()),time:'10:00',endTime:'',home:true,teamId:'',place:'',pitches:'',vans:'',note:''};
 const teams=allTeams();
 openModal(isNew?'Ajouter un événement':'Modifier l\'événement',`<div class="form">
  <label class="full">Intitulé<input id="e-title" value="${esc(ev.title)}" placeholder="Tournoi de Lons, plateau U9, stage…"></label>
  <label>Type<select id="e-type">${['Tournoi','Plateau','Match amical','Stage','Détection','Autre'].map(t=>`<option${ev.type===t?' selected':''}>${t}</option>`).join('')}</select></label>
  <label>Équipe / catégorie<select id="e-team"><option value="">Tout le club / autre</option>${teams.map(t=>`<option value="${esc(t.id)}"${ev.teamId===t.id?' selected':''}>${esc(t.label)}</option>`).join('')}</select></label>
  <label>Date<input type="date" id="e-date" value="${esc(ev.date)}"></label>
  <label>Heure début<input type="time" id="e-time" value="${esc(ev.time||'')}"></label>
  <label>Heure fin<input type="time" id="e-end" value="${esc(ev.endTime||'')}"></label>
  <label>Lieu<div class="seg full" id="e-ha"><button type="button" data-v="1" class="${ev.home!==false?'on':''}">À domicile</button><button type="button" data-v="0" class="${ev.home===false?'on':''}">À l'extérieur</button></div></label>
  <label class="full">Adresse / stade<input id="e-place" value="${esc(ev.place||'')}" placeholder="Stade du Hameau Idron 2, ou ville pour un déplacement"></label>
  <label class="full">Note<textarea id="e-note">${esc(ev.note||'')}</textarea></label>
  ${EVENTS_API&&isNew?`<label>Votre nom <span class="muted">(obligatoire pour publier au club)</span><input id="e-author" value="${esc((S.me&&S.me.name)||'')}" placeholder="Prénom Nom"></label><label>Votre e-mail <span class="muted">(facultatif)</span><input id="e-email" type="email" value="${esc((S.me&&S.me.email)||'')}"></label>`:''}</div>`,
  [{label:'Annuler'},...(isNew?[{label:EVENTS_API?'Publier pour tout le club':'✉ Enregistrer et proposer au club',cls:EVENTS_API?'primary':'',onClick:()=>{if(EVENTS_API){const author=($('#e-author').value||'').trim();if(!author){toast('Indiquez votre nom pour publier au club');return false}const obj=saveEventFromModal(ev,isNew,true);if(obj===false)return false;S.me={name:author,email:($('#e-email').value||'').trim()};publishSharedEvent(obj,S.me);return true}const ok=saveEventFromModal(ev,isNew);if(ok===false)return false;shareEventByMail(ok);return true}}]:[]),{label:isNew?(EVENTS_API?'Ajouter pour moi seulement':'Ajouter (pour moi)'):'Enregistrer',cls:EVENTS_API&&isNew?'':'primary',onClick:()=>{return saveEventFromModal(ev,isNew)===false?false:true}}]);
 $('#e-ha').onclick=e=>{const b=e.target.closest('button');if(!b)return;$$('#e-ha button').forEach(x=>x.classList.toggle('on',x===b))}}
function saveEventFromModal(ev,isNew,noLocal){const teams=allTeams();const title=$('#e-title').value.trim();const date=$('#e-date').value;if(!title||!date){toast('Intitulé et date sont obligatoires');return false}
   const home=$('#e-ha .on').dataset.v==='1';const team=teams.find(t=>t.id===$('#e-team').value);
   const obj={id:ev.id,title,type:$('#e-type').value,teamId:$('#e-team').value,teamLabel:team?team.label:'Club',date,time:$('#e-time').value,endTime:$('#e-end').value,home,place:$('#e-place').value.trim(),pitches:null,vans:null,note:$('#e-note').value.trim()};
   if(noLocal)return obj;const i=S.events.findIndex(x=>x.id===ev.id);if(i>=0)S.events[i]=obj;else S.events.push(obj);renderAll();toast(isNew?'Événement ajouté':'Événement modifié');return obj}
function publishSharedEvent(obj,me){const team=allTeams().find(t=>t.id===obj.teamId);const payload={...obj,author:me.name,email:me.email||'',teamLabel:team?team.label:'Tout le club'};SHARED=SHARED.concat([{...obj,author:me.name,shared:true}]);renderAll();toast('Publié pour tout le club — merci '+me.name);fetch(EVENTS_API,{method:'POST',mode:'no-cors',headers:{'Content-Type':'text/plain;charset=utf-8'},body:JSON.stringify(payload)}).then(()=>setTimeout(loadSharedEvents,2500)).catch(()=>toast('Publication impossible pour le moment (hors connexion ?) : réessayez plus tard'))}
function shareEventByMail(obj){const team=allTeams().find(t=>t.id===obj.teamId);const lines=[`Bonjour, merci d'ajouter cet événement au calendrier ${MODE==='global'?'du Club':'Jeunes'} du Pau FC pour tout le monde :`,'',`• ${obj.title} (${obj.type})`,`• ${team?team.label:'Tout le club'} — ${obj.date}${obj.time?' à '+obj.time:''}${obj.endTime?' → '+obj.endTime:''}`,`• ${obj.home?'À domicile':'À l\'extérieur'}${obj.place?' — '+obj.place:''}`,obj.note?`• Note : ${obj.note}`:'','','--- données (ne pas modifier) ---','PAUFC-EVENT '+JSON.stringify(obj),'--- fin ---'].filter(x=>x!==undefined).join('\n');const url='mailto:'+CLUB_MAIL+'?subject='+encodeURIComponent('[Calendrier Pau FC] '+obj.title+' — '+obj.date)+'&body='+encodeURIComponent(lines);const a=document.createElement('a');a.href=url;a.target='_blank';a.rel='noopener';document.body.appendChild(a);a.click();setTimeout(()=>a.remove(),1000);toast('Message préparé : envoyez-le, il sera intégré pour tous à la prochaine mise à jour')}

function openAdjustModal(it){
 const ov=S.overrides[it.mid]||{};const d=it.date;
 openModal('Ajuster la rencontre',`<p><b>${esc(it.team.label)}</b> · ${it.home?'Pau FC vs '+esc(it.opponent):esc(it.opponent)+' vs Pau FC'} · ${esc(it.comp)}<br><span class="help">Date officielle FFF : ${fmtDate(parseLocal(it.origDate),true)} ${fmtTime(parseLocal(it.origDate))}. Un ajustement local sert à anticiper un report convenu entre clubs ; il sera signalé si la FFF publie une autre date.</span></p>
  <div class="form"><label>Nouvelle date<input type="date" id="a-date" value="${ymd(d)}"></label><label>Heure<input type="time" id="a-time" value="${pad(d.getHours())}:${pad(d.getMinutes())}"></label>
  <label class="full">Terrain (domicile)<input id="a-stade" value="${esc(it.stade||'')}" list="stades"><datalist id="stades"><option>STADE DU HAMEAU IDRON 2</option><option>STADE DU HAMEAU IDRON 4</option><option>NOUSTE CAMP SYNTHETIQUE N°2</option></datalist></label>
  <label class="full">Note<input id="a-note" value="${esc(ov.note||'')}" placeholder="Report accordé par la ligue, terrain indisponible…"></label>
  <label class="full row"><input type="checkbox" id="a-cancel" ${ov.cancelled?'checked':''} style="width:auto"> Rencontre annulée / forfait</label></div>`,
  [{label:'Revenir aux données FFF',onClick:()=>{delete S.overrides[it.mid];renderAll();toast('Ajustement supprimé')}},{label:'Annuler'},{label:'Enregistrer',cls:'primary',onClick:()=>{const date=$('#a-date').value,time=$('#a-time').value||'00:00';const nd=new Date(date+'T'+time+':00');const o={};
   if(Math.abs(nd-parseLocal(it.origDate))>6e4)o.date=fromWall(nd).toISOString();const st=$('#a-stade').value.trim();if(st&&st!==(it.stade||''))o.stade=st;else if(!st&&it.stade)o.stade='';const note=$('#a-note').value.trim();if(note)o.note=note;if($('#a-cancel').checked)o.cancelled=true;
   if(Object.keys(o).length)S.overrides[it.mid]=o;else delete S.overrides[it.mid];renderAll();toast('Rencontre ajustée')}}])}

function openTeamModal(){openModal('Ajouter une équipe / catégorie',`<div class="form"><label>Libellé<input id="t-label" placeholder="U11 (éq. 2), U9 A…"></label><label>Catégorie<select id="t-cat">${CAT_ORDER.map(c=>`<option value="${c}">${CAT_LABEL[c]||c}</option>`).join('')}</select></label><label>Format<select id="t-format"><option value="11">Foot à 11</option><option value="8">Foot à 8</option><option value="5">Foot à 5</option><option value="4">Foot à 4</option><option value="3">Foot à 3</option></select></label><div class="full help">Ses rencontres (plateaux, tournois, amicaux) s'ajoutent ensuite via « + Événement ».</div></div>`,
 [{label:'Annuler'},{label:'Ajouter',cls:'primary',onClick:()=>{const label=$('#t-label').value.trim();if(!label){toast('Indiquez un libellé');return false}const cat=$('#t-cat').value;S.customTeams.push({id:'man_'+Date.now().toString(36),label,cat,format:+$('#t-format').value,vans:1,order:(CAT_ORDER.indexOf(cat)+1)*10+5,manual:true});renderAll();toast('Équipe ajoutée')}}]);
 $('#t-cat').onchange=e=>{const c=e.target.value;$('#t-format').value=['U7'].includes(c)?4:['U9'].includes(c)?5:['U11','U13'].includes(c)?8:11}}

// ---------- sync (bookmarklet data) ----------
function applySnapshot(state,snap,silent){
 const cols=FFF.cols;const ix=Object.fromEntries(cols.map((c,i)=>[c,i]));
 const old=new Map(state.snapshot.rows.map(r=>[r[ix.id],r]));const now=Date.now();const alerts=[];const newIds={};
 const tmap=Object.fromEntries(snap.teams.map(t=>[t.id,t]));
 const lbl=id=>{const t=(state.teamSettings[id]||{}).label||(TEAM_DEFAULTS[id]||{}).label||(tmap[id]||{}).libelle||id;return t};
 const desc=r=>{const home=r[ix.home];const opp=home?r[ix.ext]:r[ix.dom];return `${lbl(r[ix.team])} ${home?'vs':'chez'} ${opp||'exempt'} (${r[ix.cp]}${r[ix.j]?' J'+r[ix.j]:''})`};
 const fd=iso=>{const d=toWall(new Date(iso));return fmtDate(d)+(d.getHours()||d.getMinutes()?' '+fmtTime(d):'')};
 const oldTmap=Object.fromEntries(state.snapshot.teams.map(t=>[t.id,t]));
 for(const r of snap.rows){if(!inScope(tmap[r[ix.team]]||{id:r[ix.team]})){old.delete(r[ix.id]);continue}const o=old.get(r[ix.id]);
  if(!o){if(r[ix.dom]&&r[ix.ext]){alerts.push({type:'new',text:`<b>Nouvelle rencontre</b> : ${esc(desc(r))} le ${fd(r[ix.date])}.`});newIds[r[ix.id]]=1}continue}
  const oD=toWall(new Date(o[ix.date])),nD=toWall(new Date(r[ix.date]));
  if(+oD!==+nD){const sameDay=ymd(oD)===ymd(nD);alerts.push({type:'date',text:`<b>${sameDay?'Horaire modifié':'Date modifiée'}</b> : ${esc(desc(r))} — ${fd(o[ix.date])} → <b>${fd(r[ix.date])}</b>.`})}
  else if(o[ix.heureOk]!==r[ix.heureOk]&&r[ix.heureOk])alerts.push({type:'info',text:`<b>Horaire confirmé</b> : ${esc(desc(r))} le ${fd(r[ix.date])}.`});
  if((o[ix.stade]||'')!==(r[ix.stade]||'')&&r[ix.stade])alerts.push({type:'info',text:`<b>Terrain modifié</b> : ${esc(desc(r))} — ${esc(o[ix.stade]||'non défini')} → <b>${esc(r[ix.stade])}</b>.`});
  if((o[ix.dom]||'')!==(r[ix.dom]||'')||(o[ix.ext]||'')!==(r[ix.ext]||''))alerts.push({type:'info',text:`<b>Affiche modifiée</b> : ${esc(desc(r))} le ${fd(r[ix.date])}.`});
  if(ix.joue!=null&&!o[ix.joue]&&r[ix.joue]&&r[ix.bd]!=null)alerts.push({type:'info',text:`<b>Résultat</b> : ${esc(desc(r))} — ${r[ix.bd]} - ${r[ix.be]}.`});
  if(o[ix.statut]!==r[ix.statut]&&/report|annul|forfait/i.test(r[ix.statut]||''))alerts.push({type:'date',text:`<b>Statut « ${esc(r[ix.statut])} »</b> : ${esc(desc(r))} (${fd(r[ix.date])}).`});
  // override drift: FFF now differs from a local adjustment
  const ov=state.overrides[r[ix.id]];if(ov&&ov.date&&Math.abs(new Date(ov.date)-nD)>6e4&&+oD!==+nD)alerts.push({type:'date',text:`<b>La FFF a publié une date</b> pour une rencontre que vous aviez ajustée : ${esc(desc(r))} → ${fd(r[ix.date])}. Vérifiez l'ajustement.`});
  old.delete(r[ix.id])}
 for(const [id,o] of old){if(!inScope(oldTmap[o[ix.team]]||{id:o[ix.team]}))continue;if(o[ix.dom]&&o[ix.ext])alerts.push({type:'date',text:`<b>Rencontre retirée du calendrier</b> : ${esc(desc(o))} (${fd(o[ix.date])}).`})}
 const newTeams=snap.teams.filter(t=>inScope(t)&&!state.snapshot.teams.some(x=>x.id===t.id));for(const t of newTeams)alerts.push({type:'new',text:`<b>Nouvelle équipe engagée</b> : ${esc(t.libelle)} (${esc((t.comps||[]).map(c=>c.nom).join(', '))}).`});
 for(const a of alerts)state.alerts.push({id:uid(),ts:now,read:false,...a});
 if(state.alerts.length>300)state.alerts=state.alerts.slice(-300);
 state.snapshot={fetchedAt:snap.fetchedAt||new Date().toISOString(),teams:snap.teams,rows:snap.rows};
 state.newIds=Object.keys(newIds).length?newIds:{};
 return {changes:alerts.length,rows:snap.rows.length,teams:snap.teams.length}}
function parseSyncPayload(txt){let j;try{j=JSON.parse(txt)}catch(e){throw new Error('Le texte collé n\'est pas un JSON valide.')}if(j&&j.snapshot&&j.filters)throw new Error('Ceci est une sauvegarde complète : utilisez « Importer une sauvegarde » dans Équipes & réglages.');if(!j||!Array.isArray(j.rows)||!Array.isArray(j.teams))throw new Error('Format inattendu : utilisez le favori Synchro Pau FC sur epreuves.fff.fr.');return j}
function doSync(txt){try{const snap=parseSyncPayload(txt);const res=applySnapshot(S,snap,false);renderAll();$('#sync-result').innerHTML=`✔ ${res.teams} équipes, ${res.rows} rencontres importées · <b>${res.changes} changement${res.changes>1?'s':''}</b> détecté${res.changes>1?'s':''}${res.changes?' → voir l\'onglet Alertes':''}.`;$('#sync-paste').value='';toast(res.changes?res.changes+' changement(s) détecté(s)':'Calendrier à jour, aucun changement')}catch(e){$('#sync-result').innerHTML='✖ '+esc(e.message)}}

const BOOKMARKLET_SRC=`(async()=>{const S=2026,C='1066';let tok=null;try{const ng=document.getElementById('ng-state');if(ng)tok=JSON.parse(ng.textContent).VLJAXE}catch(e){}if(!tok){try{tok=(await(await fetch('/api/app-security-token/QpUOBjjSJN')).json()).token}catch(e){}}if(!tok){alert('Impossible de lire le jeton FFF. Rechargez la page epreuves.fff.fr et recliquez.');return}const H=async()=>{const i=Math.floor(Date.now()/1e4);const d=await crypto.subtle.digest('SHA-1',new TextEncoder().encode(tok+'-'+i));return Array.from(new Uint8Array(d)).map(r=>r.toString(16).padStart(2,'0')).join('')};const G=async u=>(await fetch(u,{headers:{Accept:'application/ld+json','X-Competition':await H()}})).json();const g=(o,p)=>p.split('.').reduce((a,k)=>a==null?a:a[k],o);let ids=[...new Set([...document.querySelectorAll('a[href*="/equipe/'+S+'_'+C+'_"]')].map(a=>(a.getAttribute('href')||'').match(/equipe\\/(\\d+_\\d+_[A-Z0-9]+_\\d+)/)).filter(Boolean).map(m=>m[1]))].filter(Boolean);if(!ids.length){alert('Ouvrez la page Équipes du Pau FC sur epreuves.fff.fr, puis recliquez sur le favori.');return}const B=document.createElement('div');B.style.cssText='position:fixed;top:12px;right:12px;z-index:99999;background:#0E2A5C;color:#fff;padding:12px 16px;border-radius:10px;font:14px system-ui;box-shadow:0 8px 30px rgba(0,0,0,.4);max-width:320px';B.textContent='Synchro Pau FC : récupération…';document.body.appendChild(B);const out={fetchedAt:new Date().toISOString(),cols:['id','team','cpNo','cp','type','niveau','poule','j','tour','date','heureOk','statut','home','dom','ext','stade','ville','surface','bd','be','joue'],teams:[],rows:[]};let n=0;for(const id of ids){B.textContent='Synchro Pau FC : '+(++n)+'/'+ids.length+' équipes…';try{const info=await G('/api/data/equipes/'+id+'/info');out.teams.push({id,libelle:info.libelle,lcLib:info.lcLib,comps:(info.engagements||[]).map(e=>({cp:g(e,'competition.donneesFormatees.cpNo'),nom:g(e,'competition.donneesFormatees.nom'),type:g(e,'competition.donneesFormatees.type'),niveau:g(e,'competition.donneesFormatees.niveau'),genre:g(e,'competition.donneesFormatees.genre')}))});const m=await G('/api/data/matches?idEquipe='+id+'&dateDebut='+S+'-08-01T00:00:00%2B00:00&dateFin='+(S+1)+'-07-01T00:00:00%2B00:00&itemsPerPage=200&pagination=true');const ms=m['hydra:member']||[];for(let k=0;k<ms.length;k+=6){await Promise.all(ms.slice(k,k+6).map(async x=>{const d=x.donneesFormatees;let st=null,vi=null,su=null;try{const dt=await G('/api/data/matches/'+d.maNo);const s=dt.donneesFormatees.stade;if(s){st=s.nom;vi=(s.adresse||[]).slice(-1)[0]||null;su=s.surface}}catch(e){}out.rows.push([d.maNo,id,g(d,'competition.donneesFormatees.cpNo'),g(d,'competition.donneesFormatees.nom'),g(d,'competition.donneesFormatees.type'),g(d,'competition.donneesFormatees.niveau'),g(d,'groupe.nom'),g(d,'journee.pjNo'),g(d,'journee.tourNom'),d.date,d.heureCommuniquee,d.maStatutLib,g(d,'recevant.club.clNo')===C,g(d,'recevant.club.nomAbr'),g(d,'visiteur.club.nomAbr'),st,vi,su,d.joue?g(d,'recevant.buts'):null,d.joue?g(d,'visiteur.buts'):null,!!d.joue])}))}}catch(e){console.error(e)}}out.rows.sort((a,b)=>a[1].localeCompare(b[1])||a[9].localeCompare(b[9]));const txt=JSON.stringify(out);let ok=false;try{await navigator.clipboard.writeText(txt);ok=true}catch(e){}if(!ok){const ta=document.createElement('textarea');ta.value=txt;ta.style.cssText='position:fixed;left:10px;top:60px;width:300px;height:200px;z-index:99999';document.body.appendChild(ta);ta.select();try{ok=document.execCommand('copy')}catch(e){}if(ok)ta.remove()}B.innerHTML='<b>Synchro Pau FC terminée</b><br>'+out.teams.length+' équipes, '+out.rows.length+' rencontres.<br>'+(ok?'Données copiées : retournez dans le Calendrier Jeunes et collez-les dans « Mise à jour FFF ».':'Copiez le texte de la zone ci-dessous puis collez-le dans le Calendrier Jeunes.');setTimeout(()=>B.remove(),20000)})();`;
function setupBookmarklet(){const href='javascript:'+encodeURIComponent(BOOKMARKLET_SRC);$('#bm-code').textContent=href;$('#b-copy-bm').onclick=()=>{const done=()=>toast('Code copié — créez le favori et collez-le comme adresse');if(navigator.clipboard&&navigator.clipboard.writeText){navigator.clipboard.writeText(href).then(done,()=>{const d=$('#bm-code').parentElement;d.open=true;toast('Copie automatique impossible : sélectionnez le code ci-dessous')})}else{const d=$('#bm-code').parentElement;d.open=true}}}

// ---------- export ----------
let downloadsCap=null;
function download(filename,data,mime){
 if(downloadsCap){downloadsCap.save({filename,data}).then(()=>toast('Fichier enregistré')).catch(err=>{if(err&&err.code==='declined')return;fallbackDownload(filename,data,mime)});return}
 fallbackDownload(filename,data,mime)}
function fallbackDownload(filename,data,mime){try{const blob=new Blob([data],{type:mime||'text/plain'});const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download=filename;document.body.appendChild(a);a.click();setTimeout(()=>{a.remove();URL.revokeObjectURL(url)},2000);
 // In restricted viewers a download may be silently blocked: also offer copy
 setTimeout(()=>openModal('Fichier : '+filename,`<p class="help">Si le téléchargement ne s'est pas lancé, copiez le contenu ci-dessous et enregistrez-le dans un fichier nommé <b>${esc(filename)}</b>.</p><textarea style="width:100%;min-height:200px;font:12px ui-monospace,monospace" readonly>${esc(data)}</textarea>`,[{label:'Copier',onClick:()=>{navigator.clipboard.writeText(data).then(()=>toast('Copié'));return false}},{label:'Fermer',cls:'primary'}]),400)}catch(e){toast('Export impossible : '+e.message)}}
function icsEscape(s){return String(s||'').replace(/\\/g,'\\\\').replace(/;/g,'\\;').replace(/,/g,'\\,').replace(/\n/g,'\\n')}
function icsDate(w){const d=fromWall(w);return d.getUTCFullYear()+pad(d.getUTCMonth()+1)+pad(d.getUTCDate())+'T'+pad(d.getUTCHours())+pad(d.getUTCMinutes())+'00Z'}
function buildICS(items){
 const lines=['BEGIN:VCALENDAR','VERSION:2.0','PRODID:-//Pau FC//Calendrier Jeunes//FR','CALSCALE:GREGORIAN','METHOD:PUBLISH','X-WR-CALNAME:Pau FC – Jeunes','X-WR-TIMEZONE:Europe/Paris'];
 const stamp=icsDate(new Date());
 for(const it of items){if(it.cancelled)continue;const start=it.date;const end=new Date(+start+durationMin(it)*6e4);
  const summary=it.kind==='event'?`${it.team.label} · ${it.opponent} (${it.evType})`:`${it.team.label} · ${it.home?'Pau FC – '+it.opponent:it.opponent+' – Pau FC'} (${it.home?'DOM':'EXT'})`;
  const descr=it.kind==='event'?[it.evType,it.note].filter(Boolean).join(' · '):[it.comp+(it.journee?' J'+it.journee:''),it.poule,it.heureOk?'':'Heure à confirmer',it.note].filter(Boolean).join(' · ');
  const loc=[it.stade,it.ville].filter(Boolean).join(', ');
  lines.push('BEGIN:VEVENT',`UID:paufc-${it.id}@calendrier-jeunes`,`DTSTAMP:${stamp}`,it.heureOk?`DTSTART:${icsDate(start)}`:`DTSTART;VALUE=DATE:${ymd(start).replace(/-/g,'')}`,it.heureOk?`DTEND:${icsDate(end)}`:`DTEND;VALUE=DATE:${ymd(new Date(+start+864e5)).replace(/-/g,'')}`,`SUMMARY:${icsEscape(summary)}`,`DESCRIPTION:${icsEscape(descr)}`,loc?`LOCATION:${icsEscape(loc)}`:'',`CATEGORIES:${icsEscape(it.team.label)}`,'END:VEVENT')}
 lines.push('END:VCALENDAR');return lines.filter(Boolean).join('\r\n')}
function buildCSV(items){const h=['Date','Heure','Jour','Équipe','Catégorie','Dom/Ext','Adversaire / Intitulé','Compétition','Journée','Stade','Ville','Statut','Note'];
 const rows=items.map(i=>[ymd(i.date),i.heureOk?pad(i.date.getHours())+':'+pad(i.date.getMinutes()):'',DAYS_L[i.date.getDay()],i.team.label,i.team.cat,i.kind==='event'?(i.evType||'Événement')+(i.home?' (dom)':' (ext)'):i.home?'Domicile':'Extérieur',i.opponent,i.comp,i.journee||'',i.stade||'',i.ville||'',i.cancelled?'annulé':(i.statut||''),i.note||'']);
 return '\ufeff'+[h,...rows].map(r=>r.map(v=>'"'+String(v==null?'':v).replace(/"/g,'""')+'"').join(';')).join('\r\n')}
function openExportModal(){const filtered=filterItems(ITEMS);const n=filtered.filter(i=>!i.cancelled).length;
 openModal('Exporter',`<p>Export de la sélection actuelle : <b>${n} rencontres</b> (${S.filters.teams?S.filters.teams.length+' équipe(s)':'toutes les équipes'}, ${S.filters.ha==='all'?'domicile + extérieur':S.filters.ha==='home'?'domicile':'extérieur'}, ${S.filters.when==='upcoming'?'à venir':'saison complète'}).</p>
  <div style="display:grid;gap:8px">
   <button class="btn" id="x-ics">📅 Fichier Google Agenda / iCal (.ics)</button>
   <div class="help">Dans Google Agenda : Paramètres → Importer et exporter → Importer, en choisissant de préférence un agenda dédié « Pau FC Jeunes ». Ré-importez après chaque mise à jour FFF : les événements existants sont mis à jour, pas dupliqués.</div>
   <button class="btn" id="x-csv">📊 Tableau Excel / Sheets (.csv)</button>
   <button class="btn" id="x-print">🖨 Récapitulatif PDF par week-end (à imprimer)</button>
  </div>`,[{label:'Fermer'}]);
 $('#x-ics').onclick=()=>{download('paufc-jeunes-'+ymd(new Date())+'.ics',buildICS(filtered),'text/calendar');closeModal()};
 $('#x-csv').onclick=()=>{download('paufc-jeunes-'+ymd(new Date())+'.csv',buildCSV(filtered),'text/csv');closeModal()};
 $('#x-print').onclick=()=>{closeModal();makePdf()}}

// ---------- PDF recap ----------
function hexRgb(h){h=h.replace('#','');return [parseInt(h.slice(0,2),16),parseInt(h.slice(2,4),16),parseInt(h.slice(4,6),16)]}
function pdfSafe(s){return String(s==null?'':s).replace(/[–—]/g,'-').replace(/’/g,"'").replace(/→/g,'>').replace(/·/g,'-').replace(/[^\x00-\xFF]/g,'')}
function makePdf(){
 if(!window.jspdf||!window.jspdf.jsPDF){toast('Générateur PDF indisponible (connexion ?) — nouvelle tentative dans un instant');setTimeout(()=>{if(window.jspdf)makePdf();else window.print()},1500);return}
 const filtered=filterItems(ITEMS);const now=nowWall();const today=new Date(now.getFullYear(),now.getMonth(),now.getDate());
 const keepFrom=new Date(today);keepFrom.setDate(keepFrom.getDate()-7);const wes=WEEKENDS.filter(w=>w.items.length&&(S.filters.when==='all'||w.sun>=keepFrom));
 if(!wes.length){toast('Rien à imprimer pour cette sélection');return}
 const {jsPDF}=window.jspdf;const doc=new jsPDF({unit:'mm',format:'a4'});const W=doc.internal.pageSize.getWidth(),M=12;
 const meta=pdfSafe(`${S.filters.ha==='home'?'Domicile uniquement':S.filters.ha==='away'?'Extérieur uniquement':'Domicile + extérieur'} - ${S.filters.teams?S.filters.teams.length+' équipe(s) sélectionnée(s)':'toutes les équipes'} - ${S.filters.when==='upcoming'?'à venir':'saison complète'} - édité le ${fmtDate(now)} - source FFF du ${S.snapshot.fetchedAt?S.snapshot.fetchedAt.slice(0,10):'-'}`);
 const header=()=>{doc.setFillColor(14,42,92);doc.rect(0,0,W,16,'F');doc.setFillColor(242,194,24);doc.rect(0,16,W,1.2,'F');doc.setTextColor(255,255,255);doc.setFont('helvetica','bold');doc.setFontSize(14);doc.text('PAU FC - Calendrier Jeunes',M,10.5);doc.setFont('helvetica','normal');doc.setFontSize(8.5);doc.setTextColor(185,198,226);doc.text(meta,W-M,10.5,{align:'right',maxWidth:W/2+20})};
 header();let y=24;
 for(const w of wes){
  const rows=[...w.items].filter(i=>!i.cancelled||true).sort((a,b)=>a.home===b.home?a.date-b.date:a.home?-1:1).map(i=>[
   pdfSafe(DAYS[i.date.getDay()]+' '+(i.heureOk?fmtTime(i.date):'à conf.')),
   pdfSafe(i.team.label),
   i.kind==='event'?pdfSafe(i.evType||'Evén.'):i.home?'DOM':'EXT',
   pdfSafe(i.kind==='event'?i.opponent:(i.home?'Pau FC - '+i.opponent:i.opponent+' - Pau FC'))+(i.cancelled?' (annulé)':'')+(i.joue&&i.bd!=null?'   '+i.bd+' - '+i.be:''),
   pdfSafe(i.comp.replace(/COUPE GAMBARDELLA CRÉDIT AGRICOLE/i,'Gambardella').replace(/MATCHES AMICAUX \/ U19 DISTRICT/i,'Amical')+(i.journee&&/Championnat/i.test(i.compType)?' J'+i.journee:i.tour?' '+i.tour:'')),
   pdfSafe((i.stade||(i.home&&i.kind==='match'?'terrain à définir':''))+(i.ville&&!i.home?' ('+i.ville.replace(/^\d{5}\s*/,'')+')':''))]);
  const needH=10+rows.length*6.2;if(y+needH>doc.internal.pageSize.getHeight()-12&&y>30){doc.addPage();header();y=24}
  doc.setFont('helvetica','bold');doc.setFontSize(12);doc.setTextColor(20,27,45);doc.text(pdfSafe(`WE ${fmtDate(w.sat)} - ${w.sun.getDate()}`),M,y+4);
  doc.setFontSize(8.5);doc.setFont('helvetica','normal');
  const t1=`${w.home.length} à domicile`,t2=`${w.away.length} déplacement${w.away.length>1?'s':''}`;const w2=doc.getTextWidth(t2)+6,w1=doc.getTextWidth(t1)+6;
  doc.setFillColor(252,243,207);doc.roundedRect(W-M-w2-w1-3,y,w1,6,1.5,1.5,'F');doc.setTextColor(90,67,0);doc.text(t1,W-M-w2-w1,y+4.2);
  doc.setFillColor(225,233,247);doc.roundedRect(W-M-w2,y,w2,6,1.5,1.5,'F');doc.setTextColor(29,63,120);doc.text(t2,W-M-w2+3,y+4.2);
  y+=8;
  doc.autoTable({startY:y,margin:{left:M,right:M},head:[['Jour / heure','Équipe','','Rencontre','Compétition','Lieu']],body:rows,theme:'grid',styles:{font:'helvetica',fontSize:8,cellPadding:1.4,textColor:[20,27,45],lineColor:[221,219,208],lineWidth:0.2,overflow:'linebreak'},headStyles:{fillColor:[238,237,229],textColor:[94,102,121],fontStyle:'bold',fontSize:7.5},columnStyles:{0:{cellWidth:20},1:{cellWidth:30,fontStyle:'bold'},2:{cellWidth:11,halign:'center',fontStyle:'bold'},3:{cellWidth:52},4:{cellWidth:36},5:{cellWidth:'auto'}},
   didParseCell:d=>{if(d.section!=='body')return;const it=w.items.filter(i=>!i.cancelled||true).sort((a,b)=>a.home===b.home?a.date-b.date:a.home?-1:1)[d.row.index];if(!it)return;if(d.column.index===1){d.cell.styles.fillColor=hexRgb(it.team.color);d.cell.styles.textColor=[255,255,255]}else if(d.column.index===2){d.cell.styles.fillColor=it.kind==='event'?[239,228,248]:it.home?[252,243,207]:[225,233,247];d.cell.styles.textColor=it.kind==='event'?[78,36,120]:it.home?[90,67,0]:[29,63,120]}if(it.cancelled)d.cell.styles.textColor=[150,150,150]},
   didDrawPage:d=>{if(d.pageNumber>1&&d.cursor&&d.cursor.y<24){}}});
  y=doc.lastAutoTable.finalY+7}
 const pages=doc.internal.getNumberOfPages();for(let p=1;p<=pages;p++){doc.setPage(p);doc.setFontSize(8);doc.setTextColor(120,120,120);doc.text(`Page ${p}/${pages}`,W-M,doc.internal.pageSize.getHeight()-6,{align:'right'})}
 const name='paufc-recap-'+ymd(now)+'.pdf';const buf=doc.output('arraybuffer');
 if(downloadsCap){downloadsCap.save({filename:name,data:buf}).then(()=>toast('Récap PDF enregistré')).catch(err=>{if(err&&err.code==='declined')return;toast('Enregistrement refusé ici : ouverture dans un onglet');try{window.open(doc.output('bloburl'),'_blank')}catch(e){}});return}
 try{doc.save(name)}catch(e){window.open(doc.output('bloburl'),'_blank')}}

// ---------- views & events ----------
function showView(v){$$('.tabs button').forEach(b=>b.classList.toggle('on',b.dataset.view===v));$$('.view').forEach(s=>s.classList.toggle('on',s.id==='v-'+v))}
$('.tabs').onclick=e=>{const b=e.target.closest('button');if(b)showView(b.dataset.view)};
$('#b-alerts').onclick=()=>showView('alerts');
$('#b-add-event').onclick=()=>openEventModal();
$('#b-add-team').onclick=openTeamModal;
$('#b-export').onclick=openExportModal;
$('#b-print').onclick=()=>makePdf();
$('#seg-ha').onclick=e=>{const b=e.target.closest('button');if(!b)return;S.filters.ha=b.dataset.v;renderAll()};
$('#seg-type').onclick=e=>{const b=e.target.closest('button');if(!b)return;S.filters.type=b.dataset.v;renderAll()};
$('#seg-gender').onclick=e=>{const b=e.target.closest('button');if(!b)return;S.filters.gender=b.dataset.v;renderAll()};
$('#seg-when').onclick=e=>{const b=e.target.closest('button');if(!b)return;S.filters.when=b.dataset.v;renderAll()};
$('#strip-prev').onclick=()=>{const st=$('#strip');st.scrollBy({left:-st.clientWidth*0.8,behavior:'smooth'})};
$('#strip-next').onclick=()=>{const st=$('#strip');st.scrollBy({left:st.clientWidth*0.8,behavior:'smooth'})};
(()=>{const st=$('#strip');const upd=()=>{$('#strip-prev').disabled=st.scrollLeft<=2;$('#strip-next').disabled=st.scrollLeft+st.clientWidth>=st.scrollWidth-2};st.addEventListener('scroll',upd,{passive:true});window.addEventListener('resize',upd);setTimeout(upd,300);window.__updStrip=upd})();
$('#t-all').onclick=()=>{S.filters.teams=null;renderAll()};
$('#t-none').onclick=()=>{S.filters.teams=[];renderAll()};
$('#b-ack-all').onclick=()=>{S.alerts.forEach(a=>a.read=true);S.newIds={};renderAll()};
$('#b-clear-alerts').onclick=()=>{if(confirm('Supprimer toutes les alertes ?')){S.alerts=[];S.newIds={};renderAll()}};
$('#b-sync-apply').onclick=()=>{const t=$('#sync-paste').value.trim();if(!t){$('#sync-result').textContent='Collez d\'abord les données copiées par le favori.';return}doSync(t)};
$('#b-sync-file').onclick=()=>{const fi=$('#file-input');fi.onchange=()=>{const f=fi.files[0];if(!f)return;f.text().then(doSync);fi.value=''};fi.click()};
$('#b-backup').onclick=()=>download('paufc-calendrier-sauvegarde-'+ymd(new Date())+'.json',JSON.stringify(S),'application/json');
$('#b-restore').onclick=()=>{const fi=$('#file-input');fi.onchange=()=>{const f=fi.files[0];if(!f)return;f.text().then(t=>{try{const s=JSON.parse(t);if(!s.snapshot||!s.filters)throw new Error('Ce fichier n\'est pas une sauvegarde du calendrier.');S=s;const d=defaultState();for(const k of Object.keys(d))if(S[k]===undefined)S[k]=d[k];renderAll();toast('Sauvegarde importée')}catch(e){toast(e.message)}});fi.value=''};fi.click()};
$('#b-reset').onclick=()=>{if(confirm('Réinitialiser ? Équipes ajoutées, événements, ajustements et alertes seront perdus.')){localStorage.removeItem(LS_KEY);S=defaultState();renderAll();toast('Réinitialisé')}};
window.addEventListener('beforeprint',()=>{$('#print-meta').textContent=$('#print-meta').textContent});

setupBookmarklet();
if(EVENTS_API){try{const c=JSON.parse(localStorage.getItem(LS_KEY+'_shared')||'null');if(c&&Array.isArray(c))SHARED=c}catch(e){}}
renderAll();
function loadSharedEvents(){if(!EVENTS_API)return Promise.resolve();return fetch(EVENTS_API,{cache:'no-store'}).then(r=>r.json()).then(j=>{if(j&&j.ok&&Array.isArray(j.events)){SHARED=j.events.filter(e=>e.date&&e.title);try{localStorage.setItem(LS_KEY+'_shared',JSON.stringify(SHARED))}catch(e){}renderAll()}}).catch(()=>{})}
loadSharedEvents();
// Version hébergée (GitHub Pages) : les données FFF sont rafraîchies depuis data.json à côté de la page, sans republier le code
if(/^https?:$/.test(location.protocol)&&!/claude\.ai|anthropic/.test(location.hostname)){fetch('data.json',{cache:'no-store'}).then(r=>r.ok?r.json():null).then(d=>{if(d&&Array.isArray(d.rows)&&d.fetchedAt&&d.fetchedAt>S.snapshot.fetchedAt){if(!S.snapshot.rows.length){S.snapshot={fetchedAt:d.fetchedAt,teams:d.teams,rows:d.rows}}else{applySnapshot(S,{fetchedAt:d.fetchedAt,teams:d.teams,rows:d.rows},false)}renderAll()}}).catch(()=>{})}
if(window.claude&&typeof window.claude.use==='function'){window.claude.use('downloads').then(d=>{downloadsCap=d}).catch(()=>{})}
})();
