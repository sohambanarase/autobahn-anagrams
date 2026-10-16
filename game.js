/* Autobahn Anagrams: game engine, window-seat renderer and Road Trip multiplayer.
   Needs words.js (DICT_EN, DICT_DE, TGT_EN, TGT_DE) and, for online play, config.js + supabase-js. */
(()=>{
"use strict";
const $=s=>document.getElementById(s);
const rnd=(a,b)=>a+Math.random()*(b-a);
const pick=a=>a[Math.floor(Math.random()*a.length)];
const clamp=(v,a,b)=>v<a?a:v>b?b:v;
function shuffle(a){for(let i=a.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[a[i],a[j]]=[a[j],a[i]]}return a}
function mulberry(a){return()=>{a|=0;a=a+0x6D2B79F5|0;let t=Math.imul(a^a>>>15,1|a);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296}}
const store={get(k,d){try{const v=localStorage.getItem('aa_'+k);return v==null?d:JSON.parse(v)}catch(e){return d}},set(k,v){try{localStorage.setItem('aa_'+k,JSON.stringify(v))}catch(e){}}};
const esc=s=>String(s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));

/* ---------- Words ---------- */
const EN=DICT_EN.split(' '), DE=DICT_DE.split(' ');
const EN_SET=new Set(EN), DE_SET=new Set(DE);
const T_EN=TGT_EN.split(' ').slice(120).filter(w=>w.length>=4&&w.length<=7);
const T_DE=TGT_DE.split(' ').slice(120).filter(w=>w.length>=4&&w.length<=7);
const LEET={'0':'O','1':'I','3':'E','4':'A','5':'S','7':'T','8':'B'};
const TO_D={O:'0',I:'1',E:'3',A:'4',S:'5',T:'7',B:'8'};
function counts(str){const c=new Uint8Array(26);for(let i=0;i<str.length;i++)c[str.charCodeAt(i)-65]++;return c}
function findWords(letters,lang){
  const have=counts(letters),out=[],seen=new Set();
  const lists=lang==='EN'?[EN]:lang==='DE'?[DE]:[EN,DE];
  for(const L of lists)for(const w of L){
    if(w.length>letters.length||seen.has(w))continue;
    const c=new Uint8Array(26);let ok=true;
    for(let i=0;i<w.length;i++){const k=w.charCodeAt(i)-65;if(++c[k]>have[k]){ok=false;break}}
    if(ok){out.push(w);seen.add(w)}
  }
  return out.sort((a,b)=>b.length-a.length);
}
function isWord(w,lang){return lang==='EN'?EN_SET.has(w):lang==='DE'?DE_SET.has(w):(EN_SET.has(w)||DE_SET.has(w))}

/* ---------- Route, scenes, seats, teams ---------- */
const STOPS=[{n:'München',s:'MÜN',km:0},{n:'Garmisch',s:'GAP',km:220},{n:'Freiburg',s:'FR',km:470},{n:'Frankfurt',s:'FFM',km:700},{n:'Berlin',s:'BER',km:1000}];
const TOTAL=1000;
const COMMON=['B','M','K','S','F','N','H','D','L','A','P','J','HH','BN','BS','DD','HB','KA','MA','DA','OF','HD','KS','EF','HAL','LU','WI','MZ','AB','BA','ER'];
const SCENES=[
 {name:'Bavarian Meadows',hw:'A95',codes:['M','STA','FS','ED','WM','RO','A','IN','GAP','TS'],
  skyT:'#3f7fcf',skyB:'#cbe5f4',g1:'#7aa84a',g2:'#6f9d42',road:'#55595f',fog:'#dbe9f1',dark:0,weather:0,back:'hills',sun:'#fff7d6'},
 {name:'Alpine Snow Pass',hw:'A96',codes:['GAP','OA','LI','KE','RV','FN','KN','BC','UL'],
  skyT:'#7f93a8',skyB:'#e1e7ec',g1:'#eef2f5',g2:'#e2e7ec',road:'#5f646a',fog:'#e7ecf0',dark:.1,weather:1,back:'alps',sun:'#ffffff'},
 {name:'Black Forest Rain',hw:'A5',codes:['FR','OG','KA','BAD','HD','MA','DA','F','EM','RA'],
  skyT:'#33404f',skyB:'#c4835c',g1:'#2f4a2c',g2:'#2a4427',road:'#35383d',fog:'#8a8a8a',dark:.38,weather:2,back:'forest',sun:'#ffb070'},
 {name:'Berlin Night Skyline',hw:'A9',codes:['F','OF','KS','EF','J','L','HAL','B','P','DE','WB','LDS'],
  skyT:'#040812',skyB:'#1d2747',g1:'#0f1712',g2:'#0c140f',road:'#202328',fog:'#1d2747',dark:.72,weather:0,back:'skyline',sun:'#e8eefc'}
];
const SEATS={front:{label:'Shotgun',hint:'windshield'},left:{label:'Left window',hint:'fast lane'},right:{label:'Right window',hint:'trucks'},rear:{label:'Rear window',hint:'tailgaters'}};
const SEAT_ORDER=['front','left','right','rear'];
const TEAMS={R:{name:'Rot',col:'#e5534b'},B:{name:'Blau',col:'#4a8bf0'},Y:{name:'Gelb',col:'#e8b72a'},G:{name:'Grün',col:'#38b872'}};
const TEAM_ORDER=['R','B','Y','G'];
function legAt(km){for(let i=STOPS.length-2;i>=0;i--)if(km>=STOPS[i].km)return Math.min(i,3);return 0}
function hex(h){return[parseInt(h.slice(1,3),16),parseInt(h.slice(3,5),16),parseInt(h.slice(5,7),16)]}
function mix(a,b,t){const A=hex(a),B=hex(b);return`rgb(${A.map((v,i)=>Math.round(v+(B[i]-v)*t)).join(',')})`}

/* ---------- State ---------- */
const G={
  mode:'menu',lang:store.get('lang','EN'),muted:store.get('muted',false),best:store.get('best',0),seat:store.get('seat','front'),
  score:0,streak:0,bestStreak:0,fuel:100,km:0,speed:0,words:0,longest:'',
  plate:null,tiles:[],built:[],phase:'none',phaseT:0,limit:30,elapsed:0,
  hintUsed:false,hintStep:0,wildUsed:false,solutions:[],usedTargets:new Set(),leg:0,honks:[],
  mp:false,myScore:0
};
let VIEW=G.seat;
G.len=store.get('len','normal');G.pace=1;G.lockUntil=0;G.turboUntil=0;G.misses=0;
const PACE={quick:2.6,normal:1};
const ITEMS={
  oil:{icon:'🛢️',name:'Oil slick',cost:300,rival:1,desc:'Spin out the leader. Letters lock 4 s.'},
  fog:{icon:'🌫️',name:'Fog bomb',cost:200,rival:1,desc:'Blur the leader\'s letters 7 s.'},
  turbo:{icon:'🚀',name:'Turbo',cost:250,desc:'60% faster for 10 s.'},
  fuel:{icon:'⛽',name:'Refuel',cost:200,desc:'+40 fuel in the tank.'},
  shield:{icon:'🛡️',name:'Shield',cost:150,desc:'Blocks the next prank.'}
};

/* ---------- Audio ---------- */
let AC=null,master=null,engine=null,rainGain=null;
function initAudio(){
  if(AC)return;
  try{
    AC=new (window.AudioContext||window.webkitAudioContext)();
    master=AC.createGain();master.gain.value=G.muted?0:.9;master.connect(AC.destination);
    const o=AC.createOscillator();o.type='sawtooth';o.frequency.value=48;
    const lp=AC.createBiquadFilter();lp.type='lowpass';lp.frequency.value=180;
    const g=AC.createGain();g.gain.value=.035;o.connect(lp);lp.connect(g);g.connect(master);o.start();engine={o,g};
    const len=AC.sampleRate*2,buf=AC.createBuffer(1,len,AC.sampleRate),d=buf.getChannelData(0);
    for(let i=0;i<len;i++)d[i]=Math.random()*2-1;
    const n=AC.createBufferSource();n.buffer=buf;n.loop=true;
    const bp=AC.createBiquadFilter();bp.type='bandpass';bp.frequency.value=1400;bp.Q.value=.6;
    rainGain=AC.createGain();rainGain.gain.value=0;n.connect(bp);bp.connect(rainGain);rainGain.connect(master);n.start();
  }catch(e){AC=null}
}
function tone(freq,dur,type='sine',vol=.18,when=0,slide=0){
  if(!AC||G.muted)return;const t=AC.currentTime+when;
  const o=AC.createOscillator(),g=AC.createGain();o.type=type;o.frequency.setValueAtTime(freq,t);
  if(slide)o.frequency.linearRampToValueAtTime(freq+slide,t+dur);
  g.gain.setValueAtTime(0,t);g.gain.linearRampToValueAtTime(vol,t+.012);g.gain.exponentialRampToValueAtTime(.001,t+dur);
  o.connect(g);g.connect(master);o.start(t);o.stop(t+dur+.05);
}
const SFX={
  tap(){tone(880,.06,'triangle',.07)},back(){tone(420,.07,'triangle',.06)},
  ok(){[659,784,988,1319].forEach((f,i)=>tone(f,.18,'triangle',.13,i*.07))},
  jackpot(){[523,659,784,1047,1319,1568].forEach((f,i)=>tone(f,.22,'square',.07,i*.06))},
  bad(){tone(180,.22,'square',.09);tone(150,.25,'square',.07,.08)},
  miss(){tone(300,.5,'sawtooth',.06,0,-160)},
  team(){tone(1047,.12,'triangle',.08);tone(1319,.16,'triangle',.08,.08)},
  beep(){tone(660,.18,'square',.08)},go(){tone(990,.4,'square',.09)},
  horn(far){if(!AC||G.muted)return;const t=AC.currentTime;const lp=AC.createBiquadFilter();lp.type='lowpass';lp.frequency.value=far?700:1800;const g=AC.createGain();const v=far?.05:.16;
    g.gain.setValueAtTime(0,t);g.gain.linearRampToValueAtTime(v,t+.02);g.gain.setValueAtTime(v,t+.32);g.gain.exponentialRampToValueAtTime(.001,t+.45);
    lp.connect(g);g.connect(master);[349,440].forEach(f=>{const o=AC.createOscillator();o.type='square';o.frequency.value=f;o.connect(lp);o.start(t);o.stop(t+.5)})},
  whoosh(){tone(900,.4,'sine',.04,0,-700)}
};

/* ---------- Crew & speech bubble ---------- */
const CREW={L:{name:'Lukas · driving',col:'#ffb23f',init:'L'},M:{name:'Mia · back seat',col:'#38c4b5',init:'M'},N:{name:'Navi · satnav',col:'#9aa8ff',init:'N'}};
const LINES={
  good:{L:['Sauber!','Nice one.','Ha! Klasse.','Good eyes.','That works.'],M:['Ooh, good word.','Wunderbar.','I was about to say that.','Nailed it.','Clean.']},
  long:{M:['Big word energy.','Okay, show-off. I love it.','That is a proper word.'],L:['Look at the vocabulary on this one.']},
  jackpot:{M:['JACKPOT. Every letter on the plate!','All of it. Every single letter.'],L:['Every letter! Okay, Professor.']},
  blitz:{L:['Faster than my reaction time.','Blitzschnell!'],M:['Did you even blink?']},
  bad:{M:['Not in my dictionary, sorry.','Hmm, never heard of it.','Nope. Try again?'],L:['Nice try.','I don\'t think that\'s a word.']},
  honk:{L:['Easy on the horn!','This is the Autobahn, not a parade.','They heard that in Austria.','Hup hup!'],M:['Rude. I love it.','They waved. I think.']},
  wild:{M:['Borrowing letters? Bold move.']},
  streak5:{L:['Five in a row. I\'m speeding up.'],M:['You\'re on fire. Keep going.']},
  lowfuel:{L:['Fuel is low. We need words!']}
};
const LEG_LINES=[
  [['L','Servus! München to Berlin, 1000 km. I drive, you read the plates.'],['M','Digits count too. 5 is an S, 0 is an O. Go!']],
  [['L','Alps ahead. Winter tyres on, foot off the gas.'],['M','Snow! Squint at those plates.']],
  [['L','Black Forest. Rain, obviously.'],['M','Wipers on. Eyes on the plates.']],
  [['L','Frankfurt behind us. Long night run to Berlin.'],['M','Berlin lights soon. Don\'t fall asleep on me.']]
];
// in Road Trip the back seats are real people, so Mia's lines go to the satnav
const mia=()=>G.mp?'N':'M';
let bubbleQ=[],bubbleOn=false,bubbleTimer=0;
function say(who,text,urgent){if(urgent)bubbleQ=[];bubbleQ.push([who,text]);if(!bubbleOn||urgent)nextBubble()}
function sayFrom(key,who){const set=LINES[key];if(!set)return;const w=who||pick(Object.keys(set).filter(k=>set[k].length));say(w==='M'?mia():w,pick(set[w]))}
function nextBubble(){
  clearTimeout(bubbleTimer);const b=$('bubble');
  const it=bubbleQ.shift();if(!it){b.classList.remove('show');bubbleOn=false;return}
  bubbleOn=true;const c=typeof it[0]==='string'?CREW[it[0]]:it[0];
  const av=$('bAv');av.className='av';av.style.background=c.col;av.textContent=c.init;$('bName').textContent=c.name;$('bText').textContent=it[1];
  b.classList.add('show');bubbleTimer=setTimeout(nextBubble,1400+it[1].length*45);
}

/* ---------- Plates ---------- */
function buildPlate(word,codes){
  const pool=shuffle(codes.slice()).concat(shuffle(COMMON.slice()));
  for(const code of pool){
    let rem=word.split('');let ok=true;
    for(const c of code){const i=rem.indexOf(c);if(i<0){ok=false;break}rem.splice(i,1)}
    if(!ok)continue;
    shuffle(rem);
    const non=rem.filter(c=>!TO_D[c]),conv=rem.filter(c=>TO_D[c]);
    if(non.length>2)continue;
    const mMin=Math.max(0,1-non.length),mMax=Math.min(2-non.length,conv.length);
    const opts=[];for(let m=mMin;m<=mMax;m++){if(conv.length-m<=4)opts.push(m)}
    if(!opts.length)continue;
    const m=pick(opts);const mid=shuffle(non.concat(conv.slice(0,m)));
    let dig=conv.slice(m).map(c=>TO_D[c]);
    if(!dig.length)dig=[pick(['1','3','4','5','7','8'])];
    shuffle(dig);
    if(dig[0]==='0'){const j=dig.findIndex(d=>d!=='0');if(j>0)[dig[0],dig[j]]=[dig[j],dig[0]];else dig.unshift(pick(['1','4','7']))}
    if(code.length+mid.length+dig.length>8)continue;
    return{code,mid:mid.join(''),num:dig.join(''),word};
  }
  return null;
}
function newPlate(){
  const sc=SCENES[G.leg];
  for(let tries=0;tries<200;tries++){
    const lang=G.lang==='MIX'?pick(['EN','DE']):G.lang;
    const w=pick(lang==='EN'?T_EN:T_DE);
    if(w.length<5&&Math.random()<.6)continue;
    if(G.usedTargets.has(w))continue;
    const p=buildPlate(w,sc.codes);
    if(p){G.usedTargets.add(w);return p}
  }
  return buildPlate('STAU',['S']);
}

/* ---------- Tiles & builder ---------- */
let tileId=0;
function setTilesFromPlate(p){
  G.tiles=(p.code+p.mid+p.num).split('').map(ch=>{const isD=!!LEET[ch];return{id:tileId++,ch,letter:isD?LEET[ch]:ch,kind:isD?'D':'L',used:false}});
  G.built=[];
}
function renderTiles(){
  const T=$('tiles');T.innerHTML='';
  G.tiles.forEach(t=>{
    const b=document.createElement('button');b.className='tile '+t.kind+(t.used?' used':'');
    b.setAttribute('aria-label',t.kind==='D'?`${t.ch} as ${t.letter}`:t.letter);
    b.innerHTML=t.kind==='D'?`${t.ch}<span class="bd">${t.letter}</span>`:t.kind==='W'?`${t.letter}<span class="bd">★</span>`:t.letter;
    b.onclick=()=>useTile(t.id);T.appendChild(b);
  });
  renderSlots();
}
function renderSlots(){
  const S=$('slots');S.innerHTML='';
  const n=Math.max(G.tiles.length,3);
  for(let i=0;i<n;i++){
    const tid=G.built[i];
    if(tid!=null){const t=G.tiles.find(x=>x.id===tid);const b=document.createElement('button');b.className='chosen '+t.kind;b.textContent=t.letter;b.setAttribute('aria-label','Remove '+t.letter);b.onclick=()=>removeAt(i);S.appendChild(b)}
    else{const d=document.createElement('div');d.className='slot';S.appendChild(d)}
  }
}
function canPlay(){return G.mode==='play'&&G.phase==='read'&&performance.now()>=G.lockUntil}
function useTile(id){if(!canPlay())return;const t=G.tiles.find(x=>x.id===id);if(!t||t.used)return;t.used=true;G.built.push(id);SFX.tap();renderTiles()}
function removeAt(i){if(!canPlay())return;const id=G.built.splice(i,1)[0];const t=G.tiles.find(x=>x.id===id);if(t)t.used=false;SFX.back();renderTiles()}
function shake(){const s=$('slots');s.classList.remove('shake');void s.offsetWidth;s.classList.add('shake')}
function typeLetter(L){
  if(!canPlay())return;
  const t=G.tiles.find(x=>!x.used&&x.kind==='L'&&x.letter===L)||G.tiles.find(x=>!x.used&&x.letter===L);
  if(t)useTile(t.id);else shake();
}
function clearBuilt(){if(!canPlay())return;G.tiles.forEach(t=>t.used=false);G.built=[];renderTiles()}
function shuffleTiles(){if(!canPlay())return;shuffle(G.tiles);SFX.whoosh();renderTiles()}
function builtWord(){return G.built.map(id=>G.tiles.find(t=>t.id===id).letter).join('')}

/* ---------- Plate UI ---------- */
function starsSvg(){let s='';for(let i=0;i<12;i++){const a=i/12*Math.PI*2;s+=`<circle cx="${10+7*Math.cos(a)}" cy="${10+7*Math.sin(a)}" r="1.1" fill="#ffd21f"/>`}$('stars').innerHTML=s}
function showPlate(p){
  const pl=$('plate');pl.classList.toggle('empty',!p);pl.classList.toggle('gold',!!(p&&p.gold));
  const fsz=p?Math.min(34,Math.max(22,Math.floor((Math.min(window.innerWidth,720)*.52)/((p.code+p.mid+p.num).length+1.6)))):34;
  $('ptxt').style.fontSize=fsz+'px';
  $('ptxt').innerHTML=p?`<span>${p.code}</span><span class="seals"><i></i><i></i></span><span>${p.mid}&nbsp;${p.num}</span>`:'<span>—</span>';
}
function wordsLabel(){return`${G.solutions.length} word${G.solutions.length===1?'':'s'} hiding`}
function updateChips(){
  const c=[];const t=G.elapsed;
  if(G.phase==='read'){if(t<5)c.push('<span class="chip hot">Blitz ×2</span>');else if(t<10)c.push('<span class="chip hot">Quick ×1.5</span>')}
  if(G.streak>1)c.push(`<span class="chip">Streak ×${(1+Math.min(G.streak,10)*.1).toFixed(1)}</span>`);
  if(G.phase==='read'&&G.plate&&G.plate.gold)c.push('<span class="chip gold">Gold ×3</span>');
  if(G.hintUsed)c.push('<span class="chip pen">Hint −50%</span>');
  if(G.wildUsed)c.push('<span class="chip pen">Wild −30%</span>');
  const html=c.join('');if(html!==updateChips.last){$('chips').innerHTML=html;updateChips.last=html}
}

/* ---------- Game flow ---------- */
function resetRun(){
  Object.assign(G,{misses:0,lockUntil:0,turboUntil:0,score:0,streak:0,bestStreak:0,fuel:100,km:0,speed:60,words:0,longest:'',leg:0,phase:'none',usedTargets:new Set(),myScore:0,plate:null,tiles:[],built:[]});
  bubbleQ=[];resetWorld();showPlate(null);renderTiles();$('hintline').textContent='';
}
function startSolo(){
  initAudio();if(AC&&AC.state==='suspended')AC.resume();
  G.mp=false;VIEW=G.seat;G.pace=PACE[G.len];resetRun();G.mode='play';
  hideOverlays();setMpChrome(false);
  LEG_LINES[0].forEach(l=>say(l[0],l[1]));
  if(VIEW!=='front')say('L',`You're on the ${SEATS[VIEW].label.toLowerCase()}. Watch for the ${SEATS[VIEW].hint}.`);
  setLegLabel();
  setTimeout(()=>{if(G.mode==='play')spawnTarget()},1200);
  updateHUD();
}
function hideOverlays(){['ovStart','ovEnd','ovPause','ovNet'].forEach(id=>$(id).hidden=true)}
function spawnTarget(){
  if(G.mode!=='play')return;
  G.plate=newPlate();G.plate.gold=(G.words+G.misses)>0&&Math.random()<1/7;setTilesFromPlate(G.plate);G.hintUsed=false;G.hintStep=0;G.wildUsed=false;
  G.solutions=findWords(G.tiles.map(t=>t.letter).join(''),G.lang);
  if(!G.solutions.includes(G.plate.word)&&isWord(G.plate.word,G.lang))G.solutions.unshift(G.plate.word);
  G.phase='approach';G.phaseT=0;targetSpawn();
  $('plateLbl').textContent={front:'Car ahead…',rear:'Someone is tailgating…',left:'Car coming up on the left…',right:'Catching up on a truck…'}[VIEW];
  $('hintline').textContent='';
  showPlate(null);G.tiles=[];renderTiles();updateActions();
}
function beginRead(){
  G.phase='read';target.state='read';G.elapsed=0;G.limit=(26+G.plate.word.length*1.5)*(G.pace>1?.8:1);
  showPlate(G.plate);setTilesFromPlate(G.plate);renderTiles();
  const pl=$('plate');pl.style.transform='scale(1.06)';setTimeout(()=>pl.style.transform='',220);
  $('plateLbl').textContent=wordsLabel();
  if(G.plate.gold){SFX.jackpot();toast('GOLD PLATE','', 'Triple points');say(G.mp?'N':'M','Gold plate! Triple points on this one.',true)}
  updateActions();
}
function submit(){
  if(!canPlay())return;
  const w=builtWord();
  const fail=(msg,k)=>{SFX.bad();shake();toast(msg,'bad');if(k&&Math.random()<.7)sayFrom(k)};
  if(w.length<3)return fail('3+ letters');
  if(!isWord(w,G.lang))return fail(`${w}?`,'bad');
  const base=[0,0,0,30,60,100,150,210,280,360][Math.min(w.length,9)];
  const nonWild=G.tiles.filter(t=>t.kind!=='W').length;
  const usedNonWild=G.built.filter(id=>G.tiles.find(t=>t.id===id).kind!=='W').length;
  const jackpot=usedNonWild===nonWild||(w.length>=G.plate.word.length&&w.length>=6);
  let mult=1;const tags=[];
  if(G.plate.gold){mult*=3;tags.push('Gold ×3')}
  if(jackpot){mult*=2;tags.push('Jackpot ×2')}
  if(G.elapsed<5){mult*=2;tags.push('Blitz ×2')}else if(G.elapsed<10){mult*=1.5;tags.push('Quick ×1.5')}
  G.streak++;G.bestStreak=Math.max(G.bestStreak,G.streak);
  const sm=1+Math.min(G.streak-1,10)*.1;if(sm>1){mult*=sm;tags.push(`Streak ×${sm.toFixed(1)}`)}
  if(G.hintUsed){mult*=.5;tags.push('Hint −50%')}
  if(G.wildUsed){mult*=.7;tags.push('Wild −30%')}
  const pts=Math.round(base*mult);
  G.score+=pts;G.myScore+=pts;G.words++;if(w.length>G.longest.length)G.longest=w;
  G.fuel=Math.min(100,G.fuel+(G.mp?8:10));
  const s=$('slots');s.classList.add('ok');setTimeout(()=>s.classList.remove('ok'),600);
  jackpot?SFX.jackpot():SFX.ok();
  toast(`+${pts}`,'',tags.slice(0,2).join(' · ')||w);
  if(jackpot)sayFrom('jackpot');else if(G.elapsed<5)sayFrom('blitz');else if(w.length>=6)sayFrom('long');else if(G.streak===5)sayFrom('streak5');else if(!G.mp&&Math.random()<.55)sayFrom('good');
  const others=G.solutions.filter(x=>x!==w&&x.length>=4).slice(0,3);
  if(others.length&&Math.random()<.4)setTimeout(()=>say(mia(),`Also hiding in there: ${others.join(', ')}.`),900);
  if(G.mp)netEvent({k:'solve',word:w,pts,jackpot});
  G.phase='pass';G.phaseT=0;target.state='pass';
  updateHUD();updateActions();
  setTimeout(()=>{if(G.mode==='play'&&G.phase==='pass')spawnTarget()},1300);
}
function missPlate(){
  G.phase='gone';G.phaseT=0;target.state='flee';SFX.miss();
  G.streak=0;G.misses++;G.fuel=Math.max(0,G.fuel-(G.mp?20:25));
  const best=G.solutions[0];
  if(G.mp)say('N',best?`Recalculating… it was ${best}.`:'Recalculating… that one was tough.',true);
  else say('M',best?`Gone! I'd have gone with ${best}.`:'Gone! That one was tough.',true);
  if(!G.mp&&G.fuel>0&&G.fuel<=25)setTimeout(()=>sayFrom('lowfuel'),1800);
  toast('Too slow','bad');
  if(G.mp)netEvent({k:'miss'});
  updateHUD();updateActions();
  setTimeout(()=>{if(G.mode!=='play')return;if(!G.mp&&G.fuel<=0)endSolo(false);else if(!(G.mp&&myTeamOut()))spawnTarget()},1600);
}
function useHint(){
  if(!canPlay())return;const best=G.solutions[0];if(!best)return;
  if(!G.hintUsed){G.hintUsed=true;$('hintline').textContent=`${G.mp?'Navi':'Mia'}: ${best.length} letters, starts with ${best[0]}.`;say(mia(),`Try ${best.length} letters starting with ${best[0]}.`,true)}
  clearBuilt();G.hintStep=Math.min(G.hintStep+1,best.length-1);
  for(let i=0;i<G.hintStep;i++)typeLetter(best[i]);
  updateActions();
}
function openDrawer(){if(!canPlay()||G.wildUsed)return;$('drawer').hidden=false}
function closeDrawer(){$('drawer').hidden=true}
function addWild(L){
  closeDrawer();if(!canPlay()||G.wildUsed)return;
  G.wildUsed=true;const t={id:tileId++,ch:L,letter:L,kind:'W',used:false};G.tiles.push(t);
  G.solutions=findWords(G.tiles.map(t=>t.letter).join(''),G.lang);
  if(Math.random()<.6)sayFrom('wild');useTile(t.id);updateActions();
}
function emojiAt(pos,e){const fx=$('fx');const d=document.createElement('div');d.className='emoji';d.textContent=e;d.style.left=pos.x+'px';d.style.top=(pos.y-20)+'px';fx.appendChild(d);setTimeout(()=>d.remove(),1700)}
function honk(){
  if(G.mode!=='play')return;initAudio();SFX.horn();
  const now=performance.now();G.honks=G.honks.filter(t=>now-t<2500);G.honks.push(now);
  const pos=target.screen&&target.car?target.screen:{x:$('shield').clientWidth/2,y:$('shield').clientHeight*.5};
  emojiAt(pos,pick(['👋','😠','🎉','🤘','😂','🙄','👍','🐄']));
  if(target.car)target.car.blink=1.2;
  if(G.mp)netSend({t:'honk',car:NET.myCar,name:NET.name});
  if(G.honks.length>=3){say('L','Okay, okay, they heard you!',true);G.honks=[]}
  else if(Math.random()<.3)sayFrom('honk');
}
function toast(big,cls,small){
  const fx=$('fx');const d=document.createElement('div');d.className='toast '+(cls||'');
  d.innerHTML=`<b></b>${small?'<span></span>':''}`;d.querySelector('b').textContent=big;if(small)d.querySelector('span').textContent=small;
  fx.appendChild(d);setTimeout(()=>d.remove(),1750);
}
function endSolo(arrived){
  G.mode='end';G.phase='none';closeDrawer();
  const nb=G.score>G.best;if(nb){G.best=G.score;store.set('best',G.best)}
  $('endTitle').textContent=arrived?'Willkommen in Berlin':'Out of fuel';
  $('endShield').textContent=arrived?'B':'⛽';
  const at=STOPS.slice().reverse().find(s=>G.km>=s.km);
  $('endSub').textContent=arrived?'1000 km of plates, and Lukas still has his voice. Nice trip.':`Rolled to a stop past ${at.n} at km ${Math.round(G.km)}. Mia says the next Raststätte is a long walk.`;
  fillStats(G.score,G.km,G.words,G.bestStreak,G.longest);
  $('newBest').hidden=!nb;$('standings').hidden=true;$('mvp').hidden=true;
  $('btnAgain').textContent='Drive again';$('ovEnd').hidden=false;endShownAt=performance.now();closeBoost();$('bestStart').textContent=G.best.toLocaleString('de-DE');
  if(arrived)say('L','Willkommen in Berlin! Currywurst is on me.',true);
}
function fillStats(score,km,words,streak,longest){
  $('sScore').textContent=score.toLocaleString('de-DE');$('sKm').textContent=Math.round(km)+' km';$('sWords').textContent=words;$('sStreak').textContent=streak;$('sLong').textContent=longest||'—';
}
function pause(on){
  if(G.mode!=='play'&&G.mode!=='pause')return;
  G.mode=on?'pause':'play';$('ovPause').hidden=!on;if(on){closeDrawer();closeBoost()}
  $('pauseTxt').textContent=G.mp?'Your plate is on hold. The car keeps driving and your team keeps playing.':'Engine idling. Your plate and timer are on hold.';
  if(AC&&!G.mp){on?AC.suspend():AC.resume()}
}
function setLang(l){
  G.lang=l;store.set('lang',l);
  ['EN','DE','MIX'].forEach(k=>$('lg-'+k).setAttribute('aria-pressed',k===l));
  $('langStart').textContent={EN:'English',DE:'Deutsch',MIX:'English + Deutsch'}[l];
  if(G.plate&&G.tiles.length){G.solutions=findWords(G.tiles.map(t=>t.letter).join(''),G.lang);if(G.phase==='read')$('plateLbl').textContent=wordsLabel()}
}
function updateActions(){
  const p=canPlay();
  $('aHint').disabled=!p;$('aWild').disabled=!p||G.wildUsed;$('aShuf').disabled=!p;$('aClr').disabled=!p;$('aGo').disabled=!p;
}
let legT=0;
function setLegLabel(){const sc=SCENES[G.leg];const l=$('leg');l.textContent=`${sc.hw} · ${sc.name}`;l.style.opacity=1;clearTimeout(legT);legT=setTimeout(()=>l.style.opacity=0,4200)}

/* ---------- HUD ---------- */
function buildTrack(){
  const tr=$('track');STOPS.forEach(s=>{const d=document.createElement('div');d.className='stop'+(s.km===0?' first':s.km===TOTAL?' end':'');d.style.left=(s.km/TOTAL*100)+'%';d.innerHTML=`<span>${s.s}</span>`;tr.insertBefore(d,$('carpin'))});
}
function updateHUD(){
  $('score').textContent=G.score.toLocaleString('de-DE');$('streak').textContent=G.streak;
  const f=$('fuel');f.style.width=G.fuel+'%';f.style.background=G.fuel<=25?'var(--bad)':G.fuel<=50?'var(--amber)':'var(--ok)';
}
let lastHud=0;
function updateCluster(){
  const sp=Math.round(G.speed);$('spNum').textContent=sp;
  const gear=sp<20?1:sp<40?2:sp<65?3:sp<90?4:sp<120?5:6;$('spGear').textContent='D'+gear;
  $('spArc').setAttribute('stroke-dasharray',`${clamp(sp/240,0,1)*100} 100`);
  $('odo').textContent=String(Math.floor(G.km)).padStart(6,'0')+' km';
  const p=clamp(G.km/TOTAL,0,1)*100;$('trackFill').style.width=p+'%';$('carpin').style.left=p+'%';
  const next=STOPS.find(s=>s.km>G.km)||STOPS[STOPS.length-1];$('nextCity').textContent=next.n;$('nextKm').textContent=Math.max(0,Math.ceil(next.km-G.km));
  const ni=STOPS.indexOf(next);
  document.querySelectorAll('#track .stop').forEach((d,i)=>{d.classList.toggle('done',G.km>=STOPS[i].km);d.classList.toggle('lbl',i===STOPS.length-1||i===ni)});
  const tm=$('timer');
  if(G.phase==='read'){const r=clamp(1-G.elapsed/G.limit,0,1);tm.style.width=(r*100)+'%';tm.style.background=r<.25?'var(--bad)':'var(--amber)'}else tm.style.width='0%';
  updateChips();updateBoost();
  if(G.mp)updateBoard();
}

/* ======================================================================
   World renderer. One world, four camera seats.
   front/rear: perspective down the road. left/right: perspective out the side window.
   ====================================================================== */
const cv=$('road'),ctx=cv.getContext('2d');
let W=0,H=0,DPR=1,HY=0,FOC=0,FOCS=0,ZN=3,ZF=420;const CAMH=1.25;
let travel=0,curve=0,clock=0,wiper=0,backs={};
const target={state:'none',z:140,x:0,car:null,screen:null,alpha:1};
let cars=[],objs=[],parts=[],drops=[],sparts=[],spawnD={obj:0,gantry:300,lamp:0,car:0,onc:0};
const isSide=()=>VIEW==='left'||VIEW==='right';
const CX=()=>VIEW==='front'?.55:0;
const SDIR=()=>VIEW==='left'?1:-1;
const CL=()=>VIEW==='left'?-.9:.9;

function resize(){
  const r=$('shield').getBoundingClientRect();DPR=Math.min(2,window.devicePixelRatio||1);
  W=Math.max(1,r.width);H=Math.max(1,r.height);cv.width=Math.round(W*DPR);cv.height=Math.round(H*DPR);
  ctx.setTransform(DPR,0,0,DPR,0,0);
  HY=H*.42;FOC=Math.min(W*1.0,H*1.25);ZN=CAMH*FOC/(H*.93-HY);FOCS=Math.min(W*.5,H*.62);
  buildBacks();
}
function C(z){return curve*z*z*.0009}
// perspective projection, z = distance in front of the camera
function P(x,y,z){const s=FOC/z;const xv=VIEW==='rear'?-x:x;return[W/2+(xv+C(z)-CX())*s,HY+(CAMH-y)*s,s]}
// side-window projection: d = sideways distance from the window, dx = metres forward of us
function S(d,y,dx){const s=FOCS/d;return[W/2+SDIR()*dx*s,HY+(CAMH-y)*s,s]}
const sideD=x=>VIEW==='left'?CL()-x:x-CL();
const vz=z=>VIEW==='rear'?-z:z;

function buildBacks(){
  const h=Math.ceil(HY+2);
  ['hills','alps','forest','skyline'].forEach((k,idx)=>{
    const c=document.createElement('canvas');c.width=Math.round(W*DPR);c.height=Math.round(h*DPR);const g=c.getContext('2d');g.scale(DPR,DPR);
    const R=mulberry(idx*99+7);
    if(k==='hills'){
      [['#9fbcd0',.22,.5],['#7fa86a',.12,.75],['#6c9a4f',.07,1]].forEach(([col,amp,sp],j)=>{
        g.fillStyle=col;g.beginPath();g.moveTo(0,h);for(let x=0;x<=W;x+=8)g.lineTo(x,h-HY*amp*(.55+.45*Math.sin(x/W*6*sp+j*2)));g.lineTo(W,h);g.fill();
      });
      const cx=W*.72,cy=h-HY*.09;g.fillStyle='#f3efe4';g.fillRect(cx-6,cy-30,12,30);g.fillRect(cx-16,cy-14,32,14);
      g.fillStyle='#4c6b3a';g.beginPath();g.ellipse(cx,cy-35,7,8,0,0,Math.PI*2);g.fill();g.fillRect(cx-1,cy-48,2,8);
    }else if(k==='alps'){
      [['#a9b6c4',.62],['#8c9aab',.45],['#c9d3dc',.25]].forEach(([col,amp],j)=>{
        g.fillStyle=col;g.beginPath();g.moveTo(0,h);let x=0;const pts=[];
        while(x<=W+40){pts.push([x,h-HY*amp*(.45+.55*R())]);x+=30+R()*70}
        pts.forEach(p=>g.lineTo(p[0],p[1]));g.lineTo(W,h);g.fill();
        if(j<2){g.fillStyle='#f4f7fa';pts.forEach((p,i)=>{if(i===0||i===pts.length-1)return;const a=pts[i-1],b=pts[i+1];if(p[1]<a[1]&&p[1]<b[1]){const d=(Math.min(a[1],b[1])-p[1])*.35;g.beginPath();g.moveTo(p[0],p[1]);g.lineTo(p[0]+(a[0]-p[0])*d/(a[1]-p[1]+.01),p[1]+d);g.lineTo(p[0]+(b[0]-p[0])*d/(b[1]-p[1]+.01),p[1]+d);g.fill()}})}
      });
    }else if(k==='forest'){
      [['#4a5a55',.3],['#2e413a',.2],['#1e2f27',.12]].forEach(([col,amp])=>{
        g.fillStyle=col;g.beginPath();g.moveTo(0,h);let x=-10;
        while(x<W+20){const th=HY*amp*(.6+.5*R());const tw=th*.35;g.lineTo(x,h-th*.3);g.lineTo(x+tw/2,h-th);g.lineTo(x+tw,h-th*.3);x+=tw*.7}
        g.lineTo(W,h);g.fill();
      });
    }else{
      for(let layer=0;layer<2;layer++){
        let x=-5;g.fillStyle=layer?'#0b1020':'#141b31';
        while(x<W){const bw=14+R()*34,bh=HY*(layer?.1+R()*.18:.16+R()*.22);g.fillRect(x,h-bh,bw,bh);
          if(layer){g.fillStyle='rgba(255,214,120,.75)';for(let wy=h-bh+4;wy<h-4;wy+=6)for(let wx=x+3;wx<x+bw-3;wx+=5)if(R()<.28)g.fillRect(wx,wy,2,3);g.fillStyle='#0b1020'}
          x+=bw+R()*4}
      }
      const tx=W*.62,top=h-HY*.62;g.fillStyle='#0b1020';g.beginPath();g.moveTo(tx-5,h);g.lineTo(tx-2,top+HY*.16);g.lineTo(tx+2,top+HY*.16);g.lineTo(tx+5,h);g.fill();
      g.beginPath();g.arc(tx,top+HY*.14,HY*.045,0,Math.PI*2);g.fill();g.fillRect(tx-1,top,2,HY*.1);
    }
    backs[k]=c;
  });
}

function resetWorld(){
  cars=[];objs=[];parts=[];drops=[];sparts=[];travel=0;target.state='none';target.car=null;
  for(let z=-ZF;z<ZF;z+=rnd(10,30))spawnObj(z);
}
const CAR_COLS=['#c9ccd1','#1e2024','#f1f1ee','#a8222b','#1f4e79','#5b6b3a','#8a9097','#c98a1b','#3d4650','#e8e2d0'];
const FIRMS=['Spedition Hofmann','Bäckerei Krause','Nordfracht','Alpen Logistik','Weber Transporte','Holz Brandl'];
function makeCar(x,z,role,forceType){
  const r=Math.random();const type=forceType||(role==='truck'?'truck':(r<.13?'van':'car'));
  return{x,z,role,type,col:pick(CAR_COLS),w:type==='truck'?2.55:type==='van'?1.95:1.82,h:type==='truck'?3.9:type==='van'?2.0:1.45,len:type==='truck'?13:type==='van'?5:4.5,v:0,blink:0,wob:Math.random()*6,firm:pick(FIRMS)};
}
function spawnObj(z){
  const k=SCENES[G.leg].back;const side=Math.random()<.55?1:-1;
  const x=side>0?rnd(11,30):rnd(-24,-45);
  if(k==='hills'){if(Math.random()<.16)objs.push({t:'turbine',x:side*rnd(60,130),z,h:rnd(65,90),ph:Math.random()*6});else objs.push({t:Math.random()<.7?'round':'pine',x,z,h:rnd(6,11),snow:0})}
  else if(k==='alps')objs.push({t:'pine',x,z,h:rnd(7,13),snow:1});
  else if(k==='forest'){objs.push({t:'pine',x:side>0?rnd(11,18):rnd(-22,-30),z,h:rnd(12,20),snow:0,dark:1});if(Math.random()<.1)objs.push({t:'turbine',x:side*rnd(80,140),z,h:80,ph:Math.random()*6})}
  else{if(Math.random()<.5)objs.push({t:'bldg',x:side*rnd(30,70),z,w:rnd(10,24),h:rnd(14,55),seed:Math.random()*1e6|0});else objs.push({t:'round',x,z,h:rnd(5,8)})}
}

/* target car lives in camera space: z = distance (front/rear) or forward offset (side) */
function targetHome(){return isSide()?0:VIEW==='rear'?9.5:11.5}
function targetSpawn(){
  target.alpha=1;target.state='approach';G.phaseT=0;setTimeout(()=>{if(target.car&&G.plate&&G.plate.gold)target.car.col='#d9a514'},0);
  if(isSide()){target.x=VIEW==='left'?-3.75:3.75;target.z=VIEW==='left'?-28:28;target.car=makeCar(target.x,0,'target',Math.random()<.2?'van':'car')}
  else{target.x=0;target.z=150;target.car=makeCar(0,150,'target',Math.random()<.15?'van':'car')}
}
function updateTarget(dt,v){
  const tc=target.car;if(!tc)return;
  G.phaseT+=dt;const home=targetHome();
  if(target.state==='approach'){
    target.z+=(home-target.z)*Math.min(1,dt*(isSide()?1.6:2.2));
    if(Math.abs(target.z-home)<(isSide()?1.5:2)&&G.phase==='approach')beginRead();
  }else if(target.state==='read'){
    target.z=home+Math.sin(clock*.7)*(isSide()?.5:.6);
    if(!isSide())target.x=Math.sin(clock*.5)*.25;
  }else if(target.state==='pass'){
    if(VIEW==='front'){target.x+=(3.75-target.x)*Math.min(1,dt*2.5);target.z-=v*.35*dt+dt*4;if(target.z<ZN-2)target.car=null}
    else if(VIEW==='rear'){target.x+=(-3.75-target.x)*Math.min(1,dt*2.5);target.z-=dt*(4+G.phaseT*8);if(target.z<ZN-2)target.car=null}
    else{target.z-=dt*(5+G.phaseT*16);if(target.z<-45)target.car=null}
  }else if(target.state==='flee'){
    if(isSide()){target.z+=dt*(5+G.phaseT*16);if(target.z>45)target.car=null}
    else{target.z+=dt*(18+G.phaseT*30);if(target.z>ZF)target.car=null}
  }
  if(target.car){tc.z=target.z;tc.x=target.x;tc.blink=Math.max(0,tc.blink-dt);tc.wob+=dt}
}

function update(dt){
  clock+=dt;
  const sc=SCENES[G.leg];
  let tgt;
  if(G.mp)tgt=NET.mySpeed||0;
  else{tgt=G.mode==='play'?110+Math.min(G.streak,10)*9:G.mode==='menu'?120:G.mode==='end'?0:G.speed;
    if(sc.weather===1)tgt=Math.min(tgt,95+G.streak*4);
    if(sc.weather===2)tgt=Math.min(tgt,120+G.streak*6);
    if(G.mode==='play'&&performance.now()<G.turboUntil)tgt*=1.6;}
  if(G.mode==='end')tgt=0;
  if(G.mode==='menu'||G.mode==='lobby')tgt=110;
  if(!(G.mode==='pause'&&!G.mp))G.speed+=(tgt-G.speed)*Math.min(1,dt*.8);
  if(G.mode==='pause'&&!G.mp)return;
  const v=G.speed/3.6;
  travel+=v*dt;
  curve+=((.55*Math.sin(travel/1100)+.3*Math.sin(travel/430))-curve)*Math.min(1,dt*.5);
  if(G.mode==='play'||(G.mp&&G.mode==='pause')){
    if(G.mp){G.km+=G.speed/45*dt*G.pace;G.km+=(NET.myKm-G.km)*Math.min(1,dt*1.5)}
    else G.km+=G.speed/45*dt*G.pace;
    const nl=legAt(G.km);
    if(nl!==G.leg){G.leg=nl;setLegLabel();if(G.mode==='play')LEG_LINES[nl].forEach(l=>say(l[0]==='M'?mia():l[0],l[1]))}
    if(!G.mp&&G.km>=TOTAL){G.km=TOTAL;endSolo(true)}
    if(G.mode==='play'&&G.phase==='read'){G.elapsed+=dt;if(G.elapsed>=G.limit)missPlate()}
  }
  updateTarget(dt,v);
  // traffic
  spawnD.car-=dt;spawnD.onc-=dt;
  if(spawnD.car<=0){spawnD.car=rnd(2,5);
    if(Math.random()<.5){const c=makeCar(-3.75,-ZF*.45,'fast');c.v=v+rnd(9,18);cars.push(c)}
    else{const tr=Math.random()<.45;const c=makeCar(3.75,ZF,tr?'truck':'slow');c.v=tr?rnd(22,24):Math.max(15,v-rnd(6,14));cars.push(c)}
  }
  if(spawnD.onc<=0){spawnD.onc=rnd(.8,2.4);const c=makeCar(pick([-9.2,-12.95,-16.7]),ZF,'onc');c.v=rnd(25,40);cars.push(c)}
  for(const c of cars){if(c.role==='onc')c.z-=(c.v+v)*dt;else c.z+=(c.v-v)*dt;c.wob+=dt}
  cars=cars.filter(c=>c.z>-ZF-20&&c.z<ZF+20);
  for(const o of objs)o.z-=v*dt;
  objs=objs.filter(o=>o.z>-ZF);
  spawnD.obj-=v*dt;if(spawnD.obj<=0){spawnD.obj=rnd(9,26);spawnObj(ZF)}
  spawnD.gantry-=v*dt;if(spawnD.gantry<=0){spawnD.gantry=rnd(700,1000);objs.push({t:'gantry',x:0,z:ZF})}
  if(sc.dark>.5){spawnD.lamp-=v*dt;if(spawnD.lamp<=0){spawnD.lamp=60;objs.push({t:'lamp',x:9.8,z:ZF})}}
  // weather
  const wt=weatherMix();
  if(isSide()){
    const n=Math.round((wt.rain*70+wt.snow*40)*dt*6);
    for(let i=0;i<n;i++)sparts.push({k:wt.rain>wt.snow?'r':'s',x:SDIR()>0?W+rnd(0,40):-rnd(0,40),y:rnd(-10,H),sp:rnd(.7,1.3)});
    for(const p of sparts){p.x-=SDIR()*v*(p.k==='r'?22:14)*p.sp*dt;p.y+=(p.k==='r'?30:22)*dt}
    sparts=sparts.filter(p=>p.x>-60&&p.x<W+60&&p.y<H);if(sparts.length>400)sparts.splice(0,sparts.length-400);
  }else{
    const rear=VIEW==='rear';
    if(wt.snow>0)for(let i=0;i<Math.round(60*wt.snow*dt*6);i++)parts.push({k:'s',x:rnd(-25,25),y:rnd(0,9),z:rear?rnd(2,30):rnd(20,70)});
    if(wt.rain>0){for(let i=0;i<Math.round(90*wt.rain*dt*6);i++)parts.push({k:'r',x:rnd(-20,20),y:rnd(0,10),z:rear?rnd(2,30):rnd(8,50)});
      if(Math.random()<wt.rain*dt*30)drops.push({x:Math.random()*W,y:Math.random()*H*.82,r:rnd(1.5,4),a:1})}
    for(const p of parts){p.z+=(rear?1:-1)*(v+(p.k==='r'?6:2))*dt;p.y-=(p.k==='r'?14:1.2)*dt;if(p.k==='s')p.x+=Math.sin(clock*2+p.z)*dt*.8}
    parts=parts.filter(p=>p.z>.8&&p.z<90&&p.y>-.5);if(parts.length>700)parts.splice(0,parts.length-700);
  }
  if(wt.rain>0)wiper+=dt*1.6;
  if(drops.length>160)drops.splice(0,drops.length-160);
  if(rainGain&&AC)rainGain.gain.value=G.muted?0:.05*wt.rain+.012*(G.speed/150);
  if(engine)engine.o.frequency.value=40+G.speed*.35;
}
function sceneMix(){
  const km=(G.mode==='menu'||G.mode==='lobby')?0:G.km;const i=legAt(km);const nxt=Math.min(i+1,3);
  const end=STOPS[i+1].km;const t=i===3?0:clamp((km-(end-40))/40,0,1);
  return{a:SCENES[i],b:SCENES[nxt],t};
}
function weatherMix(){if(G.mode==='menu'||G.mode==='lobby')return{snow:0,rain:0};const{a,b,t}=sceneMix();return{snow:(a.weather===1?1-t:0)+(b.weather===1?t:0),rain:(a.weather===2?1-t:0)+(b.weather===2?t:0)}}

/* ---------- drawing helpers ---------- */
function poly(pts,fill){ctx.fillStyle=fill;ctx.beginPath();ctx.moveTo(pts[0][0],pts[0][1]);for(let i=1;i<pts.length;i++)ctx.lineTo(pts[i][0],pts[i][1]);ctx.closePath();ctx.fill()}
const ZS=[];function zs(){ZS.length=0;const n=46;for(let i=0;i<=n;i++)ZS.push(ZN*Math.pow(ZF/ZN,i/n));return ZS}
function strip(x1,x2,col,y1=0,y2=0){const L=[],R=[];for(const z of ZS){L.push(P(x1,y1,z));R.push(P(x2,y2,z))}poly(L.concat(R.reverse()),col)}
function wall(x,h,col){const T=[],B=[];for(const z of ZS){T.push(P(x,h,z));B.push(P(x,0,z))}poly(T.concat(B.reverse()),col)}
function quadZ(x1,x2,za,zb,col){poly([P(x1,0,za),P(x2,0,za),P(x2,0,zb),P(x1,0,zb)],col)}
function rr(x,y,w,h,r){ctx.beginPath();if(ctx.roundRect)ctx.roundRect(x,y,w,Math.max(0,h),Math.max(0,Math.min(r,w/2,Math.abs(h)/2)));else ctx.rect(x,y,w,h)}
// first marker position in camera space for something repeating every `period` metres along the road
const phase=period=>VIEW==='rear'?travel%period:period-travel%period;

function drawSky(m,scroll){
  const g=ctx.createLinearGradient(0,0,0,HY);g.addColorStop(0,mix(m.a.skyT,m.b.skyT,m.t));g.addColorStop(1,mix(m.a.skyB,m.b.skyB,m.t));
  ctx.fillStyle=g;ctx.fillRect(0,0,W,HY+2);
  const dark=m.a.dark+(m.b.dark-m.a.dark)*m.t;
  if(dark>.5){const R=mulberry(3);ctx.fillStyle='#fff';for(let i=0;i<90;i++){const x=R()*W,y=R()*HY*.8;ctx.globalAlpha=(.3+.7*R())*(.6+.4*Math.sin(clock*2+i))*(dark-.5)*2;ctx.fillRect(x,y,1.3,1.3)}ctx.globalAlpha=1;
    const mx=VIEW==='rear'?W*.8:W*.2;ctx.fillStyle='#eef2ff';ctx.beginPath();ctx.arc(mx,HY*.28,HY*.07,0,Math.PI*2);ctx.fill();ctx.fillStyle=mix(m.a.skyT,m.b.skyT,m.t);ctx.beginPath();ctx.arc(mx+HY*.03,HY*.26,HY*.065,0,Math.PI*2);ctx.fill()}
  else{const sy=HY*(.25+dark*1.4),sx=VIEW==='rear'?W*.22:isSide()?W*.6:W*.78;const sg=ctx.createRadialGradient(sx,sy,0,sx,sy,HY*.5);const sc=mix(m.a.sun,m.b.sun,m.t);sg.addColorStop(0,sc);sg.addColorStop(.12,sc);sg.addColorStop(.13,'rgba(255,240,200,.35)');sg.addColorStop(1,'rgba(255,240,200,0)');ctx.fillStyle=sg;ctx.fillRect(0,0,W,HY)}
  const ha=backs[m.a.back],hb=backs[m.b.back];const bh=ha.height/DPR;
  const tile=(img,alpha)=>{ctx.globalAlpha=alpha;
    if(!scroll){ctx.drawImage(img,0,HY-bh+1,W,bh)}
    else{// mirrored tiles repeat every 2W without a seam
      let o=((scroll%(2*W))+2*W)%(2*W);
      for(let k=-1;k<=1;k++){const x0=k*2*W-o;ctx.drawImage(img,x0,HY-bh+1,W,bh);ctx.save();ctx.translate(x0+2*W,0);ctx.scale(-1,1);ctx.drawImage(img,0,HY-bh+1,W,bh);ctx.restore()}}};
  tile(ha,1-m.t);if(m.t>0)tile(hb,m.t);ctx.globalAlpha=1;
  if(!isSide()&&m.b.back==='skyline'&&(m.t>.3||m.a.back==='skyline')&&Math.sin(clock*3)>0){ctx.fillStyle='#ff3b3b';ctx.beginPath();ctx.arc(W*.62,HY-HY*.62+1,2,0,Math.PI*2);ctx.fill()}
  return dark;
}
function drawGround(m){
  ctx.fillStyle=mix(m.a.g1,m.b.g1,m.t);ctx.fillRect(0,HY,W,H-HY);
  ctx.fillStyle=mix(m.a.g2,m.b.g2,m.t);
  for(let z=phase(24);z<ZF;z+=24){if(z+12<ZN)continue;const a=P(0,0,Math.max(ZN,z)),b=P(0,0,z+12);ctx.fillRect(0,b[1],W,a[1]-b[1])}
}
function drawRoad(m){
  zs();const road=mix(m.a.road,m.b.road,m.t);
  strip(-18.6,-7.2,road);strip(-6.2,8.6,road);
  strip(-5.95,-5.8,'#e9e9e2');strip(5.55,5.7,'#e9e9e2');strip(-7.5,-7.35,'#d9d9d2');strip(-18.3,-18.15,'#d9d9d2');
  // German dashes: 6 m line, 12 m gap
  for(let z=phase(18);z<200;z+=18){const za=Math.max(z,ZN),zb=z+6;if(zb<ZN)continue;
    quadZ(-1.95,-1.8,za,zb,'#f2f2ea');quadZ(1.8,1.95,za,zb,'#f2f2ea');quadZ(-11.15,-11.0,za,zb,'#d9d9d2');quadZ(-14.9,-14.75,za,zb,'#d9d9d2')}
}
function drawBarrier(dark){
  wall(-6.5,.9,dark>.5?'#5d6168':'#b9bcbf');
  const T=[],T2=[];for(const z of ZS){T.push(P(-6.5,.9,z));T2.push(P(-6.9,.9,z))}poly(T.concat(T2.reverse()),dark>.5?'#7a7f86':'#d6d8da');
}
function drawGuardrail(){
  const T=[],B=[];for(const z of ZS){T.push(P(9.1,.78,z));B.push(P(9.1,.52,z))}poly(T.concat(B.reverse()),'#9aa3ab');
  ctx.strokeStyle='#6d757d';
  for(let z=phase(4);z<90;z+=4){if(z<ZN)continue;const a=P(9.1,.7,z),b=P(9.1,0,z);ctx.lineWidth=Math.max(1,.12*a[2]);ctx.beginPath();ctx.moveTo(a[0],a[1]);ctx.lineTo(b[0],b[1]);ctx.stroke()}
}
let glows=[];
// generic sprite drawn at ground point (x,y) with scale s px/m
function drawSprite(o,x,y,s,dark){
  if(o.t==='round'){if(s*o.h<1.5)return;ctx.fillStyle='#5a3f2b';ctx.fillRect(x-.2*s,y-o.h*.4*s,.4*s,o.h*.4*s);ctx.fillStyle=dark>.5?'#16251a':'#3f7a34';ctx.beginPath();ctx.arc(x,y-o.h*.62*s,o.h*.33*s,0,Math.PI*2);ctx.fill();ctx.fillStyle=dark>.5?'#1c2e20':'#56943f';ctx.beginPath();ctx.arc(x-o.h*.1*s,y-o.h*.7*s,o.h*.2*s,0,Math.PI*2);ctx.fill()}
  else if(o.t==='pine'){if(s*o.h<1.5)return;const w=o.h*.38*s,h=o.h*s;ctx.fillStyle='#4b3423';ctx.fillRect(x-.15*s,y-h*.15,.3*s,h*.15);
    const col=o.dark?'#16281e':dark>.5?'#13201a':'#2b5a33';for(let i=0;i<3;i++){const ty=y-h*.12-i*h*.27;const tw=w*(1-i*.25);poly([[x-tw,ty],[x,ty-h*.42],[x+tw,ty]],col);if(o.snow)poly([[x-tw*.45,ty-h*.24],[x,ty-h*.42],[x+tw*.45,ty-h*.24]],'#f2f6f9')}}
  else if(o.t==='turbine'){const h=o.h*s;if(h<4)return;const col=dark>.5?'#59606b':'#eef1f3';poly([[x-1.4*s,y],[x-.7*s,y-h],[x+.7*s,y-h],[x+1.4*s,y]],col);
    const L=o.h*.42*s;ctx.strokeStyle=col;ctx.lineWidth=Math.max(1,1.1*s);ctx.lineCap='round';const a0=clock*1.3+o.ph;
    for(let i=0;i<3;i++){const a=a0+i*2.094;ctx.beginPath();ctx.moveTo(x,y-h);ctx.lineTo(x+Math.cos(a)*L,y-h+Math.sin(a)*L);ctx.stroke()}
    if(dark>.3)glows.push(()=>{if(Math.sin(clock*2+o.ph)>0){ctx.fillStyle='#ff3030';ctx.beginPath();ctx.arc(x,y-h-1,Math.max(1.2,.5*s),0,Math.PI*2);ctx.fill()}})}
  else if(o.t==='bldg'){const w=o.w*s,h=o.h*s;ctx.fillStyle='#10141f';ctx.fillRect(x-w/2,y-h,w,h);if(s>.15){glows.push(()=>{const R=mulberry(o.seed);ctx.fillStyle='rgba(255,205,110,.85)';const cw=Math.max(2,1.8*s),chh=Math.max(2,2.2*s);for(let yy=y-h+chh;yy<y-chh;yy+=chh*1.8)for(let xx=x-w/2+cw;xx<x+w/2-cw;xx+=cw*1.9)if(R()<.3)ctx.fillRect(xx,yy,cw,chh)})}}
}
function lampGlow(lx,ly,s){glows.push(()=>{const r=Math.max(4,3*s);const g=ctx.createRadialGradient(lx,ly,0,lx,ly,r*3);g.addColorStop(0,'rgba(255,200,120,.9)');g.addColorStop(1,'rgba(255,200,120,0)');ctx.fillStyle=g;ctx.fillRect(lx-r*3,ly-r*3,r*6,r*6)})}
function drawObj(o,z,dark){
  if(o.t==='gantry')return drawGantry(o,z,dark);
  const p=P(o.x,0,z),s=p[2];if(p[0]<-W*.6||p[0]>W*1.6)return;
  if(o.t==='lamp'){const top=P(o.x,10,z),arm=P(8.2,10,z);ctx.strokeStyle='#3a3f46';ctx.lineWidth=Math.max(1,.2*s);ctx.beginPath();ctx.moveTo(p[0],p[1]);ctx.lineTo(top[0],top[1]);ctx.lineTo(arm[0],arm[1]);ctx.stroke();lampGlow(arm[0],arm[1],s);return}
  drawSprite(o,p[0],p[1],s,dark);
}
function drawGantry(o,z,dark){
  const a=P(-6.6,0,z),b=P(9.4,0,z),at=P(-6.6,7.4,z),bt=P(9.4,7.4,z),s=a[2];
  if(s<.25)return;
  ctx.strokeStyle=dark>.5?'#555b63':'#8c949c';ctx.lineWidth=Math.max(1,.35*s);
  ctx.beginPath();ctx.moveTo(a[0],a[1]);ctx.lineTo(at[0],at[1]);ctx.moveTo(b[0],b[1]);ctx.lineTo(bt[0],bt[1]);ctx.stroke();
  ctx.lineWidth=Math.max(1,.25*s);ctx.beginPath();ctx.moveTo(at[0],at[1]-.2*s);ctx.lineTo(bt[0],bt[1]-.2*s);ctx.moveTo(at[0],at[1]+.5*s);ctx.lineTo(bt[0],bt[1]+.5*s);ctx.stroke();
  const next=STOPS.find(st=>st.km>G.km)||STOPS[4];const after=STOPS[Math.min(STOPS.indexOf(next)+1,4)];
  const sc=SCENES[G.leg];
  const panels=[[-5.6,-.4,sc.hw,next.n,Math.max(1,Math.round(next.km-G.km))],[.4,5.4,'A'+(G.leg===3?'10':'7'),after.n,Math.max(1,Math.round(after.km-G.km))]];
  for(const[x1,x2,hw,city,km]of panels){
    let p1=P(x1,7.3,z),p2=P(x2,4.6,z);if(p2[0]<p1[0]){const t=p1[0];p1=[p2[0],p1[1],p1[2]];p2=[t,p2[1],p2[2]]}
    const w=p2[0]-p1[0],h=p2[1]-p1[1];
    if(VIEW==='rear'){ctx.fillStyle=dark>.5?'#4a5058':'#9aa1a8';rr(p1[0],p1[1],w,h,.2*s);ctx.fill();continue}
    ctx.fillStyle='#1d5fc0';rr(p1[0],p1[1],w,h,.2*s);ctx.fill();ctx.strokeStyle='#fff';ctx.lineWidth=Math.max(.6,.08*s);rr(p1[0]+.12*s,p1[1]+.12*s,w-.24*s,h-.24*s,.15*s);ctx.stroke();
    const fs=.75*s;if(fs>5){ctx.fillStyle='#fff';ctx.font=`700 ${fs}px "Barlow Condensed",sans-serif`;ctx.textBaseline='middle';
      ctx.fillText(city,p1[0]+.45*s,p1[1]+h*.36);ctx.font=`600 ${fs*.8}px "Barlow Condensed",sans-serif`;ctx.fillText(km+' km',p1[0]+.45*s,p1[1]+h*.7);
      const bw=fs*1.9;ctx.fillStyle='#fff';rr(p2[0]-bw-.35*s,p1[1]+.35*s,bw,fs*1.1,.12*s);ctx.fill();ctx.fillStyle='#1d5fc0';ctx.font=`800 ${fs*.8}px "Barlow Condensed",sans-serif`;ctx.textAlign='center';ctx.fillText(hw,p2[0]-bw/2-.35*s,p1[1]+.35*s+fs*.56);ctx.textAlign='left';
      ctx.strokeStyle='#fff';ctx.lineWidth=Math.max(1,.12*s);const ax=p2[0]-bw/2-.35*s,ay=p1[1]+h*.62;ctx.beginPath();ctx.moveTo(ax,ay);ctx.lineTo(ax,ay+h*.28);ctx.moveTo(ax-.3*s,ay+h*.16);ctx.lineTo(ax,ay+h*.3);ctx.lineTo(ax+.3*s,ay+h*.16);ctx.stroke()}
  }
}
function plateText(){return G.plate?`${G.plate.code}·${G.plate.mid} ${G.plate.num}`:''}
// car seen from behind (face 'rear') or from the front (face 'front')
function drawCar(c,z,dark,face,isTarget){
  if(z<ZN*.7)return;
  const p=P(c.x,0,z),s=p[2];const x=p[0],y=p[1]+Math.sin(c.wob*9)*.012*s;const w=c.w*s,h=c.h*s;
  if(x<-w*2||x>W+w*2)return;
  ctx.fillStyle='rgba(0,0,0,.35)';ctx.beginPath();ctx.ellipse(x,y,w*.58,.18*s,0,0,Math.PI*2);ctx.fill();
  ctx.fillStyle='#111';ctx.fillRect(x-w*.46,y-.32*s,w*.17,.32*s);ctx.fillRect(x+w*.29,y-.32*s,w*.17,.32*s);
  const flash=c.blink>0&&Math.sin(clock*18)>0;
  if(face==='front'){
    if(c.type==='truck'){
      ctx.fillStyle='#e9eaeb';rr(x-w/2,y-h,w,h*.9,.2*s);ctx.fill();
      const g=ctx.createLinearGradient(0,y-h,0,y-h*.55);g.addColorStop(0,'#a9bccd');g.addColorStop(1,'#3a4856');ctx.fillStyle=g;ctx.fillRect(x-w*.44,y-h*.92,w*.88,h*.36);
      ctx.fillStyle='#2b2e33';ctx.fillRect(x-w*.36,y-h*.45,w*.72,h*.22);
    }else{
      ctx.fillStyle=c.col;rr(x-w/2,y-h*.62,w,h*.5,.15*s);ctx.fill();poly([[x-w*.42,y-h*.6],[x-w*.32,y-h],[x+w*.32,y-h],[x+w*.42,y-h*.6]],c.col);
      const g=ctx.createLinearGradient(0,y-h,0,y-h*.6);g.addColorStop(0,'#9fb3c6');g.addColorStop(1,'#33414f');poly([[x-w*.37,y-h*.62],[x-w*.29,y-h*.95],[x+w*.29,y-h*.95],[x+w*.37,y-h*.62]],g);
      ctx.fillStyle='#1b1d20';ctx.fillRect(x-w*.18,y-h*.4,w*.36,h*.13);
    }
    if(isTarget||c.role!=='onc'){const pw=.55*s,ph=.13*s,px=x-pw/2,py=y-h*.2;ctx.fillStyle=isTarget&&G.plate&&G.plate.gold?'#ffd34d':'#f5f5ef';ctx.fillRect(px,py,pw,ph);ctx.fillStyle='#0d3a9e';ctx.fillRect(px,py,pw*.1,ph);
      if(isTarget&&G.phase!=='approach'&&ph>7){ctx.fillStyle='#111';ctx.font=`700 ${ph*.82}px "Barlow Condensed",sans-serif`;ctx.textBaseline='middle';ctx.textAlign='center';ctx.fillText(plateText(),px+pw*.55,py+ph*.55);ctx.textAlign='left'}}
    const hy0=c.type==='truck'?y-h*.18:y-h*.42;
    glows.push(()=>{for(const sx of[-1,1]){const hx=x+sx*w*.36;ctx.fillStyle='#fffbe8';ctx.beginPath();ctx.ellipse(hx,hy0,w*.08,Math.max(1,h*.05),0,0,Math.PI*2);ctx.fill();
      const k=flash?1:dark>.3?.55*dark:0;if(k>0){const r=w*(flash?1.1:.6);const g2=ctx.createRadialGradient(hx,hy0,0,hx,hy0,r);g2.addColorStop(0,`rgba(255,248,220,${k})`);g2.addColorStop(1,'rgba(255,248,220,0)');ctx.fillStyle=g2;ctx.fillRect(hx-r,hy0-r,r*2,r*2)}}});
  }else if(c.type==='truck'){
    ctx.fillStyle='#e8e9ea';ctx.fillRect(x-w/2,y-h,w,h*.86);ctx.fillStyle='#2a5aa0';ctx.fillRect(x-w/2,y-h*.42,w,h*.06);
    ctx.strokeStyle='#b5b9bd';ctx.lineWidth=Math.max(.5,.04*s);ctx.beginPath();ctx.moveTo(x,y-h);ctx.lineTo(x,y-h*.14);ctx.stroke();
    if(s>14){ctx.fillStyle='#2a5aa0';ctx.font=`700 ${.32*s}px "Barlow Condensed",sans-serif`;ctx.textAlign='center';ctx.fillText(c.firm,x,y-h*.62);ctx.textAlign='left'}
    ctx.fillStyle='#333';ctx.fillRect(x-w*.42,y-h*.14,w*.84,.1*s);
    glows.push(()=>{ctx.fillStyle='#e0202a';ctx.fillRect(x-w*.48,y-h*.2,w*.12,.12*s);ctx.fillRect(x+w*.36,y-h*.2,w*.12,.12*s)});
  }else{
    const cab=c.type==='van'?.92:.72;
    ctx.fillStyle=c.col;rr(x-w/2,y-h*.6,w,h*.48,.18*s);ctx.fill();
    poly([[x-w*.46,y-h*.58],[x-w*cab/2,y-h],[x+w*cab/2,y-h],[x+w*.46,y-h*.58]],c.col);
    const g=ctx.createLinearGradient(0,y-h,0,y-h*.6);g.addColorStop(0,'#2a333d');g.addColorStop(1,'#151a20');
    poly([[x-w*.4,y-h*.6],[x-w*(cab/2-.05),y-h*.94],[x+w*(cab/2-.05),y-h*.94],[x+w*.4,y-h*.6]],g);
    ctx.fillStyle='rgba(0,0,0,.25)';ctx.fillRect(x-w/2,y-h*.2,w,h*.08);
    const pw=.55*s,ph=.13*s,px=x-pw/2,py=y-h*.38;ctx.fillStyle=isTarget&&G.plate&&G.plate.gold?'#ffd34d':'#f5f5ef';ctx.fillRect(px,py,pw,ph);ctx.fillStyle='#0d3a9e';ctx.fillRect(px,py,pw*.1,ph);
    if(isTarget&&G.phase!=='approach'&&ph>7){ctx.fillStyle='#111';ctx.font=`700 ${ph*.82}px "Barlow Condensed",sans-serif`;ctx.textBaseline='middle';ctx.textAlign='center';ctx.fillText(plateText(),px+pw*.55,py+ph*.55);ctx.textAlign='left'}
    glows.push(()=>{for(const sx of[-1,1]){const tx=x+sx*w*.38,ty=y-h*.52;ctx.fillStyle=flash?'#ffb020':'#d8222b';ctx.fillRect(tx-w*.09,ty-.07*s,w*.18,.14*s);
      if(dark>.3||flash){const r=w*.35;const g2=ctx.createRadialGradient(tx,ty,0,tx,ty,r);g2.addColorStop(0,flash?'rgba(255,176,32,.6)':`rgba(255,40,40,${.5*dark})`);g2.addColorStop(1,'rgba(255,40,40,0)');ctx.fillStyle=g2;ctx.fillRect(tx-r,ty-r,r*2,r*2)}}});
  }
  if(isTarget){target.screen={x,y:y-h};
    if(G.phase==='read'){const by=y-h-.6*s-Math.abs(Math.sin(clock*4))*.25*s;poly([[x-.35*s,by-.35*s],[x+.35*s,by-.35*s],[x,by]],'#ffb23f')}}
}
function drawWeather(){
  for(const p of parts){const q=P(p.x,p.y,p.z);if(q[0]<0||q[0]>W||q[1]<0||q[1]>H)continue;
    if(p.k==='s'){ctx.fillStyle='rgba(255,255,255,.9)';ctx.beginPath();ctx.arc(q[0],q[1],Math.min(4,.06*q[2]+.6),0,Math.PI*2);ctx.fill()}
    else{const q2=P(p.x,p.y+.9,p.z+1.5);ctx.strokeStyle='rgba(200,215,230,.45)';ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(q[0],q[1]);ctx.lineTo(q2[0],q2[1]);ctx.stroke()}}
}
function drawGlass(wt,pivots,L,span){
  if(!(wt.rain>0||drops.length))return;
  const ang=(Math.sin(wiper)*.5+.5)*span;
  for(const d of drops){
    for(const[pxv,pyv,a0]of pivots){const a=Math.atan2(pyv-d.y,d.x-pxv);const da=Math.PI-a-a0;const dist=Math.hypot(d.x-pxv,d.y-pyv);if(dist<L&&Math.abs(da-ang)<.09)d.a=0}
    if(d.a<=0)continue;ctx.fillStyle=`rgba(210,225,240,${.35*d.a})`;ctx.beginPath();ctx.arc(d.x,d.y,d.r,0,Math.PI*2);ctx.fill();ctx.fillStyle=`rgba(255,255,255,${.5*d.a})`;ctx.fillRect(d.x-d.r*.3,d.y-d.r*.5,1,1)}
  drops=drops.filter(d=>d.a>0);
  if(wt.rain>0)for(const[pxv,pyv,a0]of pivots){const aa=Math.PI-ang-a0;const ex=pxv+Math.cos(aa)*L,ey=pyv-Math.sin(aa)*L;ctx.strokeStyle='#0a0b0d';ctx.lineWidth=Math.max(3,H*.012);ctx.lineCap='round';ctx.beginPath();ctx.moveTo(pxv,pyv);ctx.lineTo(ex,ey);ctx.stroke()}
}
function snowEdge(wt){if(wt.snow>.2){const g=ctx.createLinearGradient(0,H*.75,0,H);g.addColorStop(0,'rgba(240,246,250,0)');g.addColorStop(1,`rgba(240,246,250,${.35*wt.snow})`);ctx.fillStyle=g;ctx.fillRect(0,H*.7,W,H*.3)}}
const INK='#0b0d10',INK2='#15181d';
function drawFrontInterior(dark){
  ctx.fillStyle=INK2;ctx.beginPath();ctx.moveTo(0,0);ctx.lineTo(W,0);ctx.lineTo(W,H*.035);ctx.quadraticCurveTo(W/2,H*.075,0,H*.035);ctx.fill();
  const pw=Math.max(26,W*.07);
  poly([[0,0],[pw*1.6,0],[pw*.35,H*.9],[0,H*.9]],INK);poly([[W,0],[W-pw*1.6,0],[W-pw*.35,H*.9],[W,H*.9]],INK);
  ctx.fillStyle=INK;ctx.beginPath();ctx.moveTo(0,H);ctx.lineTo(0,H*.9);ctx.quadraticCurveTo(W*.5,H*.84,W,H*.9);ctx.lineTo(W,H);ctx.fill();
  ctx.strokeStyle='rgba(255,255,255,.06)';ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(0,H*.9);ctx.quadraticCurveTo(W*.5,H*.84,W,H*.9);ctx.stroke();
  const wr=Math.min(W*.2,H*.42),wx=W*.1,wy=H+wr*.45;
  ctx.strokeStyle='#1c1f24';ctx.lineWidth=Math.max(9,wr*.14);ctx.beginPath();ctx.arc(wx,wy,wr,Math.PI*1.08,Math.PI*1.95);ctx.stroke();
  ctx.fillStyle='#c79a73';for(const a of[1.24,1.78]){ctx.beginPath();ctx.ellipse(wx+Math.cos(Math.PI*a)*wr,wy+Math.sin(Math.PI*a)*wr,wr*.11,wr*.08,a,0,Math.PI*2);ctx.fill()}
  const MX=W*.5,mw=Math.min(W*.22,170),mh=mw*.3,mx=MX-mw/2,my=W<640?Math.max(H*.05,54):H*.05;
  ctx.fillStyle=INK;ctx.fillRect(MX-3,0,6,my+2);
  ctx.fillStyle='#111317';rr(mx-3,my-3,mw+6,mh+6,mh*.4);ctx.fill();
  ctx.save();rr(mx,my,mw,mh,mh*.35);ctx.clip();
  const mg=ctx.createLinearGradient(0,my,0,my+mh);mg.addColorStop(0,dark>.5?'#121a2e':'#a9c3d6');mg.addColorStop(.55,dark>.5?'#1a2238':'#cfdde6');mg.addColorStop(.56,dark>.5?'#141414':'#4d5156');mg.addColorStop(1,dark>.5?'#0d0d0d':'#3d4045');ctx.fillStyle=mg;ctx.fillRect(mx,my,mw,mh);
  const fx2=mx+mw*.55,fy=my+mh*.62;ctx.fillStyle=dark>.5?'#222':'#6c7480';rr(fx2-mw*.07,fy-mh*.18,mw*.14,mh*.22,3);ctx.fill();
  if(dark>.3){ctx.fillStyle='#fff6d0';ctx.beginPath();ctx.arc(fx2-mw*.045,fy,2.2,0,Math.PI*2);ctx.arc(fx2+mw*.045,fy,2.2,0,Math.PI*2);ctx.fill()}
  ctx.fillStyle='rgba(255,255,255,.08)';ctx.fillRect(mx,my,mw,mh*.25);ctx.restore();
  // hanging Brezel charm
  const sw=Math.sin(clock*1.7)*.25+curve*.3;const cx0=MX,cy0=my+mh+3;const len=mh*1.1;const bx=cx0+Math.sin(sw)*len,by=cy0+Math.cos(sw)*len;
  ctx.strokeStyle='#444';ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(cx0,cy0);ctx.lineTo(bx,by);ctx.stroke();
  ctx.strokeStyle='#b8783a';ctx.lineWidth=Math.max(3,mh*.13);ctx.lineCap='round';const pr=mh*.3;
  ctx.beginPath();ctx.arc(bx-pr*.45,by+pr*.9,pr*.6,Math.PI*.9,Math.PI*2.25);ctx.stroke();ctx.beginPath();ctx.arc(bx+pr*.45,by+pr*.9,pr*.6,Math.PI*.75,Math.PI*2.1);ctx.stroke();
  ctx.beginPath();ctx.moveTo(bx-pr*.9,by+pr*1.3);ctx.lineTo(bx+pr*.5,by+pr*.4);ctx.moveTo(bx+pr*.9,by+pr*1.3);ctx.lineTo(bx-pr*.5,by+pr*.4);ctx.stroke();
}
function drawRearInterior(dark){
  // heated-glass lines
  ctx.strokeStyle=dark>.5?'rgba(255,140,90,.18)':'rgba(120,70,50,.22)';ctx.lineWidth=1;
  for(let i=0;i<7;i++){const y=H*(.4+i*.055);ctx.beginPath();ctx.moveTo(W*.14,y);ctx.quadraticCurveTo(W/2,y-H*.015,W*.86,y);ctx.stroke()}
  ctx.fillStyle=INK2;ctx.beginPath();ctx.moveTo(0,0);ctx.lineTo(W,0);ctx.lineTo(W,H*.06);ctx.quadraticCurveTo(W/2,H*.1,0,H*.06);ctx.fill();
  // third brake light
  ctx.fillStyle=dark>.3?'#ff2a2a':'#9b1d22';rr(W*.43,H*.035,W*.14,H*.022,3);ctx.fill();
  // thick C-pillars
  poly([[0,0],[W*.13,0],[W*.2,H*.82],[0,H*.82]],INK);poly([[W,0],[W*.87,0],[W*.8,H*.82],[W,H*.82]],INK);
  // parcel shelf
  ctx.fillStyle=INK;ctx.beginPath();ctx.moveTo(0,H);ctx.lineTo(0,H*.82);ctx.quadraticCurveTo(W/2,H*.78,W,H*.82);ctx.lineTo(W,H);ctx.fill();
  // headrests of the back bench
  for(const hx of[W*.27,W*.73]){const hw=Math.min(W*.17,120),hh=H*.17;ctx.fillStyle='#1b1f25';rr(hx-hw/2,H*.8,hw,hh,hh*.35);ctx.fill();ctx.fillStyle='#262b33';rr(hx-hw/2+4,H*.8+4,hw-8,hh*.3,hh*.2);ctx.fill();
    ctx.strokeStyle='#30363f';ctx.lineWidth=3;ctx.beginPath();ctx.moveTo(hx-hw*.2,H*.8+hh);ctx.lineTo(hx-hw*.2,H);ctx.moveTo(hx+hw*.2,H*.8+hh);ctx.lineTo(hx+hw*.2,H);ctx.stroke()}
}
function drawSideInterior(dark){
  const f=SDIR();const wx0=W*.04,wx1=W*.96,wy0=H*.06,wy1=H*.84,r=Math.min(40,W*.06);
  ctx.save();ctx.beginPath();ctx.rect(0,0,W,H);
  // window opening, slanted toward the front of the car
  const fx=f>0?wx1:wx0,bx=f>0?wx0:wx1,slant=W*.16*f;
  ctx.moveTo(bx,wy1);ctx.lineTo(bx,wy0+r);ctx.quadraticCurveTo(bx,wy0,bx+r*f,wy0);ctx.lineTo(fx-slant,wy0);ctx.lineTo(fx,wy0+H*.22);ctx.lineTo(fx,wy1);ctx.closePath();
  ctx.fillStyle=INK;ctx.fill('evenodd');ctx.restore();
  // rubber seal
  ctx.strokeStyle='#22262c';ctx.lineWidth=3;ctx.beginPath();ctx.moveTo(bx,wy1);ctx.lineTo(bx,wy0+r);ctx.quadraticCurveTo(bx,wy0,bx+r*f,wy0);ctx.lineTo(fx-slant,wy0);ctx.lineTo(fx,wy0+H*.22);ctx.lineTo(fx,wy1);ctx.stroke();
  // door panel
  const g=ctx.createLinearGradient(0,wy1,0,H);g.addColorStop(0,'#1d2228');g.addColorStop(1,'#0e1115');ctx.fillStyle=g;ctx.fillRect(0,wy1,W,H-wy1);
  ctx.fillStyle='#262c34';rr(W*.08,wy1+(H-wy1)*.35,W*.84,(H-wy1)*.22,6);ctx.fill();
  ctx.fillStyle='#9aa3ad';rr(f>0?W*.7:W*.18,wy1+(H-wy1)*.12,W*.12,(H-wy1)*.12,4);ctx.fill();
}
function renderPersp(m,wt){
  const dark=drawSky(m,0);drawGround(m);drawRoad(m);
  const rear=VIEW==='rear';
  const vis=z=>z>ZN*.7&&z<ZF+5;
  const left=[],right=[];
  for(const o of objs){const z=vz(o.z);if(!vis(z))continue;(o.x<-6.6&&o.t!=='gantry'?left:right).push({z,o})}
  for(const c of cars){const z=vz(c.z);if(!vis(z))continue;(c.role==='onc'?left:right).push({z,c})}
  left.sort((a,b)=>b.z-a.z);
  for(const it of left)it.o?drawObj(it.o,it.z,dark):drawCar(it.c,it.z,dark,rear?'rear':'front',false);
  drawBarrier(dark);drawGuardrail();
  if(target.car)right.push({z:target.z,c:target.car,t:1});
  right.sort((a,b)=>b.z-a.z);
  target.screen=null;
  for(const it of right)it.o?drawObj(it.o,it.z,dark):drawCar(it.c,it.z,dark,(it.t?rear:rear)?'front':'rear',!!it.t);
  fogAndDark(m,wt,dark,true);
  drawWeather();
  if(rear){drawGlass(wt,[[W/2,H*.8,Math.PI*.2]],H*.55,Math.PI*.6);snowEdge(wt);drawRearInterior(dark)}
  else{drawGlass(wt,[[W*.22,H*.94,0],[W*.62,H*.94,0]],H*.78,Math.PI*.62);snowEdge(wt);drawFrontInterior(dark)}
}
function fogAndDark(m,wt,dark,headlamps){
  const fg=ctx.createLinearGradient(0,HY-H*.04,0,HY+H*.09);const fc=hex(m.t<.5?m.a.fog:m.b.fog);
  fg.addColorStop(0,`rgba(${fc},0)`);fg.addColorStop(.35,`rgba(${fc},${.55+wt.rain*.3})`);fg.addColorStop(1,`rgba(${fc},0)`);ctx.fillStyle=fg;ctx.fillRect(0,HY-H*.04,W,H*.13);
  if(dark>0){ctx.fillStyle=`rgba(4,8,22,${dark*.62})`;ctx.fillRect(0,0,W,H);
    if(headlamps&&dark>.5&&VIEW==='front'){const hg=ctx.createRadialGradient(W/2,H*.95,10,W/2,H*.7,H*.55);hg.addColorStop(0,'rgba(255,240,200,.22)');hg.addColorStop(1,'rgba(255,240,200,0)');ctx.fillStyle=hg;ctx.fillRect(0,HY,W,H-HY)}
    if(VIEW==='rear'&&dark>.3){const rg=ctx.createRadialGradient(W/2,H,10,W/2,H*.8,H*.5);rg.addColorStop(0,'rgba(255,40,40,.14)');rg.addColorStop(1,'rgba(255,40,40,0)');ctx.fillStyle=rg;ctx.fillRect(0,HY,W,H-HY)}}
  for(const g of glows)g();
}

/* ---------- side-window view ---------- */
function drawCarSide(c,dx,d,dark,isTarget){
  const p=S(d,0,dx),s=p[2];const f=c.role==='onc'?-SDIR():SDIR();
  const L=c.len*s,h=c.h*s,x=p[0],y=p[1]+Math.sin(c.wob*9)*.012*s;
  if(x+L<-20||x-L>W+20)return;
  ctx.save();if(isTarget)ctx.globalAlpha=target.alpha;
  ctx.fillStyle='rgba(0,0,0,.3)';ctx.beginPath();ctx.ellipse(x,y,L*.52,.12*s,0,0,Math.PI*2);ctx.fill();
  const X=t=>x+f*t*L; // t in [-.5,.5] from rear to front
  const wheel=(t)=>{const wx=X(t),wy=y-.33*s,r=.33*s;ctx.fillStyle='#121314';ctx.beginPath();ctx.arc(wx,wy,r,0,Math.PI*2);ctx.fill();ctx.fillStyle='#8f969e';ctx.beginPath();ctx.arc(wx,wy,r*.55,0,Math.PI*2);ctx.fill();
    ctx.strokeStyle='#4d535a';ctx.lineWidth=Math.max(1,r*.12);const a0=-f*clock*(G.speed/3.6)/.33;for(let i=0;i<5;i++){const a=a0+i*1.2566;ctx.beginPath();ctx.moveTo(wx,wy);ctx.lineTo(wx+Math.cos(a)*r*.5,wy+Math.sin(a)*r*.5);ctx.stroke()}};
  if(c.type==='truck'){
    // trailer behind, cab in front
    ctx.fillStyle='#e8e9ea';ctx.fillRect(Math.min(X(-.5),X(.28)),y-h,Math.abs(X(.28)-X(-.5)),h*.84);
    ctx.fillStyle='#2a5aa0';ctx.fillRect(Math.min(X(-.5),X(.28)),y-h*.38,Math.abs(X(.28)-X(-.5)),h*.06);
    if(s>8){ctx.fillStyle='#2a5aa0';ctx.font=`800 ${.75*s}px "Barlow Condensed",sans-serif`;ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText(c.firm,X(-.11),y-h*.62);ctx.textAlign='left'}
    ctx.fillStyle='#c0392b';ctx.fillRect(Math.min(X(.31),X(.5)),y-h*.92,Math.abs(X(.5)-X(.31)),h*.76);
    ctx.fillStyle='#3a4856';ctx.fillRect(Math.min(X(.4),X(.49)),y-h*.88,Math.abs(X(.49)-X(.4)),h*.25);
    [-.42,-.33,.38].forEach(wheel);
  }else{
    const bh=.62*s;
    ctx.fillStyle=c.col;rr(Math.min(X(-.5),X(.5)),y-.98*s,L,bh,.22*s);ctx.fill();
    const rt=c.type==='van'?-.46:-.3,ft=c.type==='van'?.18:.14;
    poly([[X(-.42),y-.95*s],[X(rt),y-h],[X(ft),y-h],[X(.3),y-.95*s]],c.col);
    const g=ctx.createLinearGradient(0,y-h,0,y-.95*s);g.addColorStop(0,'#3d4b58');g.addColorStop(1,'#151b21');
    poly([[X(-.37),y-1.0*s],[X(rt+.04),y-h*.95],[X(ft-.02),y-h*.95],[X(.25),y-1.0*s]],g);
    ctx.strokeStyle=c.col;ctx.lineWidth=Math.max(2,.1*s);ctx.beginPath();ctx.moveTo(X(-.04),y-h*.95);ctx.lineTo(X(-.04),y-1.0*s);ctx.stroke();
    ctx.strokeStyle='rgba(0,0,0,.25)';ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(X(-.05),y-.95*s);ctx.lineTo(X(-.05),y-.4*s);ctx.stroke();
    [-.31,.31].forEach(wheel);
    ctx.fillStyle='#d8222b';ctx.fillRect(Math.min(X(-.5),X(-.47)),y-.86*s,Math.abs(X(-.47)-X(-.5))+1,.16*s);
    ctx.fillStyle='#f4f1dc';ctx.fillRect(Math.min(X(.47),X(.5)),y-.82*s,Math.abs(X(.5)-X(.47))+1,.13*s);
  }
  const hx=X(.5),tx=X(-.5);
  glows.push(()=>{if(dark>.3||c.blink>0){const fl=c.blink>0&&Math.sin(clock*18)>0;const r=1.6*s;const g2=ctx.createRadialGradient(hx,y-.75*s,0,hx,y-.75*s,r);g2.addColorStop(0,`rgba(255,248,220,${fl?.9:.5*dark})`);g2.addColorStop(1,'rgba(255,248,220,0)');ctx.fillStyle=g2;ctx.fillRect(hx-r,y-.75*s-r,r*2,r*2);
    const g3=ctx.createRadialGradient(tx,y-.8*s,0,tx,y-.8*s,r*.6);g3.addColorStop(0,`rgba(255,40,40,${.5*dark})`);g3.addColorStop(1,'rgba(255,40,40,0)');ctx.fillStyle=g3;ctx.fillRect(tx-r,y-.8*s-r,r*2,r*2)}});
  ctx.restore();
  if(isTarget){
    target.screen={x,y:y-h};
    if(G.phase!=='approach'&&G.plate){// plate tag hanging off the rear bumper, readable at any distance
      const txt=plateText();ctx.font='700 17px "Barlow Condensed",sans-serif';const tw=ctx.measureText(txt).width+22,th=24;
      const ax=X(-.47),ay=y-.55*s;const px=clamp(ax-tw/2,W*.07,W*.93-tw),py=Math.max(8,y-h-th-18);
      ctx.save();ctx.globalAlpha=target.alpha;ctx.strokeStyle='rgba(255,255,255,.7)';ctx.lineWidth=1.5;ctx.setLineDash([3,3]);ctx.beginPath();ctx.moveTo(ax,ay);ctx.lineTo(px+tw/2,py+th);ctx.stroke();ctx.setLineDash([]);
      ctx.fillStyle='#111';rr(px-2,py-2,tw+4,th+4,5);ctx.fill();ctx.fillStyle=G.plate.gold?'#ffd34d':'#f5f5ef';rr(px,py,tw,th,4);ctx.fill();ctx.fillStyle='#0d3a9e';ctx.fillRect(px,py,10,th);
      ctx.fillStyle='#111';ctx.textBaseline='middle';ctx.fillText(txt,px+15,py+th/2+1);ctx.restore();
      if(G.phase==='read'){const by=py-6-Math.abs(Math.sin(clock*4))*5;poly([[px+tw/2-7,by-8],[px+tw/2+7,by-8],[px+tw/2,by]],'#ffb23f')}
    }
  }
}
function renderSide(m,wt){
  const dark=drawSky(m,travel*.06*SDIR());
  ctx.fillStyle=mix(m.a.g1,m.b.g1,m.t);ctx.fillRect(0,HY,W,H-HY);
  const road=mix(m.a.road,m.b.road,m.t);
  const yd=d=>Math.min(H,HY+CAMH*FOCS/d);
  const band=(d1,d2,col)=>{const ya=yd(d2),yb=yd(Math.max(d1,.3));ctx.fillStyle=col;ctx.fillRect(0,ya,W,yb-ya)};
  const line=(xw,col,dash)=>{const d=sideD(xw);if(d<.6)return;const y0=yd(d),y1=yd(d+.15);ctx.fillStyle=col;
    if(!dash){ctx.fillRect(0,Math.min(y0,y1),W,Math.max(1,Math.abs(y1-y0)));return}
    const span=(W/2)/(FOCS/d)+20;for(let z=-span-((travel%18)+18);z<span;z+=18){const a=S(d,0,z)[0],b=S(d,0,z+6)[0];ctx.fillRect(Math.min(a,b),Math.min(y0,y1),Math.abs(b-a),Math.max(1,Math.abs(y1-y0)))}};
  const items=[];
  if(VIEW==='left'){
    band(6.3,17.7,road);line(-11.075,'#d9d9d2',1);line(-14.825,'#d9d9d2',1);line(-7.425,'#d9d9d2');line(-18.2,'#d9d9d2');
    items.push({d:5.6,draw(){const d=5.6,ya=S(d,.9,0)[1],yb=yd(d);ctx.fillStyle=dark>.5?'#5d6168':'#b9bcbf';ctx.fillRect(0,ya,W,yb-ya);ctx.fillStyle=dark>.5?'#7a7f86':'#d6d8da';ctx.fillRect(0,ya-2,W,3)}});
    items.push({d:5.4,draw(){band(.3,5.3,road);line(-5.875,'#e9e9e2');line(-1.875,'#f2f2ea',1)}});
  }else{
    items.push({d:8.25,draw(){const d=8.2,ya=S(d,.78,0)[1],yb=S(d,.52,0)[1];ctx.fillStyle='#9aa3ab';ctx.fillRect(0,ya,W,yb-ya);ctx.fillStyle='#6d757d';const span=(W/2)/(FOCS/d)+6;for(let z=-span-(travel%4);z<span;z+=4){const px=S(d,0,z)[0];ctx.fillRect(px-1.5,ya,3,yd(d)-ya)}}});
    items.push({d:7.9,draw(){band(.3,7.7,road);line(5.625,'#e9e9e2');line(1.875,'#f2f2ea',1)}});
  }
  for(const o of objs){if(o.t==='gantry')continue;const d=sideD(o.x);if(d<1)continue;const span=(W/2+80)/(FOCS/d)+(o.t==='turbine'?40:o.t==='bldg'?o.w:6);if(Math.abs(o.z)>span)continue;items.push({d,o})}
  for(const c of cars){const d=sideD(c.x);if(d<1.5)continue;if(Math.abs(c.z)>(W/2)/(FOCS/d)+c.len)continue;items.push({d,c})}
  if(target.car)items.push({d:sideD(target.x),c:target.car,t:1});
  items.sort((a,b)=>b.d-a.d);target.screen=null;
  for(const it of items){
    if(it.draw){it.draw();continue}
    if(it.o){const p=S(it.d,0,it.o.z);
      if(it.o.t==='lamp'){const top=S(it.d,10,it.o.z);ctx.strokeStyle='#3a3f46';ctx.lineWidth=Math.max(1,.2*p[2]);ctx.beginPath();ctx.moveTo(p[0],p[1]);ctx.lineTo(top[0],top[1]);ctx.stroke();lampGlow(top[0],top[1],p[2]);continue}
      drawSprite(it.o,p[0],p[1],p[2],dark);continue}
    drawCarSide(it.c,it.t?target.z:it.c.z,it.d,dark,!!it.t);
  }
  fogAndDark(m,wt,dark,false);
  for(const p of sparts){if(p.k==='r'){ctx.strokeStyle='rgba(205,220,235,.5)';ctx.lineWidth=1.2;ctx.beginPath();ctx.moveTo(p.x,p.y);ctx.lineTo(p.x+SDIR()*14,p.y-2);ctx.stroke()}else{ctx.fillStyle='rgba(255,255,255,.9)';ctx.beginPath();ctx.arc(p.x,p.y,1.6*p.sp+.6,0,Math.PI*2);ctx.fill()}}
  snowEdge(wt);drawSideInterior(dark);
}
function render(){
  const m=sceneMix(),wt=weatherMix();glows=[];
  if(isSide())renderSide(m,wt);else renderPersp(m,wt);
  drawTurbo();
}

/* ======================================================================
   Road Trip multiplayer.
   Transport: Supabase Realtime broadcast when config.js has keys, otherwise
   BroadcastChannel (same browser, other tabs) so it can be tested anywhere.
   The trip creator is the host: it owns the lobby and the team scoreboard.
   ====================================================================== */
const NET={on:false,id:null,code:null,name:'',joinedAt:0,tr:null,kind:'',status:'',players:{},lobby:null,state:null,
  myCar:null,mySeat:null,hostTimer:0,beatTimer:0,teams:null,pstats:null,lastTick:0,ended:false,mySpeed:0,myKm:0,lastLobbySent:0,lastStartSent:0};
const amHost=()=>NET.lobby&&NET.lobby.hostId===NET.id;
function rid(n,set){const A=set||'ABCDEFGHJKLMNPQRSTUVWXYZ';let s='';for(let i=0;i<n;i++)s+=A[Math.floor(Math.random()*A.length)];return s}
function makeTransport(code,onMsg,onStatus){
  const cfg=window.AA_CONFIG||{};
  if(cfg.supabaseUrl&&cfg.supabaseAnonKey&&window.supabase&&window.supabase.createClient){
    try{
      const sb=window.supabase.createClient(cfg.supabaseUrl,cfg.supabaseAnonKey,{realtime:{params:{eventsPerSecond:20}}});
      const ch=sb.channel('aa-trip-'+code,{config:{broadcast:{self:false}}});
      ch.on('broadcast',{event:'m'},({payload})=>onMsg(payload));
      ch.subscribe(st=>onStatus(st==='SUBSCRIBED'?'online':(st==='CHANNEL_ERROR'||st==='TIMED_OUT')?'error':'connecting'));
      return{kind:'online',send:p=>{ch.send({type:'broadcast',event:'m',payload:p})},close:()=>{try{sb.removeChannel(ch)}catch(e){}}};
    }catch(e){}
  }
  let bc;try{bc=new BroadcastChannel('aa-trip-'+code)}catch(e){setTimeout(()=>onStatus('error'),0);return{kind:'none',send(){},close(){}}}
  bc.onmessage=e=>onMsg(e.data);setTimeout(()=>onStatus('local'),30);
  return{kind:'local',send:p=>bc.postMessage(p),close:()=>bc.close()};
}
function netSend(p){if(!NET.tr)return;p.from=NET.id;try{NET.tr.send(p)}catch(e){}}
function netEvent(e){
  const m=Object.assign({t:'ev',car:NET.myCar,seat:NET.mySeat,name:NET.name},e);m.from=NET.id;
  if(amHost())applyEv(m);
  netSend(m);
}
function seatOf(pid){if(!NET.lobby)return null;for(const c of NET.lobby.cars)for(const s of SEAT_ORDER)if(c.seats[s]===pid)return{car:c.id,seat:s};return null}
function carOf(id){return NET.lobby&&NET.lobby.cars.find(c=>c.id===id)}
function unseat(pid){for(const c of NET.lobby.cars)for(const s of SEAT_ORDER)if(c.seats[s]===pid)c.seats[s]=null}
function newCar(id){return{id,seats:{front:null,left:null,right:null,rear:null}}}
function autoSeat(pid){
  if(seatOf(pid))return;
  const cars=NET.lobby.cars.slice().sort((a,b)=>SEAT_ORDER.filter(s=>a.seats[s]).length-SEAT_ORDER.filter(s=>b.seats[s]).length);
  for(const c of cars){const s=SEAT_ORDER.find(k=>!c.seats[k]);if(s){c.seats[s]=pid;return}}
  if(NET.lobby.mode==='rally'&&NET.lobby.cars.length<4){const id=TEAM_ORDER.find(t=>!carOf(t));const c=newCar(id);c.seats.front=pid;NET.lobby.cars.push(c)}
}
function alive(pid){if(pid===NET.id)return true;const p=NET.players[pid];return p&&Date.now()-p.last<45000}
function namesMap(){const n={};for(const id in NET.players)n[id]=NET.players[id].name;n[NET.id]=NET.name;return n}
function sendLobby(){if(!amHost())return;NET.lobby.names=namesMap();NET.lastLobbySent=Date.now();netSend({t:'lobby',lobby:NET.lobby});renderLobby()}
function pruneLobby(){
  // drop riders who left, but only from the lobby (in a running game their team keeps the seat)
  if(!amHost()||NET.lobby.started)return false;let ch=false;
  for(const c of NET.lobby.cars)for(const s of SEAT_ORDER){const pid=c.seats[s];if(pid&&!alive(pid)){c.seats[s]=null;ch=true}}
  return ch;
}
function connect(code,create){
  NET.on=true;NET.code=code;NET.id=NET.id||rid(8,'abcdefghijkmnpqrstuvwxyz23456789');NET.joinedAt=create?Date.now()-1e6:Date.now();
  NET.players={};NET.lobby=null;NET.state=null;NET.ended=false;
  NET.players[NET.id]={name:NET.name,joinedAt:NET.joinedAt,last:Date.now()};
  if(create){NET.lobby={hostId:NET.id,mode:'convoy',len:G.len,lang:G.lang,cars:[newCar('R')],started:false,gameId:null,names:{}};NET.lobby.cars[0].seats.front=NET.id}
  NET.tr=makeTransport(code,onNet,st=>{NET.status=st;renderLobby();if(st==='online'||st==='local')hello()});
  NET.kind=NET.tr.kind;
  clearInterval(NET.beatTimer);NET.beatTimer=setInterval(heartbeat,4000);
  clearInterval(NET.hostTimer);NET.hostTimer=setInterval(hostTick,500);NET.lastTick=Date.now();
  try{history.replaceState(null,'','#'+code)}catch(e){}
  showLobby();
}
function leaveTrip(){
  if(NET.tr){netSend({t:'bye'});NET.tr.close()}
  clearInterval(NET.beatTimer);clearInterval(NET.hostTimer);
  Object.assign(NET,{on:false,tr:null,lobby:null,state:null,code:null});
  G.mp=false;G.mode='menu';setMpChrome(false);
  try{history.replaceState(null,'',location.pathname+location.search)}catch(e){}
}
function hello(){netSend({t:'hello',name:NET.name,joinedAt:NET.joinedAt})}
function heartbeat(){
  if(!NET.on)return;NET.players[NET.id].last=Date.now();hello();
  for(const id in NET.players)if(id!==NET.id&&Date.now()-NET.players[id].last>120000)delete NET.players[id];
  // host gone? the earliest remaining rider takes over
  if(NET.lobby&&!alive(NET.lobby.hostId)){
    const ids=Object.keys(NET.players).filter(alive).sort((a,b)=>(NET.players[a].joinedAt-NET.players[b].joinedAt)||(a<b?-1:1));
    if(ids[0]===NET.id){NET.lobby.hostId=NET.id;if(NET.lobby.started&&NET.state&&!NET.teams){NET.teams=JSON.parse(JSON.stringify(NET.state.teams));NET.pstats=NET.state.pstats||{}}sendLobby();say('N','The trip host dropped out. Your phone is running the trip now.')}
  }
  if(amHost()){if(pruneLobby())sendLobby();else if(Date.now()-NET.lastLobbySent>8000)sendLobby()}
  renderLobby();
}
function onNet(m){
  if(!m||m.from===NET.id||!NET.on)return;
  const now=Date.now();
  if(m.t==='hello'){
    const isNew=!NET.players[m.from];
    NET.players[m.from]=Object.assign(NET.players[m.from]||{},{name:m.name,joinedAt:m.joinedAt,last:now});
    if(amHost()&&(isNew||!seatOf(m.from))){autoSeat(m.from);sendLobby();if(NET.lobby.started&&!NET.ended)sendStart()}
    else if(amHost()&&isNew)sendLobby();
    renderLobby();return;
  }
  if(m.t==='bye'){delete NET.players[m.from];if(amHost()&&pruneLobby())sendLobby();renderLobby();return}
  if(m.t==='lobby'){
    if(m.lobby.hostId!==m.from)return;
    if(amHost()&&m.from!==NET.id){// two hosts: the earlier joiner keeps it
      const other=NET.players[m.from];if(other&&other.joinedAt>NET.joinedAt){sendLobby();return}}
    const p=NET.players[m.from]||(NET.players[m.from]={});p.last=now;
    NET.lobby=m.lobby;for(const id in m.lobby.names)if(!NET.players[id]&&id!==NET.id)NET.players[id]={name:m.lobby.names[id],joinedAt:now,last:now-4000};
    if(!seatOf(NET.id)&&!m.lobby.started)hello();
    renderLobby();
    if(G.mode==='play'&&!m.lobby.started&&NET.ended)return;
    return;
  }
  if(m.t==='sit'&&amHost()){
    const c=carOf(m.car);if(c&&!c.seats[m.seat]&&!NET.lobby.started){unseat(m.from);c.seats[m.seat]=m.from;sendLobby()}return;
  }
  if(m.t==='start'){NET.lobby=m.lobby;if(NET.gameId!==m.lobby.gameId)beginNetGame(m.lobby);return}
  if(m.t==='ev'){if(amHost())applyEv(m);showTeamEvent(m);return}
  if(m.t==='state'){NET.state=m.s;applyState();return}
  if(m.t==='end'){NET.state=m.s;applyState();showNetEnd(m.s);return}
  if(m.t==='fx'){showFx(m);return}
  if(m.t==='honk'){
    if(G.mode!=='play'&&G.mode!=='pause')return;
    if(m.car===NET.myCar){SFX.horn();emojiAt({x:W*rnd(.3,.7),y:H*.5},'📯')}
    else{SFX.horn(true);toast('📯',null,`Team ${TEAMS[m.car].name} honked`)}
    return;
  }
}
function setMode(md){
  if(!amHost()||NET.lobby.started)return;NET.lobby.mode=md;
  if(md==='convoy'){// everyone into the first car
    const riders=[];for(const c of NET.lobby.cars)for(const s of SEAT_ORDER)if(c.seats[s])riders.push(c.seats[s]);
    NET.lobby.cars=[newCar('R')];riders.slice(0,4).forEach(pid=>autoSeat(pid));
  }else if(NET.lobby.cars.length<2){NET.lobby.cars.push(newCar('B'))}
  sendLobby();
}
function addCar(){if(!amHost()||NET.lobby.cars.length>=4)return;if(NET.lobby.mode==='convoy')NET.lobby.mode='rally';NET.lobby.cars.push(newCar(TEAM_ORDER.find(t=>!carOf(t))));sendLobby()}
function removeCar(id){if(!amHost()||NET.lobby.cars.length<=1)return;const c=carOf(id);const riders=SEAT_ORDER.map(s=>c.seats[s]).filter(Boolean);NET.lobby.cars=NET.lobby.cars.filter(x=>x.id!==id);riders.forEach(autoSeat);if(NET.lobby.cars.length<2)NET.lobby.mode='convoy';sendLobby()}
function sit(car,seat){
  if(!NET.lobby||NET.lobby.started)return;
  if(amHost()){const c=carOf(car);if(c&&!c.seats[seat]){unseat(NET.id);c.seats[seat]=NET.id;sendLobby()}}
  else netSend({t:'sit',car,seat});
}
function sendStart(){NET.lastStartSent=Date.now();NET.lobby.names=namesMap();netSend({t:'start',lobby:NET.lobby})}
function hostStartTrip(){
  if(!amHost())return;
  const used=NET.lobby.cars.filter(c=>SEAT_ORDER.some(s=>c.seats[s]));if(!used.length)return;
  NET.lobby.cars=used;NET.lobby.started=true;NET.lobby.gameId=rid(6);NET.lobby.startedAt=Date.now();
  NET.teams={};NET.pstats={};NET.ended=false;
  for(const c of used)NET.teams[c.id]={score:0,fuel:100,km:0,streak:0,words:0,speed:0,status:'driving',arrivedAt:0};
  sendLobby();sendStart();beginNetGame(NET.lobby);
}
function beginNetGame(lobby){
  NET.gameId=lobby.gameId;NET.ended=false;if(!amHost())NET.teams=null;
  const me=seatOf(NET.id);if(!me){$('lbNote').textContent='The trip already started and every seat is taken.';return}
  NET.myCar=me.car;NET.mySeat=me.seat;NET.mySpeed=0;NET.myKm=0;
  initAudio();if(AC&&AC.state==='suspended')AC.resume();
  G.mp=true;G.lang=lobby.lang;G.pace=PACE[lobby.len]||1;VIEW=me.seat;resetRun();NET.lastRank=null;G.mode='play';G.km=0;
  hideOverlays();setMpChrome(true);setLegLabel();
  const mates=SEAT_ORDER.map(s=>carOf(me.car).seats[s]).filter(id=>id&&id!==NET.id).map(id=>(lobby.names||{})[id]||'?');
  say('L',`Team ${TEAMS[me.car].name}, ${lobby.mode==='rally'?'race you to Berlin':'next stop Berlin'}! You're on the ${SEATS[me.seat].label.toLowerCase()}.`);
  if(mates.length)say('N',`Riding with ${mates.join(', ')}. Plates only you can see. Points go to the whole car.`);
  // 3-2-1
  let n=3;const cd=()=>{const d=document.createElement('div');d.className='countdown';d.textContent=n>0?n:'Los!';$('fx').appendChild(d);setTimeout(()=>d.remove(),900);n>0?SFX.beep():SFX.go();if(n-->0)setTimeout(cd,900);else setTimeout(spawnTarget,500)};
  cd();
}
function applyEv(m){
  if(!NET.teams||NET.ended)return;const T=NET.teams[m.car];if(!T)return;
  const ps=NET.pstats[m.from]||(NET.pstats[m.from]={name:m.name,car:m.car,score:0,words:0,longest:''});
  if(m.k==='solve'){T.score+=m.pts;T.words++;T.streak++;T.fuel=Math.min(100,T.fuel+8);ps.score+=m.pts;ps.words++;if(m.word.length>ps.longest.length)ps.longest=m.word}
  else if(m.k==='miss'){T.streak=0;T.fuel=Math.max(0,T.fuel-20);if(T.fuel<=0&&T.status==='driving')T.status='stalled'}
  else if(m.k==='item'){
    const it=ITEMS[m.item];if(!it||T.score<it.cost||T.status!=='driving')return;
    const now=Date.now();let blocked=false;
    if(it.rival){const TT=NET.teams[m.target];if(!TT||m.target===m.car||TT.status!=='driving')return;
      if(TT.shield){TT.shield=0;blocked=true}else if(m.item==='oil')TT.oilUntil=now+5000}
    else if(m.item==='turbo')T.turboUntil=now+10000;
    else if(m.item==='fuel')T.fuel=Math.min(100,T.fuel+40);
    else if(m.item==='shield')T.shield=1;
    T.score-=it.cost;ps.spent=(ps.spent||0)+it.cost;ps.pranks=(ps.pranks||0)+(it.rival&&!blocked?1:0);
    const fx={t:'fx',item:m.item,by:m.name,byCar:m.car,target:m.target,blocked};
    netSend(fx);showFx(fx);
  }
}
function teamSpeed(T){
  const leg=SCENES[legAt(T.km)];let sp=95+Math.min(T.streak,10)*11;
  if(leg.weather===1)sp=Math.min(sp,100+T.streak*4);if(leg.weather===2)sp=Math.min(sp,125+T.streak*6);
  const now=Date.now();if(now<(T.turboUntil||0))sp*=1.6;if(now<(T.oilUntil||0))sp*=.35;
  return sp;
}
function hostTick(){
  const now=Date.now();const dt=Math.min(2,(now-NET.lastTick)/1000);NET.lastTick=now;
  if(!NET.on||!amHost()||!NET.lobby||!NET.lobby.started||!NET.teams||NET.ended)return;
  if(now-NET.lobby.startedAt<3500)return; // countdown
  for(const id in NET.teams){const T=NET.teams[id];
    if(T.status!=='driving'){T.speed=Math.max(0,T.speed-40*dt);continue}
    T.speed=teamSpeed(T);T.km+=T.speed/45*dt*(PACE[NET.lobby.len]||1);
    if(T.km>=TOTAL){T.km=TOTAL;T.status='arrived';T.arrivedAt=now}}
  const list=Object.values(NET.teams);
  const over=NET.lobby.mode==='rally'&&Object.keys(NET.teams).length>1?(list.some(t=>t.status==='arrived')||list.every(t=>t.status!=='driving')):list.every(t=>t.status!=='driving');
  const s={teams:NET.teams,pstats:NET.pstats,mode:NET.lobby.mode};
  NET.state=s;applyState();
  if(over){NET.ended=true;netSend({t:'end',s});showNetEnd(s);NET.lobby.started=false;NET.lobby.gameId=null;setTimeout(sendLobby,300)}
  else if((NET.tickN=(NET.tickN||0)+1)%2===0)netSend({t:'state',s});
  // a rider who missed the start message gets it again
  if(now-NET.lastStartSent>6000&&Object.keys(NET.players).some(id=>alive(id)&&seatOf(id))&&NET.lobby.started)sendStart();
}
function myTeam(){return NET.state&&NET.state.teams&&NET.state.teams[NET.myCar]}
function myTeamOut(){const t=myTeam();return t&&t.status!=='driving'}
function applyState(){
  const T=myTeam();if(!T||!G.mp)return;
  G.score=T.score;G.fuel=T.fuel;G.streak=T.streak;NET.mySpeed=T.speed;NET.myKm=T.km;
  if(T.status==='stalled'&&G.mode==='play'&&G.phase!=='none'&&G.phase!=='out'){
    G.phase='out';target.state='flee';updateActions();showPlate(null);G.tiles=[];renderTiles();
    $('plateLbl').textContent='Out of fuel. Cheering from the hard shoulder.';
    say('L','We\'re out of fuel. Let\'s see how the others do.',true);
  }
  updateHUD();
}
function showTeamEvent(m){
  if(G.mode!=='play'&&G.mode!=='pause')return;
  const col=TEAMS[m.car].col,nm=m.name||'?';
  if(m.car===NET.myCar){
    const who={init:nm[0].toUpperCase(),name:`${nm} · ${SEATS[m.seat]?SEATS[m.seat].label.toLowerCase():''}`,col};
    if(m.k==='solve'){SFX.team();say(who,m.jackpot?`JACKPOT with ${m.word}! +${m.pts}`:`${m.word} · +${m.pts}`)}
    else if(m.k==='miss')say(who,'Missed one. Tank −20.');
  }else if(m.k==='solve'&&m.jackpot){say({init:nm[0].toUpperCase(),name:`${nm} · Team ${TEAMS[m.car].name}`,col},`Jackpot with ${m.word}.`)}
}
function updateBoard(){
  const s=NET.state;const b=$('board');if(!s||!s.teams){b.hidden=true;return}
  b.hidden=false;
  const ids=Object.keys(s.teams).sort((a,c)=>s.teams[c].km-s.teams[a].km);
  const html=ids.map(id=>{const t=s.teams[id];return`<span class="tchip${id===NET.myCar?' me':''}${t.status==='stalled'?' out':''}" style="--team:${TEAMS[id].col}"><i></i>${TEAMS[id].name} ${Math.floor(t.km)} km</span>`}).join('');
  if(html!==updateBoard.last){b.innerHTML=html;updateBoard.last=html}
  const rank=ids.indexOf(NET.myCar),nowT=performance.now();
  if(ids.length>1&&G.mode==='play'&&rank>=0){
    if(NET.lastRank!=null&&rank!==NET.lastRank&&nowT-(NET.rankT||0)>5000){NET.rankT=nowT;
      if(rank<NET.lastRank){say('N',`You overtook Team ${TEAMS[ids[rank+1]].name}!`);toast('Overtake!','','P'+(rank+1))}
      else say('N',`Team ${TEAMS[ids[rank-1]].name} just overtook you. Words, quick!`)}
    if(NET.lastRank==null||nowT-(NET.rankT||0)>5000||rank<NET.lastRank)NET.lastRank=rank}
  // rival pins on the route bar
  const tr=$('track');
  for(const id of ids){if(id===NET.myCar)continue;let pin=tr.querySelector(`[data-team="${id}"]`);
    if(!pin){pin=document.createElement('div');pin.className='carpin rival';pin.dataset.team=id;pin.style.setProperty('--team',TEAMS[id].col);tr.appendChild(pin)}
    pin.style.left=clamp(s.teams[id].km/TOTAL,0,1)*100+'%'}
  $('carpin').style.background=TEAMS[NET.myCar]?TEAMS[NET.myCar].col:'';
}
function setMpChrome(on){
  $('langSeg').hidden=on;$('board').hidden=!on;
  document.querySelectorAll('#track .rival').forEach(p=>p.remove());$('carpin').style.background='';
}
function showNetEnd(s){
  if(G.mode==='end'&&$('ovEnd').hidden===false&&showNetEnd.shown===NET.gameId)return;showNetEnd.shown=NET.gameId;
  NET.ended=true;G.mode='end';G.phase='none';closeDrawer();updateActions();
  const ids=Object.keys(s.teams).sort((a,b)=>{const A=s.teams[a],B=s.teams[b];
    if(A.status==='arrived'&&B.status==='arrived')return A.arrivedAt-B.arrivedAt;if(A.status==='arrived')return -1;if(B.status==='arrived')return 1;return B.km-A.km||B.score-A.score});
  const T=s.teams[NET.myCar]||{score:0,km:0,words:0};const win=ids[0];
  const rally=ids.length>1;
  $('endShield').textContent=rally?(win===NET.myCar?'1':'B'):(T.status==='arrived'?'B':'⛽');
  $('endTitle').textContent=rally?(win===NET.myCar?'Your car wins!':`Team ${TEAMS[win].name} wins`):(T.status==='arrived'?'Willkommen in Berlin':'Out of fuel');
  $('endSub').textContent=rally?(s.teams[win].status==='arrived'?`Team ${TEAMS[win].name} reached Berlin first.`:'Every car ran dry. Furthest one takes it.'):(T.status==='arrived'?'Whole car, one tank, 1000 km. Nicely done.':`Your car stopped at km ${Math.round(T.km)}.`);
  fillStats(T.score,T.km,T.words,G.bestStreak,G.longest);
  $('newBest').hidden=true;
  const st=$('standings');st.hidden=!rally;
  st.innerHTML=ids.map((id,i)=>{const t=s.teams[id];return`<div class="strow" style="--team:${TEAMS[id].col}"><b>${i+1}</b><div><b>Team ${TEAMS[id].name}</b><br><span>${t.status==='arrived'?'Reached Berlin':t.status==='stalled'?'Out of fuel':'Still driving'} · ${Math.round(t.km)} km</span></div><em>${t.score.toLocaleString('de-DE')}</em></div>`}).join('');
  const ps=Object.values(s.pstats||{}).sort((a,b)=>b.score-a.score);
  $('mvp').hidden=!ps.length;if(ps.length)$('mvp').innerHTML=`<b>MVP: ${esc(ps[0].name)}</b> with ${ps[0].score.toLocaleString('de-DE')} points${ps[0].longest?`, longest word ${esc(ps[0].longest)}`:''}. You scored ${G.myScore.toLocaleString('de-DE')}.`;
  $('btnAgain').textContent='Back to the lobby';$('ovEnd').hidden=false;endShownAt=performance.now();
  NET.lastResults={title:$('endTitle').textContent,sub:$('endSub').textContent,rows:rally?st.innerHTML:'',mvp:ps.length?$('mvp').innerHTML:''};
  closeBoost();
}
let endShownAt=0;

/* ---------- boosts & pranks ---------- */
function rallyOn(){return G.mp&&NET.state&&NET.state.teams&&Object.keys(NET.state.teams).length>1}
function itemsAvail(){return rallyOn()?['oil','fog','turbo','fuel','shield']:['turbo','fuel']}
function rivalTarget(){
  if(!rallyOn())return null;const T=NET.state.teams;
  const ids=Object.keys(T).filter(id=>id!==NET.myCar&&T[id].status==='driving').sort((a,b)=>T[b].km-T[a].km||T[b].score-T[a].score);
  return ids[0]||null;
}
function canUse(id){const it=ITEMS[id];if(G.mode!=='play'||G.score<it.cost)return false;if(G.mp&&myTeamOut())return false;if(it.rival&&!rivalTarget())return false;return true}
function updateBoost(){
  const btn=$('btnBoost');const show=G.mode==='play'||G.mode==='pause';if(btn.hidden===show)btn.hidden=!show;if(!show)return;
  const n=itemsAvail().filter(canUse).length;const bd=$('boostBadge');
  if(bd.textContent!==String(n)){bd.textContent=n;bd.hidden=!n}
  btn.classList.toggle('ready',n>0);btn.classList.toggle('dim',n===0);
  if(!$('boostSheet').hidden&&updateBoost.sig!==G.score+'|'+rivalTarget()){renderBoost()}
}
function renderBoost(){
  updateBoost.sig=G.score+'|'+rivalTarget();
  $('walletTxt').textContent=`· ${G.mp?'Team wallet':'Wallet'}: ${G.score.toLocaleString('de-DE')} pts`;
  const tgt=rivalTarget();
  $('boostGrid').innerHTML=itemsAvail().map((id,i)=>{const it=ITEMS[id];const ok=canUse(id);
    const extra=it.rival?(tgt?` Hits Team ${TEAMS[tgt].name}.`:' No rival on the road.'):'';
    return`<button class="item${it.rival?' rival':''}" data-item="${id}" ${ok?'':'disabled'}><span class="ic">${it.icon}</span><b>${it.name} <kbd>${i+2}</kbd></b><small>${it.desc}${extra}</small><em>${it.cost} pts${G.score<it.cost?` · need ${it.cost-G.score} more`:''}</em></button>`}).join('');
  $('boostGrid').querySelectorAll('[data-item]').forEach(b=>b.onclick=()=>useItem(b.dataset.item));
}
function openBoost(){if(G.mode!=='play')return;closeDrawer();renderBoost();$('boostSheet').hidden=false}
function closeBoost(){$('boostSheet').hidden=true}
function useItem(id){
  const it=ITEMS[id];if(!it||!itemsAvail().includes(id))return;
  if(!canUse(id)){if(G.score<it.cost)toast(`Need ${it.cost} pts`,'bad');return}
  closeBoost();
  if(!G.mp){
    G.score-=it.cost;
    if(id==='turbo'){G.turboUntil=performance.now()+10000;banner({icon:'🚀',who:'Turbo!',what:'Hold on tight',det:'60% faster for 10 seconds',col:'#ffb23f'});say('L','Turbo! Hold on to something.',true)}
    if(id==='fuel'){G.fuel=Math.min(100,G.fuel+40);banner({icon:'⛽',who:'Refuelled',what:'+40 fuel',col:'#3fd17f'});say('L','Tank topped up. Danke!',true)}
    SFX.go();updateHUD();return;
  }
  netEvent({k:'item',item:id,target:it.rival?rivalTarget():null});
}
function banner(o){
  const b=$('banner');b.innerHTML=`<div class="bn" style="--team:${o.col||'#fff'}">${o.icon?`<span class="ico">${o.icon}</span>`:''}<span class="who"></span><span class="what"></span>${o.det?'<span class="det"></span>':''}</div>`;
  b.querySelector('.who').textContent=o.who;b.querySelector('.what').textContent=o.what;if(o.det)b.querySelector('.det').textContent=o.det;
  clearTimeout(banner.t);banner.t=setTimeout(()=>b.innerHTML='',2700);
}
function showFx(m){
  if(!G.mp||(G.mode!=='play'&&G.mode!=='pause'))return;
  const it=ITEMS[m.item];if(!it)return;
  const byCol=TEAMS[m.byCar].col,tName=m.target?TEAMS[m.target].name:'';
  const mine=m.byCar===NET.myCar,hitMe=m.target===NET.myCar;
  if(m.blocked){banner({icon:'🛡️',who:`Team ${tName}`,what:'Blocked it!',det:`${m.by}'s ${it.name.toLowerCase()} bounced off the shield.`,col:TEAMS[m.target].col});SFX.team();return}
  if(it.rival){
    const verb=m.item==='oil'?'oiled':'fogged';
    banner({icon:it.icon,who:m.by,what:hitMe?`${verb} your car!`:`${verb} Team ${tName}`,det:hitMe?(m.item==='oil'?'Spinning out! Letters locked for 4 seconds.':'Fog! Squint hard for 7 seconds.'):mine?'Nice shot.':'',col:byCol});
    if(hitMe){m.item==='oil'?applyOil():applyFog();say('L',m.item==='oil'?`${m.by} put oil on the road! Hold on!`:`Can't see a thing! Thanks, ${m.by}.`,true)}
    else if(mine)SFX.team();
    return;
  }
  const what={turbo:'hit the turbo',fuel:'refuelled the car',shield:'raised a shield'}[m.item];
  const det={turbo:`Team ${TEAMS[m.byCar].name} is 60% faster for 10 s`,fuel:'+40 fuel',shield:'The next prank on them bounces off'}[m.item];
  banner({icon:it.icon,who:m.by,what,det,col:byCol});
  if(mine){SFX.go();if(m.item==='turbo')G.turboUntil=performance.now()+10000}
}
function applyOil(){
  const sh=$('shield');sh.classList.remove('spin');void sh.offsetWidth;sh.classList.add('spin');setTimeout(()=>sh.classList.remove('spin'),1400);
  tone(500,.9,'sawtooth',.08,0,-380);tone(320,.9,'square',.05,.1,-200);
  if(G.phase==='read'){G.tiles.forEach(t=>t.used=false);G.built=[];shuffle(G.tiles);renderTiles()}
  G.lockUntil=performance.now()+4000;$('console').classList.add('locked');updateActions();
  setTimeout(()=>{$('console').classList.remove('locked');updateActions()},4000);
}
function applyFog(){
  $('console').classList.add('fogged');$('fogLayer').classList.add('on');tone(200,1.2,'sine',.06,0,-80);
  clearTimeout(applyFog.t);applyFog.t=setTimeout(()=>{$('console').classList.remove('fogged');$('fogLayer').classList.remove('on')},7000);
}
function drawTurbo(){
  if(!(G.mode==='play'&&performance.now()<G.turboUntil))return;
  ctx.save();ctx.strokeStyle='rgba(255,255,255,.35)';ctx.lineCap='round';
  for(let i=0;i<26;i++){const r=mulberry((i*977+Math.floor(clock*14))|0);const a=r()*Math.PI*2,d0=Math.min(W,H)*(.2+r()*.3),len=Math.min(W,H)*(.15+r()*.25);
    ctx.lineWidth=1+r()*2.5;
    if(isSide()){const y=r()*H*.85,x=r()*W;ctx.beginPath();ctx.moveTo(x,y);ctx.lineTo(x+SDIR()*-len,y);ctx.stroke()}
    else{const cx=W/2,cy=HY;ctx.beginPath();ctx.moveTo(cx+Math.cos(a)*d0,cy+Math.sin(a)*d0);ctx.lineTo(cx+Math.cos(a)*(d0+len),cy+Math.sin(a)*(d0+len));ctx.stroke()}}
  ctx.restore();
}

/* ---------- lobby UI ---------- */
function showLobby(){
  hideOverlays();$('ovNet').hidden=false;$('netJoin').hidden=true;$('netLobby').hidden=false;
  G.mode='lobby';renderLobby();$('ovNet').scrollTop=0;
}
function renderLobby(){
  if(!NET.on||$('netLobby').hidden)return;
  $('lbCode').textContent=NET.code;
  const L=NET.lobby,host=amHost();
  const note=$('lbNote');
  if(!L){note.innerHTML=NET.status==='error'?'Could not connect. Check your internet, or the trip code.':'Looking for the trip… Make sure the host has the lobby open.';$('lbCars').innerHTML='';
    ['mdConvoy','mdRally','btnAddCar','btnStartTrip'].forEach(id=>$(id).disabled=true);return}
  const names=Object.assign({},L.names||{},namesMap());
  $('hostCtl').hidden=!host;$('guestSum').hidden=host;
  const len=L.len||'normal';
  $('lbLen').querySelectorAll('button').forEach(b=>b.setAttribute('aria-pressed',b.dataset.len===len));
  if(!host){const hn=esc((names[L.hostId])||'The host');
    const gs=`<p><b>${hn}</b> is setting up the trip. Pick your seat below.</p><div class="setchips"><span>${L.mode==='rally'?'Rally · teams race':'Convoy · one car'}</span><span>${len==='quick'?'Quick · 3 min':'Normal · 7 min'}</span><span>${{EN:'English',DE:'Deutsch',MIX:'EN + DE'}[L.lang]}</span></div>`;
    if(gs!==renderLobby.gs){$('guestSum').innerHTML=gs;renderLobby.gs=gs}}
  const lr=NET.lastResults,lb=$('lbLast');lb.hidden=!lr;
  if(lr){const h=`<span class="lblsm">Last trip</span><h3>${esc(lr.title)}</h3><p class="netnote">${esc(lr.sub)}</p>${lr.rows?`<div style="display:grid;gap:6px">${lr.rows}</div>`:''}${lr.mvp?`<p class="netnote">${lr.mvp}</p>`:''}`;if(h!==renderLobby.lr){lb.innerHTML=h;renderLobby.lr=h}}
  $('mdConvoy').setAttribute('aria-pressed',L.mode==='convoy');$('mdRally').setAttribute('aria-pressed',L.mode==='rally');
  $('mdConvoy').disabled=$('mdRally').disabled=!host;
  $('btnAddCar').hidden=!host||L.cars.length>=4;$('btnAddCar').disabled=false;
  ['EN','DE','MIX'].forEach(k=>{const b=$('tl-'+k);b.setAttribute('aria-pressed',L.lang===k);b.disabled=!host});
  const html=L.cars.map(c=>{
    const t=TEAMS[c.id];const n=SEAT_ORDER.filter(s=>c.seats[s]).length;
    const seat=(s,span)=>{const pid=c.seats[s];const mine=pid===NET.id;const nm=pid?esc(names[pid]||'Rider')+(alive(pid)?'':' (away)'):'Free seat';
      return`<button class="seatbox${pid?' taken':''}${mine?' mine':''}${span?' span2':''}" data-car="${c.id}" data-seat="${s}" ${pid&&!mine?'disabled':''}>${SEATS[s].label}<small>${mine?'You':nm}</small></button>`};
    return`<div class="carcard" style="--team:${t.col}"><div class="carhead"><span class="dot" style="width:12px;height:12px;border-radius:50%;background:${t.col}"></span><b>Team ${t.name}</b><small>${n}/4 riders</small>${host&&L.cars.length>1?`<button class="x" data-rm="${c.id}" aria-label="Remove Team ${t.name}">×</button>`:''}</div>
      <div class="cargrid"><div class="seatbox drv">Lukas<small>driving</small></div>${seat('front')}${seat('left')}${seat('right')}${seat('rear',1)}</div></div>`}).join('');
  if(html!==renderLobby.last){$('lbCars').innerHTML=html;renderLobby.last=html;
    $('lbCars').querySelectorAll('[data-seat]').forEach(b=>b.onclick=()=>sit(b.dataset.car,b.dataset.seat));
    $('lbCars').querySelectorAll('[data-rm]').forEach(b=>b.onclick=()=>removeCar(b.dataset.rm))}
  const riders=Object.keys(names).filter(id=>seatOf(id)&&alive(id)).length;
  $('btnStartTrip').hidden=!host;$('btnStartTrip').disabled=!host;
  const conn=NET.status==='online'?'Online.':NET.status==='local'?'<b style="color:var(--bad)">Test mode: online keys missing in config.js.</b> Friends on other phones can\'t join, only other tabs in this browser.':NET.status==='error'?'Connection problem. Check your internet.':'Connecting…';
  const hostName=names[L.hostId]||'the host';
  note.innerHTML=`${conn} ${riders} rider${riders===1?'':'s'} in. ${host?(L.mode==='rally'&&L.cars.length<2?'Add a second car to race.':'Start when everyone is seated.'):`Waiting for ${esc(hostName)} to start.`}`;
}
function openNet(){
  hideOverlays();$('ovNet').hidden=false;$('netJoin').hidden=false;$('netLobby').hidden=true;G.mode='lobby';
  $('inName').value=store.get('name','');
  const h=(location.hash||'').replace('#','').toUpperCase();if(/^[A-Z]{4}$/.test(h))$('inCode').value=h;
  const hasKeys=!!(window.AA_CONFIG&&AA_CONFIG.supabaseUrl&&AA_CONFIG.supabaseAnonKey);
  $('netNote').className='netnote'+(hasKeys?'':' warn');
  $('netNote').innerHTML=hasKeys?'':'<b>Online play is off on this site.</b> config.js has no Supabase keys, so friends on other phones can\'t join. Only other tabs in this browser can. See README, step 2.';
}
function readName(){const n=$('inName').value.trim().slice(0,12);if(!n){$('inName').focus();$('netNote').textContent='Add your name so your team knows who found what.';return null}store.set('name',n);NET.name=n;return n}

/* ---------- loop ---------- */
let last=performance.now();
function frame(now){
  const dt=Math.min(.05,(now-last)/1000);last=now;
  update(dt);render();
  if(now-lastHud>90){updateCluster();lastHud=now}
  requestAnimationFrame(frame);
}

/* ---------- input ---------- */
function setLen(l){G.len=l;store.set('len',l);document.querySelectorAll('#lenPick button').forEach(b=>b.setAttribute('aria-pressed',b.dataset.len===l))}
function setSeat(s){G.seat=s;store.set('seat',s);document.querySelectorAll('#seatPick button').forEach(b=>b.setAttribute('aria-pressed',b.dataset.seat===s));if(G.mode==='menu'){VIEW=s;resetWorld()}}
function bind(){
  $('btnSolo').onclick=startSolo;
  $('btnRoadTrip').onclick=openNet;
  $('btnAgain').onclick=()=>{if(G.mp&&NET.on){G.mode='lobby';showLobby()}else startSolo()};
  $('btnMenu').onclick=()=>{if(NET.on)leaveTrip();hideOverlays();$('ovStart').hidden=false;G.mode='menu';G.mp=false;VIEW=G.seat;resetRun()};
  document.querySelectorAll('#seatPick button').forEach(b=>b.onclick=()=>setSeat(b.dataset.seat));
  $('btnPause').onclick=()=>pause(G.mode==='play');$('btnResume').onclick=()=>pause(false);
  $('btnQuit').onclick=()=>{pause(false);if(G.mp){leaveTrip();hideOverlays();$('ovStart').hidden=false;G.mode='menu';VIEW=G.seat;resetRun();return}endSolo(false);$('endTitle').textContent='Trip ended';$('endShield').textContent='P';$('endSub').textContent=`You pulled over at km ${Math.round(G.km)}.`};
  $('btnSound').onclick=()=>{G.muted=!G.muted;store.set('muted',G.muted);initAudio();if(master)master.gain.value=G.muted?0:.9;$('sndWave').style.display=G.muted?'none':'';$('btnSound').setAttribute('aria-label',G.muted?'Sound off':'Sound on')};
  ['EN','DE','MIX'].forEach(k=>{$('lg-'+k).onclick=()=>setLang(k);$('tl-'+k).onclick=()=>{if(amHost()&&!NET.lobby.started){NET.lobby.lang=k;sendLobby()}}});
  $('aHint').onclick=useHint;$('aWild').onclick=openDrawer;$('aShuf').onclick=shuffleTiles;$('aClr').onclick=clearBuilt;$('aHorn').onclick=honk;$('aGo').onclick=submit;
  $('drClose').onclick=closeDrawer;
  $('btnBoost').onclick=()=>$('boostSheet').hidden?openBoost():closeBoost();$('bsClose').onclick=closeBoost;
  document.querySelectorAll('#lenPick button').forEach(b=>b.onclick=()=>setLen(b.dataset.len));
  $('lbLen').querySelectorAll('button').forEach(b=>b.onclick=()=>{if(amHost()&&!NET.lobby.started){NET.lobby.len=b.dataset.len;sendLobby()}});
  const abc=$('abc');for(let i=0;i<26;i++){const L=String.fromCharCode(65+i);const b=document.createElement('button');b.textContent=L;b.onclick=()=>addWild(L);abc.appendChild(b)}
  // multiplayer
  $('btnCreate').onclick=()=>{if(!readName())return;connect(rid(4),true)};
  $('btnJoin').onclick=()=>{if(!readName())return;const c=$('inCode').value.trim().toUpperCase();if(!/^[A-Z]{4}$/.test(c)){$('netNote').textContent='Trip codes are 4 letters.';$('inCode').focus();return}connect(c,false)};
  $('inCode').addEventListener('input',e=>{e.target.value=e.target.value.toUpperCase().replace(/[^A-Z]/g,'').slice(0,4)});
  $('btnNetBack').onclick=()=>{hideOverlays();$('ovStart').hidden=false;G.mode='menu'};
  $('btnLeave').onclick=()=>{leaveTrip();hideOverlays();$('ovStart').hidden=false};
  $('mdConvoy').onclick=()=>setMode('convoy');$('mdRally').onclick=()=>setMode('rally');
  $('btnAddCar').onclick=addCar;$('btnStartTrip').onclick=hostStartTrip;
  $('btnCopy').onclick=()=>{
    const url=location.href.split('#')[0]+'#'+NET.code;const txt=`Join my Autobahn Anagrams trip! Code ${NET.code}: ${url}`;
    const ok=()=>{$('btnCopy').textContent='Copied';setTimeout(()=>$('btnCopy').textContent='Copy invite',1500)};
    try{navigator.clipboard.writeText(txt).then(ok,()=>{$('lbNote').textContent=txt})}catch(e){$('lbNote').textContent=txt}
  };
  window.addEventListener('keydown',e=>{
    if(e.metaKey||e.ctrlKey||e.altKey)return;
    const tg=e.target;if(tg&&(tg.tagName==='INPUT'||tg.tagName==='TEXTAREA')){if(e.key==='Enter'){tg.id==='inCode'?$('btnJoin').click():tg.id==='inName'&&$('inCode').value?$('btnJoin').click():null}return}
    const k=e.key;
    if(!$('ovStart').hidden){if(k==='Enter'){e.preventDefault();startSolo()}return}
    if(!$('ovEnd').hidden){if(k==='Enter'){e.preventDefault();if(!G.mp&&performance.now()-endShownAt>1500)$('btnAgain').click()}return}
    if(!$('ovNet').hidden)return;
    if(G.mode==='pause'){if(k==='Escape'||k==='Enter'){e.preventDefault();pause(false)}return}
    if(!$('boostSheet').hidden&&k==='Escape'){closeBoost();return}
    if(/^[2-6]$/.test(k)){const id=itemsAvail()[+k-2];if(id)useItem(id);return}
    if(!$('drawer').hidden){if(/^[a-zA-Z]$/.test(k))addWild(k.toUpperCase());if(k==='Escape')closeDrawer();e.preventDefault();return}
    if(k==='Escape'){pause(true);return}
    if(k===' '){e.preventDefault();honk();return}
    if(k==='Enter'){e.preventDefault();submit();return}
    if(k==='Backspace'){e.preventDefault();if(G.built.length)removeAt(G.built.length-1);return}
    if(k==='1'){shuffleTiles();return}
    if(/^[a-zA-Z]$/.test(k))typeLetter(k.toUpperCase());
  });
  document.addEventListener('visibilitychange',()=>{if(document.hidden&&G.mode==='play'&&!G.mp)pause(true);if(!document.hidden&&NET.on){NET.players[NET.id].last=Date.now();hello();if(amHost())sendLobby()}});
  new ResizeObserver(resize).observe($('shield'));
}

starsSvg();buildTrack();bind();setLang(G.lang);setSeat(G.seat);setLen(G.len);
$('bestStart').textContent=G.best.toLocaleString('de-DE');
if(G.muted)$('sndWave').style.display='none';
resize();resetWorld();updateActions();updateHUD();
// an invite link (#CODE) opens the Road Trip screen straight away
if(/^#[A-Za-z]{4}$/.test(location.hash||''))openNet();
try{if('serviceWorker' in navigator&&location.protocol==='https:'&&!/claude/.test(location.hostname))navigator.serviceWorker.register('/sw.js').catch(()=>{})}catch(e){}
requestAnimationFrame(frame);
window.__AA={G,NET,setView:v=>{VIEW=v;resetWorld()}};
})();
