(function(){
const BOOT_HTML=(()=>{try{return '<!doctype html>\n'+document.documentElement.outerHTML;}catch(e){return '';}})();
const IS_SITE=!!(document.currentScript&&document.currentScript.src);
const TESTCLIENT=window.name==='by-testclient';
const $=s=>document.querySelector(s);
if(!window.THREE){ $('#importErr').hidden=false; $('#importErr').textContent='The 3D library could not load. Check your connection and reload the page.'; return; }
const V3=THREE.Vector3, D2R=Math.PI/180;
const store={get(k,d){try{const v=localStorage.getItem('by:'+k);return v==null?d:JSON.parse(v)}catch(e){return d}},set(k,v){try{localStorage.setItem('by:'+k,JSON.stringify(v));return true}catch(e){return false}},del(k){try{localStorage.removeItem('by:'+k)}catch(e){}}};
const coarse=matchMedia('(pointer:coarse)').matches;
if(coarse) document.documentElement.classList.add('coarse');
const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
/* built-in games number their parts the same way on every computer, so players' copies match */
let UIDDET=null;
const uid=()=>UIDDET?UIDDET.p+(UIDDET.n++).toString(36):'n'+Math.random().toString(36).slice(2,10);
const r3=v=>Math.round(v*1000)/1000;

/* ---------- sound ---------- */
let actx=null, muted=store.get('muted',false);
function beep(f1,f2,dur,type,vol){ if(muted)return; try{ actx=actx||new (window.AudioContext||window.webkitAudioContext)(); const n=actx.currentTime,o=actx.createOscillator(),g=actx.createGain();
  o.type=type||'square'; o.frequency.setValueAtTime(f1,n); o.frequency.exponentialRampToValueAtTime(f2,n+dur);
  g.gain.setValueAtTime(vol||.06,n); g.gain.exponentialRampToValueAtTime(.0001,n+dur); o.connect(g); g.connect(actx.destination); o.start(n); o.stop(n+dur+.02);}catch(e){} }
const SFX={
  jump:()=>beep(320,620,.11,'square',.035),
  coin:()=>{beep(988,1319,.08,'square',.045);setTimeout(()=>beep(1319,1760,.14,'square',.045),70)},
  die:()=>beep(420,70,.45,'sawtooth',.06),
  splash:()=>beep(600,120,.3,'triangle',.08),
  check:()=>{beep(523,523,.08,'square',.05);setTimeout(()=>beep(784,784,.16,'square',.05),90)},
  pad:()=>beep(180,980,.22,'triangle',.08),
  boost:()=>beep(300,1400,.25,'sawtooth',.04),
  win:()=>[523,659,784,1047].forEach((f,i)=>setTimeout(()=>beep(f,f,.2,'square',.05),i*130)),
  place:()=>beep(240,170,.06,'square',.045),
  del:()=>beep(160,90,.08,'square',.045),
  nope:()=>beep(140,120,.12,'square',.04),
  click:()=>beep(700,500,.05,'square',.04),
  explode:()=>{beep(160,35,.55,'sawtooth',.05);boomNoise(.6,900,.22);},
  heart:()=>{beep(95,55,.13,'sine',.16);setTimeout(()=>beep(85,50,.11,'sine',.12),150);}
};
function boomNoise(dur,freq,vol){if(muted)return;try{actx=actx||new (window.AudioContext||window.webkitAudioContext)();const n=actx.currentTime,len=Math.floor(actx.sampleRate*dur),b=actx.createBuffer(1,len,actx.sampleRate),d=b.getChannelData(0);
  for(let i=0;i<len;i++)d[i]=(Math.random()*2-1)*Math.pow(1-i/len,2);const src=actx.createBufferSource(),f=actx.createBiquadFilter(),g=actx.createGain();src.buffer=b;f.type='lowpass';f.frequency.setValueAtTime(freq,n);f.frequency.exponentialRampToValueAtTime(120,n+dur);
  g.gain.setValueAtTime(vol,n);g.gain.exponentialRampToValueAtTime(.0001,n+dur);src.connect(f);f.connect(g);g.connect(actx.destination);src.start(n);}catch(e){}}

/* ---------- background music: a small chiptune band (bass, chords, lead, drums), a different mood per kind of game ---------- */
const MUSIC={on:store.get('musicOn',true),playing:false,timer:null,step:0,next:0,gain:null,style:null,rng:null,mel:[]};
const MSTYLES={
  battle:{bpm:138,minor:true,root:45,prog:[0,5,3,4],drums:'rock',lead:'square',bass:'saw',vol:0.08},
  party:{bpm:126,minor:false,root:48,prog:[0,4,5,3],drums:'bounce',lead:'square',bass:'square',vol:0.072},
  obby:{bpm:112,minor:false,root:50,prog:[0,3,4,0],drums:'light',lead:'triangle',bass:'triangle',vol:0.072},
  race:{bpm:152,minor:true,root:47,prog:[0,5,6,4],drums:'rock',lead:'square',bass:'saw',vol:0.072},
  horror:{bpm:72,minor:true,root:40,prog:[0,1,0,6],drums:'none',lead:'sine',bass:'sine',vol:0.087},
  survival:{bpm:120,minor:true,root:43,prog:[0,6,5,4],drums:'light',lead:'triangle',bass:'saw',vol:0.072},
  build:{bpm:96,minor:false,root:53,prog:[0,5,3,4],drums:'light',lead:'triangle',bass:'triangle',vol:0.058}};
function musicStyleFor(g){if(!g||g.fromEditor)return null;const id=g.id;const m=GAMES.find(x=>x.id===id);if(!m)return null;
  if(id==='doors'||id==='ghost'||id==='maze')return 'horror';if(id==='sandbox')return 'build';if(id==='sky'||id==='turbo')return 'race';
  const c=m.cat||({tower:'Obby',coins:'Collect',arena:'Battle'})[id]||'Party';
  return c==='Battle'?'battle':c==='Obby'?'obby':c==='Race'?'race':c==='Survival'?'survival':c==='Puzzle'?'obby':'party';}
const midi=n=>440*Math.pow(2,(n-69)/12);
function mNote(t0,f,dur,type,vol,dest){const o=actx.createOscillator(),g=actx.createGain();o.type=type==='saw'?'sawtooth':type;o.frequency.setValueAtTime(f,t0);
  g.gain.setValueAtTime(0.0001,t0);g.gain.linearRampToValueAtTime(vol,t0+.01);g.gain.exponentialRampToValueAtTime(.0001,t0+dur);o.connect(g);g.connect(dest);o.start(t0);o.stop(t0+dur+.03);}
let NOISE=null;function noiseBuf(){if(NOISE)return NOISE;const b=actx.createBuffer(1,actx.sampleRate*.5,actx.sampleRate),d=b.getChannelData(0);for(let i=0;i<d.length;i++)d[i]=Math.random()*2-1;return NOISE=b;}
function mDrum(t0,kind,dest){if(kind==='kick'){const o=actx.createOscillator(),g=actx.createGain();o.frequency.setValueAtTime(150,t0);o.frequency.exponentialRampToValueAtTime(45,t0+.12);
    g.gain.setValueAtTime(.9,t0);g.gain.exponentialRampToValueAtTime(.001,t0+.16);o.connect(g);g.connect(dest);o.start(t0);o.stop(t0+.2);return;}
  const s=actx.createBufferSource();s.buffer=noiseBuf();const f=actx.createBiquadFilter(),g=actx.createGain();
  if(kind==='hat'){f.type='highpass';f.frequency.value=7000;g.gain.setValueAtTime(.25,t0);g.gain.exponentialRampToValueAtTime(.001,t0+.04);}
  else{f.type='bandpass';f.frequency.value=1800;g.gain.setValueAtTime(.55,t0);g.gain.exponentialRampToValueAtTime(.001,t0+.13);}
  s.connect(f);f.connect(g);g.connect(dest);s.start(t0);s.stop(t0+.2);}
function musicStartStyle(st){musicStart({id:'_custom_'+st},st);}
function musicStart(g,force){musicStop();const st=force||musicStyleFor(g);if(!st||!MSTYLES[st]||!MUSIC.on||muted)return;
  try{actx=actx||new (window.AudioContext||window.webkitAudioContext)();if(actx.state==='suspended')actx.resume();}catch(e){return;}
  const S=MSTYLES[st];MUSIC.style=S;MUSIC.rng=mulberry(hashStr(g.id+'tune'));MUSIC.gain=actx.createGain();MUSIC.gain.gain.value=0;MUSIC.gain.connect(actx.destination);
  MUSIC.gain.gain.linearRampToValueAtTime(S.vol,actx.currentTime+1.5);
  const r=MUSIC.rng;MUSIC.mel=Array.from({length:4},()=>Array.from({length:16},(_,i)=>{const x=r();return x<(S.drums==='none'?.25:.55)?[0,2,4,7,4,2,9,7][Math.floor(r()*8)]:null;}));
  MUSIC.step=0;MUSIC.next=actx.currentTime+.1;MUSIC.playing=true;MUSIC.timer=setInterval(musicTick,90);}
function musicStop(){if(MUSIC.timer)clearInterval(MUSIC.timer);MUSIC.timer=null;MUSIC.playing=false;
  if(MUSIC.gain){const g=MUSIC.gain;try{g.gain.cancelScheduledValues(actx.currentTime);g.gain.setValueAtTime(g.gain.value,actx.currentTime);g.gain.linearRampToValueAtTime(0,actx.currentTime+.4);setTimeout(()=>{try{g.disconnect();}catch(e){}},600);}catch(e){}MUSIC.gain=null;}}
function musicDuck(on){if(!MUSIC.gain||!MUSIC.style)return;try{const v=on?MUSIC.style.vol*.3:MUSIC.style.vol;MUSIC.gain.gain.setTargetAtTime(v,actx.currentTime,.2);}catch(e){}}
function musicTick(){if(!MUSIC.playing||!actx||!MUSIC.gain)return;const S=MUSIC.style,sp=60/S.bpm/4,dest=MUSIC.gain;
  const scale=S.minor?[0,2,3,5,7,8,10]:[0,2,4,5,7,9,11];const deg=n=>{const o=Math.floor(n/7);return scale[((n%7)+7)%7]+12*o;};
  while(MUSIC.next<actx.currentTime+.25){const t0=MUSIC.next,st=MUSIC.step,bar=Math.floor(st/16)%4,i=st%16,ch=S.prog[bar];
    const root=S.root+deg(ch);
    if(S.drums!=='none'){if(S.drums==='rock'){if(i%4===0)mDrum(t0,'kick',dest);if(i%8===4)mDrum(t0,'snare',dest);if(i%2===0)mDrum(t0,'hat',dest);}
      else if(S.drums==='bounce'){if(i%4===0||i===10)mDrum(t0,'kick',dest);if(i%8===4)mDrum(t0,'snare',dest);if(i%4===2)mDrum(t0,'hat',dest);}
      else{if(i===0||i===8)mDrum(t0,'kick',dest);if(i%4===2)mDrum(t0,'hat',dest);}}
    if(S.drums==='none'){if(i===0)mNote(t0,midi(root-12),sp*15,S.bass,.32,dest);if(i===8&&bar%2)mNote(t0,midi(root+deg(ch+4)-deg(ch)+12),sp*6,'sine',.12,dest);}
    else{if(i%2===0)mNote(t0,midi(root-12+(i%8===6?7:0)),sp*1.7,S.bass,.22,dest);
      if(i%8===0)[0,2,4].forEach(k=>mNote(t0,midi(S.root+12+deg(ch+k)),sp*3.5,'triangle',.06,dest));}
    const m=MUSIC.mel[bar][i];if(m!=null&&!(MUSIC.step>=64&&MUSIC.step<128&&i%4===3))mNote(t0,midi(S.root+24+deg(ch+m)),sp*(S.drums==='none'?6:1.6),S.lead,S.drums==='none'?.07:.09,dest);
    MUSIC.next+=sp;MUSIC.step=(MUSIC.step+1)%256;}}

/* ---------- helpers ---------- */
function hashStr(s){let h=2166136261;for(let i=0;i<s.length;i++){h^=s.charCodeAt(i);h=Math.imul(h,16777619);}return h|0;}
function mulberry(a){return function(){a|=0;a=a+0x6D2B79F5|0;let t=Math.imul(a^a>>>15,1|a);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296}}
const fmt=s=>{s=Math.max(0,s);const m=Math.floor(s/60),r=s-m*60;return m+':'+(r<10?'0':'')+r.toFixed(1)};
const SHIRTS=['#e53935','#1e88e5','#43a047','#fb8c00','#8e24aa','#00acc1','#fdd835','#263238'];
let shirt=store.get('shirt',SHIRTS[1]);
const toHex=c=>'#'+new THREE.Color(c).getHexString();

/* ---------- renderer ---------- */
const cv=$('#cv');
const renderer=new THREE.WebGLRenderer({canvas:cv,antialias:true});
renderer.setPixelRatio(Math.min(devicePixelRatio,2));
renderer.shadowMap.enabled=true; renderer.shadowMap.type=THREE.PCFSoftShadowMap;
const camera=new THREE.PerspectiveCamera(70,1,.1,2500);
function resize(){const w=innerWidth,h=innerHeight;renderer.setSize(w,h,false);camera.aspect=w/h;camera.updateProjectionMatrix();}
addEventListener('resize',resize); resize();

const BOX=new THREE.BoxGeometry(1,1,1);
const SPH=new THREE.SphereGeometry(.5,22,14);
const CYLX=new THREE.CylinderGeometry(.5,.5,1,28).rotateZ(Math.PI/2);
const CYLY=new THREE.CylinderGeometry(.5,.5,1,32);
const COIN=new THREE.CylinderGeometry(1.15,1.15,.3,28).rotateX(Math.PI/2);
const WEDGE=(()=>{const A=[-.5,-.5,-.5],B=[.5,-.5,-.5],C=[.5,-.5,.5],D=[-.5,-.5,.5],E=[-.5,.5,.5],F=[.5,.5,.5];
  const tris=[A,B,C,A,C,D,D,C,F,D,F,E,A,F,B,A,E,F,A,D,E,B,F,C];const g=new THREE.BufferGeometry();
  g.setAttribute('position',new THREE.Float32BufferAttribute(tris.flat(),3));
  g.setAttribute('uv',new THREE.Float32BufferAttribute(tris.flatMap(p=>[p[0]+.5,p[2]+.5]),2));g.computeVertexNormals();return g;})();
[BOX,SPH,CYLX,CYLY,COIN,WEDGE].forEach(g=>g.userData.shared=true);
const COINMAT=new THREE.MeshStandardMaterial({color:0xffc72c,metalness:.6,roughness:.3,emissive:0x5a3a00,emissiveIntensity:.5}); COINMAT.userData.shared=true;

const matCache=new Map();
function mat(color,o){o=o||{};const key=[String(color),o.neon?1:0,o.transp||0,o.metal||0].join('|');
  if(matCache.has(key))return matCache.get(key);
  const m=new THREE.MeshStandardMaterial({color:new THREE.Color(color),roughness:o.metal?.35:.82,metalness:o.metal||0});
  if(o.neon){m.emissive=new THREE.Color(color);m.emissiveIntensity=.7;}
  if(o.transp){m.transparent=true;m.opacity=Math.max(.06,1-o.transp);m.depthWrite=o.transp<.5;}
  m.userData.shared=true; matCache.set(key,m); return m;}
function makeTex(draw){const c=document.createElement('canvas');c.width=c.height=64;draw(c.getContext('2d'));const t=new THREE.CanvasTexture(c);t.wrapS=t.wrapT=THREE.RepeatWrapping;t.anisotropy=4;t.userData={shared:true};return t;}
const TEX={
  studs:makeTex(g=>{g.fillStyle='#d4d4d4';g.fillRect(0,0,64,64);g.fillStyle='#e8e8e8';g.fillRect(2,2,60,60);g.fillStyle='rgba(255,255,255,.55)';g.beginPath();g.arc(32,32,14,0,7);g.fill();g.strokeStyle='rgba(0,0,0,.1)';g.lineWidth=2;g.stroke();}),
  wood:makeTex(g=>{g.fillStyle='#e9dcc6';g.fillRect(0,0,64,64);for(let i=0;i<9;i++){g.strokeStyle=`rgba(90,60,30,${.08+((i*37)%5)/40})`;g.lineWidth=1+(i%3);g.beginPath();g.moveTo(0,i*7+3);g.bezierCurveTo(20,i*7+6,44,i*7,64,i*7+3);g.stroke();}}),
  brick:makeTex(g=>{g.fillStyle='#bdbdbd';g.fillRect(0,0,64,64);g.fillStyle='#ececec';for(let r=0;r<4;r++)for(let c=-1;c<2;c++){const o=r%2?16:0;g.fillRect(c*32+o+1,r*16+1,30,14);}}),
  grass:makeTex(g=>{g.fillStyle='#e0e0e0';g.fillRect(0,0,64,64);for(let i=0;i<160;i++){g.fillStyle=`rgba(${i%2?255:140},${i%2?255:140},${i%2?255:140},.25)`;g.fillRect((i*29)%64,(i*47)%64,2,3);}})
};
const MATERIALS=['Plastic','Studs','Neon','Metal','Glass','Wood','Brick','Grass'];
function lookMat(look,size){
  const mname=look.material||'Plastic';const tex=look.vc?null:TEX[mname.toLowerCase()];
  if(look.vc){const t_=mname==='Glass'?Math.max(look.transparency||0,.45):(look.transparency||0);
    const m=new THREE.MeshStandardMaterial({color:new THREE.Color(look.color),vertexColors:true,roughness:mname==='Metal'?.35:.8,metalness:mname==='Metal'?.6:0});
    if(t_){m.transparent=true;m.opacity=Math.max(.06,1-t_);m.depthWrite=t_<.5;}if(mname==='Neon'||look.neon){m.emissive=new THREE.Color(look.color);m.emissiveIntensity=.5;}return m;}
  const transp=mname==='Glass'?Math.max(look.transparency||0,.45):(look.transparency||0);
  const neon=mname==='Neon'||look.neon;
  if(!tex)return mat(look.color,{neon,transp,metal:mname==='Metal'?.3:mname==='Glass'?.2:0});
  const m=new THREE.MeshStandardMaterial({color:new THREE.Color(look.color),roughness:.88});
  m.map=tex.clone();m.map.userData={};m.map.needsUpdate=true;const r=mname==='Studs'?2:8;
  m.map.repeat.set(Math.max(1,(size[0]||4)/r),Math.max(1,(size[2]||4)/r));
  if(transp){m.transparent=true;m.opacity=Math.max(.06,1-transp);m.depthWrite=transp<.5;}
  if(neon){m.emissive=new THREE.Color(look.color);m.emissiveIntensity=.6;}
  return m;
}
const faceMat=(()=>{const c=document.createElement('canvas');c.width=c.height=128;const g=c.getContext('2d');
  g.fillStyle='#f5cd30';g.fillRect(0,0,128,128);g.fillStyle='#1b1b1b';
  g.beginPath();g.ellipse(44,52,7,11,0,0,7);g.ellipse(84,52,7,11,0,0,7);g.fill();
  g.lineWidth=7;g.lineCap='round';g.strokeStyle='#1b1b1b';g.beginPath();g.arc(64,70,26,.25*Math.PI,.75*Math.PI);g.stroke();
  const t=new THREE.CanvasTexture(c);const m=new THREE.MeshStandardMaterial({map:t,roughness:.8});m.userData.shared=true;return m;})();
const gridMat=(()=>{const t=TEX.studs.clone();t.needsUpdate=true;t.repeat.set(64,64);const m=new THREE.MeshStandardMaterial({map:t,roughness:.9,color:0x8494a2});m.userData.shared=true;return m;})();

/* ---------- text sprites (name tags, speech bubbles) ---------- */
function setPartLabel(p,text){if(!W.labels)W.labels=[];let L=W.labels.find(x=>x.p===p);
  if(L){scene.remove(L.s);L.s.material.map.dispose();L.s.material.dispose();W.labels.splice(W.labels.indexOf(L),1);}
  text=String(text??'').slice(0,120);if(!text.trim())return;const sp=textSprite(text);sp.scale.multiplyScalar(.8);scene.add(sp);W.labels.push({p,s:sp});}
function textSprite(text,o){o=o||{};const fs=40,pad=o.bubble?22:6;const c=document.createElement('canvas');const g=c.getContext('2d');
  g.font=`800 ${fs}px Figtree, system-ui, sans-serif`;const lines=String(text).slice(0,120).match(/.{1,26}(\s|$)/g)||[String(text)];
  const w=Math.min(1024,Math.ceil(Math.max(...lines.map(l=>g.measureText(l.trim()).width))+pad*2)),h=Math.ceil(lines.length*fs*1.2+pad*2+(o.bubble?14:0));
  c.width=w;c.height=h;g.font=`800 ${fs}px Figtree, system-ui, sans-serif`;g.textAlign='center';g.textBaseline='top';
  if(o.bubble){g.fillStyle='#fff';const r=22,bh=h-14;g.beginPath();g.moveTo(r,0);g.arcTo(w,0,w,bh,r);g.arcTo(w,bh,0,bh,r);g.lineTo(w/2+14,bh);g.lineTo(w/2,h);g.lineTo(w/2-14,bh);g.arcTo(0,bh,0,0,r);g.arcTo(0,0,w,0,r);g.fill();g.fillStyle='#16203a';}
  else{g.lineWidth=8;g.strokeStyle='rgba(0,0,0,.55)';g.fillStyle='#fff';lines.forEach((l,i)=>g.strokeText(l.trim(),w/2,pad+i*fs*1.2));}
  lines.forEach((l,i)=>g.fillText(l.trim(),w/2,pad+i*fs*1.2));
  const t=new THREE.CanvasTexture(c);const sp=new THREE.Sprite(new THREE.SpriteMaterial({map:t,depthTest:!o.bubble,transparent:true}));
  const k=o.bubble?.022:.02;sp.scale.set(w*k,h*k,1);sp.renderOrder=o.bubble?10:5;return sp;}

/* ---------- rigs ---------- */
const faceDecal=(()=>{const c=document.createElement('canvas');c.width=c.height=128;const g=c.getContext('2d');g.fillStyle='#1b1b1b';
  g.beginPath();g.ellipse(44,52,7,11,0,0,7);g.ellipse(84,52,7,11,0,0,7);g.fill();g.lineWidth=7;g.lineCap='round';g.strokeStyle='#1b1b1b';g.beginPath();g.arc(64,70,26,.25*Math.PI,.75*Math.PI);g.stroke();
  const m=new THREE.MeshBasicMaterial({map:new THREE.CanvasTexture(c),transparent:true,alphaTest:.4});m.userData.shared=true;return m;})();
const PLANE=new THREE.PlaneGeometry(1,1);PLANE.userData.shared=true;
const RIG_ANIMS=[['idle','Idle'],['wave','Wave'],['dance','Dance'],['cheer','Cheer'],['point','Point'],['sit','Sit']];
const BOT_NAMES=['Bricky','Blocko','Pixel','Noodle','Waffle','Zapp','Pebble','Biscuit','Rocket','Mango','Sprocket','Gizmo','Tofu','Comet','Pickle','Dynamo'];
function botDisp(nm){return String(nm??'').replace(/\b(?:Bot|Fighter)(\d{1,2})\b/g,(m,d)=>BOT_NAMES[(+d-1+BOT_NAMES.length)%BOT_NAMES.length]+' (bot)');}
function makeRigMesh(n){
  const c=n.colors||{},s=n.scale||1;const g=new THREE.Group();const body=new THREE.Group();g.add(body);
  const bx=(w,h,d,m,x,y,z,parent)=>{const me=new THREE.Mesh(BOX,m);me.scale.set(w,h,d);me.position.set(x,y,z);me.castShadow=true;me.receiveShadow=true;parent.add(me);return me;};
  const torso=bx(2,2,1,mat(c.torso||'#1e88e5'),0,.5,0,body);
  const head=bx(1.25,1.25,1.25,mat(c.head||'#f5cd30'),0,2.1,0,body);
  const face=new THREE.Mesh(PLANE,faceDecal);face.position.set(0,0,.504);face.scale.set(.96,.96,1);head.add(face);
  const pv=(x,y)=>{const p=new THREE.Group();p.position.set(x,y,0);body.add(p);return p;};
  const lArm=pv(-1.5,1.4),rArm=pv(1.5,1.4),lLeg=pv(-.5,-.5),rLeg=pv(.5,-.5);
  const am=mat(c.arms||'#f5cd30'),lm=mat(c.legs||'#2b3a7a');
  bx(1,2,1,am,0,-.9,0,lArm);bx(1,2,1,am,0,-.9,0,rArm);bx(1,2,1,lm,0,-1,0,lLeg);bx(1,2,1,lm,0,-1,0,rLeg);
  if(n.showName!==false&&n.name){const tag=textSprite(botDisp(n.name));tag.position.set(0,3.5,0);g.add(tag);}
  if(/^(?:Bot|Fighter)\d{1,2}$/.test(n.name||'')&&typeof avAccessory==='function'){try{const H=['cap','beanie','party','cowboy','propeller','wizard','viking','pirate','catears','headphones','tophat','chef'];
    body.add(avAccessory(H[(hashStr(botDisp(n.name))>>>0)%H.length]));}catch(e){}}
  g.scale.setScalar(s);g.userData.id=n.id;g.traverse(o=>{if(o.isMesh)o.userData.id=n.id;});
  g.userData.rig={body,torso,head,lArm,rArm,lLeg,rLeg};
  return g;
}
function animateRig(u,anim,tt,moving,dt){
  let la=0,ra=0,ll=0,rl=0,laz=0,raz=0,by=0;
  if(moving){const sw=Math.sin(tt*9)*.9;ll=sw;rl=-sw;la=-sw;ra=sw;}
  else switch(anim){
    case 'wave':raz=2.7+Math.sin(tt*9)*.35;la=Math.sin(tt*2)*.05;break;
    case 'dance':la=-2.8+Math.sin(tt*6)*.45;ra=-2.8+Math.sin(tt*6+Math.PI)*.45;by=Math.abs(Math.sin(tt*6))*.35;ll=Math.sin(tt*6)*.35;rl=-ll;break;
    case 'cheer':la=ra=-2.9+Math.sin(tt*10)*.25;by=Math.abs(Math.sin(tt*10))*.3;break;
    case 'point':ra=-1.55;break;
    case 'sit':ll=rl=-1.55;by=-1;la=ra=-.45;break;
    default:la=Math.sin(tt*2)*.06;ra=-la;
  }
  const k=Math.min(1,dt*12),L=(o,ax,v)=>{o.rotation[ax]+=(v-o.rotation[ax])*k;};
  L(u.lArm,'x',la);L(u.rArm,'x',ra);L(u.lLeg,'x',ll);L(u.rLeg,'x',rl);L(u.lArm,'z',laz);L(u.rArm,'z',raz);
  u.body.position.y+=(by-u.body.position.y)*k;
}

/* ---------- keyframe animations ---------- */
const JOINTS=[['Body','Whole body'],['Head','Head'],['LeftArm','Left arm'],['RightArm','Right arm'],['LeftLeg','Left leg'],['RightLeg','Right leg']];
const JNAMES=['Body','Head','LeftArm','RightArm','LeftLeg','RightLeg','Root'];
const EASES=[['smooth','Smooth'],['linear','Linear'],['bounce','Bounce'],['elastic','Elastic'],['constant','Snap']];
const EASEF={linear:f=>f,smooth:f=>f*f*(3-2*f),constant:f=>f<1?0:1,
  bounce:f=>{const n=7.5625,d=2.75;if(f<1/d)return n*f*f;if(f<2/d)return n*(f-=1.5/d)*f+.75;if(f<2.5/d)return n*(f-=2.25/d)*f+.9375;return n*(f-=2.625/d)*f+.984375;},
  elastic:f=>f<=0?0:f>=1?1:Math.pow(2,-10*f)*Math.sin((f*10-.75)*(2*Math.PI)/3)+1};
const AK=(t,pose,ease)=>({t,ease:ease||'smooth',pose});
const BUILTIN_ANIMS={
  wave:{name:'Wave',length:1.2,loop:true,keys:[AK(0,{RightArm:[0,0,150]}),AK(.3,{RightArm:[0,0,118]}),AK(.6,{RightArm:[0,0,150]}),AK(.9,{RightArm:[0,0,118]}),AK(1.2,{RightArm:[0,0,150]})]},
  dance:{name:'Dance',length:1,loop:true,keys:[AK(0,{Body:[0,15,0],LeftArm:[-134,0,0],RightArm:[-186,0,0],LeftLeg:[20,0,0],RightLeg:[-20,0,0]}),AK(.25,{LeftArm:[-160,0,0],RightArm:[-160,0,0],Root:[0,.35,0]}),
    AK(.5,{Body:[0,-15,0],LeftArm:[-186,0,0],RightArm:[-134,0,0],LeftLeg:[-20,0,0],RightLeg:[20,0,0]}),AK(.75,{LeftArm:[-160,0,0],RightArm:[-160,0,0],Root:[0,.35,0]}),AK(1,{Body:[0,15,0],LeftArm:[-134,0,0],RightArm:[-186,0,0],LeftLeg:[20,0,0],RightLeg:[-20,0,0]})]},
  cheer:{name:'Cheer',length:.6,loop:true,keys:[AK(0,{LeftArm:[-166,0,-10],RightArm:[-166,0,10]}),AK(.3,{LeftArm:[-180,0,-28],RightArm:[-180,0,28],Root:[0,.3,0]},'bounce'),AK(.6,{LeftArm:[-166,0,-10],RightArm:[-166,0,10]})]},
  point:{name:'Point',length:1,loop:true,keys:[AK(0,{RightArm:[-90,0,0],Head:[0,-8,0]}),AK(1,{RightArm:[-90,0,0],Head:[0,-8,0]})]},
  sit:{name:'Sit',length:1,loop:true,keys:[AK(0,{LeftLeg:[-90,0,0],RightLeg:[-90,0,0],LeftArm:[-25,0,0],RightArm:[-25,0,0],Root:[0,-1,0]}),AK(1,{LeftLeg:[-90,0,0],RightLeg:[-90,0,0],LeftArm:[-25,0,0],RightArm:[-25,0,0],Root:[0,-1,0]})]},
  bow:{name:'Bow',length:1.6,loop:false,keys:[AK(0,{}),AK(.5,{Body:[35,0,0],LeftLeg:[-35,0,0],RightLeg:[-35,0,0],RightArm:[-25,0,0]}),AK(1.1,{Body:[35,0,0],LeftLeg:[-35,0,0],RightLeg:[-35,0,0],RightArm:[-25,0,0]}),AK(1.6,{})]},
  jumpingjacks:{name:'Jumping jacks',length:.8,loop:true,keys:[AK(0,{}),AK(.4,{LeftArm:[0,0,-160],RightArm:[0,0,160],LeftLeg:[0,0,-22],RightLeg:[0,0,22],Root:[0,.6,0]}),AK(.8,{})]},
  spin:{name:'Spin',length:1,loop:false,keys:[AK(0,{},'linear'),AK(.5,{Body:[0,180,0],LeftArm:[0,0,-80],RightArm:[0,0,80],Root:[0,.5,0]},'linear'),AK(1,{Body:[0,360,0]},'linear')]},
  flex:{name:'Flex',length:1.4,loop:false,keys:[AK(0,{}),AK(.35,{LeftArm:[0,0,-90],RightArm:[0,0,90]}),AK(.6,{LeftArm:[-20,0,-90],RightArm:[-20,0,90],Head:[-10,0,0]},'bounce'),AK(1.1,{LeftArm:[-20,0,-90],RightArm:[-20,0,90],Head:[-10,0,0]}),AK(1.4,{})]},
  idle:{name:'Idle',length:3,loop:true,keys:[AK(0,{}),AK(1.5,{LeftArm:[0,0,-5],RightArm:[0,0,5],Head:[5,0,0],Root:[0,-.05,0]}),AK(3,{})]},
  walk:{name:'Walk',length:.8,loop:true,keys:[AK(0,{LeftArm:[35,0,0],RightArm:[-35,0,0],LeftLeg:[-35,0,0],RightLeg:[35,0,0]}),AK(.4,{LeftArm:[-35,0,0],RightArm:[35,0,0],LeftLeg:[35,0,0],RightLeg:[-35,0,0]}),AK(.8,{LeftArm:[35,0,0],RightArm:[-35,0,0],LeftLeg:[-35,0,0],RightLeg:[35,0,0]})]},
  jump:{name:'Jump',length:.5,loop:false,keys:[AK(0,{LeftArm:[-170,0,-10],RightArm:[-170,0,10],LeftLeg:[-20,0,0],RightLeg:[10,0,0]}),AK(.5,{LeftArm:[-150,0,-20],RightArm:[-150,0,20],LeftLeg:[-30,0,0],RightLeg:[15,0,0]})]}
};
const EMOTE_KEYS=['wave','dance','cheer','point','sit','bow','jumpingjacks','spin','flex'];
const Z3=[0,0,0];
function cleanPose(p){const o={};if(p&&typeof p==='object')for(const j of JNAMES){const v=p[j];if(Array.isArray(v)&&v.length===3)o[j]=v.map(x=>Math.max(-720,Math.min(720,num(x,0))));}return o;}
function animData(n){
  const len=Math.max(.1,Math.min(30,num(n.length,2)));
  const keys=(Array.isArray(n.keys)?n.keys:[]).filter(k=>k&&typeof k==='object').slice(0,300).map(k=>({t:Math.max(0,Math.min(len,num(k.t,0))),ease:EASEF[k.ease]?k.ease:'smooth',pose:cleanPose(k.pose)})).sort((a,b)=>a.t-b.t);
  return {name:String(n.name||'Animation').slice(0,40),length:len,loop:n.loop!==false&&!!n.loop,speed:Math.max(.05,Math.min(10,num(n.speed,1))),stopOnMove:!!n.stopOnMove,keys:keys.length?keys:[{t:0,ease:'smooth',pose:{}}]};
}
let BUILTIN_DATA=null;function BD(){if(!BUILTIN_DATA){BUILTIN_DATA={};for(const k in BUILTIN_ANIMS)BUILTIN_DATA[k]=animData(BUILTIN_ANIMS[k]);}return BUILTIN_DATA;}
function sampleAnim(a,time){
  const ks=a.keys,out={};let A,B,f=0;
  if(time<=ks[0].t){A=B=ks[0];}else if(time>=ks[ks.length-1].t){A=B=ks[ks.length-1];}
  else{let i=0;while(i<ks.length-2&&ks[i+1].t<=time)i++;A=ks[i];B=ks[i+1];f=(EASEF[B.ease]||EASEF.smooth)((time-A.t)/Math.max(1e-6,B.t-A.t));}
  for(const j of JNAMES){const a0=A.pose[j]||Z3,b0=B.pose[j]||Z3;out[j]=[a0[0]+(b0[0]-a0[0])*f,a0[1]+(b0[1]-a0[1])*f,a0[2]+(b0[2]-a0[2])*f];}
  return out;
}
function jointObj(u,j){return j==='Body'?u.body:j==='Head'?u.head:j==='LeftArm'?u.lArm:j==='RightArm'?u.rArm:j==='LeftLeg'?u.lLeg:j==='RightLeg'?u.rLeg:null;}
function applyPose(u,pose,w){
  if(!u||!u.body||w<=0)return;
  for(const j of JNAMES){const v=pose[j];if(!v)continue;
    if(j==='Root'){const ps=u.body.position;ps.x+=(v[0]-ps.x)*w;ps.y+=(v[1]-ps.y)*w;ps.z+=(v[2]-ps.z)*w;continue;}
    const o=jointObj(u,j);if(!o)continue;const r=o.rotation;r.x+=(v[0]*D2R-r.x)*w;r.y+=(v[1]*D2R-r.y)*w;r.z+=(v[2]*D2R-r.z)*w;}
}
function relaxPose(u,k,all){
  if(!u||!u.body)return;const z=(o,ax)=>{o.rotation[ax]+=(0-o.rotation[ax])*k;};
  ['x','y','z'].forEach(a=>{z(u.body,a);z(u.head,a);});u.body.position.x*=1-k;u.body.position.z*=1-k;
  [u.lArm,u.rArm,u.lLeg,u.rLeg].forEach(o=>{z(o,'y');z(o,'z');});if(all)u.body.position.y*=1-k;
}
let ANIM_SEQ=0;
function newAnimState(a,mode,stopOnMove){return {a,name:a.name,t:0,speed:a.speed||1,loop:mode==='loop'?true:mode==='auto'?a.loop:false,stopOnMove:stopOnMove==null?a.stopOnMove:stopOnMove,w:0,out:false,net:a.name+'|'+(++ANIM_SEQ),done:null};}
function stepAnim(st,dt,moving){
  if(!st)return null;
  if(st.stopOnMove&&moving&&st.t>.15)st.out=true;
  if(st.out){st.w-=dt*6;if(st.w<=0){if(st.done){st.done();st.done=null;}return null;}}else st.w=Math.min(1,st.w+dt*6);
  st.t+=dt*st.speed;const L=st.a.length;
  if(st.t>=L){if(st.loop)st.t%=L;else{st.t=L;st.out=true;}}
  return st;
}
function findAnim(name){const k=String(name||'').trim().toLowerCase();if(!k)return null;return (W.anims&&W.anims.get(k))||BD()[k.replace(/[\s_-]/g,'')]||null;}
function playAnim(target,a,mode,stopOnMove){
  const cur=target==='me'?P.anim:target.animPlay;if(cur&&cur.done){cur.done();cur.done=null;}
  const st=newAnimState(a,mode,stopOnMove);if(cur)st.w=cur.w;
  if(target==='me'){P.anim=st;MP.lastSent='';}else target.animPlay=st;return st;
}
function stopAnim(target){const cur=target==='me'?P.anim:target.animPlay;if(cur)cur.out=true;if(target==='me')MP.lastSent='';}

/* ---------- particles ---------- */
const PU={scale:{value:600}};
const PTEX={};
function ptex(name){if(PTEX[name])return PTEX[name];const c=document.createElement('canvas');c.width=c.height=64;const g=c.getContext('2d');
  const rad=(a,b)=>{const gr=g.createRadialGradient(32,32,0,32,32,32);gr.addColorStop(0,`rgba(255,255,255,${a})`);gr.addColorStop(b,`rgba(255,255,255,${a*.6})`);gr.addColorStop(1,'rgba(255,255,255,0)');g.fillStyle=gr;g.fillRect(0,0,64,64);};
  if(name==='star'){rad(.5,.2);g.fillStyle='#fff';g.beginPath();for(let i=0;i<10;i++){const r=i%2?9:28,a=i*Math.PI/5-Math.PI/2;g.lineTo(32+Math.cos(a)*r,32+Math.sin(a)*r);}g.fill();}
  else if(name==='square'){g.fillStyle='#fff';g.fillRect(12,18,40,28);}
  else if(name==='smoke'){rad(.55,.45);}
  else if(name==='spark'){rad(1,.15);}
  else if(name==='heart'){g.fillStyle='#fff';g.beginPath();g.moveTo(32,54);g.bezierCurveTo(-6,28,14,2,32,20);g.bezierCurveTo(50,2,70,28,32,54);g.fill();}
  else rad(1,.55);
  const t=new THREE.CanvasTexture(c);t.userData={shared:true};PTEX[name]=t;return t;}
const P_VS='attribute float psize;attribute vec4 pcol;varying vec4 vC;uniform float scale;void main(){vC=pcol;vec4 mv=modelViewMatrix*vec4(position,1.0);gl_PointSize=psize*scale/max(.1,-mv.z);gl_Position=projectionMatrix*mv;}';
const P_FS='uniform sampler2D tex;varying vec4 vC;void main(){vec4 t=texture2D(tex,gl_PointCoord);gl_FragColor=vec4(vC.rgb*t.rgb,vC.a*t.a);if(gl_FragColor.a<.01)discard;}';
const PDIRS={Top:[0,1,0],Bottom:[0,-1,0],Front:[0,0,-1],Back:[0,0,1],Right:[1,0,0],Left:[-1,0,0]};
const PSHAPES=[['circle','Soft circle'],['spark','Spark'],['star','Star'],['smoke','Smoke puff'],['square','Confetti'],['heart','Heart']];
const PPRESETS={
  sparkles:{shape:'star',color0:'#fff3a0',color1:'#ffd75e',rainbow:false,rate:12,lifeMin:1,lifeMax:1.6,speed:3,spread:180,size0:1,size1:.2,accel:0,glow:true,dir:'Top'},
  fire:{shape:'spark',color0:'#ffb347',color1:'#ff3b1f',rainbow:false,rate:45,lifeMin:.5,lifeMax:1,speed:6,spread:16,size0:2.4,size1:.3,accel:3,glow:true,dir:'Top'},
  smoke:{shape:'smoke',color0:'#a7afbb',color1:'#4a5160',rainbow:false,rate:8,lifeMin:2.2,lifeMax:3.5,speed:3,spread:22,size0:2,size1:6,accel:1,glow:false,dir:'Top'},
  confetti:{shape:'square',color0:'#ffffff',color1:'#ffffff',rainbow:true,rate:30,lifeMin:2,lifeMax:3,speed:16,spread:30,size0:.8,size1:.8,accel:-30,glow:false,dir:'Top'},
  magic:{shape:'star',color0:'#d68cff',color1:'#5cc8ff',rainbow:false,rate:22,lifeMin:1,lifeMax:2,speed:2,spread:180,size0:.9,size1:0,accel:3,glow:true,dir:'Top'},
  snow:{shape:'circle',color0:'#ffffff',color1:'#dfefff',rainbow:false,rate:28,lifeMin:4,lifeMax:6,speed:3,spread:25,size0:.5,size1:.5,accel:0,glow:false,dir:'Bottom'},
  hearts:{shape:'heart',color0:'#ff6b9a',color1:'#ff2d6f',rainbow:false,rate:6,lifeMin:1.5,lifeMax:2.2,speed:3,spread:30,size0:1.2,size1:.4,accel:1,glow:false,dir:'Top'}
};
function randomCone(axis,ang){if(ang<=0)return axis.clone();const cosT=1-Math.random()*(1-Math.cos(Math.min(Math.PI,ang)));const sinT=Math.sqrt(Math.max(0,1-cosT*cosT)),phi=Math.random()*Math.PI*2;
  const v=new V3(sinT*Math.cos(phi),sinT*Math.sin(phi),cosT);return v.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new V3(0,0,1),axis));}
class Emitter{
  constructor(cfg,parent,sc){this.cfg=cfg;this.parent=parent;this.sc=sc;this.acc=0;this.ps=[];this.on=cfg.enabled!==false;this.build();}
  build(){const c=this.cfg;this.max=Math.min(2400,Math.ceil((+c.rate||0)*Math.max(.05,+c.lifeMax||1)*1.25)+300);
    const g=new THREE.BufferGeometry();this.pa=new Float32Array(this.max*3);this.ca=new Float32Array(this.max*4);this.sa=new Float32Array(this.max);
    g.setAttribute('position',new THREE.BufferAttribute(this.pa,3).setUsage(THREE.DynamicDrawUsage));
    g.setAttribute('pcol',new THREE.BufferAttribute(this.ca,4).setUsage(THREE.DynamicDrawUsage));
    g.setAttribute('psize',new THREE.BufferAttribute(this.sa,1).setUsage(THREE.DynamicDrawUsage));g.setDrawRange(0,0);
    const m=new THREE.ShaderMaterial({uniforms:{scale:PU.scale,tex:{value:ptex(c.shape||'circle')}},vertexShader:P_VS,fragmentShader:P_FS,transparent:true,depthWrite:false,
      blending:c.glow?THREE.AdditiveBlending:THREE.NormalBlending});
    this.pts=new THREE.Points(g,m);this.pts.frustumCulled=false;this.pts.renderOrder=3;this.sc.add(this.pts);
    this.c0=new THREE.Color(c.color0||'#ffffff');this.c1=new THREE.Color(c.color1||'#ffffff');}
  emit(n){n=Math.min(500,Math.max(0,Math.floor(n)));for(let i=0;i<n;i++)this.spawn();}
  spawn(){if(this.ps.length>=this.max)return;const c=this.cfg,o=this.parent.mesh;if(!o)return;o.updateMatrixWorld();
    const lp=this.parent.rig?new V3((Math.random()-.5)*2,(Math.random()-.5)*4,(Math.random()-.5)*1):new V3(Math.random()-.5,Math.random()-.5,Math.random()-.5);
    const wp=lp.applyMatrix4(o.matrixWorld);const q=new THREE.Quaternion();o.getWorldQuaternion(q);
    const ax=new V3().fromArray(PDIRS[c.dir]||PDIRS.Top).applyQuaternion(q).normalize();const dir=randomCone(ax,(+c.spread||0)*D2R);
    const lmin=+c.lifeMin||1,lmax=Math.max(lmin,+c.lifeMax||lmin);let c0=this.c0,c1=this.c1;
    if(c.rainbow){c0=new THREE.Color().setHSL(Math.random(),.9,.6);c1=c0;}
    this.ps.push({p:wp,v:dir.multiplyScalar((+c.speed||0)*(.8+Math.random()*.4)),age:0,life:lmin+(lmax-lmin)*Math.random(),c0,c1});}
  update(dt){const c=this.cfg;
    if(this.on&&!this.parent.destroyed){this.acc+=(+c.rate||0)*dt;let n=Math.min(80,Math.floor(this.acc));this.acc-=Math.floor(this.acc);while(n-->0)this.spawn();}
    const ay=+c.accel||0,s0=+c.size0||0,s1=c.size1==null?s0:+c.size1;let k=0;const keep=[];
    for(const q of this.ps){q.age+=dt;if(q.age>=q.life)continue;q.v.y+=ay*dt;q.p.addScaledVector(q.v,dt);keep.push(q);
      const f=q.age/q.life;this.pa[k*3]=q.p.x;this.pa[k*3+1]=q.p.y;this.pa[k*3+2]=q.p.z;
      this.ca[k*4]=q.c0.r+(q.c1.r-q.c0.r)*f;this.ca[k*4+1]=q.c0.g+(q.c1.g-q.c0.g)*f;this.ca[k*4+2]=q.c0.b+(q.c1.b-q.c0.b)*f;
      this.ca[k*4+3]=Math.min(1,q.age/.12)*Math.pow(1-f,.8);this.sa[k]=Math.max(0,s0+(s1-s0)*f);k++;}
    this.ps=keep;const g=this.pts.geometry;g.attributes.position.needsUpdate=true;g.attributes.pcol.needsUpdate=true;g.attributes.psize.needsUpdate=true;g.setDrawRange(0,k);}
  dispose(){this.sc.remove(this.pts);this.pts.geometry.dispose();this.pts.material.dispose();}
}
function setParticleScale(r,cam_){PU.scale.value=r.getDrawingBufferSize(new THREE.Vector2()).y/(2*Math.tan(cam_.fov*D2R/2));}

/* ---------- mesh assets (IndexedDB) ---------- */
const IDB=(()=>{let dbp=null;
  const open=()=>dbp||(dbp=new Promise((res,rej)=>{try{const r=indexedDB.open('brickyard',1);r.onupgradeneeded=()=>r.result.createObjectStore('meshes',{keyPath:'id'});
    r.onsuccess=()=>res(r.result);r.onerror=()=>rej(r.error);}catch(e){rej(e);}}));
  const tx=(mode,fn)=>open().then(db=>new Promise((res,rej)=>{const t=db.transaction('meshes',mode);const req=fn(t.objectStore('meshes'));t.oncomplete=()=>res(req&&req.result);t.onerror=()=>rej(t.error);t.onabort=()=>rej(t.error);}));
  return {put:a=>tx('readwrite',st=>st.put(a)),get:id=>tx('readonly',st=>st.get(id)),all:()=>tx('readonly',st=>st.getAll()),del:id=>tx('readwrite',st=>st.delete(id))};})();
const MESHCACHE=new Map(),MESHINFO=new Map();
function cacheAsset(a){if(MESHCACHE.has(a.id))return MESHCACHE.get(a.id);const g=new THREE.BufferGeometry();
  g.setAttribute('position',new THREE.BufferAttribute(a.pos,3));g.setAttribute('normal',new THREE.BufferAttribute(a.nrm,3,true));
  if(a.col)g.setAttribute('color',new THREE.BufferAttribute(a.col,3,true));g.computeBoundingSphere();g.userData.shared=true;
  MESHCACHE.set(a.id,g);MESHINFO.set(a.id,{name:a.name,tris:a.tris,ext:a.ext,vc:!!a.col});return g;}
function ensureMeshes(proj){const ids=[...new Set(proj.nodes.filter(n=>n.meshId&&!MESHCACHE.has(n.meshId)).map(n=>n.meshId))];
  if(!ids.length)return Promise.resolve();return Promise.all(ids.map(id=>IDB.get(id).then(a=>{if(a)cacheAsset(a);}).catch(()=>{})));}

/* ---------- world ---------- */
let scene=null,sun=null,hemiL=null;
const W={parts:[],solids:[],obbs:[],special:[],coins:[],spinners:[],movers:[],fades:[],phys:[],dyn:new Set(),pulse:new Set(),byName:new Map(),byId:new Map(),models:new Map(),modelsByName:new Map(),rigs:[],emitters:[],pickups:[],projectiles:[],debris:[],spawn:new V3(),checkpoint:null,killY:-60,stages:0};
const _box=new THREE.Box3();
function disposeScene(){scene.traverse(o=>{if(o.geometry&&!o.geometry.userData.shared)o.geometry.dispose();
  if(o.material){(Array.isArray(o.material)?o.material:[o.material]).forEach(m=>{if(!m.userData.shared){if(m.map&&!(m.map.userData||{}).shared)m.map.dispose();m.dispose();}})}});}
/* gradient sky dome with soft clouds by day and stars at night; fog matches the horizon */
let skyDome=null;
const SKY_VS='varying vec3 vD;void main(){vD=normalize(position);gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}';
const SKY_FS=`uniform vec3 top;uniform vec3 hor;uniform vec3 bot;uniform float cloud;uniform float stars;uniform float time;varying vec3 vD;
float h21(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
float h31(vec3 p){return fract(sin(dot(p,vec3(127.1,311.7,74.7)))*43758.5453);}
float vn(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.0-2.0*f);return mix(mix(h21(i),h21(i+vec2(1,0)),f.x),mix(h21(i+vec2(0,1)),h21(i+vec2(1,1)),f.x),f.y);}
float fbm(vec2 p){float a=.5,s=0.;for(int i=0;i<4;i++){s+=a*vn(p);p*=2.03;a*=.5;}return s;}
void main(){vec3 d=normalize(vD);float y=d.y;vec3 c;
 if(y>0.0)c=mix(hor,top,pow(smoothstep(0.0,1.0,y),.55));else c=mix(hor,bot,smoothstep(0.0,0.3,-y));
 if(cloud>0.0&&y>0.015){vec2 uv=d.xz/(y+.15)*1.3+vec2(time*.004,time*.0015);float n=fbm(uv);float m=smoothstep(.52,.78,n)*smoothstep(.015,.22,y);c=mix(c,mix(vec3(1.0),hor,.15),m*cloud*.8);}
 if(stars>0.0&&y>0.0){vec3 q=d*260.0;vec3 id=floor(q);float r=h31(id);float s=step(.9965,r)*max(0.0,1.0-length(fract(q)-.5)*2.4);c+=vec3(stars*s*(.6+.4*sin(time*2.0+r*40.0)));}
 gl_FragColor=vec4(c,1.0);}`;
function makeSkyDome(){const m=new THREE.ShaderMaterial({vertexShader:SKY_VS,fragmentShader:SKY_FS,side:THREE.BackSide,depthWrite:false,depthTest:false,fog:false,
  uniforms:{top:{value:new THREE.Color()},hor:{value:new THREE.Color()},bot:{value:new THREE.Color()},cloud:{value:0},stars:{value:0},time:{value:0}}});
  const d=new THREE.Mesh(new THREE.SphereGeometry(1800,32,16),m);d.renderOrder=-10;d.frustumCulled=false;d.userData.sky=true;return d;}
function setSkyColor(c){c=new THREE.Color(c);const lum=c.r*.3+c.g*.59+c.b*.11;const white=new THREE.Color(1,1,1);
  const hor=lum>.3?c.clone().lerp(white,.38):c.clone().multiplyScalar(1.5).lerp(white,.06);
  if(scene){scene.background=hor.clone();if(scene.fog)scene.fog.color.copy(hor);}
  if(!skyDome)return;const u=skyDome.material.uniforms;u.top.value.copy(c).multiplyScalar(lum>.3?.86:.6);u.hor.value.copy(hor);u.bot.value.copy(hor).multiplyScalar(.82);
  u.cloud.value=lum>.42?1:lum>.28?.45:0;u.stars.value=lum<.16?1:lum<.24?.4:0;}
function newScene(o){o=o||{};
  W.labels=[];
  W.anims=new Map();W.baseAnims=null;W.emotes=[];P.anim=null;Object.assign(P,{magnetUntil:0,frozen:false,hidden:false,shieldUntil:0,airJumps:0,airLeft:0,shirtOverride:null,airT:0,sayText:''});$('#emoteMenu').hidden=true;
  const gl=$('#guiLayer');if(gl)gl.innerHTML='';W.gui=new Map();W.guiByName=new Map();
  if(scene)disposeScene();
  scene=new THREE.Scene();
  const sky=new THREE.Color(o.sky!=null?o.sky:0x9fd8ff);
  scene.background=sky; scene.fog=new THREE.Fog(sky.clone(),o.fogNear||160,o.fogFar||760);
  try{skyDome=makeSkyDome();scene.add(skyDome);setSkyColor(sky);}catch(e){skyDome=null;}
  hemiL=new THREE.HemisphereLight(0xffffff,o.ground!=null?o.ground:0x46506a,.78*(o.brightness||1));scene.add(hemiL);
  sun=new THREE.DirectionalLight(0xffffff,.82*(o.brightness||1)); sun.castShadow=true; sun.shadow.mapSize.set(2048,2048);
  const sc=sun.shadow.camera; sc.left=-80;sc.right=80;sc.top=80;sc.bottom=-80;sc.near=1;sc.far=500; sun.shadow.bias=-.0006;
  scene.add(sun); scene.add(sun.target);
  Object.assign(W,{parts:[],solids:[],obbs:[],special:[],coins:[],spinners:[],movers:[],fades:[],phys:[],dyn:new Set(),pulse:new Set(),byName:new Map(),byId:new Map(),models:new Map(),modelsByName:new Map(),rigs:[],emitters:[],pickups:[],projectiles:[],debris:[],
    spawn:new V3(0,5,0),checkpoint:null,killY:o.killY!=null?o.killY:-60,stages:0});
}
function computeAABB(p){
  if(p.rotated){p.mesh.updateMatrixWorld(true);_box.setFromObject(p.mesh);p.min.copy(_box.min);p.max.copy(_box.max);}
  else{p.min.copy(p.pos).addScaledVector(p.size,-.5);p.max.copy(p.pos).addScaledVector(p.size,.5);}
}
function addPart(o){
  const size=new V3().fromArray(o.size), pos=new V3().fromArray(o.pos), kind=o.kind||'solid';
  const geo=o.geo||(o.shape==='ball'?SPH:o.shape==='cyl'?CYLX:o.shape==='cylY'?CYLY:o.shape==='wedge'?WEDGE:BOX);
  let m=o.material;
  if(!m){
    if(o.look)m=lookMat(o.look,o.size);
    else{const opt={neon:o.neon||kind==='kill',transp:o.transparency||0,metal:o.metal||0};m=mat(o.color!=null?o.color:0xa3a2a5,opt);}
    if(kind==='fade'){m=m.clone();m.transparent=true;m.userData.shared=false;}
  }
  const mesh=new THREE.Mesh(geo,m);
  mesh.scale.copy(size); mesh.position.copy(pos);
  let rotated=false,obb=false,yaw=0;
  if(o.yaw){mesh.rotation.y=o.yaw;rotated=true;obb=true;yaw=o.yaw;}
  else if(o.quat){mesh.quaternion.copy(o.quat);rotated=true;}
  const wedge=o.shape==='wedge'&&!o.quat;
  if(wedge)obb=true;
  const tr=o.look?(o.look.transparency||0):(o.transparency||0);
  mesh.castShadow=tr<.5&&kind!=='water'&&!o.noShadow; mesh.receiveShadow=true;
  scene.add(mesh);
  const p={mesh,kind,size,pos:pos.clone(),base:pos.clone(),min:new V3(),max:new V3(),delta:new V3(),lastPos:pos.clone(),rotated,obb,yaw,wedge,active:true,
    noCollide:o.collide===false,move:o.move||null,data:o.data||{},decor:!!o.decor,opaque:tr<.5,name:o.name||'',look:o.look||null,desc:o,destroyed:false};
  mesh.userData.part=p;
  computeAABB(p);
  W.parts.push(p);W.solids.push(p);
  if(obb)W.obbs.push(p);
  if(kind!=='solid'&&kind!=='fade'&&kind!=='spawn') W.special.push(p);
  if(kind==='fade'){p.data.state='solid';p.data.timer=0;W.fades.push(p);}
  if(kind==='kill'&&m.emissive) W.pulse.add(m);
  if(o.move){o.move.axis=o.move.axis||new V3(1,0,0);W.movers.push(p);}
  if(p.name){if(!W.byName.has(p.name))W.byName.set(p.name,[]);W.byName.get(p.name).push(p);}
  return p;
}
const block=(x,y,z,sx,sy,sz,color,o)=>addPart(Object.assign({pos:[x,y,z],size:[sx,sy,sz],color},o||{}));
const pad=(x,top,z,w,d,color,o)=>{o=o||{};const h=o.h||1;return addPart(Object.assign({pos:[x,top-h/2,z],size:[w,h,d],color},o));};
function addRig(n,off){
  off=off||new V3();const s=n.scale||1;const g=makeRigMesh(n);
  const pos=new V3(n.pos[0]+off.x,n.pos[1]+off.y,n.pos[2]+off.z);const yaw=((n.rot||[0,0,0])[1]||0)*D2R;
  g.position.copy(pos);g.rotation.y=yaw;scene.add(g);
  const p={mesh:g,kind:'solid',size:new V3(4*s,5.2*s,1.2*s),pos:pos.clone(),base:pos.clone(),min:new V3(),max:new V3(),delta:new V3(),lastPos:pos.clone(),
    rotated:false,obb:true,yaw,wedge:false,active:true,noCollide:false,move:null,data:{},decor:false,opaque:true,name:n.name||'Rig',look:null,desc:{},destroyed:false,
    rig:true,node:n,anim:n.anim||'idle',walk:null,speed:n.walkSpeed||12,bubble:null,bubbleUntil:0,phase:Math.random()*5,
    health:n.health||100,maxHealth:n.health||100,respawn:+n.respawn||0,diedHandlers:[],dead:false,home:pos.clone(),flashT:0};
  g.traverse(o=>{if(o.isMesh)o.userData.part=p;});
  computeAABB(p);W.parts.push(p);W.solids.push(p);W.obbs.push(p);W.rigs.push(p);
  if(!W.byName.has(p.name))W.byName.set(p.name,[]);W.byName.get(p.name).push(p);
  return p;
}
function rigSay(r,text,secs){if(r.bubble){r.mesh.remove(r.bubble);r.bubble.material.map.dispose();r.bubble.material.dispose();r.bubble=null;}
  if(!String(text||'').trim())return;r.bubble=textSprite(text,{bubble:true});r.bubble.position.set(0,4.6+r.bubble.scale.y/2,0);r.mesh.add(r.bubble);r.bubbleUntil=t+(secs||3);}
const FLASHMAT=new THREE.MeshBasicMaterial({color:0xff4d5e});FLASHMAT.userData.shared=true;
function rigHpSprite(r){
  if(!r.hpCanvas){r.hpCanvas=document.createElement('canvas');r.hpCanvas.width=128;r.hpCanvas.height=18;r.hpTex=new THREE.CanvasTexture(r.hpCanvas);
    r.hpSprite=new THREE.Sprite(new THREE.SpriteMaterial({map:r.hpTex,depthTest:false,transparent:true}));r.hpSprite.scale.set(2.6,.37,1);r.hpSprite.position.set(0,3.05,0);r.hpSprite.renderOrder=6;r.mesh.add(r.hpSprite);}
  const g=r.hpCanvas.getContext('2d'),f=Math.max(0,r.health/r.maxHealth);g.clearRect(0,0,128,18);g.fillStyle='rgba(10,16,28,.8)';g.fillRect(0,0,128,18);
  g.fillStyle=f>.5?'#3ddc84':f>.25?'#ffd75e':'#ff4d5e';g.fillRect(3,3,122*f,12);r.hpTex.needsUpdate=true;r.hpSprite.visible=f<1&&!r.dead;}
function damageRig(r,n){
  if(!r||!r.rig||r.dead||r.destroyed||!(n>0))return;const _hb=r.health;r.health=Math.max(0,r.health-n);r.flashT=.12;juiceRigHit(r,Math.min(n,_hb));
  r.mesh.traverse(o=>{if(o.isMesh&&o.userData.rigPart!==false&&o.material!==faceDecal&&o.material!==FLASHMAT){o.userData.orig=o.material;o.material=FLASHMAT;}});
  rigHpSprite(r);if(r.health<=0)rigDie(r);
}
function healRig(r,n){if(!r||!r.rig||r.dead)return;r.health=Math.min(r.maxHealth,r.health+n);rigHpSprite(r);}
/* ---------- ragdolls ---------- */
const RAG_CORNERS=[];for(const x of [-1,1])for(const y of [-2.5,2.75])for(const z of [-.55,.55])RAG_CORNERS.push(new V3(x,y,z));
function makeRag(model,u,pos,vel,yaw,scale,until){
  const R={model,u,pos:pos.clone(),vel:vel.clone(),q:new THREE.Quaternion().setFromEuler(new THREE.Euler(0,yaw||0,0)),s:scale||1,until:until||0,rest:0,
    av:new V3((Math.random()-.5)*1.5,(Math.random()-.5)*1.2,(Math.random()-.5)*1.5),limbs:{}};
  const hv=new V3(vel.x,0,vel.z);if(hv.lengthSq()>4){const ax=new V3(0,1,0).cross(hv).normalize();R.av.addScaledVector(ax,Math.min(6,hv.length()*.15));}
  else R.av.addScaledVector(new V3(Math.cos(yaw||0),0,-Math.sin(yaw||0)),(Math.random()<.5?-1:1)*2.6);
  for(const k of ['lArm','rArm','lLeg','rLeg','head'])R.limbs[k]={x:u[k]?u[k].rotation.x:0,z:u[k]?u[k].rotation.z:0,vx:(Math.random()-.5)*6,vz:(Math.random()-.5)*6};
  if(u.body){u.body.rotation.set(0,0,0);u.body.position.set(0,0,0);}
  return R;}
function ragStep(R,dt){
  const n=Math.max(1,Math.ceil(dt/.012)),h=dt/n,c=new V3(),r=new V3(),vp=new V3(),up=new V3(0,1,0);
  if(R.rest>.4&&R.vel.lengthSq()<3){R.av.set(0,0,0);R.vel.set(0,0,0);}
  else for(let i=0;i<n;i++){
    R.vel.y-=PHYS.gravity*.75*h;R.pos.addScaledVector(R.vel,h);
    const w=R.av.length();if(w>1e-5){const dq=new THREE.Quaternion().setFromAxisAngle(R.av.clone().divideScalar(w),w*h);R.q.premultiply(dq).normalize();}
    let deepest=0,hits=0;const contact=new V3();
    for(const k of RAG_CORNERS){c.copy(k).multiplyScalar(R.s).applyQuaternion(R.q).add(R.pos);const g=groundAt(c.x,c.z,c.y+2.5);if(!isFinite(g))continue;const d=c.y-g;
      if(d<0){hits++;contact.add(c);if(d<deepest)deepest=d;}}
    if(hits){contact.divideScalar(hits);R.pos.y-=deepest;r.subVectors(contact,R.pos);vp.copy(R.av).cross(r).add(R.vel);
      if(vp.y<0){const j=-vp.y;R.vel.y+=j*(R.vel.y<-25?.55:.75);R.av.addScaledVector(r.clone().cross(up),j*.035/R.s);
        if(j>12)for(const L of Object.values(R.limbs)){L.vx+=(Math.random()-.5)*j*.4;L.vz+=(Math.random()-.5)*j*.4;}}
      const tq=R.pos.clone().sub(contact);tq.y=Math.max(tq.y,.2);R.av.addScaledVector(tq.clone().cross(new V3(0,-1,0)),PHYS.gravity*h*.045/R.s);
      const f=Math.pow(.02,h);R.vel.x*=f;R.vel.z*=f;R.av.multiplyScalar(Math.pow(.45,h));if(hits>=4&&R.vel.lengthSq()<4)R.av.multiplyScalar(.85);}
    R.av.multiplyScalar(Math.pow(.7,h));
  }
  const g=up.clone().negate().applyQuaternion(R.q.clone().invert());
  const lim={lArm:[2.6,1.6],rArm:[2.6,1.6],lLeg:[1.4,.6],rLeg:[1.4,.6],head:[.5,.4]};
  for(const [k,L] of Object.entries(R.limbs)){const o=R.u[k];if(!o)continue;const [mx,mz]=lim[k];
    let tx=Math.atan2(-g.z,-g.y),tz=Math.atan2(g.x,-g.y);if(k==='head'){tx*=.35;tz*=.35;}
    tx=Math.max(-mx,Math.min(mx,tx));tz=Math.max(-mz,Math.min(mz,tz));
    L.vx+=((tx-L.x)*40-L.vx*5)*dt;L.vz+=((tz-L.z)*40-L.vz*5)*dt;L.x+=L.vx*dt;L.z+=L.vz*dt;
    L.x=Math.max(-mx-.3,Math.min(mx+.3,L.x));L.z=Math.max(-mz-.3,Math.min(mz+.3,L.z));o.rotation.set(L.x,0,L.z);}
  R.model.position.copy(R.pos);R.model.quaternion.copy(R.q);
  const still=R.vel.lengthSq()<3&&R.av.lengthSq()<1.6;R.rest=still?R.rest+dt:0;
}
function ragYaw(R){const f=new V3(0,0,1).applyQuaternion(R.q);f.y=0;if(f.lengthSq()<1e-4){const u2=new V3(0,1,0).applyQuaternion(R.q);return Math.atan2(-u2.x,-u2.z);}return Math.atan2(f.x,f.z);}
function ragEndPlayer(){const R=P.rag;if(!R)return;P.rag=null;
  const g=groundAt(R.pos.x,R.pos.z,R.pos.y+3);P.pos.set(R.pos.x,(isFinite(g)?Math.max(g,R.pos.y-3):R.pos.y)+PH.y+.05,R.pos.z);P.vel.set(0,0,0);
  P.yaw=ragYaw(R);if(P.model){P.model.quaternion.identity();P.model.rotation.set(0,P.yaw,0);}MP.lastSent='';}
function ragdollPlayer(secs,vel){if(P.dead||state.over||!P.model)return;if(P.equipped)unequipTool();
  const until=t+Math.max(.3,Math.min(60,secs||2));if(P.rag){P.rag.until=Math.max(P.rag.until,until);if(vel)P.rag.vel.add(vel);return;}
  P.rag=makeRag(P.model,P.model.userData,P.pos,vel?P.vel.clone().add(vel):P.vel,P.yaw,1,until);P.anim=null;MP.lastSent='';}
function ragdollRig(r,secs,vel){if(!r||!r.rig||r.dead||r.destroyed)return;const until=t+Math.max(.3,Math.min(60,secs||2));
  if(r.rag){r.rag.until=Math.max(r.rag.until,until);if(vel)r.rag.vel.add(vel);return;}
  r.walk&&r.walk.done();r.walk=null;r.animPlay=null;r.rag=makeRag(r.mesh,r.mesh.userData.rig,r.pos,vel||new V3(),r.yaw,r.node.scale||1,until);r.active=false;}
function ragEndRig(r){const R=r.rag;r.rag=null;const s=r.node.scale||1;const g=groundAt(R.pos.x,R.pos.z,R.pos.y+3*s);
  r.yaw=ragYaw(R);r.mesh.quaternion.identity();r.mesh.rotation.set(0,r.yaw,0);r.active=true;setPartPos(r,new V3(R.pos.x,(isFinite(g)?g:R.pos.y)+2.5*s,R.pos.z));}
function deathStyle(){return game&&game.project&&game.project.settings.deathStyle==='ragdoll'?'ragdoll':'break';}
function rigDie(r){
  if(deathStyle()==='ragdoll'){r.dead=true;r.walk&&r.walk.done();r.walk=null;SFX.die();r.active=false;r.animPlay=null;
    if(!r.rag)r.rag=makeRag(r.mesh,r.mesh.userData.rig,r.pos,new V3((Math.random()-.5)*10,8,(Math.random()-.5)*10),r.yaw,r.node.scale||1,0);else r.rag.until=0;
    if(r.hpSprite)r.hpSprite.visible=false;rigDiedHandlers(r);
    if(r.respawn>0)r.respawnAt=t+Math.max(r.respawn,1);else r.ragDestroyAt=t+4;return;}
  _rigDieBreak(r);}
function rigDiedHandlers(r){if(!(r.lastHitBy&&r.lastHitBy!==MP.peerMe))juiceKO(r);const remote=r.lastHitBy&&r.lastHitBy!==MP.peerMe&&MP.remotes.has(r.lastHitBy);
  (r.diedHandlers||[]).forEach(h=>{if(h.host||!remote)spawnRun(h.body,h);});if(remote)mpEmit('bot',{t:'kd',k:rigKey(r),to:r.lastHitBy,h:W.projHash});}
function _rigDieBreak(r){
  r.dead=true;r.walk&&r.walk.done();r.walk=null;SFX.explode();
  r.mesh.updateMatrixWorld(true);
  r.mesh.traverse(o=>{if(!o.isMesh)return;const m=o.clone();m.material=o.userData.orig||o.material;o.getWorldPosition(m.position);o.getWorldQuaternion(m.quaternion);o.getWorldScale(m.scale);scene.add(m);
    W.debris.push({m,v:new V3((Math.random()-.5)*24,10+Math.random()*14,(Math.random()-.5)*24),s:new V3(Math.random()*8,Math.random()*8,Math.random()*8),life:1.6});});
  r.mesh.visible=false;r.active=false;
  (r.diedHandlers||[]).forEach(h=>spawnRun(h.body,h));
  if(r.respawn>0)r.respawnAt=t+r.respawn;else destroyPart(r);
}
function updateRigs(dt){
  for(const r of W.rigs){if(r.destroyed)continue;let moving=false;
    if(r.puppet){if(r.flashT>0){r.flashT-=dt;if(r.flashT<=0)r.mesh.traverse(o=>{if(o.isMesh&&o.userData.orig){o.material=o.userData.orig;o.userData.orig=null;}});}
      moving=puppetStep(r,dt);const u=r.mesh.userData.rig;animateRig(u,r.anim,t+r.phase,moving,dt);relaxPose(u,Math.min(1,dt*10),false);if(r.bubble&&t>r.bubbleUntil)rigSay(r,'');continue;}
    if(r.flashT>0){r.flashT-=dt;if(r.flashT<=0)r.mesh.traverse(o=>{if(o.isMesh&&o.userData.orig){o.material=o.userData.orig;o.userData.orig=null;}});}
    if(r.rag&&!r.dead){ragStep(r.rag,dt);if(t>=r.rag.until&&(r.rag.rest>.25||t>r.rag.until+2))ragEndRig(r);continue;}
    if(r.dead){if(r.rag)ragStep(r.rag,dt);if(r.ragDestroyAt&&t>=r.ragDestroyAt){r.ragDestroyAt=0;destroyPart(r);continue;}
      if(r.respawnAt&&t>=r.respawnAt){if(r.rag){r.rag=null;r.mesh.quaternion.identity();r.mesh.rotation.set(0,r.yaw,0);const u=r.mesh.userData.rig;['lArm','rArm','lLeg','rLeg','head'].forEach(k=>u[k].rotation.set(0,0,0));}
        r.dead=false;r.respawnAt=0;r.health=r.maxHealth;r.mesh.visible=true;r.active=true;setPartPos(r,r.home.clone());rigHpSprite(r);}continue;}
    if(r.walk){const w=r.walk,tg=w.target();
      if(!tg||t>w.until){r.walk=null;w.done();}
      else{const d=new V3(tg.x-r.pos.x,0,tg.z-r.pos.z),dist=d.length();
        if(dist<=w.stop){r.walk=null;w.done();}
        else{d.multiplyScalar(Math.min(dist-w.stop*.5,r.speed*dt)/dist);let np=r.pos.clone().add(d);
          const s=r.node.scale||1,feet=r.pos.y-2.5*s;
          if(!r.node.throughWalls){const here=isFinite(groundAt(r.pos.x,r.pos.z,feet+1.3,r));
            const ok=(x,z)=>!rigBlocked(r,x,z,feet,s)&&(!here||isFinite(groundAt(x,z,feet+1.3,r)));
            if(!rigBlocked(r,r.pos.x,r.pos.z,feet,s)&&!ok(np.x,np.z)){if(ok(np.x,r.pos.z))np.z=r.pos.z;else if(ok(r.pos.x,np.z))np.x=r.pos.x;else np=null;}}
          if(!np){r.stuckT=(r.stuckT||0)+dt;if(r.stuckT>.6){r.stuckT=0;r.walk=null;w.done();}}else r.stuckT=0;
          if(np){const gy=groundAt(np.x,np.z,feet+1.3,r);if(isFinite(gy))np.y=gy+2.5*s;
          setPartPos(r,np);r.yaw=Math.atan2(d.x,d.z);r.mesh.rotation.y=r.yaw;moving=true;}}}}
    {const u=r.mesh.userData.rig;animateRig(u,r.anim,t+r.phase,moving,dt);relaxPose(u,Math.min(1,dt*10),false);
      if(r.animPlay){r.animPlay=stepAnim(r.animPlay,dt,moving);if(r.animPlay)applyPose(u,sampleAnim(r.animPlay.a,r.animPlay.t),r.animPlay.w);}}
    if(r.bubble&&t>r.bubbleUntil)rigSay(r,'');
  }
}
function coin(x,y,z){const m=new THREE.Mesh(COIN,COINMAT);m.position.set(x,y,z);m.castShadow=true;scene.add(m);W.coins.push({mesh:m,got:false,pop:0,by:y,ph:Math.random()*6});}
function addSpinner(x,y,z,len,speed,color){
  const pivot=new THREE.Group();pivot.position.set(x,y,z);
  const m=mat(color||0xff3b30,{neon:true});W.pulse.add(m);
  const bar=new THREE.Mesh(BOX,m);bar.scale.set(len,1,1);bar.castShadow=true;pivot.add(bar);
  scene.add(pivot);
  addPart({pos:[x,y-.9,z],size:[1.4,1.8,1.4],shape:'cylY',color:0x3b3f4a});
  W.spinners.push({pivot,len,speed});
}
/* breaking things: nearby parts come loose and fly, and anything resting on them falls too */
function breakable(p){return !(p.destroyed||p.rig||p.decor||p.lobby||p.toolPickup||p.kind==='spawn'||p.kind==='water'||p.kind==='kill'||(p.node&&p.node.unbreakable)||Math.max(p.size.x,p.size.y,p.size.z)>40);}
function breakAt(c,r,pw){r=Math.max(0,Math.min(200,r));pw=Math.max(0,Math.min(400,pw));const q=[];
  for(const p of W.parts){if(!breakable(p))continue;const d=Math.max(0,p.pos.distanceTo(c)-Math.max(p.size.x,p.size.y,p.size.z)*.35);if(d<=r)q.push([p,d]);}
  q.sort((a,b)=>a[1]-b[1]);q.slice(0,90).forEach(([p,d])=>{const f=1-d/(r+.001);const dir=p.pos.clone().sub(c);dir.y=Math.max(dir.y,.2);if(dir.lengthSq()<.01)dir.set(Math.random()-.5,.6,Math.random()-.5);dir.normalize();
    looseParts(p,dir.multiplyScalar(pw*(.35+.65*f)).add(new V3((Math.random()-.5)*pw*.2,pw*.45*f,(Math.random()-.5)*pw*.2)));});return q.length;}
function looseParts(p,v){const was=W.phys.includes(p);if(!was)W.phys.push(p);p.vx=v.x;p.vz=v.z;p.vy=v.y;if(p.move){p.move=null;removeFrom(W.movers,p);}
  p.spin=new V3((Math.random()-.5)*8,0,(Math.random()-.5)*8);if(!was)collapseAbove(p,0);}
function collapseAbove(p,depth){if(depth>12)return;
  for(const s of W.parts){if(s===p||W.phys.includes(s)||!breakable(s))continue;
    if(Math.abs(s.min.y-p.max.y)<.4&&s.min.x<p.max.x-.05&&s.max.x>p.min.x+.05&&s.min.z<p.max.z-.05&&s.max.z>p.min.z+.05){
      const held=W.parts.some(o=>o!==p&&o!==s&&!o.destroyed&&!o.rig&&!o.decor&&!o.noCollide&&!W.phys.includes(o)&&Math.abs(s.min.y-o.max.y)<.4&&s.min.x<o.max.x-.05&&s.max.x>o.min.x+.05&&s.min.z<o.max.z-.05&&s.max.z>o.min.z+.05);
      if(!held){W.phys.push(s);s.vy=0;s.vx=(Math.random()-.5)*3;s.vz=(Math.random()-.5)*3;s.spin=new V3((Math.random()-.5)*2,0,(Math.random()-.5)*2);collapseAbove(s,depth+1);}}}}
/* rigs are stopped by walls taller than a step (unless "Walk through walls" is on) */
function rigBlocked(r,x,z,feet,s){const hw=.9*s,top=feet+5*s;for(const q of W.solids){if(q===r||q.rig||q.decor||q.noCollide||!q.active||q.kind==='water')continue;
  if(x+hw>q.min.x&&x-hw<q.max.x&&z+hw>q.min.z&&z-hw<q.max.z&&q.max.y>feet+1.3&&q.min.y<top)return true;}return false;}
function groundAt(x,z,below,skip){let best=-Infinity;for(const s of W.solids){if(s===skip||s.decor||s.noCollide||s.kind==='water')continue;
  if(x>s.min.x&&x<s.max.x&&z>s.min.z&&z<s.max.z&&s.max.y<(below||1e9))best=Math.max(best,s.max.y);}return best;}
function setPartPos(p,v){p.pos.copy(v);p.base.copy(v);p.mesh.position.copy(v);computeAABB(p);W.dyn.add(p);}
function applyLook(p){if(p.rig)return;if(!p.look)p.look={color:toHex(p.mesh.material.color||0xa3a2a5),material:'Plastic',transparency:0};
  p.look.neon=p.kind==='kill';const old=p.mesh.material;p.mesh.material=lookMat(p.look,p.size.toArray());
  if(!old.userData.shared){if(old.map)old.map.dispose();old.dispose();}
  if(p.kind==='kill'&&p.mesh.material.emissive)W.pulse.add(p.mesh.material);
  p.opaque=(p.look.transparency||0)<.5;p.mesh.castShadow=p.opaque;}
function removeFrom(arr,x){const i=arr.indexOf(x);if(i>=0)arr.splice(i,1);}
function destroyPart(p){if(p.destroyed)return;p.destroyed=true;scene.remove(p.mesh);
  [W.parts,W.solids,W.obbs,W.special,W.fades,W.phys,W.rigs].forEach(a=>removeFrom(a,p));W.dyn.delete(p);
  const l=W.byName.get(p.name);if(l)removeFrom(l,p);}

/* =====================================================================
   AVATARS, COINS AND THE ITEM SHOP
   Coins come from playing: time in games, finishing courses and lobby matches.
   ===================================================================== */
const AV_SKINS=['#f5cd30','#ffcc80','#e0ac69','#c68642','#8d5524','#5c3a21','#ffe0bd','#b39ddb','#80cbc4','#bdbdbd'];
const AV_COLS=['#e53935','#d81b60','#8e24aa','#5e35b1','#1e88e5','#00acc1','#43a047','#7cb342','#fdd835','#fb8c00','#6d4c41','#263238','#f5f5f5','#2b3a7a','#000000','#ff8a1f'];
const AV_SLOTS=[['hat','Hats'],['face','Faces'],['back','Back'],['neck','Neck'],['pet','Pets'],['art','Shirt art']];
const AV_DEF=()=>({skin:'#f5cd30',shirt:store.get('shirt',SHIRTS[1]),pants:'#2b3a7a',face:'smile',hat:'',back:'',neck:'',pet:'',art:''});
/* [id, slot, name, price, emoji] — price 0 is free */
const AV_ITEMS=[
  ['smile','face','Smile',0,'🙂'],['grin','face','Big Grin',0,'😁'],['wink','face','Wink',40,'😉'],['shocked','face','Shocked',40,'😮'],['angry','face','Grumpy',60,'😠'],
  ['blush','face','Blushing',80,'😊'],['mustache','face','Fancy Mustache',120,'🥸'],['shades','face','Cool Shades',150,'😎'],['stars','face','Star Eyes',200,'🤩'],
  ['zombie','face','Zombie',180,'🧟'],['ninja','face','Ninja Mask',250,'🥷'],['robot','face','Robot Visor',300,'🤖'],
  ['cap','hat','Red Cap',0,'🧢'],['beanie','hat','Beanie',0,'🧶'],['party','hat','Party Hat',60,'🥳'],['cone','hat','Traffic Cone',80,'🚧'],['chef','hat','Chef Hat',100,'👨‍🍳'],
  ['headphones','hat','Headphones',120,'🎧'],['tophat','hat','Top Hat',150,'🎩'],['bunny','hat','Bunny Ears',150,'🐰'],['cowboy','hat','Cowboy Hat',200,'🤠'],
  ['propeller','hat','Propeller Cap',250,'🚁'],['wizard','hat','Wizard Hat',300,'🧙'],['viking','hat','Viking Helmet',350,'🪓'],['pumpkin','hat','Pumpkin Head',400,'🎃'],
  ['crown','hat','Golden Crown',500,'👑'],['halo','hat','Halo',800,'😇'],['astro','hat','Space Helmet',1000,'🧑‍🚀'],['shadow','hat','Shadow Lord Horns',5000,'😈'],
  ['backpack','back','Backpack',0,'🎒'],['cape','back','Hero Cape',200,'🦸'],['sword','back','Sword Sheath',300,'🗡️'],['guitar','back','Rock Guitar',450,'🎸'],
  ['jetpack','back','Jetpack',600,'🚀'],['batwings','back','Bat Wings',700,'🦇'],['angel','back','Angel Wings',900,'🪽'],['dragon','back','Dragon Wings',2500,'🐉'],
  ['scarf','neck','Cozy Scarf',0,'🧣'],['bowtie','neck','Bow Tie',60,'🎀'],['medal','neck','Gold Medal',250,'🏅'],['chain','neck','Bling Chain',400,'⛓️'],
  ['parrot','pet','Shoulder Parrot',650,'🦜'],['kitty','pet','Shoulder Kitty',900,'🐱'],['dragonpet','pet','Baby Dragon',2000,'🐲'],
  ['catface','face','Cat Face',90,'🐱'],['sleepy','face','Sleepy',60,'😴'],['tongue','face','Silly Tongue',70,'😛'],['hearteyes','face','Heart Eyes',220,'😍'],['skull','face','Skull',450,'💀'],
  ['santa','hat','Santa Hat',220,'🎅'],['pirate','hat','Pirate Hat',260,'🏴‍☠️'],['catears','hat','Cat Ears',90,'😺'],['flower','hat','Flower Crown',140,'🌸'],['antlers','hat','Reindeer Antlers',180,'🦌'],
  ['unicorn','hat','Unicorn Horn',450,'🦄'],['knight','hat','Knight Helmet',600,'⚔️'],['icecrown','hat','Ice Crown',1200,'❄️'],['ufo','hat','Tiny UFO',1500,'🛸'],['firecrown','hat','Fire Crown',3000,'🔥'],
  ['shield','back','Round Shield',350,'🛡️'],['surf','back','Surfboard',300,'🏄'],['bfly','back','Butterfly Wings',800,'🦋'],['rcape','back','Rainbow Cape',1100,'🌈'],['phoenix','back','Phoenix Wings',4000,'🐦‍🔥'],
  ['tie','neck','Necktie',80,'👔'],['lei','neck','Flower Lei',120,'🌺'],['pearls','neck','Pearl Necklace',300,'📿'],
  ['puppy','pet','Shoulder Puppy',900,'🐶'],['bunnypet','pet','Bunny Pal',700,'🐇'],['penguin','pet','Penguin',1100,'🐧'],['ghostpet','pet','Little Ghost',1500,'👻'],['robopet','pet','Robo Buddy',2200,'🤖'],
  ['witchhat','hat','🎃 Witch Hat',300,'🧙‍♀️'],['vampire','face','🎃 Vampire',200,'🧛'],['candybag','back','🎃 Candy Bag',350,'🍬'],['batpet','pet','🎃 Bat Buddy',900,'🦇'],['skeleton','art','🎃 Skeleton',250,'💀'],
  ['checks','art','Checkers',80,'🏁'],['camo','art','Camo',150,'🪖'],['smiley','art','Smiley',120,'😀'],['rainbow','art','Rainbow',400,'🌈'],
  ['stripes','art','Stripes',50,'➖'],['star','art','Big Star',100,'⭐'],['heart','art','Heart',100,'❤️'],['flame','art','Flames',300,'🔥'],['bolt','art','Lightning',300,'⚡'],['galaxy','art','Galaxy',700,'🌌']
].map(([id,slot,name,price,emo])=>({id,slot,name,price,emo}));
const AV_BY=new Map(AV_ITEMS.map(i=>[i.id,i]));
const avNum=(v,d)=>{v=Number(v);return isFinite(v)?v:d;};
const hexOk=c=>typeof c==='string'&&/^#[0-9a-f]{6}$/i.test(c);
function avClean(o){const d=AV_DEF();if(!o||typeof o!=='object')return d;const r={};
  for(const k of ['skin','shirt','pants'])r[k]=hexOk(o[k])?o[k].toLowerCase():d[k];
  for(const [s] of [['face'],...AV_SLOTS]){const v=o[s];r[s]=typeof v==='string'&&AV_BY.has(v)&&AV_BY.get(v).slot===s?v:(s==='face'?'smile':'');}
  return r;}
/* ---------- the wallet: coins, owned items and the outfit ---------- */
const WALLET={badges:new Set(),wins:0,xp:0,coins:0,owned:new Set(AV_ITEMS.filter(i=>!i.price).map(i=>i.id)),av:AV_DEF(),t:0,loaded:false,day:''};
(function(){const w=store.get('wallet',null);if(w&&typeof w==='object')walletApply(w);})();
function walletApply(w){WALLET.coins=Math.max(0,Math.min(1e7,Math.floor(avNum(w.coins,0))));
  (Array.isArray(w.owned)?w.owned:[]).forEach(id=>{if(AV_BY.has(id))WALLET.owned.add(id);});
  WALLET.av=avClean(w.av);for(const [s] of AV_SLOTS)if(WALLET.av[s]&&!WALLET.owned.has(WALLET.av[s]))WALLET.av[s]='';if(!WALLET.owned.has(WALLET.av.face))WALLET.av.face='smile';
  WALLET.t=avNum(w.t,0);WALLET.day=typeof w.day==='string'?w.day:'';WALLET.xp=Math.max(WALLET.xp||0,Math.min(1e8,Math.floor(avNum(w.xp,0))));WALLET.wins=Math.max(WALLET.wins||0,Math.floor(avNum(w.wins,0)));(Array.isArray(w.badges)?w.badges:[]).forEach(b=>{if(typeof b==='string'&&b.length<30)WALLET.badges.add(b);});
  if(w.q&&typeof w.q==='object'&&typeof w.q.day==='string'&&Array.isArray(w.q.p)&&(!WALLET.q||w.q.day>=WALLET.q.day))WALLET.q={day:w.q.day,p:w.q.p.slice(0,3).map(x=>Math.max(0,avNum(x,0))),c:(Array.isArray(w.q.c)?w.q.c:[]).slice(0,3).map(Boolean),b:!!w.q.b};}
function walletObj(){return {v:1,badges:[...WALLET.badges],wins:WALLET.wins||0,xp:WALLET.xp||0,coins:WALLET.coins,owned:[...WALLET.owned],av:WALLET.av,t:WALLET.t,day:WALLET.day,q:WALLET.q||null};}
function walletBackend(){return (SB.client&&SB.uid)?'sb':(MP.db&&MP.me&&MP.me.id&&!MP.p2p)?'claude':'local';}
let walletSaveT=0;
function walletSave(){WALLET.t=Date.now();store.set('wallet',walletObj());renderCoins();clearTimeout(walletSaveT);
  walletSaveT=setTimeout(()=>{const be=walletBackend();if(be!=='local')saveWrite('wallet',be,walletObj()).catch(()=>{});},1500);}
async function walletSync(){const be=walletBackend();if(be==='local'){WALLET.loaded=true;renderCoins();return;}
  try{const o=await saveRead('wallet',be);if(o&&typeof o==='object'&&avNum(o.t,0)>WALLET.t){const local=walletObj();walletApply(o);
      local.owned.forEach(id=>WALLET.owned.add(id));store.set('wallet',walletObj());}
    else if(WALLET.t)saveWrite('wallet',be,walletObj()).catch(()=>{});}catch(e){}
  WALLET.loaded=true;renderCoins();if(P.model&&!running)return;}
function featuredId(){const pool=GAMES.filter(g=>g.id!=='sandbox');return pool[(hashStr('feat'+new Date().toISOString().slice(0,10))>>>0)%pool.length].id;}
function earnCoins(n,why){n=Math.floor(n);if(!(n>0)||(game&&game.fromEditor)||TESTCLIENT)return;if(running&&game&&game.id===featuredId()){n*=2;why=(why?why+' · ':'')+'2× featured';}WALLET.coins=Math.min(1e7,WALLET.coins+n);walletSave();
  coinToast('+'+n+' coins'+(why?' · '+why:''));}
function coinToast(t){let el=$('#coinToast');if(!el)return;el.textContent='🪙 '+t;el.classList.remove('show');void el.offsetWidth;el.classList.add('show');clearTimeout(coinToast._t);coinToast._t=setTimeout(()=>el.classList.remove('show'),2600);}
const lvlOf=xp=>Math.floor(Math.sqrt((xp||0)/40))+1;
function gainXP(n,why){if(!(n>0)||(game&&game.fromEditor)||TESTCLIENT)return;const before=lvlOf(WALLET.xp);WALLET.xp=Math.min(1e8,(WALLET.xp||0)+Math.floor(n));const after=lvlOf(WALLET.xp);
  if(after>before){const bonus=after*20;WALLET.coins=Math.min(1e7,WALLET.coins+bonus);SFX.win&&SFX.win();toast('⭐ LEVEL UP! You are now level '+after+'  +'+bonus+' coins','#b388ff',3.5);MP.lastSent='';}
  walletSave();}
function renderCoins(){document.querySelectorAll('.lvlNum').forEach(e=>e.textContent=lvlOf(WALLET.xp));document.querySelectorAll('.coinCount').forEach(e=>e.textContent=WALLET.coins.toLocaleString('en-US'));if(typeof renderQuests==='function'&&!$('#menu').hidden)renderQuests();}
/* playing earns coins: 5 per active minute, daily bonus, finishing courses and lobby matches */
/* best-run ghost: your fastest finish replays as a see-through runner */
const GHOST={rec:[],path:null,mesh:null,on:false};
function ghostEligible(){return game&&!game.fromEditor&&(game.mode==='race'||(game.project&&game.project.settings&&game.project.settings.timer!==false&&!LOBBY.on));}
function ghostStart(){if(GHOST.mesh){scene.remove(GHOST.mesh);GHOST.mesh=null;}GHOST.rec=[];GHOST.path=null;GHOST.on=ghostEligible();if(!GHOST.on)return;
  const pth=store.get('ghost_'+game.id,null);if(!Array.isArray(pth)||pth.length<10)return;GHOST.path=pth;
  try{const m=makeAvatar();m.traverse(o=>{if(o.isMesh&&o.material){o.material=o.material.clone();o.material.transparent=true;o.material.opacity=.32;o.material.depthWrite=false;}});GHOST.mesh=m;scene.add(m);}catch(e){GHOST.path=null;}}
function ghostTick(){if(!GHOST.on||!running||paused||!state)return;const i=Math.floor(state.time*10);
  if(!state.over&&GHOST.rec.length<=i&&GHOST.rec.length<6000){while(GHOST.rec.length<=i)GHOST.rec.push([r3(P.pos.x),r3(P.pos.y),r3(P.pos.z)]);}
  if(GHOST.mesh&&GHOST.path){const f=state.time*10,a=GHOST.path[Math.min(GHOST.path.length-1,Math.floor(f))],b=GHOST.path[Math.min(GHOST.path.length-1,Math.floor(f)+1)],u=f-Math.floor(f);
    GHOST.mesh.visible=f<GHOST.path.length;if(a&&b){GHOST.mesh.position.set(a[0]+(b[0]-a[0])*u,a[1]+(b[1]-a[1])*u,a[2]+(b[2]-a[2])*u);const dx=b[0]-a[0],dz=b[2]-a[2];if(dx*dx+dz*dz>.0004)GHOST.mesh.rotation.y=Math.atan2(-dx,-dz);}}}
function ghostSave(){if(GHOST.on&&GHOST.rec.length>10)store.set('ghost_'+game.id,GHOST.rec.slice(0,6000));}
const PLAYED={t:0,total:0};const GAMECOINS={left:150};
function coinTick(dt){if(!running||paused||!game||game.fromEditor||game.mode==='build'||state.over)return;
  const moving=Math.hypot(P.vel.x,P.vel.z)>1||!P.onGround;if(!moving&&!(LOBBY.on&&LOBBY.inRound))return;
  PLAYED.t+=dt;PLAYED.total+=dt;if(PLAYED.t>=60){PLAYED.t-=60;earnCoins(5,'playing');questBump('minutes','',1);gainXP(12);}
  const today=new Date().toISOString().slice(0,10);if(WALLET.day!==today&&PLAYED.t>10){WALLET.day=today;earnCoins(50,'daily bonus');}}
/* ---------- daily quests: three a day, the same for everybody, paid in coins ---------- */
const QUESTS=[
  {id:'doors15',g:'doors',k:'stat',st:'Door',n:15,r:120,t:'Get through 15 doors in the Haunted Hotel'},
  {id:'tower40',g:'towerhell',k:'stat',st:'Height',n:40,r:100,t:'Climb 40 studs up the Tower of Chaos'},
  {id:'rescued',g:'planecrash',k:'stat',st:'Rescued',n:1,r:150,t:'Get rescued after the Plane Crash'},
  {id:'chute',g:'planecrash',k:'stat',st:'Points',n:20,r:90,t:'Score 20 points in Plane Crash'},
  {id:'evade60',g:'evade',k:'stat',st:'Score',n:60,r:100,t:'Score 60 in one round of Panic Run'},
  {id:'arsenal3',g:'arsenal',k:'stat',st:'KOs',n:3,r:100,t:'Get 3 knockouts in Weapon Ladder'},
  {id:'murder',g:'murder',k:'match',n:2,r:80,t:'Play 2 rounds of Whodunit'},
  {id:'hide30',g:'hideseek',k:'stat',st:'Score',n:30,r:100,t:'Stay hidden for a whole round of Hide and Seek'},
  {id:'deathrun',g:'deathrun',k:'stat',st:'Finished',n:1,r:120,t:'Beat the Trap Run course'},
  {id:'zombie3',g:'zombies',k:'stat',st:'Wave',n:3,r:100,t:'Reach wave 3 in Zombie Survival'},
  {id:'disaster2',g:'disasters',k:'stat',st:'Streak',n:2,r:110,t:'Survive 2 disasters in a row'},
  {id:'bomb2',g:'bombtag',k:'match',n:2,r:80,t:'Play 2 matches of Bomb Tag'},
  {id:'gems10',g:'gems',k:'stat',st:'Gems',n:10,r:90,t:'Collect 10 gems in Gem Hunt'},
  {id:'freeze3',g:'freezetag',k:'stat',st:'Tags',n:8,r:90,t:'Freeze 8 runners in Freeze Tag'},
  {id:'obby',g:'megaobby',k:'finish',n:1,r:150,t:'Finish the Mega Obby'},
  {id:'rainbow',g:'rainbow',k:'finish',n:1,r:120,t:'Finish the Rainbow Obby'},
  {id:'boss3',g:'boss',k:'stat',st:'Level',n:3,r:120,t:'Reach level 3 in Boss Battle'},
  {id:'flag1',g:'flagraid',k:'stat',st:'Captures',n:1,r:100,t:'Capture a flag in Flag Raid'},
  {id:'seek',g:'doors',k:'stat',st:'Door',n:29,r:200,t:'Escape the Watcher in the Haunted Hotel (reach door 29)'},
  {id:'gold',g:'doors',k:'stat',st:'Gold',n:30,r:90,t:'Collect 30 gold in the Haunted Hotel'},
  {id:'stars',g:'rainbow',k:'stat',st:'Stars',n:3,r:100,t:'Grab all 3 star coins in Rainbow Obby'},
  {id:'souls',g:'ghost',k:'stat',st:'Souls',n:4,r:100,t:'Collect 4 soul orbs in Escape the Ghost'},
  {id:'cash',g:'zombies',k:'stat',st:'Cash',n:200,r:110,t:'Earn 200 cash in Zombie Survival'},
  {id:'mmcoins',g:'murder',k:'stat',st:'Coins',n:8,r:90,t:'Pick up 8 coins in Whodunit'},
  {id:'sumo60',g:'sumo',k:'stat',st:'Time',n:60,r:100,t:'Stay on the Sumo ring for 60 seconds'},
  {id:'laps3',g:'turbo',k:'stat',st:'Laps',n:3,r:100,t:'Finish 3 laps of Turbo Track'},
  {id:'targets25',g:'targets',k:'stat',st:'Score',n:25,r:90,t:'Score 25 in Target Range'},
  {id:'colordrop5',g:'colordrop',k:'stat',st:'Rounds',n:5,r:90,t:'Survive 5 rounds of Color Drop'},
  {id:'maze2',g:'maze',k:'stat',st:'Escapes',n:2,r:100,t:'Escape 2 mazes in Maze Escape'},
  {id:'lava3',g:'lavarise',k:'stat',st:'Round',n:3,r:110,t:'Reach the Crystal Spire (round 3) in Lava Rising'},
  {id:'cloud',g:'cloudhop',k:'finish',n:1,r:110,t:'Finish Cloud Hop'},
  {id:'bounty',g:'arena',k:'stat',st:'KOs',n:5,r:100,t:'Get 5 knockouts in Brick Battle'},
  {id:'matches',g:'',k:'match',n:3,r:80,t:'Play 3 lobby matches in any game'},
  {id:'win',g:'',k:'win',n:1,r:150,t:'Win a match against another player'},
  {id:'minutes',g:'',k:'minutes',n:10,r:80,t:'Play for 10 minutes'}];
const QBONUS=100;
/* ---------- badges: one-time achievements that pay coins ---------- */
const BADGES=[
  ['first','👟','First Steps','Play any game for a minute',()=>PLAYED.total>=60,25],
  ['seek','👁️','Watcher Survivor','Escape the Watcher in the Haunted Hotel',()=>gid()==='doors'&&st('Door')>=29,150],
  ['hotel','🏨','Checked Out','Get through all 40 doors',()=>gid()==='doors'&&st('Escaped')>=1,400],
  ['tower','🗼','Tower Conqueror','Reach the top of the Tower of Chaos',()=>gid()==='towerhell'&&st('Height')>=999,300],
  ['mega','🏁','Mega Finisher','Finish the 50-stage Mega Obby',()=>gid()==='megaobby'&&state.over,300],
  ['rescue','🚁','Rescued','Get rescued after a plane crash',()=>gid()==='planecrash'&&st('Rescued')>=1,150],
  ['zombie10','🧟','Zombie Slayer','Reach wave 10 in Zombie Survival',()=>gid()==='zombies'&&st('Wave')>=10,300],
  ['boss5','🐉','Dragon Tamer','Reach level 5 in Boss Battle',()=>gid()==='boss'&&st('Level')>=5,300],
  ['ghost3','👻','Night Owl','Survive to night 3 in Escape the Ghost',()=>gid()==='ghost'&&st('Night')>=3,200],
  ['knife','🔪','Golden Knife','Win a game of Weapon Ladder',()=>gid()==='arsenal'&&st('KOs')>=99,250],
  ['lava5','🌋','Lava Proof','Reach round 5 of Lava Rising',()=>gid()==='lavarise'&&st('Round')>=5,200],
  ['gems25','💎','Gem Hoarder','Collect 25 gems in one round',()=>gid()==='gems'&&st('Gems')>=25,150],
  ['win1','🏆','Winner','Win a match against another player',()=>(WALLET.wins||0)>=1,100],
  ['win10','🥇','Champion','Win 10 matches',()=>(WALLET.wins||0)>=10,500],
  ['lvl5','⭐','Rising Star','Reach level 5',()=>lvlOf(WALLET.xp)>=5,100],
  ['lvl15','🌟','Superstar','Reach level 15',()=>lvlOf(WALLET.xp)>=15,500],
  ['shop10','🛍️','Shopaholic','Own 15 avatar items',()=>WALLET.owned.size>=15,150],
  ['quests','📜','Quest Master','Finish all three daily quests in a day',()=>!!(WALLET.q&&WALLET.q.b),100],
  ['mecha','🤖','Mecha Breaker','Reach level 8 in Boss Battle',()=>gid()==='boss'&&st('Level')>=8,400],
  ['hedge','🌿','Hedge Hero','Escape 4 mazes in a row in Maze Escape',()=>gid()==='maze'&&st('Escapes')>=4,150],
  ['ladder','🔫','Rival Beater','Win Weapon Ladder before the rival bot finishes',()=>gid()==='arsenal'&&st('KOs')>=99&&RT.vars&&+RT.vars.get('rival tier')<8,250],
  ['build9','🏗️','Master Builder','Finish every Free Build challenge',()=>store.get('bqi',0)>=9,300],
  ['combo','🎯','Sharpshooter','Score 40 in one Target Range match',()=>gid()==='targets'&&st('Score')>=40,150],
  ['farm','🌾','Farmhand','Reach wave 5 on the Farm in Zombie Survival',()=>gid()==='zombies'&&st('Wave')>=5&&RT.vars&&+RT.vars.get('map x')===300,150]];
function gid(){return game&&game.id||'';}
function st(k){return +(RT.stats&&RT.stats.get(k))||0;}
function badgeCheck(){if(game&&game.fromEditor||TESTCLIENT)return;for(const [id,ic,nm,ds,fn,r] of BADGES){if(WALLET.badges.has(id))continue;let ok=false;try{ok=!!fn();}catch(e){}
  if(ok){WALLET.badges.add(id);WALLET.coins=Math.min(1e7,WALLET.coins+r);walletSave();SFX.win&&SFX.win();toast(ic+' BADGE: '+nm+'  +'+r+' coins','#ffd54f',4);}}}
setInterval(()=>{try{badgeCheck();}catch(e){}},1500);
function questDay(){return new Date().toISOString().slice(0,10);}
function questsToday(){const d=questDay();let h=hashStr('q'+d)>>>0;const pool=QUESTS.slice(),out=[];
  while(out.length<3&&pool.length){h=(Math.imul(h,1103515245)+12345)>>>0;const q=pool.splice(h%pool.length,1)[0];if(q.g&&!GAMES.some(g=>g.id===q.g))continue;
    if(out.some(o=>o.g&&o.g===q.g))continue;out.push(q);}return out;}
function questState(){const d=questDay();if(!WALLET.q||WALLET.q.day!==d)WALLET.q={day:d,p:[0,0,0],c:[false,false,false],b:false};return WALLET.q;}
function questBump(kind,gid,val,abs){if(game&&game.fromEditor||TESTCLIENT)return;const qs=questsToday(),S=questState();let changed=false;
  qs.forEach((q,i)=>{if(S.c[i]||q.k!==kind)return;if(q.g&&q.g!==gid)return;const nv=abs?Math.max(S.p[i],val):S.p[i]+val;if(nv===S.p[i])return;S.p[i]=Math.min(q.n,nv);changed=true;
    if(S.p[i]>=q.n){S.c[i]=true;WALLET.coins=Math.min(1e7,WALLET.coins+q.r);setTimeout(()=>gainXP(60),0);SFX.win&&SFX.win();toast('Quest complete: '+q.t+'  +'+q.r+' coins','#ffd75e',3.5);}});
  if(changed){if(!S.b&&S.c.every(Boolean)){S.b=true;WALLET.coins=Math.min(1e7,WALLET.coins+QBONUS);setTimeout(()=>coinToast('+'+QBONUS+' coins · all daily quests done!'),1500);}walletSave();}}
let questT=0;
function questTick(dt){if(!running||paused||!game||game.fromEditor||state.over&&game.mode!=='project')return;questT+=dt;if(questT<.5)return;questT=0;
  const qs=questsToday(),S=questState();qs.forEach((q,i)=>{if(!S.c[i]&&q.k==='stat'&&q.g===game.id){const v=+RT.stats.get(q.st)||0;if(v>S.p[i]&&v<1e6)questBump('stat',game.id,v,true);}});}
function renderQuests(){const g=$('#questGrid');if(!g)return;const qs=questsToday(),S=questState();
  g.innerHTML=qs.map((q,i)=>{const gm=GAMES.find(x=>x.id===q.g);const pct=Math.round(100*Math.min(1,S.p[i]/q.n));
    return `<button type="button" class="quest${S.c[i]?' done':''}" data-quest="${q.g}"><div class="qt"><span class="qn">${esc(q.t)}</span><span class="qr">${S.c[i]?'✓ Done':'🪙 '+q.r}</span></div>
      <div class="bar"><i style="width:${pct}%"></i></div><span class="qg">${gm?esc(gm.name)+' · ':''}${r3(Math.min(S.p[i],q.n))} / ${q.n}${S.c[i]?'':' · tap to play'}</span></button>`;}).join('');
  const left=24-new Date().getUTCHours();$('#questNote').innerHTML=S.b?'All done today! New quests in '+left+'h.':'Finish all three for a <b>+'+QBONUS+' coin</b> bonus · new quests in '+left+'h';}
document.addEventListener('click',e=>{const q=e.target.closest('[data-quest]');if(!q)return;const gm=GAMES.find(x=>x.id===q.dataset.quest);
  if(gm)startGame(gm.make?gm.make():gm);else{const el=document.querySelector('#grid');el&&el.scrollIntoView({behavior:'smooth'});}});
/* ---------- faces and shirt art are drawn on canvases ---------- */
const AVTEX=new Map();
function faceTex(face,skin){const key='f|'+face+'|'+skin;if(AVTEX.has(key))return AVTEX.get(key);
  const c=document.createElement('canvas');c.width=c.height=128;const g=c.getContext('2d');g.fillStyle=skin;g.fillRect(0,0,128,128);
  const ink='#1b1b1b';g.fillStyle=ink;g.strokeStyle=ink;g.lineWidth=7;g.lineCap='round';
  const eyes=()=>{g.beginPath();g.ellipse(44,52,7,11,0,0,7);g.ellipse(84,52,7,11,0,0,7);g.fill();};
  const smile=(r,a0,a1)=>{g.beginPath();g.arc(64,64,r||26,(a0||.25)*Math.PI,(a1||.75)*Math.PI);g.stroke();};
  switch(face){
    case 'grin':eyes();g.beginPath();g.arc(64,66,28,0,Math.PI);g.closePath();g.fill();g.fillStyle='#fff';g.fillRect(44,66,40,9);break;
    case 'wink':g.beginPath();g.ellipse(44,52,7,11,0,0,7);g.fill();g.beginPath();g.moveTo(74,54);g.lineTo(94,50);g.stroke();smile();break;
    case 'shocked':eyes();g.beginPath();g.ellipse(64,90,11,15,0,0,7);g.fill();break;
    case 'angry':eyes();g.beginPath();g.moveTo(32,34);g.lineTo(54,44);g.moveTo(96,34);g.lineTo(74,44);g.stroke();g.beginPath();g.arc(64,104,22,1.2*Math.PI,1.8*Math.PI);g.stroke();break;
    case 'blush':eyes();smile();g.fillStyle='rgba(255,82,120,.55)';g.beginPath();g.ellipse(28,76,11,7,0,0,7);g.ellipse(100,76,11,7,0,0,7);g.fill();break;
    case 'mustache':eyes();g.beginPath();g.ellipse(50,82,16,7,.25,0,7);g.ellipse(78,82,16,7,-.25,0,7);g.fill();break;
    case 'shades':g.fillStyle='#111';g.fillRect(22,40,38,22);g.fillRect(68,40,38,22);g.fillRect(56,44,16,6);g.fillStyle='rgba(255,255,255,.45)';g.fillRect(26,44,10,6);g.fillRect(72,44,10,6);smile(22);break;
    case 'stars':{const st=(x,y)=>{g.fillStyle='#ffca28';g.beginPath();for(let i=0;i<10;i++){const r=i%2?6:15,a=i*Math.PI/5-Math.PI/2;g.lineTo(x+Math.cos(a)*r,y+Math.sin(a)*r);}g.fill();};st(44,52);st(84,52);g.fillStyle=ink;smile();break;}
    case 'zombie':g.fillStyle='#7cb342';g.fillRect(0,0,128,128);g.fillStyle=ink;g.fillRect(36,46,16,12);g.fillRect(78,40,16,18);g.beginPath();g.moveTo(40,92);for(let i=0;i<6;i++)g.lineTo(44+i*8,i%2?84:96);g.stroke();break;
    case 'ninja':g.fillStyle='#212121';g.fillRect(0,0,128,128);g.fillStyle=skin;g.fillRect(14,38,100,30);g.fillStyle=ink;g.beginPath();g.ellipse(44,53,7,8,0,0,7);g.ellipse(84,53,7,8,0,0,7);g.fill();break;
    case 'robot':g.fillStyle='#90a4ae';g.fillRect(0,0,128,128);g.fillStyle='#263238';g.fillRect(16,38,96,28);g.fillStyle='#22d3ee';g.fillRect(24,46,80,10);g.fillStyle='#455a64';for(let i=0;i<5;i++)g.fillRect(36+i*12,86,7,16);break;
    case 'vampire':g.fillStyle='#e0e0e0';g.fillRect(0,0,128,128);g.fillStyle=ink;g.beginPath();g.moveTo(30,46);g.lineTo(56,54);g.lineTo(30,58);g.fill();g.beginPath();g.moveTo(98,46);g.lineTo(72,54);g.lineTo(98,58);g.fill();
      g.fillStyle='#b71c1c';g.beginPath();g.ellipse(44,54,4,4,0,0,7);g.ellipse(84,54,4,4,0,0,7);g.fill();g.fillStyle=ink;g.fillRect(44,84,40,6);g.fillStyle='#fff';g.beginPath();g.moveTo(50,90);g.lineTo(54,102);g.lineTo(58,90);g.moveTo(70,90);g.lineTo(74,102);g.lineTo(78,90);g.fill();break;
    case 'catface':eyes();g.beginPath();g.moveTo(52,80);g.quadraticCurveTo(58,90,64,80);g.quadraticCurveTo(70,90,76,80);g.stroke();g.lineWidth=3;[[20,72,46,76],[20,84,46,82],[108,72,82,76],[108,84,82,82]].forEach(([a,b,c2,d])=>{g.beginPath();g.moveTo(a,b);g.lineTo(c2,d);g.stroke();});g.fillStyle='#f06292';g.beginPath();g.moveTo(58,72);g.lineTo(70,72);g.lineTo(64,79);g.fill();break;
    case 'sleepy':g.beginPath();g.moveTo(34,54);g.quadraticCurveTo(44,62,54,54);g.moveTo(74,54);g.quadraticCurveTo(84,62,94,54);g.stroke();g.beginPath();g.ellipse(64,90,8,6,0,0,7);g.stroke();g.font='bold 22px sans-serif';g.fillText('z',100,30);g.fillText('Z',110,16);break;
    case 'tongue':eyes();smile();g.fillStyle='#ff5c8a';g.beginPath();g.ellipse(70,96,10,12,0,0,7);g.fill();break;
    case 'hearteyes':{const ht=(x,y)=>{g.fillStyle='#ff1744';g.beginPath();g.moveTo(x,y+12);g.bezierCurveTo(x-18,y-2,x-8,y-16,x,y-6);g.bezierCurveTo(x+8,y-16,x+18,y-2,x,y+12);g.fill();};ht(44,52);ht(84,52);g.fillStyle=ink;smile(24);break;}
    case 'skull':g.fillStyle='#eceff1';g.fillRect(0,0,128,128);g.fillStyle=ink;g.beginPath();g.ellipse(42,54,14,16,0,0,7);g.ellipse(86,54,14,16,0,0,7);g.fill();g.beginPath();g.moveTo(64,72);g.lineTo(56,86);g.lineTo(72,86);g.fill();for(let i=0;i<5;i++)g.fillRect(40+i*10,98,6,14);break;
    default:eyes();smile();}
  const t=new THREE.CanvasTexture(c);const m=new THREE.MeshStandardMaterial({map:t,roughness:.8});m.userData.shared=true;AVTEX.set(key,m);return m;}
function artTex(art,shirtCol){const key='a|'+art+'|'+shirtCol;if(AVTEX.has(key))return AVTEX.get(key);
  const c=document.createElement('canvas');c.width=c.height=128;const g=c.getContext('2d');g.fillStyle=shirtCol;g.fillRect(0,0,128,128);
  switch(art){
    case 'stripes':g.fillStyle='rgba(255,255,255,.75)';for(let y=8;y<128;y+=28)g.fillRect(0,y,128,12);break;
    case 'star':g.fillStyle='#ffd54f';g.beginPath();for(let i=0;i<10;i++){const r=i%2?18:42,a=i*Math.PI/5-Math.PI/2;g.lineTo(64+Math.cos(a)*r,66+Math.sin(a)*r);}g.fill();break;
    case 'heart':g.fillStyle='#ff4d6d';g.beginPath();g.moveTo(64,104);g.bezierCurveTo(10,64,30,18,64,46);g.bezierCurveTo(98,18,118,64,64,104);g.fill();break;
    case 'flame':{const gr=g.createLinearGradient(0,128,0,30);gr.addColorStop(0,'#ff3d00');gr.addColorStop(1,'#ffd600');g.fillStyle=gr;g.beginPath();g.moveTo(0,128);
      for(let i=0;i<=8;i++)g.lineTo(i*16,i%2?50+(i*13)%30:90);g.lineTo(128,128);g.fill();break;}
    case 'bolt':g.fillStyle='#ffeb3b';g.beginPath();g.moveTo(74,10);g.lineTo(36,70);g.lineTo(62,70);g.lineTo(50,118);g.lineTo(94,52);g.lineTo(66,52);g.closePath();g.fill();break;
    case 'skeleton':g.fillStyle='#212121';g.fillRect(0,0,128,128);g.fillStyle='#eeeeee';g.fillRect(60,8,8,112);for(let i=0;i<5;i++){g.fillRect(28,24+i*18,72,6);}break;
    case 'checks':for(let y=0;y<4;y++)for(let x=0;x<4;x++)if((x+y)%2){g.fillStyle='#111';g.fillRect(x*32,y*32,32,32);}break;
    case 'camo':['#558b2f','#33691e','#827717','#3e2723'].forEach((c2,i)=>{g.fillStyle=c2;for(let k=0;k<7;k++){g.beginPath();g.ellipse((k*47+i*29)%128,(k*71+i*37)%128,18,11,(k+i)*.7,0,7);g.fill();}});break;
    case 'smiley':g.fillStyle='#ffeb3b';g.beginPath();g.arc(64,64,40,0,7);g.fill();g.fillStyle='#111';g.beginPath();g.arc(50,54,5,0,7);g.arc(78,54,5,0,7);g.fill();g.strokeStyle='#111';g.lineWidth=5;g.beginPath();g.arc(64,66,22,.2*Math.PI,.8*Math.PI);g.stroke();break;
    case 'rainbow':['#e53935','#fb8c00','#fdd835','#43a047','#1e88e5','#8e24aa'].forEach((c2,i)=>{g.fillStyle=c2;g.fillRect(0,i*21.4,128,22);});break;
    case 'galaxy':{g.fillStyle='#1a1240';g.fillRect(0,0,128,128);const gr=g.createRadialGradient(64,64,4,64,64,70);gr.addColorStop(0,'rgba(214,140,255,.9)');gr.addColorStop(1,'rgba(30,20,80,0)');g.fillStyle=gr;g.fillRect(0,0,128,128);
      g.fillStyle='#fff';for(let i=0;i<40;i++)g.fillRect((i*53)%128,(i*97)%128,i%5?2:3,i%5?2:3);break;}}
  const t=new THREE.CanvasTexture(c);const m=new THREE.MeshStandardMaterial({map:t,roughness:.85});m.userData.shared=true;AVTEX.set(key,m);return m;}
/* ---------- 3D accessories, built from simple shapes ---------- */
const TORUS=new THREE.TorusGeometry(.5,.08,10,28),CONE=new THREE.ConeGeometry(.5,1,24);
function avAccessory(id,u){const G=new THREE.Group();
  const M=(geo,col,o)=>{const m=new THREE.Mesh(geo,mat(col,o));m.castShadow=true;G.add(m);return m;};
  const B=(w,h,d,col,x,y,z,o)=>{const m=M(BOX,col,o);m.scale.set(w,h,d);m.position.set(x,y,z);return m;};
  const C=(w,h,col,x,y,z,o)=>{const m=M(CYLY,col,o);m.scale.set(w,h,w);m.position.set(x,y,z);return m;};
  const K=(w,h,col,x,y,z,o)=>{const m=M(CONE,col,o);m.scale.set(w,h,w);m.position.set(x,y,z);return m;};
  const S=(r,col,x,y,z,o)=>{const m=M(SPH,col,o);m.scale.setScalar(r);m.position.set(x,y,z);return m;};
  const T=2.75,F=.63;   // top of head, front of head
  switch(id){
    case 'cap':B(1.35,.35,1.35,'#e53935',0,T+.12,0);B(1.2,.12,.8,'#c62828',0,T,.95);break;
    case 'beanie':C(1.42,.6,'#5e35b1',0,T+.15,0);S(.4,'#ede7f6',0,T+.55,0);break;
    case 'party':K(.9,1.2,'#ec407a',0,T+.6,0);S(.25,'#ffeb3b',0,T+1.22,0);break;
    case 'cone':K(1,1.5,'#ff6d00',0,T+.75,0);C(1.2,.1,'#ff6d00',0,T+.02,0);C(.62,.18,'#ffffff',0,T+.75,0);break;
    case 'chef':C(1.2,.5,'#ffffff',0,T+.25,0);S(1.4,'#ffffff',0,T+.8,0);break;
    case 'headphones':B(1.5,.15,.3,'#212121',0,T+.08,0);B(.25,.7,.7,'#e53935',-.72,2.2,0);B(.25,.7,.7,'#e53935',.72,2.2,0);break;
    case 'tophat':C(1.7,.1,'#111111',0,T+.05,0);C(1.1,1.1,'#111111',0,T+.6,0);C(1.12,.2,'#c62828',0,T+.2,0);break;
    case 'bunny':B(.28,1.1,.12,'#fafafa',-.32,T+.55,0);B(.28,1.1,.12,'#fafafa',.32,T+.55,0);B(.14,.7,.13,'#f8bbd0',-.32,T+.5,.01);B(.14,.7,.13,'#f8bbd0',.32,T+.5,.01);break;
    case 'cowboy':C(2.2,.1,'#8d6e63',0,T+.05,0);C(1.15,.7,'#8d6e63',0,T+.4,0);C(1.17,.15,'#4e342e',0,T+.15,0);break;
    case 'propeller':S(1.35,'#1e88e5',0,T-.05,0);C(.08,.4,'#fdd835',0,T+.7,0);{const bl=B(1.6,.05,.22,'#e53935',0,T+.9,0);G.userData.spin=bl;}break;
    case 'wizard':C(2,.1,'#3949ab',0,T+.05,0);K(1.15,1.9,'#3949ab',0,T+1,0);S(.2,'#ffd54f',.1,T+1.1,.5,{neon:true});break;
    case 'viking':S(1.42,'#9e9e9e',0,T-.12,0,{metal:.4});K(.3,.8,'#fff8e1',-.75,T+.35,0).rotation.z=.7;K(.3,.8,'#fff8e1',.75,T+.35,0).rotation.z=-.7;break;
    case 'pumpkin':S(1.75,'#ff8f00',0,2.15,0);B(.15,.35,.15,'#33691e',0,3.1,0);B(.35,.25,.05,'#3e2723',-.32,2.3,.86);B(.35,.25,.05,'#3e2723',.32,2.3,.86);B(.7,.15,.05,'#3e2723',0,1.85,.86);break;
    case 'crown':{const g='#ffca28';C(1.3,.35,g,0,T+.17,0,{metal:.5});for(let i=0;i<5;i++){const a=i*Math.PI*2/5;K(.25,.4,g,Math.cos(a)*.55,T+.52,Math.sin(a)*.55,{metal:.5});}
      S(.18,'#e53935',0,T+.2,.66,{neon:true});S(.15,'#1e88e5',.5,T+.2,.42,{neon:true});S(.15,'#43a047',-.5,T+.2,.42,{neon:true});break;}
    case 'halo':{const m=M(TORUS,'#ffe082',{neon:true});m.rotation.x=Math.PI/2;m.position.set(0,T+.7,0);m.scale.setScalar(1.3);break;}
    case 'astro':{const m=new THREE.Mesh(SPH,new THREE.MeshStandardMaterial({color:0xbfe8ff,transparent:true,opacity:.35,roughness:.1}));m.scale.setScalar(2.3);m.position.set(0,2.15,0);G.add(m);C(1.8,.35,'#eceff1',0,1.45,0);break;}
    case 'shadow':{K(.32,1.1,'#212121',-.6,T+.45,0).rotation.z=.45;K(.32,1.1,'#212121',.6,T+.45,0).rotation.z=-.45;S(.18,'#ff1744',-.75,T+.95,0,{neon:true});S(.18,'#ff1744',.75,T+.95,0,{neon:true});
      const r=M(TORUS,'#d50000',{neon:true});r.rotation.x=Math.PI/2;r.position.set(0,T+.15,0);r.scale.setScalar(1.45);break;}
    case 'backpack':B(1.4,1.6,.6,'#43a047',0,.5,-.8);B(1,.5,.15,'#2e7d32',0,.2,-1.15);break;
    case 'cape':{const c=B(1.9,2.6,.1,'#d50000',0,.1,-.6);c.rotation.x=-.12;break;}
    case 'sword':{const s=B(.25,2.8,.15,'#90a4ae',.2,.6,-.6,{metal:.6});s.rotation.z=.6;const h=B(.9,.2,.2,'#6d4c41',-.5,1.6,-.6);h.rotation.z=.6;break;}
    case 'guitar':{const b=B(1.2,1.1,.35,'#e53935',.3,-.1,-.7);b.rotation.z=-.4;const n=B(.25,1.8,.2,'#4e342e',-.2,1.2,-.7);n.rotation.z=-.4;break;}
    case 'jetpack':C(.6,1.6,'#b0bec5',-.45,.5,-.85,{metal:.5});C(.6,1.6,'#b0bec5',.45,.5,-.85,{metal:.5});K(.5,.5,'#ff6d00',-.45,-.5,-.85,{neon:true}).rotation.x=Math.PI;K(.5,.5,'#ff6d00',.45,-.5,-.85,{neon:true}).rotation.x=Math.PI;break;
    case 'batwings':case 'angel':case 'dragon':{const col=id==='angel'?'#ffffff':id==='batwings'?'#311b92':id==='dragon'?'#2e7d32':'#212121';const sc=id==='dragon'?1.5:1.1;
      for(const sd of [-1,1]){const w=new THREE.Group();w.position.set(sd*.6,1,-.6);G.add(w);
        for(let i=0;i<3;i++){const f=new THREE.Mesh(BOX,mat(i===2&&id==='dragon'?'#c62828':col));f.scale.set(1.3*sc,.4*sc+i*.15,.08);f.position.set(sd*(.7+i*.35)*sc,.3-i*.35,0);f.rotation.z=sd*(.5-i*.3);f.castShadow=true;w.add(f);}
        G.userData['w'+(sd<0?'L':'R')]=w;}break;}
    case 'witchhat':C(2.1,.1,'#311b92',0,T+.05,0);K(1.1,2,'#311b92',0,T+1.05,0).rotation.z=-.15;C(1.15,.2,'#ff6d00',0,T+.2,0);break;
    case 'candybag':{const b2=B(1.3,1.3,.9,'#ff6d00',0,.3,-.85);S(.25,'#e91e63',-.3,1.1,-.85);S(.25,'#76ff03',.3,1.15,-.85);S(.22,'#00e5ff',0,1.2,-.85);B(.9,.15,.92,'#212121',0,.75,-.85);break;}
    case 'santa':C(1.42,.3,'#ffffff',0,T+.1,0);K(1.2,1.3,'#d50000',0,T+.85,0).rotation.z=-.35;S(.32,'#ffffff',.45,T+1.4,0);break;
    case 'pirate':{const h=B(2,.5,1,'#212121',0,T+.25,0);B(.5,.4,.05,'#fafafa',0,T+.3,.52);break;}
    case 'catears':K(.45,.6,'#ffa726',-.45,T+.25,0);K(.45,.6,'#ffa726',.45,T+.25,0);K(.22,.35,'#f8bbd0',-.45,T+.22,.08);K(.22,.35,'#f8bbd0',.45,T+.22,.08);break;
    case 'flower':for(let i=0;i<8;i++){const a=i*Math.PI/4;S(.32,['#f48fb1','#fff59d','#ce93d8','#ffffff'][i%4],Math.cos(a)*.62,T+.12,Math.sin(a)*.62);}break;
    case 'antlers':for(const sd of [-1,1]){B(.14,.9,.14,'#6d4c41',sd*.45,T+.45,0).rotation.z=-sd*.3;B(.12,.45,.12,'#6d4c41',sd*.75,T+.75,0).rotation.z=-sd*1.1;}S(.28,'#e53935',0,1.95,.68,{neon:true});break;
    case 'unicorn':{const k=K(.35,1.1,'#fff59d',0,T+.4,.35,{neon:true});k.rotation.x=.35;break;}
    case 'knight':B(1.45,1.45,1.45,'#9e9e9e',0,2.15,0,{metal:.6});B(1.1,.12,.05,'#212121',0,2.2,.74);K(.25,.6,'#d50000',0,T+.4,0);break;
    case 'icecrown':{for(let i=0;i<6;i++){const a=i*Math.PI/3;K(.22,.7+(i%2)*.3,'#b3e5fc',Math.cos(a)*.55,T+.35,Math.sin(a)*.55,{transp:.2,neon:true});}C(1.3,.2,'#e1f5fe',0,T+.1,0,{metal:.3});break;}
    case 'ufo':{const u2=new THREE.Group();u2.position.set(0,T+1.3,0);G.add(u2);const d=new THREE.Mesh(SPH,mat('#90a4ae',{metal:.6}));d.scale.set(1.5,.35,1.5);u2.add(d);const dm=new THREE.Mesh(SPH,mat('#80deea',{transp:.3}));dm.scale.set(.6,.45,.6);dm.position.y=.2;u2.add(dm);G.userData.spin=u2;break;}
    case 'firecrown':{for(let i=0;i<7;i++){const a=i*Math.PI*2/7;K(.28,.8,i%2?'#ff6d00':'#ffd600',Math.cos(a)*.55,T+.4,Math.sin(a)*.55,{neon:true});}const r=M(TORUS,'#ff3d00',{neon:true});r.rotation.x=Math.PI/2;r.position.set(0,T+.1,0);r.scale.setScalar(1.3);break;}
    case 'shield':{const m=C(1.7,.15,'#1565c0',0,.5,-.7,{metal:.3});m.rotation.x=Math.PI/2;const b2=C(.5,.2,'#ffca28',0,.5,-.8,{metal:.5});b2.rotation.x=Math.PI/2;break;}
    case 'surf':{const b2=B(.9,3.4,.15,'#00bcd4',0,.6,-.7);b2.rotation.z=.25;B(.95,.25,.17,'#ff7043',0,.6,-.7).rotation.z=.25;break;}
    case 'bfly':case 'phoenix':{const cols=id==='bfly'?['#ba68c8','#4fc3f7']:['#ff6d00','#ffd600'];for(const sd of [-1,1]){const w=new THREE.Group();w.position.set(sd*.5,1,-.6);G.add(w);
        const a2=new THREE.Mesh(SPH,mat(cols[0],id==='phoenix'?{neon:true}:{}));a2.scale.set(1.3*(id==='phoenix'?1.5:1),1.1,.08);a2.position.set(sd*1,.4,0);w.add(a2);
        const b3=new THREE.Mesh(SPH,mat(cols[1],id==='phoenix'?{neon:true}:{}));b3.scale.set(.9,.8,.08);b3.position.set(sd*.8,-.6,0);w.add(b3);G.userData['w'+(sd<0?'L':'R')]=w;}break;}
    case 'rcape':{['#e53935','#fb8c00','#fdd835','#43a047','#1e88e5','#8e24aa'].forEach((c2,i)=>{const c3=B(1.9,.44,.1,c2,0,1.2-i*.44,-.6-i*.03);c3.rotation.x=-.12;});break;}
    case 'tie':B(.3,.25,.1,'#1565c0',0,1.3,.56);B(.35,1,.08,'#1565c0',0,.7,.55);break;
    case 'lei':for(let i=0;i<10;i++){const a=i*Math.PI/5;S(.3,['#ff4081','#ffeb3b','#ffffff','#ff9100'][i%4],Math.cos(a)*.95,1.45,Math.sin(a)*.6+.05);}break;
    case 'pearls':for(let i=0;i<9;i++){const a=Math.PI*.15+i*Math.PI*.7/8;S(.18,'#fafafa',Math.cos(a)*.75,1.35-Math.sin(a)*.45,.56,{metal:.3});}break;
    case 'batpet':{const p=new THREE.Group();p.position.set(1.6,3.1,0);G.add(p);const add=(w,h,d,c,x,y,z)=>{const m=new THREE.Mesh(BOX,mat(c));m.scale.set(w,h,d);m.position.set(x,y,z);p.add(m);return m;};
      add(.45,.45,.45,'#212121',0,0,0);add(.12,.25,.08,'#212121',-.15,.32,0);add(.12,.25,.08,'#212121',.15,.32,0);add(.08,.08,.05,'#ff1744',-.1,.05,.24);add(.08,.08,.05,'#ff1744',.1,.05,.24);
      const wl=add(.7,.05,.35,'#311b92',-.5,.05,0),wr=add(.7,.05,.35,'#311b92',.5,.05,0);G.userData.wL=wl;G.userData.wR=wr;G.userData.pet=p;break;}
    case 'puppy':case 'bunnypet':case 'penguin':case 'ghostpet':case 'robopet':{const p=new THREE.Group();p.position.set(1.5,2.72,0);G.add(p);const add=(w,h,d,c,x,y,z,o)=>{const m=new THREE.Mesh(id==='ghostpet'?SPH:BOX,mat(c,o));m.scale.set(w,h,d);m.position.set(x,y,z);p.add(m);return m;};
      if(id==='puppy'){add(.6,.5,.9,'#a1887f',0,0,0);add(.55,.5,.5,'#a1887f',0,.4,.4);add(.15,.35,.12,'#5d4037',-.3,.45,.35);add(.15,.35,.12,'#5d4037',.3,.45,.35);add(.15,.12,.12,'#212121',0,.35,.68);}
      if(id==='bunnypet'){add(.6,.55,.7,'#fafafa',0,0,0);add(.5,.45,.45,'#fafafa',0,.4,.3);add(.12,.5,.08,'#fafafa',-.12,.85,.3);add(.12,.5,.08,'#fafafa',.12,.85,.3);}
      if(id==='penguin'){add(.6,.8,.55,'#212121',0,.1,0);add(.45,.6,.1,'#fafafa',0,.05,.28);add(.18,.1,.2,'#ff9800',0,.35,.35);}
      if(id==='ghostpet'){add(.8,.9,.8,'#f5f5f5',0,.1,0,{transp:.25});add(.12,.18,.05,'#212121',-.15,.25,.38);add(.12,.18,.05,'#212121',.15,.25,.38);}
      if(id==='robopet'){add(.6,.6,.6,'#90a4ae',0,0,0,{metal:.6});add(.4,.12,.05,'#00e5ff',0,.1,.31,{neon:true});add(.05,.35,.05,'#424242',0,.45,0);add(.14,.14,.14,'#ff1744',0,.65,0,{neon:true});}
      G.userData.pet=p;break;}
    case 'scarf':B(2.1,.35,1.15,'#e53935',0,1.42,0);B(.4,1,.12,'#e53935',.5,.95,.6);break;
    case 'bowtie':B(.45,.35,.12,'#c2185b',-.25,1.35,.56);B(.45,.35,.12,'#c2185b',.25,1.35,.56);B(.18,.2,.15,'#880e4f',0,1.35,.58);break;
    case 'medal':B(.1,.8,.06,'#1e88e5',-.25,1.1,.53).rotation.z=-.3;B(.1,.8,.06,'#e53935',.25,1.1,.53).rotation.z=.3;C(.5,.08,'#ffca28',0,.75,.56,{metal:.5}).rotation.x=Math.PI/2;break;
    case 'chain':{const m=M(TORUS,'#ffd54f',{metal:.6});m.scale.set(1.4,1.6,1.4);m.rotation.x=1.25;m.position.set(0,1.05,.15);S(.32,'#ffd54f',0,.55,.6,{metal:.6});break;}
    case 'parrot':{const p=new THREE.Group();p.position.set(1.5,2.75,0);G.add(p);const pb=new THREE.Mesh(BOX,mat('#43a047'));pb.scale.set(.6,.8,.6);p.add(pb);
      const ph=new THREE.Mesh(BOX,mat('#e53935'));ph.scale.set(.5,.45,.5);ph.position.set(0,.55,.05);p.add(ph);const bk=new THREE.Mesh(BOX,mat('#ffca28'));bk.scale.set(.15,.15,.25);bk.position.set(0,.5,.35);p.add(bk);
      const tl=new THREE.Mesh(BOX,mat('#1e88e5'));tl.scale.set(.3,.6,.15);tl.position.set(0,-.5,-.3);tl.rotation.x=.5;p.add(tl);G.userData.pet=p;break;}
    case 'kitty':{const p=new THREE.Group();p.position.set(1.5,2.7,0);G.add(p);const add=(w,h,d,c,x,y,z)=>{const m=new THREE.Mesh(BOX,mat(c));m.scale.set(w,h,d);m.position.set(x,y,z);p.add(m);};
      add(.6,.5,.9,'#ffa726',0,0,0);add(.55,.5,.5,'#ffa726',0,.4,.4);add(.15,.2,.1,'#ffa726',-.18,.72,.4);add(.15,.2,.1,'#ffa726',.18,.72,.4);add(.12,.12,.6,'#ffa726',0,.1,-.6);G.userData.pet=p;break;}
    case 'dragonpet':{const p=new THREE.Group();p.position.set(1.55,2.8,0);G.add(p);const add=(w,h,d,c,x,y,z,o)=>{const m=new THREE.Mesh(BOX,mat(c,o));m.scale.set(w,h,d);m.position.set(x,y,z);p.add(m);return m;};
      add(.6,.6,.9,'#7e57c2',0,0,0);add(.5,.45,.55,'#7e57c2',0,.45,.45);add(.2,.12,.2,'#ff6d00',0,.4,.8,{neon:true});add(.9,.06,.4,'#b39ddb',-.6,.2,0).rotation.z=.4;add(.9,.06,.4,'#b39ddb',.6,.2,0).rotation.z=-.4;G.userData.pet=p;break;}
  }
  return G;}
/* makeAvatar accepts a shirt color (old style) or a full outfit */
function makeAvatar(spec){
  const av=typeof spec==='object'&&spec?avClean(spec):Object.assign(avClean(P&&P.avatar?P.avatar:WALLET.av),hexOk(spec)?{shirt:spec,art:''}:{});
  const g=new THREE.Group();const body=new THREE.Group();g.add(body);
  const skin=mat(av.skin),sh=mat(av.shirt),pants=mat(av.pants);
  const bx=(w,h,d,m,x,y,z,parent)=>{const me=new THREE.Mesh(BOX,m);me.scale.set(w,h,d);me.position.set(x,y,z);me.castShadow=true;(parent||body).add(me);return me;};
  bx(2,2,1,av.art?[sh,sh,sh,sh,artTex(av.art,av.shirt),sh]:sh,0,.5,0);
  const head=new THREE.Mesh(BOX,[skin,skin,skin,skin,faceTex(av.face,av.skin),skin]);head.scale.set(1.25,1.25,1.25);head.position.set(0,2.1,0);head.castShadow=true;body.add(head);
  const pv=(x,y)=>{const p=new THREE.Group();p.position.set(x,y,0);body.add(p);return p;};
  const lArm=pv(-1.5,1.4),rArm=pv(1.5,1.4),lLeg=pv(-.5,-.5),rLeg=pv(.5,-.5);
  bx(1,2,1,skin,0,-.9,0,lArm);bx(1,2,1,skin,0,-.9,0,rArm);bx(1,2,1,pants,0,-1,0,lLeg);bx(1,2,1,pants,0,-1,0,rLeg);
  const acc=[];for(const [s] of AV_SLOTS){if(s==='art'||!av[s])continue;const a=avAccessory(av[s]);body.add(a);acc.push(a);}
  g.userData={lArm,rArm,lLeg,rLeg,head,body,acc,av};
  return g;}
/* small animations for propellers, wings and pets */
function animateAcc(model,tt){const u=model&&model.userData;if(!u||!u.acc||!u.acc.length)return;
  for(const a of u.acc){const d=a.userData;if(d.spin)d.spin.rotation.y=tt*14;if(d.wL){d.wL.rotation.y=-.25-Math.sin(tt*3)*.18;d.wR.rotation.y=.25+Math.sin(tt*3)*.18;}if(d.pet)d.pet.position.y=(d.pet.userData.baseY??(d.pet.userData.baseY=d.pet.position.y))+Math.sin(tt*2.5)*.06;}}
function avPacked(){return WALLET.av;}
/* ---------- the avatar editor ---------- */
const AVE={open:false,tab:'body',renderer:null,scene:null,cam:null,model:null,yaw:-.35,drag:null,raf:0};
function openAvatarEditor(){
  AVE.open=true;const el=$('#avatarPanel');el.hidden=false;
  if(!AVE.renderer){const cv2=$('#avCanvas');AVE.renderer=new THREE.WebGLRenderer({canvas:cv2,antialias:true,alpha:true});AVE.renderer.setPixelRatio(Math.min(2,devicePixelRatio||1));
    AVE.scene=new THREE.Scene();AVE.scene.add(new THREE.HemisphereLight(0xffffff,0x445566,1.1));const dl=new THREE.DirectionalLight(0xffffff,.9);dl.position.set(4,8,6);AVE.scene.add(dl);
    const ped=new THREE.Mesh(CYLY,new THREE.MeshStandardMaterial({color:0x2a3550,roughness:.7}));ped.scale.set(5,.4,5);ped.position.y=-3.2;AVE.scene.add(ped);
    AVE.cam=new THREE.PerspectiveCamera(32,1,.1,100);AVE.cam.position.set(0,1.4,19);AVE.cam.lookAt(0,.5,0);
    cv2.addEventListener('pointerdown',e=>{AVE.drag={x:e.clientX};AVE.touched=true;cv2.setPointerCapture(e.pointerId);});
    cv2.addEventListener('pointermove',e=>{if(!AVE.drag)return;AVE.yaw+=(e.clientX-AVE.drag.x)*.012;AVE.drag.x=e.clientX;});
    cv2.addEventListener('pointerup',()=>{AVE.drag=null;});}
  avRebuild();avRenderUI();
  const tick=()=>{if(!AVE.open)return;AVE.raf=requestAnimationFrame(tick);const c=$('#avCanvas');const w=c.clientWidth,h=c.clientHeight;
    if(c.width!==Math.round(w*AVE.renderer.getPixelRatio())||c.height!==Math.round(h*AVE.renderer.getPixelRatio())){AVE.renderer.setSize(w,h,false);AVE.cam.aspect=w/Math.max(1,h);AVE.cam.updateProjectionMatrix();}
    if(!AVE.drag&&!AVE.touched)AVE.yaw=Math.sin(performance.now()/2600)*.6;if(AVE.model){AVE.model.rotation.y=AVE.yaw;animateAcc(AVE.model,performance.now()/1000);}AVE.renderer.render(AVE.scene,AVE.cam);};tick();}
function closeAvatarEditor(){AVE.open=false;cancelAnimationFrame(AVE.raf);$('#avatarPanel').hidden=true;}
function avRebuild(){if(AVE.model)AVE.scene.remove(AVE.model);AVE.model=makeAvatar(WALLET.av);AVE.model.position.y=-.4;AVE.scene.add(AVE.model);}
function avRenderUI(){
  $('#avTabs').innerHTML=[['body','Colors'],...AV_SLOTS].map(([k,l])=>`<button type="button" class="chip${AVE.tab===k?' on':''}" data-avtab="${k}" aria-pressed="${AVE.tab===k}">${l}</button>`).join('');
  const box=$('#avItems');
  if(AVE.tab==='body'){const row=(k,lbl,cols)=>`<div class="avrow"><span class="lbl">${lbl}</span><div class="avsw">${cols.map(c=>`<button type="button" class="sw" style="background:${c}" data-avcol="${k}" data-c="${c}" aria-label="${lbl} ${c}" aria-pressed="${WALLET.av[k]===c}"></button>`).join('')}
      <label class="avpick" title="Any color"><input type="color" data-avpick="${k}" value="${WALLET.av[k]}" aria-label="Any ${lbl.toLowerCase()} color"></label></div></div>`;
    box.innerHTML=row('skin','Skin',AV_SKINS)+row('shirt','Shirt',AV_COLS)+row('pants','Pants',AV_COLS)+`<p class="avnote">Colors are always free. Earn coins by playing games to buy hats, faces, wings, pets and more.</p>`;}
  else{const list=AV_ITEMS.filter(i=>i.slot===AVE.tab).sort((a,b)=>a.price-b.price);
    box.innerHTML=`<div class="avgrid">${(AVE.tab!=='face'?[{id:'',name:'None',emo:'✖️',price:0}]:[]).concat(list).map(i=>{const own=!i.id||WALLET.owned.has(i.id),on=(WALLET.av[AVE.tab]||'')===i.id;
      return `<button type="button" class="avitem${on?' on':''}${own?'':' locked'}" data-avitem="${i.id}"><span class="emo">${i.emo}</span><span class="nm">${esc(i.name)}</span><span class="pr">${on?'Wearing':own?(i.price?'Owned':'Free'):'🪙 '+i.price.toLocaleString('en-US')}</span></button>`;}).join('')}</div>`;}
  renderCoins();}
function avSet(k,v){WALLET.av[k]=v;if(k==='shirt')store.set('shirt',v);walletSave();avRebuild();avRenderUI();if(running&&P.model&&!P.dead)setShirt(null,true);MP.lastSent='';}
document.addEventListener('click',e=>{
  const tb=e.target.closest('[data-avtab]');if(tb){AVE.tab=tb.dataset.avtab;avRenderUI();return;}
  const cb=e.target.closest('[data-avcol]');if(cb){avSet(cb.dataset.avcol,cb.dataset.c);return;}
  const it=e.target.closest('[data-avitem]');if(it){const id=it.dataset.avitem;const slot=AVE.tab;
    if(!id){avSet(slot,'');return;}const item=AV_BY.get(id);if(!item)return;
    if(!WALLET.owned.has(id)){if(WALLET.coins<item.price){coinToast('You need '+(item.price-WALLET.coins).toLocaleString('en-US')+' more coins. Play games to earn them!');SFX.nope();return;}
      WALLET.coins-=item.price;WALLET.owned.add(id);SFX.win();coinToast('Bought '+item.name+'!');}
    avSet(slot,(WALLET.av[slot]===id&&slot!=='face')?'':id);return;}
  if(e.target.closest('#avatarBtn')){openAvatarEditor();return;}
  if(e.target.closest('[data-avclose]')||e.target.id==='avatarPanel'){closeAvatarEditor();return;}});
document.addEventListener('input',e=>{const p=e.target.closest&&e.target.closest('[data-avpick]');if(p&&hexOk(p.value)){WALLET.av[p.dataset.avpick]=p.value.toLowerCase();avRebuild();}});
document.addEventListener('change',e=>{const p=e.target.closest&&e.target.closest('[data-avpick]');if(p&&hexOk(p.value))avSet(p.dataset.avpick,p.value.toLowerCase());});
addEventListener('keydown',e=>{if(e.key==='Escape'&&AVE.open)closeAvatarEditor();});

/* ---------- player ---------- */
const PHYS={gravity:196.2,walk:16,jump:50};
const SPRINT_X=1.5,BOOST=42;
const PH=new V3(.9,2.5,.9);
const P={pos:new V3(),vel:new V3(),onGround:false,ground:null,coyote:0,jumpBuf:0,dead:false,deadT:0,boost:0,model:null,walk:0,debris:[],yaw:0,padCool:0,
  health:100,maxHealth:100,backpack:[],equipped:null,held:null};
const keys=new Set(); const joy={x:0,y:0}; let jumpHeld=false;
const cam={yaw:.5,pitch:.32,dist:20,cur:20,sens:store.get('sens',1)};

function overlapP(s,e){e=e==null?1e-3:e;
  return P.pos.x-PH.x<s.max.x-e&&P.pos.x+PH.x>s.min.x+e&&P.pos.y-PH.y<s.max.y-e&&P.pos.y+PH.y>s.min.y+e&&P.pos.z-PH.z<s.max.z-e&&P.pos.z+PH.z>s.min.z+e;}
function partOverlap(s,e){
  if(!s.obb)return overlapP(s,e);
  const dx=P.pos.x-s.pos.x,dz=P.pos.z-s.pos.z,c=Math.cos(s.yaw),sn=Math.sin(s.yaw);
  const lx=dx*c-dz*sn,lz=dx*sn+dz*c,ly=P.pos.y-s.pos.y;
  return Math.abs(lx)<s.size.x/2+PH.x-e&&Math.abs(lz)<s.size.z/2+PH.z-e&&Math.abs(ly)<s.size.y/2+PH.y-e;
}
function moveAxis(ax,d,canStep){
  if(!d)return;
  P.pos.setComponent(ax,P.pos.getComponent(ax)+d);
  for(const s of W.solids){
    if(s.obb||s.noCollide||!s.active||!overlapP(s))continue;
    if(ax===1){
      if(d<0){P.pos.y=s.max.y+PH.y;if(P.vel.y<0)P.vel.y=0;P.onGround=true;P.ground=s;}
      else{P.pos.y=s.min.y-PH.y-1e-4;if(P.vel.y>0)P.vel.y=0;}
    }else{
      const step=s.max.y-(P.pos.y-PH.y);
      if(canStep&&step>0&&step<=1.25){P.pos.y=s.max.y+PH.y+1e-3;continue;}
      P.pos.setComponent(ax,d>0?s.min.getComponent(ax)-PH.getComponent(ax)-1e-4:s.max.getComponent(ax)+PH.getComponent(ax)+1e-4);
      if(ax===0)P.vel.x=0;else P.vel.z=0;
    }
  }
}
function resolveOBB(){
  for(const s of W.obbs){
    if(s.noCollide||!s.active)continue;
    const c=Math.cos(s.yaw),sn=Math.sin(s.yaw);
    const dx=P.pos.x-s.pos.x,dz=P.pos.z-s.pos.z;
    let lx=dx*c-dz*sn,lz=dx*sn+dz*c;
    const hx=s.size.x/2+PH.x,hz=s.size.z/2+PH.z;
    if(Math.abs(lx)>=hx||Math.abs(lz)>=hz)continue;
    let top=s.size.y/2;
    if(s.wedge){const f=Math.max(0,Math.min(1,(lz+PH.z)/s.size.z+.5));top=-s.size.y/2+s.size.y*f;}
    const bot=-s.size.y/2,ly=P.pos.y-s.pos.y;
    if(ly-PH.y>=top-1e-4||ly+PH.y<=bot)continue;
    const up=top+PH.y-ly;
    if(up<=1.3&&P.vel.y<=.5){P.pos.y=s.pos.y+top+PH.y;if(P.vel.y<0)P.vel.y=0;P.onGround=true;P.ground=s;continue;}
    const down=ly+PH.y-bot;
    if(down<=1&&P.vel.y>0){P.pos.y=s.pos.y+bot-PH.y-1e-4;P.vel.y=0;continue;}
    const px=hx-Math.abs(lx),pz=hz-Math.abs(lz);
    if(px<pz)lx=Math.sign(lx||1)*hx;else lz=Math.sign(lz||1)*hz;
    P.pos.x=s.pos.x+lx*c+lz*sn;P.pos.z=s.pos.z-lx*sn+lz*c;
  }
}
function physics(dt,ix,iy,sprint){
  if(P.frozen){ix=0;iy=0;sprint=false;P.jumpBuf=0;}
  const fx=-Math.sin(cam.yaw),fz=-Math.cos(cam.yaw),rx=Math.cos(cam.yaw),rz=-Math.sin(cam.yaw);
  let mx=fx*iy+rx*ix,mz=fz*iy+rz*ix;const ml=Math.hypot(mx,mz);if(ml>1){mx/=ml;mz/=ml;}
  const sp=P.boost>0?Math.max(BOOST,PHYS.walk*1.6):(sprint?PHYS.walk*SPRINT_X:PHYS.walk);
  const k=1-Math.exp(-(P.onGround?14:6)*dt);
  P.vel.x+=(mx*sp-P.vel.x)*k;P.vel.z+=(mz*sp-P.vel.z)*k;
  if(P.onGround)P.coyote=.1;else P.coyote-=dt;
  P.jumpBuf-=dt;
  if(P.onGround)P.airLeft=P.airJumps||0;
  if(((P.jumpBuf>0||(jumpHeld&&!P.frozen))&&P.coyote>0&&P.vel.y<=1)||(P.jumpBuf>0&&P.coyote<=0&&P.airLeft>0&&!P.onGround)){
    if(P.coyote<=0)P.airLeft--;P.vel.y=PHYS.jump;P.coyote=0;P.jumpBuf=0;SFX.jump();if(RT.jump&&RT.jump.length)rtFire('jump');}
  P.vel.y=Math.max(P.vel.y-PHYS.gravity*dt,-160);
  if(P.chute&&P.vel.y<-11)P.vel.y+=(-11-P.vel.y)*Math.min(1,dt*6);
  const preVy=P.vel.y;const was=P.onGround;P.onGround=false;P.ground=null;
  moveAxis(0,P.vel.x*dt,was);moveAxis(2,P.vel.z*dt,was);moveAxis(1,P.vel.y*dt,false);
  if(W.obbs.length)resolveOBB();
  if(P.onGround){if(!was){P.landSpeed=Math.max(0,-preVy);if(P.landSpeed>75)juiceShake(Math.min(.6,(P.landSpeed-75)/120));if(P.landSpeed>68&&P.model)try{burstAt(new V3(P.pos.x,P.pos.y-PH.y+.2,P.pos.z),'#d7ccc8');}catch(e){}if(P.chute)setChute(false);}if(!was&&P.airT>.25&&RT.land&&RT.land.length)rtFire('land');P.airT=0;}else P.airT=(P.airT||0)+dt;
}
function respawn(){
  P.debris.forEach(d=>scene.remove(d.m));P.debris=[];P.rag=null;
  if(P.model)scene.remove(P.model);
  P.model=makeAvatar(P.shirtOverride||undefined);scene.add(P.model);P.anim=null;P.baseWhich=null;P.shieldMesh=null;P.bubble=null;P.chute=false;P.chuteMesh=null;P.landSpeed=0;
  if(RT.spawn&&RT.spawn.length)setTimeout(()=>rtFire('spawn'),0);
  P.pos.copy(W.checkpoint||W.spawn);P.vel.set(0,0,0);P.dead=false;P.boost=0;P.onGround=false;P.ground=null;P.health=P.maxHealth;
  P.model.position.copy(P.pos);P.model.rotation.y=P.yaw;
  P.shieldUntil=Math.max(P.shieldUntil||0,t+1.5);
  if(coarse)setTimeout(()=>{try{if(running&&!P.dead&&!P.equipped&&P.backpack.length)equipTool(P.backpack[0]);}catch(e){}},400);
}
function die(kind){
  if(P.dead||state.over)return;
  JU.deaths.push(t);JU.streak=0;juiceShake(.8);
  if(W.stages>0&&!LOBBY.on&&state.stage<W.stages){JU.stageDeaths=(JU.stageDeaths||0)+1;if(JU.stageDeaths>=8)setTimeout(()=>skipBtnShow(true),1600);}
  if(LOBBY.on&&LOBBY.inRound&&LOBBY.cfg.elim&&!LOBBY.out){LOBBY.out=true;W.checkpoint=LOBBY.spot.clone();setTimeout(()=>toast('You are out! Watch from the lobby.','#ffb4b4',2.5),900);MP.lastSent='';}
  if(P.equipped)unequipTool();
  P.dead=true;P.health=0;
  rtFire('died');
  if(kind==='water'){P.deadT=.7;SFX.splash();toast('Splash!');scene.remove(P.model);return;}
  P.deadT=1.5;SFX.die();state.deaths++;
  if(deathStyle()==='ragdoll'&&P.model){P.deadT=2.6;if(!P.rag)P.rag=makeRag(P.model,P.model.userData,P.pos,P.vel.clone().add(new V3((Math.random()-.5)*6,6,(Math.random()-.5)*6)),P.yaw,1,0);P.anim=null;MP.lastSent='';return;}
  P.model.updateMatrixWorld(true);
  const meshes=[];P.model.traverse(o=>{if(o.isMesh)meshes.push(o)});
  meshes.forEach(m=>{scene.attach(m);P.debris.push({m,v:new V3((Math.random()-.5)*26,12+Math.random()*16,(Math.random()-.5)*26),s:new V3(Math.random()*9,Math.random()*9,Math.random()*9)})});
  scene.remove(P.model);
}

function damagePlayer(n){if(P.dead||state.over||!(n>0))return;if(P.shieldUntil>t)return;n=juiceAssist(n);juiceShake(Math.min(.9,.15+n/60));P.health=Math.max(0,P.health-n);if(RT.hurt&&RT.hurt.length)setTimeout(()=>rtFire('hurt'),0);const d=$('#dmg');d.classList.add('on');requestAnimationFrame(()=>requestAnimationFrame(()=>d.classList.remove('on')));
  if(P.health<=0)die('kill');}
function setShirt(c,rebuild){if(!rebuild&&!/^#[0-9a-f]{6}$/i.test(c||''))return;if(c)P.shirtOverride=c;if(!P.model||P.dead)return;
  const old=P.model;const nm=makeAvatar(P.shirtOverride||undefined);nm.position.copy(old.position);nm.rotation.copy(old.rotation);
  if(P.held){P.held.parent&&P.held.parent.remove(P.held);nm.userData.rArm.add(P.held);}if(P.bubble&&P.bubble.parent===old){old.remove(P.bubble);nm.add(P.bubble);}
  if(P.shieldMesh){old.remove(P.shieldMesh);nm.add(P.shieldMesh);}if(P.chuteMesh){old.remove(P.chuteMesh);nm.add(P.chuteMesh);}scene.remove(old);scene.add(nm);P.model=nm;MP.lastSent='';}
function setChute(on,col){on=!!on;if(P.chuteMesh&&P.chuteMesh.parent)P.chuteMesh.parent.remove(P.chuteMesh);P.chuteMesh=null;P.chute=on&&!P.dead;
  if(P.chute&&P.model){const g=new THREE.Group();const c=new THREE.Mesh(new THREE.SphereGeometry(4.2,16,8,0,Math.PI*2,0,Math.PI/2.6),new THREE.MeshLambertMaterial({color:col||'#ff7043',side:THREE.DoubleSide}));c.scale.y=.55;c.position.y=7.2;g.add(c);
    const sm=new THREE.LineBasicMaterial({color:'#eeeeee'});for(let i=0;i<6;i++){const a=i/6*Math.PI*2;g.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(0,2.6,0),new THREE.Vector3(Math.cos(a)*3.6,7.6,Math.sin(a)*3.6)]),sm));}
    P.model.add(g);P.chuteMesh=g;SFX.click&&SFX.click();}}
let SAYSEQ=0;
function playerSay(text,secs){text=String(text??'').slice(0,100);if(!P.model)return;if(P.bubble&&P.bubble.parent)P.bubble.parent.remove(P.bubble);P.bubble=null;P.sayText='';
  if(!text.trim()){MP.lastSent='';return;}P.bubble=bubbleOver(P.model,text);P.bubbleUntil=t+Math.max(.5,Math.min(60,secs||3));P.sayText=(++SAYSEQ)+'|'+text;MP.lastSent='';}
function otherPlayers(){return [...MP.remotes.values()];}
function touchingMe(r,m){m=m==null?.35:m;if(P.dead||!r||r.dead)return false;
  return P.pos.x-PH.x-m<r.max.x&&P.pos.x+PH.x+m>r.min.x&&P.pos.y-PH.y-m<r.max.y&&P.pos.y+PH.y+m>r.min.y&&P.pos.z-PH.z-m<r.max.z&&P.pos.z+PH.z+m>r.min.z;}
function resolveTargets(v){
  if(v==null)return ['me'];
  if(v.remote)return [v];
  if(Array.isArray(v.plist))return v.plist;
  if(!v.plr)return [];
  const os=otherPlayers().filter(r=>!r.dead);
  switch(v.plr){
    case 'me':return ['me'];case 'all':return ['me',...otherPlayers()];case 'others':return otherPlayers();
    case 'random':return os.length?[os[Math.floor(Math.random()*os.length)]]:[];
    case 'nearest':{let best=null,bd=Infinity;for(const r of os){const d=r.pos.distanceToSquared(P.pos);if(d<bd){bd=d;best=r;}}return best?[best]:[];}
    case 'playing':case 'randplaying':{let out=[];
      if(!LOBBY.on){if(!P.dead)out.push('me');out.push(...os);}
      else{if(LOBBY.inRound&&!LOBBY.out)out.push('me');for(const r of otherPlayers())if(r.lb&&r.lb.r===LOBBY.idx&&!r.lb.o)out.push(r);}
      if(v.plr==='randplaying')out=out.length?[out[Math.floor(Math.random()*out.length)]]:[];return out;}
  }return [];
}
function playersTouching(ps){const out=[];if(!ps.length)return out;if(!P.dead&&ps.some(p=>p.active!==false&&partOverlap(p,-.12)))out.push('me');
  for(const r of otherPlayers()){if(r.dead)continue;if(ps.some(p=>r.min.x<p.max.x&&r.max.x>p.min.x&&r.min.y<p.max.y+.3&&r.max.y>p.min.y&&r.min.z<p.max.z&&r.max.z>p.min.z))out.push(r);}return out;}
function targetName(x){return x==='me'?myName():nameOf(x.by);}
function healPlayer(n){if(P.dead)return;P.health=Math.min(P.maxHealth,P.health+Math.max(0,n));}

/* ---------- online multiplayer ---------- */
const MP={room:null,user:null,db:null,me:{name:'',id:null},peerMe:null,gr:null,remotes:new Map(),unsubs:[],names:{},counts:{},lastSent:'',sendT:0,swWall:0,
  world:null,worldUnsub:null,worldDocs:new Map(),comm:[],commUnsub:null,connected:false,chatOpen:false,plistOpen:false,lastChat:0};
const ROOM_TOPICS=['chat','hit','ko','shot','fin'];
const SITE_URL='https://froggiewins.github.io/brickyard/';
const P2P_APP='brickyard-froggiewins-v1';
/* Online play on the website. Public P2P relays are often down or blocked, so when the Supabase backend is available
   game messages go through Supabase Realtime broadcast channels instead (no peer-to-peer connection needed). */
let NETLIB=null;
function netLib(){if(NETLIB)return NETLIB;if(SB.client&&typeof SB.client.channel==='function')NETLIB=makeSBNet(SB.client);else if(window.Trystero)NETLIB=window.Trystero;return NETLIB;}
function makeSBNet(client){
  const selfId='s'+Math.random().toString(36).slice(2,12);
  return {selfId,kind:'supabase',joinRoom(cfg,name){
    const ch=client.channel(('by-'+(cfg&&cfg.appId||'')+'-'+name).slice(0,120),{config:{broadcast:{self:false,ack:false}}});
    const actions={},peers=new Map();let ready=false,closed=false;const queue=[];
    const room={onPeerJoin:null,onPeerLeave:null,
      makeAction(an){const a={onMessage:null,send(data,opts){post({t:'a',a:an,d:data,to:opts&&opts.target||null});}};actions[an]=a;return a;},
      leave(){if(closed)return;post({t:'bye'});closed=true;clearInterval(hb);setTimeout(()=>{try{client.removeChannel(ch);}catch(e){}},200);},
      getPeers(){return [...peers.keys()];}};
    function post(m){if(closed)return;m.f=selfId;if(!ready){if(queue.length<200)queue.push(m);return;}try{const r=ch.send({type:'broadcast',event:'m',payload:m});if(r&&r.catch)r.catch(()=>{});}catch(e){}}
    function seen(id){const isNew=!peers.has(id);peers.set(id,Date.now());if(isNew&&room.onPeerJoin){try{room.onPeerJoin(id);}catch(e){}}return isNew;}
    ch.on('broadcast',{event:'m'},msg=>{const m=msg&&msg.payload;if(!m||typeof m.f!=='string'||m.f===selfId)return;
      if(m.t==='bye'){if(peers.delete(m.f)&&room.onPeerLeave)room.onPeerLeave(m.f);return;}
      const isNew=seen(m.f);if(m.t==='hi'&&isNew)post({t:'hb'});
      if(m.t==='a'){if(m.to&&m.to!==selfId)return;const a=actions[m.a];if(a&&a.onMessage){try{a.onMessage(m.d,{peerId:m.f});}catch(e){}}}});
    ch.subscribe(st=>{if(st==='SUBSCRIBED'){ready=true;post({t:'hi'});queue.splice(0).forEach(post);}
      else if((st==='CHANNEL_ERROR'||st==='TIMED_OUT')&&!NETLIB.warned){NETLIB.warned=true;console.warn('Brickyard online: realtime channel '+st);}});
    const hb=setInterval(()=>{post({t:'hb'});const now=Date.now();for(const [id,ts] of peers)if(now-ts>10000){peers.delete(id);room.onPeerLeave&&room.onPeerLeave(id);}},3000);
    return room;}};
}
function nickById(pr){return pr&&typeof pr.nm==='string'&&pr.nm.trim()?'nick:'+pr.nm.replace(/[\u0000-\u001f]/g,'').trim().slice(0,20):null;}
function makeP2PRoom(name){
  const T=netLib();const room=T.joinRoom({appId:P2P_APP},name);
  const aP=room.makeAction('pres'),aE=room.makeAction('ev');
  const pres=new Map(),peerFns=[],topicFns={};let mine={};const self=T.selfId;
  const peerObj=(id,pr,me)=>({peer:id,by:me?null:nickById(pr),presence:pr||{},isMe:!!me,sameTab:!!me,kind:'viewer',guest:false,updatedAt:Date.now()});
  const list=()=>[peerObj(self,mine,true)].concat([...pres].map(([id,pr])=>peerObj(id,pr,false)));
  const fire=(joined,left)=>{const peers=list();peerFns.forEach(f=>{try{f({peers,joined:joined||[],left:left||[],updated:[]});}catch(e){}});};
  room.onPeerJoin=id=>{aP.send(mine,{target:id});};
  room.onPeerLeave=id=>{if(!pres.has(id))return;const p=peerObj(id,pres.get(id),false);pres.delete(id);fire([],[p]);};
  aP.onMessage=(data,meta)=>{const id=meta&&meta.peerId;if(!id)return;const isNew=!pres.has(id);const pr=data&&typeof data==='object'&&!Array.isArray(data)?data:{};pres.set(id,pr);fire(isNew?[peerObj(id,pr,false)]:[]);};
  aE.onMessage=(data,meta)=>{const id=meta&&meta.peerId;if(!id||!data||typeof data.topic!=='string')return;
    (topicFns[data.topic]||[]).forEach(f=>{try{f({topic:data.topic,data:data.data,peer:id,by:nickById(pres.get(id)),isMe:false,sameTab:false,kind:'viewer',guest:false});}catch(e){}});};
  return {name,
    emit:async(topic,data)=>{try{aE.send({topic,data});}catch(e){}(topicFns[topic]||[]).forEach(f=>{try{f({topic,data,peer:self,by:null,isMe:true,sameTab:true,kind:'viewer',guest:false});}catch(e){}});},
    on:(topic,fn)=>{(topicFns[topic]=topicFns[topic]||[]).push(fn);return()=>{topicFns[topic]=(topicFns[topic]||[]).filter(x=>x!==fn);};},
    presence:async patch=>{const n=Object.assign({},mine,patch);for(const k in patch)if(patch[k]===null)delete n[k];mine=n;try{aP.send(mine);}catch(e){}},
    peers:list,onPeers:fn=>{peerFns.push(fn);setTimeout(()=>fn({peers:list(),joined:list(),left:[],updated:[]}),0);return()=>{const i=peerFns.indexOf(fn);if(i>=0)peerFns.splice(i,1);};},
    connected:()=>true,onConnection:fn=>{setTimeout(()=>fn(true),0);return()=>{};},
    leave:async()=>{try{room.leave();}catch(e){}}};
}
function makeP2PLobby(){const lobby=makeP2PRoom('lobby');return Object.assign({},lobby,{join:async n=>makeP2PRoom(n)});}
function makeP2PWorld(){
  const KEY='by:p2pworld';let docs=new Map();try{docs=new Map(Object.entries(JSON.parse(localStorage.getItem(KEY)||'{}')));}catch(e){}
  const subs=[];let room=null,aOp=null,synced=false;
  const persist=()=>{try{localStorage.setItem(KEY,JSON.stringify(Object.fromEntries(docs)));}catch(e){}};
  const okId=id=>typeof id==='string'&&/^b[m0-9_]{3,60}$/.test(id);
  const okDoc=d=>d&&typeof d==='object'&&isFinite(+d.x)&&isFinite(+d.y)&&isFinite(+d.z)&&[1,2,4].includes(d.s)&&/^#[0-9a-f]{6}$/i.test(d.c||'');
  const clean=d=>({x:+d.x,y:+d.y,z:+d.z,s:d.s,c:d.c,by:typeof d.by==='string'?d.by.slice(0,40):null});
  const notify=()=>subs.forEach(f=>f());
  const apply=op=>{if(!op||typeof op!=='object')return;
    if(op.k==='set'&&okId(op.id)&&okDoc(op.d))docs.set(op.id,clean(op.d));
    else if(op.k==='upd'&&okId(op.id)&&docs.has(op.id)&&/^#[0-9a-f]{6}$/i.test(op.d&&op.d.c||''))docs.set(op.id,Object.assign({},docs.get(op.id),{c:op.d.c}));
    else if(op.k==='del'&&okId(op.id))docs.delete(op.id);
    else return;persist();notify();};
  const connect=()=>{if(room||!netLib())return;room=netLib().joinRoom({appId:P2P_APP},'world');
    aOp=room.makeAction('wop');const aReq=room.makeAction('wreq'),aSt=room.makeAction('wst');
    aOp.onMessage=op=>apply(op);
    aReq.onMessage=(_,meta)=>{if(meta&&meta.peerId)aSt.send([...docs].slice(-1500),{target:meta.peerId});};
    aSt.onMessage=list=>{if(synced||!Array.isArray(list))return;synced=true;const n=new Map();for(const e of list)if(Array.isArray(e)&&okId(e[0])&&okDoc(e[1]))n.set(e[0],clean(e[1]));
      for(const [id,d] of docs)if(!n.has(id))n.set(id,d);docs=n;persist();notify();};
    room.onPeerJoin=id=>{if(!synced)aReq.send(1,{target:id});};};
  const send=op=>{apply(op);try{aOp&&aOp.send(op);}catch(e){}};
  const docRef=id=>({id,set:async d=>send({k:'set',id,d}),update:async d=>send({k:'upd',id,d}),delete:async()=>send({k:'del',id})});
  return {collection:()=>({doc:docRef,onSnapshot:fn=>{connect();let prev=new Map();
    const run=()=>{const ch=[];const mk=(id,d)=>({id,exists:true,data:()=>d});
      for(const [id,d] of docs){if(!prev.has(id))ch.push({type:'added',doc:mk(id,d)});else if(prev.get(id)!==d)ch.push({type:'modified',doc:mk(id,d)});}
      for(const [id,d] of prev)if(!docs.has(id))ch.push({type:'removed',doc:mk(id,d)});
      prev=new Map(docs);fn({docs:[...docs].map(([id,d])=>mk(id,d)),size:docs.size,empty:!docs.size,docChanges:()=>ch});};
    subs.push(run);setTimeout(run,0);return()=>{const i=subs.indexOf(run);if(i>=0)subs.splice(i,1);};}})};
}
function hasClaude(){return !!(window.claude&&typeof window.claude.use==='function');}
/* ---------- Brickyard accounts (Claude sign-in backs them) ---------- */
const ACC={doc:null,loaded:false,names:{},miss:{},unsub:null};
const RESERVED=new Set(['admin','brickyard','roblox','claude','anthropic','moderator','mod','staff','official','system','guest','player']);
/* Website accounts run on Supabase; inside Claude they use Claude sign-in and the page's shared data. */
const SB={url:'https://aexdkcpiljcfkogibcwy.supabase.co',key:'sb_publishable_kLNWgcj4oW9xsAw44QKuTg_AkITuR_Z',client:null,uid:null,email:null,ready:false,recovery:false};
function accountsAvailable(){return !!(SB.client||(MP.db&&MP.me.id&&!MP.p2p));}
function myUid(){return SB.client?SB.uid:MP.me.id;}
async function usernameTaken(u){
  try{if(SB.client){const {data,error}=await SB.client.from('profiles').select('id').eq('username',u).maybeSingle();if(error)return null;return !!data&&data.id!==SB.uid;}
    if(MP.db){const c=await MP.db.doc('names/'+u).get();return c.exists&&c.data().uid!==MP.me.id;}}catch(e){}return null;}
function sbErr(e){const m=String(e&&(e.message||e.error_description||e.msg)||'');
  if(/invalid login/i.test(m))return 'That email and password do not match an account.';
  if(/email not confirmed/i.test(m))return 'Confirm your email first: open the link we sent you, then sign in.';
  if(/already registered|already exists/i.test(m))return 'That email already has an account. Sign in instead.';
  if(/password/i.test(m)&&/(6|characters|weak|short)/i.test(m))return 'Use a longer password (at least 8 characters).';
  if(/rate|too many|security purposes/i.test(m))return 'Too many tries. Wait a minute and try again.';
  if(/fetch|network/i.test(m))return 'Could not reach the Brickyard server. Check your connection.';
  return m?m.slice(0,160):'Something went wrong. Try again.';}
function initSupabase(){
  if(hasClaude()||SB.client||!window.supabase||typeof supabase.createClient!=='function')return;
  try{SB.client=supabase.createClient(SB.url,SB.key,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true,storageKey:'brickyard-auth'}});}catch(e){SB.client=null;return;}
  SB.client.auth.onAuthStateChange((ev,session)=>{const u=session&&session.user;const nid=u?u.id:null;SB.ready=true;
    if(ev==='PASSWORD_RECOVERY'){SB.recovery=true;setTimeout(()=>showAccountModal(null),0);}
    if(nid!==SB.uid||ev==='INITIAL_SESSION'||ev==='SIGNED_IN'){SB.uid=nid;SB.email=u?u.email:null;setTimeout(sbLoadProfile,0);}});
  sbRefreshCommunity();setInterval(()=>{if(!document.hidden&&!$('#menu').hidden)sbRefreshCommunity();},90000);
  renderAccountChip();
}
async function sbLoadProfile(){
  if(!SB.uid){ACC.doc=null;ACC.loaded=true;sbApplyName();return;}
  walletSync();
  try{const {data,error}=await SB.client.from('profiles').select('username,color,bio,created_at').eq('id',SB.uid).maybeSingle();if(error)throw error;
    ACC.doc=data?{username:data.username,color:/^#[0-9a-f]{6}$/i.test(data.color||'')?data.color:'#ff8a1f',bio:String(data.bio||'').slice(0,140),created:Date.parse(data.created_at)||0}:null;}
  catch(e){ACC.doc=null;}
  ACC.loaded=true;if(ACC.doc)ACC.names[SB.uid]=ACC.doc.username;sbApplyName();
}
function sbApplyName(){
  const nw=$('#nickWrap');if(MP.p2p&&nw)nw.hidden=!!ACC.doc;
  if(ACC.doc){MP.me.name=ACC.doc.username;}else if(MP.p2p){MP.me.name=$('#nick').value||'Player';}
  MP.lastSent='';renderAccountChip();renderCards();renderCommunity();
}
async function sbSaveProfile(u,col,bio,existing){
  const row={id:SB.uid,username:u,color:col,bio};
  const {error}=existing?await SB.client.from('profiles').update({username:u,color:col,bio}).eq('id',SB.uid):await SB.client.from('profiles').insert(row);
  if(error){if(error.code==='23505')throw {msg:'@'+u+' is taken. Try another.'};if(error.code==='23514')throw {msg:'That username is not allowed. Try another.'};throw {msg:sbErr(error)};}
}
async function sbDeleteAccount(){
  try{const {data}=await SB.client.storage.from('meshes').list(SB.uid,{limit:1000});if(data&&data.length)await SB.client.storage.from('meshes').remove(data.map(f=>SB.uid+'/'+f.name));}catch(e){}
  const {error}=await SB.client.rpc('delete_my_account');if(error){const r=await SB.client.from('profiles').delete().eq('id',SB.uid);if(r.error)throw r.error;}
  store.set('sbMeshUp',{});await SB.client.auth.signOut().catch(()=>{});
}
function showSignIn(after,mode){
  mode=mode||'signup';
  mmodal(`<h2>${mode==='signup'?'Create your Brickyard account':mode==='reset'?'Reset your password':'Sign in to Brickyard'}</h2>
    <p class="sub">${mode==='signup'?'You need an account to build games in Brickyard Studio and publish them for everyone on this site.':mode==='reset'?'We will email you a link to choose a new password.':'Welcome back. Sign in to build and publish games.'}</p>
    <form class="acctform" id="sbForm">
      <div><label for="sbE">Email</label><input id="sbE" type="email" autocomplete="email" required></div>
      ${mode==='reset'?'':`<div><label for="sbP">${mode==='signup'?'Make a password':'Password'}</label><input id="sbP" type="password" autocomplete="${mode==='signup'?'new-password':'current-password'}" required>${mode==='signup'?'<div class="pwbar" aria-hidden="true"><i id="pwBar"></i></div><div class="hint" id="pwHint">At least 8 characters, with a letter and a number.</div>':''}</div>`}
      ${mode==='signup'?'<div><label for="sbP2">Type the password again</label><input id="sbP2" type="password" autocomplete="new-password" required></div>':''}
      <p class="bad" id="sbErrT" hidden></p><p class="hint" id="sbOk" hidden></p>
      <div class="row"><button class="btn" type="submit" id="sbGo">${mode==='signup'?'Create account':mode==='reset'?'Send link':'Sign in'}</button><button class="btn ghost" type="button" data-mm="close">Not now</button></div>
      <p class="hint">${mode==='signup'?'Already have an account? <a href="#" data-sbm="signin">Sign in</a>':mode==='signin'?'New here? <a href="#" data-sbm="signup">Create an account</a> · <a href="#" data-sbm="reset">Forgot password?</a>':'<a href="#" data-sbm="signin">Back to sign in</a>'}</p>
    </form>`);
  $('#mpanel').querySelectorAll('[data-sbm]').forEach(a=>a.addEventListener('click',e=>{e.preventDefault();showSignIn(after,a.dataset.sbm);}));
  const err=t=>{const e=$('#sbErrT');e.hidden=!t;e.textContent=t||'';};const ok=t=>{const e=$('#sbOk');e.hidden=!t;e.textContent=t||'';};
  $('#sbForm').addEventListener('submit',async e=>{e.preventDefault();err('');ok('');const email=$('#sbE').value.trim(),pw=mode==='reset'?'':$('#sbP').value;
    if(mode==='signup'){const pe=pwProblem(pw);if(pe)return err(pe);if(pw!==$('#sbP2').value)return err('The two passwords do not match.');}
    else if(mode==='signin'&&!pw)return err('Enter your password.');
    const go=$('#sbGo');go.disabled=true;const back=go.textContent;go.textContent='Please wait…';const redirect=location.origin+location.pathname;
    try{
      if(mode==='signup'){const {data,error}=await SB.client.auth.signUp({email,password:pw,options:{emailRedirectTo:redirect}});if(error)throw error;
        if(!data.session){ok('Check your email ('+email+') and open the link to confirm your account. Then sign in here.');go.textContent='Email sent';return;}
        SB.uid=data.session.user.id;await sbLoadProfile();showAccountModal(after);}
      else if(mode==='signin'){const {data,error}=await SB.client.auth.signInWithPassword({email,password:pw});if(error)throw error;
        SB.uid=data.user.id;SB.email=data.user.email;await sbLoadProfile();if(ACC.doc){closeM();toastMenu('Signed in as @'+ACC.doc.username);if(after)after();}else showAccountModal(after);}
      else{const {error}=await SB.client.auth.resetPasswordForEmail(email,{redirectTo:redirect});if(error)throw error;ok('If that email has an account, a reset link is on its way.');go.textContent='Sent';return;}
    }catch(x){err(sbErr(x));}
    go.disabled=false;go.textContent=back;
  });
  const pi=$('#sbP'),bar=$('#pwBar');if(pi&&bar)pi.addEventListener('input',()=>{const sc=pwScore(pi.value);bar.style.width=(sc*25)+'%';bar.style.background=['var(--bad)','var(--bad)','#ffc72c','var(--good)','var(--good)'][sc];
    $('#pwHint').textContent=pi.value?(pwProblem(pi.value)||['','Weak','Okay','Strong','Very strong'][sc]+' password'):'At least 8 characters, with a letter and a number.';});
  setTimeout(()=>{const i=$('#sbE');if(i)i.focus();},30);
}
function pwProblem(pw){if(pw.length<8)return 'Use at least 8 characters.';if(!/[a-z]/i.test(pw)||!/[0-9]/.test(pw))return 'Use at least one letter and one number.';
  if(/^(password|12345678|qwerty|brickyard|letmein)/i.test(pw))return 'That password is too easy to guess.';return '';}
function pwScore(pw){let s=0;if(pw.length>=8)s++;if(pw.length>=12)s++;if(/[a-z]/.test(pw)&&/[A-Z]/.test(pw))s++;if(/[0-9]/.test(pw)&&/[^a-z0-9]/i.test(pw))s++;return pwProblem(pw)?Math.min(s,1):Math.max(2,s);}
function showNewPassword(){
  mmodal(`<h2>Choose a new password</h2><form class="acctform" id="npForm"><div><label for="npP">New password</label><input id="npP" type="password" minlength="8" autocomplete="new-password" required></div>
    <p class="bad" id="npErr" hidden></p><div class="row"><button class="btn" type="submit" id="npGo">Save password</button><button class="btn ghost" type="button" data-mm="close">Cancel</button></div></form>`);
  $('#npForm').addEventListener('submit',async e=>{e.preventDefault();const pw=$('#npP').value;const er=$('#npErr');
    {const pe=pwProblem(pw);if(pe){er.hidden=false;er.textContent=pe;return;}}
    const {error}=await SB.client.auth.updateUser({password:pw});if(error){er.hidden=false;er.textContent=sbErr(error);return;}SB.recovery=false;closeM();toastMenu('Password changed.');});
}
function myName(){return ACC.doc?ACC.doc.username:(MP.me.name||'You');}
function loadAccount(){
  if(!accountsAvailable()){ACC.loaded=true;renderAccountChip();renderCards();return;}
  renderAccountChip();clearTimeout(loadAccount._t);loadAccount._t=setTimeout(()=>{if(!ACC.loaded){ACC.loaded=true;renderAccountChip();}},3500);
  ACC.unsub=MP.db.doc('accounts/'+MP.me.id).onSnapshot(sn=>{const d=sn.exists?sn.data():null;
    ACC.doc=d&&typeof d.username==='string'?{username:d.username,color:/^#[0-9a-f]{6}$/i.test(d.color||'')?d.color:'#ff8a1f',bio:String(d.bio||'').slice(0,140),created:num(d.created,0)}:null;
    if(ACC.doc)ACC.names[MP.me.id]=ACC.doc.username;if(!WALLET.loaded)walletSync();ACC.loaded=true;MP.lastSent='';renderAccountChip();renderCards();renderCommunity();},()=>{ACC.loaded=true;renderAccountChip();});
}
function renderAccountChip(){
  const b=$('#acctBtn');if(!b)return;b.hidden=!accountsAvailable();if(b.hidden)return;b.innerHTML='';
  const i=document.createElement('i');const sp=document.createElement('span');
  if(ACC.doc){i.style.background=ACC.doc.color;i.textContent=ACC.doc.username[0].toUpperCase();sp.textContent='@'+ACC.doc.username;}
  else{i.style.background='var(--accent)';i.textContent='+';sp.textContent=SB.client?(SB.uid?'Finish account':'Sign in'):ACC.loaded?'Create account':'Account…';}
  b.append(i,sp);
}
$('#acctBtn').addEventListener('click',()=>showAccountModal(null));
function mmodal(html){$('#mpanel').innerHTML=html;$('#mmodal').hidden=false;}
function closeM(){$('#mmodal').hidden=true;}
$('#mmodal').addEventListener('click',e=>{if(e.target.id==='mmodal'||e.target.closest('[data-mm="close"]'))closeM();});
addEventListener('keydown',e=>{if(e.key==='Escape'&&!$('#mmodal').hidden)closeM();});
function requireAccount(fn){
  if(ACC.doc)return fn();
  if(SB.client&&!SB.ready&&!ACC.loaded){toastMenu('Checking your account…');return;}
  if(!accountsAvailable()){mmodal(`<h2>Brickyard account needed</h2><p class="sub">Making and publishing games needs a Brickyard account. This copy of Brickyard cannot reach the account server, so you can play games and shared links here. Make games on the Brickyard website or in Brickyard inside Claude.</p><div class="row"><button class="btn ghost" type="button" data-mm="close">OK</button></div>`);return;}
  showAccountModal(fn);
}
const ACOLS=['#ff8a1f','#e53935','#d81b60','#8e24aa','#5e35b1','#1e88e5','#00acc1','#43a047','#fdd835','#6d4c41'];
function showAccountModal(after){
  if(!accountsAvailable())return requireAccount(()=>{});
  if(SB.client&&SB.recovery&&SB.uid)return showNewPassword();
  if(SB.client&&!SB.uid)return showSignIn(after,'signup');
  const d=ACC.doc;let col=d?d.color:ACOLS[Math.floor(Math.random()*ACOLS.length)];
  mmodal(`<h2>${d?'Your Brickyard account':'Create your Brickyard account'}</h2>
    <p class="sub">${d?'Your username shows on your games and above your character online.':SB.client?'Pick a username to finish setting up your account.':'You need an account to create games in Studio and publish them. It uses your Claude sign-in, so there is no password to remember.'}</p>${SB.client&&SB.email?`<p class="hint" style="margin:-6px 0 12px">Signed in as ${esc(SB.email)}</p>`:''}
    <form class="acctform" id="acctForm" autocomplete="off">
      <div><label for="acU">Username</label><input id="acU" maxlength="20" placeholder="brickbuilder" value="${d?esc(d.username):''}" required><div class="hint" id="acUHint">3–20 lowercase letters, numbers or underscores.</div></div>
      <div><label>Color</label><div id="swatches2" class="row" style="gap:6px;margin-top:6px"></div></div>
      <div><label for="acB">About you (optional)</label><textarea id="acB" maxlength="140" rows="2">${d?esc(d.bio):''}</textarea></div>
      <p class="bad" id="acErr" hidden></p>
      <div class="row"><button class="btn" type="submit" id="acSave">${d?'Save':'Create account'}</button><button class="btn ghost" type="button" data-mm="close">${d?'Close':'Not now'}</button>
      <span class="spacer"></span>${SB.client?'<button class="mini" type="button" id="acOut">Sign out</button>':''}${d?'<button class="mini danger" type="button" id="acDel">Delete account</button>':''}</div>
    </form>`);
  const sw=$('#swatches2');const draw=()=>{sw.innerHTML='';ACOLS.forEach(c=>{const b=document.createElement('button');b.type='button';b.className='sw';b.style.background=c;b.setAttribute('aria-label','Color '+c);b.setAttribute('aria-pressed',c===col);b.onclick=()=>{col=c;draw();};sw.appendChild(b);});};draw();
  const err=t=>{const e=$('#acErr');e.hidden=!t;e.textContent=t||'';};
  let ckT=0,ckN=0;const hint=$('#acUHint'),saveB=$('#acSave');
  const setH=(t,cls)=>{hint.textContent=t;hint.className='hint'+(cls?' '+cls:'');};
  $('#acU').addEventListener('input',e=>{e.target.value=e.target.value.toLowerCase().replace(/[^a-z0-9_]/g,'');const u=e.target.value;clearTimeout(ckT);err('');saveB.disabled=false;
    if(d&&u===d.username)return setH('This is your username.');
    if(!/^[a-z0-9_]{3,20}$/.test(u))return setH('3–20 lowercase letters, numbers or underscores.');
    if(RESERVED.has(u)){saveB.disabled=true;return setH('✗ @'+u+' is reserved.','no');}
    setH('Checking @'+u+'…');const my=++ckN;
    ckT=setTimeout(async()=>{const t=await usernameTaken(u);if(my!==ckN)return;if(t===null)return setH('3–20 lowercase letters, numbers or underscores.');
      if(t){saveB.disabled=true;setH('✗ @'+u+' is already taken. Try another.','no');}else setH('✓ @'+u+' is available.','yes');},350);});
  $('#acctForm').addEventListener('submit',async e=>{e.preventDefault();const u=$('#acU').value.trim(),bio=$('#acB').value.replace(/[\u0000-\u001f]/g,' ').trim().slice(0,140);
    if(!/^[a-z0-9_]{3,20}$/.test(u))return err('Pick 3–20 lowercase letters, numbers or underscores.');if(RESERVED.has(u))return err('That username is reserved. Try another.');
    const btn=$('#acSave');btn.disabled=true;btn.textContent='Saving…';
    try{
      if(SB.client){await sbSaveProfile(u,col,bio,!!d);ACC.names[SB.uid]=u;}else{
      if(!d||d.username!==u){const ref=MP.db.doc('names/'+u);const taken=async()=>{const c=await ref.get();return c.exists&&c.data().uid!==MP.me.id;};
        if(await taken())throw {msg:'@'+u+' is taken. Try another.'};
        if(typeof ref.acquire==='function'){let lease=null;try{lease=await ref.acquire({holder:MP.me.id,ttlMs:5000});}catch(_){lease=null;}if(lease&&!lease.acquired)throw {msg:'Someone is claiming @'+u+' right now. Try again in a moment.'};}
        if(await taken())throw {msg:'@'+u+' is taken. Try another.'};await ref.set({uid:MP.me.id});}
      await MP.db.doc('accounts/'+MP.me.id).set({username:u,color:col,bio,created:d?d.created:Date.now()});
      if(d&&d.username!==u){try{const old=MP.db.doc('names/'+d.username);const c=await old.get();if(c.exists&&c.data().uid===MP.me.id)await old.delete();}catch(_){}}}
      ACC.doc={username:u,color:col,bio,created:d?d.created:Date.now()};ACC.names[myUid()]=u;if(SB.client)sbApplyName();renderAccountChip();closeM();renderCards();
      if(!d)toastMenu('Welcome, @'+u+'!');if(after)after();
    }catch(x){btn.disabled=false;btn.textContent=d?'Save':'Create account';const code=x&&(x.code||x.name)||'';err(x&&x.msg?x.msg:/not_granted|permission|denied|forbidden|rule/i.test(code+' '+(x&&x.message||''))?'This page did not let you save. Ask the owner to give you Contributor (or Editor) access, then try again.':'Saving failed'+(x&&x.message?': '+x.message:'')+'. Check your connection and try again.');}
  });
  const del=$('#acDel');if(del){let armed=false;del.onclick=async()=>{if(!armed){armed=true;del.textContent='Tap again: this unpublishes your games';return;}
    del.disabled=true;try{if(SB.client){await sbDeleteAccount();SB.uid=null;ACC.doc=null;closeM();sbApplyName();sbRefreshCommunity();toastMenu('Account deleted. Games saved in this browser are still here.');return;}
      const idx=await MP.db.doc('index/'+MP.me.id).get();const list=idx.exists&&Array.isArray(idx.data().games)?idx.data().games:[];
      for(const g of list){try{await MP.db.doc('games/'+MP.me.id+'/list/'+g.id).delete();}catch(_){}}
      try{await MP.db.doc('index/'+MP.me.id).delete();}catch(_){}
      try{const nm=MP.db.doc('names/'+ACC.doc.username);const c=await nm.get();if(c.exists&&c.data().uid===MP.me.id)await nm.delete();}catch(_){}
      await MP.db.doc('accounts/'+MP.me.id).delete();ACC.doc=null;closeM();renderAccountChip();renderCards();toastMenu('Account deleted. Games saved in this browser are still here.');}
    catch(x){del.disabled=false;del.textContent='Delete failed';}};}
  const out=$('#acOut');if(out)out.onclick=async()=>{out.disabled=true;await SB.client.auth.signOut().catch(()=>{});SB.uid=null;SB.email=null;ACC.doc=null;closeM();sbApplyName();toastMenu('Signed out.');};
}
function toastMenu(t){let el=$('#menuToast');if(!el){el=document.createElement('div');el.id='menuToast';el.style.cssText='position:fixed;left:50%;transform:translateX(-50%);bottom:calc(env(safe-area-inset-bottom,0px) + 24px);background:var(--panel2);border:1px solid var(--line);border-radius:12px;padding:10px 16px;font-weight:700;z-index:80;max-width:calc(100vw - 32px)';document.body.appendChild(el);}
  el.textContent=t;el.hidden=false;clearTimeout(toastMenu._t);toastMenu._t=setTimeout(()=>el.hidden=true,3500);}
async function fetchAccountNames(ids){
  if(!MP.db||MP.p2p)return false;let changed=false;const now=Date.now();
  await Promise.all(ids.filter(id=>id&&!ACC.names[id]&&!(ACC.miss[id]>now)).slice(0,30).map(async id=>{try{const sn=await MP.db.doc('accounts/'+id).get();
    const u=sn.exists&&typeof sn.data().username==='string'?sn.data().username:null;if(u){ACC.names[id]=u;changed=true;}else ACC.miss[id]=now+60000;}catch(e){ACC.miss[id]=now+60000;}}));
  return changed;
}
function localId(){let id=store.get('lid',null);if(!id){id='l'+Math.random().toString(36).slice(2,12);store.set('lid',id);}return id;}
async function initMP(){
  if(!hasClaude()){
    initSupabase();
    if(!netLib()){$('#onlineNote').textContent='Games run solo here. Play at '+SITE_URL+' to play online.';return;}
    if(netLib().kind!=='supabase'&&(!window.isSecureContext||!(window.crypto&&crypto.subtle))){$('#onlineNote').textContent='Games run solo here. Open this page over https to play online.';return;}
    MP.p2p=true;MP.room=makeP2PLobby();MP.worldDb=makeP2PWorld();
    const nk=$('#nick');nk.value=store.get('nick',null)||('Player'+Math.floor(100+Math.random()*900));store.set('nick',nk.value);MP.me={name:nk.value,id:localId()};$('#nickWrap').hidden=false;
    nk.addEventListener('change',()=>{const v=nk.value.replace(/[\u0000-\u001f]/g,'').trim().slice(0,20)||'Player';nk.value=v;store.set('nick',v);MP.me.name=v;MP.lastSent='';});
    $('#onlineNote').textContent='Games are online: anyone who opens the same game on this site plays with you.';
    MP.room.onPeers(ch=>{const c={};for(const p of ch.peers){if(p.sameTab)MP.peerMe=p.peer;else{const g=p.presence&&typeof p.presence.game==='string'?p.presence.game:null;if(g)c[g]=(c[g]||0)+1;}}MP.counts=c;updateCardCounts();});
    MP.room.presence({game:null});MP.connected=true;return;
  }
  try{MP.user=await claude.use('user');}catch(e){MP.user=null;}
  if(MP.user){try{const me=await MP.user.me();MP.me={name:me.name||'',id:me.id||null};}catch(e){}}
  try{MP.room=await claude.use('room');}catch(e){MP.room=null;}
  try{MP.db=await claude.use('db');}catch(e){MP.db=null;}
  if(!MP.room)$('#onlineNote').textContent='Online play is not available in this view, so games run solo.';
  if(MP.room){
    MP.room.onConnection(c=>{MP.connected=c;updateOnlineUI();},()=>{MP.connected=false;updateOnlineUI();});
    MP.room.onPeers(ch=>{const c={};for(const p of ch.peers){if(p.sameTab)MP.peerMe=p.peer;else{const g=p.presence&&typeof p.presence.game==='string'?p.presence.game:null;if(g)c[g]=(c[g]||0)+1;}}
      MP.counts=c;updateCardCounts();},()=>{});
    MP.room.presence({game:running&&game?game.room||null:null}).catch(()=>{});
  }
  if(MP.db)subscribeCommunity();
  loadAccount();
  $('#onlineNote').textContent=MP.room?'Games are online: everyone who has this page open can play together.':$('#onlineNote').textContent;
}
function nameOf(by){if(!by)return 'Guest';if(by.startsWith('nick:'))return by.slice(5)||'Player';if(ACC.names[by])return ACC.names[by];return MP.names[by]||'Player';}
async function resolveNames(ids){ids=ids.filter(x=>x&&!String(x).startsWith('nick:'));if(!ids.length)return;
  if(await fetchAccountNames(ids)){renderPlayerList();MP.remotes.forEach(r=>setRemoteTag(r));renderCommunity();}
  if(!MP.user)return;try{const ps=await MP.user.profiles(ids);let changed=false;
  for(const id of ids){const n=(ps[id]&&ps[id].name)||'Player';if(MP.names[id]!==n){MP.names[id]=n;changed=true;}}if(changed){renderPlayerList();MP.remotes.forEach(r=>setRemoteTag(r));renderCommunity();}}catch(e){}}
function mpEmit(topic,data){if(!MP.gr)return;MP.gr.emit(topic,data).catch(()=>{});}
async function mpJoin(def){
  mpLeaveRoom();MP.firstPeers=true;
  if(def.link){const gr=def.link;MP.gr=gr;
    MP.unsubs.push(gr.onPeers(onGamePeers,()=>{}),gr.on('chat',onChat,()=>{}),gr.on('hit',onHit,()=>{}),gr.on('ko',onKO,()=>{}),gr.on('shot',onShot,()=>{}),gr.on('fin',onFin,()=>{}),gr.on('run',onRun,()=>{}),gr.on('gvar',onGvar,()=>{}),gr.on('bot',onBot,()=>{}));
    MP.lastSent='';updateOnlineUI();return;}
  if(!MP.room||def.fromEditor||!def.room){updateOnlineUI();return;}
  MP.room.presence({game:def.room}).catch(()=>{});
  const rn=('g-'+def.room).toLowerCase().replace(/[^a-z0-9_.-]/g,'-').slice(0,48);
  try{
    const gr=await MP.room.join(rn);
    if(!running||game!==def){gr.leave().catch(()=>{});return;}
    MP.gr=gr;
    MP.unsubs.push(gr.onPeers(onGamePeers,()=>{}),gr.on('chat',onChat,()=>{}),gr.on('hit',onHit,()=>{}),gr.on('ko',onKO,()=>{}),gr.on('shot',onShot,()=>{}),gr.on('fin',onFin,()=>{}),gr.on('run',onRun,()=>{}),gr.on('gvar',onGvar,()=>{}),gr.on('bot',onBot,()=>{}));
    MP.lastSent='';updateOnlineUI();
  }catch(e){updateOnlineUI();}
}
function mpLeaveRoom(){
  MP.unsubs.forEach(u=>{try{u();}catch(e){}});MP.unsubs=[];
  if(MP.gr){MP.gr.leave().catch(()=>{});MP.gr=null;}
  MP.remotes.forEach(r=>{if(scene)scene.remove(r.model);});MP.remotes.clear();
  $('#chatLog').innerHTML='';closeChat();updateOnlineUI();
}
function mpLeave(){
  mpLeaveRoom();
  if(MP.room)MP.room.presence({game:null}).catch(()=>{});
  if(MP.worldUnsub){MP.worldUnsub();MP.worldUnsub=null;}MP.world=null;MP.worldDocs.clear();
}
function updateOnlineUI(){
  const online=!!MP.gr;const n=1+MP.remotes.size;
  const bp=$('#btnPlayers');bp.hidden=!online;bp.textContent=n===1?'1 online':n+' online';bp.setAttribute('aria-expanded',MP.plistOpen);
  $('#plist').hidden=!(online&&MP.plistOpen);$('#chat').hidden=!online;
  if(online)renderPlayerList();
}
const num=(v,d)=>{v=Number(v);return isFinite(v)?v:d;};
function onGamePeers(ch){
  const ids=[];
  for(const p of ch.peers){if(p.sameTab){MP.peerMe=p.peer;continue;}if(p.kind!=='viewer')continue;
    let r=MP.remotes.get(p.peer);const pr=p.presence||{};if(!Array.isArray(pr.p))continue;
    if(!r){r=makeRemote(p);}
    if(r.by!==p.by){r.by=p.by;setRemoteTag(r);}applyPresence(r,pr);if(p.by)ids.push(p.by);}
  for(const p of ch.left){const r=MP.remotes.get(p.peer);if(r){scene.remove(r.model);MP.remotes.delete(p.peer);sysChat(nameOf(p.by)+' left');}}
  if(!MP.firstPeers)for(const p of ch.joined){if(!p.sameTab&&p.kind==='viewer')sysChat(nameOf(p.by)+' joined');}
  if(MP.firstPeers)setTimeout(()=>{MP.firstPeers=false;},2500);
  resolveNames(ids);updateOnlineUI();
}
function makeRemote(p){
  const pr=p.presence||{};const sh=typeof pr.sh==='string'?pr.sh:'#9e9e9e';
  const r={peer:p.peer,by:p.by,remote:true,sh,model:makeAvatar(sh),pos:new V3(),tgt:new V3(),yaw:0,tyaw:0,size:new V3(1.8,5,1.8),min:new V3(),max:new V3(),walk:0,
    tag:null,bubble:null,bubbleUntil:0,toolKey:'',held:null,swT0:-9,lastSw:0,dead:false,mv:0,air:false,stats:{},hp:100,flashT:0,first:true};
  r.mesh=r.model;scene.add(r.model);MP.remotes.set(p.peer,r);setRemoteTag(r);return r;
}
function setRemoteTag(r){if(r.tag){r.model.remove(r.tag);r.tag.material.map.dispose();r.tag.material.dispose();}r.tag=textSprite((r.lv>1?'Lv'+r.lv+' · ':'')+nameOf(r.by));r.tag.position.set(0,3.6,0);r.model.add(r.tag);}
function applyPresence(r,pr){
  const p=pr.p;r.tgt.set(num(p[0],0),num(p[1],5),num(p[2],0));if(r.first){r.pos.copy(r.tgt);r.first=false;}
  r.tyaw=num(pr.yaw,0);r.mv=num(pr.mv,0);r.air=!!pr.air;r.hp=num(pr.hp,100);
  const dead=!!pr.dead;r.rgq=Array.isArray(pr.rg)&&pr.rg.length===4?new THREE.Quaternion(num(pr.rg[0],0),num(pr.rg[1],0),num(pr.rg[2],0),num(pr.rg[3],1)).normalize():null;if(dead!==r.dead){r.dead=dead;}
  const avKey=JSON.stringify(pr.av||null)+'|'+pr.sh;
  if(typeof pr.sh==='string'&&/^#[0-9a-f]{6}$/i.test(pr.sh)&&avKey!==r.avKey){r.avKey=avKey;r.sh=pr.sh;const vis=r.model.visible;scene.remove(r.model);r.model=makeAvatar(pr.av&&typeof pr.av==='object'?Object.assign(avClean(pr.av),{shirt:pr.sh}):r.sh);r.mesh=r.model;r.model.visible=vis;scene.add(r.model);setRemoteTag(r);r.toolKey='';r.held=null;}
  const tk=pr.tool&&typeof pr.tool.n==='string'?pr.tool.n.slice(0,40)+'|'+(pr.tool.c||''):'';
  if(tk!==r.toolKey){r.toolKey=tk;if(r.held){r.held.parent&&r.held.parent.remove(r.held);r.held=null;}if(tk)r.held=makeRemoteHeld(pr.tool),r.model.userData.rArm.add(r.held);}
  if(num(pr.sw,0)!==r.lastSw){r.lastSw=num(pr.sw,0);if(r.lastSw)r.swT0=t;}
  r.stats=pr.st&&typeof pr.st==='object'?pr.st:{};
  if(pr.jt!=null)r.jt=num(pr.jt,9e15);
  {const lv=Math.max(1,Math.min(999,Math.round(num(pr.lv,1))));if(lv!==r.lv){r.lv=lv;if(r.tag)setRemoteTag(r);}}
  r.lb=pr.lb&&typeof pr.lb==='object'?{r:Math.round(num(pr.lb.r,-1)),s:num(pr.lb.s,0),o:!!pr.lb.o}:null;
  r.inv=!!pr.inv;r.model.visible=(!r.dead||!!r.rgq)&&!r.inv;
  const say=typeof pr.say==='string'?pr.say.slice(0,120):'';if(say!==(r.say||'')){r.say=say;if(say){if(r.bubble)r.model.remove(r.bubble);r.bubble=bubbleOver(r.model,say.split('|').slice(1).join('|'));r.bubbleUntil=t+5;}}
  const em=typeof pr.em==='string'?pr.em.slice(0,60):'';
  if(em!==(r.em||'')){r.em=em;if(em){const a=findAnim(em.split('|')[0]);r.anim=a?newAnimState(a,'auto',false):null;}else if(r.anim)r.anim.out=true;}
}
function makeRemoteHeld(tool){
  const proj=game&&game.project;const tn=proj&&proj.nodes.find(n=>n.cls==='Tool'&&n.name===tool.n);
  if(tn)return makeHeld({node:tn,emitters:[]});
  const g=new THREE.Group();const c=/^#[0-9a-f]{6}$/i.test(tool.c||'')?tool.c:'#a3a2a5';const m=new THREE.Mesh(BOX,mat(c));m.scale.set(.4,.4,2.4);m.position.set(0,0,0);
  m.quaternion.copy(TOOL_R);m.position.set(0,-1.2,0);g.add(m);g.position.set(0,-1.9,0);return g;
}
function updateRemotes(dt){
  for(const r of MP.remotes.values()){
    const k=Math.min(1,dt*12);r.pos.lerp(r.tgt,k);let d=r.tyaw-r.yaw;d=Math.atan2(Math.sin(d),Math.cos(d));r.yaw+=d*k;
    r.model.position.copy(r.pos);
    if(r.rgq){r.model.quaternion.slerp(r.rgq,Math.min(1,dt*14));const u0=r.model.userData;u0.lArm.rotation.set(-.4,0,-1.2);u0.rArm.rotation.set(-.4,0,1.2);u0.lLeg.rotation.set(.2,0,-.25);u0.rLeg.rotation.set(-.2,0,.25);r.min.set(r.pos.x-.9,r.pos.y-2.5,r.pos.z-.9);r.max.set(r.pos.x+.9,r.pos.y+2.5,r.pos.z+.9);continue;}
    r.model.rotation.set(0,r.yaw,0);
    r.min.set(r.pos.x-.9,r.pos.y-2.5,r.pos.z-.9);r.max.set(r.pos.x+.9,r.pos.y+2.5,r.pos.z+.9);
    const u=r.model.userData;
    if(!r.air){r.walk+=r.mv*dt*.55;const sw=Math.sin(r.walk)*Math.min(1,r.mv/16)*.95;u.lLeg.rotation.x=sw;u.rLeg.rotation.x=-sw;u.lArm.rotation.x+=(-sw-u.lArm.rotation.x)*.4;u.rArm.rotation.x+=(sw-u.rArm.rotation.x)*.4;}
    else{u.lLeg.rotation.x*=.85;u.rLeg.rotation.x*=.85;u.lArm.rotation.x+=(-2.9-u.lArm.rotation.x)*.2;u.rArm.rotation.x+=(-2.9-u.rArm.rotation.x)*.2;}
    relaxPose(u,Math.min(1,dt*10),true);
    if(r.anim){r.anim=stepAnim(r.anim,dt,false);if(r.anim)applyPose(u,sampleAnim(r.anim.a,r.anim.t),r.anim.w);}
    if(r.held){const sw=t-r.swT0;let a=-1.57;if(sw<.32)a=sw<.12?-1.57-1.3*(sw/.12):-2.87+2.4*((sw-.12)/.2);u.rArm.rotation.x=a;}
    if(r.flashT>0){r.flashT-=dt;r.model.traverse(o=>{if(o.isMesh&&o.material!==faceMat){if(r.flashT>0){if(!o.userData.orig){o.userData.orig=o.material;o.material=FLASHMAT;}}else if(o.userData.orig){o.material=o.userData.orig;o.userData.orig=null;}}});}
    if(r.bubble&&t>r.bubbleUntil){r.model.remove(r.bubble);r.bubble.material.map.dispose();r.bubble=null;}
  }
}
function myStats(){
  if(!game)return {};
  if(game.mode==='coins')return {Coins:state.coins};
  if(game.mode==='race')return {Stage:state.stage};
  if(game.mode==='build')return {Blocks:MP.world?[...MP.worldDocs.values()].filter(d=>d.by&&d.by===MP.me.id).length:W.parts.filter(p=>p.data.built).length};
  const o={};let i=0;for(const [k,v] of RT.stats){if(i++>=4)break;o[String(k).slice(0,20)]=r3(v);}return o;
}
function sendPresence(){
  if(!MP.gr)return;
  const pr={p:[r3(P.pos.x),r3(P.pos.y),r3(P.pos.z)],yaw:r3(P.yaw),mv:r3(Math.hypot(P.vel.x,P.vel.z)),air:!P.onGround,dead:P.dead,sh:P.shirtOverride||WALLET.av.shirt,av:WALLET.av,lv:lvlOf(WALLET.xp),
    ...(P.shirtOverride?{sh:P.shirtOverride}:{}),tool:P.equipped?{n:P.equipped.name.slice(0,40),c:P.equipped.color}:null,sw:MP.swWall,hp:Math.round(P.health),st:myStats(),em:P.anim&&!P.anim.out?P.anim.net:'',inv:!!P.hidden,say:P.sayText||'',jt:RT.joinT||0,lb:LOBBY.on?{r:LOBBY.inRound?LOBBY.idx:-1,s:LOBBY.cfg.score?r3(+(RT.stats.get(LOBBY.cfg.score)||0)):0,o:LOBBY.out}:null,rg:P.rag?P.rag.q.toArray().map(v=>Math.round(v*100)/100):null};
  if(MP.p2p||(MP.gr&&MP.gr.link))pr.nm=MP.gr&&MP.gr.link&&!ACC.doc&&!TESTCLIENT?'Player 1':myName();
  const j=JSON.stringify(pr);if(j===MP.lastSent)return;MP.lastSent=j;MP.gr.presence(pr).catch(()=>{});
}
function bubbleOver(model,text,store){const b=textSprite(text,{bubble:true});b.position.set(0,4.4+b.scale.y/2,0);model.add(b);return b;}
function onChat(msg){
  const txt=typeof (msg.data&&msg.data.t)==='string'?msg.data.t.replace(/[\u0000-\u001f]/g,'').slice(0,140):'';if(!txt.trim())return;
  const who=msg.isMe?myName():nameOf(msg.by);
  addChatLine(who,txt,msg.isMe?shirt:(MP.remotes.get(msg.peer)||{}).sh);
  if(msg.isMe&&msg.sameTab){if(P.model){if(P.bubble&&P.bubble.parent)P.bubble.parent.remove(P.bubble);P.bubbleUntil=0;P.bubble=bubbleOver(P.model,txt);const bb=P.bubble;setTimeout(()=>{if(bb.parent)bb.parent.remove(bb);},6000);}}
  else{const r=MP.remotes.get(msg.peer);if(r){if(r.bubble)r.model.remove(r.bubble);r.bubble=bubbleOver(r.model,txt);r.bubbleUntil=t+6;}}
}
function addChatLine(who,txt,color){const log=$('#chatLog');const d=document.createElement('div');const b=document.createElement('b');b.textContent=who;b.style.color=color||'#9fe3ff';
  d.appendChild(b);d.appendChild(document.createTextNode(' '+txt));log.appendChild(d);while(log.children.length>8)log.firstChild.remove();setTimeout(()=>d.classList.add('old'),12000);}
function sysChat(txt){const log=$('#chatLog');if(!log)return;const d=document.createElement('div');d.className='sys';d.textContent=txt;log.appendChild(d);while(log.children.length>8)log.firstChild.remove();setTimeout(()=>d.classList.add('old'),10000);}
const RUNLIM={t:0,n:0};
function onRun(msg){const d=msg.data;
  if(msg.isMe||!d||!Array.isArray(d.to)||!d.to.includes(MP.peerMe)||!running||state.over||typeof d.s!=='string'||typeof d.b!=='string')return;
  if(d.h!==W.projHash)return;
  const now=performance.now();if(now-RUNLIM.t>1000){RUNLIM.t=now;RUNLIM.n=0;}if(++RUNLIM.n>40)return;
  const base=RT.bases.get(d.s),bm=RT.bmap.get(d.s);if(!base||!bm)return;const blk=bm.get(d.b);if(!blk||blk.type!=='pl_as')return;
  const body=D(blk,'DO');if(body)spawnRun(body,Object.assign({},base,{from:msg.peer,host:false}));}
function onGvar(msg){const d=msg.data;if(msg.isMe||!d||typeof d.n!=='string'||!running||d.h!==W.projHash)return;
  if('d' in d){const n=num(d.d,0);RT.vars.set(d.n,(Number(RT.vars.get(d.n))||0)+n);}
  else if(['number','string','boolean'].includes(typeof d.v))RT.vars.set(d.n,typeof d.v==='string'?d.v.slice(0,1000):d.v);}
function onHit(msg){
  if(msg.isMe||!msg.data||msg.data.to!==MP.peerMe||P.dead||state.over)return;
  const n=Math.max(0,Math.min(100,num(msg.data.n,0)));damagePlayer(n);
  if(P.dead)mpEmit('ko',{by:msg.peer});
}
function onKO(msg){
  if(!msg.data)return;const killer=msg.data.by;const kr=killer===MP.peerMe?null:MP.remotes.get(killer);
  const kname=killer===MP.peerMe?myName():nameOf(kr&&kr.by);const vname=msg.isMe?myName():nameOf(msg.by);
  sysChat(kname+' knocked out '+vname);
  if(killer===MP.peerMe&&!msg.isMe&&game&&game.project){changeStat('KOs',1);SFX.win();}
}
function onShot(msg){
  if(msg.isMe||!msg.data)return;const o=msg.data.o,v=msg.data.v;if(!Array.isArray(o)||!Array.isArray(v)||o.length!==3||v.length!==3)return;
  const c=/^#[0-9a-f]{6}$/i.test(msg.data.c||'')?msg.data.c:'#5cc8ff';
  const m=new THREE.Mesh(SPH,mat(c,{neon:true}));m.scale.setScalar(.7);m.position.set(num(o[0],0),num(o[1],0),num(o[2],0));scene.add(m);
  const vv=new V3(num(v[0],0),num(v[1],0),num(v[2],0));if(vv.length()>700)vv.setLength(700);
  W.projectiles.push({m,v:vv,life:3,tool:null,color:c,visual:true});
}
function onFin(msg){if(msg.isMe||!msg.data)return;sysChat(nameOf(msg.by)+' finished'+(isFinite(+msg.data.time)?' in '+fmt(+msg.data.time):''));}
function renderPlayerList(){
  const el=$('#plist');if(!el)return;
  const rows=[{me:true,name:myName(),sh:shirt,st:myStats()}].concat([...MP.remotes.values()].map(r=>({me:false,name:nameOf(r.by),sh:r.sh,st:r.stats})));
  {const seen=new Set();for(const r of W.rigs||[]){if(r.destroyed||!r.mesh.visible||!/^(?:Bot|Fighter)\d{1,2}$/.test(r.name||'')||seen.has(r.name))continue;seen.add(r.name);
    const c=r.node&&r.node.colors&&r.node.colors.torso;rows.push({me:false,bot:true,name:botDisp(r.name),sh:c||'#9e9e9e',st:{}});}}
  const keys=[...new Set(rows.flatMap(r=>Object.keys(r.st||{})))].slice(0,1);const k=keys[0];
  if(k)rows.sort((a,b)=>num(b.st[k],0)-num(a.st[k],0));
  el.innerHTML='';const h=document.createElement('div');h.className='pl-h';const h1=document.createElement('span');h1.textContent='Players';const h2=document.createElement('span');h2.textContent=k||'';h.append(h1,h2);el.appendChild(h);
  for(const r of rows){const d=document.createElement('div');d.className='pl'+(r.me?' me':'');const i=document.createElement('i');i.style.background=/^#[0-9a-f]{6}$/i.test(r.sh||'')?r.sh:'#9e9e9e';
    const sp=document.createElement('span');sp.textContent=r.name+(r.me?' (you)':'');const em=document.createElement('em');em.textContent=k&&r.st&&r.st[k]!=null?String(r3(num(r.st[k],0))):'';d.append(i,sp,em);el.appendChild(d);}
}
$('#btnPlayers').addEventListener('click',()=>{MP.plistOpen=!MP.plistOpen;updateOnlineUI();cv.focus({preventScroll:true});});
function openChat(){if(!MP.gr)return;MP.chatOpen=true;$('#chatForm').hidden=false;$('#chatBtn').hidden=true;keys.clear();jumpHeld=false;const i=$('#chatIn');i.value='';i.focus();}
function renderEmotes(){const m=$('#emoteMenu');m.innerHTML='';
  const add=(a,label)=>{const b=document.createElement('button');b.type='button';b.textContent=label||a.name;b.onclick=()=>{playEmote(a);};m.appendChild(b);};
  if(W.emotes&&W.emotes.length){const p=document.createElement('p');p.textContent='This game';m.appendChild(p);W.emotes.forEach(a=>add(a));}
  const p=document.createElement('p');p.textContent='Emotes';m.appendChild(p);EMOTE_KEYS.forEach(k=>add(BD()[k]));}
function findEmote(name){const k=String(name||'').trim().toLowerCase();const own=(W.emotes||[]).find(a=>a.name.toLowerCase()===k);if(own)return own;
  const bk=k.replace(/[\s_-]/g,'');return EMOTE_KEYS.includes(bk)?BD()[bk]:null;}
function playEmote(a){if(!running||P.dead)return;playAnim('me',a,'auto',true);$('#emoteMenu').hidden=true;$('#emoteBtn').setAttribute('aria-expanded','false');cv.focus({preventScroll:true});}
$('#emoteBtn').addEventListener('click',()=>{const m=$('#emoteMenu');m.hidden=!m.hidden;$('#emoteBtn').setAttribute('aria-expanded',String(!m.hidden));if(!m.hidden)renderEmotes();else cv.focus({preventScroll:true});});
function closeChat(){MP.chatOpen=false;$('#chatForm').hidden=true;$('#chatBtn').hidden=false;if(running)cv.focus({preventScroll:true});}
$('#chatBtn').addEventListener('click',openChat);
$('#chatForm').addEventListener('submit',e=>{e.preventDefault();const v=$('#chatIn').value.replace(/[\u0000-\u001f]/g,'').trim().slice(0,140);
  const em=v.match(/^\/e(?:mote)?\s+(.+)$/i);if(em){const a=findEmote(em[1]);if(a)playEmote(a);else sysChat('No emote called "'+em[1].slice(0,30)+'". Try /e wave, /e dance or /e cheer.');closeChat();return;}
  if(v&&Date.now()-MP.lastChat>700){MP.lastChat=Date.now();mpEmit('chat',{t:v});}closeChat();});
$('#chatIn').addEventListener('keydown',e=>{e.stopPropagation();if(e.key==='Escape'){e.preventDefault();closeChat();}});
$('#chatIn').addEventListener('blur',()=>{if(MP.chatOpen)setTimeout(closeChat,100);});

/* ---- shared Free Build world (db) ---- */
const encC=v=>(v<0?'m':'')+Math.abs(Math.round(v*2));
const brickId=(x,y,z,s)=>`b${encC(x)}_${encC(y)}_${encC(z)}_${s}`;
function startWorld(){
  const wdb=MP.p2p?MP.worldDb:MP.db;if(!wdb)return false;
  MP.world=wdb.collection('world');MP.worldDocs.clear();
  MP.worldUnsub=MP.world.onSnapshot(snap=>{
    if(!game||game.mode!=='build')return;
    for(const ch of snap.docChanges()){const id=ch.doc.id,d=ch.doc.data()||{};const old=W.parts.find(p=>p.data.docId===id);
      if(ch.type==='removed'){if(old)removePart(old);MP.worldDocs.delete(id);continue;}
      const x=num(d.x,NaN),y=num(d.y,NaN),z=num(d.z,NaN),sz=[1,2,4].includes(d.s)?d.s:2,c=/^#[0-9a-f]{6}$/i.test(d.c||'')?d.c:'#a3a2a5';
      if(!isFinite(x)||!isFinite(y)||!isFinite(z))continue;MP.worldDocs.set(id,{by:typeof d.by==='string'?d.by:null});
      if(old){old.mesh.material=mat(c);old.data.rec[4]=c;}else{const p=placeBrick(x,y,z,sz,c);p.data.docId=id;}}
    setStat(W.parts.filter(p=>p.data.built).length+' blocks');
  },err=>{sysChat('The shared world stopped syncing. Reload the page to reconnect.');});
  return true;
}
function worldWrite(fn){Promise.resolve().then(fn).catch(e=>{SFX.nope();
  toast(e&&e.code==='quota_exceeded'?'The shared world is full':'You can look around, but you cannot build in the shared world','#ff9aa4',2.4);});}

/* ---------- GUI (StarterGui, ScreenGui, Frame, TextLabel, TextButton) ---------- */
const GUI_CLS=new Set(['ScreenGui','Frame','TextLabel','TextButton']);
const isGuiNode=n=>!!(n&&GUI_CLS.has(n.cls));
/* GUI fonts: each is a Google font that matches a Roblox Enum.Font, so exports keep the look. [key, label, css family, weight, Roblox Enum.Font token] */
const GUI_FONT_LIST=[['Body','Figtree (clean)',"'Figtree',system-ui,sans-serif",700,19],['Display','Lilita One (chunky)',"'Lilita One','Arial Black',sans-serif",400,26],
  ['Cartoon','Luckiest Guy (cartoon)',"'Luckiest Guy','Lilita One',sans-serif",400,32],['Comic','Bangers (comic)',"'Bangers',Impact,sans-serif",400,22],
  ['Pixel','Press Start 2P (pixel)',"'Press Start 2P',monospace",400,13],['SciFi','Michroma (sci-fi)',"'Michroma',sans-serif",400,34],
  ['Spooky','Creepster (spooky)',"'Creepster',fantasy",400,23],['Marker','Permanent Marker (marker)',"'Permanent Marker',cursive",400,38],
  ['Hand','Indie Flower (handwritten)',"'Indie Flower',cursive",400,28],['Typewriter','Special Elite (typewriter)',"'Special Elite',monospace",400,43],
  ['Tall','Oswald (tall)',"'Oswald',sans-serif",700,36],['Round','Nunito (rounded)',"'Nunito',sans-serif",800,35],['Serif','Merriweather (serif)',"'Merriweather',Georgia,serif",700,33],
  ['Thin','Amatic SC (thin)',"'Amatic SC',cursive",700,21],['Bold','Denk One (bold)',"'Denk One',sans-serif",400,24],['Medieval','Grenze Gotisch (medieval)',"'Grenze Gotisch',serif",700,27],
  ['Mono','Roboto Mono (code)',"'Roboto Mono',ui-monospace,Menlo,Consolas,monospace",500,41]];
const GUI_FONTS={},GUI_FONT_W={},GUI_FONT_TOK={};GUI_FONT_LIST.forEach(([k,,f,w,tok])=>{GUI_FONTS[k]=f;GUI_FONT_W[k]=w;GUI_FONT_TOK[k]=tok;});
function guiNode(cls,o){const base={id:uid(),cls,name:cls,parent:'gui',visible:true};
  if(cls==='ScreenGui')return Object.assign(base,{name:'ScreenGui'},o);
  const d={gpos:[0,24,0,120],gsize:[0,220,0,56],anchor:[0,0],bg:'#16213a',bgT:.15,radius:10,stroke:'#ffffff',strokeW:0,text:'',tc:'#ffffff',ts:20,font:'Body',align:'center'};
  if(cls==='TextLabel')Object.assign(d,{text:'Label',bgT:.35});
  if(cls==='TextButton')Object.assign(d,{text:'Button',bg:'#ff8a1f',bgT:0,tc:'#1a0e00',font:'Display',ts:22,gsize:[0,180,0,52]});
  if(cls==='Frame')Object.assign(d,{gsize:[0,320,0,200],bg:'#16213a',bgT:.2});
  return Object.assign(base,d,o);}
function hexA(hex,tr){const c=new THREE.Color(/^#[0-9a-f]{6}$/i.test(hex||'')?hex:'#000000');return `rgba(${Math.round(c.r*255)},${Math.round(c.g*255)},${Math.round(c.b*255)},${Math.max(0,Math.min(1,1-num(tr,0)))})`;}
function styleGuiEl(el,n){
  const P=Array.isArray(n.gpos)?n.gpos:[0,0,0,0],S=Array.isArray(n.gsize)?n.gsize:[0,100,0,40],A=Array.isArray(n.anchor)?n.anchor:[0,0];
  el.style.left=`calc(${num(P[0],0)*100}% + ${num(P[1],0)}px)`;el.style.top=`calc(${num(P[2],0)*100}% + ${num(P[3],0)}px)`;
  el.style.width=`calc(${num(S[0],0)*100}% + ${num(S[1],0)}px)`;el.style.height=`calc(${num(S[2],0)*100}% + ${num(S[3],0)}px)`;
  el.style.transform=`translate(${-num(A[0],0)*100}%,${-num(A[1],0)*100}%)`;
  el.style.background=hexA(n.bg,n.bgT);el.style.borderRadius=Math.max(0,num(n.radius,0))+'px';
  el.style.boxShadow=num(n.strokeW,0)>0?`inset 0 0 0 ${Math.min(20,num(n.strokeW,0))}px ${hexA(n.stroke,0)}`:'none';
  el.style.color=hexA(n.tc,0);el.style.fontSize=Math.max(6,Math.min(120,num(n.ts,20)))+'px';el.style.fontFamily=GUI_FONTS[n.font]||GUI_FONTS.Body;
  el.style.fontWeight=String(GUI_FONT_W[n.font]||700);
  const sw=Math.max(0,Math.min(12,num(n.strokeT,0)));el.style.webkitTextStroke=sw>0?`${sw*2}px ${hexA(n.strokeTc||'#000000',0)}`:'';el.style.paintOrder=sw>0?'stroke fill':'';
  el.style.textShadow=n.tshadow?`0 ${Math.max(2,Math.round(num(n.ts,20)/10))}px 0 rgba(0,0,0,.45)`:'';el.style.justifyContent=n.align==='left'?'flex-start':n.align==='right'?'flex-end':'center';el.style.textAlign=n.align||'center';
}
function buildGuiDom(proj,container,opts){
  opts=opts||{};container.innerHTML='';const map=new Map();
  const kids=pid=>proj.nodes.filter(n=>n.parent===pid&&isGuiNode(n));
  const make=(n,parentEl)=>{
    let el;
    if(n.cls==='ScreenGui'){el=document.createElement('div');el.className='gui-sg';if(n.visible===false&&!opts.editor)el.hidden=true;}
    else{el=document.createElement(n.cls==='TextButton'&&!opts.editor?'button':'div');if(el.tagName==='BUTTON'){el.type='button';el.tabIndex=-1;}
      el.className='gui-el'+(n.cls==='TextButton'?' btn-el':'');styleGuiEl(el,n);
      const tx=document.createElement('span');tx.className='gtx';tx.textContent=String(n.text||'');el.appendChild(tx);el._tx=tx;
      if(n.visible===false){if(opts.editor)el.classList.add('hid');else el.hidden=true;}}
    el.dataset.id=n.id;parentEl.appendChild(el);map.set(n.id,el);kids(n.id).forEach(k=>make(k,el));
  };
  kids('gui').forEach(n=>make(n,container));
  return map;
}
function buildRuntimeGui(proj){
  W.gui=new Map();W.guiByName=new Map();const layer=$('#guiLayer');
  const map=buildGuiDom(proj,layer,{});
  for(const [id,el] of map){const n=proj.nodes.find(x=>x.id===id);const g={gui:true,node:n,el,name:n.name,clicks:[]};W.gui.set(id,g);
    if(!W.guiByName.has(n.name))W.guiByName.set(n.name,[]);W.guiByName.get(n.name).push(g);
    if(n.cls==='TextButton')el.addEventListener('click',e=>{e.preventDefault();el.blur();if(!running||paused)return;SFX.click();g.clicks.forEach(h=>spawnRun(h.body,h));cv.focus({preventScroll:true});});}
}
function guiv(b,ctx,n){const x=inp(b,n||'GUI');const v=x?ev(x,ctx):null;return v&&v.gui?v:null;}

/* ---------- tools ---------- */
const TOOL_R=new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().set(-1,0,0,0,0,0,1,0,0,1,0,0,0,0,0,1));
function toolParts(proj,id){return descendantsOf(proj,id).filter(n=>n.cls==='Part');}
function toolHandle(proj,tn){const ps=toolParts(proj,tn.id);return ps.find(n=>n.id===tn.handle)||ps.find(n=>n.name==='Handle')||ps[0]||null;}
function hasToolAncestor(proj,id){let n=proj.nodes.find(x=>x.id===id);while(n){const q=proj.nodes.find(x=>x.id===n.parent);if(!q)return false;if(q.cls==='Tool')return true;n=q;}return false;}
function findToolNode(name){const proj=game&&game.project;if(!proj)return null;const all=proj.nodes.filter(n=>n.cls==='Tool'&&n.name===name);
  return all.find(n=>serviceOf(proj,n.id)==='pack')||all.find(n=>serviceOf(proj,n.id)==='rs')||all[0]||null;}
function giveTool(node,quiet){
  const proj=game.project;if(!node||!proj)return null;
  const entry={node,name:node.name,handlers:{act:[],equip:[],unequip:[],hit:[]},cool:0,swingT0:-9,swingUntil:0,hitSet:new Set(),emitters:[]};
  const h=toolHandle(proj,node);entry.color=h?h.color:'#a3a2a5';
  P.backpack.push(entry);renderHotbar();
  startScriptsFor(proj,descendantsOf(proj,node.id).filter(n=>n.cls==='Script'),new Map(),new Map(),{tool:entry});
  if(!quiet){toast('Got '+node.name,'#9fe3ff',1.4);SFX.check();}
  return entry;
}
function removeToolByName(name){const keep=[];for(const e of P.backpack){if(e.name===name){if(P.equipped===e)unequipTool();}else keep.push(e);}P.backpack=keep;renderHotbar();}
function makeHeld(entry){
  const proj=game.project,g=new THREE.Group();const parts=toolParts(proj,entry.node.id);const h=toolHandle(proj,entry.node);if(!h)return g;
  const hp=new V3().fromArray(h.pos);const meshes=new Map();
  for(const n of parts){const m=makePartMesh(n);m.position.sub(hp).applyQuaternion(TOOL_R);m.quaternion.premultiply(TOOL_R);g.add(m);meshes.set(n.id,m);}
  g.position.set(0,-1.9,0);
  for(const n of descendantsOf(proj,entry.node.id))if(n.cls==='ParticleEmitter'&&meshes.has(n.parent)){const e=new Emitter(n,{mesh:meshes.get(n.parent),destroyed:false},scene);entry.emitters.push(e);W.emitters.push(e);}
  return g;
}
function equipTool(entry){
  if(P.dead||!entry)return;if(P.equipped===entry){unequipTool();return;}if(P.equipped)unequipTool();
  P.equipped=entry;P.held=makeHeld(entry);P.model.userData.rArm.add(P.held);
  entry.handlers.equip.forEach(h=>spawnRun(h.body,h));renderHotbar();SFX.click();
}
function unequipTool(){
  const e=P.equipped;if(!e)return;P.equipped=null;
  if(P.held){P.held.parent&&P.held.parent.remove(P.held);P.held.traverse(o=>{if(o.material&&!o.material.userData.shared){if(o.material.map)o.material.map.dispose();o.material.dispose();}});P.held=null;}
  e.emitters.forEach(x=>{x.parent.destroyed=true;});e.emitters=[];
  e.handlers.unequip.forEach(h=>spawnRun(h.body,h));renderHotbar();
}
function activateTool(){
  const e=P.equipped;if(!e||P.dead||state.over)return;if(t<e.cool)return;e.cool=t+Math.max(.05,+e.node.cooldown||.3);
  if(e.node.swing!==false)swingTool(e);
  e.handlers.act.forEach(h=>spawnRun(h.body,h));
}
function swingTool(e){e.swingT0=t;e.swingUntil=t+.35;e.hitSet=new Set();beep(520,170,.13,'triangle',.05);try{boomNoise(.12,2600,.05);}catch(_){}MP.swWall=Date.now();}
function fireToolHit(e,p){if(!p||p.destroyed)return;if(p.rig){JU.lastLocal=t;JU.lastPart=p;}e.handlers.hit.forEach(h=>spawnRun(h.body,Object.assign({},h,{hit:p})));}
/* aiming: shots go toward the tapped/clicked point (or the mouse, or the screen centre for the Use button),
   with gentle aim assist toward characters near that line, and bolts that curve a little toward them */
const AIM={x:0,y:0,at:-1};
function aimRay(){const r=cv.getBoundingClientRect();let sx,sy;
  if(AIM.at>=0&&performance.now()-AIM.at<500){sx=AIM.x;sy=AIM.y;}
  else if(!coarse&&MOUSE.seen){sx=MOUSE.x;sy=MOUSE.y;}
  else{sx=r.left+r.width/2;sy=r.top+r.height*.45;}
  ndc.set(((sx-r.left)/r.width)*2-1,-((sy-r.top)/r.height)*2+1);raycaster.setFromCamera(ndc,camera);return raycaster.ray.clone();}
function aimTarget(ray){
  let best=null,bs=1;const c=new V3(),q=new V3();
  const cands=[...W.rigs.filter(r=>!r.dead&&!r.destroyed&&r.mesh.visible),...[...MP.remotes.values()].filter(r=>!r.dead&&r.model&&r.model.visible)];
  for(const r of cands){c.set((r.min.x+r.max.x)/2,(r.min.y+r.max.y)/2,(r.min.z+r.max.z)/2);if(!r.min||!isFinite(c.x))continue;
    q.copy(c).sub(ray.origin);const tt=q.dot(ray.direction);if(tt<2||tt>220)continue;
    if(c.distanceTo(P.pos)<1.5)continue;
    const d=q.addScaledVector(ray.direction,-tt).length();const tol=Math.max(2.6,tt*.09)+(r.max.x-r.min.x)*.25;const sc=d/tol;
    if(sc<bs){bs=sc;best={r,p:c.clone()};}}
  return best;}
function shootFrom(e,color,speed){
  if(!e||P.dead)return;const start=new V3();
  if(P.held){P.held.updateMatrixWorld(true);P.held.getWorldPosition(start);const fwd=new V3(0,0,1).applyQuaternion(P.model.quaternion);start.addScaledVector(fwd,1.5);}
  else start.copy(P.pos).add(new V3(0,1.2,0));
  const ray=aimRay();const tg=aimTarget(ray);let target;
  if(tg)target=tg.p;
  else{raycaster.set(ray.origin,ray.direction);raycaster.near=Math.max(0,camera.position.distanceTo(P.pos)-1);raycaster.far=400;
    const ms=W.parts.filter(p=>p.mesh.visible&&!p.decor&&!p.toolPickup&&!(p.noCollide&&!p.rig)).map(p=>p.mesh);
    const hit=raycaster.intersectObjects(ms,true).find(h=>h.object.isMesh);raycaster.near=0;
    target=hit?hit.point.clone():ray.origin.clone().addScaledVector(ray.direction,250);}
  const dir=target.clone().sub(start);if(dir.lengthSq()<.01)dir.copy(ray.direction);dir.normalize();
  if(P.model&&!P.rag){P.yaw=Math.atan2(-dir.x,-dir.z);P.model.rotation.y=P.yaw;}
  const m=new THREE.Mesh(SPH,mat(color||'#5cc8ff',{neon:true}));m.scale.setScalar(.7);m.position.copy(start);scene.add(m);
  const sp=Math.max(5,Math.min(600,speed||120));
  try{juiceShake(.07);beep(sp>300?900:620,sp>300?300:240,.07,'square',.03);muzzleAt(start,color||'#5cc8ff');}catch(e){}
  W.projectiles.push({m,v:dir.multiplyScalar(sp),sp,life:3,tool:e,color:color||'#5cc8ff',home:tg?tg.r:null});SFX.boost();
  mpEmit('shot',{o:start.toArray().map(r3),v:W.projectiles[W.projectiles.length-1].v.toArray().map(r3),c:color||'#5cc8ff'});
}
function pointInPart(p,v,r){
  if(p.obb){const c=Math.cos(p.yaw),sn=Math.sin(p.yaw),dx=v.x-p.pos.x,dz=v.z-p.pos.z;const lx=dx*c-dz*sn,lz=dx*sn+dz*c,ly=v.y-p.pos.y;
    return Math.abs(lx)<p.size.x/2+r&&Math.abs(lz)<p.size.z/2+r&&Math.abs(ly)<p.size.y/2+r;}
  return v.x>p.min.x-r&&v.x<p.max.x+r&&v.y>p.min.y-r&&v.y<p.max.y+r&&v.z>p.min.z-r&&v.z<p.max.z+r;}
function muzzleAt(v,color){const o=new THREE.Object3D();o.position.copy(v);o.scale.setScalar(.4);o.updateMatrixWorld();
  const e=new Emitter(Object.assign({},PPRESETS.sparkles,{shape:'spark',color0:color,color1:color,speed:6,spread:60,size0:.6,size1:0,lifeMin:.1,lifeMax:.2,rate:0}),{mesh:o,destroyed:true},scene);e.emit(7);W.emitters.push(e);}
function burstAt(v,color){const o=new THREE.Object3D();o.position.copy(v);o.scale.setScalar(.6);o.updateMatrixWorld();
  const e=new Emitter(Object.assign({},PPRESETS.sparkles,{shape:'spark',color0:color,color1:color,speed:8,spread:180,size0:.9,size1:0,lifeMin:.25,lifeMax:.5,rate:0}),{mesh:o,destroyed:true},scene);e.emit(24);W.emitters.push(e);}
function updateTools(dt){
  const e=P.equipped;
  if(e&&P.held&&t<e.swingUntil){const bb=new THREE.Box3().setFromObject(P.held);
    for(const p of W.parts){if(!p.active||p.destroyed||p.decor||p.kind==='water'||e.hitSet.has(p)||p.toolPickup)continue;
      if(bb.min.x<p.max.x&&bb.max.x>p.min.x&&bb.min.y<p.max.y&&bb.max.y>p.min.y&&bb.min.z<p.max.z&&bb.max.z>p.min.z){e.hitSet.add(p);fireToolHit(e,p);}}
    for(const p of MP.remotes.values()){if(p.dead||e.hitSet.has(p))continue;
      if(bb.min.x<p.max.x&&bb.max.x>p.min.x&&bb.min.y<p.max.y&&bb.max.y>p.min.y&&bb.min.z<p.max.z&&bb.max.z>p.min.z){e.hitSet.add(p);fireToolHit(e,p);}}}
  for(const pr of W.projectiles){pr.life-=dt;
    if(pr.home&&!pr.home.dead&&!pr.home.destroyed&&pr.home.min){const hc=new V3((pr.home.min.x+pr.home.max.x)/2,(pr.home.min.y+pr.home.max.y)/2,(pr.home.min.z+pr.home.max.z)/2);
      const want=hc.sub(pr.m.position);if(want.dot(pr.v)>0){want.setLength(pr.sp);pr.v.lerp(want,Math.min(1,dt*6)).setLength(pr.sp);}}
    const steps=Math.max(1,Math.ceil(pr.v.length()*dt/1.2));let hit=null;
    for(let i=0;i<steps&&!hit;i++){pr.m.position.addScaledVector(pr.v,dt/steps);
      if(!pr.visual)for(const p of MP.remotes.values()){if(!p.dead&&pointInPart(p,pr.m.position,.8)){hit=p;break;}}
      if(!hit)for(const p of W.parts){if(!p.active||p.destroyed||p.decor||p.toolPickup||(p.noCollide&&!p.rig))continue;if(pointInPart(p,pr.m.position,p.rig?.8:.35)){hit=p;break;}}}
    if(hit){pr.life=0;burstAt(pr.m.position,pr.color);if(hit.kind!=='water'&&!pr.visual)fireToolHit(pr.tool,hit);}
    if(pr.life<=0){scene.remove(pr.m);}}
  W.projectiles=W.projectiles.filter(pr=>pr.life>0);
  for(const pk of W.pickups){if(pk.taken||P.dead)continue;
    if(pk.parts.some(p=>!p.destroyed&&partOverlap(p,-.2))){pk.taken=true;pk.parts.forEach(destroyPart);giveTool(pk.node);}}
  for(const d of W.debris){d.life-=dt;d.v.y-=PHYS.gravity*.35*dt;d.m.position.addScaledVector(d.v,dt);d.m.rotation.x+=d.s.x*dt;d.m.rotation.z+=d.s.z*dt;if(d.life<=0)scene.remove(d.m);}
  W.debris=W.debris.filter(d=>d.life>0);
  if(!P.dead&&P.health<P.maxHealth)P.health=Math.min(P.maxHealth,P.health+P.maxHealth*.01*dt);
}
const TOOL_EMOJI=[[/knife/i,'🔪'],[/sword|blade|saber/i,'🗡️'],[/rocket|launcher/i,'🚀'],[/sniper|rail/i,'🎯'],[/flame/i,'🔥'],[/scatter|shotgun/i,'💥'],[/snow/i,'❄️'],[/laser/i,'⚡'],[/blaster|gun|pistol|rapid/i,'🔫'],[/flash|lantern|torch/i,'🔦'],[/potion|heal|med/i,'🧪'],[/bat|hammer|bonk/i,'🏏'],[/smoke|bomb/i,'💨'],[/taunt/i,'😜'],[/sprint|boots|speed/i,'👟'],[/flare/i,'🎆'],[/parachute|chute/i,'🪂'],[/key/i,'🔑'],[/shield/i,'🛡️'],[/build|brick/i,'🧱']];
function toolEmoji(n){for(const [r,e] of TOOL_EMOJI)if(r.test(n||''))return e;return '';}
function renderHotbar(){
  const hb=$('#hotbar');if(!hb)return;hb.hidden=!P.backpack.length;
  hb.innerHTML=P.backpack.map((e,i)=>`<button type="button" class="slot" data-slot="${i}" aria-pressed="${P.equipped===e}" title="${esc(e.node.tooltip||e.name)}"><span class="k">${i<9?i+1:''}</span><i style="background:${esc(e.color)}">${toolEmoji(e.name)}</i><b>${esc(e.name)}</b></button>`).join('');
  $('#useBtn').hidden=!(coarse&&P.equipped);$('#xhair').hidden=!(coarse&&P.equipped);
}
$('#hotbar').addEventListener('click',e=>{const b=e.target.closest('[data-slot]');if(!b)return;equipTool(P.backpack[+b.dataset.slot]);cv.focus({preventScroll:true});});
$('#useBtn').addEventListener('pointerdown',e=>{e.preventDefault();activateTool();});
function registerAnims(proj){
  W.anims=new Map();W.emotes=[];const base={};
  for(const n of proj.nodes){if(n.cls!=='Animation')continue;const a=animData(n);const k=a.name.toLowerCase();if(!W.anims.has(k))W.anims.set(k,a);
    if(serviceOf(proj,n.id)==='player'){if(k==='idle'||k==='walk'||k==='jump')base[k]=a;else if(n.emote)W.emotes.push(a);}}
  W.baseAnims=Object.keys(base).length?base:null;
}
function giveStarterTools(proj){proj.nodes.filter(n=>n.cls==='Tool'&&n.parent==='pack').forEach(n=>giveTool(n,true));}

/* ---------- script runtime (block code interpreter) ---------- */
const STOP={stop:true};
const RT={gen:0,waiters:[],touch:[],click:[],key:[],msg:new Map(),died:[],vars:new Map(),stats:new Map(),warned:new Set(),t0:0,last:null};
let t=0;
function rtReset(){RT.gen++;RT.hostGen=(RT.hostGen||0)+1;RT.hostStarts=[];RT.hostParts=new Set();RT.copySeq=0;RT.joinT=Date.now();HOST.am=true;HOST.peer=null;HOST.last={};MOUSE.down=0;Object.assign(RT,{dataLoaded:[],ptouch:[],bases:new Map(),bmap:new Map(),land:[],hurt:[],mouse:[],spawn:[],jump:[],waiters:[],touch:[],click:[],key:[],msg:new Map(),died:[],vars:new Map(),stats:new Map(),warned:new Set(),t0:0,last:null});}
function sleep(s,ctx){return new Promise(res=>RT.waiters.push({at:t+Math.max(0,+s||0),res,gen:ctx.gen,hg:ctx.hostGen}));}
function rtTick(){if(!RT.waiters.length)return;const due=[];
  RT.waiters=RT.waiters.filter(w=>{if(w.gen!==RT.gen||(w.hg!=null&&w.hg!==RT.hostGen))return false;if(w.at<=t+1e-9){due.push(w);return false;}return true;});due.forEach(w=>w.res());}
function rtErr(e,ctx){if(e===STOP||ctx.gen!==RT.gen)return;logOut((ctx.script||'Script')+': '+((e&&e.message)||e),'err');}
function spawnRun(body,base){if(!body)return Promise.resolve();if(base.host&&!HOST.am)return Promise.resolve();
  const ctx=Object.assign({},base,{gen:RT.gen,ops:0});if(base.host)ctx.hostGen=RT.hostGen;return run(body,ctx).catch(e=>rtErr(e,ctx));}
/* ---------- host: in multiplayer one player (the one who has been in the game longest) runs the
   "host only" scripts and all the bots; everyone else sees copies of what the host does ---------- */
const HOST={am:true,peer:null,sendT:0,last:{}};
function hostKey(r){return [num(r.jt,9e15),String(r.peer||'')];}
function computeHost(){if(!MP.gr||!MP.peerMe||!MP.remotes.size)return {am:true,peer:MP.peerMe||null};
  let best=[RT.joinT||0,String(MP.peerMe)],peer=MP.peerMe;
  for(const r of MP.remotes.values()){const k=hostKey(r);if(k[0]<best[0]||(k[0]===best[0]&&k[1]<best[1])){best=k;peer=r.peer;}}
  return {am:peer===MP.peerMe,peer};}
function nearestPlayer(pos){let best=null,bd=1e18;if(!P.dead&&!P.hidden){const d=P.pos.distanceToSquared(pos);if(d<bd){bd=d;best={pos:P.pos,me:true,y:P.pos.y-PH.y};}}
  for(const r of MP.remotes.values()){if(r.dead||r.inv)continue;const d=r.pos.distanceToSquared(pos);if(d<bd){bd=d;best={pos:r.pos,me:false,r,y:r.pos.y-2.5};}}if(best)best.d=Math.sqrt(bd);return best;}
function myPid(){return MP.gr&&MP.peerMe?String(MP.peerMe):'solo';}
function isPup(p){return !!(p&&p.rig&&p.puppet);}
function hostTick(dt){if(!running||!game||!game.project)return;
  const h=computeHost();HOST.peer=h.peer;
  if(h.am!==HOST.am){HOST.am=h.am;RT.hostGen++;
    for(const r of W.rigs)r.puppet=!h.am;
    if(h.am){(RT.hostStarts||[]).forEach(x=>spawnRun(x.body,x));logOut('You are now the host: bots and host scripts run on your computer.','sys');}
    else{for(const r of W.rigs){r.walk&&r.walk.done();r.walk=null;}}}
  if(HOST.am&&MP.gr&&MP.remotes.size){HOST.sendT-=dt;if(HOST.sendT<=0){HOST.sendT=.12;hostSendSnap();}}
  if(!HOST.am)for(const r of W.rigs)r.puppet=true;}
function rigKey(r){if(!r.key)r.key=r.copyKey||(r.node&&r.node.id)||('r'+W.rigs.indexOf(r));return r.key;}
function hostSendSnap(){
  const rr=[];for(const r of W.rigs){if(r.destroyed)continue;const vis=r.mesh.visible;const tc=r.torsoCol||'';
    rr.push([rigKey(r),r3(r.pos.x),r3(r.pos.y),r3(r.pos.z),r3(r.yaw||0),(r.walk?1:0)|(r.dead?2:0)|(vis?0:4)|(r.rag?8:0),Math.round(r.health),tc,r.sayText||'']);}
  const pp=[];for(const p of RT.hostParts||[]){if(p.destroyed||!p.node||!p.node.id){continue;}
    pp.push([p.node.id,r3(p.pos.x),r3(p.pos.y),r3(p.pos.z),(p.mesh.visible?1:0)|(p.noCollide?2:0)|(p.kind==='kill'?4:0),p.labelText||'',p.look&&p.look.color||'',r3(p.look&&p.look.transparency||0)]);}
  const o={t:'snap',h:W.projHash,r:rr,p:pp};HOST.vt=(HOST.vt||0)+1;if(HOST.vt%8===0){const v={};for(const k of Object.keys(HOST.last)){const x=RT.vars.get(k);if(x!=null)v[k]=x;}o.v=v;}
  mpEmit('bot',o);}
function onBot(msg){const d=msg.data;if(msg.isMe||!d||!running||!game||!game.project)return;
  if(d.h&&d.h!==W.projHash)return;
  if(d.t==='snap'){if(HOST.am||msg.peer!==HOST.peer||!Array.isArray(d.r))return;applySnap(d);
    if(d.v&&typeof d.v==='object')for(const [k,v] of Object.entries(d.v))if(['number','string','boolean'].includes(typeof v))RT.vars.set(String(k).slice(0,60),typeof v==='string'?v.slice(0,1000):v);return;}
  if(d.t==='msg'){if(typeof d.x==='string')toast(d.x.slice(0,200),'#fff',Math.max(.5,Math.min(20,num(d.s,2))));return;}
  if(d.t==='snd'){const f=SFX[d.n];if(typeof d.n==='string'&&f)f();return;}
  if(d.t==='bc'){if(typeof d.m==='string')(RT.msg.get(d.m)||[]).forEach(h=>{if(!h.host)spawnRun(h.body,h);});return;}
  const r=typeof d.k==='string'?W.rigs.find(x=>!x.destroyed&&rigKey(x)===d.k):null;
  if(d.t==='dmg'&&HOST.am&&r){r.lastHitBy=msg.peer;damageRig(r,Math.max(0,Math.min(1000,num(d.n,0))));return;}
  if(d.t==='fling'&&HOST.am&&r&&Array.isArray(d.v)){r.lastHitBy=msg.peer;ragdollRig(r,Math.max(.3,Math.min(10,num(d.s,2.5))),new V3(num(d.v[0],0),num(d.v[1],0),num(d.v[2],0)).clampLength(0,400));return;}
  if(d.t==='kd'&&d.to===MP.peerMe&&r){juiceKO(r,true);(r.diedHandlers||[]).forEach(h=>{if(!h.host)spawnRun(h.body,h);});return;}}
function applySnap(d){
  const seen=new Set();
  for(const e of d.r){if(!Array.isArray(e)||typeof e[0]!=='string')continue;const k=e[0];seen.add(k);
    let r=W.rigs.find(x=>!x.destroyed&&rigKey(x)===k);
    if(!r&&k[0]==='c'){const tid=k.split(':')[1];const tpl=game.project.nodes.find(n=>n.id===tid);
      if(tpl){RT.allowRigCopy=true;try{const res=copyFromStorage(tpl.name,c=>new V3(num(e[1],0),num(e[2],0),num(e[3],0)).sub(c));const rp=res&&(res.rig?res:(res.parts||[]).find(p=>p.rig));
        if(rp){rp.key=k;rp.copyKey=k;}r=rp||null;}finally{RT.allowRigCopy=false;}}}
    if(!r)continue;r.puppet=true;
    r.net={x:num(e[1],r.pos.x),y:num(e[2],r.pos.y),z:num(e[3],r.pos.z),yaw:num(e[4],0),f:num(e[5],0)};
    const hp=num(e[6],r.health);if(hp!==r.health){r.health=Math.max(0,Math.min(r.maxHealth,hp));rigHpSprite(r);}
    if(typeof e[7]==='string'&&e[7]!==(r.torsoCol||'')&&/^#[0-9a-f]{6}$/i.test(e[7])){r.torsoCol=e[7];r.mesh.userData.rig.torso.material=mat(e[7]);}
    if(typeof e[8]==='string'&&e[8]!==(r.sayText||'')){r.sayText=e[8];const txt=e[8].replace(/^\d+\|/,'');rigSay(r,txt,3);}}
  for(const r of [...W.rigs])if(!r.destroyed&&!seen.has(rigKey(r))&&(r.copyKey||d.r.length))destroyPart(r);
  if(Array.isArray(d.p))for(const e of d.p){if(!Array.isArray(e))continue;const p=W.byId&&W.byId.get(e[0]);if(!p||p.destroyed||p.rig)continue;
    const v=new V3(num(e[1],p.pos.x),num(e[2],p.pos.y),num(e[3],p.pos.z));if(v.distanceToSquared(p.pos)>1e-6)setPartPos(p,v);
    const fl=num(e[4],1);p.mesh.visible=!!(fl&1);p.noCollide=!!(fl&2);
    const kill=!!(fl&4);if(kill!==(p.kind==='kill')){if(kill){p.kind='kill';if(!W.special.includes(p))W.special.push(p);}else{p.kind='solid';removeFrom(W.special,p);}applyLook(p);}
    if(typeof e[5]==='string'&&e[5]!==(p.labelText||''))setPartLabel(p,e[5]);
    if(typeof e[6]==='string'&&/^#[0-9a-f]{6}$/i.test(e[6])&&(!p.look||p.look.color!==e[6])){applyLook(p);p.look.color=e[6];applyLook(p);}
    const tr=Math.max(0,Math.min(1,num(e[7],0)));if(p.look&&Math.abs((p.look.transparency||0)-tr)>.01){p.look.transparency=tr;applyLook(p);}}}
function puppetStep(r,dt){const n=r.net;if(!n)return false;const k=Math.min(1,dt*10);
  const np=r.pos.clone().lerp(new V3(n.x,n.y,n.z),k);if(np.distanceToSquared(new V3(n.x,n.y,n.z))>400)np.set(n.x,n.y,n.z);setPartPos(r,np);
  let dy=n.yaw-r.yaw;while(dy>Math.PI)dy-=Math.PI*2;while(dy<-Math.PI)dy+=Math.PI*2;r.yaw+=dy*k;r.mesh.rotation.y=r.yaw;
  const dead=!!(n.f&2);if(dead!==r.dead){r.dead=dead;r.active=!dead;if(r.hpSprite)r.hpSprite.visible=!dead&&r.health<r.maxHealth;}
  r.mesh.visible=!(n.f&4)&&!dead;return !!(n.f&1);}
/* send a player's hit on a bot to the host */
function hitPuppet(r,kind,o){if(kind==='dmg'&&o&&o.n>0)juiceRigHit(r,o.n);mpEmit('bot',Object.assign({t:kind,k:rigKey(r),h:W.projHash},o));r.flashT=.12;
  r.mesh.traverse(x=>{if(x.isMesh&&x.userData.rigPart!==false&&x.material!==faceDecal&&x.material!==FLASHMAT){x.userData.orig=x.material;x.material=FLASHMAT;}});}
function hostShareVar(k,v){if(!MP.gr||!MP.remotes.size)return;if(!(typeof v==='number'||typeof v==='boolean'||typeof v==='string'))return;
  if(HOST.last[k]===v)return;HOST.last[k]=v;mpEmit('gvar',{n:String(k).slice(0,60),v:typeof v==='string'?v.slice(0,1000):v,h:W.projHash});}
const HOSTPART=new Set(['p_setpos','p_move','p_glide','p_glideto','p_visible','p_label','p_color','p_collide','p_transp','p_deadly']);
function rtFire(kind,arg){
  if(kind==='died')RT.died.forEach(h=>spawnRun(h.body,h));
  else if(kind==='msg'){const sd=arg==='round start'&&LOBBY.on?LOBBY.seed:null;(RT.msg.get(arg)||[]).forEach((h,i)=>spawnRun(h.body,sd==null?h:Object.assign({},h,{rng:mulberry((sd*2654435761+hashStr(String(h.script||''))+i*7919)|0)})));}
  else if(kind==='key')RT.key.forEach(h=>{if(h.key===arg)spawnRun(h.body,h);});
  else if(kind==='spawn')(RT.spawn||[]).forEach(h=>spawnRun(h.body,h));
  else if(kind==='land')(RT.land||[]).forEach(h=>spawnRun(h.body,h));
  else if(kind==='hurt')(RT.hurt||[]).forEach(h=>spawnRun(h.body,h));
  else if(kind==='jump')(RT.jump||[]).forEach(h=>spawnRun(h.body,h));
}
const inp=(b,n)=>{const i=b&&b.inputs&&b.inputs[n];return i?(i.block||i.shadow):null;};
const fld=(b,n)=>b&&b.fields?b.fields[n]:undefined;
function varName(b,ctx){const f=fld(b,'VAR');if(!f)return '?';if(typeof f==='string')return f;return (ctx.vmap&&ctx.vmap.get(f.id))||f.name||f.id;}
function numv(b,ctx,d){const v=Number(ev(b,ctx));return isFinite(v)?v:(d||0);}
function partv(b,ctx,n){const x=inp(b,n||'PART');const p=x?ev(x,ctx):null;if(!p||typeof p!=='object')return null;if(p.destroyed)return null;return p;}
function partsOf(v){if(!v||typeof v!=='object'||v.remote)return [];if(v.isGroup)return v.parts.filter(p=>!p.destroyed);return v.destroyed||!v.mesh?[]:[v];}
function boundsOf(ps){const bb=new THREE.Box3();ps.forEach(p=>{bb.expandByPoint(p.min);bb.expandByPoint(p.max);});return bb;}
function centerOf(v){const ps=partsOf(v);if(!ps.length)return null;return v.isGroup?boundsOf(ps).getCenter(new V3()):v.pos.clone();}
function moveParts(ps,d){if(d.lengthSq()===0)return;ps.forEach(p=>{if(!isPup(p))setPartPos(p,p.pos.clone().add(d));});}
function rotatePart(p,ax,rad){
  if(ax==='y'&&(p.obb||!p.rotated)){p.yaw+=rad;p.mesh.rotation.y=p.yaw;p.rotated=true;if(!p.obb){p.obb=true;W.obbs.push(p);}}
  else{p.mesh.rotateOnWorldAxis(new V3(ax==='x'?1:0,ax==='y'?1:0,ax==='z'?1:0),rad);p.rotated=true;if(p.obb){p.obb=false;p.wedge=false;removeFrom(W.obbs,p);}}
  computeAABB(p);}
function topOf(v){const ps=partsOf(v);if(!ps.length)return null;const bb=boundsOf(ps);const c=bb.getCenter(new V3());return new V3(c.x,bb.max.y,c.z);}
function findPart(name){const l=W.byName.get(name);if(!l)return null;for(const p of l)if(!p.destroyed)return p;return null;}
function warnOnce(k,msg){if(RT.warned.has(k))return;RT.warned.add(k);logOut(msg,'warn');}
const truthy=v=>v===true||(v!==false&&v!=null&&v!==0&&v!=='');
function ev(b,ctx){
  if(!b)return null;
  switch(b.type){
    case 'math_number':return Number(fld(b,'NUM'))||0;
    case 'text':return String(fld(b,'TEXT')??'');
    case 'logic_boolean':return fld(b,'BOOL')==='TRUE';
    case 'logic_negate':return !truthy(ev(inp(b,'BOOL'),ctx));
    case 'logic_operation':{const a=truthy(ev(inp(b,'A'),ctx));return fld(b,'OP')==='AND'?a&&truthy(ev(inp(b,'B'),ctx)):a||truthy(ev(inp(b,'B'),ctx));}
    case 'logic_compare':{const a=ev(inp(b,'A'),ctx),c=ev(inp(b,'B'),ctx);
      switch(fld(b,'OP')){case 'EQ':return a==c;case 'NEQ':return a!=c;case 'LT':return a<c;case 'LTE':return a<=c;case 'GT':return a>c;case 'GTE':return a>=c;}return false;}
    case 'math_round':{const v=numv(inp(b,'NUM'),ctx),o=fld(b,'OP');return o==='ROUNDUP'?Math.ceil(v):o==='ROUNDDOWN'?Math.floor(v):Math.round(v);}
    case 'math_arithmetic':{const a=numv(inp(b,'A'),ctx),c=numv(inp(b,'B'),ctx);
      switch(fld(b,'OP')){case 'ADD':return a+c;case 'MINUS':return a-c;case 'MULTIPLY':return a*c;case 'DIVIDE':return c===0?0:a/c;case 'POWER':return Math.pow(a,c);}return 0;}
    case 'math_random_int':{let a=Math.round(numv(inp(b,'FROM'),ctx)),c=Math.round(numv(inp(b,'TO'),ctx));if(a>c)[a,c]=[c,a];return a+Math.floor((ctx.rng||Math.random)()*(c-a+1));}
    case 'text_join':{const n=(b.extraState&&b.extraState.itemCount!=null)?b.extraState.itemCount:2;let s='';for(let i=0;i<n;i++){const v=ev(inp(b,'ADD'+i),ctx);s+=v==null?'':(typeof v==='number'?String(r3(v)):String(v));}return s;}
    case 'variables_get':{const v=RT.vars.get(varName(b,ctx));return v==null?0:v;}
    case 'p_this':if(!ctx.part)warnOnce('this:'+ctx.script,ctx.script+': "this part" only works in a script placed inside a part.');return ctx.part||null;
    case 'p_named':{const nm=String(fld(b,'NAME')||'');const p=findPart(nm);if(!p)warnOnce('nf:'+nm,'No part named "'+nm+'" was found.');return p;}
    case 'rs_last':return RT.last||null;
    case 'gui_this':if(!ctx.gui)warnOnce('gthis:'+ctx.script,ctx.script+': "this gui" only works in a script inside a GUI element.');return ctx.gui||null;
    case 'gui_named':{const nm=String(fld(b,'NAME')||'');const g=(W.guiByName&&W.guiByName.get(nm)||[])[0];if(!g)warnOnce('gnf:'+nm,'No GUI element named "'+nm+'" was found.');return g||null;}
    case 's_gui_text':{const g=guiv(b,ctx);return g&&g.el._tx?g.el._tx.textContent:'';}
    case 'tool_hitpart':if(!ctx.hit)warnOnce('hit:'+ctx.script,ctx.script+': "hit part" only has a value inside "when this tool hits a part".');return ctx.hit||null;
    case 's_isrig':{const v=partv(b,ctx);return !!(v&&v.rig&&!v.dead);}
    case 's_health':return r3(P.health);
    case 's_rig_health':{const r=partsOf(partv(b,ctx)).find(p=>p.rig);return r?r3(r.health):0;}
    case 's_has_tool':return P.backpack.some(e=>e.name===String(fld(b,'NAME')));
    case 's_isplayer':{const v=partv(b,ctx);return !!(v&&v.remote&&!v.dead);}
    case 's_players':return 1+[...MP.remotes.values()].length;
    case 'p_model':if(!ctx.model)warnOnce('thism:'+ctx.script,ctx.script+': "this model" only works in a script inside a Model, or inside a part of one.');return ctx.model||null;
    case 'p_model_named':{const nm=String(fld(b,'NAME')||'');const m=(W.modelsByName.get(nm)||[])[0];if(!m)warnOnce('nfm:'+nm,'No model named "'+nm+'" was found.');return m||null;}
    case 's_key':return keys.has(fld(b,'KEY'));
    case 's_mouse_down':return MOUSE.down>0&&!paused;
    case 's_mouse_part':return mousePart();
    case 's_mouse_xy':{const r=cv.getBoundingClientRect();if(!r.width)return 0;return fld(b,'AXIS')==='x'?Math.round((MOUSE.x-r.left)/r.width*480-240):Math.round(180-(MOUSE.y-r.top)/r.height*360);}
    case 's_touching':{const ps=partsOf(partv(b,ctx));return !P.dead&&ps.some(p=>partOverlap(p,-.15));}
    case 's_distance':{const c=centerOf(partv(b,ctx));return c?r3(c.distanceTo(P.pos)):0;}
    case 's_player':{const a=fld(b,'AXIS');if(a==='speed')return r3(Math.hypot(P.vel.x,P.vel.z));return r3(a==='y'?P.pos.y-PH.y:P.pos[a]);}
    case 's_prop':{const v=partv(b,ctx);const ps=partsOf(v);if(!ps.length)return 0;const k=fld(b,'PROP');
      if(k==='x'||k==='y'||k==='z')return r3(centerOf(v)[k]);
      if(k[0]==='s'&&k.length===2){const sz=v.isGroup?boundsOf(ps).getSize(new V3()):ps[0].size;return r3(sz[k[1]]);}
      return ps[0].look?ps[0].look.transparency||0:0;}
    case 's_timer':return r3(state.time-RT.t0);
    case 'data_get_or':{const k=String(ev(inp(b,'KEY'),ctx)??'');return k in SAVE.d?SAVE.d[k]:ev(inp(b,'DEF'),ctx);}
    case 'data_get':{const k=String(ev(inp(b,'KEY'),ctx)??'');return k in SAVE.d?SAVE.d[k]:0;}
    case 'data_has':return String(ev(inp(b,'KEY'),ctx)??'') in SAVE.d;
    case 'data_loaded':return SAVE.loaded;
    case 'data_returning':return SAVE.hadSave;
    case 's_pl_name':return myName();
    case 'pl_ref':{const w=fld(b,'WHO')||'me';if(w==='sender'){const r=ctx.from&&MP.remotes.get(ctx.from);return r?{plist:[r]}:{plr:'me'};}return {plr:w};}
    case 'pl_ref_touchme':return {plist:otherPlayers().filter(r=>touchingMe(r))};
    case 'pl_touched':if(!ctx.touched)warnOnce('tp:'+ctx.script,ctx.script+': "touched player" only has a value inside "when I touch another player".');return ctx.touched||null;
    case 's_touch_player':{const x=inp(b,'WHO');const tg=resolveTargets(x?ev(x,ctx):{plr:'others'});return tg.some(r=>r!=='me'&&touchingMe(r));}
    case 's_touch_name':{const ps=ctx.part?[ctx.part]:ctx.model?ctx.model.parts:[];if(!ctx.part&&!ctx.model){warnOnce('tn:'+ctx.script,ctx.script+': "name of player touching this part" needs the script to be inside a part or model.');return '';}
      const who=playersTouching(ps.filter(p=>!p.destroyed));if(!who.length)return '';return fld(b,'MODE')==='all'?who.map(targetName).join(', '):targetName(who[0]);}
    case 's_touch_count':{const ps=ctx.part?[ctx.part]:ctx.model?ctx.model.parts:[];if(!ctx.part&&!ctx.model){warnOnce('tc:'+ctx.script,ctx.script+': "players touching this part" needs the script to be inside a part or model.');return 0;}
      return playersTouching(ps.filter(p=>!p.destroyed)).length;}
    case 'pl_ref_touch':{const ps=partsOf(partv(b,ctx));const out=[];if(!ps.length)return {plist:out};
      if(!P.dead&&ps.some(p=>partOverlap(p,-.12)))out.push('me');
      for(const r of otherPlayers()){if(r.dead)continue;if(ps.some(p=>r.min.x<p.max.x&&r.max.x>p.min.x&&r.min.y<p.max.y&&r.max.y>p.min.y&&r.min.z<p.max.z&&r.max.z>p.min.z))out.push(r);}
      return {plist:out};}
    case 'pl_ref_named':{const nm=String(ev(inp(b,'NAME'),ctx)??'').trim().toLowerCase().replace(/^@/,'');const out=[];if(!nm)return {plist:out};
      if(myName().toLowerCase()===nm||myPid().toLowerCase()===nm)out.push('me');for(const r of otherPlayers())if(nameOf(r.by).toLowerCase()===nm||String(r.peer).toLowerCase()===nm)out.push(r);return {plist:out};}
    case 'pl_ref_nearpart':{const c=centerOf(partv(b,ctx));const n=c&&nearestPlayer(c);return {plist:n?[n.me?'me':n.r]:[]};}
    case 's_is_host':return HOST.am;
    case 's_pl_id':return myPid();
    case 's_pl_idof':{const x=inp(b,'WHO');const tg=resolveTargets(x?ev(x,ctx):null);return tg.length?(tg[0]==='me'?myPid():String(tg[0].peer)):'';}
    case 's_pl_axisof':{const x=inp(b,'WHO');const tg=resolveTargets(x?ev(x,ctx):null);if(!tg.length)return 0;const a=fld(b,'AXIS')||'x';
      if(tg[0]==='me')return r3(a==='y'?P.pos.y-PH.y:P.pos[a]);return r3(a==='y'?tg[0].pos.y-2.5:tg[0].pos[a]);}
    case 's_near_axis':{const c=centerOf(partv(b,ctx));const n=c&&nearestPlayer(c);if(!n)return 0;const a=fld(b,'AXIS')||'x';return r3(a==='y'?n.y:n.pos[a]);}
    case 's_near_dist':{const c=centerOf(partv(b,ctx));const n=c&&nearestPlayer(c);return n?r3(n.d):9999;}
    case 's_pl_nameof':{const x=inp(b,'WHO');const tg=resolveTargets(x?ev(x,ctx):null);return tg.length?targetName(tg[0]):'';}
    case 's_pl_hpof':{const x=inp(b,'WHO');const tg=resolveTargets(x?ev(x,ctx):null);if(!tg.length)return 0;return tg[0]==='me'?r3(P.health):r3(num(tg[0].hp,100));}
    case 's_pl_countof':{const x=inp(b,'WHO');return resolveTargets(x?ev(x,ctx):null).length;}
    case 's_pl_maxhp':return r3(P.maxHealth);
    case 's_partname':{const v=partv(b,ctx);return v?(v.isGroup?String(v.name||''):String(v.name||'')):'';}
    case 's_pl_ragdoll':return !!P.rag&&!P.dead;
    case 's_pl_speed':return r3(PHYS.walk);
    case 's_land_speed':return r3(P.landSpeed||0);
    case 's_pl_moving':return !P.dead&&Math.hypot(P.vel.x,P.vel.z)>1;
    case 's_pl_alive':return !P.dead;
    case 's_pl_tool':return P.equipped?P.equipped.name:'';
    case 's_pl_shield':return P.shieldUntil>t;
    case 's_anim_playing':return !!(P.anim&&!P.anim.out);
    case 's_stat':return RT.stats.get(String(fld(b,'STAT')))||0;
    case 's_grounded':return P.onGround;
  }
  return null;
}
async function guard(ctx){if(++ctx.ops>300){ctx.ops=0;await sleep(0,ctx);}}
async function run(b,ctx){
  while(b){
    if(ctx.gen!==RT.gen||(ctx.hostGen!=null&&ctx.hostGen!==RT.hostGen))throw STOP;
    await stmt(b,ctx);
    b=b.next&&b.next.block;
  }
}
const D=(b,n)=>{const x=b.inputs&&b.inputs[n];return x&&x.block;};
/* ---------- player save data (auto-saved progress) ---------- */
const SAVE={key:null,backend:'local',d:{},loaded:false,gen:0,last:'',lastT:0,busy:false,hadSave:false};
function saveKeyFor(def){const p=def.project;if(!p)return null;const raw=def.fromEditor?'test-'+p.id+(def.testP2?'-p2':''):String(p.saveId||p.id);return raw.replace(/[^A-Za-z0-9_-]/g,'_').slice(0,100)||null;}
function saveSnapshot(){const S=game&&game.project?game.project.settings:{};const o={v:1,data:SAVE.d,t:Date.now()};
  if(S.saveStats!==false){o.stats={};for(const [k,v] of RT.stats)if(typeof v==='number'&&isFinite(v))o.stats[String(k).slice(0,40)]=v;}
  if(S.saveCheckpoint!==false&&W.checkpoint&&state.stage>0)o.cp={p:W.checkpoint.toArray().map(r3),s:state.stage};
  return o;}
function saveBody(o){const c=Object.assign({},o);delete c.t;return JSON.stringify(c);}
async function saveRead(key,backend){
  if(backend==='sb'){const {data,error}=await SB.client.from('saves').select('data').eq('owner',SB.uid).eq('game',key).maybeSingle();if(error)throw error;return data?data.data:null;}
  if(backend==='claude'){const sn=await MP.db.doc('data/users/'+MP.me.id+'/saves/'+key).get();if(!sn.exists)return null;try{return JSON.parse(sn.data().d||'null');}catch(e){return null;}}
  return store.get('save:'+key,null);}
async function saveWrite(key,backend,o){
  const j=JSON.stringify(o);if(j.length>60000)throw new Error('too big');
  if(backend==='sb'){const {error}=await SB.client.from('saves').upsert({owner:SB.uid,game:key,data:o,updated_at:new Date().toISOString()},{onConflict:'owner,game'});if(error)throw error;return;}
  if(backend==='claude'){await MP.db.doc('data/users/'+MP.me.id+'/saves/'+key).set({d:j,t:Date.now()});return;}
  if(!store.set('save:'+key,o))throw new Error('local storage full');}
function saveBegin(def){
  SAVE.gen++;SAVE.off=false;SAVE.key=saveKeyFor(def);SAVE.d={};SAVE.loaded=false;SAVE.last='';SAVE.lastT=performance.now();SAVE.hadSave=false;
  if(!SAVE.key||def.project.settings.saveEnabled===false){SAVE.key=null;SAVE.loaded=true;(RT.dataLoaded||[]).forEach(h=>spawnRun(h.body,h));return;}
  SAVE.backend=def.fromEditor?'local':(SB.client&&SB.uid)?'sb':(MP.db&&MP.me.id&&!MP.p2p)?'claude':'local';
  const g=SAVE.gen,key=SAVE.key;
  saveRead(key,SAVE.backend).catch(()=>null).then(o=>{if(g!==SAVE.gen||!running)return;saveApply(o);});}
function saveApply(o){
  const S=game.project.settings;let any=false;
  if(o&&typeof o==='object'){
    if(o.data&&typeof o.data==='object'&&!Array.isArray(o.data)){for(const [k,v] of Object.entries(o.data))if(['number','string','boolean'].includes(typeof v))SAVE.d[String(k).slice(0,40)]=v;any=Object.keys(SAVE.d).length>0;}
    if(S.saveStats!==false&&o.stats&&typeof o.stats==='object'){for(const [k,v] of Object.entries(o.stats))if(typeof v==='number'&&isFinite(v)){RT.stats.set(String(k).slice(0,40),v);any=true;}}
    if(S.saveCheckpoint!==false&&o.cp&&Array.isArray(o.cp.p)&&o.cp.p.length===3){const v=new V3(num(o.cp.p[0],0),num(o.cp.p[1],0),num(o.cp.p[2],0));
      W.checkpoint=v;state.stage=Math.max(state.stage,num(o.cp.s,0));if(!P.dead){P.pos.copy(v);P.vel.set(0,0,0);}any=true;}}
  SAVE.loaded=true;SAVE.hadSave=any;SAVE.last=saveBody(saveSnapshot());
  if(any&&!game.fromEditor)toast('Welcome back! Your progress was loaded.','#7fd4ff',2.6);
  (RT.dataLoaded||[]).forEach(h=>spawnRun(h.body,h));}
async function saveFlush(force,final){
  if(!SAVE.key||!SAVE.loaded||SAVE.off||(SAVE.busy&&!final)||!game||!game.project)return false;
  const o=saveSnapshot();const body=saveBody(o);if(!force&&body===SAVE.last)return true;
  SAVE.busy=true;const key=SAVE.key,backend=SAVE.backend;
  try{await saveWrite(key,backend,o);SAVE.last=body;SAVE.lastT=performance.now();return true;}
  catch(e){if(!saveFlush.warned){saveFlush.warned=true;logOut('Saving progress failed: '+(e&&e.message||e),'warn');}return false;}
  finally{SAVE.busy=false;}}
function saveTick(){if(SAVE.loaded&&!SAVE.off&&performance.now()-SAVE.lastT>8000){SAVE.lastT=performance.now();saveFlush(false);}}
addEventListener('pagehide',()=>{if(running)saveFlush(false,true);});
document.addEventListener('visibilitychange',()=>{if(document.hidden&&running)saveFlush(false,true);});
function saveVal(v){return typeof v==='number'?(isFinite(v)?v:0):typeof v==='boolean'?v:String(v??'').slice(0,1000);}
function changeStat(name,v,set){name=String(name||'Score');const cur=RT.stats.get(name)||0;RT.stats.set(name,set?v:cur+v);}
async function stmt(b,ctx){
  await guard(ctx);
  if(ctx.host&&HOSTPART.has(b.type)&&MP.gr){const v=partv(b,ctx);partsOf(v).forEach(p=>{if(!p.rig)RT.hostParts.add(p);});}
  switch(b.type){
    case 'c_wait':ctx.ops=0;await sleep(numv(inp(b,'S'),ctx),ctx);break;
    case 'c_forever':while(true){await run(D(b,'DO'),ctx);ctx.ops=0;await sleep(0,ctx);}
    case 'controls_repeat_ext':{const n=Math.min(1e6,Math.floor(numv(inp(b,'TIMES'),ctx)));for(let i=0;i<n;i++){await run(D(b,'DO'),ctx);await guard(ctx);}break;}
    case 'controls_whileUntil':{const until=fld(b,'MODE')==='UNTIL';while(until!==truthy(ev(inp(b,'BOOL'),ctx))){await run(D(b,'DO'),ctx);await guard(ctx);}break;}
    case 'controls_if':{const es=b.extraState||{};const n=(es.elseIfCount||0)+1;let done=false;
      for(let i=0;i<n;i++){if(truthy(ev(inp(b,'IF'+i),ctx))){await run(D(b,'DO'+i),ctx);done=true;break;}}
      if(!done&&es.hasElse)await run(D(b,'ELSE'),ctx);break;}
    case 'c_wait_until':while(!truthy(ev(inp(b,'COND'),ctx))){ctx.ops=0;await sleep(0,ctx);}break;
    case 'c_broadcast':rtFire('msg',String(fld(b,'MSG')));if(ctx.host)mpEmit('bot',{t:'bc',m:String(fld(b,'MSG')).slice(0,60),h:W.projHash});break;
    case 'c_stop':throw STOP;
    case 'variables_set':{const k=varName(b,ctx),v=ev(inp(b,'VALUE'),ctx);RT.vars.set(k,v);if(ctx.host)hostShareVar(k,v);break;}
    case 'var_share_set':case 'var_share_change':{const k=varName(b,ctx);let v;
      if(b.type==='var_share_set'){v=ev(inp(b,'VALUE'),ctx);v=typeof v==='number'||typeof v==='boolean'?v:String(v??'').slice(0,1000);RT.vars.set(k,v);mpEmit('gvar',{n:k.slice(0,60),v,h:W.projHash});}
      else{const d=numv(inp(b,'N'),ctx);RT.vars.set(k,(Number(RT.vars.get(k))||0)+d);mpEmit('gvar',{n:k.slice(0,60),d,h:W.projHash});}break;}
    case 'math_change':{const k=varName(b,ctx);RT.vars.set(k,(Number(RT.vars.get(k))||0)+numv(inp(b,'DELTA'),ctx));if(ctx.host)hostShareVar(k,RT.vars.get(k));break;}
    case 'p_move':{const ps=partsOf(partv(b,ctx));moveParts(ps,new V3(numv(inp(b,'X'),ctx),numv(inp(b,'Y'),ctx),numv(inp(b,'Z'),ctx)));break;}
    case 'p_setpos':{const v=partv(b,ctx);const c=centerOf(v);if(c)moveParts(partsOf(v),new V3(numv(inp(b,'X'),ctx),numv(inp(b,'Y'),ctx),numv(inp(b,'Z'),ctx)).sub(c));break;}
    case 'p_glide':case 'p_glideto':{const v=partv(b,ctx);const dur=Math.max(0,numv(inp(b,'S'),ctx));
      const vec=new V3(numv(inp(b,'X'),ctx),numv(inp(b,'Y'),ctx),numv(inp(b,'Z'),ctx));
      const c0=centerOf(v);if(!c0){await sleep(dur,ctx);break;}
      const to=b.type==='p_glide'?c0.clone().add(vec):vec,t0=t;let cur=c0.clone();
      while(true){const f=dur<=0?1:Math.min(1,(t-t0)/dur);const want=c0.clone().lerp(to,f);moveParts(partsOf(v),want.clone().sub(cur));cur=want;if(f>=1)break;ctx.ops=0;await sleep(0,ctx);}
      break;}
    case 'p_rotate':{const v=partv(b,ctx);const ps=partsOf(v);if(!ps.length)break;const rad=numv(inp(b,'DEG'),ctx)*D2R,ax=fld(b,'AXIS')||'y';
      if(!v.isGroup){rotatePart(ps[0],ax,rad);break;}
      const pivot=centerOf(v),q=new THREE.Quaternion().setFromAxisAngle(new V3(ax==='x'?1:0,ax==='y'?1:0,ax==='z'?1:0),rad);
      ps.forEach(p=>{setPartPos(p,pivot.clone().add(p.pos.clone().sub(pivot).applyQuaternion(q)));rotatePart(p,ax,rad);});break;}
    case 'p_color':partsOf(partv(b,ctx)).forEach(p=>{if(p.rig){if(isPup(p))return;p.torsoCol=fld(b,'COLOUR')||'#ffffff';p.mesh.userData.rig.torso.material=mat(p.torsoCol);return;}applyLook(p);p.look.color=fld(b,'COLOUR')||'#ffffff';applyLook(p);});break;
    case 'p_transp':{const tv=Math.max(0,Math.min(1,numv(inp(b,'V'),ctx)));partsOf(partv(b,ctx)).forEach(p=>{applyLook(p);p.look.transparency=tv;applyLook(p);});break;}
    case 'p_material':partsOf(partv(b,ctx)).forEach(p=>{applyLook(p);p.look.material=fld(b,'MAT')||'Plastic';applyLook(p);});break;
    case 'p_collide':partsOf(partv(b,ctx)).forEach(p=>{p.noCollide=fld(b,'B')!=='TRUE';});break;
    case 'p_visible':partsOf(partv(b,ctx)).forEach(p=>{if(!isPup(p))p.mesh.visible=fld(b,'B')==='TRUE';});break;
    case 'p_label':{const v=ev(inp(b,'TEXT'),ctx);partsOf(partv(b,ctx)).forEach(p=>setPartLabel(p,typeof v==='number'?String(r3(v)):v));break;}
    case 'p_anchor':partsOf(partv(b,ctx)).forEach(p=>{if(fld(b,'B')==='TRUE')removeFrom(W.phys,p);else if(!W.phys.includes(p)){p.vy=0;W.phys.push(p);}});break;
    case 'p_break':{const c=new V3(numv(inp(b,'X'),ctx),numv(inp(b,'Y'),ctx),numv(inp(b,'Z'),ctx));breakAt(c,numv(inp(b,'R'),ctx),numv(inp(b,'P'),ctx));break;}
    case 'p_deadly':{const on=fld(b,'B')==='TRUE';partsOf(partv(b,ctx)).forEach(p=>{
      if(on&&p.kind!=='kill'){p.kind='kill';if(!W.special.includes(p))W.special.push(p);applyLook(p);}
      else if(!on&&p.kind==='kill'){p.kind='solid';removeFrom(W.special,p);applyLook(p);}});break;}
    case 'p_clone':{const v=partv(b,ctx);const ps=partsOf(v);if(!ps.length)break;
      const off=new V3(numv(inp(b,'X'),ctx),numv(inp(b,'Y'),ctx),numv(inp(b,'Z'),ctx));const made=[];
      for(const p of ps){
        const o=Object.assign({},p.desc,{pos:p.pos.clone().add(off).toArray(),size:p.size.toArray(),
          look:p.look?Object.assign({},p.look):p.desc.look,kind:p.kind,collide:!p.noCollide,move:null,data:Object.assign({},p.data),yaw:p.obb?p.yaw:0,quat:(!p.obb&&p.rotated)?p.mesh.quaternion.clone():null});
        const c=p.rig?addRig(Object.assign({},p.node,{pos:p.pos.clone().add(off).toArray(),rot:[0,p.yaw/D2R,0]})):addPart(o);c.mesh.visible=p.mesh.visible;if(W.phys.includes(p)){c.vy=0;W.phys.push(c);}made.push(c);
        W.emitters.filter(e=>e.parent===p).forEach(e=>{const ne=new Emitter(e.cfg,c,scene);W.emitters.push(ne);});
        RT.touch.filter(h=>h.part===p).forEach(h=>RT.touch.push(Object.assign({},h,{part:c,was:false,running:false})));
        RT.click.filter(h=>h.part===p).forEach(h=>RT.click.push(Object.assign({},h,{part:c})));
        if(!v.isGroup)for(const g of W.models.values())if(g.parts.includes(p))g.parts.push(c);
      }
      if(v.isGroup){const g={isGroup:true,name:v.name,parts:made};if(!W.modelsByName.has(v.name))W.modelsByName.set(v.name,[]);W.modelsByName.get(v.name).push(g);
        RT.touch.filter(h=>h.parts&&h.group===v).forEach(h=>RT.touch.push(Object.assign({},h,{group:g,parts:g.parts,was:false,running:false})));
        RT.click.filter(h=>h.parts&&h.group===v).forEach(h=>RT.click.push(Object.assign({},h,{group:g,parts:g.parts})));}
      break;}
    case 'p_destroy':partsOf(partv(b,ctx)).forEach(p=>{if(!isPup(p))destroyPart(p);});break;
    case 'rs_copy':{const v=new V3(numv(inp(b,'X'),ctx),numv(inp(b,'Y'),ctx),numv(inp(b,'Z'),ctx));copyFromStorage(String(fld(b,'NAME')||''),(c,bb)=>v.clone().sub(c));break;}
    case 'rs_onto':{const tp=topOf(partv(b,ctx));if(!tp)break;copyFromStorage(String(fld(b,'NAME')||''),(c,bb)=>new V3(tp.x-c.x,tp.y-bb.min.y,tp.z-c.z));break;}
    case 'rig_walk':case 'rig_walkp':case 'rig_walkn':{const r=partsOf(partv(b,ctx)).find(p=>p.rig);if(!r){warnOnce('rigw:'+ctx.script,ctx.script+': the walk block needs a Rig.');break;}
      if(isPup(r)){await sleep(.3,ctx);break;}
      if(b.type==='rig_walkn'){if(r.walk)r.walk.done();await new Promise(res=>{r.walk={target:()=>{const n=nearestPlayer(r.pos);return n?{x:n.pos.x,z:n.pos.z}:null;},stop:2.6,until:t+30,done:res};});break;}
      const tx=numv(inp(b,'X'),ctx),tz=numv(inp(b,'Z'),ctx);
      if(r.walk)r.walk.done();
      await new Promise(res=>{r.walk={target:b.type==='rig_walk'?()=>({x:tx,z:tz}):()=>(P.dead?null:{x:P.pos.x,z:P.pos.z}),stop:b.type==='rig_walk'?.3:4,until:t+30,done:res};});break;}
    case 'rig_anim':partsOf(partv(b,ctx)).forEach(p=>{if(p.rig&&!isPup(p))p.anim=fld(b,'ANIM')||'idle';});break;
    case 'rig_say':{const v=ev(inp(b,'TEXT'),ctx);partsOf(partv(b,ctx)).forEach(p=>{if(p.rig&&!isPup(p)){const tx=typeof v==='number'?String(r3(v)):String(v??'');rigSay(p,tx,numv(inp(b,'S'),ctx)||3);p.sayText=(++SAYSEQ)+'|'+tx.slice(0,80);}});break;}
    case 'rig_face':partsOf(partv(b,ctx)).forEach(p=>{if(p.rig&&!P.dead){p.yaw=Math.atan2(P.pos.x-p.pos.x,P.pos.z-p.pos.z);p.mesh.rotation.y=p.yaw;}});break;
    case 'gui_settext':{const g=guiv(b,ctx);const v=ev(inp(b,'TEXT'),ctx);if(g&&g.el._tx)g.el._tx.textContent=(typeof v==='number'?String(r3(v)):String(v??'')).slice(0,400);break;}
    case 'gui_visible':{const g=guiv(b,ctx);if(g)g.el.hidden=fld(b,'B')!=='TRUE';break;}
    case 'gui_font':{const g=guiv(b,ctx);const f=fld(b,'FONT');if(g&&GUI_FONTS[f]){g.node=Object.assign({},g.node,{font:f});g.el.style.fontFamily=GUI_FONTS[f];g.el.style.fontWeight=String(GUI_FONT_W[f]);}break;}
    case 'gui_outline':{const g=guiv(b,ctx);if(g){const w=Math.max(0,Math.min(12,numv(inp(b,'W'),ctx)));const c=fld(b,'COLOUR')||'#000000';g.el.style.webkitTextStroke=w>0?`${w*2}px ${c}`:'';g.el.style.paintOrder=w>0?'stroke fill':'';}break;}
    case 'gui_textsize':{const g=guiv(b,ctx);if(g)g.el.style.fontSize=Math.max(6,Math.min(160,numv(inp(b,'N'),ctx)))+'px';break;}
    case 'gui_color':{const g=guiv(b,ctx);const c=fld(b,'COLOUR')||'#ffffff';if(g){if(fld(b,'WHAT')==='text')g.el.style.color=c;else g.el.style.background=hexA(c,g.node.bgT);}break;}
    case 'tool_swing':{const e=ctx.tool||P.equipped;if(e)swingTool(e);break;}
    case 'tool_shoot':{const e=ctx.tool||P.equipped;if(e&&P.equipped===e)shootFrom(e,fld(b,'COLOUR'),numv(inp(b,'S'),ctx));break;}
    case 'tool_give':{const nm=String(fld(b,'NAME')||'');const tn=findToolNode(nm);if(tn)giveTool(tn);else warnOnce('tg:'+nm,'No Tool named "'+nm+'" was found.');break;}
    case 'tool_take':removeToolByName(String(fld(b,'NAME')||''));break;
    case 'tool_unequip':unequipTool();break;
    case 'pl_damage':damagePlayer(numv(inp(b,'N'),ctx));break;
    case 'pl_damage_other':{const v=partv(b,ctx);const n=Math.max(0,Math.min(100,numv(inp(b,'N'),ctx)));if(v&&v.remote&&!v.dead){mpEmit('hit',{to:v.peer,n});v.flashT=.12;}break;}
    case 'pl_heal':healPlayer(numv(inp(b,'N'),ctx));break;
    case 'rig_damage':{const n=numv(inp(b,'N'),ctx);partsOf(partv(b,ctx)).filter(p=>p.rig).forEach(r=>{if(isPup(r)){if(!ctx.host)hitPuppet(r,'dmg',{n});}else{if(!ctx.host)r.lastHitBy=null;damageRig(r,n);}});break;}
    case 'rig_heal':{const n=numv(inp(b,'N'),ctx);partsOf(partv(b,ctx)).filter(p=>p.rig&&!isPup(p)).forEach(r=>healRig(r,n));break;}
    case 'rig_speed':{const n=Math.max(0,Math.min(200,numv(inp(b,'N'),ctx)));partsOf(partv(b,ctx)).filter(p=>p.rig&&!isPup(p)).forEach(r=>{r.speed=n;});break;}
    case 'pe_emit':{const ps=partsOf(partv(b,ctx));const n=numv(inp(b,'N'),ctx);W.emitters.forEach(e=>{if(ps.includes(e.parent))e.emit(n);});break;}
    case 'pe_toggle':{const ps=partsOf(partv(b,ctx));const on=fld(b,'B')==='TRUE';W.emitters.forEach(e=>{if(ps.includes(e.parent))e.on=on;});break;}
    case 'pl_kill':die('kill');break;
    case 'pl_teleport':{const tp=topOf(partv(b,ctx));if(tp&&!P.dead){P.pos.set(tp.x,tp.y+PH.y+.3,tp.z);P.vel.set(0,0,0);}break;}
    case 'pl_launch':P.vel.y=numv(inp(b,'P'),ctx);P.onGround=false;P.coyote=0;break;
    case 'pl_knock':{if(P.dead)break;const x=inp(b,'WHO');const xv=x?ev(x,ctx):null;const tg=xv&&xv.mesh&&xv.pos&&!xv.remote?[xv]:resolveTargets(xv);const src=tg[0]==='me'||!tg.length?null:tg[0];
      const pw=Math.max(-400,Math.min(400,numv(inp(b,'P'),ctx)));const d=src?new V3(P.pos.x-src.pos.x,0,P.pos.z-src.pos.z):new V3(-Math.sin(P.yaw),0,-Math.cos(P.yaw));
      if(d.lengthSq()<.01)d.set(Math.random()-.5,0,Math.random()-.5);d.normalize().multiplyScalar(pw*.7);d.y=Math.abs(pw)*.45;
      if(fld(b,'RAG')==='TRUE')ragdollPlayer(2,d);else{P.vel.copy(d);P.onGround=false;P.coyote=0;P.boost=Math.max(P.boost,.6);}break;}
    case 'pl_speed':PHYS.walk=Math.max(0,numv(inp(b,'V'),ctx));break;
    case 'data_set':{const k=String(ev(inp(b,'KEY'),ctx)??'').slice(0,40);if(!k)break;if(!(k in SAVE.d)&&Object.keys(SAVE.d).length>=200){warnOnce('dfull','Save data is full (200 values).');break;}SAVE.d[k]=saveVal(ev(inp(b,'V'),ctx));break;}
    case 'data_change':{const k=String(ev(inp(b,'KEY'),ctx)??'').slice(0,40);if(!k)break;const cur=Number(SAVE.d[k])||0;SAVE.d[k]=r3(cur+numv(inp(b,'N'),ctx));break;}
    case 'data_del':delete SAVE.d[String(ev(inp(b,'KEY'),ctx)??'')];break;
    case 'data_clear':SAVE.d={};RT.stats.clear();state.stage=0;W.checkpoint=null;await saveFlush(true);break;
    case 'data_now':{const ok=await saveFlush(true);if(fld(b,'SHOW')==='TRUE')toast(ok?'Progress saved':'Could not save progress',ok?'#7fd4ff':'#ff4d5e',1.6);break;}
    case 'pl_as':{const x=inp(b,'WHO');const tg=resolveTargets(x?ev(x,ctx):null);const body=D(b,'DO');if(!body||!tg.length)break;
      const others=tg.filter(r=>r!=='me'&&r.peer);
      if(others.length){if(MP.gr&&b.id&&ctx.sid)mpEmit('run',{to:others.map(r=>r.peer).slice(0,50),s:ctx.sid,b:b.id,h:W.projHash});
        else warnOnce('asoff:'+ctx.script,ctx.script+': "as player" only reaches other players in an online game. In a playtest it only runs for you.');}
      if(tg.includes('me'))await run(body,ctx);break;}
    case 'pl_ragdoll':ragdollPlayer(numv(inp(b,'S'),ctx));break;
    case 'pl_fling':{const pw=Math.max(0,Math.min(400,numv(inp(b,'P'),ctx)));const fw=new V3(Math.sin(P.yaw),0,Math.cos(P.yaw));ragdollPlayer(2.5,fw.multiplyScalar(-pw*.6).add(new V3(0,pw*.8,0)));break;}
    case 'pl_getup':if(P.rag)P.rag.until=0,P.rag.rest=1;break;
    case 'rig_ragdoll':partsOf(partv(b,ctx)).filter(p=>p.rig).forEach(r=>{if(isPup(r)){if(!ctx.host)hitPuppet(r,'fling',{v:[0,0,0],s:numv(inp(b,'S'),ctx)});}else ragdollRig(r,numv(inp(b,'S'),ctx));});break;
    case 'rig_fling':{const pw=Math.max(0,Math.min(400,numv(inp(b,'P'),ctx)));partsOf(partv(b,ctx)).filter(p=>p.rig).forEach(r=>{if(isPup(r)){if(!ctx.host){const d=new V3(r.pos.x-P.pos.x,0,r.pos.z-P.pos.z);if(d.lengthSq()<.01)d.set(0,0,1);d.normalize().multiplyScalar(pw*.6);d.y=pw*.8;hitPuppet(r,'fling',{v:d.toArray().map(r3),s:2.5});}return;}const d=new V3(r.pos.x-P.pos.x,0,r.pos.z-P.pos.z);if(d.lengthSq()<.01)d.set(0,0,1);d.normalize().multiplyScalar(pw*.6);d.y=pw*.8;ragdollRig(r,2.5,d);});break;}
    case 'data_enable':SAVE.off=fld(b,'B')!=='TRUE';break;
    case 'pl_sethp':{if(P.dead)break;const v=Math.max(0,Math.min(P.maxHealth,numv(inp(b,'N'),ctx)));if(v<P.health)damagePlayer(P.health-v);else P.health=v;break;}
    case 'pl_maxhp':{P.maxHealth=Math.max(1,Math.min(100000,numv(inp(b,'N'),ctx)));P.health=Math.min(P.health,P.maxHealth);if(fld(b,'FILL')==='TRUE'&&!P.dead)P.health=P.maxHealth;break;}
    case 'pl_tpxyz':if(!P.dead){P.pos.set(numv(inp(b,'X'),ctx),numv(inp(b,'Y'),ctx),numv(inp(b,'Z'),ctx));P.vel.set(0,0,0);}break;
    case 'pl_respawn':if(!state.over){if(P.dead)P.deadT=0;else{if(P.equipped)unequipTool();respawn();}}break;
    case 'pl_coins':{const n=Math.max(0,Math.min(GAMECOINS.left,Math.floor(numv(inp(b,'N'),ctx))));if(n>0&&!(game&&game.fromEditor)){GAMECOINS.left-=n;earnCoins(n,game&&game.name||'');}break;}
    case 'pl_chute':setChute(fld(b,'B')==='TRUE');break;
    case 'pl_freeze':P.frozen=fld(b,'B')==='TRUE';if(P.frozen){P.vel.x=0;P.vel.z=0;}break;
    case 'pl_visible':P.hidden=fld(b,'B')!=='TRUE';MP.lastSent='';break;
    case 'pl_shirt':setShirt(fld(b,'COLOUR'));break;
    case 'pl_say':playerSay(ev(inp(b,'TEXT'),ctx),numv(inp(b,'S'),ctx));break;
    case 'pl_shield':P.shieldUntil=t+Math.max(0,Math.min(600,numv(inp(b,'S'),ctx)));break;
    case 'pl_airjumps':P.airJumps=Math.max(0,Math.min(20,Math.round(numv(inp(b,'N'),ctx))));if(P.onGround)P.airLeft=P.airJumps;break;
    case 'pl_face':{const tp=partsOf(partv(b,ctx))[0];if(tp&&!P.dead){P.yaw=Math.atan2(tp.pos.x-P.pos.x,tp.pos.z-P.pos.z);if(P.model)P.model.rotation.y=P.yaw;}break;}
    case 'pl_camera':{const m=fld(b,'MODE');if(m==='first')cam.dist=.5;else if(m==='third')cam.dist=coarse?22:20;else cam.dist=Math.max(.5,Math.min(80,numv(inp(b,'N'),ctx)));break;}
    case 'anim_play_me':case 'anim_play_rig':{const nm=String(ev(inp(b,'NAME'),ctx)??'');const a=findAnim(nm);const mode=fld(b,'MODE')||'once';
      if(!a){warnOnce('anf:'+nm,'No animation named "'+nm+'" was found. Insert one with the Animation button, or use a built-in: '+EMOTE_KEYS.map(k=>BD()[k].name).join(', ')+'.');break;}
      if(b.type==='anim_play_me'){if(P.dead)break;const st=playAnim('me',a,mode==='wait'?'once':mode,false);if(mode==='wait'){ctx.ops=0;while(P.anim===st)await sleep(.05,ctx);}}
      else{const rs=partsOf(partv(b,ctx)).filter(p=>p.rig&&!p.dead);const sts=rs.map(r=>[r,playAnim(r,a,mode==='wait'?'once':mode,false)]);
        if(mode==='wait'&&sts.length){ctx.ops=0;while(sts.some(([r,st])=>r.animPlay===st))await sleep(.05,ctx);}}
      break;}
    case 'anim_stop_me':stopAnim('me');break;
    case 'anim_stop_rig':partsOf(partv(b,ctx)).filter(p=>p.rig).forEach(r=>stopAnim(r));break;
    case 'pl_jump':PHYS.jump=Math.max(0,numv(inp(b,'V'),ctx));break;
    case 'pl_gravity':PHYS.gravity=Math.max(1,numv(inp(b,'V'),ctx));break;
    case 'pl_checkpoint':{const tp=topOf(partv(b,ctx));if(tp)W.checkpoint=new V3(tp.x,tp.y+PH.y+.2,tp.z);break;}
    case 'g_callout':{const v=ev(inp(b,'TEXT'),ctx);try{juiceCall(String(v??'').slice(0,40));}catch(e){}break;}
    case 'g_music':{const st=fld(b,'STYLE');if(st==='off')musicStop();else try{musicStartStyle(st);}catch(e){}break;}
    case 'g_shake':{juiceShake(+fld(b,'POW')||.3);break;}
    case 'g_msg':{const v=ev(inp(b,'TEXT'),ctx);const tx=typeof v==='number'?String(r3(v)):String(v??''),sec=numv(inp(b,'S'),ctx)||2;toast(tx,'#fff',sec);if(ctx.host)mpEmit('bot',{t:'msg',x:tx.slice(0,200),s:sec,h:W.projHash});break;}
    case 'g_print':{const v=ev(inp(b,'TEXT'),ctx);logOut(typeof v==='number'?String(r3(v)):String(v??''),'info');break;}
    case 'g_stat_change':changeStat(fld(b,'STAT'),numv(inp(b,'N'),ctx),false);break;
    case 'g_stat_set':changeStat(fld(b,'STAT'),numv(inp(b,'N'),ctx),true);break;
    case 'g_win':finish();break;
    case 'g_sound':{const f=SFX[fld(b,'SND')];if(f)f();if(ctx.host)mpEmit('bot',{t:'snd',n:fld(b,'SND'),h:W.projHash});break;}
    case 'g_sky':{const c=new THREE.Color(fld(b,'COLOUR')||'#9fd8ff');scene.background=c;scene.fog.color.copy(c);setSkyColor(c);break;}
    case 'g_reset_timer':RT.t0=state.time;break;
    default:break;
  }
}
function indexScriptBlocks(s){const m=new Map();let n=0;
  const walk=b=>{if(!b||typeof b!=='object')return;if(!b.id)b.id='~'+n;n++;m.set(b.id,b);
    if(b.inputs)for(const k of Object.keys(b.inputs)){const i=b.inputs[k];if(i&&i.block)walk(i.block);if(i&&i.shadow)walk(i.shadow);}
    if(b.next&&b.next.block)walk(b.next.block);};
  ((s.blocks&&s.blocks.blocks&&s.blocks.blocks.blocks)||[]).forEach(walk);return m;}
function startScripts(proj){
  rtReset();
  proj.nodes.forEach(n=>{if(n.cls==='Script'&&n.blocks)indexScriptBlocks(n);});
  W.projHash=fnv(JSON.stringify(proj.nodes.filter(n=>n.cls==='Script').map(n=>[n.id,n.blocks])));
  startScriptsFor(proj,proj.nodes.filter(n=>n.cls==='Script'&&['workspace','sss','gui','player'].includes(serviceOf(proj,n.id))&&!hasToolAncestor(proj,n.id)),W.byId,W.models);
}
function startScriptsFor(proj,scripts,map,models,opts){
  const nodes=proj.nodes;
  for(const s of scripts){
    if(s.enabled===false||!s.blocks||!s.blocks.blocks)continue;
    const vmap=new Map((s.blocks.variables||[]).map(v=>[v.id,v.name]));
    const par=nodes.find(n=>n.id===s.parent);
    const part=par&&(par.cls==='Part'||par.cls==='Rig')?map.get(par.id)||null:null;
    let mn=par,model=null;while(mn){if(mn.cls==='Model'||mn.cls==='Rig'){model=models.get(mn.id)||null;break;}mn=nodes.find(n=>n.id===mn.parent);}
    let gn=par,gui=null;while(gn&&isGuiNode(gn)){if(gn.cls!=='ScreenGui'){gui=(W.gui&&W.gui.get(gn.id))||null;break;}gn=null;}
    const base={part,model,vmap,script:s.name||'Script',tool:(opts&&opts.tool)||null,gui,sid:s.id,host:!!s.hostOnly};
    RT.bmap.set(s.id,indexScriptBlocks(s));RT.bases.set(s.id,base);
    for(const top of s.blocks.blocks.blocks||[]){
      const body=top.next&&top.next.block;
      const h=Object.assign({body},base);
      switch(top.type){
        case 'ev_start':if(base.host)(RT.hostStarts||(RT.hostStarts=[])).push(h);spawnRun(body,base);break;
        case 'ev_touch':if(part)RT.touch.push(Object.assign(h,{was:false,running:false}));else logOut(base.script+': "when player touches this part" needs the script to be inside a part.','warn');break;
        case 'ev_touch_model':if(model)RT.touch.push(Object.assign(h,{group:model,parts:model.parts,was:false,running:false}));else logOut(base.script+': "when player touches this model" needs the script to be inside a Model.','warn');break;
        case 'ev_click_model':if(model)RT.click.push(Object.assign(h,{group:model,parts:model.parts}));else logOut(base.script+': "when this model is clicked" needs the script to be inside a Model.','warn');break;
        case 'ev_click':if(part)RT.click.push(h);else logOut(base.script+': "when this part is clicked" needs the script to be inside a part.','warn');break;
        case 'ev_key':RT.key.push(Object.assign(h,{key:fld(top,'KEY')}));break;
        case 'ev_mouse':RT.mouse.push(h);break;
        case 'ev_every':{const n=Math.max(.05,Number(fld(top,'S'))||1);const ctx=Object.assign({},base,{gen:RT.gen,ops:0});
          (async()=>{while(true){await sleep(n,ctx);if(base.host&&!HOST.am)continue;await run(body,ctx);}})().catch(e=>rtErr(e,ctx));break;}
        case 'ev_msg':{const m=String(fld(top,'MSG'));if(!RT.msg.has(m))RT.msg.set(m,[]);RT.msg.get(m).push(h);break;}
        case 'ev_died':RT.died.push(h);break;
        case 'ev_spawn':RT.spawn.push(h);spawnRun(body,base);break;
        case 'ev_jump':RT.jump.push(h);break;
        case 'ev_land':RT.land.push(h);break;
        case 'ev_hurt':RT.hurt.push(h);break;
        case 'ev_data_loaded':RT.dataLoaded.push(h);if(SAVE.loaded)spawnRun(body,base);break;
        case 'ev_touch_player':RT.ptouch.push(Object.assign(h,{was:new Set()}));break;
        case 'ev_tool_act':case 'ev_tool_equip':case 'ev_tool_unequip':case 'ev_tool_hit':
          if(base.tool)base.tool.handlers[{ev_tool_act:'act',ev_tool_equip:'equip',ev_tool_unequip:'unequip',ev_tool_hit:'hit'}[top.type]].push(h);
          else logOut(base.script+': tool events need the script to be inside a Tool.','warn');break;
        case 'ev_gui_click':if(gui&&gui.node.cls==='TextButton')gui.clicks.push(h);else logOut(base.script+': "when this button is clicked" needs the script to be inside a TextButton.','warn');break;
        case 'ev_rig_died':if(part&&part.rig)part.diedHandlers.push(h);else logOut(base.script+': "when this rig dies" needs the script to be inside a Rig.','warn');break;
      }
    }
  }
}
function scriptFrame(){
  if(RT.ptouch&&RT.ptouch.length){const now=new Set(otherPlayers().filter(r=>touchingMe(r)));
    for(const h of RT.ptouch){for(const r of now)if(!h.was.has(r))spawnRun(h.body,Object.assign({},h,{touched:r}));h.was=now;}}
  for(const h of RT.touch){
    let on;
    if(h.parts){on=!P.dead&&h.parts.some(p=>!p.destroyed&&p.active&&partOverlap(p,-.12));}
    else{if(h.part.destroyed)continue;on=!P.dead&&partOverlap(h.part,-.12);}
    if(on&&!h.was&&!h.running){h.running=true;spawnRun(h.body,h).then(()=>{h.running=false;});}
    h.was=on;
  }
}

/* ---------- output log ---------- */
const OUT=[];
function logOut(msg,type){
  const tm=new Date();const line={msg:String(msg),type:type||'info',tm:tm.toTimeString().slice(0,8)};
  OUT.push(line);if(OUT.length>400)OUT.shift();
  const el=$('#outLog');if(el){const d=document.createElement('div');d.className=line.type;d.innerHTML=`<span class="tm">${line.tm}</span>${esc(line.msg)}`;el.appendChild(d);
    while(el.children.length>400)el.firstChild.remove();el.scrollTop=el.scrollHeight;}
  if(game&&game.fromEditor&&running){const g=$('#gcon');const d=document.createElement('div');d.className=line.type==='err'?'err':'';d.textContent=line.msg;g.appendChild(d);
    while(g.children.length>5)g.firstChild.remove();setTimeout(()=>d.remove(),6000);}
}

/* ---------- game state + HUD ---------- */
let game=null,running=false,paused=false,state={};
const hud={name:$('#hudName'),timer:$('#hudTimer'),stat:$('#hudStat')};
let toastT=0;
function toast(s,color,dur){const el=$('#toast');el.textContent=botDisp(s);if(running&&game&&!game._help&&state&&state.time<10&&String(s).length>45){game._help=botDisp(s);const hb=$('#helpBtn');if(hb)hb.hidden=false;}{const t0=String(s||'');el.classList.toggle('warn',/^(⚠|💣|😱|👑 THE|🌋|🌪|🌊|🚫)/u.test(t0)||/^BOOM/.test(t0));el.classList.toggle('gold',/^(🏆|👑 BOUNTY CLAIMED|YOU BEAT|RESCUED|GOLDEN)/u.test(t0));}el.style.color=color||'#fff';el.classList.add('show');toastT=dur||1.8;}
function setStat(s){hud.stat.hidden=!s;if(hud.stat.textContent!==s)hud.stat.textContent=s;}

function handleTouch(p){
  const d=p.data;
  switch(p.kind){
    case 'kill': die('kill');break;
    case 'water': die('water');break;
    case 'check':
      if(d.stage>state.stage){state.stage=d.stage;W.checkpoint=new V3(p.pos.x,p.max.y+PH.y+.2,p.pos.z);
        p.mesh.material=mat(0x9dffb8,{neon:true});SFX.check();
        {let extra='',col='#9dffb8';if((game.mode==='race'||(game.mode==='project'&&W.stages>1&&!LOBBY.on&&!game.fromEditor))&&!state.skipped){state.splits=state.splits||{};state.splits[d.stage]=state.time;const prev=(store.get('splits:'+game.id,{})||{})[d.stage];
          if(prev!=null){const df=state.time-prev;extra=' · '+fmt(state.time)+' ('+(df<=0?'−':'+')+Math.abs(df).toFixed(1)+'s)';col=df<=0?'#7dffa8':'#ffb4b4';}else extra=' · '+fmt(state.time);}
         toast((game.stageWord||'Checkpoint')+' '+d.stage+' reached'+extra,col);}
        try{burstAt(new V3(p.pos.x,p.max.y+1,p.pos.z),'#9dffb8');juicePop(new V3(p.pos.x,p.max.y,p.pos.z),'✓ '+d.stage,'big',1);JU.stageDeaths=0;skipBtnShow(false);}catch(e){}}
      break;
    case 'jump': if(P.padCool<=0){P.vel.y=d.power||100;P.padCool=.35;P.onGround=false;P.coyote=0;SFX.pad();}break;
    case 'speed': if(P.boost<1.6)SFX.boost();P.boost=d.boost||2.6;break;
    case 'bcheck':{const cp=new V3(p.pos.x,p.max.y+PH.y+.2,p.pos.z);if(!W.checkpoint||W.checkpoint.distanceToSquared(cp)>1){W.checkpoint=cp;SFX.check();toast('🟩 Checkpoint saved!','#9dffb8',1.2);try{burstAt(new V3(p.pos.x,p.max.y+1,p.pos.z),'#9dffb8');}catch(e){}}break;}
    case 'magnet': if(!(d.cool>t)){d.cool=t+25;P.magnetUntil=t+8;SFX.boost();toast('🧲 COIN MAGNET for 8 seconds!','#f3b0ff',2);p.mesh.visible=false;setTimeout(()=>{if(!p.destroyed)p.mesh.visible=true;},25000);}break;
    case 'finish': finish();break;
  }
}

/* ---------- builder (Free Build) ---------- */
const B={tool:'build',size:2,color:'#e53935',ghost:null,clearArm:0,fin:0,undo:[]};
const BFIN=[{},{neon:true},{transparency:.45},{metal:.7},{kind:'jump',neon:true,data:{power:95},col:'#22d3ee'},{kind:'kill',neon:true,col:'#ff5a1f'},{kind:'speed',neon:true,data:{boost:2.6},col:'#ffd400'},{kind:'bcheck',neon:true,col:'#3ddc84'}];
const BCOLORS=['#e53935','#fb8c00','#fdd835','#7cb342','#00897b','#1e88e5','#5e35b1','#d81b60','#f5f5f5','#455a64','#6d4c41','#111418'];
const raycaster=new THREE.Raycaster(),ndc=new THREE.Vector2();
function pickAt(e,filter){const r=cv.getBoundingClientRect();ndc.set(((e.clientX-r.left)/r.width)*2-1,-((e.clientY-r.top)/r.height)*2+1);
  raycaster.setFromCamera(ndc,camera);raycaster.far=600;
  const ms=W.parts.filter(p=>p.mesh.visible&&!p.decor&&(!filter||filter(p))).map(p=>p.mesh);return raycaster.intersectObjects(ms,true).find(h=>h.object.isMesh&&h.object.userData.part)||null;}
function cellFor(hit){const s=B.size;const n=hit.face.normal.clone().transformDirection(hit.object.matrixWorld);
  const pt=hit.point.clone().addScaledVector(n,.01);return new V3(Math.floor(pt.x/s)*s+s/2,Math.floor(pt.y/s)*s+s/2,Math.floor(pt.z/s)*s+s/2);}
function canPlace(c,s){const h=s/2-.02;const mn=new V3(c.x-h,c.y-h,c.z-h),mx=new V3(c.x+h,c.y+h,c.z+h);
  for(const p of W.solids){if(p.noCollide)continue;if(mn.x<p.max.x&&mx.x>p.min.x&&mn.y<p.max.y&&mx.y>p.min.y&&mn.z<p.max.z&&mx.z>p.min.z)return false;}
  if(mn.x<P.pos.x+PH.x&&mx.x>P.pos.x-PH.x&&mn.y<P.pos.y+PH.y&&mx.y>P.pos.y-PH.y&&mn.z<P.pos.z+PH.z&&mx.z>P.pos.z-PH.z)return false;
  return c.y>0&&Math.abs(c.x)<128&&Math.abs(c.z)<128;}
function placeBrick(x,y,z,s,color,fin){fin=BFIN[fin]?+fin:0;const F=BFIN[fin],op=Object.assign({},F);delete op.col;if(F.data)op.data=Object.assign({},F.data);const p=block(x,y,z,s,s,s,F.col||color,op);p.data.built=true;p.data.rec=[x,y,z,s,color,fin];return p;}
const STAMPS={
  obby:()=>{const o=[];const col=['#5c9dff','#9b6bff','#ff6bb5','#4fd1c5','#ffb84d'];o.push([0,0,0,'#3ddc84',7]);
    for(let i=1;i<=5;i++)o.push([0,i>2?1:0,-i*2,col[i%5]]);for(let x=-1;x<=1;x++)o.push([x,1,-12,'#ff5a1f',5]);o.push([0,1,-14,'#9b6bff'],[0,1,-16,'#22d3ee',4]);
    for(let i=0;i<3;i++)o.push([0,6+i,-19-i*2,col[i]]);for(let x=-1;x<=1;x++)for(let z=-1;z<=1;z++)o.push([x,9,-26+z,'#ffd54f',1]);return o;},
  trampolines:()=>{const o=[];for(let x=-2;x<=2;x++)for(let z=-2;z<=2;z++)o.push([x,0,z,(x+z)%2?'#22d3ee':'#ff6bb5',(x+z)%2?4:1]);return o;},
  tree:()=>{const o=[];for(let y=0;y<3;y++)o.push([0,y,0,'#6d4c41']);for(let x=-1;x<=1;x++)for(let z=-1;z<=1;z++)for(let y=3;y<5;y++)if(!(y===4&&Math.abs(x)+Math.abs(z)===2))o.push([x,y,z,'#2e7d32']);o.push([0,5,0,'#43a047']);return o;},
  house:()=>{const o=[];for(let x=-2;x<=2;x++)for(let z=-2;z<=2;z++)for(let y=0;y<3;y++){const edge=Math.abs(x)===2||Math.abs(z)===2;if(!edge)continue;if(z===2&&x===0&&y<2)continue;if(y===1&&(x===0||z===0)&&!(z===2))o.push([x,y,z,'#bbdefb',2]);else o.push([x,y,z,'#ef9a9a']);}
    for(let x=-2;x<=2;x++)for(let z=-2;z<=2;z++)o.push([x,3,z,'#6d4c41']);for(let x=-1;x<=1;x++)for(let z=-1;z<=1;z++)o.push([x,4,z,'#5d4037']);o.push([0,5,0,'#4e342e']);return o;},
  tower:()=>{const o=[];for(let y=0;y<8;y++)for(let x=0;x<=1;x++)for(let z=0;z<=1;z++)o.push([x,y,z,y%2?'#b0bec5':'#90a4ae']);for(let x=-1;x<=2;x++)for(let z=-1;z<=2;z++)if(x<0||x>1||z<0||z>1)o.push([x,8,z,'#ffd54f',1]);return o;},
  car:()=>{const o=[];for(let z=-2;z<=1;z++)for(let x=0;x<=1;x++)o.push([x,1,z,'#e53935',3]);for(let x=0;x<=1;x++)o.push([x,2,-1,'#90caf9',2],[x,2,0,'#90caf9',2]);[[-1,0,-2],[2,0,-2],[-1,0,1],[2,0,1]].forEach(([x,y,z])=>o.push([x,y,z,'#212121']));return o;},
  snowman:()=>{const o=[];for(let x=-1;x<=1;x++)for(let z=-1;z<=1;z++)o.push([x,0,z,'#fafafa']);o.push([0,1,0,'#fafafa'],[0,2,0,'#fafafa'],[0,2,1,'#ff9800'],[0,3,0,'#212121']);return o;},
  bridge:()=>{const o=[];for(let z=0;z<10;z++){o.push([0,0,-z,'#8d6e63'],[1,0,-z,'#8d6e63']);if(z%3===0)o.push([-1,1,-z,'#5d4037'],[2,1,-z,'#5d4037']);}return o;},
  castle:()=>{const o=[];for(let x=-4;x<=4;x++){for(let y=0;y<3;y++)o.push([x,y,0,'#9e9e9e']);if(x%2===0)o.push([x,3,0,'#bdbdbd']);}return o;},
  pyramid:()=>{const o=[];const cols=['#e6c27a','#d7b56d','#cfa95a','#c49c4c','#b98e3f'];for(let y=0;y<5;y++)for(let x=-4+y;x<=4-y;x++)for(let z=-4+y;z<=4-y;z++)if(Math.abs(x)===4-y||Math.abs(z)===4-y||y===4)o.push([x,y,z,cols[y]]);return o;},
  heart:()=>{const o=[];const H=['0110110','1111111','1111111','0111110','0011100','0001000'];H.forEach((r,y)=>[...r].forEach((c,x)=>{if(c==='1')o.push([x-3,5-y,0,'#e91e63',1]);}));return o;},
  ship:()=>{const o=[];for(let z=-4;z<=4;z++)for(let x=-1;x<=1;x++)if(!(Math.abs(z)===4&&x!==0))o.push([x,0,z,'#6d4c41']);for(let z=-3;z<=3;z++)o.push([-2,1,z,'#8d6e63'],[2,1,z,'#8d6e63']);for(let y=1;y<7;y++)o.push([0,y,0,'#5d4037']);for(let y=3;y<6;y++)for(let x=-1;x<=1;x++)o.push([x,y,1,'#fafafa']);return o;},
  windmill:()=>{const o=[];for(let y=0;y<6;y++)for(let x=0;x<=1;x++)for(let z=0;z<=1;z++)o.push([x,y,z,'#bcaaa4']);o.push([0,6,0,'#8d6e63'],[1,6,0,'#8d6e63'],[0,6,1,'#8d6e63'],[1,6,1,'#8d6e63']);for(let k=1;k<=3;k++)o.push([0,5+k,-1,'#fafafa'],[0,5-k,-1,'#fafafa'],[k,5,-1,'#fafafa'],[-k,5,-1,'#fafafa']);return o;},
  arch:()=>{const o=[];const cols=['#e53935','#fb8c00','#fdd835','#43a047','#1e88e5','#8e24aa'];for(let a=0;a<=12;a++){const t=a/12*Math.PI;cols.forEach((c,i)=>{const r=7-i*.9;o.push([Math.round(Math.cos(t)*r),Math.round(Math.sin(t)*r),0,c,1]);});}return o;},
  stairs:()=>{const o=[];for(let i=0;i<8;i++)for(let x=0;x<=1;x++)for(let y=0;y<=i;y++)o.push([x,y,-i,y===i?'#b0bec5':'#78909c']);return o;},
  rocket:()=>{const o=[];for(let y=0;y<6;y++)o.push([0,y,0,y===5?'#e53935':'#eceff1',y===5?1:3]);o.push([0,6,0,'#e53935'],[-1,0,0,'#e53935'],[1,0,0,'#e53935'],[0,0,-1,'#e53935'],[0,0,1,'#e53935'],[0,-1,0,'#ff9100',1]);return o;}};
function placeStamp(c){if(MP.world){toast('Stamps work in your own builds','#ff9aa4');return;}const id=($('#bstamp')||{}).value||'tree';const list=(STAMPS[id]||STAMPS.tree)();buildSnap();let n=0;
  const base=new V3(Math.floor(c.x/2)*2+1,Math.floor(c.y/2)*2+1,Math.floor(c.z/2)*2+1);
  for(const [dx,dy,dz,col,fin] of list){const q=new V3(base.x+dx*2,base.y+dy*2,base.z+dz*2);if(q.y<1)continue;if(canPlace(q,2)){placeBrick(q.x,q.y,q.z,2,col,fin||0);n++;}}
  if(n){SFX.place();saveBuild();toast('Placed '+n+' blocks','#9fe3ff',1);}else{SFX.nope();B.undo.pop();}}
function buildSnap(){if(MP.world)return;B.undo.push(W.parts.filter(p=>p.data.built).map(p=>p.data.rec.slice()));if(B.undo.length>40)B.undo.shift();}
function buildUndo(){if(MP.world){toast('Undo works in your own builds','#ff9aa4');return;}const prev=B.undo.pop();if(!prev){SFX.nope();toast('Nothing to undo','#9fb0cc',1);return;}
  W.parts.filter(p=>p.data.built).forEach(removePart);prev.forEach(r=>placeBrick(r[0],r[1],r[2],r[3],r[4],r[5]));SFX.del();saveBuild();}
$('#bundo')&&$('#bundo').addEventListener('click',()=>{buildUndo();cv.focus({preventScroll:true});});
$('#bfinish')&&$('#bfinish').addEventListener('click',e=>{const b=e.target.closest('button');if(!b)return;B.fin=+b.dataset.fin;$('#bfinish').querySelectorAll('button').forEach(x=>x.setAttribute('aria-pressed',x===b));});
addEventListener('keydown',e=>{if((e.ctrlKey||e.metaKey)&&e.key==='z'&&running&&game&&game.mode==='build'){e.preventDefault();buildUndo();}});
function saveBuild(){if(MP.world){setStat(W.parts.filter(p=>p.data.built).length+' blocks');buildQuest();return;}store.set('build',W.parts.filter(p=>p.data.built).map(p=>p.data.rec));setStat(W.parts.filter(p=>p.data.built).length+' blocks');buildQuest();}
/* build challenges in Free Build: small goals that pay coins, one after another */
const BQ=[['Place 20 blocks',m=>m.n,20],['Build something 16 studs tall',m=>m.h,16],['Use 6 different colors',m=>m.c,6],['Use 3 finishes (neon, glass, metal…)',m=>m.f,3],
  ['Build 30 studs tall',m=>m.h,30],['Make it 40 studs wide',m=>m.w,40],['Place 100 blocks',m=>m.n,100],['Build a sky tower 50 studs tall',m=>m.h,50],['Place 250 blocks',m=>m.n,250]];
function buildQuest(){const el=$('#bq');if(!el)return;if(!game||game.mode!=='build'){el.hidden=true;return;}
  let i=store.get('bqi',0);const bs=W.parts.filter(p=>p.data.built&&!p.destroyed);
  const m={n:bs.length,h:0,c:new Set(bs.map(p=>p.data.rec&&p.data.rec[4])).size,f:new Set(bs.map(p=>p.data.rec&&p.data.rec[5]||0)).size,w:0};
  if(bs.length){let x0=1e9,x1=-1e9,z0=1e9,z1=-1e9;bs.forEach(p=>{m.h=Math.max(m.h,p.max.y);x0=Math.min(x0,p.min.x);x1=Math.max(x1,p.max.x);z0=Math.min(z0,p.min.z);z1=Math.max(z1,p.max.z);});m.w=Math.round(Math.max(x1-x0,z1-z0));m.h=Math.round(m.h);}
  while(i<BQ.length&&BQ[i][1](m)>=BQ[i][2]){i++;store.set('bqi',i);earnCoins(10,'build challenge');SFX.win();try{juiceCall('CHALLENGE DONE!');}catch(e){}}
  el.hidden=false;el.textContent=i>=BQ.length?'🏆 Every build challenge done! Keep building.':`🎯 Challenge ${i+1}/${BQ.length}: ${BQ[i][0]} (${Math.min(BQ[i][1](m),BQ[i][2])}/${BQ[i][2]}) · +10 🪙`;}
function removePart(p){scene.remove(p.mesh);removeFrom(W.parts,p);removeFrom(W.solids,p);removeFrom(W.special,p);}
function builderClick(e){
  const hit=pickAt(e);if(!hit)return;const part=hit.object.userData.part;
  if(MP.world&&B.tool!=='pick'){
    if(B.tool==='build'){const c=cellFor(hit);if(!canPlace(c,B.size)){SFX.nope();return;}if(W.parts.filter(p=>p.data.built).length>=4000){toast('The shared world is full','#ff9aa4');return;}
      const id=brickId(c.x,c.y,c.z,B.size);SFX.place();worldWrite(()=>MP.world.doc(id).set({x:c.x,y:c.y,z:c.z,s:B.size,c:B.color,by:MP.me.id||null}));}
    else if(B.tool==='delete'){if(part&&part.data.docId){SFX.del();const id=part.data.docId;worldWrite(()=>MP.world.doc(id).delete());}else SFX.nope();}
    else if(B.tool==='paint'){if(part&&part.data.docId){SFX.place();const id=part.data.docId,col=B.color;worldWrite(()=>MP.world.doc(id).update({c:col}));}else SFX.nope();}
    updateGhost(e);return;}
  if(B.tool==='pick'){const c=part&&part.mesh&&part.mesh.material&&part.mesh.material.color?'#'+part.mesh.material.color.getHexString():null;if(c){setBColor(c,!BCOLORS.includes(c));SFX.click();toast('Picked '+c,c,1.2);setBTool('build');}else SFX.nope();updateGhost(e);return;}
  if(B.tool==='stamp'){const sv=B.size;B.size=2;const c=cellFor(hit);B.size=sv;placeStamp(c);updateGhost(e);return;}
  if(B.tool==='build'){const c=cellFor(hit);if(!canPlace(c,B.size)){SFX.nope();return;}buildSnap();placeBrick(c.x,c.y,c.z,B.size,B.color,B.fin);SFX.place();saveBuild();}
  else if(B.tool==='delete'){if(part&&part.data.built){buildSnap();removePart(part);SFX.del();saveBuild();}else SFX.nope();}
  else if(B.tool==='paint'){if(part&&part.data.built){buildSnap();const r=part.data.rec;removePart(part);placeBrick(r[0],r[1],r[2],r[3],B.color,B.fin);SFX.place();saveBuild();}else SFX.nope();}
  updateGhost(e);
}
function updateGhost(e){
  if(!B.ghost||coarse)return;
  const hit=pickAt(e);if(!hit){B.ghost.visible=false;return;}
  const part=hit.object.userData.part;
  if(B.tool==='build'){const c=cellFor(hit);const ok=canPlace(c,B.size);B.ghost.visible=true;B.ghost.position.copy(c);B.ghost.scale.setScalar(B.size*1.01);
    B.ghost.material.color.set(ok?B.color:'#ff3b30');B.ghost.material.opacity=ok?.45:.3;}
  else if(part&&part.data.built){B.ghost.visible=true;B.ghost.position.copy(part.pos);B.ghost.scale.copy(part.size).multiplyScalar(1.04);
    B.ghost.material.color.set(B.tool==='delete'?'#ff3b30':B.color);B.ghost.material.opacity=.5;}
  else B.ghost.visible=false;
}
function setupBuildBar(){
  const bc=$('#bcolors');bc.innerHTML='';const custom=store.get('bcustom',[]).filter(c=>/^#[0-9a-f]{6}$/i.test(c)&&!BCOLORS.includes(c)).slice(0,6);
  [...BCOLORS,...custom].forEach(c=>{const b=document.createElement('button');b.type='button';b.className='sw';b.style.background=c;b.setAttribute('aria-label','Color '+c);b.dataset.c=c;
    b.setAttribute('aria-pressed',c===B.color);b.onclick=()=>setBColor(c);bc.appendChild(b);});
  $('#bpick').value=B.color;
}
function setBColor(c,remember){c=String(c).toLowerCase();if(!/^#[0-9a-f]{6}$/.test(c))return;B.color=c;
  if(remember&&!BCOLORS.includes(c)){store.set('bcustom',[c,...store.get('bcustom',[]).filter(x=>x!==c)].slice(0,6));setupBuildBar();}
  $('#bcolors').querySelectorAll('.sw').forEach(x=>x.setAttribute('aria-pressed',x.dataset.c===c));$('#bpick').value=c;}
$('#bpick').addEventListener('input',e=>setBColor(e.target.value));
$('#bpick').addEventListener('change',e=>{setBColor(e.target.value,true);if(B.tool==='pick'||B.tool==='delete')setBTool('build');});
/* save slots: kept in the player's Brickyard account when signed in, otherwise in this browser */
const BSLOTS=6;
function buildBackend(){return (SB.client&&SB.uid)?'sb':(MP.db&&MP.me.id&&!MP.p2p)?'claude':'local';}
function currentBricks(){return W.parts.filter(p=>p.data.built&&!p.destroyed).map(p=>p.data.rec?p.data.rec.slice():[p.pos.x,p.pos.y,p.pos.z,p.size.x,'#'+p.mesh.material.color.getHexString()]);}
async function openSaves(){
  const el=$('#bsaves');el.hidden=false;paused=true;keys.clear();
  const be=buildBackend();el.innerHTML=`<div class="card" role="dialog" aria-label="Saved builds"><h3>Saved builds</h3><p class="where">Loading…</p></div>`;
  let idx=null;try{idx=await saveRead('freebuild-index',be);}catch(e){idx=null;}
  if(!idx||!Array.isArray(idx.slots))idx={slots:[]};
  const where=be==='local'?'Saved in this browser. Sign in to keep your builds in your account.':'Saved to your Brickyard account, so they follow you to any device.';
  const rows=Array.from({length:BSLOTS},(_,i)=>{const sl=idx.slots[i]||null;const nm=sl&&sl.name?sl.name:'Build '+(i+1);
    return `<div class="bslot"><input data-slot="${i}" value="${esc(nm)}" maxlength="30" aria-label="Name of slot ${i+1}"><span class="meta">${sl?`${sl.n} blocks · ${ago(sl.t)}`:'Empty'}</span>
      <span class="acts"><button type="button" class="pri" data-save="${i}">Save</button><button type="button" data-load="${i}"${sl?'':' disabled'}>Load</button></span></div>`;}).join('');
  el.innerHTML=`<div class="card" role="dialog" aria-label="Saved builds"><h3>Saved builds</h3><p class="where">${where}${MP.world?' Loading adds the blocks to the shared world.':''}</p>${rows}<button type="button" class="close" data-close>Close</button></div>`;
  el.onclick=async e=>{
    if(e.target===el||e.target.closest('[data-close]')){closeSaves();return;}
    const sv=e.target.closest('[data-save]'),ld=e.target.closest('[data-load]');if(!sv&&!ld)return;
    const i=+(sv||ld).dataset.save||+(sv||ld).dataset.load||0,k=sv?+sv.dataset.save:+ld.dataset.load;
    const name=(el.querySelector(`input[data-slot="${k}"]`).value||'Build '+(k+1)).replace(/[\u0000-\u001f]/g,'').slice(0,30);
    if(sv){const bricks=currentBricks().slice(0,2000).map(r=>[r3(r[0]),r3(r[1]),r3(r[2]),r[3],r[4]]);
      try{await saveWrite('freebuild-'+k,be,{v:1,b:bricks});idx.slots[k]={name,n:bricks.length,t:Date.now()};for(let j=0;j<BSLOTS;j++)if(!idx.slots[j])idx.slots[j]=null;
        await saveWrite('freebuild-index',be,idx);SFX.win();toast('Saved "'+name+'"','#9dffb8');closeSaves();}
      catch(err){toast('Could not save: '+(err&&err.message||err),'#ff9aa4',3);}}
    else{let o=null;try{o=await saveRead('freebuild-'+k,be);}catch(err){}
      if(!o||!Array.isArray(o.b)){toast('That save could not be read','#ff9aa4');return;}
      closeSaves();loadBricks(o.b);toast('Loaded "'+name+'"','#9fe3ff');}};
}
function closeSaves(){$('#bsaves').hidden=true;$('#bsaves').innerHTML='';if(running)paused=false;cv.focus({preventScroll:true});}
function loadBricks(list){
  const ok=list.filter(r=>Array.isArray(r)&&r.length>=5&&[0,1,2,3].every(i=>isFinite(+r[i]))&&[1,2,4].includes(+r[3])&&/^#[0-9a-f]{6}$/i.test(r[4]));
  if(MP.world){let n=W.parts.filter(p=>p.data.built).length;(async()=>{for(const r of ok){if(n++>=4000){toast('The shared world is full','#ff9aa4');break;}
      const id=brickId(+r[0],+r[1],+r[2],+r[3]);try{await MP.world.doc(id).set({x:+r[0],y:+r[1],z:+r[2],s:+r[3],c:r[4],by:MP.me.id||null});}catch(e){break;}}})();return;}
  buildSnap();W.parts.filter(p=>p.data.built).forEach(removePart);ok.forEach(r=>placeBrick(+r[0],+r[1],+r[2],+r[3],r[4],+r[5]||0));saveBuild();
}
$('#bsaveBtn').addEventListener('click',()=>openSaves());
$('#btools').addEventListener('click',e=>{const b=e.target.closest('button');if(!b)return;setBTool(b.dataset.tool);});
$('#bstamp')&&$('#bstamp').addEventListener('change',()=>{setBTool('stamp');cv.focus({preventScroll:true});});
$('#bsizes').addEventListener('click',e=>{const b=e.target.closest('button');if(!b)return;B.size=+b.dataset.size;$('#bsizes').querySelectorAll('button').forEach(x=>x.setAttribute('aria-pressed',x===b));});
function setBTool(t){B.tool=t;$('#btools').querySelectorAll('button').forEach(x=>x.setAttribute('aria-pressed',x.dataset.tool===t));if(B.ghost)B.ghost.visible=false;}
$('#bclear').addEventListener('click',()=>{const b=$('#bclear');
  if(B.clearArm>0){if(MP.world){const mine=[...MP.worldDocs].filter(([,d])=>d.by&&d.by===MP.me.id).map(([id])=>id);(async()=>{for(const id of mine){try{await MP.world.doc(id).delete();}catch(e){break;}}})();toast('Cleared your blocks','#9fe3ff');}
    else{buildSnap();W.parts.filter(p=>p.data.built).forEach(removePart);saveBuild();toast('Cleared. Undo brings it back','#9fe3ff',1.5);}SFX.del();B.clearArm=0;b.textContent='Clear';}
  else{B.clearArm=3;b.textContent=MP.world?'Tap again to clear yours':'Tap again to clear';}});

/* ---------- built-in games ---------- */
const STAGE_COLS=[0x5c9dff,0x9b6bff,0xff6bb5,0x4fd1c5,0xffb84d,0x7ad36b,0xff7b5c,0xc9d36b];
function buildTower(rnd){
  pad(0,0,0,700,700,0xff5a1f,{kind:'kill',h:2,noShadow:true});
  const R=34,H=170;
  addPart({pos:[0,H/2,0],size:[30,H,30],shape:'cylY',color:0x4a3f63,collide:false});
  for(let i=0;i<18;i++){const a=i/18*Math.PI*2,r=90+rnd()*120;block(Math.cos(a)*r,rnd()*3,Math.sin(a)*r,6+rnd()*10,4+rnd()*8,6+rnd()*10,0x3a3340,{collide:false,decor:true});}
  let a=0,y=4,pw=14;
  pad(R,y,0,14,14,0xb7bfd0);W.spawn.set(R,y+PH.y+.2,0);
  const place=(w,gap)=>{a+=(pw/2+w/2+gap)/R;pw=w;y+=1.6;return [R*Math.cos(a),y,R*Math.sin(a)];};
  const types=['steps','move','lava','fade','spin','move','fade','lava','tiny','spin'];
  W.stages=types.length;
  types.forEach((type,s)=>{
    const col=STAGE_COLS[s%STAGE_COLS.length];
    for(let j=0;j<6;j++){
      if(type==='spin'&&j===2){const [x,yy,z]=place(16,4);pad(x,yy,z,16,16,col);addSpinner(x,yy+1.2,z,15,1.5+s*.08);continue;}
      const w=type==='lava'?7:type==='tiny'?2.4:4.5+rnd()*1.5;const [x,yy,z]=place(w,type==='tiny'?2.6+rnd():3.2+rnd()*1.3);
      if(type==='move'){const radial=j%2===0;addPart({pos:[x,yy-.5,z],size:[w,1,w],color:col,
        move:{axis:radial?new V3(Math.cos(a),0,Math.sin(a)):new V3(0,1,0),dist:radial?3:2.2,speed:1.3+rnd()*.6,phase:rnd()*6}});}
      else if(type==='fade')pad(x,yy,z,w,w,0xa8e6ff,{kind:'fade'});
      else if(type==='lava'){pad(x,yy,z,w,w,col);const tx=-Math.sin(a),tz=Math.cos(a);const alongX=Math.abs(tx)>Math.abs(tz);
        addPart({pos:[x,yy+.3,z],size:alongX?[1.2,.6,w]:[w,.6,1.2],color:0xff3b1f,kind:'kill'});}
      else pad(x,yy,z,w,w,col);
    }
    const last=s===types.length-1;const [x,yy,z]=place(last?16:10,4);
    if(last){pad(x,yy,z,16,16,0xffc93c,{kind:'finish',metal:.35});
      addPart({pos:[x,yy+1.5,z],size:[3,3,3],shape:'cylY',color:0xffd75e,metal:.7,collide:false});addPart({pos:[x,yy+4,z],size:[4.5,2,4.5],shape:'cylY',color:0xffd75e,metal:.7,collide:false});}
    else{pad(x,yy,z,10,10,0x3ddc84,{kind:'check',data:{stage:s+1}});
      addPart({pos:[0,yy-.4,0],size:[31.5,.8,31.5],shape:'cylY',color:col,collide:false,neon:true});}
  });
}
function buildSky(rnd){
  let z=0,y=110,cp=0;
  pad(0,y,0,18,18,0xdfe6f5);W.spawn.set(0,y+3,0);z=-9;
  const run=(len,w,color,o)=>{const p=pad(0,y,z-len/2,w||8,len,color||0xc7d2ea,o);z-=len;return p;};
  const gap=g=>{z-=g;};
  const speedPad=(zz)=>pad(0,y+.2,zz,6,5,0xffd400,{kind:'speed',h:.4,neon:true});
  const check=()=>{cp++;run(12,12,0x3ddc84,{kind:'check',data:{stage:cp}});};
  run(26);speedPad(z+5);gap(15);run(20);check();
  run(10);pad(0,y+.2,z+5,4,4,0x22d3ee,{kind:'jump',h:.4,neon:true,data:{power:96}});gap(4);y+=18;run(14);
  for(let i=0;i<5;i++){pad(i%2?3.5:-3.5,y,z-7,2.5,14,0x9fb1d8);z-=16;}
  run(6);check();
  for(let i=0;i<5;i++){addPart({pos:[0,y-.5,z-5],size:[6,1,6],color:0x7c8cff,move:{axis:new V3(1,0,0),dist:6,speed:1+rnd()*.7,phase:rnd()*6}});z-=10+rnd()*1.5;}
  run(8);
  for(let i=0;i<6;i++){y-=1.5;const x=(rnd()-.5)*6;pad(x,y,z-3,3,3,0xb18cff,{h:24});z-=7.5;}
  run(8);check();
  for(let i=0;i<8;i++){pad(0,y,z-2,4,4,0xa8e6ff,{kind:'fade'});z-=6.5;}
  run(6);
  const gz=z;run(52,12,0xc7d2ea);for(let i=0;i<3;i++)addSpinner(0,y+1.2,gz-10-i*16,11,1.7+i*.35);
  check();
  // bounce section: jump pads launch you up through three cloud ledges
  for(let i=0;i<3;i++){pad(0,y+.2,z-3,5,5,0x22d3ee,{kind:'jump',h:.4,neon:true,data:{power:92}});run(6,6,0xc7d2ea);z-=3;y+=14;run(10,8,0xdfe6f5);}
  check();
  // narrow beam with sliders crossing it
  run(46,2.4,0x9fb1d8);for(let i=0;i<3;i++)addPart({pos:[0,y+1,z+38-i*14],size:[1,1,8],color:0xff3b30,kind:'kill',neon:true,move:{axis:new V3(1,0,0),dist:5,speed:1.4+i*.3,phase:i*2}});
  check();
  run(28);speedPad(z+5);gap(16);
  pad(0,y,z-10,20,20,0xffc93c,{kind:'finish',metal:.35});
  W.stages=cp;W.killY=y-80;
  for(let i=0;i<40;i++){const cz=-rnd()*(Math.abs(z)+80)+40,cx=(rnd()-.5)*260,cy=60+rnd()*90;
    if(Math.abs(cx)<20)continue;block(cx,cy,cz,12+rnd()*30,4+rnd()*5,10+rnd()*24,0xffffff,{collide:false,decor:true,transparency:.15,noShadow:true});}
}
function buildCoins(rnd){
  pad(0,0,0,900,900,0x2f8fd8,{kind:'water',h:2,transparency:.12,noShadow:true});
  const isl=[{x:0,z:0,w:70,d:70,top:3},{x:105,z:15,w:40,d:40,top:6},{x:-10,z:110,w:46,d:36,top:4},{x:-105,z:-15,w:42,d:48,top:4},{x:25,z:-105,w:36,d:36,top:3},{x:190,z:-45,w:38,d:38,top:5}];
  isl.forEach(I=>{pad(I.x,I.top-1,I.z,I.w+6,I.d+6,0xe8d39a,{h:I.top+1});pad(I.x,I.top,I.z,I.w,I.d,0x58b947);});
  const hill=(x,z,top,w,c)=>pad(x,top,z,w,w,c||0x4a9f3c,{h:3});
  hill(-15,-12,6,16);hill(-15,-12,9,8,0x3f8a33);
  hill(108,20,9,18);hill(108,20,12,11,0x3f8a33);hill(108,20,15,5,0x37782c);
  hill(-5,112,7,14);
  const stones=(x1,z1,t1,x2,z2,t2,n,o)=>{for(let i=1;i<=n;i++){const f=i/(n+1);
    pad(x1+(x2-x1)*f,t1+(t2-t1)*f,z1+(z2-z1)*f,5,5,0x9a8f7a,Object.assign({h:t1+(t2-t1)*f+1},typeof o==='function'?o(i):o||{}));}};
  stones(38,12,3,82,15,6,5);
  stones(0,38,3,-10,89,4,6);
  stones(15,-38,3,25,-84,3,6,i=>i%2?{move:{axis:new V3(0,1,0),dist:1.4,speed:1.2,phase:i}}:{});
  addPart({pos:[-59.5,2.5,-10],size:[10,1,10],color:0x8d6e63,move:{axis:new V3(1,0,0),dist:16,speed:.55}});
  pad(36,36,-110,10,10,0x8c95a6,{h:36});
  pad(22,3.2,-100,4,4,0x22d3ee,{kind:'jump',h:.4,neon:true,data:{power:122}});
  const coinsAt=[];
  const put=(x,y,z)=>{coin(x,y,z);coinsAt.push([x,z]);};
  isl.forEach((I,k)=>{const n=k===0?7:5;for(let i=0;i<n;i++){const x=I.x+(rnd()-.5)*(I.w-8),z=I.z+(rnd()-.5)*(I.d-8);put(x,groundAt(x,z,30)+2.5,z);}});
  put(-15,11.5,-12);put(108,17.5,20);put(-5,9.5,112);
  [[60,13.5,4.5],[-5,64,3.6],[20,-61,3]].forEach(([x,z,tp])=>put(x,tp+2.5,z));
  put(-59.5,5.5,-10);
  put(33,38.5,-113);put(39,38.5,-107);put(36,38.5,-110);
  // volcano island far to the east: a moving raft and stepping stones lead there
  stones(125,10,6,171,-35,5,6,i=>i===3?{move:{axis:new V3(0,1,0),dist:1.2,speed:1,phase:1}}:{});
  hill(190,-45,8,24,0x6d4c41);hill(190,-45,11,16,0x5d4037);hill(190,-45,14,9,0x4e342e);pad(190,14.6,-45,5,5,0xff5a1f,{kind:'kill',h:.4,neon:true});
  put(181,11.5,-45);put(199,11.5,-45);put(190,14.5,-36);put(190,14.5,-54);put(190,8.5,-60);put(176,7.5,-30);
  isl.forEach(I=>{const n=Math.floor(I.w*I.d/400);for(let i=0;i<n;i++){const x=I.x+(rnd()-.5)*(I.w-6),z=I.z+(rnd()-.5)*(I.d-6);
    if(coinsAt.some(c=>Math.hypot(c[0]-x,c[1]-z)<6))continue;const g=groundAt(x,z,30);if(g>I.top+.5)continue;
    block(x,g+3.5,z,1.6,7,1.6,0x6d4c41,{decor:true});block(x,g+9.5,z,7,5,7,0x2e7d32,{decor:true});}});
  // a treasure raft drifts between the islands carrying coins
  addPart({pos:[60,1.6,-60],size:[10,1,10],color:0x8d6e63,move:{axis:new V3(1,0,1).normalize(),dist:30,speed:.35}});
  put(60,3.6,-60);
  // coin magnets: stand on one to pull in nearby coins for 8 seconds
  [[18,3,18],[100,6,5],[-100,4,-5]].forEach(([x,y,z])=>{const m=pad(x,y+.2,z,4,4,0xe040fb,{kind:'magnet',h:.4,neon:true});setPartLabel(m,'🧲 MAGNET');});
  W.spawn.set(0,3+PH.y+.2,0);W.killY=-30;
  state.total=W.coins.length;
}
function buildSandbox(){
  addPart({pos:[0,-.5,0],size:[256,1,256],material:gridMat});
  W.spawn.set(0,PH.y+.2,0);
  const gm0=new THREE.MeshBasicMaterial({color:0xffffff,transparent:true,opacity:.45,depthWrite:false});
  if(startWorld()){B.ghost=new THREE.Mesh(BOX,gm0);B.ghost.visible=false;scene.add(B.ghost);return;}
  let saved=store.get('build',null);
  if(!saved){saved=[];const cols=['#e53935','#fb8c00','#fdd835','#7cb342','#1e88e5'];
    for(let i=0;i<5;i++)for(let h=0;h<=i;h++)saved.push([12+i*2+1,h*2+1,-11,2,cols[i]]);
    for(let i=0;i<4;i++)saved.push([-15+i*4+2,2,-14,4,'#5e35b1']);}
  saved.forEach(r=>placeBrick(r[0],r[1],r[2],r[3],r[4],r[5]));B.undo=[];setTimeout(()=>{try{buildQuest();}catch(e){}},400);
  const gm=new THREE.MeshBasicMaterial({color:0xffffff,transparent:true,opacity:.45,depthWrite:false});
  B.ghost=new THREE.Mesh(BOX,gm);B.ghost.visible=false;scene.add(B.ghost);
}
function arenaDef(){
  UIDDET={p:'garena_',n:0};const p=newProjectObj('baseplate','Brick Battle');p.id='arena';Object.assign(p.settings,{timer:false,sky:'#8ec9ff',lobby:true,lobbyWait:15,lobbyRound:120,lobbyScore:'KOs'});
  const N=p.nodes;const bp=N.find(n=>n.name==='Baseplate');bp.size=[160,2,160];bp.color='#6f8a5a';bp.material='Grass';
  const sp=N.find(n=>n.behavior==='spawn');sp.color='#3b4a6b';
  const F=groupNode('Folder',{name:'Arena'});N.push(F);const P_=(o)=>N.push(partNode(Object.assign({parent:F.id},o)));
  [[0,-80,160,2],[0,80,160,2],[-80,0,2,160],[80,0,2,160]].forEach(([x,z,w,d])=>P_({name:'Wall',pos:[x,4,z],size:[w,8,d],color:'#9fa8b8',material:'Brick'}));
  [[-30,-30],[30,30],[-30,30],[30,-30]].forEach(([x,z],i)=>{P_({name:'Tower',pos:[x,4,z],size:[12,8,12],color:['#e57373','#64b5f6','#81c784','#ffd54f'][i],material:'Brick'});
    P_({name:'Ramp',shape:'wedge',pos:[x,4,z+(z<0?10:-10)],size:[6,8,8],rot:[0,z<0?180:0,0],color:'#bcaaa4',material:'Wood'});
    P_({name:'JumpPad',pos:[x+(x<0?9:-9),.2,z],size:[4,.4,4],color:'#22d3ee',material:'Neon',behavior:'jump',value:90});});
  [[0,-40],[0,40],[-45,0],[45,0],[-12,14],[14,-12]].forEach(([x,z])=>P_({name:'Cover',pos:[x,2,z],size:[8,4,2],rot:[0,(x*z)%90,0],color:'#8d6e63',material:'Wood'}));
  P_({name:'Center',pos:[0,1.5,0],size:[20,3,20],color:'#cfd8dc',material:'Studs'});sp.pos=[0,3.5,0];
  for(const pf of ['Sword','Blaster']){const nodes=PREFABS.find(x=>x.name===pf).make({x:0,y:0,z:0});nodes.forEach(n=>{if(n.cls==='Tool')n.parent='pack';});N.push(...nodes);}
  [[-20,-55],[20,55],[55,-20]].forEach(([x,z])=>{const nodes=PREFABS.find(x=>x.name==='Training dummy').make({x,y:0,z});nodes[0].parent='workspace';N.push(...nodes);});
  const pot=PREFABS.find(x=>x.name==='Healing potion').make({x:0,y:3,z:-60});pot[0].parent='workspace';N.push(...pot);
  N.find(n=>n.name==='Welcome').blocks=scriptOf(chain(blk('ev_start'),blk('g_stat_set',{N:bn(0)},{STAT:'KOs'}),blk('g_msg',{TEXT:bt('Most knockouts in 2 minutes wins! Sword (1), blaster (2). Grab the power orb and the tower snipers, and knock out the 👑 bounty bot for 3.'),S:bn(4)})));
  arenaExtras(p);
  UIDDET=null;const def=projectDef(p,false);return Object.assign(def,{id:'arena',room:'arena',name:'Brick Battle'});
}
/* ---------- twelve more built-in games, each built as a normal Brickyard project (so they can be copied into Studio) ---------- */
// every script declares the variables it touches, named like the rest of the game
function autoVars(p){const names=new Map();const scr=p.nodes.filter(n=>n.blocks&&typeof n.blocks==='object');
  scr.forEach(n=>(n.blocks.variables||[]).forEach(v=>{if(!names.has(v.id))names.set(v.id,v.name);}));
  names.set('vmatch',names.get('vmatch')||'in match');names.set('valive',names.get('valive')||'alive in match');
  scr.forEach(n=>{const dec=new Set((n.blocks.variables||[]).map(v=>v.id));const add=[];
    JSON.stringify(n.blocks,(k,v)=>{if(v&&v.type&&/^(variables_|math_change)/.test(v.type)&&v.fields&&v.fields.VAR){const id=v.fields.VAR.id||v.fields.VAR;if(typeof id==='string'&&!dec.has(id)){dec.add(id);add.push({name:names.get(id)||id.replace(/^v/,''),id});}}return v;});
    if(add.length)n.blocks.variables=(n.blocks.variables||[]).concat(add);});}
const GK=(()=>{
  const num=v=>({block:{type:'math_number',fields:{NUM:v}}});
  const stat=s=>({block:{type:'s_stat',fields:{STAT:s}}});
  const cmp=(a,op,b)=>({block:{type:'logic_compare',fields:{OP:op},inputs:{A:a,B:b}}});
  const rnd=(a,b)=>({block:{type:'math_random_int',inputs:{FROM:typeof a==='object'?Object.assign({shadow:{type:'math_number',fields:{NUM:1}}},a):bn(a),TO:typeof b==='object'?Object.assign({shadow:{type:'math_number',fields:{NUM:1}}},b):bn(b)}}});
  const add=(a,b)=>({block:{type:'math_arithmetic',fields:{OP:'ADD'},inputs:{A:a,B:b}}});
  const join=(...xs)=>({block:{type:'text_join',extraState:{itemCount:xs.length},inputs:Object.fromEntries(xs.map((x,i)=>['ADD'+i,typeof x==='string'?bt(x):x]))}});
  const iff=(cond,...body)=>blk('controls_if',{IF0:cond,DO0:doIn(...body)});
  const forever=(...b)=>blk('c_forever',{DO:doIn(...b)});
  const wait=s=>blk('c_wait',{S:typeof s==='number'?bn(s):s});
  const msg=(t,s)=>blk('g_msg',{TEXT:typeof t==='string'?bt(t):t,S:bn(s||3)});
  const sset=(s,v)=>blk('g_stat_set',{N:typeof v==='number'?bn(v):v},{STAT:s});
  const sadd=(s,v)=>blk('g_stat_change',{N:bn(v)},{STAT:s});
  const sound=s=>blk('g_sound',null,{SND:s});
  const until=c=>blk('c_wait_until',{COND:c});
  const pnamed=s=>({block:{type:'p_named',fields:{NAME:s}},shadow:{type:'p_this'}});
  const mnamed=s=>({block:{type:'p_model_named',fields:{NAME:s}},shadow:{type:'p_this'}});
  const ppos=a=>({block:{type:'s_player',fields:{AXIS:a}}});
  const vget=id=>({block:{type:'variables_get',fields:{VAR:{id}}}});
  const vset=(id,v)=>blk('variables_set',{VALUE:v},{VAR:{id}});
  const proj=(id,name,o)=>{UIDDET={p:'g'+id+'_',n:0};const p=newProjectObj('baseplate',name);p.id=id;Object.assign(p.settings,{timer:true},o||{});return p;};
  const def=(p,id,name)=>{UIDDET=null;autoVars(p);return Object.assign(projectDef(p,false),{id,room:id,name});};
  const welcome=(p,...blocks)=>{const n=p.nodes.find(n=>n.name==='Welcome');n.blocks=scriptOf(chain(blk('ev_start'),...blocks));return n;};
  const script=(p,parent,name,...blocks)=>{const s=scriptNode({parent,name,blocks:scriptOf(JSON.parse(JSON.stringify(chain(...blocks))))});p.nodes.push(s);return s;};
  const prefab=(p,name,o,parent)=>{const nodes=PREFABS.find(x=>x.name===name).make(o||{x:0,y:0,z:0});nodes[0].parent=parent||'workspace';p.nodes.push(...nodes);return nodes;};
  const folder=(p,name,parent)=>{const f=groupNode('Folder',{name,parent:parent||'workspace'});p.nodes.push(f);return f;};
  const model=(p,name,parent)=>{const m=groupNode('Model',{name,parent:parent||'workspace'});p.nodes.push(m);return m;};
  const part=(p,parent,o)=>{const n=partNode(Object.assign({parent},o));p.nodes.push(n);return n;};
  const noBase=p=>{p.nodes=p.nodes.filter(n=>n.name!=='Baseplate');};
  const spawnAt=(p,x,y,z,o)=>{Object.assign(p.nodes.find(n=>n.behavior==='spawn'),{pos:[x,y,z]},o||{});};
  const arith=(op,a,b)=>({block:{type:'math_arithmetic',fields:{OP:op},inputs:{A:a,B:b}}});
  const ifElse=(cond,a,b)=>blk('controls_if',{IF0:cond,DO0:doIn(...a),ELSE:doIn(...b)},null,{extraState:{hasElse:true}});
  const vchg=(id,n)=>blk('math_change',{DELTA:typeof n==='number'?bn(n):n},{VAR:{id}});
  const tp=(x,y,z)=>blk('pl_tpxyz',{X:bn(x),Y:bn(y),Z:bn(z)});
  const dget=(k,d)=>({block:{type:'data_get_or',inputs:{KEY:bt(k),DEF:bn(d)}}});
  const dset=(k,v)=>blk('data_set',{KEY:bt(k),V:v});
  const vars=(sc,list)=>{sc.blocks.variables=list.map(([name,id])=>({name,id}));return sc;};
  const OR=(a,b)=>({block:{type:'logic_operation',fields:{OP:'OR'},inputs:{A:a,B:b}}});
  const AND=(a,b)=>({block:{type:'logic_operation',fields:{OP:'AND'},inputs:{A:a,B:b}}});
  /* keeps a "Best ..." stat that is saved between visits (higher is better) */
  const best=(p,st,key)=>script(p,'sss','Best '+st,blk('ev_data_loaded'),sset('Best '+st,dget(key,0)),
    forever(iff(cmp(stat(st),'GT',stat('Best '+st)),sset('Best '+st,stat(st)),dset(key,stat(st))),wait(.5)));
  /* "in match" is 1 during a lobby match; "alive in match" drops to 0 when you die in it */
  const MV=[['in match','vmatch'],['alive in match','valive']];
  const matchFlags=p=>{vars(script(p,'sss','Match flags',blk('ev_msg',null,{MSG:'round start'}),vset('vmatch',num(1)),vset('valive',num(1))),MV);
    vars(script(p,'sss','Match over flag',blk('ev_msg',null,{MSG:'round end'}),vset('vmatch',num(0))),MV);
    vars(script(p,'sss','Knocked out flag',blk('ev_died'),vset('valive',num(0))),MV);return MV;};
  const inMatch=()=>cmp(vget('vmatch'),'EQ',num(1)),aliveIn=()=>AND(cmp(vget('vmatch'),'EQ',num(1)),cmp(vget('valive'),'EQ',num(1)));
  const onMsg=m=>blk('ev_msg',null,{MSG:m});
  const NOT=c=>({block:{type:'logic_negate',inputs:{BOOL:c}}});
  const whileDo=(c,...b)=>blk('controls_whileUntil',{BOOL:c,DO:doIn(...b)},{MODE:'WHILE'});
  const hud=(p,name,col,textExpr,every)=>{const sg=guiNode('ScreenGui',{name:name+'HUD'});const lb=guiNode('TextLabel',{parent:sg.id,name,text:'',gpos:[.5,0,0,p.settings.lobby?104:58],anchor:[.5,0],gsize:[0,380,0,38],bg:col,bgT:.15,tc:'#ffffff',font:'Cartoon',ts:18,radius:20,strokeT:1.2,strokeTc:'#0b1020'});p.nodes.push(sg,lb);
    script(p,lb.id,'Update',blk('ev_start'),forever(blk('gui_settext',{GUI:{shadow:{type:'gui_this'}},TEXT:textExpr}),wait(every||.25)));return lb;};
  const round=v=>({block:{type:'math_round',fields:{OP:'ROUND'},inputs:{NUM:v}}});
  const hscript=(p,parent,name,...blocks)=>{const s=script(p,parent,name,...blocks);s.hostOnly=true;return s;};
  const shSet=(id,v)=>blk('var_share_set',{VALUE:v},{VAR:{id}});
  const shChg=(id,n)=>blk('var_share_change',{N:typeof n==='number'?bn(n):n},{VAR:{id}});
  const walkN=part=>blk('rig_walkn',{PART:part});
  const nearAx=(part,a)=>({block:{type:'s_near_axis',fields:{AXIS:a},inputs:{PART:part}}});
  const nearD=part=>({block:{type:'s_near_dist',inputs:{PART:part}}});
  const pref=w=>({block:{type:'pl_ref',fields:{WHO:w}}});
  const plCount=w=>({block:{type:'s_pl_countof',inputs:{WHO:pref(w)}}});
  const myId=()=>({block:{type:'s_pl_id'}});
  const idOf=who=>({block:{type:'s_pl_idof',inputs:{WHO:who}}});
  const byId=v=>({block:{type:'pl_ref_named',inputs:{NAME:v}}});
  const nameOfP=who=>({block:{type:'s_pl_nameof',inputs:{WHO:who}}});
  const axOf=(who,a)=>({block:{type:'s_pl_axisof',fields:{AXIS:a},inputs:{WHO:who}}});
  const asP=(who,...body)=>blk('pl_as',{WHO:who,DO:doIn(...body)});
  const players=()=>({block:{type:'s_players'}});
  const txt=v=>({block:{type:'text',fields:{TEXT:v}}});
  const bc=m=>blk('c_broadcast',null,{MSG:m});
  const prop=(part,a)=>({block:{type:'s_prop',fields:{PROP:a},inputs:{PART:part}}});
  const isHost=()=>({block:{type:'s_is_host'}});
  return {hscript,shSet,shChg,walkN,nearAx,nearD,pref,plCount,myId,idOf,byId,nameOfP,axOf,asP,players,txt,bc,prop,isHost,round,hud,MV,matchFlags,inMatch,aliveIn,onMsg,NOT,whileDo,arith,ifElse,vchg,tp,dget,dset,vars,OR,AND,best,num,stat,cmp,rnd,add,join,iff,forever,wait,msg,sset,sadd,sound,until,pnamed,mnamed,ppos,vget,vset,proj,def,welcome,script,prefab,folder,model,part,noBase,spawnAt};
})();
const OBBY_COLS=['#5c9dff','#9b6bff','#ff6bb5','#4fd1c5','#ffb84d','#7ad36b','#ff7b5c','#c9d36b','#5cc8ff','#e57373'];

/* 1. Lava Rising */
function lavaRiseDef(){const G=GK;const p=G.proj('lavarise','Lava Rising',{sky:'#3a1d2e',fog:500,saveStats:false,saveCheckpoint:false});
  const bp=p.nodes.find(n=>n.name==='Baseplate');Object.assign(bp,{size:[140,2,140],color:'#3b2a2a',material:'Slate'});
  const T=G.folder(p,'Tower');
  G.part(p,T.id,{name:'Pillar',shape:'cyl',pos:[0,60,0],size:[10,120,10],color:'#4a3f63',material:'Brick'});
  for(let i=0;i<34;i++){const a=i*.52,r=12+(i%3),y=3+i*3.6;const tiny=i%5===4;
    const n=G.part(p,T.id,{name:'Step',pos:[r3(Math.cos(a)*r),r3(y),r3(Math.sin(a)*r)],size:tiny?[3,1,3]:[6,1,6],color:OBBY_COLS[i%OBBY_COLS.length],material:i%7===3?'Neon':'Plastic'});
    if(i%9===6)G.script(p,n.id,'Vanish',...SCR.vanish().blocks.blocks);
    if(i===16)Object.assign(n,{behavior:'jump',value:80,color:'#22d3ee',material:'Neon',name:'JumpPad'});}
  const goal=G.part(p,T.id,{name:'Goal',pos:[0,3+34*3.6,0],size:[14,1,14],color:'#ffc93c',material:'Neon',label:'TOP'});
  // tower B: the Scaffold, 140 studs east. Even rounds are climbed here
  {const OX=140,T2=G.folder(p,'Scaffold').id;const Q=o=>G.part(p,T2,o);
    Q({name:'Ground',pos:[OX,-1,0],size:[80,2,80],color:'#3b2a2a',material:'Slate'});
    [[-16,-16],[16,-16],[16,16],[-16,16]].forEach(([x,z2])=>Q({name:'Beam',pos:[OX+x,64,z2],size:[2,128,2],color:'#78909c',material:'Metal'}));
    const corners=[[-12,12],[12,12],[12,-12],[-12,-12]];
    for(let i=0;i<34;i++){const ang=-i*8.6/13,y=3+i*3.6;
      const x=r3(Math.cos(ang)*13),z2=r3(Math.sin(ang)*13);const tiny=i%6===5;
      const st=Q({name:'Plank',pos:[OX+x,y,z2],size:tiny?[3,1,3]:[6,1,6],color:OBBY_COLS[(i+3)%OBBY_COLS.length],material:'Wood'});
      if(i%7===3)G.script(p,st.id,'Sway',...SCR.glide(i%2?3:-3,0,0,1.6).blocks.blocks);}
    const g2=Q({name:'GoalB',pos:[OX,3+34*3.6,0],size:[14,1,14],color:'#ffc93c',material:'Neon',label:'TOP'});
    G.vars(G.script(p,g2.id,'NextRound',blk('ev_touch'),G.bc('lava top')),[]);
    Q({name:'StartPad',pos:[OX+4,.2,26],size:[6,.4,6],color:'#4e342e',material:'Wood'});}
  // tower C: the Crystal Spire, 280 studs east. A square spiral of crystal ledges with bouncy pads and drifting shards
  {const OX=280,T3=G.folder(p,'Crystal Spire').id;const Q=o=>G.part(p,T3,o);
    Q({name:'Ground',pos:[OX,-1,0],size:[80,2,80],color:'#2a2440',material:'Slate'});
    Q({name:'Spire',pos:[OX,64,0],size:[8,128,8],color:'#7e57c2',material:'Glass',transparency:.25});
    const path=[[1,0],[0,1],[-1,0],[0,-1]];const sq=u=>{u=((u%104)+104)%104;const side=Math.floor(u/26),f=u-side*26-13;return side===0?[f,13,0]:side===1?[13,-f,1]:side===2?[-f,-13,2]:[-13,f,3];};let x=0,z=13,d=0,y=3;
    for(let i=0;i<34;i++){[x,z,d]=sq(i*5.2);y+=3.6;
      const tiny=i%7===6,bounce=i%9===4;
      const st=Q({name:bounce?'BounceCrystal':'Ledge',pos:[OX+x,r3(y),z],size:tiny?[3,1,3]:[6,1,6],color:bounce?'#00e5ff':['#b388ff','#80deea','#f48fb1','#a5d6a7'][i%4],material:bounce?'Neon':'Glass',transparency:bounce?0:.15,
        behavior:bounce?'jump':'none',value:bounce?78:0});
      if(i%8===3)G.script(p,st.id,'Drift',...SCR.glide(path[(d+1)%4][0]*3,0,path[(d+1)%4][1]*3,1.5).blocks.blocks);
      if(i%11===8)G.script(p,st.id,'Vanish',...SCR.vanish().blocks.blocks);
      if(i%4===1)Q({name:'Shard',shape:'ball',pos:[OX+x*1.6,r3(y+3),z*1.6],size:[1.2,2.4,1.2],color:'#e1bee7',material:'Neon',canCollide:false});}
    const g3=Q({name:'GoalC',pos:[OX,r3(y+3.6),0],size:[14,1,14],color:'#ffc93c',material:'Neon',label:'TOP'});
    Q({name:'Bridge',pos:[OX+x/2,r3(y+3.6),z/2],size:[Math.abs(x)+4,1,Math.abs(z)+4],color:'#ffe082',material:'Wood'});
    G.vars(G.script(p,g3.id,'NextRound',blk('ev_touch'),G.bc('lava top')),[]);
    Q({name:'StartPad',pos:[OX+4,.2,30],size:[6,.4,6],color:'#4e342e',material:'Wood'});}
  const lava=G.part(p,'workspace',{name:'Lava',pos:[140,-3,0],size:[640,2,160],color:'#ff5a1f',material:'Neon',behavior:'kill',transparency:.08});
  const GR='vgrace',VL=[['grace',GR]];
  const speed=G.arith('DIVIDE',G.num(.85),G.arith('ADD',G.num(1),G.arith('MULTIPLY',G.stat('Round'),G.num(.35))));
  G.vars(G.script(p,lava.id,'Rise',blk('ev_start'),G.vset(GR,G.num(10)),G.forever(G.ifElse(G.cmp(G.vget(GR),'GT',G.num(0)),[G.vchg(GR,-1),G.wait(1)],
    [blk('p_glide',{PART:bme(),X:bn(0),Y:bn(1),Z:bn(0),S:speed})]))),VL);
  // ice crystals on the way up freeze the lava for a few seconds
  const ICE=G.model(p,'IceCrystals').id;
  [8,19,29].forEach(i=>{const a=i*.52,r=12+(i%3),y=3+i*3.6;const c=G.part(p,ICE,{name:'IceCrystal',shape:'ball',pos:[r3(Math.cos(a)*r),r3(y+2),r3(Math.sin(a)*r)],size:[1.6,2.2,1.6],color:'#80deea',material:'Neon',canCollide:false,label:'❄'});
    G.vars(G.script(p,c.id,'Freeze',blk('ev_touch'),G.iff(G.cmp({block:{type:'s_prop',fields:{PROP:'t'},inputs:{PART:bme()}}},'LT',G.num(.5)),blk('p_visible',{PART:bme()},{B:'FALSE'}),blk('p_transp',{PART:bme()},{V:bn(1)}),G.vchg(GR,6),G.sound('check'),
      G.msg('❄ Lava frozen for 6 seconds!',2),blk('p_color',{PART:G.pnamed('Lava')},{COLOUR:'#4dd0e1'}),G.wait(6),blk('p_color',{PART:G.pnamed('Lava')},{COLOUR:'#ff5a1f'}))),VL);});
  const reset=()=>[blk('p_setpos',{PART:G.pnamed('Lava'),X:bn(140),Y:bn(-3),Z:bn(0)}),G.vset(GR,G.num(5)),blk('p_visible',{PART:G.mnamed('IceCrystals')},{B:'TRUE'}),blk('p_transp',{PART:G.mnamed('IceCrystals')},{V:bn(0)})];
  G.vars(G.script(p,goal.id,'NextRound',blk('ev_touch'),G.bc('lava top')),VL);
  G.vars(G.script(p,'sss','Round up',G.onMsg('lava top'),G.sadd('Round',1),G.sound('win'),blk('g_callout',{TEXT:G.join('ROUND ',G.stat('Round'))}),blk('pl_coins',{N:bn(3)}),G.iff(G.cmp(G.stat('Round'),'EQ',G.num(3)),G.msg('Round 3: fire geysers start erupting from the pillar!',3),G.wait(3)),G.msg(G.join('Round ',G.stat('Round'),'! The lava gets faster...'),3),G.vchg('vtower',1),G.iff(G.cmp(G.vget('vtower'),'GT',G.num(2)),G.vset('vtower',G.num(0))),G.ifElse(G.cmp(G.vget('vtower'),'EQ',G.num(1)),[G.tp(144,4,26),G.msg('Now climb the SCAFFOLD!',2)],[G.ifElse(G.cmp(G.vget('vtower'),'EQ',G.num(2)),[G.tp(284,4,30),G.msg('Now climb the CRYSTAL SPIRE! Bouncy crystals ahead.',2.5)],[G.tp(4,4,26),G.msg('Back to the TOWER!',2)])]),...reset()),[...VL,['tower','vtower']]);
  G.vars(G.script(p,'sss','LavaGotYou',blk('ev_died'),G.msg(G.join('The lava got you on round ',G.stat('Round'),'. Back to round 1!'),3),G.sset('Round',1),G.vset('vtower',G.num(0)),...reset()),[...VL,['tower','vtower']]);
  G.welcome(p,G.sset('Round',1),G.sset('Height',0),G.msg('Reach the gold top, then climb again. The lava gets faster every round!',4),G.forever(G.sset('Height',G.ppos('y')),G.wait(.25)));
  G.best(p,'Round','lava_round');
  // from round 3, fireballs burst out of the pillar
  for(let k=0;k<3;k++){const fb=G.part(p,'workspace',{name:'Geyser'+k,shape:'ball',pos:[0,-50,0],size:[2.4,2.4,2.4],color:'#ff6d00',material:'Neon',canCollide:false,behavior:'kill',unbreakable:true});
    G.script(p,fb.id,'Erupt',blk('ev_start'),G.wait(4+k*2),G.forever(G.wait(G.rnd(3,6)),G.iff(G.cmp(G.stat('Round'),'GTE',G.num(3)),
      G.vset('vgy'+k,G.arith('ADD',G.ppos('y'),G.rnd(2,8))),G.vset('vgb'+k,G.arith('MULTIPLY',G.vget('vtower'),G.num(140))),blk('p_setpos',{PART:bme(),X:G.vget('vgb'+k),Y:G.vget('vgy'+k),Z:bn(0)}),
      blk('p_glideto',{PART:bme(),X:G.arith('ADD',G.vget('vgb'+k),G.arith('MULTIPLY',G.arith('MINUS',G.ppos('x'),G.vget('vgb'+k)),G.num(2.4))),Y:G.vget('vgy'+k),Z:G.arith('MULTIPLY',G.ppos('z'),G.num(2.4)),S:bn(1.4)}),blk('p_setpos',{PART:bme(),X:bn(0),Y:bn(-50),Z:bn(0)}))));}
  G.hud(p,'LavaGap','#bf360c',G.join('🔥 Lava is ',G.round(G.arith('MINUS',G.ppos('y'),G.arith('ADD',{block:{type:'s_prop',fields:{PROP:'y'},inputs:{PART:G.pnamed('Lava')}}},G.num(1)))),' studs below you'));
  G.spawnAt(p,4,.5,26);return G.def(p,'lavarise','Lava Rising');}

/* 2. Zombie Survival (co-op: the host runs the zombies, everyone fights the same horde) */
function zombiesDef(){const G=GK;const p=G.proj('zombies','Zombie Survival',{sky:'#55606e',fog:420,brightness:.8,timer:false,saveStats:false,saveCheckpoint:false});
  const bp=p.nodes.find(n=>n.name==='Baseplate');Object.assign(bp,{size:[180,2,180],color:'#4f6b3a',material:'Grass'});
  const F=G.folder(p,'Town');
  [[-30,-20,14,10],[28,24,12,12],[-26,34,10,14],[36,-34,16,10]].forEach(([x,z,w,d],i)=>{G.part(p,F.id,{name:'House',pos:[x,4,z],size:[w,8,d],color:['#a1887f','#90a4ae','#bcaaa4','#8d6e63'][i],material:'Brick'});
    G.part(p,F.id,{name:'Roof',shape:'wedge',pos:[x,9.5,z],size:[w,3,d],color:'#5d4037',material:'Wood'});});
  [[-90,0,2,180],[90,0,2,180],[0,-90,180,2],[0,90,180,2]].forEach(([x,z,w,d])=>G.part(p,F.id,{name:'Fence',pos:[x,3,z],size:[w,6,d],color:'#6d4c41',material:'Wood'}));
  for(let i=0;i<10;i++){const a=i*.63,r=55+(i%3)*8;G.part(p,F.id,{name:'Crate',pos:[r3(Math.cos(a)*r),1.5,r3(Math.sin(a)*r)],size:[3,3,3],color:'#a1764b',material:'Wood'});}
  for(const t of ['Sword','Blaster']){const ns=G.prefab(p,t);ns[0].parent='pack';}
  G.prefab(p,'Healing potion',{x:0,y:2,z:16});G.prefab(p,'Healing potion',{x:-40,y:2,z:0});
  const ZL='vzleft',RS='vreset',BR='vbrute',SP='vspawn',WV='vwave',KG='vking',ZOX='vzox',ZV=[['zombies left',ZL],['reset',RS],['brute timer',BR],['to spawn',SP],['wave',WV],['king timer',KG],['map x',ZOX]];
  const zox=v=>G.arith('ADD',typeof v==='number'?G.num(v):v,G.vget(ZOX));
  const kinds=[['Zombie',{scale:1,health:60,walkSpeed:10,colors:{head:'#7cb342',torso:'#4e6b3a',arms:'#7cb342',legs:'#37474f'}},12,'Braaains!'],
    ['Runner',{scale:.85,health:30,walkSpeed:15,colors:{head:'#c5e1a5',torso:'#8d6e63',arms:'#c5e1a5',legs:'#5d4037'}},8,'Hssss!'],
    ['Brute',{scale:1.8,health:320,walkSpeed:7,colors:{head:'#558b2f',torso:'#33691e',arms:'#558b2f',legs:'#1b5e20'}},30,'SMASH!'],
    ['Exploder',{scale:1.05,health:45,walkSpeed:11,colors:{head:'#aed581',torso:'#ff6f00',arms:'#aed581',legs:'#bf360c'}},10,'Tick... tick...'],
    ['Spitter',{scale:.95,health:40,walkSpeed:9,colors:{head:'#cddc39',torso:'#827717',arms:'#cddc39',legs:'#33691e'}},6,'Ptooey!'],
    ['King',{scale:2.7,health:1600,walkSpeed:8,colors:{head:'#33691e',torso:'#4a148c',arms:'#33691e',legs:'#1a237e'}},45,'BOW TO THE KING!']];
  kinds.forEach(([nm,o,dmg,say])=>{const Z=rigNode(Object.assign({name:nm,parent:'rs',pos:[0,2.6*o.scale,0],respawn:0},o));p.nodes.push(Z);
    G.hscript(p,Z.id,'Chase',blk('ev_start'),G.forever(G.walkN(bme()),G.wait(.2)));
    G.script(p,Z.id,'Bite',blk('ev_touch'),blk('pl_damage',{N:bn(dmg)}),...(nm==='Brute'||nm==='King'?[blk('pl_knock',{WHO:bme(),P:bn(80)},{RAG:'TRUE'})]:[]),G.wait(1));
    G.hscript(p,Z.id,'Growl',blk('ev_start'),G.forever(G.wait(G.rnd(4,9)),G.iff(G.cmp(G.nearD(bme()),'LT',G.num(14)),blk('rig_say',{PART:bme(),TEXT:bt(say),S:bn(1)}))));
    G.script(p,Z.id,'KO',blk('ev_rig_died'),G.sadd('KOs',nm==='King'?20:nm==='Brute'?5:1),G.sadd('Cash',nm==='King'?300:nm==='Brute'?60:nm==='Exploder'?20:10));
    if(nm==='Exploder')G.script(p,Z.id,'Boom',blk('ev_rig_died'),G.sound('explode'),blk('p_break',{X:G.prop(bme(),'x'),Y:G.prop(bme(),'y'),Z:G.prop(bme(),'z'),R:bn(6),P:bn(40)}),
      G.iff(G.cmp({block:{type:'s_distance',inputs:{PART:bme()}}},'LT',G.num(9)),blk('pl_damage',{N:bn(25)}),G.msg('BOOM! Shoot Exploders from a distance.',2)));
    if(nm==='Spitter')G.hscript(p,Z.id,'Spit',blk('ev_start'),G.forever(G.wait(G.rnd(2,4)),G.iff(G.AND(G.cmp(G.nearD(bme()),'LT',G.num(28)),G.cmp(G.nearD(bme()),'GT',G.num(5))),
      blk('rig_say',{PART:bme(),TEXT:bt('Ptooey! 🟢'),S:bn(1)}),G.iff(G.cmp(G.rnd(1,10),'LTE',G.num(5)),G.asP({block:{type:'pl_ref_nearpart',inputs:{PART:bme()}}},blk('pl_damage',{N:bn(9)}),G.msg('Acid spit!',1))))));
    if(nm==='King')G.hscript(p,Z.id,'Stomp',blk('ev_start'),G.forever(G.wait(6),G.iff(G.cmp(G.nearD(bme()),'LT',G.num(30)),blk('rig_say',{PART:bme(),TEXT:bt('STOMP!'),S:bn(1)}),G.bc('king stomp'))));
    G.vars(G.hscript(p,Z.id,'Count',blk('ev_rig_died'),G.vchg(ZL,-1)),ZV);});
  const edge=nm=>G.ifElse(G.cmp(G.rnd(1,2),'EQ',G.num(1)),[G.ifElse(G.cmp(G.rnd(1,2),'EQ',G.num(1)),[blk('rs_copy',{X:zox(G.rnd(-80,80)),Y:bn(3),Z:G.rnd(-82,-78)},{NAME:nm})],[blk('rs_copy',{X:zox(G.rnd(-80,80)),Y:bn(3),Z:G.rnd(78,82)},{NAME:nm})])],
    [G.ifElse(G.cmp(G.rnd(1,2),'EQ',G.num(1)),[blk('rs_copy',{X:zox(G.rnd(78,82)),Y:bn(3),Z:G.rnd(-80,80)},{NAME:nm})],[blk('rs_copy',{X:zox(G.rnd(-82,-78)),Y:bn(3),Z:G.rnd(-80,80)},{NAME:nm})])]);
  const eq=(id,n)=>G.cmp(G.vget(id),'EQ',G.num(n));
  G.vars(G.hscript(p,'sss','Waves',blk('ev_start'),G.vset(WV,G.num(0)),G.vset(KG,G.num(0)),G.vset(RS,G.num(0)),G.vset(BR,G.num(0)),G.vset(ZOX,G.arith('MULTIPLY',G.rnd(0,1),G.num(300))),G.wait(.3),G.bc('zmap'),
    G.msg('Zombies attack in waves from every side: runners from wave 3, a Brute every 5th wave. Spend cash at the ARMORY between waves! Sword (1), blaster (2).',5),G.wait(5),
    G.forever(G.vchg(WV,1),G.msg(G.join('Wave ',G.vget(WV),'!'),2),G.sound('check'),
      G.vset(ZL,G.arith('ADD',G.arith('ADD',G.arith('MULTIPLY',G.vget(WV),G.num(3)),G.num(2)),G.arith('MULTIPLY',G.arith('MINUS',G.players(),G.num(1)),G.num(3)))),G.vset(SP,G.vget(ZL)),
      G.vchg(BR,1),G.iff(G.cmp(G.vget(BR),'GTE',G.num(5)),G.vset(BR,G.num(0)),G.vchg(ZL,1),edge('Brute'),G.msg('A BRUTE is coming! It hits hard: keep your distance.',3)),
      G.vchg(KG,1),G.iff(G.cmp(G.vget(KG),'GTE',G.num(10)),G.vset(KG,G.num(0)),G.vchg(ZL,1),edge('King'),G.sound('die'),blk('g_sky',null,{COLOUR:'#3a1030'}),G.msg('👑 THE ZOMBIE KING HAS ARRIVED! Everyone focus fire!',4)),
      G.iff(G.cmp(G.vget(KG),'EQ',G.num(1)),blk('g_sky',null,{COLOUR:'#55606e'})),
      blk('controls_repeat_ext',{TIMES:G.vget(SP),DO:doIn(G.iff(eq(RS,0),G.ifElse(G.AND(G.cmp(G.vget(WV),'GTE',G.num(6)),G.cmp(G.rnd(1,7),'EQ',G.num(1))),[edge('Spitter')],[G.ifElse(G.AND(G.cmp(G.vget(WV),'GTE',G.num(4)),G.cmp(G.rnd(1,6),'EQ',G.num(1))),[edge('Exploder')],[G.ifElse(G.AND(G.cmp(G.vget(WV),'GTE',G.num(3)),G.cmp(G.rnd(1,4),'EQ',G.num(1))),[edge('Runner')],[edge('Zombie')])])])),G.wait(1.1))}),
      G.until(G.cmp(G.vget(ZL),'LTE',G.num(0))),
      G.ifElse(eq(RS,1),[G.vset(RS,G.num(0)),G.vset(WV,G.num(0)),G.vset(BR,G.num(0)),G.wait(3),G.vset(ZOX,G.arith('MULTIPLY',G.rnd(0,1),G.num(300))),G.bc('zmap'),G.wait(1)],
        [G.msg('Wave cleared! +50 health. Next wave in 5 seconds...',3),G.bc('wave cleared'),G.wait(5)]))),ZV);
  G.script(p,'sss','Heal',G.onMsg('wave cleared'),blk('pl_heal',{N:bn(50)}));
  G.vars(G.script(p,'sss','WaveStat',blk('ev_start'),G.forever(G.sset('Wave',G.vget(WV)),G.wait(.5))),ZV);
  G.vars(G.script(p,'sss','Overrun',blk('ev_died'),G.ifElse(G.cmp(G.players(),'EQ',G.num(1)),
    [G.msg(G.join('The zombies got you on wave ',G.vget(WV),'! Starting again from wave 1...'),4),G.vset(RS,G.num(1)),G.vset(ZL,G.num(0)),blk('g_sky',null,{COLOUR:'#55606e'}),
      ...['Zombie','Runner','Brute','Exploder','Spitter','King'].map(nm=>blk('controls_repeat_ext',{TIMES:bn(60),DO:doIn(blk('p_destroy',{PART:G.pnamed(nm)}))}))],
    [G.msg('Knocked out! Your team holds on while you respawn.',3)])),ZV);
  // the armory: spend Cash from knockouts between waves
  gkGun(p,'rs','Scatter Gun',{dmg:22,cool:.7,color:'#ffab40',speed:200,len:.5,tip:'Bought at the armory'});
  gkGun(p,'rs','Zombie Laser',{dmg:60,cool:.35,color:'#e040fb',speed:400,len:1.4,tip:'Bought at the armory'});
  gkGun(p,'rs','Rocket Launcher',{dmg:90,cool:1.1,color:'#ff5252',speed:160,len:1,tip:'Bought at the armory. Big damage!',extra:doIn(blk('p_break',{X:G.prop({block:{type:'tool_hitpart'},shadow:{type:'p_this'}},'x'),Y:G.prop({block:{type:'tool_hitpart'},shadow:{type:'p_this'}},'y'),Z:G.prop({block:{type:'tool_hitpart'},shadow:{type:'p_this'}},'z'),R:bn(5),P:bn(30)}),blk('g_sound',null,{SND:'explode'}))});
  const SHOP=[['Medkit',40,'#ef5350',[blk('pl_heal',{N:bn(100)})]],['Armor',120,'#90a4ae',[blk('pl_maxhp',{N:bn(160)}),blk('pl_heal',{N:bn(160)})]],
    ['Scatter Gun',150,'#ffab40',[blk('tool_take',null,{NAME:'Scatter Gun'}),blk('tool_give',null,{NAME:'Scatter Gun'})]],['Zombie Laser',400,'#e040fb',[blk('tool_take',null,{NAME:'Zombie Laser'}),blk('tool_give',null,{NAME:'Zombie Laser'})]],
    ['Rocket Launcher',650,'#ff5252',[blk('tool_take',null,{NAME:'Rocket Launcher'}),blk('tool_give',null,{NAME:'Rocket Launcher'})]]];
  G.part(p,F.id,{name:'Armory',pos:[3,.3,-14],size:[32,.6,6],color:'#37474f',material:'Metal',label:'ARMORY'});
  G.part(p,F.id,{name:'Armory',pos:[303,.3,-14],size:[32,.6,6],color:'#37474f',material:'Metal',label:'ARMORY'});
  [0,300].forEach(AX=>SHOP.forEach(([nm,cost,col,act],i)=>{const pad=G.part(p,F.id,{name:'Buy '+nm,pos:[AX-9+i*6,1,-14],size:[4,1.2,4],color:col,material:'Neon',label:nm+' · '+cost+' cash'});
    G.script(p,pad.id,'Buy',blk('ev_touch'),G.ifElse(G.cmp(G.stat('Cash'),'GTE',G.num(cost)),[G.sadd('Cash',-cost),...act,G.sound('coin'),G.msg('Bought '+nm+'!',2)],[G.sound('click'),G.msg(nm+' costs '+cost+' cash. Knock out zombies to earn more!',2)]),G.wait(1.5));}));
  // second map: the Farm, 300 studs east. A barn to defend, crop rows, hay bales and a windmill
  {const OX=300,FM=G.folder(p,'Farm').id;const Q=o=>G.part(p,FM,o);
    Q({name:'Field',pos:[OX,-1,0],size:[180,2,180],color:'#8bc34a',material:'Grass'});
    [[-90,0,2,180],[90,0,2,180],[0,-90,180,2],[0,90,180,2]].forEach(([x,z2,w,d])=>Q({name:'Fence',pos:[OX+x,2.5,z2],size:[w,5,d],color:'#a1887f',material:'Wood'}));
    Q({name:'Barn',pos:[OX-30,6,-35],size:[24,12,18],color:'#c62828',material:'Wood'});Q({name:'BarnRoof',shape:'wedge',pos:[OX-30,14,-35],size:[24,4,18],color:'#5d4037',material:'Wood'});
    Q({name:'BarnDoor',pos:[OX-30,4,-25.9],size:[8,8,.3],color:'#ffffff',material:'Wood'});
    Q({name:'Silo',shape:'cyl',pos:[OX-12,10,-40],size:[8,20,8],color:'#90a4ae',material:'Metal'});Q({name:'SiloTop',shape:'ball',pos:[OX-12,20,-40],size:[8,5,8],color:'#78909c',material:'Metal'});
    for(let r=0;r<6;r++)Q({name:'Crops',pos:[OX+30,.8,-50+r*7],size:[40,1.6,2.4],color:r%2?'#cddc39':'#ffeb3b',material:'Grass'});
    [[-50,30],[-40,46],[20,40],[50,20],[60,-30],[-60,-10]].forEach(([x,z2])=>Q({name:'HayBale',shape:'cyl',pos:[OX+x,1.6,z2],size:[3.2,3.2,4],rot:[90,0,0],color:'#fbc02d',material:'Grass'}));
    Q({name:'WindmillPole',pos:[OX+55,9,50],size:[2,18,2],color:'#eceff1',material:'Wood'});
    const blade=Q({name:'WindmillBlade',pos:[OX+55,18,51.4],size:[16,1.2,.4],color:'#fafafa',material:'Wood',canCollide:false});G.script(p,blade.id,'Turn',blk('ev_start'),G.forever(blk('p_rotate',{PART:bme(),DEG:bn(3)},{AXIS:'z'}),G.wait(.05)));
    Q({name:'Tractor',pos:[OX+10,1.6,25],size:[5,3,7],color:'#2e7d32',material:'Metal'});Q({name:'TractorWheel',shape:'cyl',pos:[OX+10,1.8,21],size:[3.6,3.6,6.4],rot:[0,0,90],color:'#212121',material:'Plastic'});
    Q({name:'Scarecrow',pos:[OX+30,3,-20],size:[1,6,1],color:'#8d6e63',material:'Wood'});Q({name:'ScarecrowArms',pos:[OX+30,4.5,-20],size:[5,.6,.6],color:'#8d6e63',material:'Wood'});
    Q({name:'Watchtower',pos:[OX+45,5,-60],size:[8,10,8],color:'#795548',material:'Wood'});Q({name:'TowerRamp',shape:'wedge',pos:[OX+45,5,-50],size:[4,10,12],rot:[0,180,0],color:'#a1887f',material:'Wood'});}
  G.vars(G.script(p,'sss','Respawn on map',blk('ev_spawn'),G.wait(.05),G.iff(G.cmp(G.vget(ZOX),'GT',G.num(0)),blk('pl_tpxyz',{X:zox(G.rnd(-6,6)),Y:bn(3),Z:bn(16)}))),ZV);
  G.vars(G.script(p,'sss','Map arrive',G.onMsg('zmap'),blk('pl_tpxyz',{X:zox(0),Y:bn(3),Z:bn(16)}),G.ifElse(G.cmp(G.vget(ZOX),'EQ',G.num(300)),[G.msg('Map: THE FARM. Defend the barn! Climb the watchtower for a better view.',3)],[G.msg('Map: THE TOWN',2)])),ZV);
  // supply drop every third wave: a crate parachutes in with a free weapon or a full heal
  const crate=G.part(p,'workspace',{name:'SupplyCrate',pos:[0,-50,0],size:[3,3,3],color:'#ffb300',material:'Wood',label:'🪂 SUPPLIES',canCollide:false});
  G.vars(G.hscript(p,'sss','Supply drop',blk('ev_start'),G.forever(G.until(G.AND(G.cmp(G.vget(WV),'GT',G.num(0)),G.cmp(G.vget('vsupw'),'NEQ',G.vget(WV)))),G.vset('vsupw',G.vget(WV)),
    G.iff(G.cmp(G.vget('vsupcount'),'GTE',G.num(2)),G.vset('vsupcount',G.num(-1)),G.vset('vsx',zox(G.rnd(-50,50))),G.vset('vsz',G.rnd(-50,50)),G.bc('supply'),
      blk('p_setpos',{PART:G.pnamed('SupplyCrate'),X:G.vget('vsx'),Y:bn(60),Z:G.vget('vsz')}),blk('p_glide',{PART:G.pnamed('SupplyCrate'),X:bn(0),Y:bn(-58.5),Z:bn(0),S:bn(6)})),G.vchg('vsupcount',1))),[...ZV,['supply wave','vsupw'],['supply count','vsupcount'],['supply x','vsx'],['supply z','vsz']]);
  G.script(p,'sss','Supply msg',G.onMsg('supply'),G.sound('check'),G.msg('🪂 A SUPPLY DROP is falling! Grab it first!',3));
  G.vars(G.script(p,crate.id,'Open',blk('ev_touch'),G.iff(G.cmp(G.prop(bme(),'y'),'GT',G.num(-10)),G.shSet('vsupopen',G.num(1)),G.sound('win'),G.vset('vsr',G.rnd(1,3)),
    G.ifElse(G.cmp(G.vget('vsr'),'EQ',G.num(1)),[blk('tool_take',null,{NAME:'Zombie Laser'}),blk('tool_give',null,{NAME:'Zombie Laser'}),G.msg('SUPPLIES: a free Zombie Laser!',3)],
      [G.ifElse(G.cmp(G.vget('vsr'),'EQ',G.num(2)),[blk('tool_take',null,{NAME:'Scatter Gun'}),blk('tool_give',null,{NAME:'Scatter Gun'}),G.msg('SUPPLIES: a free Scatter Gun!',3)],[blk('pl_heal',{N:bn(500)}),G.sadd('Cash',100),G.msg('SUPPLIES: full heal and +100 cash!',3)])]))),[['supply open','vsupopen'],['supply roll','vsr']]);
  G.vars(G.hscript(p,'sss','Supply taken',blk('ev_start'),G.forever(G.until(G.cmp(G.vget('vsupopen'),'EQ',G.num(1))),G.vset('vsupopen',G.num(0)),blk('p_setpos',{PART:G.pnamed('SupplyCrate'),X:bn(0),Y:bn(-50),Z:bn(0)}))),[['supply open','vsupopen']]);
  G.script(p,'sss','Stomped',G.onMsg('king stomp'),blk('g_shake',null,{POW:'.7'}),G.iff(G.cmp({block:{type:'s_distance',inputs:{PART:G.pnamed('King')}}},'LT',G.num(30)),blk('pl_launch',{P:bn(55)}),blk('pl_damage',{N:bn(15)}),G.msg('The ground shakes!',1)));
  G.vars(G.script(p,'sss','Wave callout',blk('ev_start'),G.vset('vwseen',G.num(0)),G.forever(G.until(G.cmp(G.vget(WV),'GT',G.vget('vwseen'))),G.vset('vwseen',G.vget(WV)),blk('g_callout',{TEXT:G.join('WAVE ',G.vget(WV))}))),[...ZV,['wave seen','vwseen']]);
  G.hud(p,'Horde','#33691e',G.join('🧟 Wave ',G.vget(WV),'  ·  ',G.vget(ZL),' zombies left  ·  💰 ',G.stat('Cash')));
  G.vars(G.script(p,'sss','Night falls',G.onMsg('wave cleared'),G.iff(G.cmp(G.vget(KG),'GT',G.num(0)),G.iff(G.cmp(G.vget(WV),'EQ',G.num(4)),blk('g_sky',null,{COLOUR:'#3c4656'}),G.msg('🌙 Night is falling... the zombies get bolder.',2.5)),
    G.iff(G.cmp(G.vget(WV),'EQ',G.num(7)),blk('g_sky',null,{COLOUR:'#232a38'})))),ZV);
  G.welcome(p,G.sset('KOs',0),G.sset('Cash',0));
  G.best(p,'Wave','zombie_wave');
  return G.def(p,'zombies','Zombie Survival');}

/* 3. Rainbow Obby */
function rainbowDef(){const G=GK;const p=G.proj('rainbow','Rainbow Obby',{sky:'#9fd8ff'});G.noBase(p);G.spawnAt(p,0,40,0,{size:[14,1,14]});
  const C=G.folder(p,'Course');let z=-10,y=40,stage=0;
  const P=(o)=>G.part(p,C.id,o);
  const check=()=>{stage++;P({name:'Checkpoint',pos:[0,y,z-6],size:[12,1,12],color:'#3ddc84',behavior:'check',value:stage});z-=12;};
  const col=()=>OBBY_COLS[stage%OBBY_COLS.length];
  // 1 stepping stones
  for(let i=0;i<6;i++){P({name:'Stone',pos:[(i%2?3:-3),y,z-4],size:[4,1,4],color:col()});z-=7;}check();
  // 2 lava floor with beams
  P({name:'Lava',pos:[0,y-1,z-14],size:[16,1,28],color:'#ff3b30',material:'Neon',behavior:'kill'});
  for(let i=0;i<3;i++)P({name:'Beam',pos:[(i-1)*5,y+1,z-14],size:[1.4,1,28],color:col()});z-=28;check();
  // 3 jump pads up
  for(let i=0;i<3;i++){P({name:'JumpPad',pos:[0,y,z-4],size:[4,.4,4],color:'#22d3ee',material:'Neon',behavior:'jump',value:75});z-=8;y+=9;P({name:'Ledge',pos:[0,y,z-4],size:[6,1,6],color:col()});z-=8;}check();
  // 4 moving platforms
  for(let i=0;i<4;i++){const n=P({name:'Mover',pos:[0,y,z-5],size:[5,1,5],color:col()});G.script(p,n.id,'Slide',...SCR.glide(i%2?10:-10,0,0,1.6).blocks.blocks);z-=10;}check();
  // 5 vanishing tiles
  for(let i=0;i<7;i++){const n=P({name:'Vanish',pos:[(i%2?2:-2),y,z-3],size:[3.5,1,3.5],color:'#a8e6ff',transparency:.15});G.script(p,n.id,'Vanish',...SCR.vanish().blocks.blocks);z-=6;}check();
  // 6 spinner
  P({name:'Floor',pos:[0,y,z-12],size:[14,1,24],color:col()});const sp=P({name:'Spinner',pos:[0,y+1.5,z-12],size:[13,1,1],color:'#ff3b30',material:'Neon',behavior:'kill'});
  G.script(p,sp.id,'Spin',...SCR.spin(4).blocks.blocks);z-=24;check();
  // 7 wedge climb
  for(let i=0;i<4;i++){P({name:'Ramp',shape:'wedge',pos:[0,y+2,z-4],size:[6,4,8],rot:[0,180,0],color:col()});y+=4;z-=8;P({name:'Landing',pos:[0,y,z-2],size:[6,1,4],color:col()});z-=4;}check();
  // 8 thin zig-zag
  for(let i=0;i<6;i++){P({name:'Zig',pos:[(i%2?4:-4),y,z-3],size:[9,1,1.4],rot:[0,i%2?35:-35,0],color:col()});z-=5;}check();
  // 9 falling-glide elevator
  const el=P({name:'Elevator',pos:[0,y,z-5],size:[6,1,6],color:'#ffd54f'});G.script(p,el.id,'Lift',...SCR.glide(0,14,0,2.5).blocks.blocks);z-=10;y+=14;P({name:'Top',pos:[0,y,z-4],size:[8,1,8],color:col()});z-=8;check();
  // 10 rainbow bridge of vanishing glass over lava
  P({name:'Lava',pos:[0,y-3,z-16],size:[18,1,32],color:'#ff3b30',material:'Neon',behavior:'kill'});
  for(let i=0;i<8;i++){const n=P({name:'Glass',pos:[(i%3-1)*3,y,z-2-i*4],size:[3,1,3],color:OBBY_COLS[i%OBBY_COLS.length],material:'Glass',transparency:.3});if(i%2)G.script(p,n.id,'Vanish',...SCR.vanish().blocks.blocks);}z-=32;check();
  // 11 spinning rainbow disk
  P({name:'Disk',shape:'cyl',pos:[0,y,z-9],size:[16,1,16],color:col()});{const b1=P({name:'DiskBar',pos:[0,y+1.4,z-9],size:[15,1,1],color:'#ff3b30',material:'Neon',behavior:'kill'});G.script(p,b1.id,'Spin',...SCR.spin(3).blocks.blocks);}z-=18;check();
  // 12 wall hop
  P({name:'Lava',pos:[0,y-3,z-15],size:[16,1,30],color:'#ff3b30',material:'Neon',behavior:'kill'});for(let i=0;i<5;i++)P({name:'WallHop',pos:[(i%2?3.5:-3.5),y,z-3-i*6],size:[1.2,1,5],color:OBBY_COLS[(i+3)%OBBY_COLS.length]});z-=30;check();
  // 13 bouncy staircase up through rainbow rings
  for(let i=0;i<3;i++){P({name:'JumpPad',pos:[0,y,z-3],size:[4,.4,4],color:'#22d3ee',material:'Neon',behavior:'jump',value:80});P({name:'Ring',shape:'cyl',pos:[0,y+7,z-6],size:[7,.6,7],rot:[90,0,0],color:OBBY_COLS[i],material:'Neon',canCollide:false,transparency:.4});z-=8;y+=9;P({name:'Ledge',pos:[0,y,z-3],size:[5,1,5],color:col()});z-=6;}check();
  // 14 star coins on a crusher hall
  P({name:'Hall',pos:[0,y,z-14],size:[10,1,28],color:col()});for(let i=0;i<3;i++){const n=P({name:'Crusher',pos:[0,y+1.3,z-5-i*8],size:[10,1,1.2],color:'#ff3b30',material:'Neon',behavior:'kill'});G.script(p,n.id,'Bob',...SCR.glide(0,7,0,1.1).blocks.blocks);}
  for(let i=0;i<3;i++){const st=P({name:'StarCoin',shape:'ball',pos:[(i-1)*3,y+1.5,z-9-i*6],size:[1.2,1.2,1.2],color:'#ffd740',material:'Neon',canCollide:false});G.script(p,st.id,'Take',blk('ev_touch'),blk('p_visible',{PART:bme()},{B:'FALSE'}),blk('p_setpos',{PART:bme(),X:bn(0),Y:bn(-80),Z:bn(0)}),G.sadd('Stars',1),G.sound('coin'),blk('pl_coins',{N:bn(2)}));}
  z-=28;check();
  // 15 final sprint with speed pad
  P({name:'SpeedPad',pos:[0,y,z-4],size:[6,.4,6],color:'#ffd400',material:'Neon',behavior:'speed',value:2.6});z-=8;
  P({name:'Run',pos:[0,y,z-15],size:[6,1,30],color:col()});z-=30;
  P({name:'Finish',pos:[0,y,z-8],size:[16,1,16],color:'#ffc93c',material:'Metal',behavior:'finish'});
  G.welcome(p,G.msg('15 rainbow stages. Checkpoints save your progress! Grab the star coins on stage 14.',4));
  return G.def(p,'rainbow','Rainbow Obby');}

/* 4. Gem Hunt */
function gemsDef(){const G=GK;const p=G.proj('gems','Gem Hunt',{sky:'#a6e3ff',timer:false,saveStats:false,saveCheckpoint:false,lobby:true,lobbyWait:12,lobbyRound:90,lobbyScore:'Gems'});
  const bp=p.nodes.find(n=>n.name==='Baseplate');Object.assign(bp,{size:[220,2,220],color:'#58b947',material:'Grass'});
  const W_=G.folder(p,'World');const P=o=>G.part(p,W_.id,o);
  const hills=[[-40,-30,24,8],[50,-50,30,14],[-60,50,20,10],[30,40,26,6],[0,-80,18,20]];
  hills.forEach(([x,z,w,h])=>{const n=Math.ceil(h/4.4),lh=r3(h/n);for(let k=0;k<n;k++)P({name:'Hill',pos:[x,r3((k+.5)*lh),z],size:[w-k*(w-6)/n,lh,w-k*(w-6)/n].map(r3),color:['#4a9f3c','#3f8a33','#37782c','#2e6b25','#28601f'][k],material:'Grass'});});
  for(let i=0;i<26;i++){const a=i*2.4,r=30+((i*37)%70);const x=r3(Math.cos(a)*r),z=r3(Math.sin(a)*r);if(hills.some(h=>Math.hypot(h[0]-x,h[1]-z)<h[2]/2+4))continue;
    P({name:'Trunk',pos:[x,3,z],size:[1.6,6,1.6],color:'#6d4c41',material:'Wood'});P({name:'Leaves',pos:[x,7.5,z],size:[7,5,7],color:'#2e7d32',material:'Grass',canCollide:false});}
  P({name:'Pond',pos:[-10,.05,20],size:[24,.2,18],color:'#2f8fd8',material:'Glass',transparency:.3,canCollide:false});
  P({name:'Tower',pos:[80,15,80],size:[8,30,8],color:'#8c95a6',material:'Brick'});
  P({name:'JumpPad',pos:[72,.2,80],size:[5,.4,5],color:'#22d3ee',material:'Neon',behavior:'jump',value:115});
  [[0,30],[-70,-10],[60,0]].forEach(([x,z])=>P({name:'SpeedPad',pos:[x,.2,z],size:[5,.4,5],color:'#ffd400',material:'Neon',behavior:'speed',value:2}));
  const GOX='vgox',GV2=[['map x',GOX]];const ox=v=>G.arith('ADD',typeof v==='number'?G.num(v):v,G.vget(GOX));
  {const OX=320,C2=G.folder(p,'Crystal Canyon').id;const Q=o=>G.part(p,C2,o);
    Q({name:'CanyonFloor',pos:[OX,-1,0],size:[220,2,220],color:'#6a4c93',material:'Slate'});
    [[-50,-40,22,10],[45,-55,26,16],[-55,50,18,8],[40,45,24,12],[0,0,14,18]].forEach(([x,z2,w,h])=>{const n=Math.ceil(h/4);for(let k=0;k<n;k++)Q({name:'Mesa',pos:[OX+x,r3((k+.5)*h/n),z2],size:[r3(w-k*3),r3(h/n),r3(w-k*3)],color:['#8e6cc0','#7a5aa8','#6a4c93','#5a3f80','#4a3370'][k%5],material:'Slate'});});
    for(let i=0;i<22;i++){const a=i*2.1,r=25+((i*41)%70);Q({name:'Crystal',pos:[OX+r3(Math.cos(a)*r),3,r3(Math.sin(a)*r)],size:[1.6,6+(i%3)*2,1.6],rot:[0,i*20,i%2?12:-12],color:['#e1bee7','#80deea','#f48fb1'][i%3],material:'Neon',canCollide:false});}
    [[-38,-40],[30,-55],[-40,50],[25,45]].forEach(([x,z2])=>Q({name:'JumpPad',pos:[OX+x,.3,z2],size:[5,.4,5],color:'#22d3ee',material:'Neon',behavior:'jump',value:110}));}
    {const OX=640,C3=G.folder(p,'Pirate Cove').id;const Q=o=>G.part(p,C3,o);
    Q({name:'Sand',pos:[OX,-1,0],size:[220,2,220],color:'#f2d79b',material:'Sand'});Q({name:'Lagoon',pos:[OX+40,.05,-40],size:[50,.2,40],color:'#4fc3f7',material:'Glass',transparency:.3});
    for(let i=0;i<4;i++)Q({name:'Shipwreck',pos:[OX-40,3+i*.5,-50+i*8],size:[14,6,8],rot:[0,0,i*6],color:'#5d4037',material:'Wood'});Q({name:'Mast',pos:[OX-40,14,-38],size:[1.2,18,1.2],rot:[0,0,15],color:'#4e342e',material:'Wood'});
    [[30,40,20,8],[-50,40,16,6],[60,10,14,10]].forEach(([x,z2,w,h])=>{const n=Math.ceil(h/3);for(let k=0;k<n;k++)Q({name:'Dune',pos:[OX+x,r3((k+.5)*h/n),z2],size:[w-k*4,r3(h/n),w-k*4],color:'#e6c27a',material:'Sand'});});
    for(let i=0;i<12;i++){const x=((i*47)%180)-90,z2=((i*83)%180)-90;Q({name:'PalmTrunk',pos:[OX+x,4,z2],size:[1.2,8,1.2],color:'#8d6e63',material:'Wood'});Q({name:'PalmLeaves',pos:[OX+x,8.3,z2],size:[7,.6,7],color:'#43a047',material:'Grass',canCollide:false});}
    [[-20,0],[20,-60]].forEach(([x,z2])=>Q({name:'JumpPad',pos:[OX+x,.3,z2],size:[5,.4,5],color:'#22d3ee',material:'Neon',behavior:'jump',value:110}));}
  G.vars(G.script(p,'sss','Pick map',G.onMsg('round start'),G.vset(GOX,G.arith('MULTIPLY',G.rnd(0,2),G.num(320))),G.ifElse(G.cmp(G.vget(GOX),'EQ',G.num(0)),[blk('g_sky',null,{COLOUR:'#a6e3ff'})],[G.ifElse(G.cmp(G.vget(GOX),'EQ',G.num(320)),[blk('g_sky',null,{COLOUR:'#2a1b47'}),G.msg('Map: CRYSTAL CANYON',2)],[blk('g_sky',null,{COLOUR:'#ffcc80'}),G.msg('Map: PIRATE COVE',2)])]),
    blk('pl_tpxyz',{X:ox(G.rnd(-8,8)),Y:bn(4),Z:G.rnd(-8,8)})),GV2);
  const drop=()=>blk('p_setpos',{PART:bme(),X:ox(G.rnd(-95,95)),Y:bn(45),Z:G.rnd(-95,95)});
  for(let i=0;i<16;i++){const g=P({name:'Gem',shape:'ball',pos:[r3(-90+((i*53)%180)),45,r3(-90+((i*97)%180))],size:[1.8,1.8,1.8],color:'#ffd54f',material:'Neon',canCollide:false,anchored:false});
    p.nodes.push(emitterNode({parent:g.id,name:'Shine',rate:3},'sparkles'));
    G.vars(G.script(p,g.id,'To map',G.onMsg('round start'),G.wait(.1),drop()),GV2);
    G.script(p,g.id,'Collect',blk('ev_touch'),G.sadd('Gems',1),G.sound('coin'),blk('pe_emit',{N:bn(20),PART:bme()}),drop());
    G.script(p,g.id,'Spin',blk('ev_start'),G.forever(blk('p_rotate',{PART:bme(),DEG:bn(6)},{AXIS:'y'}),G.wait(0)));}
  const cr=P({name:'Crystal',shape:'ball',pos:[0,45,-30],size:[3,3,3],color:'#d68cff',material:'Neon',canCollide:false,anchored:false,label:'+5'});p.nodes.push(emitterNode({parent:cr.id,name:'Magic'},'magic'));
  G.script(p,cr.id,'Collect',blk('ev_touch'),G.sadd('Gems',5),G.sound('win'),G.msg('Super crystal! +5 gems',2),blk('pe_emit',{N:bn(60),PART:bme()}),drop());
  G.script(p,cr.id,'Wander',blk('ev_start'),G.forever(G.wait(12),drop(),G.msg('The super crystal fell somewhere new...',2)));
  const sg=guiNode('ScreenGui',{name:'HUD'});const lb=guiNode('TextLabel',{parent:sg.id,name:'GemLabel',text:'Gems: 0',gpos:[.5,0,0,104],anchor:[.5,0],gsize:[0,300,0,46],bg:'#7e57c2',bgT:.05,tc:'#ffffff',font:'Cartoon',ts:24,radius:23,strokeT:1.5,strokeTc:'#311b92'});p.nodes.push(sg,lb);
  G.script(p,lb.id,'Count',blk('ev_start'),G.forever(blk('gui_settext',{GUI:{shadow:{type:'gui_this'}},TEXT:G.join('💎 ',G.stat('Gems'))}),G.wait(.2)));
  G.script(p,'sss','Total',blk('ev_data_loaded'),G.sset('Total',G.dget('gems_total',0)));
  G.welcome(p,G.sset('Gems',0),G.msg('Most gems in 90 seconds wins! The purple super crystal is worth 5, and grabbing gems quickly builds a streak bonus.',4));
  G.script(p,'sss','Time up',G.onMsg('round end'),blk('data_change',{KEY:bt('gems_total'),N:G.stat('Gems')}),blk('g_stat_change',{N:G.stat('Gems')},{STAT:'Total'}));
  G.best(p,'Gems','gems_best_round');
  // treasure chest on top of the tower (use the jump pad!)
  const ch=P({name:'TowerChest',pos:[80,31.2,80],size:[3,2,2],color:'#ffb300',material:'Wood',label:'+8'});
  G.vars(G.script(p,ch.id,'Open',blk('ev_touch'),G.iff(G.cmp(G.vget('vchest'),'EQ',G.num(0)),G.vset('vchest',G.num(1)),G.sadd('Gems',8),G.sound('win'),G.msg('Tower treasure! +8 gems',2),blk('p_visible',{PART:bme()},{B:'FALSE'}))),[['chest','vchest']]);
  G.vars(G.script(p,'sss','Chest reset',G.onMsg('round start'),G.vset('vchest',G.num(0)),blk('p_visible',{PART:G.pnamed('TowerChest')},{B:'TRUE'})),[['chest','vchest']]);
  // the gem raccoon steals gems if it catches you
  const rc=rigNode({name:'Gem Raccoon',pos:[-30,2,-60],scale:.7,health:999,respawn:0,walkSpeed:13,colors:{head:'#757575',torso:'#424242',arms:'#757575',legs:'#212121'}});p.nodes.push(rc);
  G.hscript(p,rc.id,'Prowl',blk('ev_start'),G.forever(G.ifElse(G.cmp(G.nearD(bme()),'LT',G.num(25)),[G.walkN(bme()),G.wait(.3)],[blk('rig_walk',{PART:bme(),X:ox(G.rnd(-90,90)),Z:G.rnd(-90,90)}),G.wait(1)])));
  G.script(p,rc.id,'Steal',blk('ev_touch'),G.iff(G.cmp(G.stat('Gems'),'GT',G.num(0)),G.sadd('Gems',-3),G.iff(G.cmp(G.stat('Gems'),'LT',G.num(0)),G.sset('Gems',0)),G.sound('die'),G.msg('The raccoon stole 3 gems! Run!',2),blk('pl_launch',{P:bn(40)})),G.wait(3));
  G.vars(G.hscript(p,'sss','Raccoon to map',G.onMsg('round start'),G.wait(.1),blk('p_setpos',{PART:G.pnamed('Gem Raccoon'),X:ox(-30),Y:bn(2),Z:bn(-60)}),blk('rig_walk',{PART:G.pnamed('Gem Raccoon'),X:ox(-30),Z:bn(-60)})),GV2);
  // halfway through, a rainbow gem worth 10 drops
  const rg=P({name:'RainbowGem',shape:'ball',pos:[0,-60,0],size:[2.6,2.6,2.6],color:'#ff4081',material:'Neon',canCollide:false,label:'+10'});p.nodes.push(emitterNode({parent:rg.id,name:'Rainbow'},'confetti'));
  G.vars(G.hscript(p,'sss','Rainbow drop',G.onMsg('round start'),blk('p_setpos',{PART:G.pnamed('RainbowGem'),X:bn(0),Y:bn(-60),Z:bn(0)}),G.vset('vrg',G.num(0)),G.wait(45),G.iff(G.inMatch(),G.vset('vrg',G.num(1)),G.bc('rainbow gem'),blk('p_setpos',{PART:G.pnamed('RainbowGem'),X:ox(G.rnd(-80,80)),Y:bn(30),Z:G.rnd(-80,80)}),blk('p_glide',{PART:G.pnamed('RainbowGem'),X:bn(0),Y:bn(-27),Z:bn(0),S:bn(3)}))),[['rainbow gem','vrg'],...G.MV,...GV2]);
  G.script(p,'sss','Rainbow msg',G.onMsg('rainbow gem'),G.sound('check'),G.msg('🌈 A RAINBOW GEM (+10) fell from the sky! Race for it!',3));
  G.vars(G.script(p,rg.id,'Grab',blk('ev_touch'),G.iff(G.cmp(G.vget('vrg'),'EQ',G.num(1)),G.shSet('vrg',G.num(0)),G.sadd('Gems',10),G.sound('win'),G.msg('RAINBOW GEM! +10',2),blk('p_setpos',{PART:bme(),X:bn(0),Y:bn(-60),Z:bn(0)}))),[['rainbow gem','vrg']]);
  gkPowerups(p,[[-60,0],[60,20],[0,60],[260,0],[380,20],[320,60]]);
  G.vars(G.hscript(p,'sss','Gem rush',G.onMsg('round start'),G.wait(72),G.iff(G.inMatch(),G.bc('gem rush'))),[...G.MV]);
  G.script(p,'sss','Gem rush msg',G.onMsg('gem rush'),G.sound('check'),G.msg('💎 GEM RUSH! The last 18 seconds: every gem counts double!',3),G.vset('vrush',G.num(1)),G.wait(18),G.vset('vrush',G.num(0)));
  G.script(p,'sss','Rush bonus',blk('ev_start'),G.forever(G.vset('vgl',G.stat('Gems')),G.until(G.cmp(G.stat('Gems'),'NEQ',G.vget('vgl'))),G.iff(G.AND(G.cmp(G.vget('vrush'),'EQ',G.num(1)),G.cmp(G.stat('Gems'),'GT',G.vget('vgl'))),G.sadd('Gems',G.arith('MINUS',G.stat('Gems'),G.vget('vgl'))))));
  G.matchFlags(p);
  // gem streak: grab gems quickly one after another for bonus gems
  G.vars(G.script(p,'sss','Gem streak',blk('ev_start'),G.vset('vlg',G.num(0)),G.vset('vgc',G.num(0)),G.forever(
    G.iff(G.cmp(G.stat('Gems'),'GT',G.vget('vlg')),G.ifElse(G.cmp(G.arith('MINUS',{block:{type:'s_timer'}},G.vget('vlgt')),'LT',G.num(2.5)),[G.vchg('vgc',1)],[G.vset('vgc',G.num(1))]),G.vset('vlgt',{block:{type:'s_timer'}}),
      G.iff(G.OR(G.cmp(G.vget('vgc'),'EQ',G.num(5)),G.cmp(G.vget('vgc'),'EQ',G.num(10))),G.sadd('Gems',2),G.sound('check'),G.msg(G.join('💎 GEM STREAK x',G.vget('vgc'),'! +2 bonus'),1.2)),G.vset('vlg',G.stat('Gems'))),
    G.iff(G.cmp(G.stat('Gems'),'LT',G.vget('vlg')),G.vset('vlg',G.stat('Gems'))),G.wait(.1))),[['last gems','vlg'],['gem streak','vgc'],['last gem time','vlgt']]);
  return G.def(p,'gems','Gem Hunt');}

/* 5. Turbo Track */
function turboDef(){const G=GK;const p=G.proj('turbo','Turbo Track',{sky:'#7fb8ff',saveStats:false,saveCheckpoint:false,lobby:true,lobbyWait:15,lobbyRound:150,lobbyScore:'Laps'});G.noBase(p);G.spawnAt(p,0,60,0,{size:[14,1,14]});
  const MOX='vtox',MV2=[['map x',MOX]],LT='vlap',lt=G.vget(LT),LG='vlapgo';
  const TRACKS=[{ox:0,S:'',road:'#3b4252',sky:'#7fb8ff'},{ox:300,S:'B',road:'#1a1033',sky:'#120b2e'},{ox:600,S:'C',road:'#795548',sky:'#a5d6a7'}];
  TRACKS.forEach(TK=>{const {ox,S,road:rc}=TK;const T=G.folder(p,'Track'+S).id;const P=o=>G.part(p,T,Object.assign({},o,{name:o.name+S,pos:[o.pos[0]+ox,o.pos[1],o.pos[2]]}));let z=-7,y=60;
    const road=(len,o)=>{P(Object.assign({name:'Road',pos:[0,y,z-len/2],size:[12,1,len],color:rc,material:S?'Neon':'Concrete'},o||{}));z-=len;};
    const speed=()=>P({name:'Boost',pos:[0,y+.6,z+4],size:[8,.4,5],color:'#ffd400',material:'Neon',behavior:'speed',value:4});
    const check=()=>{const c=P({name:'Checkpoint',pos:[0,y,z-5],size:[12,1,10],color:'#3ddc84',material:'Neon'});G.script(p,c.id,'Save',blk('ev_touch'),blk('pl_checkpoint',{PART:bme()}),G.sound('check'));z-=10;};
    TK.start=P({name:'StartPad',pos:[0,59.6,0],size:[14,.2,14],color:S?'#e040fb':'#ffffff',material:'Neon'});
    if(!S){road(40);speed();road(10);z-=16;road(30);check();
      road(10);P({name:'Ramp',shape:'wedge',pos:[0,y+2,z-5],size:[12,4,10],rot:[0,180,0],color:'#ff7b5c'});z-=10;z-=13;road(30);check();
      for(let i=0;i<5;i++){road(8,{size:[6,1,8],pos:[i%2?5:-5,y,z-4],color:'#5c6bc0'});z-=4;}check();
      road(12);P({name:'Launcher',pos:[0,y+.6,z+4],size:[8,.4,5],color:'#22d3ee',material:'Neon',behavior:'jump',value:110});z-=7;y+=20;road(30);check();
      road(10);speed();road(10);for(let i=0;i<3;i++){const n=P({name:'Sweeper',pos:[0,y+1.5,z-8-i*14],size:[11,1,1],color:'#ff3b30',material:'Neon',behavior:'kill'});G.script(p,n.id,'Spin',...SCR.spin(3+i).blocks.blocks);}road(44);check();
      road(20);speed();road(8);z-=18;
      [[3,-22],[-3,-34]].forEach(([x,oz])=>P({name:'OilSlick',pos:[x,60.55,oz],size:[5,.2,6],color:'#212121',material:'Glass',behavior:'speed',value:.45,label:'OIL'}));}
    else if(S==='C'){// Jungle Canyon: log bridges, a vine swing gap, river rapids and a waterfall launcher
      road(30,{color:'#6d4c41'});speed();road(10,{color:'#6d4c41'});
      for(let i=0;i<6;i++){road(6,{size:[4,1,6],pos:[i%2?3:-3,y,z-3],color:'#8d6e63'});}check();
      road(12,{color:'#6d4c41'});for(let i=0;i<4;i++){const lg=P({name:'Log',shape:'cyl',pos:[0,y,z-5],size:[12,2,3],rot:[0,0,90],color:'#5d4037'});G.script(p,lg.id,'Roll',...SCR.glide(0,1.2,0,.9).blocks.blocks);z-=8;}road(10,{color:'#6d4c41'});check();
      road(8,{color:'#6d4c41'});P({name:'Launcher',pos:[0,y+.6,z+4],size:[8,.4,5],color:'#22d3ee',material:'Neon',behavior:'jump',value:115});P({name:'Waterfall',pos:[0,y+10,z-12],size:[14,24,1],color:'#81d4fa',material:'Glass',transparency:.5,canCollide:false});z-=10;y+=22;road(30,{color:'#6d4c41'});check();
      road(10,{color:'#6d4c41'});for(let i=0;i<3;i++){const n=P({name:'Vine',pos:[0,y+1.5,z-8-i*12],size:[11,1,1],color:'#33691e',material:'Grass',behavior:'kill'});G.script(p,n.id,'Swing',...SCR.spin(2+i*.6).blocks.blocks);}road(40,{color:'#6d4c41'});check();
      road(16,{color:'#6d4c41'});speed();road(8,{color:'#6d4c41'});z-=18;
      for(let i=0;i<14;i++){const sd=i%2?1:-1;P({name:'JungleTree',pos:[sd*14,y-10,-i*30],size:[3,40,3],color:'#4e342e',material:'Wood'});P({name:'Canopy',pos:[sd*14,y+12,-i*30],size:[12,4,12],color:'#2e7d32',material:'Grass',canCollide:false});}}
    else{// Neon City: drops, a tunnel of crushers, moving bridges and a double launcher
      road(30);speed();road(10);for(let i=0;i<3;i++){y-=4;road(14,{color:['#e040fb','#00e5ff','#76ff03'][i]});}check();
      road(8);for(let i=0;i<3;i++){const m=P({name:'Bridge',pos:[0,y,z-6],size:[8,1,10],color:'#ff4081',material:'Neon'});G.script(p,m.id,'Slide',...SCR.glide(i%2?7:-7,0,0,1.4).blocks.blocks);z-=14;}road(8);check();
      road(40,{color:'#311b92'});for(let i=0;i<4;i++){const c=P({name:'Crusher',pos:[0,y+1.3,z+34-i*9],size:[12,1,1.4],color:'#ff1744',material:'Neon',behavior:'kill'});G.script(p,c.id,'Bob',...SCR.glide(0,6,0,.9+i*.15).blocks.blocks);}check();
      road(10);P({name:'Launcher',pos:[0,y+.6,z+4],size:[8,.4,5],color:'#22d3ee',material:'Neon',behavior:'jump',value:100});z-=8;y+=14;road(12);P({name:'Launcher',pos:[0,y+.6,z+4],size:[8,.4,5],color:'#22d3ee',material:'Neon',behavior:'jump',value:100});z-=8;y+=14;road(24);check();
      for(let i=0;i<6;i++){road(7,{size:[5,1,7],pos:[[-4,0,4,0,-4,0][i],y,z-3.5],color:'#00e5ff'});z-=3;}road(10);speed();road(20);z-=16;}
    const fin=P({name:'Finish',pos:[0,y,z-10],size:[20,1,20],color:'#ffc93c',material:'Neon'});TK.fin=fin;
    G.vars(G.script(p,fin.id,'Lap',blk('ev_touch'),G.sadd('Laps',1),G.vset(LT,{block:{type:'s_timer'}}),G.sound('win'),G.msg(G.join('Lap ',G.stat('Laps'),': ',lt,' seconds'),3),
      G.iff(G.OR(G.cmp(G.stat('Best Lap'),'EQ',G.num(0)),G.cmp(lt,'LT',G.stat('Best Lap'))),G.sset('Best Lap',lt),G.dset('turbo_best_lap',lt),G.msg('New best lap!',2)),
      blk('g_reset_timer'),blk('pl_checkpoint',{PART:G.pnamed('StartPad'+S)}),G.tp(ox,63,0),G.vchg(LG,1)),[['lap time',LT],['lap go',LG]]);
    const gh=G.part(p,'workspace',{name:'GhostRacer'+S,pos:[ox,-40,-2],size:[2,4,2],color:'#b388ff',material:'Neon',canCollide:false,transparency:.45,label:'👻 GHOST'});
    G.vars(G.script(p,gh.id,'Race',blk('ev_start'),G.forever(G.vset('vgl'+S,G.vget(LG)),G.until(G.cmp(G.vget(LG),'GT',G.vget('vgl'+S))),
      G.ifElse(G.cmp(G.vget(MOX),'EQ',G.num(ox)),[blk('p_setpos',{PART:bme(),X:bn(ox),Y:bn(62.6),Z:bn(-2)}),G.wait(.5),blk('p_glideto',{PART:bme(),X:bn(ox),Y:bn(fin.pos[1]+2.6),Z:bn(fin.pos[2]),S:bn(r3(Math.abs(fin.pos[2])/18.5))})],[blk('p_setpos',{PART:bme(),X:bn(ox),Y:bn(-40),Z:bn(-2)})]))),[['lap go',LG],['map x',MOX],['ghost lap'+S,'vgl'+S]]);
    // two more rivals race every lap: a fast rocket and a slow turtle
    [['RivalRocket','🚀 ROCKET','#ff7043',r3(Math.abs(fin.pos[2])/22),3],['RivalTurtle','🐢 TURTLE','#66bb6a',r3(Math.abs(fin.pos[2])/14),-3]].forEach(([rn,lab,col,sec,dx])=>{const rv=G.part(p,'workspace',{name:rn+S,pos:[ox+dx,-40,-2],size:[2,4,2],color:col,material:'Neon',canCollide:false,transparency:.4,label:lab});
      G.vars(G.script(p,rv.id,'Race',blk('ev_start'),G.forever(G.vset('vrl'+rn+S,G.vget(LG)),G.until(G.cmp(G.vget(LG),'GT',G.vget('vrl'+rn+S))),
        G.ifElse(G.cmp(G.vget(MOX),'EQ',G.num(ox)),[blk('p_setpos',{PART:bme(),X:bn(ox+dx),Y:bn(62.6),Z:bn(-2)}),G.wait(.5),blk('p_glideto',{PART:bme(),X:bn(ox+dx),Y:bn(fin.pos[1]+2.6),Z:bn(fin.pos[2]),S:bn(sec)})],[blk('p_setpos',{PART:bme(),X:bn(ox+dx),Y:bn(-40),Z:bn(-2)})]))),[['lap go',LG],['map x',MOX],['rival lap '+rn+S,'vrl'+rn+S]]);});});
  G.vars(G.script(p,'sss','Pick track',G.onMsg('round start'),G.vset(MOX,G.arith('MULTIPLY',G.rnd(0,2),G.num(300))),G.ifElse(G.cmp(G.vget(MOX),'EQ',G.num(0)),[blk('g_sky',null,{COLOUR:'#7fb8ff'}),blk('pl_checkpoint',{PART:G.pnamed('StartPad')}),G.tp(0,63,0)],
    [G.ifElse(G.cmp(G.vget(MOX),'EQ',G.num(300)),[blk('g_sky',null,{COLOUR:'#120b2e'}),G.msg('Track: NEON CITY',2),blk('pl_checkpoint',{PART:G.pnamed('StartPadB')}),G.tp(300,63,0)],[blk('g_sky',null,{COLOUR:'#a5d6a7'}),G.msg('Track: JUNGLE CANYON',2),blk('pl_checkpoint',{PART:G.pnamed('StartPadC')}),G.tp(600,63,0)])]),G.wait(.2),blk('g_reset_timer'),G.vchg(LG,1)),[...MV2,['lap go',LG]]);
  G.script(p,'sss','BestLap',blk('ev_data_loaded'),G.sset('Best Lap',G.dget('turbo_best_lap',0)));
  G.vars(G.script(p,'sss','Lap place',blk('ev_start'),G.forever(G.vset('vlc',G.stat('Laps')),G.until(G.cmp(G.stat('Laps'),'GT',G.vget('vlc'))),G.wait(.1),G.vset('vahead',G.num(0)),
    ...TRACKS.flatMap(TK=>['GhostRacer','RivalRocket','RivalTurtle'].map(rn=>G.iff(G.AND(G.cmp(G.vget(MOX),'EQ',G.num(TK.ox)),G.cmp({block:{type:'s_prop',fields:{PROP:'z'},inputs:{PART:G.pnamed(rn+TK.S)}}},'LTE',G.num(TK.fin.pos[2]+3))),G.vchg('vahead',1)))),
    G.ifElse(G.cmp(G.vget('vahead'),'EQ',G.num(0)),[G.sound('win'),G.msg('🏆 1st place this lap! You beat every racer! +3 coins',2.5),blk('pl_coins',{N:bn(3)})],
      [G.ifElse(G.cmp(G.vget('vahead'),'EQ',G.num(1)),[G.msg('🥈 2nd place this lap! +1 coin',2),blk('pl_coins',{N:bn(1)})],[G.msg(G.join('You finished this lap in place ',G.arith('ADD',G.vget('vahead'),G.num(1)),' of 4. Use the boost pads!'),2)])]))),[...MV2,['racers ahead','vahead']]);
  G.welcome(p,G.sset('Laps',0),G.msg('Most laps in 2:30 wins! Three tracks take turns. Race the ghost, the rocket and the turtle for 1st place every lap!',4));
  return G.def(p,'turbo','Turbo Track');}

/* 6. Sumo Smash: sumo bots only fill the ring when there are not enough players */
function arenaExtras(p){const G=GK;
  const BOX='vbbox',BV2=[['map x',BOX]];const ox=v=>G.arith('ADD',typeof v==='number'?G.num(v):v,G.vget(BOX));
  {const OX=300,M2=G.folder(p,'Moon Base').id;const Q=o=>G.part(p,M2,o);
    Q({name:'MoonDust',pos:[OX,-1,0],size:[160,2,160],color:'#9e9e9e',material:'Slate'});
    for(let i=0;i<9;i++){const x=((i*53)%120)-60,z=((i*97)%120)-60;Q({name:'Crater',shape:'cyl',pos:[OX+x,.1,z],size:[12,.3,12],color:'#757575',material:'Slate'});}
    [[0,-80,160,2],[0,80,160,2],[-80,0,2,160],[80,0,2,160]].forEach(([x,z,w,d])=>Q({name:'Dome',pos:[OX+x,6,z],size:[w,12,d],color:'#b3e5fc',material:'Glass',transparency:.6}));
    [[-30,-30],[30,30],[-30,30],[30,-30]].forEach(([x,z],i)=>{Q({name:'Module',shape:'cyl',pos:[OX+x,5,z],size:[12,10,12],color:'#eceff1',material:'Metal'});Q({name:'ModuleTop',pos:[OX+x,10.4,z],size:[8,.8,8],color:['#ef5350','#42a5f5','#66bb6a','#ffca28'][i],material:'Neon'});
      Q({name:'Ramp',shape:'wedge',pos:[OX+x,5,z+(z<0?11:-11)],size:[6,10,10],rot:[0,z<0?180:0,0],color:'#90a4ae',material:'Metal'});});
    Q({name:'Rocket',shape:'cyl',pos:[OX,12,0],size:[6,24,6],color:'#fafafa',material:'Metal'});Q({name:'RocketNose',shape:'ball',pos:[OX,24.5,0],size:[6,6,6],color:'#e53935',material:'Metal'});
    [[-12,14],[14,-12],[0,-40],[0,40]].forEach(([x,z])=>Q({name:'Cover',pos:[OX+x,2,z],size:[8,4,2],color:'#78909c',material:'Metal'}));}
  {const OX=600,C3=G.folder(p,'Castle Siege').id;const Q=o=>G.part(p,C3,o);
    Q({name:'Field',pos:[OX,-1,0],size:[160,2,160],color:'#689f38',material:'Grass'});
    [[0,-30,60,2],[0,30,60,2],[-30,0,2,60],[30,0,2,60]].forEach(([x,z2,w,d])=>{Q({name:'CastleWall',pos:[OX+x,4,z2],size:[w,8,d],color:'#9e9e9e',material:'Brick'});Q({name:'Walkway',pos:[OX+x*(1-2.2/30),8.3,z2*(1-2.2/30)],size:[w?w:4,.6,d?d:4].map((v,i)=>i===0&&!w?4:v),color:'#757575',material:'Brick'});});
    [[-30,-30],[30,-30],[30,30],[-30,30]].forEach(([x,z2])=>{Q({name:'Turret',shape:'cyl',pos:[OX+x,6,z2],size:[8,12,8],color:'#8d8d8d',material:'Brick'});Q({name:'TurretTop',shape:'cyl',pos:[OX+x,12.4,z2],size:[9,.8,9],color:'#616161',material:'Brick'});
      Q({name:'Ramp',shape:'wedge',pos:[OX+x+(x<0?9:-9),4,z2],size:[6,8,10],rot:[0,x<0?90:-90,0],color:'#8d6e63',material:'Wood'});});
    Q({name:'Gate',pos:[OX,4,30],size:[10,8,2.2],color:'#5d4037',material:'Wood',canCollide:false,transparency:.3});
    Q({name:'Keep',pos:[OX,6,0],size:[14,12,14],color:'#bdbdbd',material:'Brick'});Q({name:'KeepRamp',shape:'wedge',pos:[OX,6,13],size:[6,12,12],rot:[0,180,0],color:'#8d6e63',material:'Wood'});
    Q({name:'Moat',pos:[OX,.05,0],size:[80,.1,80],color:'#4fc3f7',material:'Glass',transparency:.5,canCollide:false});
    [[-55,-55],[55,55],[55,-55],[-55,55]].forEach(([x,z2])=>Q({name:'Haybale',pos:[OX+x,1.5,z2],size:[4,3,4],color:'#ffca28',material:'Grass'}));}
  G.vars(G.script(p,'sss','Pick map',G.onMsg('round start'),G.vset(BOX,G.arith('MULTIPLY',G.rnd(0,2),G.num(300))),blk('pl_gravity',{V:bn(196.2)}),
    G.ifElse(G.cmp(G.vget(BOX),'EQ',G.num(0)),[blk('g_sky',null,{COLOUR:'#8ec9ff'})],[G.ifElse(G.cmp(G.vget(BOX),'EQ',G.num(300)),[blk('pl_gravity',{V:bn(70)}),blk('g_sky',null,{COLOUR:'#0b0d1a'}),G.msg('Map: MOON BASE. Low gravity!',2.5)],[blk('g_sky',null,{COLOUR:'#b3e5fc'}),G.msg('Map: CASTLE SIEGE',2)])]),blk('pl_tpxyz',{X:ox(G.rnd(-20,20)),Y:bn(5),Z:G.rnd(-20,20)})),BV2);
  G.vars(G.script(p,'sss','Respawn on map',blk('ev_spawn'),G.wait(.05),G.iff(G.cmp(G.vget(BOX),'GT',G.num(0)),blk('pl_tpxyz',{X:ox(G.rnd(-50,50)),Y:bn(5),Z:G.rnd(-50,50)}))),BV2);
  G.script(p,'sss','Normal gravity',G.onMsg('round end'),blk('pl_gravity',{V:bn(196.2)}));
  gkFighterBots(p,{total:4,max:3,home:[[-60,-60],[60,60],[60,-60]],area:70,dmg:9,acc:4,ox:BOX});
  // bounty: one bot wears a golden crown and is worth 3 knockouts
  {const crown=G.part(p,'workspace',{name:'BountyCrown',shape:'cyl',pos:[0,-40,0],size:[2,1,2],color:'#ffd54f',material:'Neon',canCollide:false,unbreakable:true,label:'👑 BOUNTY'});
   G.vars(G.script(p,crown.id,'Follow',blk('ev_start'),G.forever(G.ifElse(G.AND(G.inMatch(),G.cmp(G.vget('vbounty'),'GT',G.num(0))),[...[1,2,3].map(k=>G.iff(G.cmp(G.vget('vbounty'),'EQ',G.num(k)),
     blk('p_setpos',{PART:bme(),X:G.prop(G.pnamed('Fighter'+k),'x'),Y:G.arith('ADD',G.prop(G.pnamed('Fighter'+k),'y'),G.num(3.6)),Z:G.prop(G.pnamed('Fighter'+k),'z')})))],[blk('p_setpos',{PART:bme(),X:bn(0),Y:bn(-40),Z:bn(0)})]),G.wait(0))),[['bounty','vbounty'],['fighter bots','vfbots'],...G.MV]);
   G.vars(G.hscript(p,'sss','Pick bounty',G.onMsg('round start'),G.vset('vbounty',G.num(0)),G.wait(6),G.whileDo(G.inMatch(),G.iff(G.AND(G.cmp(G.vget('vbounty'),'EQ',G.num(0)),G.cmp(G.vget('vfbots'),'GT',G.num(0))),
     G.vset('vbounty',G.rnd(1,G.vget('vfbots'))),G.bc('bounty')),G.wait(1))),[['bounty','vbounty'],['fighter bots','vfbots'],...G.MV]);
   G.vars(G.script(p,'sss','Bounty msg',G.onMsg('bounty'),G.sound('check'),G.msg(G.join('👑 BOUNTY! Knock out Fighter',G.vget('vbounty'),' for 3 knockouts!'),2.5)),[['bounty','vbounty']]);
   [1,2,3].forEach(k=>{const r=p.nodes.find(n=>n.name==='Fighter'+k);
     G.vars(G.script(p,r.id,'Bounty KO',blk('ev_rig_died'),G.iff(G.cmp(G.vget('vbounty'),'EQ',G.num(k)),G.sadd('KOs',2),G.sound('win'),G.msg('👑 BOUNTY CLAIMED! +2 extra knockouts',2.5))),[['bounty','vbounty']]);
     G.vars(G.hscript(p,r.id,'Bounty reset',blk('ev_rig_died'),G.iff(G.cmp(G.vget('vbounty'),'EQ',G.num(k)),G.wait(10),G.vset('vbounty',G.num(0)))),[['bounty','vbounty']]);});}
  // power-up orb in the middle every 20 seconds
  const orb=G.part(p,'workspace',{name:'PowerOrb',shape:'ball',pos:[0,-40,0],size:[2.4,2.4,2.4],color:'#ffd740',material:'Neon',canCollide:false,unbreakable:true,label:'POWER'});
  p.nodes.push(emitterNode({parent:orb.id,name:'Glow'},'sparkles'));
  G.vars(G.hscript(p,'sss','Power orb',G.onMsg('round start'),G.vset('vorb',G.num(0)),G.whileDo(G.inMatch(),G.wait(20),G.iff(G.inMatch(),G.vset('vorb',G.num(1)),blk('p_setpos',{PART:G.pnamed('PowerOrb'),X:ox(0),Y:bn(5),Z:bn(0)}),G.bc('orb')),
    G.until(G.OR(G.cmp(G.vget('vorb'),'EQ',G.num(0)),G.NOT(G.inMatch()))),blk('p_setpos',{PART:G.pnamed('PowerOrb'),X:bn(0),Y:bn(-40),Z:bn(0)}))),[['orb up','vorb'],...G.MV,...BV2]);
  G.script(p,'sss','Orb msg',G.onMsg('orb'),G.sound('check'),G.msg('A POWER ORB appeared in the middle!',2));
  G.vars(G.script(p,orb.id,'Grab',blk('ev_touch'),G.iff(G.cmp(G.vget('vorb'),'EQ',G.num(1)),G.shSet('vorb',G.num(0)),G.vset('vpw',G.rnd(1,4)),G.sound('win'),
    G.ifElse(G.cmp(G.vget('vpw'),'EQ',G.num(1)),[G.msg('SPEED BOOST for 10 seconds!',2),blk('pl_speed',{V:bn(26)}),G.wait(10),blk('pl_speed',{V:bn(16)})],
     [G.ifElse(G.cmp(G.vget('vpw'),'EQ',G.num(2)),[G.msg('SHIELD for 8 seconds!',2),blk('pl_shield',{S:bn(8)})],
      [G.ifElse(G.cmp(G.vget('vpw'),'EQ',G.num(3)),[G.msg('MEGA HEAL: 200 health!',2),blk('pl_maxhp',{N:bn(200)}),blk('pl_heal',{N:bn(200)})],
       [G.msg('ROCKET LAUNCHER! Press its number to use it.',2),blk('tool_take',null,{NAME:'Rocket Launcher'}),blk('tool_give',null,{NAME:'Rocket Launcher'})])])]))),[['orb up','vorb'],['power','vpw']]);
  gkGun(p,'rs','Rocket Launcher',{dmg:70,cool:1.2,color:'#ff5252',speed:150,len:1,tip:'From the power orb'});
  // tower-top sniper perches
  [[-30,-30],[30,30]].forEach(([x,z],i)=>{const sn=G.part(p,'workspace',{name:'SniperPickup'+i,pos:[x,8.8,z],size:[3,1,1],color:'#ea80fc',material:'Neon',canCollide:false,label:'SNIPER'});
    G.script(p,sn.id,'Take',blk('ev_touch'),blk('tool_take',null,{NAME:'Sniper'}),blk('tool_give',null,{NAME:'Sniper'}),G.sound('coin'),G.msg('Sniper! One shot does 100 damage.',2),blk('p_visible',{PART:bme()},{B:'FALSE'}),G.wait(25),blk('p_visible',{PART:bme()},{B:'TRUE'}));});
  gkGun(p,'rs','Sniper',{dmg:100,cool:1.6,color:'#ea80fc',speed:420,len:1.6,tip:'Tower perch sniper'});
  // knockout streaks
  G.vars(G.script(p,'sss','Streaks',G.onMsg('round start'),G.vset('vlast',G.num(0)),G.vset('vstreak',G.num(0)),G.whileDo(G.inMatch(),
    G.iff(G.cmp(G.stat('KOs'),'GT',G.vget('vlast')),G.vchg('vstreak',G.arith('MINUS',G.stat('KOs'),G.vget('vlast'))),G.vset('vlast',G.stat('KOs')),
      G.iff(G.cmp(G.vget('vstreak'),'EQ',G.num(3)),G.sound('win'),G.msg('🔥 3 KNOCKOUTS IN A ROW! On fire!',2)),G.iff(G.cmp(G.vget('vstreak'),'EQ',G.num(5)),G.sound('win'),G.msg('⚡ 5 STREAK! UNSTOPPABLE! +5 coins',2),blk('pl_coins',{N:bn(5)}))),G.wait(.3))),[['last kos','vlast'],['streak','vstreak'],...G.MV]);
  G.vars(G.script(p,'sss','Streak over',blk('ev_died'),G.vset('vstreak',G.num(0)),blk('pl_speed',{V:bn(16)}),blk('pl_maxhp',{N:bn(100)})),[['streak','vstreak']]);
  G.matchFlags(p);}
function sumoDef(){const G=GK;const p=G.proj('sumo','Sumo Smash',{sky:'#ffcf9f',deathStyle:'ragdoll',timer:false,saveStats:false,saveCheckpoint:false,lobby:true,lobbyWait:12,lobbyRound:90,lobbyScore:'Time',lobbyElim:true});G.noBase(p);G.spawnAt(p,0,30.5,0,{size:[8,1,8],color:'#ffffff'});
  const R=G.folder(p,'Ring');G.part(p,R.id,{name:'Ring',shape:'cyl',pos:[0,29,0],size:[38,2,38],color:'#f5e6c8',material:'Wood'});
  // the outer ring is made of tiles that fall away halfway through the match
  const OR=G.model(p,'OuterRing').id;for(let i=0;i<18;i++){const a=i/18*Math.PI*2;G.part(p,OR,{name:'OuterTile',pos:[r3(Math.cos(a)*24.5),29,r3(Math.sin(a)*24.5)],size:[11.5,2,9],rot:[0,r3(-a*180/Math.PI),0],color:i%2?'#f5e6c8':'#ead7b0',material:'Wood'});}
  G.part(p,R.id,{name:'Edge',shape:'cyl',pos:[0,28.9,0],size:[40,1.8,40],color:'#c62828',material:'Plastic'});
  const sw=G.part(p,'workspace',{name:'Sweeper',pos:[0,-30,0],size:[36,1.4,1.4],color:'#7e57c2',material:'Neon',canCollide:false,unbreakable:true});
  G.script(p,sw.id,'Spin',blk('ev_start'),G.forever(blk('p_rotate',{PART:bme(),DEG:bn(4)},{AXIS:'y'}),G.wait(.03)));
  G.script(p,sw.id,'Sweep',blk('ev_touch'),blk('pl_launch',{P:bn(40)}),blk('pl_knock',{WHO:bme(),P:bn(60)},{RAG:'TRUE'}),G.sound('pad'),G.wait(1));
  const MV=G.matchFlags(p);const SC='vsumos',ON=k=>'vsumo'+k;const SV=[['sumos',SC],...[1,2,3].map(k=>['sumo '+k+' on',ON(k)]),...MV];
  const START=[[-16,-16],[16,16],[16,-16]];
  // second arena: the Floating Dojo, 300 studs east. Smaller, with bouncy bumpers and a spinning floor
  const SOX='vsox';SV.push(['map x',SOX]);const ox=v=>G.arith('ADD',typeof v==='number'?G.num(v):v,G.vget(SOX));
  {const OX=300,D2=G.folder(p,'Floating Dojo').id;const Q=o=>G.part(p,D2,o);
    Q({name:'DojoFloor',pos:[OX,29,0],size:[44,2,44],color:'#d7ccc8',material:'Wood'});Q({name:'DojoTrim',pos:[OX,28.9,0],size:[46,1.8,46],color:'#b71c1c',material:'Wood'});
    [[-22,-22],[22,22],[22,-22],[-22,22]].forEach(([x,z2])=>{Q({name:'Pillar',pos:[OX+x,36,z2],size:[2,14,2],color:'#4e342e',material:'Wood'});});
    Q({name:'Roof',pos:[OX,43.5,0],size:[50,1,50],color:'#263238',material:'Wood',transparency:.4,canCollide:false});
    [[0,-14],[0,14],[-14,0],[14,0]].forEach(([x,z2])=>Q({name:'Bumper',shape:'cyl',pos:[OX+x,30.3,z2],size:[4,.6,4],color:'#ffeb3b',material:'Neon',behavior:'jump',value:70}));
    const disk=Q({name:'SpinDisk',shape:'cyl',pos:[OX,30.15,0],size:[10,.3,10],color:'#e53935',material:'Plastic'});
    const bar=Q({name:'DojoBar',pos:[OX,31.4,0],size:[40,1,1],color:'#ff9800',material:'Neon'});G.script(p,bar.id,'Spin',...SCR.spin(1.6).blocks.blocks);
    G.script(p,bar.id,'Hit',blk('ev_touch'),blk('pl_launch',{P:bn(30)}),blk('pl_knock',{WHO:bme(),P:bn(45)},{RAG:'TRUE'}),G.wait(1));}
    {const OX=600,L3=G.folder(p,'Lava Pit').id;const Q=o=>G.part(p,L3,o);
    Q({name:'LavaPool',pos:[OX,15,0],size:[120,1,120],color:'#ff3d00',material:'Neon',behavior:'kill'});
    Q({name:'PitRing',shape:'cyl',pos:[OX,29,0],size:[34,2,34],color:'#5d4037',material:'Slate'});
    for(let i=0;i<8;i++){const a=i/8*Math.PI*2;Q({name:'Stepping',shape:'cyl',pos:[OX+r3(Math.cos(a)*23),29,r3(Math.sin(a)*23)],size:[6,2,6],color:'#6d4c41',material:'Slate'});}
    [[0,-11],[0,11],[-11,0],[11,0]].forEach(([x,z2])=>Q({name:'Bumper',shape:'cyl',pos:[OX+x,30.3,z2],size:[4,.6,4],color:'#ffd600',material:'Neon',behavior:'jump',value:65}));
    const gy=Q({name:'Geyser',shape:'cyl',pos:[OX,10,0],size:[5,4,5],color:'#ff6d00',material:'Neon',behavior:'kill',canCollide:false});
    G.script(p,gy.id,'Erupt',blk('ev_start'),G.forever(G.wait(G.rnd(6,10)),blk('p_setpos',{PART:bme(),X:G.arith('ADD',G.num(OX),G.rnd(-12,12)),Y:bn(10),Z:G.rnd(-12,12)}),blk('p_glide',{PART:bme(),X:bn(0),Y:bn(21),Z:bn(0),S:bn(1.2)}),G.wait(1),blk('p_glide',{PART:bme(),X:bn(0),Y:bn(-21),Z:bn(0),S:bn(1)})));}
  G.vars(G.script(p,'sss','Pick arena',G.onMsg('round start'),G.vset(SOX,G.arith('MULTIPLY',G.rnd(0,2),G.num(300))),G.ifElse(G.cmp(G.vget(SOX),'EQ',G.num(0)),[blk('g_sky',null,{COLOUR:'#ffcf9f'})],[G.ifElse(G.cmp(G.vget(SOX),'EQ',G.num(300)),[blk('g_sky',null,{COLOUR:'#90a4ae'}),G.msg('Arena: FLOATING DOJO',2)],[blk('g_sky',null,{COLOUR:'#4a0e0e'}),G.msg('Arena: LAVA PIT',2)])]),
    blk('pl_tpxyz',{X:ox(G.rnd(-4,4)),Y:bn(32),Z:G.rnd(-4,4)})),[['map x',SOX]]);
  const mk=(name,parent,pos,spd,k)=>{const r=rigNode({name,parent,pos,scale:1.5,health:999,respawn:3,walkSpeed:spd,colors:{head:'#ffcc80',torso:'#ef5350',arms:'#ffcc80',legs:'#3949ab'}});p.nodes.push(r);
    G.vars(G.hscript(p,r.id,'Chase',blk('ev_start'),G.wait(3),G.forever(G.ifElse(k?G.cmp(G.vget(ON(k)),'EQ',G.num(1)):G.cmp(G.num(1),'EQ',G.num(1)),[G.walkN(bme()),G.wait(.3)],[G.wait(.5)]))),SV);
    if(k)G.vars(G.hscript(p,r.id,'Back to arena',blk('ev_rig_died'),G.wait(3.2),G.iff(G.cmp(G.vget(ON(k)),'EQ',G.num(1)),blk('p_setpos',{PART:bme(),X:ox(START[k-1][0]),Y:bn(32.6),Z:bn(START[k-1][1])}))),SV);
    G.script(p,r.id,'Shove',blk('ev_touch'),blk('pl_knock',{WHO:bme(),P:bn(70)},{RAG:'TRUE'}),G.sound('pad'),G.wait(1.2));};
  START.forEach(([x,z],i)=>mk('Sumo'+(i+1),'workspace',[x,32.6,z],8+i*2,i+1));mk('Extra Sumo','rs',[0,32.6,0],14,0);
  const bat={id:uid(),cls:'Tool',name:'Bonk Bat',parent:'pack',tooltip:'Bonk!',cooldown:.5,swing:true};const h=partNode({parent:bat.id,name:'Handle',pos:[0,3,0],size:[.4,.4,1.2],color:'#6d4c41',material:'Wood'});bat.handle=h.id;
  p.nodes.push(bat,h,partNode({parent:bat.id,name:'Head',shape:'cyl',pos:[0,3,-2],size:[2.6,.9,.9],rot:[0,90,0],color:'#ffb74d',material:'Wood'}));
  G.script(p,bat.id,'Hit',blk('ev_tool_hit'),G.iff({block:{type:'s_isrig',inputs:{PART:{block:{type:'tool_hitpart'},shadow:{type:'p_this'}}}}},blk('rig_fling',{PART:{block:{type:'tool_hitpart'},shadow:{type:'p_this'}},P:bn(90)}),G.sadd('Bonks',1),G.sound('pad')),
    G.iff({block:{type:'s_isplayer',inputs:{PART:{block:{type:'tool_hitpart'},shadow:{type:'p_this'}}}}},blk('pl_as',{WHO:{block:{type:'tool_hitpart'}},DO:doIn(blk('pl_knock',{WHO:{block:{type:'pl_ref',fields:{WHO:'sender'}}},P:bn(80)},{RAG:'TRUE'}))})));
  G.script(p,'player','Falls',blk('ev_died'),G.sadd('Falls',1));
  G.script(p,'sss','FellOff',blk('ev_died'),G.msg(G.join('You fell! You lasted ',G.stat('Time'),' seconds.'),3));
  /* host: 3 sumos minus one for every extra player (at least one sumo), more join over time */
  G.vars(G.hscript(p,'sss','Sumo bots',G.onMsg('round start'),G.vset(SC,G.num(0)),blk('controls_repeat_ext',{TIMES:bn(10),DO:doIn(blk('p_destroy',{PART:G.pnamed('Extra Sumo')}))}),
    ...[1,2,3].map(k=>G.ifElse(G.OR(G.cmp(G.num(k),'EQ',G.num(1)),G.cmp(G.arith('ADD',G.players(),G.num(k)),'LTE',G.num(4))),
      [G.vset(ON(k),G.num(1)),blk('p_setpos',{PART:G.pnamed('Sumo'+k),X:ox(START[k-1][0]),Y:bn(32.6),Z:bn(START[k-1][1])}),blk('p_visible',{PART:G.pnamed('Sumo'+k)},{B:'TRUE'}),G.vchg(SC,1)],
      [G.vset(ON(k),G.num(0)),blk('p_setpos',{PART:G.pnamed('Sumo'+k),X:bn(k*8),Y:bn(32.6),Z:bn(150)}),blk('p_visible',{PART:G.pnamed('Sumo'+k)},{B:'FALSE'})])),
    G.whileDo(G.inMatch(),G.wait(18),G.iff(G.AND(G.inMatch(),G.cmp(G.vget(SC),'LT',G.num(8))),blk('rs_copy',{X:ox(G.rnd(-15,15)),Y:bn(32.6),Z:G.rnd(-15,15)},{NAME:'Extra Sumo'}),G.vchg(SC,1),G.sound('pad'),G.msg('Another sumo joins the ring!',2)))),SV);
  G.vars(G.hscript(p,'sss','Ring events',G.onMsg('round start'),blk('p_collide',{PART:G.mnamed('OuterRing')},{B:'TRUE'}),blk('p_transp',{PART:G.mnamed('OuterRing')},{V:bn(0)}),
    blk('p_setpos',{PART:G.pnamed('Sweeper'),X:bn(0),Y:bn(-30),Z:bn(0)}),G.wait(40),G.iff(G.inMatch(),G.bc('ring shrink'),G.wait(3),blk('p_collide',{PART:G.mnamed('OuterRing')},{B:'FALSE'}),blk('p_transp',{PART:G.mnamed('OuterRing')},{V:bn(.85)})),
    G.wait(15),G.iff(G.inMatch(),G.bc('sweeper'),blk('p_setpos',{PART:G.pnamed('Sweeper'),X:bn(0),Y:bn(31.6),Z:bn(0)}))),SV);
  G.script(p,'sss','Shrink msg',G.onMsg('ring shrink'),G.sound('die'),G.msg('⚠ The outer ring is falling away in 3 seconds! Get to the middle!',3));
  G.script(p,'sss','Sweeper msg',G.onMsg('sweeper'),G.sound('check'),G.msg('The SWEEPER is spinning! Jump over it!',3));
  G.script(p,'sss','Survivor coins',G.onMsg('round end'),G.iff(G.aliveIn(),blk('pl_coins',{N:bn(10)}),G.sound('win'),G.msg('🏆 Still on the ring at the bell! +10 coins',3)));
  gkPowerups(p,[[-10,10],[10,-10],[290,10],[310,-10],[590,8],[610,-8]],{y:31.5});
  G.welcome(p,G.sset('Time',0),G.sset('Falls',0),G.sset('Bonks',0),G.msg('Last one on the ring wins! Bonk sumos and players off with your bat (1).',4),
    G.forever(G.wait(1),G.iff(G.AND(G.aliveIn(),G.AND({block:{type:'s_pl_alive'}},G.cmp(G.ppos('y'),'GT',G.num(25)))),G.sadd('Time',1))));
  G.vars(p.nodes.find(n=>n.name==='Welcome'),MV);
  G.best(p,'Time','sumo_time');
  G.hud(p,'Ring','#bf360c',G.join('🥋 Sumos on the ring: ',G.vget(SC),'   ·   ⏱ ',G.stat('Time'),'s'));
  return G.def(p,'sumo','Sumo Smash');}

/* 7. Color Drop */
function colorDropDef(){const G=GK;const p=G.proj('colordrop','Color Drop',{sky:'#1d2340',timer:false,saveStats:false,saveCheckpoint:false,lobby:true,lobbyWait:12,lobbyRound:120,lobbyScore:'Rounds',lobbyElim:true});G.noBase(p);G.spawnAt(p,0,40.5,-34,{size:[10,1,10],color:'#ffffff'});
  const names=['Red','Blue','Green','Yellow'],cols=['#ef5350','#42a5f5','#66bb6a','#ffee58'];const M=names.map(n=>G.model(p,n));
  for(let i=0;i<8;i++)for(let j=0;j<8;j++){const k=(i*3+j*5+((i*j)%3))%4;G.part(p,M[k].id,{name:names[k]+'Tile',pos:[(i-3.5)*6,40,(j-3.5)*6],size:[5.8,1,5.8],color:cols[k],material:'Neon'});}
  G.part(p,'workspace',{name:'Bridge',pos:[0,40,-27],size:[6,1,6],color:'#ffffff'});
  // second arena: the Color Wheel, 300 studs east. Same colors, arranged in rings and slices
  [4.5,10.5,16.5,22.5].forEach((rad,r)=>{const n=Math.round(2*Math.PI*rad/6.2);for(let i=0;i<n;i++){const a=(i+.5*r)/n*Math.PI*2,k=(i+r)%4;
    G.part(p,M[k].id,{name:names[k]+'Tile',pos:[r3(300+Math.cos(a)*rad),40,r3(Math.sin(a)*rad)],size:[5.6,1,5.6],color:cols[k],material:'Neon'});}});
  G.part(p,'workspace',{name:'Hub',shape:'cyl',pos:[300,40.6,0],size:[3,.4,3],color:'#ffffff',material:'Metal'});
  const COX='vcox';const ox=v=>G.arith('ADD',typeof v==='number'?G.num(v):v,G.vget(COX));
    for(let i=0;i<10;i++)for(let j=0;j<6;j++){const k=Math.floor(i/2+j/3)%4;G.part(p,M[k].id,{name:names[k]+'Tile',pos:[600+(i-4.5)*5,40,(j-2.5)*6],size:[4.8,1,5.8],color:cols[k],material:'Neon'});}
  G.vars(G.script(p,'sss','Pick arena',G.onMsg('round start'),G.vset(COX,G.arith('MULTIPLY',G.rnd(0,2),G.num(300))),G.ifElse(G.cmp(G.vget(COX),'EQ',G.num(0)),[blk('g_sky',null,{COLOUR:'#1d2340'})],[G.ifElse(G.cmp(G.vget(COX),'EQ',G.num(300)),[blk('g_sky',null,{COLOUR:'#3a1d40'}),G.msg('Arena: COLOR WHEEL',2)],[blk('g_sky',null,{COLOUR:'#0d2a1d'}),G.msg('Arena: STRIPES',2)])]),
    G.iff(G.cmp(G.vget(COX),'GT',G.num(0)),blk('pl_tpxyz',{X:ox(G.rnd(-12,12)),Y:bn(43),Z:G.rnd(-4,12)}))),[['map x',COX]]);
  const V='vpick';const say=k=>G.msg('Stand on '+names[k].toUpperCase()+'!',2.5);
  const branch=k=>G.iff(G.cmp(G.vget(V),'EQ',G.num(k+1)),G.iff(G.AND(G.cmp(G.vget('vcr'),'GTE',G.num(4)),G.cmp(G.rnd(1,4),'EQ',G.num(1))),G.msg('Stand on '+names[(k+1)%4].toUpperCase()+'!',1),G.wait(1),G.sound('click'),G.msg('...NO WAIT!',.7),G.wait(.7)),G.ifElse(G.AND(G.cmp(G.vget('vcr'),'GTE',G.num(6)),G.cmp(G.rnd(1,3),'EQ',G.num(1))),
    [G.msg('🚫 AVOID '+names[k].toUpperCase()+'! Stand on any other color!',2.5),G.ifElse(G.cmp(G.vget('vcr'),'LT',G.num(10)),[G.wait(G.arith('MINUS',G.num(3),G.arith('MULTIPLY',G.vget('vcr'),G.num(.18))))],[G.wait(1.4)]),
      blk('p_collide',{PART:G.mnamed(names[k])},{B:'FALSE'}),blk('p_transp',{PART:G.mnamed(names[k]),V:bn(.9)})],
    [say(k),G.ifElse(G.cmp(G.vget('vcr'),'LT',G.num(10)),[G.wait(G.arith('MINUS',G.num(3),G.arith('MULTIPLY',G.vget('vcr'),G.num(.18))))],[G.wait(1.2)]),...names.flatMap((nm,o)=>o===k?[]:[blk('p_collide',{PART:G.mnamed(nm)},{B:'FALSE'}),blk('p_transp',{PART:G.mnamed(nm),V:bn(.9)})])]));
  const restore=()=>names.flatMap(nm=>[blk('p_collide',{PART:G.mnamed(nm)},{B:'TRUE'}),blk('p_transp',{PART:G.mnamed(nm),V:bn(0)})]);
  const MV=G.matchFlags(p);
  const s=G.script(p,'sss','Rounds',chain(G.onMsg('round start'),G.vset('vcr',G.num(0)),...restore(),G.msg('Get onto the tiles! When a color is called, stand on it. Last one standing wins!',3),G.wait(5),
    G.whileDo(G.inMatch(),G.vset(V,G.rnd(1,4)),G.sound('click'),branch(0),branch(1),branch(2),branch(3),G.sound('explode'),G.wait(2),...restore(),G.vchg('vcr',1),
      G.iff(G.AND(G.aliveIn(),G.AND(G.cmp(G.ppos('y'),'GT',G.num(38)),G.OR(G.cmp(G.ppos('z'),'GT',G.num(-24)),G.cmp(G.ppos('x'),'GT',G.num(150))))),G.sadd('Rounds',1),G.sound('check')),
      G.wait(2)),...restore()));
  s.blocks.variables=[{name:'pick',id:V},{name:'color rounds',id:'vcr'},{name:'map x',id:COX},...MV.map(([name,id])=>({name,id}))];
  G.script(p,'sss','Fell',blk('ev_died'),G.msg(G.join('You fell! Rounds survived: ',G.stat('Rounds')),3));
  G.best(p,'Rounds','colordrop_rounds');
  const sw=G.part(p,'workspace',{name:'TileSweeper',pos:[0,-40,0],size:[50,1.2,1.2],color:'#e040fb',material:'Neon',canCollide:false,unbreakable:true});
  G.script(p,sw.id,'Spin',blk('ev_start'),G.forever(blk('p_rotate',{PART:bme(),DEG:bn(3)},{AXIS:'y'}),G.wait(.03)));
  G.script(p,sw.id,'Hit',blk('ev_touch'),blk('pl_launch',{P:bn(35)}),blk('pl_knock',{WHO:bme(),P:bn(50)},{RAG:'TRUE'}),G.wait(1));
  G.vars(G.script(p,'sss','Sweeper',G.onMsg('round start'),blk('p_setpos',{PART:G.pnamed('TileSweeper'),X:bn(0),Y:bn(-40),Z:bn(0)}),G.until(G.OR(G.cmp(G.vget('vcr'),'GTE',G.num(7)),G.NOT(G.inMatch()))),
    G.iff(G.inMatch(),G.msg('Round 7: the SWEEPER joins in! Jump over it.',3),blk('p_setpos',{PART:G.pnamed('TileSweeper'),X:ox(0),Y:bn(41.6),Z:bn(0)}))),[['color rounds','vcr'],['map x',COX],...MV]);
  G.script(p,'sss','Winner coins',G.onMsg('round end'),G.iff(G.aliveIn(),blk('pl_coins',{N:bn(5)})));
  // rival bots: they hop to a tile before every drop. The longer the match goes, the more of them slip off
  const NBC='vcbots',CBL='vcbleft',CO=k=>'vcbout'+k,CBV=[['bots',NBC],['bots left',CBL],['color rounds','vcr'],['map x',COX],...[1,2,3,4].map(k=>['bot out '+k,CO(k)]),...MV];
  const CBC=['#ff7043','#26c6da','#ab47bc','#9ccc65'];
  for(let k=1;k<=4;k++){const r=rigNode({name:'Bot'+k,pos:[k*6,2.6,-200],health:999,respawn:0,walkSpeed:15,colors:{head:'#ffcc80',torso:CBC[k-1],arms:'#ffcc80',legs:'#37474f'}});p.nodes.push(r);
    G.vars(G.hscript(p,r.id,'Hop',blk('ev_start'),G.forever(G.ifElse(G.AND(G.inMatch(),G.AND(G.cmp(G.num(k),'LTE',G.vget(NBC)),G.cmp(G.vget(CO(k)),'EQ',G.num(0)))),
      [blk('rig_walk',{PART:bme(),X:ox(G.rnd(-16,16)),Z:G.rnd(-16,16)}),G.wait(G.arith('DIVIDE',G.rnd(8,22),G.num(10)))],[G.wait(.5)]))),CBV);}
  G.vars(G.hscript(p,'sss','Bots join',G.onMsg('round start'),G.ifElse(G.cmp(G.players(),'GTE',G.num(5)),[G.vset(NBC,G.num(0))],[G.vset(NBC,G.arith('MINUS',G.num(5),G.players()))]),G.vset(CBL,G.vget(NBC)),
    ...[1,2,3,4].map(k=>G.ifElse(G.cmp(G.num(k),'LTE',G.vget(NBC)),[G.vset(CO(k),G.num(0)),blk('p_visible',{PART:G.pnamed('Bot'+k)},{B:'TRUE'}),blk('p_setpos',{PART:G.pnamed('Bot'+k),X:ox(k*6-15),Y:bn(42.6),Z:bn(-8)})],
      [G.vset(CO(k),G.num(1)),blk('p_visible',{PART:G.pnamed('Bot'+k)},{B:'FALSE'}),blk('p_setpos',{PART:G.pnamed('Bot'+k),X:bn(k*6),Y:bn(2.6),Z:bn(-200)})])),
    G.wait(5),G.vset('vcrseen',G.num(0)),G.whileDo(G.inMatch(),G.until(G.OR(G.cmp(G.vget('vcr'),'GT',G.vget('vcrseen')),G.NOT(G.inMatch()))),G.vset('vcrseen',G.vget('vcr')),
      ...[1,2,3,4].map(k=>G.iff(G.AND(G.inMatch(),G.AND(G.cmp(G.vget(CO(k)),'EQ',G.num(0)),G.cmp(G.rnd(1,100),'LTE',G.arith('ADD',G.num(6),G.arith('MULTIPLY',G.vget('vcr'),G.num(4)))))),
        G.vset(CO(k),G.num(1)),G.vchg(CBL,-1),blk('rig_fling',{PART:G.pnamed('Bot'+k),P:bn(40)}),G.msg(G.join('Bot'+k+' slipped off! ',G.vget(CBL),' bots left.'),2),
        G.wait(1.5),blk('p_visible',{PART:G.pnamed('Bot'+k)},{B:'FALSE'}),blk('p_setpos',{PART:G.pnamed('Bot'+k),X:bn(k*6),Y:bn(2.6),Z:bn(-200)}))),
      G.iff(G.AND(G.cmp(G.vget(NBC),'GT',G.num(0)),G.cmp(G.vget(CBL),'EQ',G.num(0))),G.vset(NBC,G.num(0)),G.bc('bots beaten')))),[...CBV,['rounds seen','vcrseen']]);
  G.script(p,'sss','Beat the bots',G.onMsg('bots beaten'),G.iff(G.aliveIn(),G.sound('win'),blk('g_callout',{TEXT:G.txt('LAST ONE STANDING!')}),G.sadd('Rounds',2),G.msg('🏆 You outlasted every bot! +10 coins. Keep going for a high score!',3.5),blk('pl_coins',{N:bn(10)})));
  G.vars(G.script(p,'sss','Bots home',G.onMsg('round end'),...[1,2,3,4].map(k=>blk('p_setpos',{PART:G.pnamed('Bot'+k),X:bn(k*6),Y:bn(2.6),Z:bn(-200)}))),[]);
  G.welcome(p,G.msg('Rounds get faster the longer you survive! Outlast the bots.',2));
  return G.def(p,'colordrop','Color Drop');}

/* 8. Maze Escape */
function mazeDef(){const G=GK;const p=G.proj('maze','Maze Escape',{sky:'#b9c7d9',saveStats:false,saveCheckpoint:false});
  const bp=p.nodes.find(n=>n.name==='Baseplate');Object.assign(bp,{size:[130,2,130],color:'#a1887f',material:'Slate'});
  const Mz=G.folder(p,'Maze');const n=12,S=9,o=-n*S/2;
  let seed=12345;const rr=()=>{seed=(seed*16807)%2147483647;return seed/2147483647;};
  const vis=Array.from({length:n},()=>Array(n).fill(false));const right=Array.from({length:n},()=>Array(n).fill(true)),down=Array.from({length:n},()=>Array(n).fill(true));
  const st=[[0,0]];vis[0][0]=true;
  while(st.length){const [x,y]=st[st.length-1];const nb=[[1,0],[-1,0],[0,1],[0,-1]].map(([dx,dy])=>[x+dx,y+dy,dx,dy]).filter(([a,b])=>a>=0&&b>=0&&a<n&&b<n&&!vis[a][b]);
    if(!nb.length){st.pop();continue;}const [a,b,dx,dy]=nb[Math.floor(rr()*nb.length)];
    if(dx===1)right[x][y]=false;if(dx===-1)right[a][b]=false;if(dy===1)down[x][y]=false;if(dy===-1)down[a][b]=false;vis[a][b]=true;st.push([a,b]);}
  const wall=(x,z,w,d)=>G.part(p,Mz.id,{name:'Wall',pos:[r3(x),4,r3(z)],size:[w,8,d],color:'#e0e0e0',material:'Brick'});
  wall(0,o,n*S+1,1);wall(0,-o,n*S+1,1);wall(o,0,1,n*S+1);wall(-o,0,1,n*S+1);
  // shifting walls: every half minute some walls sink into the floor and some gates rise up, changing the maze
  let wi=0,gi=0;const SH=G.model(p,'ShiftWalls').id,GT=G.model(p,'ShiftGates').id;
  for(let x=0;x<n;x++)for(let y=0;y<n;y++){
    if(x<n-1){if(right[x][y]){if(rr()<.09&&wi<10){wi++;G.part(p,SH,{name:'ShiftWall',pos:[r3(o+(x+1)*S),4,r3(o+y*S+S/2)],size:[1,8,S+1],color:'#b39ddb',material:'Brick'});}else wall(o+(x+1)*S,o+y*S+S/2,1,S+1);}
      else if(rr()<.08&&gi<8){gi++;G.part(p,GT,{name:'ShiftGate',pos:[r3(o+(x+1)*S),-4.2,r3(o+y*S+S/2)],size:[1,8,S+1],color:'#9575cd',material:'Brick'});}}
    if(y<n-1){if(down[x][y])wall(o+x*S+S/2,o+(y+1)*S,S+1,1);}}
  G.script(p,'sss','Shift',blk('ev_start'),G.forever(G.wait(28),G.sound('explode'),G.msg('🧱 The walls are shifting!',2),
    blk('p_glide',{PART:G.mnamed('ShiftWalls'),X:bn(0),Y:bn(-8.2),Z:bn(0),S:bn(1.2)}),blk('p_glide',{PART:G.mnamed('ShiftGates'),X:bn(0),Y:bn(8.2),Z:bn(0),S:bn(1.2)}),
    G.wait(28),G.sound('explode'),G.msg('🧱 The walls are shifting back!',2),
    blk('p_glide',{PART:G.mnamed('ShiftGates'),X:bn(0),Y:bn(-8.2),Z:bn(0),S:bn(1.2)}),blk('p_glide',{PART:G.mnamed('ShiftWalls'),X:bn(0),Y:bn(8.2),Z:bn(0),S:bn(1.2)})));
  // second maze: the Hedge Maze, 300 studs east (a new layout every time you escape, the two mazes take turns)
  {const MX=300,H=G.folder(p,'HedgeMaze').id;let sd=777;const r2=()=>{sd=(sd*16807)%2147483647;return sd/2147483647;};
    const vis2=Array.from({length:n},()=>Array(n).fill(false)),R2=Array.from({length:n},()=>Array(n).fill(true)),D2=Array.from({length:n},()=>Array(n).fill(true));const st2=[[0,0]];vis2[0][0]=true;
    while(st2.length){const [x,y]=st2[st2.length-1];const nb=[[1,0],[-1,0],[0,1],[0,-1]].map(([dx,dy])=>[x+dx,y+dy,dx,dy]).filter(([a,b])=>a>=0&&b>=0&&a<n&&b<n&&!vis2[a][b]);
      if(!nb.length){st2.pop();continue;}const [a,b,dx,dy]=nb[Math.floor(r2()*nb.length)];if(dx===1)R2[x][y]=false;if(dx===-1)R2[a][b]=false;if(dy===1)D2[x][y]=false;if(dy===-1)D2[a][b]=false;vis2[a][b]=true;st2.push([a,b]);}
    const hw=(x,z,w,d)=>G.part(p,H,{name:'Hedge',pos:[r3(MX+x),4,r3(z)],size:[w,8,d],color:'#2e7d32',material:'Grass'});
    G.part(p,H,{name:'Lawn',pos:[MX,-1,0],size:[130,2,130],color:'#7cb342',material:'Grass'});
    hw(0,o,n*S+1,1);hw(0,-o,n*S+1,1);hw(o,0,1,n*S+1);hw(-o,0,1,n*S+1);
    for(let x=0;x<n;x++)for(let y=0;y<n;y++){if(x<n-1&&R2[x][y])hw(o+(x+1)*S,o+y*S+S/2,1,S+1);if(y<n-1&&D2[x][y])hw(o+x*S+S/2,o+(y+1)*S,S+1,1);}
    for(let i=0;i<8;i++){const cx=Math.floor(r2()*n),cy=Math.floor(r2()*n);G.part(p,H,{name:'Coin',pos:[MX+o+cx*S+S/2,2,o+cy*S+S/2],size:[2,2,2],behavior:'coin',color:'#ffd54f'});}
    [[3,4],[8,2],[5,9]].forEach(([cx,cy])=>G.part(p,H,{name:'Fountain',shape:'cyl',pos:[r3(MX+o+cx*S+S/2),.8,r3(o+cy*S+S/2)],size:[4,1.6,4],color:'#90caf9',material:'Glass',transparency:.3,canCollide:false}));}
  G.spawnAt(p,o+S/2,.5,o+S/2,{size:[6,1,6]});
  const ex=G.part(p,'workspace',{name:'Exit',pos:[-o-S/2,.5,-o-S/2],size:[6,1,6],color:'#ffc93c',material:'Neon',canCollide:false});
  const C=[[o+S/2,o+S/2],[-o-S/2,o+S/2],[-o-S/2,-o-S/2],[o+S/2,-o-S/2]],CV='vcorner',ET='vesc';
  G.vars(G.script(p,ex.id,'Escape',blk('ev_touch'),G.sadd('Escapes',1),G.vset(ET,{block:{type:'s_timer'}}),G.sound('win'),G.msg(G.join('Escaped in ',G.vget(ET),' s! The exit moved to another corner...'),3),
    G.iff(G.OR(G.cmp(G.stat('Best Time'),'EQ',G.num(0)),G.cmp(G.vget(ET),'LT',G.stat('Best Time'))),G.sset('Best Time',G.vget(ET)),G.dset('maze_best',G.vget(ET))),
    G.vchg(CV,1),G.iff(G.cmp(G.vget(CV),'GT',G.num(4)),G.vset(CV,G.num(1))),G.vset('vmz',G.arith('MINUS',G.num(300),G.vget('vmz'))),
    ...C.map(([x,z],k)=>G.iff(G.cmp(G.vget(CV),'EQ',G.num(k+1)),blk('p_setpos',{PART:bme(),X:G.arith('ADD',G.num(r3(x)),G.vget('vmz')),Y:bn(.5),Z:bn(r3(z))}),
      blk('pl_tpxyz',{X:G.arith('ADD',G.num(r3(C[(k+2)%4][0])),G.vget('vmz')),Y:bn(3),Z:bn(r3(C[(k+2)%4][1]))}))),
    blk('p_setpos',{PART:G.pnamed('Minotaur'),X:G.vget('vmz'),Y:bn(3),Z:bn(0)}),G.ifElse(G.cmp(G.vget('vmz'),'EQ',G.num(300)),[G.msg('🌿 Next: the HEDGE MAZE!',2)],[G.msg('🧱 Next: the STONE MAZE!',2)]),blk('g_reset_timer')),[['corner',CV],['escape time',ET],['maze x','vmz']]);
  G.vars(G.script(p,ex.id,'Start',blk('ev_start'),G.vset(CV,G.num(3)),G.vset('vmz',G.num(0))),[['corner',CV],['maze x','vmz']]);
  G.vars(G.script(p,'sss','Respawn in maze',blk('ev_spawn'),G.wait(.05),G.iff(G.cmp(G.vget('vmz'),'EQ',G.num(300)),
    ...C.map((c,k)=>G.iff(G.cmp(G.vget(CV),'EQ',G.num(k+1)),blk('pl_tpxyz',{X:bn(r3(C[(k+2)%4][0]+300)),Y:bn(3),Z:bn(r3(C[(k+2)%4][1]))}))))),[['corner',CV],['maze x','vmz']]);
  G.script(p,'sss','BestTime',blk('ev_data_loaded'),G.sset('Best Time',G.dget('maze_best',0)));
  for(let i=0;i<10;i++){const cx=Math.floor(rr()*n),cy=Math.floor(rr()*n);G.part(p,Mz.id,{name:'Coin',pos:[o+cx*S+S/2,2,o+cy*S+S/2],size:[2,2,2],behavior:'coin',color:'#ffd54f'});}
  const tr=G.part(p,Mz.id,{name:'Trap',pos:[o+6*S+S/2,1.4,o+6*S+S/2],size:[8,1,1],color:'#ff3b30',material:'Neon',behavior:'kill'});G.script(p,tr.id,'Spin',...SCR.spin(3).blocks.blocks);
  // the Minotaur roams the maze. It cannot walk through walls, but it can smell you
  const mn=rigNode({name:'Minotaur',pos:[-4.5,3,-4.5],scale:1.25,health:9999,respawn:0,walkSpeed:11,colors:{head:'#5d4037',torso:'#3e2723',arms:'#5d4037',legs:'#212121'}});p.nodes.push(mn);
  G.hscript(p,mn.id,'Roam',blk('ev_start'),G.wait(8),G.forever(G.ifElse(G.cmp(G.nearD(bme()),'LT',G.num(16)),[G.walkN(bme()),G.wait(.25)],
    [G.ifElse(G.cmp(G.rnd(1,2),'EQ',G.num(1)),[blk('rig_walk',{PART:bme(),X:G.arith('ADD',G.prop(bme(),'x'),G.rnd(-18,18)),Z:G.prop(bme(),'z')})],[blk('rig_walk',{PART:bme(),X:G.prop(bme(),'x'),Z:G.arith('ADD',G.prop(bme(),'z'),G.rnd(-18,18))})]),G.wait(.4)])));
  G.hscript(p,mn.id,'Roar',blk('ev_start'),G.forever(G.wait(G.rnd(6,12)),G.iff(G.cmp(G.nearD(bme()),'LT',G.num(20)),blk('rig_say',{PART:bme(),TEXT:bt('GRRRR!'),S:bn(1)}))));
  G.script(p,mn.id,'Catch',blk('ev_touch'),G.sound('die'),G.msg('The Minotaur caught you! Back to the start...',2.5),blk('pl_respawn'),G.wait(2));
  // treasure chests in dead ends
  for(let k=0;k<3;k++){const cx=Math.floor(rr()*n),cy=Math.floor(rr()*n);const tc=G.part(p,Mz.id,{name:'Chest'+k,pos:[r3(o+cx*S+S/2),1,r3(o+cy*S+S/2)],size:[2.6,2,1.8],color:'#ffb300',material:'Wood',label:'💰'});
    G.script(p,tc.id,'Open',blk('ev_touch'),blk('p_visible',{PART:bme()},{B:'FALSE'}),blk('p_setpos',{PART:bme(),X:bn(0),Y:bn(-50),Z:bn(0)}),G.sadd('Coins',5),G.sound('win'),G.msg('Treasure chest! +5 coins',2),blk('pl_coins',{N:bn(3)}));}
  // after 3 escapes the lights go out
  G.script(p,'sss','Darkness',blk('ev_start'),G.until(G.cmp(G.stat('Escapes'),'GTE',G.num(3))),blk('g_sky',null,{COLOUR:'#1a1f2b'}),G.msg('The lights go out... the Minotaur gets faster in the dark!',3),blk('rig_speed',{PART:G.pnamed('Minotaur'),N:bn(14)}));
  G.welcome(p,G.sset('Coins',0),G.sset('Escapes',0),G.msg('Find the glowing exit, but watch out for the Minotaur! The exit moves to a new corner each time you escape.',5));
  G.hud(p,'ExitDistance','#6d4c41',G.join('🚪 Exit is ',G.round({block:{type:'s_distance',inputs:{PART:G.pnamed('Exit')}}}),' studs away'));
  for(let k=0;k<3;k++){const sp=G.part(p,'workspace',{name:'SpeedBoot',pos:[r3(o+(2+k*4)*S+S/2),1.2,r3(o+(9-k*3)*S+S/2)],size:[2,1,2],color:'#ffd400',material:'Neon',canCollide:false,label:'SPEED'});
    G.script(p,sp.id,'Boost',blk('ev_touch'),blk('pl_speed',{V:bn(26)}),G.sound('boost'),G.msg('Speed boots! 6 seconds',1.5),blk('p_visible',{PART:bme()},{B:'FALSE'}),G.wait(6),blk('pl_speed',{V:bn(16)}),G.wait(14),blk('p_visible',{PART:bme()},{B:'TRUE'}));}
  return G.def(p,'maze','Maze Escape');}

/* 9. Target Range */
function targetsDef(){const G=GK;const p=G.proj('targets','Target Range',{sky:'#cfe8ff',saveStats:false,saveCheckpoint:false,timer:false,lobby:true,lobbyWait:10,lobbyRound:60,lobbyScore:'Score'});
  const bp=p.nodes.find(n=>n.name==='Baseplate');Object.assign(bp,{size:[120,2,160],color:'#9ccc65',material:'Grass'});
  const R=G.folder(p,'Range');G.part(p,R.id,{name:'Booth',pos:[0,.5,8],size:[30,1,10],color:'#8d6e63',material:'Wood'});
  G.part(p,R.id,{name:'Counter',pos:[0,2,3],size:[30,3,1],color:'#6d4c41',material:'Wood'});G.part(p,R.id,{name:'Backstop',pos:[0,10,-90],size:[120,20,2],color:'#78909c',material:'Concrete'});
  const ns=G.prefab(p,'Blaster');ns[0].parent='pack';
  const hp={block:{type:'tool_hitpart'},shadow:{type:'p_this'}};
  G.script(p,ns[0].id,'TargetHit',blk('ev_tool_hit'),G.iff(G.cmp({block:{type:'s_partname',inputs:{PART:hp}}},'EQ',{block:{type:'text',fields:{TEXT:'Target'}}}),
    G.sadd('Score',1),G.sound('coin'),blk('pe_emit',{N:bn(25),PART:hp}),blk('p_setpos',{PART:hp,X:G.rnd(-40,40),Y:G.rnd(3,14),Z:G.rnd(-80,-25)}),
    G.ifElse(G.cmp(G.arith('MINUS',{block:{type:'s_timer'}},G.vget('vlasthit')),'LT',G.num(1.8)),[G.vchg('vcombo',1)],[G.vset('vcombo',G.num(1))]),G.vset('vlasthit',{block:{type:'s_timer'}}),
    G.iff(G.AND(G.cmp(G.vget('vcombo'),'GTE',G.num(3)),G.cmp(G.arith('MINUS',G.vget('vcombo'),G.arith('MULTIPLY',{block:{type:'math_round',fields:{OP:'ROUNDDOWN'},inputs:{NUM:G.arith('DIVIDE',G.vget('vcombo'),G.num(3))}}},G.num(3))),'EQ',G.num(0))),
      G.sadd('Score',2),G.sound('check'),G.msg(G.join('🔥 COMBO x',G.vget('vcombo'),'! +2 bonus'),1))),
    G.iff(G.cmp({block:{type:'s_partname',inputs:{PART:hp}}},'EQ',{block:{type:'text',fields:{TEXT:'GoldTarget'}}}),G.sadd('Score',3),G.sound('win'),G.msg('Golden target! +3',1),blk('pe_emit',{N:bn(40),PART:hp}),blk('p_setpos',{PART:hp,X:G.rnd(-40,40),Y:G.rnd(6,16),Z:G.rnd(-85,-45)})),
    G.iff(G.cmp({block:{type:'s_partname',inputs:{PART:hp}}},'EQ',{block:{type:'text',fields:{TEXT:'Balloon'}}}),G.sadd('Score',2),G.sound('pad'),blk('pe_emit',{N:bn(20),PART:hp}),blk('p_setpos',{PART:hp,X:G.rnd(-40,40),Y:bn(-6),Z:G.rnd(-70,-30)})),
    G.iff(G.cmp({block:{type:'s_partname',inputs:{PART:hp}}},'EQ',{block:{type:'text',fields:{TEXT:'BombTarget'}}}),G.sadd('Score',-3),G.sound('explode'),G.msg('BOMB! -3. Do not shoot the black targets!',1.5),blk('p_setpos',{PART:hp,X:G.rnd(-40,40),Y:G.rnd(3,14),Z:G.rnd(-80,-30)})),
    G.iff(G.cmp({block:{type:'s_partname',inputs:{PART:hp}}},'EQ',{block:{type:'text',fields:{TEXT:'UFO'}}}),G.sadd('Score',5),G.sound('win'),G.msg('UFO DOWN! +5',1.5),blk('pe_emit',{N:bn(50),PART:hp}),blk('p_setpos',{PART:hp,X:bn(-90),Y:bn(-30),Z:bn(-70)})),
    G.iff(G.cmp({block:{type:'s_partname',inputs:{PART:hp}}},'EQ',{block:{type:'text',fields:{TEXT:'Clock'}}}),G.sadd('Score',1),G.sound('win'),G.msg('FRENZY! Every target is worth double for 8 seconds',2),G.vset('vfrenzy',G.num(1)),blk('p_setpos',{PART:hp,X:bn(0),Y:bn(-30),Z:bn(-60)}),G.wait(8),G.vset('vfrenzy',G.num(0))),
    G.iff(G.AND(G.cmp(G.vget('vfrenzy'),'EQ',G.num(1)),G.cmp({block:{type:'s_partname',inputs:{PART:hp}}},'EQ',{block:{type:'text',fields:{TEXT:'Target'}}})),G.sadd('Score',1)));
  const gt=G.part(p,R.id,{name:'GoldTarget',shape:'cyl',pos:[0,10,-60],size:[.6,2.6,2.6],rot:[90,0,0],color:'#ffca28',material:'Neon',label:'+3'});
  p.nodes.push(emitterNode({parent:gt.id,name:'Shine',rate:6},'sparkles'));
  G.script(p,gt.id,'Zoom',blk('ev_start'),G.forever(blk('p_glide',{PART:bme(),X:bn(18),Y:bn(3),Z:bn(0),S:bn(.9)}),blk('p_glide',{PART:bme(),X:bn(-36),Y:bn(-3),Z:bn(0),S:bn(1.6)}),blk('p_glide',{PART:bme(),X:bn(18),Y:bn(0),Z:bn(0),S:bn(.9)})));
  for(let i=0;i<6;i++){const t=G.part(p,R.id,{name:'Target',shape:'cyl',pos:[-30+i*12,4+(i%3)*4,-30-(i%2)*25],size:[.6,4,4],rot:[90,0,0],color:i%2?'#ffffff':'#ef5350',material:'Neon'});
    p.nodes.push(emitterNode({parent:t.id,name:'Burst',enabled:false},'confetti'));
    G.script(p,t.id,'Bob',blk('ev_start'),G.forever(blk('p_glide',{PART:bme(),X:bn(i%2?6:-6),Y:bn(0),Z:bn(0),S:bn(1.5+i*.2)}),blk('p_glide',{PART:bme(),X:bn(i%2?-6:6),Y:bn(0),Z:bn(0),S:bn(1.5+i*.2)})));}
  // balloons drift up, bombs sneak in, and a frenzy clock appears now and then
  for(let i=0;i<5;i++){const b=G.part(p,R.id,{name:'Balloon',shape:'ball',pos:[-30+i*15,-6,-40-(i%3)*10],size:[2.4,3,2.4],color:['#e91e63','#2196f3','#ffeb3b','#9c27b0','#4caf50'][i],material:'Plastic'});
    p.nodes.push(emitterNode({parent:b.id,name:'Pop',enabled:false},'confetti'));
    G.script(p,b.id,'Float',blk('ev_start'),G.wait(i*1.3),G.forever(blk('p_glide',{PART:bme(),X:bn(0),Y:bn(30),Z:bn(0),S:bn(6+i)}),blk('p_setpos',{PART:bme(),X:G.rnd(-40,40),Y:bn(-6),Z:G.rnd(-70,-30)})));}
  for(let i=0;i<2;i++){const bt_=G.part(p,R.id,{name:'BombTarget',shape:'cyl',pos:[-15+i*30,6,-45],size:[.6,3.6,3.6],rot:[90,0,0],color:'#212121',material:'Metal',label:'💣'});
    G.script(p,bt_.id,'Sway',blk('ev_start'),G.forever(blk('p_glide',{PART:bme(),X:bn(i?-10:10),Y:bn(0),Z:bn(0),S:bn(2)}),blk('p_glide',{PART:bme(),X:bn(i?10:-10),Y:bn(0),Z:bn(0),S:bn(2)})));}
  const clk=G.part(p,R.id,{name:'Clock',shape:'cyl',pos:[0,-30,-60],size:[.6,3,3],rot:[90,0,0],color:'#00e5ff',material:'Neon',label:'⏱ x2'});
  G.script(p,clk.id,'Appear',blk('ev_start'),G.forever(G.wait(G.rnd(12,20)),blk('p_setpos',{PART:bme(),X:G.rnd(-35,35),Y:G.rnd(8,16),Z:G.rnd(-70,-40)}),G.wait(4),blk('p_setpos',{PART:bme(),X:bn(0),Y:bn(-30),Z:bn(-60)})));
  const ufo=G.part(p,R.id,{name:'UFO',shape:'ball',pos:[-90,-30,-70],size:[6,1.6,6],color:'#b0bec5',material:'Metal',label:'👽 +5'});p.nodes.push(emitterNode({parent:ufo.id,name:'Beam',enabled:false},'confetti'));
  G.script(p,ufo.id,'Fly',blk('ev_start'),G.forever(G.wait(G.rnd(14,22)),G.sound('boost'),blk('p_setpos',{PART:bme(),X:bn(-70),Y:G.rnd(18,26),Z:G.rnd(-80,-50)}),blk('p_glide',{PART:bme(),X:bn(140),Y:bn(0),Z:bn(0),S:bn(5)}),blk('p_setpos',{PART:bme(),X:bn(-90),Y:bn(-30),Z:bn(-70)})));
  // every match rolls a mode: Classic, Night Shift (dark range) or Frenzy Match (the whole match counts double)
  G.vars(G.script(p,'sss','Frenzy reset',G.onMsg('round start'),G.vset('vfrenzy',G.num(0)),G.vset('vtmode',G.rnd(1,3)),
    G.ifElse(G.cmp(G.vget('vtmode'),'EQ',G.num(2)),[blk('g_sky',null,{COLOUR:'#0b1026'}),G.msg('🌙 NIGHT SHIFT: the range is dark. Look for the glow!',3)],
      [G.ifElse(G.cmp(G.vget('vtmode'),'EQ',G.num(3)),[blk('g_sky',null,{COLOUR:'#ffe082'}),G.vset('vfrenzy',G.num(1)),G.msg('⚡ FRENZY MATCH: every target counts double all match!',3)],[blk('g_sky',null,{COLOUR:'#cfe8ff'})])])),[['frenzy','vfrenzy'],['mode','vtmode']]);
  G.script(p,'sss','Clock frenzy fix',G.onMsg('round end'),G.vset('vfrenzy',G.num(0)),blk('g_sky',null,{COLOUR:'#cfe8ff'}));
  G.welcome(p,G.msg('Equip the blaster (1). Most hits in 60 seconds wins! Quick hits build combos. Gold = 3, balloons = 2, the blue clock starts a FRENZY, and never shoot the black bombs.',5));
  G.script(p,'sss','Time up',G.onMsg('round end'),G.msg(G.join('Time! You scored ',G.stat('Score'),'.'),3));
  G.best(p,'Score','targets_score');
  G.spawnAt(p,0,1.5,10,{size:[6,1,4]});
  return G.def(p,'targets','Target Range');}

/* 10. Cloud Hop */
function cloudHopDef(){const G=GK;const p=G.proj('cloudhop','Cloud Hop',{sky:'#8fc8ff'});G.noBase(p);G.spawnAt(p,0,80,0,{size:[12,1,12],color:'#ffffff'});
  const C=G.folder(p,'Clouds');const P=o=>G.part(p,C.id,Object.assign({color:'#ffffff',material:'Plastic',transparency:.05},o));let z=-6,y=80,x=0,cp=0;
  const cloud=(w,gap,dy,dx)=>{z-=gap;y+=dy||0;x+=dx||0;P({name:'Cloud',pos:[x,y,z-w/2],size:[w,1.6,w]});z-=w;};
  const check=()=>{cp++;z-=8;P({name:'Checkpoint',pos:[x,y,z-5],size:[10,1.6,10],color:'#3ddc84',behavior:'check',value:cp,transparency:0});z-=10;};
  cloud(6,6);cloud(6,8);cloud(5,10,2);cloud(5,11,0,4);check();
  for(let i=0;i<5;i++)cloud(4,11,i%2?2:-1,i%2?-4:4);check();
  const up=G.part(p,C.id,{name:'AirJumpOrb',shape:'ball',pos:[x,y+3,z+5],size:[2,2,2],color:'#d68cff',material:'Neon',canCollide:false});
  G.vars(G.script(p,up.id,'Triple',blk('ev_touch'),G.iff(G.cmp(G.vget('vtriple'),'EQ',G.num(0)),G.vset('vtriple',G.num(1)),blk('pl_airjumps',{N:bn(2)}),G.msg('Triple jump unlocked!',2),G.sound('win'),blk('p_visible',{PART:bme()},{B:'FALSE'}))),[['triple','vtriple']]);
  for(let i=0;i<4;i++)cloud(4,14,3,i%2?5:-5);check();
  for(let i=0;i<4;i++){const n=P({name:'DriftCloud',pos:[x,y,z-12],size:[6,1.6,6]});G.script(p,n.id,'Drift',...SCR.glide(i%2?12:-12,0,0,2).blocks.blocks);z-=18;}check();
  // bouncy cumulus clouds launch you up to the next layer
  for(let i=0;i<3;i++){z-=10;P({name:'BounceCloud',pos:[x,y,z-3],size:[6,1.6,6],color:'#b3e5fc',behavior:'jump',value:90,transparency:0});z-=8;y+=10;P({name:'Cloud',pos:[x+(i%2?5:-5),y,z-4],size:[6,1.6,6]});x+=i%2?5:-5;z-=8;}check();
  // a storm: lightning strikes the dark clouds, so keep moving
  for(let i=0;i<5;i++){const n=P({name:'StormCloud',pos:[x+(i%2?3:-3),y,z-6],size:[5,1.6,5],color:'#78909c'});const bolt=G.part(p,C.id,{name:'Lightning',pos:[x+(i%2?3:-3),y+8,z-6],size:[.8,14,.8],color:'#fff59d',material:'Neon',canCollide:false,transparency:1});
    G.script(p,bolt.id,'Strike',blk('ev_start'),G.wait(i*.7),G.forever(G.wait(G.rnd(2,4)),blk('p_transp',{PART:bme()},{V:bn(.6)}),G.wait(.5),blk('p_transp',{PART:bme()},{V:bn(0)}),G.sound('explode'),
      G.iff(G.cmp({block:{type:'s_distance',inputs:{PART:bme()}}},'LT',G.num(8)),blk('pl_damage',{N:bn(1000)})),G.wait(.25),blk('p_transp',{PART:bme()},{V:bn(1)})));z-=12;}check();
  // rainbow stars to collect
  for(let i=0;i<3;i++){const st=P({name:'Star',shape:'ball',pos:[x+(i-1)*4,y+2.5,z+20+i*6],size:[1.3,1.3,1.3],color:'#ffd740',material:'Neon',canCollide:false,transparency:0});G.script(p,st.id,'Take',blk('ev_touch'),blk('p_visible',{PART:bme()},{B:'FALSE'}),blk('p_setpos',{PART:bme(),X:bn(0),Y:bn(-90),Z:bn(0)}),G.sadd('Stars',1),G.sound('coin'),blk('pl_coins',{N:bn(2)}));}
  // sunset section: tiny golden clouds that drift up and down
  for(let i=0;i<6;i++){const n=P({name:'SunsetCloud',pos:[x+(i%2?4:-4),y,z-6],size:[4,1.6,4],color:'#ffcc80'});G.script(p,n.id,'Bob',...SCR.glide(0,3,0,1.4+i*.1).blocks.blocks);z-=11;}check();
  // a hidden sky island off to the side, reached by a hidden bounce cloud
  {const hx=x-22,hy=y+12,hz=z+23;P({name:'HiddenBounce',pos:[x-10,y,z+20],size:[4,1.6,4],color:'#e3f2fd',behavior:'jump',value:95,transparency:.55});
    P({name:'SkyIsland',pos:[hx,hy,hz],size:[14,2,14],color:'#c5e1a5',transparency:0});
    const ch=P({name:'SkyChest',pos:[hx,hy+2,hz],size:[3,2,2],color:'#ffb300',transparency:0,label:'💰'});
    G.vars(G.script(p,ch.id,'Open',blk('ev_touch'),G.iff(G.cmp(G.vget('vskyc'),'EQ',G.num(0)),G.vset('vskyc',G.num(1)),G.sound('win'),G.msg('You found the hidden sky island! +10 coins',3),blk('pl_coins',{N:bn(10)}))),[['sky chest','vskyc']]);}
  cloud(3,13,4);cloud(3,13,4);cloud(3,14,-3);z-=12;P({name:'Rainbow',pos:[x,y,z-8],size:[16,1.6,16],color:'#ffc93c',behavior:'finish',transparency:0});
  G.vars(G.welcome(p,G.vset('vtriple',G.num(0)),blk('pl_airjumps',{N:bn(1)}),G.msg('You can double jump! Press jump again in the air.',3)),[['triple','vtriple']]);
  return G.def(p,'cloudhop','Cloud Hop');}

/* 11. Freeze Tag: shared runners, every player hunts the same ones */
function freezeTagDef(){const G=GK;const p=G.proj('freezetag','Freeze Tag',{sky:'#d7f0ff',timer:false,saveStats:false,saveCheckpoint:false,lobby:true,lobbyWait:12,lobbyRound:120,lobbyScore:'Tags'});
  const bp=p.nodes.find(n=>n.name==='Baseplate');Object.assign(bp,{size:[180,2,200],color:'#e3f2fd',material:'Ice'});
  const A=G.folder(p,'Arena');[[-70,0,1,140],[70,0,1,140],[0,-70,140,1],[0,70,140,1]].forEach(([x,z,w,d])=>G.part(p,A.id,{name:'Wall',pos:[x,4,z],size:[w,8,d],color:'#90caf9',material:'Ice',transparency:.3}));
  for(let i=0;i<12;i++){const a=i*.52,r=20+(i%3)*14;G.part(p,A.id,{name:'IceBlock',pos:[r3(Math.cos(a)*r),2.5,r3(Math.sin(a)*r)],size:[5,5,5],color:'#bbdefb',material:'Ice',transparency:.2});}
  G.part(p,A.id,{name:'Bench',pos:[0,1,82],size:[64,2,4],color:'#90a4ae',material:'Metal',label:'WAITING'});
  [[-50,-50],[50,50]].forEach(([x,z])=>G.part(p,A.id,{name:'SpeedPad',pos:[x,.3,z],size:[5,.4,5],color:'#ffd400',material:'Neon',behavior:'speed',value:1.5}));
  // second map: Sunny Beach, 300 studs east
  const FOX='vfox',FV=[['map x',FOX]];const ox=v=>G.arith('ADD',typeof v==='number'?G.num(v):v,G.vget(FOX));
  {const OX=300,B2=G.folder(p,'Sunny Beach').id;const Q=o=>G.part(p,B2,o);
    Q({name:'Sand',pos:[OX,-1,0],size:[180,2,200],color:'#ffe082',material:'Sand'});Q({name:'Sea',pos:[OX,-.6,-80],size:[180,1,40],color:'#4fc3f7',material:'Glass',transparency:.3,canCollide:false});
    [[-70,0,1,140],[70,0,1,140],[0,70,140,1]].forEach(([x,z2,w,d])=>Q({name:'Fence',pos:[OX+x,2,z2],size:[w,4,d],color:'#a1887f',material:'Wood'}));
    for(let i=0;i<10;i++){const x=((i*47)%120)-60,z2=((i*31)%110)-50;Q({name:'PalmTrunk',pos:[OX+x,4,z2],size:[1.4,8,1.4],color:'#8d6e63',material:'Wood'});Q({name:'PalmLeaves',pos:[OX+x,8.3,z2],size:[7,.6,7],color:'#43a047',material:'Grass'});}
    [[-30,20,'#e53935'],[30,-20,'#1e88e5'],[0,40,'#fdd835']].forEach(([x,z2,c])=>{Q({name:'Umbrella',shape:'cyl',pos:[OX+x,5,z2],size:[9,.6,9],color:c,material:'Fabric'});Q({name:'Pole',pos:[OX+x,2.5,z2],size:[.4,5,.4],color:'#eeeeee'});});
    [[-45,-30],[45,30],[0,-10]].forEach(([x,z2])=>Q({name:'Sandcastle',pos:[OX+x,2,z2],size:[6,4,6],color:'#ffca28',material:'Sand'}));
    Q({name:'Bench',pos:[OX,1,82],size:[64,2,4],color:'#90a4ae',material:'Metal',label:'WAITING'});}
    {const OX=600,P3=G.folder(p,'Playground Park').id;const Q=o=>G.part(p,P3,o);
    Q({name:'Grass',pos:[OX,-1,0],size:[180,2,200],color:'#7cb342',material:'Grass'});Q({name:'Fence',pos:[OX,2,70],size:[140,4,1],color:'#a1887f',material:'Wood'});
    Q({name:'Sandpit',pos:[OX-30,.1,-20],size:[24,.2,24],color:'#ffe082',material:'Sand'});
    Q({name:'SlideTower',pos:[OX+30,4,-20],size:[8,8,8],color:'#ef5350',material:'Plastic'});Q({name:'Slide',shape:'wedge',pos:[OX+30,4,-8],size:[4,8,16],rot:[0,0,0],color:'#ffca28',material:'Plastic'});
    [[0,20],[40,30],[-40,30]].forEach(([x,z2])=>{Q({name:'SwingFrame',pos:[OX+x-4,4,z2],size:[.6,8,.6],color:'#1e88e5',material:'Metal'});Q({name:'SwingFrame',pos:[OX+x+4,4,z2],size:[.6,8,.6],color:'#1e88e5',material:'Metal'});Q({name:'SwingBar',pos:[OX+x,8,z2],size:[9,.6,.6],color:'#1e88e5',material:'Metal'});});
    [[-50,-50],[50,-50],[0,-60]].forEach(([x,z2])=>Q({name:'Tree',pos:[OX+x,4,z2],size:[2,8,2],color:'#6d4c41',material:'Wood'}));
    Q({name:'Bench',pos:[OX,1,82],size:[64,2,4],color:'#90a4ae',material:'Metal',label:'WAITING'});}
  G.vars(G.script(p,'sss','Pick map',G.onMsg('round start'),G.vset(FOX,G.arith('MULTIPLY',G.rnd(0,2),G.num(300))),G.ifElse(G.cmp(G.vget(FOX),'EQ',G.num(0)),[blk('g_sky',null,{COLOUR:'#d7f0ff'})],[G.ifElse(G.cmp(G.vget(FOX),'EQ',G.num(300)),[blk('g_sky',null,{COLOUR:'#81d4fa'}),G.msg('Map: SUNNY BEACH',2)],[blk('g_sky',null,{COLOUR:'#a5d6a7'}),G.msg('Map: PLAYGROUND PARK',2)])]),
    blk('pl_tpxyz',{X:ox(G.rnd(-10,10)),Y:bn(3),Z:G.rnd(0,20)})),FV);
  const N=10,ACT='vactive',FZ='vfrozen',RD='vround',LV='vlevel',TL='vtime',FK=k=>'vfz'+k;
  const MV=G.matchFlags(p);
  const VARS=[['active runners',ACT],['frozen',FZ],['round on',RD],['level',LV],['level time',TL],...Array.from({length:N},(_,i)=>['frozen'+(i+1),FK(i+1)]),...MV,...FV];
  const eq=(id,n)=>G.cmp(G.vget(id),'EQ',G.num(n)),prop=G.prop;
  const COLS=['#e53935','#8e24aa','#43a047','#fb8c00','#1e88e5','#00acc1','#f06292','#6d4c41','#fdd835','#5c6bc0'];
  const inactive=k=>G.cmp(G.num(k),'GT',G.vget(ACT));
  for(let k=1;k<=N;k++){const r=rigNode({name:'Runner'+k,pos:[-30+k*6,2.6,82],health:999,respawn:0,walkSpeed:12,colors:{head:'#f5cd30',torso:COLS[k-1],arms:'#f5cd30',legs:'#37474f'}});p.nodes.push(r);
    const flee=a=>G.arith('ADD',prop(bme(),a),G.arith('ADD',G.arith('MULTIPLY',G.arith('MINUS',prop(bme(),a),G.nearAx(bme(),a)),G.num(.7)),G.rnd(-10,10)));
    G.vars(G.hscript(p,r.id,'Run',blk('ev_start'),G.forever(G.ifElse(G.OR(G.OR(inactive(k),eq(FK(k),1)),eq(RD,0)),[G.wait(.4)],
      [G.ifElse(G.cmp(G.nearD(bme()),'LT',G.num(24)),[blk('rig_walk',{PART:bme(),X:flee('x'),Z:flee('z')})],
        [blk('rig_walk',{PART:bme(),X:G.arith('ADD',prop(bme(),'x'),G.rnd(-18,18)),Z:G.arith('ADD',prop(bme(),'z'),G.rnd(-18,18))}),G.wait(G.rnd(0,1))])]))),VARS);
    G.vars(G.hscript(p,r.id,'Frozen look',blk('ev_start'),G.forever(G.until(eq(FK(k),1)),blk('p_color',{PART:bme()},{COLOUR:'#b3e5fc'}),blk('rig_say',{PART:bme(),TEXT:bt('❄ Frozen!'),S:bn(2)}),
      blk('rig_walk',{PART:bme(),X:prop(bme(),'x'),Z:prop(bme(),'z')}),G.until(eq(FK(k),0)),blk('p_color',{PART:bme()},{COLOUR:COLS[k-1]}))),VARS);
    G.vars(G.script(p,r.id,'Tagged',blk('ev_touch'),G.iff(G.AND(G.AND(eq(RD,1),eq(FK(k),0)),G.AND(G.NOT(inactive(k)),G.aliveIn())),
      G.shSet(FK(k),G.num(1)),G.shChg(FZ,1),G.sadd('Tags',1),G.sound('check'),G.msg(G.join('Frozen ',G.vget(FZ),' of ',G.vget(ACT),'!'),1.2))),VARS);}
  G.script(p,'player','TagPlayers',blk('ev_touch_player'),G.sadd('Tags',1),blk('pl_as',{WHO:{block:{type:'pl_touched'}},DO:doIn(blk('pl_freeze',null,{B:'TRUE'}),blk('pl_say',{TEXT:bt('Frozen!'),S:bn(3)}),G.wait(3),blk('pl_freeze',null,{B:'FALSE'}))}));
  const setup=()=>[G.ifElse(G.cmp(G.vget(LV),'GTE',G.num(7)),[G.vset(ACT,G.num(10))],[G.vset(ACT,G.arith('ADD',G.vget(LV),G.arith('ADD',G.num(2),G.players())))]),G.iff(G.cmp(G.vget(ACT),'GT',G.num(10)),G.vset(ACT,G.num(10))),G.vset(FZ,G.num(0)),
    ...Array.from({length:N},(_,i)=>{const k=i+1;return [G.vset(FK(k),G.num(0)),blk('rig_speed',{PART:G.pnamed('Runner'+k),N:G.arith('ADD',G.num(10.5),G.vget(LV))}),
      G.ifElse(inactive(k),[blk('p_setpos',{PART:G.pnamed('Runner'+k),X:ox(-30+k*6),Y:bn(4.6),Z:bn(82)})],[blk('p_setpos',{PART:G.pnamed('Runner'+k),X:ox(G.rnd(-60,60)),Y:bn(2.6),Z:G.rnd(-60,0)})])];}).flat()];
  G.vars(G.hscript(p,'sss','Rounds',G.onMsg('round start'),G.vset(LV,G.num(1)),G.vset(RD,G.num(0)),
    G.msg('Most freezes wins! Freeze every runner before the level timer runs out.',4),G.wait(2),
    G.whileDo(G.inMatch(),...setup(),G.vset(TL,G.num(45)),G.vset(RD,G.num(1)),G.sound('check'),G.msg(G.join('Level ',G.vget(LV),': freeze all ',G.vget(ACT),' runners!'),2.5),
      blk('controls_whileUntil',{BOOL:G.OR(G.NOT(G.inMatch()),G.OR(G.cmp(G.vget(TL),'LTE',G.num(0)),G.cmp(G.vget(FZ),'GTE',G.vget(ACT)))),DO:doIn(G.wait(1),G.vchg(TL,-1))},{MODE:'UNTIL'}),
      G.vset(RD,G.num(0)),
      G.ifElse(G.cmp(G.vget(FZ),'GTE',G.vget(ACT)),[G.sound('win'),blk('g_callout',{TEXT:G.txt('LEVEL UP!')}),G.msg(G.join('All frozen with ',G.vget(TL),' seconds left! Level up!'),3),G.vchg(LV,1),G.wait(3)],
        [G.iff(G.inMatch(),G.sound('die'),G.msg(G.join('Level time is up! ',G.vget(FZ),' of ',G.vget(ACT),' frozen. Back to level 1.'),4),G.vset(LV,G.num(1)),G.wait(4))])),G.vset(RD,G.num(0))),VARS);
  G.vars(G.script(p,'sss','Show level',blk('ev_start'),G.forever(G.iff(G.cmp(G.vget(LV),'GT',G.num(0)),G.sset('Level',G.vget(LV)),G.sset('Time',G.vget(TL))),G.wait(.5))),VARS);
  // the snowball launcher freezes runners from range (3 second reload)
  const sb=gkGun(p,'pack','Snowball Launcher',{dmg:0,cool:3,color:'#e1f5fe',speed:160,tip:'Freezes a runner from range'});
  const hpn={block:{type:'s_partname',inputs:{PART:{block:{type:'tool_hitpart'},shadow:{type:'p_this'}}}}};
  G.vars(G.script(p,sb.id,'Freeze shot',blk('ev_tool_hit'),...Array.from({length:N},(_,i)=>{const k=i+1;return G.iff(G.AND(G.cmp(hpn,'EQ',G.txt('Runner'+k)),G.AND(G.AND(eq(RD,1),eq(FK(k),0)),G.NOT(inactive(k)))),
      G.shSet(FK(k),G.num(1)),G.shChg(FZ,1),G.sadd('Tags',1),G.sound('check'),G.msg('Snowball freeze!',1));})),VARS);
  // ice skates: a burst of speed on the slippery pond in the corner
  G.part(p,A.id,{name:'IcePond',shape:'cyl',pos:[-50,.15,50],size:[24,.3,24],color:'#e1f5fe',material:'Ice',behavior:'speed',value:1.8,label:'SKATE'});
  G.script(p,'sss','Level coins',blk('ev_start'),G.forever(G.vset('vlvc',G.vget(LV)),G.until(G.cmp(G.vget(LV),'GT',G.vget('vlvc'))),blk('pl_coins',{N:bn(2)})));
  gkPowerups(p,[[-40,-40],[40,-40],[0,-60],[300-40,-40],[340,-40],[300,-60]]);
  G.welcome(p,G.msg('Freeze Tag: matches start from the lobby. Most freezes wins! Your snowball launcher (1) freezes from range.',4));
  G.hud(p,'Freeze','#0277bd',G.join('❄ Frozen ',G.vget(FZ),' / ',G.vget(ACT),'   ·   ⏱ ',G.vget(TL),'s   ·   Level ',G.vget(LV)));
  G.best(p,'Level','freeze_level');
  return G.def(p,'freezetag','Freeze Tag');}

/* 12. Boss Battle (co-op) */
function bossDef(){const G=GK;const p=G.proj('boss','Boss Battle',{sky:'#2b1d3a',fog:420,brightness:.85,deathStyle:'ragdoll',timer:false,saveStats:false,saveCheckpoint:false});
  const bp=p.nodes.find(n=>n.name==='Baseplate');Object.assign(bp,{size:[150,2,150],color:'#3e3550',material:'Slate'});
  const A=G.folder(p,'Arena');for(let i=0;i<8;i++){const a=i*Math.PI/4;G.part(p,A.id,{name:'Pillar',shape:'cyl',pos:[r3(Math.cos(a)*45),8,r3(Math.sin(a)*45)],size:[5,16,5],color:'#6a5a8a',material:'Brick'});}
  G.part(p,A.id,{name:'Throne',pos:[0,1.5,-55],size:[16,3,10],color:'#ffc93c',material:'Metal'});
  for(const t of ['Sword','Blaster','Healing potion']){const ns=G.prefab(p,t);ns[0].parent='pack';}
  G.prefab(p,'Healing potion',{x:40,y:2,z:20});G.prefab(p,'Healing potion',{x:-40,y:2,z:20});
  const LV='vlevel',VL=[['level',LV]];
  const B=rigNode({name:'Brick King',pos:[0,7,-50],scale:2.6,health:500,respawn:6,walkSpeed:7,colors:{head:'#ffcc80',torso:'#6a1b9a',arms:'#ffcc80',legs:'#311b92'}});p.nodes.push(B);
  p.nodes.push(emitterNode({parent:B.id,name:'Aura'},'magic'));
  G.hscript(p,B.id,'Chase',blk('ev_start'),G.wait(4),G.forever(G.walkN(bme()),G.wait(.4)));
  G.script(p,B.id,'Stomp',blk('ev_touch'),blk('pl_damage',{N:bn(20)}),blk('pl_knock',{WHO:bme(),P:bn(90)},{RAG:'TRUE'}),G.sound('explode'),G.wait(1.5));
  G.hscript(p,B.id,'Slam',blk('ev_start'),G.wait(8),G.forever(G.wait(G.rnd(6,10)),G.iff(G.cmp({block:{type:'s_rig_health',inputs:{PART:bme()}}},'GT',G.num(0)),
    blk('rig_say',{PART:bme(),TEXT:bt('GROUND SLAM! (jump!)'),S:bn(1.5)}),G.wait(1.3),G.bc('slam'))));
  G.script(p,B.id,'Slam hits',G.onMsg('slam'),G.sound('explode'),blk('g_shake',null,{POW:'.7'}),blk('pe_emit',{N:bn(70),PART:bme()}),
    G.iff(G.AND(G.cmp({block:{type:'s_distance',inputs:{PART:bme()}}},'LT',G.num(24)),{block:{type:'s_grounded'}}),blk('pl_damage',{N:bn(18)}),blk('pl_knock',{WHO:bme(),P:bn(80)},{RAG:'FALSE'})));
  G.vars(G.hscript(p,B.id,'Minions',blk('ev_start'),G.vset(LV,G.num(1)),G.wait(10),G.forever(blk('rig_say',{PART:bme(),TEXT:bt('Minions, attack!'),S:bn(2)}),
    blk('controls_repeat_ext',{TIMES:G.arith('ADD',G.vget(LV),G.arith('MINUS',G.players(),G.num(1))),DO:doIn(blk('rs_copy',{X:bn(-30),Y:bn(2.6),Z:bn(-40)},{NAME:'Minion'}),blk('rs_copy',{X:bn(30),Y:bn(2.6),Z:bn(-40)},{NAME:'Minion'}),G.wait(.6))}),G.wait(14))),VL);
  G.vars(G.hscript(p,B.id,'Defeat',blk('ev_rig_died'),G.vchg(LV,1),G.bc('boss down')),VL);
  G.vars(G.script(p,'sss','Victory',G.onMsg('boss down'),G.sound('win'),blk('g_callout',{TEXT:G.txt('BOSS DOWN!')}),G.msg(G.join('The Brick King is down! Level ',G.vget(LV),': he returns in 6 seconds with more minions...'),4),blk('pl_heal',{N:bn(50)})),VL);
  const Mi=rigNode({name:'Minion',parent:'rs',pos:[0,2.6,0],scale:.8,health:30,respawn:0,walkSpeed:12,colors:{head:'#b39ddb',torso:'#4527a0',arms:'#b39ddb',legs:'#212121'}});p.nodes.push(Mi);
  G.hscript(p,Mi.id,'Chase',blk('ev_start'),G.forever(G.walkN(bme()),G.wait(.2)));
  G.script(p,Mi.id,'Bite',blk('ev_touch'),blk('pl_damage',{N:bn(6)}),G.wait(1));
  const sg=guiNode('ScreenGui',{name:'BossHUD'});const lb=guiNode('TextLabel',{parent:sg.id,name:'BossName',text:'THE BRICK KING',gpos:[.5,0,0,12],anchor:[.5,0],gsize:[0,320,0,44],bgT:1,tc:'#ffd54f',font:'Medieval',ts:34,strokeT:2,strokeTc:'#311b92'});p.nodes.push(sg,lb);
  G.vars(G.script(p,'sss','Defeated',blk('ev_died'),G.ifElse(G.cmp(G.players(),'EQ',G.num(1)),[G.msg(G.join('The Brick King wins this time. You reached level ',G.vget(LV),'.'),3),G.vset(LV,G.num(1)),blk('rig_heal',{PART:G.pnamed('Brick King'),N:bn(1000)})],
    [G.msg('Knocked out! Get back in there and help your team.',3)])),VL);
  G.vars(G.script(p,'sss','Show level',blk('ev_start'),G.forever(G.iff(G.cmp(G.vget(LV),'GT',G.num(0)),G.sset('Level',G.vget(LV))),G.wait(.5))),VL);
  G.best(p,'Level','boss_level');
  // from level 3 the Frost Queen joins the fight: she freezes anyone she touches and throws ice shards
  const FQ=rigNode({name:'Frost Queen',pos:[68,5.2,68],scale:2,health:350,respawn:8,walkSpeed:10,colors:{head:'#e1f5fe',torso:'#4fc3f7',arms:'#e1f5fe',legs:'#0277bd'}});p.nodes.push(FQ);
  p.nodes.push(emitterNode({parent:FQ.id,name:'Snow'},'snow'));
  G.vars(G.hscript(p,FQ.id,'Hunt',blk('ev_start'),G.forever(G.ifElse(G.cmp(G.vget(LV),'LT',G.num(3)),[blk('p_setpos',{PART:bme(),X:bn(68),Y:bn(5.2),Z:bn(68)}),blk('p_visible',{PART:bme()},{B:'FALSE'}),blk('rig_walk',{PART:bme(),X:bn(68),Z:bn(68)}),G.until(G.cmp(G.vget(LV),'GTE',G.num(3))),
      blk('p_visible',{PART:bme()},{B:'TRUE'}),blk('p_setpos',{PART:bme(),X:bn(30),Y:bn(5.2),Z:bn(-50)}),blk('rig_say',{PART:bme(),TEXT:bt('The Frost Queen joins the battle!'),S:bn(3)}),G.bc('queen arrives')],[G.walkN(bme()),G.wait(.3)]))),VL);
  G.script(p,'sss','Queen msg',G.onMsg('queen arrives'),G.sound('die'),G.msg('❄ The FROST QUEEN joins the battle! Her touch freezes you.',3));
  G.script(p,FQ.id,'Freeze touch',blk('ev_touch'),blk('pl_damage',{N:bn(12)}),blk('pl_freeze',null,{B:'TRUE'}),G.msg('FROZEN!',1),G.wait(1.5),blk('pl_freeze',null,{B:'FALSE'}),G.wait(1));
  for(let k=1;k<=3;k++){const sh=G.part(p,'workspace',{name:'IceShard'+k,pos:[0,-60,0],size:[1,1,3],color:'#b3e5fc',material:'Neon',canCollide:false,unbreakable:true});
    G.vars(G.hscript(p,sh.id,'Throw',blk('ev_start'),G.wait(5+k),G.forever(G.wait(G.rnd(3,5)),G.iff(G.AND(G.cmp(G.vget(LV),'GTE',G.num(3)),G.cmp({block:{type:'s_rig_health',inputs:{PART:G.pnamed('Frost Queen')}}},'GT',G.num(0))),
      blk('p_setpos',{PART:bme(),X:G.prop(G.pnamed('Frost Queen'),'x'),Y:bn(5),Z:G.prop(G.pnamed('Frost Queen'),'z')}),
      blk('p_glideto',{PART:bme(),X:G.nearAx(G.pnamed('Frost Queen'),'x'),Y:bn(3),Z:G.nearAx(G.pnamed('Frost Queen'),'z'),S:bn(.6)}),G.bc('shard '+k),blk('p_setpos',{PART:bme(),X:bn(0),Y:bn(-60),Z:bn(0)})))),VL);
    G.script(p,'sss','Shard hit '+k,G.onMsg('shard '+k),G.iff(G.cmp({block:{type:'s_distance',inputs:{PART:G.pnamed('IceShard'+k)}}},'LT',G.num(4)),blk('pl_damage',{N:bn(15)}),G.sound('click')));}
  // level 5: the Shadow Dragon. It plunges the arena into darkness and calls minions
  const SD=rigNode({name:'Shadow Dragon',pos:[-68,6.5,68],scale:3,health:600,respawn:10,walkSpeed:8,colors:{head:'#311b92',torso:'#1a0033',arms:'#4527a0',legs:'#1a0033'}});p.nodes.push(SD);
  p.nodes.push(emitterNode({parent:SD.id,name:'Shadows',rate:20,speed:4},'smoke'));
  G.vars(G.hscript(p,SD.id,'Hunt',blk('ev_start'),G.forever(G.ifElse(G.cmp(G.vget(LV),'LT',G.num(5)),[blk('p_setpos',{PART:bme(),X:bn(-68),Y:bn(6.5),Z:bn(68)}),blk('p_visible',{PART:bme()},{B:'FALSE'}),blk('rig_walk',{PART:bme(),X:bn(-68),Z:bn(68)}),G.until(G.cmp(G.vget(LV),'GTE',G.num(5))),
      blk('p_visible',{PART:bme()},{B:'TRUE'}),blk('p_setpos',{PART:bme(),X:bn(-30),Y:bn(6.5),Z:bn(-50)}),G.bc('dragon arrives')],[G.walkN(bme()),G.wait(.3)]))),VL);
  G.vars(G.hscript(p,SD.id,'Darkness',blk('ev_start'),G.forever(G.wait(G.rnd(12,18)),G.iff(G.AND(G.cmp(G.vget(LV),'GTE',G.num(5)),G.cmp({block:{type:'s_rig_health',inputs:{PART:bme()}}},'GT',G.num(0))),
    G.bc('darkness'),blk('rig_say',{PART:bme(),TEXT:bt('DARKNESS!'),S:bn(2)}),blk('rs_copy',{X:G.prop(bme(),'x'),Y:bn(2.6),Z:G.prop(bme(),'z')},{NAME:'Minion'}),blk('rs_copy',{X:G.prop(bme(),'x'),Y:bn(2.6),Z:G.prop(bme(),'z')},{NAME:'Minion'})))),VL);
  G.script(p,'sss','Dragon msg',G.onMsg('dragon arrives'),G.sound('die'),G.msg('🐉 The SHADOW DRAGON has awoken! Level 5 gets serious.',3));
  G.script(p,'sss','Dark',G.onMsg('darkness'),blk('g_sky',null,{COLOUR:'#000000'}),G.msg('The lights go out...',1.5),G.wait(3.5),blk('g_sky',null,{COLOUR:'#2b1d3a'}));
  G.script(p,SD.id,'Bite',blk('ev_touch'),blk('pl_damage',{N:bn(30)}),blk('pl_knock',{WHO:bme(),P:bn(100)},{RAG:'TRUE'}),G.sound('explode'),G.wait(1.5));
  G.script(p,SD.id,'Dragon KO',blk('ev_rig_died'),G.sound('win'),G.msg('The Shadow Dragon fades away... for now. +5 coins',3),blk('pl_coins',{N:bn(5)}));
  G.script(p,FQ.id,'Queen KO',blk('ev_rig_died'),G.sound('win'),G.msg('The Frost Queen shattered! She will be back...',2.5),blk('pl_coins',{N:bn(3)}));
  // level 7: MECHA BRICK. A giant robot with a spinning laser: jump over the beam!
  const MBk=rigNode({name:'Mecha Brick',pos:[68,7.3,-68],scale:2.8,health:800,respawn:12,walkSpeed:6,colors:{head:'#b0bec5',torso:'#455a64',arms:'#90a4ae',legs:'#263238'}});p.nodes.push(MBk);
  p.nodes.push(emitterNode({parent:MBk.id,name:'Sparks',rate:10,speed:5},'sparkles'));
  G.vars(G.hscript(p,MBk.id,'Hunt',blk('ev_start'),G.forever(G.ifElse(G.cmp(G.vget(LV),'LT',G.num(7)),[blk('p_setpos',{PART:bme(),X:bn(68),Y:bn(7.3),Z:bn(-68)}),blk('p_visible',{PART:bme()},{B:'FALSE'}),blk('rig_walk',{PART:bme(),X:bn(68),Z:bn(-68)}),G.until(G.cmp(G.vget(LV),'GTE',G.num(7))),
      blk('p_visible',{PART:bme()},{B:'TRUE'}),blk('p_setpos',{PART:bme(),X:bn(0),Y:bn(7.3),Z:bn(40)}),G.bc('mecha arrives')],[G.walkN(bme()),G.wait(.4)]))),VL);
  G.script(p,'sss','Mecha msg',G.onMsg('mecha arrives'),G.sound('die'),G.msg('🤖 MECHA BRICK has powered on! JUMP over its spinning laser!',3));
  const lz=G.part(p,'workspace',{name:'MechaLaser',pos:[0,-60,0],size:[44,.8,.8],color:'#ff1744',material:'Neon',canCollide:false,unbreakable:true});
  G.vars(G.script(p,lz.id,'Sweep',blk('ev_start'),G.forever(G.ifElse(G.AND(G.cmp(G.vget(LV),'GTE',G.num(7)),G.cmp({block:{type:'s_rig_health',inputs:{PART:G.pnamed('Mecha Brick')}}},'GT',G.num(0))),
      [blk('p_setpos',{PART:bme(),X:G.prop(G.pnamed('Mecha Brick'),'x'),Y:bn(1.3),Z:G.prop(G.pnamed('Mecha Brick'),'z')}),blk('p_rotate',{PART:bme(),DEG:bn(4)},{AXIS:'y'}),G.wait(.03)],
      [blk('p_setpos',{PART:bme(),X:bn(0),Y:bn(-60),Z:bn(0)}),G.wait(.5)]))),VL);
  G.script(p,lz.id,'Zap',blk('ev_touch'),blk('pl_damage',{N:bn(18)}),blk('pl_knock',{WHO:bme(),P:bn(70)},{RAG:'FALSE'}),G.sound('explode'),G.msg('ZAPPED by the laser! Jump over it!',1.2),G.wait(1));
  G.script(p,MBk.id,'Stomp',blk('ev_touch'),blk('pl_damage',{N:bn(25)}),blk('pl_knock',{WHO:bme(),P:bn(90)},{RAG:'TRUE'}),G.sound('explode'),G.wait(1.5));
  G.script(p,MBk.id,'Mecha KO',blk('ev_rig_died'),G.sound('win'),G.msg('MECHA BRICK short-circuited! +8 coins',3),blk('pl_coins',{N:bn(8)}));
  // from level 2 the King calls down fireballs: watch for the red circles on the floor
  for(let k=1;k<=5;k++){const fb=G.part(p,'workspace',{name:'Fireball'+k,shape:'ball',pos:[k*4,-60,0],size:[4,4,4],color:'#ff6d00',material:'Neon',canCollide:false,unbreakable:true});
    p.nodes.push(emitterNode({parent:fb.id,name:'Flames',rate:25,speed:4},'fire'));
    const mk=G.part(p,'workspace',{name:'FireMark'+k,shape:'cylinder',pos:[k*4,-60,0],size:[7,.2,7],color:'#ff1744',material:'Neon',canCollide:false,transparency:.35,unbreakable:true});
    G.vars(G.hscript(p,fb.id,'Fall',blk('ev_start'),G.wait(10+k*.7),G.forever(G.wait(G.rnd(5,9)),G.iff(G.cmp(G.vget(LV),'GTE',G.num(2)),
      G.vset('vfx'+k,G.arith('ADD',G.nearAx(G.pnamed('Brick King'),'x'),G.rnd(-14,14))),G.vset('vfz'+k,G.arith('ADD',G.nearAx(G.pnamed('Brick King'),'z'),G.rnd(-14,14))),
      blk('p_setpos',{PART:G.pnamed('FireMark'+k),X:G.vget('vfx'+k),Y:bn(.25),Z:G.vget('vfz'+k)}),blk('p_setpos',{PART:bme(),X:G.vget('vfx'+k),Y:bn(70),Z:G.vget('vfz'+k)}),
      blk('p_glideto',{PART:bme(),X:G.vget('vfx'+k),Y:bn(2),Z:G.vget('vfz'+k),S:bn(1.6)}),G.bc('fireball '+k),blk('p_setpos',{PART:G.pnamed('FireMark'+k),X:bn(0),Y:bn(-60),Z:bn(0)}),blk('p_setpos',{PART:bme(),X:bn(0),Y:bn(-60),Z:bn(0)})))),[...VL,['fx'+k,'vfx'+k],['fz'+k,'vfz'+k]]);
    G.script(p,'sss','Fireball hit '+k,G.onMsg('fireball '+k),G.iff(G.cmp({block:{type:'s_distance',inputs:{PART:G.pnamed('Fireball'+k)}}},'LT',G.num(5)),blk('pl_damage',{N:bn(22)}),G.sound('explode'),G.msg('Burned by a fireball!',1)));}
  // below half health the King gets angry and faster
  G.hscript(p,B.id,'Enrage',blk('ev_start'),G.forever(G.until(G.AND(G.cmp({block:{type:'s_rig_health',inputs:{PART:bme()}}},'LT',G.num(250)),G.cmp({block:{type:'s_rig_health',inputs:{PART:bme()}}},'GT',G.num(0)))),
    blk('rig_say',{PART:bme(),TEXT:bt('ENOUGH! Now I am ANGRY!'),S:bn(2)}),blk('rig_speed',{PART:bme(),N:bn(11)}),G.bc('enraged'),
    G.until(G.OR(G.cmp({block:{type:'s_rig_health',inputs:{PART:bme()}}},'LTE',G.num(0)),G.cmp({block:{type:'s_rig_health',inputs:{PART:bme()}}},'GT',G.num(400)))),blk('rig_speed',{PART:bme(),N:bn(7)}),G.wait(1)));
  G.script(p,'sss','Enraged',G.onMsg('enraged'),G.sound('die'),blk('g_sky',null,{COLOUR:'#5a0f1e'}),G.msg('The Brick King is ENRAGED! He is faster now.',2.5));
  G.script(p,'sss','Calm',G.onMsg('boss down'),blk('g_sky',null,{COLOUR:'#2b1d3a'}),blk('pl_coins',{N:bn(5)}));
  G.welcome(p,G.msg('Defeat the Brick King again and again, alone or with friends online. New bosses join at levels 3, 5 and 7! Sword (1), blaster (2), potion (3).',5));
  G.spawnAt(p,0,.5,24);return G.def(p,'boss','Boss Battle');}

/* ---------- bigger games ---------- */
/* 14. Disaster Zone: shared lobby and matches, the same map and disaster for every player, buildings that break apart */
function disastersDef(){const G=GK;const p=G.proj('disasters','Disaster Zone',{sky:'#8ec9ff',fog:700,timer:false,saveStats:false,saveCheckpoint:false,deathStyle:'ragdoll',
    lobby:true,lobbyWait:15,lobbyRound:48,lobbyScore:'Survived',lobbyElim:true});
  G.noBase(p);
  G.spawnAt(p,0,32,0,{size:[6,1,6],transparency:1,canCollide:false});
  G.part(p,'workspace',{name:'Sea',pos:[0,-4,0],size:[900,2,900],color:'#2a7fc9',material:'Glass',transparency:.15,behavior:'water',unbreakable:true});
  /* ---------- maps live in ReplicatedStorage; a fresh copy is dropped in for each match ---------- */
  const MAPS=[];
  const mapModel=name=>{const m=G.model(p,name,'rs');MAPS.push({name,id:m.id});return m.id;};
  const U={unbreakable:true};
  // hollow building made of wall panels (so disasters can knock holes in it) with a flat roof and outside steps
  const house=(F,x,z,w,h,d,col,mat,roofCol)=>{const rows=2,ph=h/rows;
    const wall=(cx,cz,len,alongX,door)=>{const n=Math.max(1,Math.round(len/4)),pw=len/n;for(let r=0;r<rows;r++)for(let i=0;i<n;i++){if(door&&r===0&&i===Math.floor(n/2))continue;
      const o=-len/2+pw*(i+.5);G.part(p,F,{name:'Wall',pos:[r3(alongX?cx+o:cx),r3(ph*(r+.5)),r3(alongX?cz:cz+o)],size:alongX?[r3(pw),r3(ph),1]:[1,r3(ph),r3(pw)],color:col,material:mat});}};
    wall(x,z+d/2-.5,w,true,true);wall(x,z-d/2+.5,w,true,false);wall(x-w/2+.5,z,d-2,false,false);wall(x+w/2-.5,z,d-2,false,false);
    G.part(p,F,{name:'Roof',pos:[x,h+.4,z],size:[w+1,.8,d+1],color:roofCol,material:'Wood'});
    for(let i=0;i<Math.ceil(h/2);i++)G.part(p,F,{name:'Steps',pos:[r3(x+w/2+1.6),1+i*2,r3(z-d/2+2+i*1.9)],size:[2.6,1,2],color:'#8d6e63',material:'Wood'});};
  const tower=(F,x,z,w,h,col,mat,seg,stepCol)=>{const n=Math.round(h/seg);for(let i=0;i<n;i++)G.part(p,F,{name:'Floor',pos:[x,r3(seg*(i+.5)),z],size:[w,seg-.02,w],color:col,material:mat});
    const per=4*(w+4.4),m=Math.ceil(h/2.3);for(let i=0;i<m;i++){let u=(i*4.2)%per;const H=w/2+2.2;let px,pz;
      if(u<2*H){px=-H+u;pz=H;}else if((u-=2*H)<2*H){px=H;pz=H-u;}else if((u-=2*H)<2*H){px=H-u;pz=-H;}else{u-=2*H;px=-H;pz=-H+u;}
      G.part(p,F,{name:'Stair',pos:[r3(x+px),r3(1.3+i*2.3),r3(z+pz)],size:[3.2,1,3.2],color:stepCol,material:'Metal'});}};
  const tree=(F,x,z,h,leaf)=>{G.part(p,F,{name:'Trunk',pos:[x,h/2,z],size:[1.4,h,1.4],color:'#6d4c41',material:'Wood'});G.part(p,F,{name:'Leaves',pos:[x,h+2,z],size:[6,4,6],color:leaf,material:'Grass'});};
  // 1. Sunny Suburb
  {const F=mapModel('Sunny Suburb');
    G.part(p,F,Object.assign({name:'Ground',pos:[0,-1,0],size:[124,2,124],color:'#5aa646',material:'Grass'},U));
    G.part(p,F,Object.assign({name:'Road',pos:[0,.05,0],size:[124,.1,10],color:'#424242',material:'Concrete'},U));
    [[-32,-28,'#ef9a9a'],[26,-30,'#90caf9'],[-30,28,'#fff59d'],[32,26,'#c5e1a5']].forEach(([x,z,c])=>house(F,x,z,12,9,12,c,'Brick','#6d4c41'));
    tower(F,-50,0,7,24,'#b0bec5','Concrete',4,'#78909c');
    for(let k=0;k<4;k++)G.part(p,F,Object.assign({name:'Hill',pos:[48,1.5+k*3,0],size:[26-k*6,3,26-k*6],color:['#4a9f3c','#3f8a33','#37782c','#2e6b25'][k],material:'Grass'},U));
    [[-10,-45],[12,46],[-52,40],[52,-45],[0,-20],[8,22]].forEach(([x,z])=>tree(F,x,z,6,'#2e7d32'));
    [[-14,8,'#e53935'],[18,-6,'#1e88e5']].forEach(([x,z,c])=>{G.part(p,F,{name:'Car',pos:[x,1.1,z],size:[7,1.8,3.6],color:c,material:'Metal'});G.part(p,F,{name:'CarTop',pos:[x,2.6,z],size:[3.6,1.2,3.2],color:'#263238',material:'Glass'});});}
  // 2. Downtown
  {const F=mapModel('Downtown');
    G.part(p,F,Object.assign({name:'Ground',pos:[0,-1,0],size:[124,2,124],color:'#9e9e9e',material:'Concrete'},U));
    G.part(p,F,Object.assign({name:'Street',pos:[0,.05,0],size:[124,.1,12],color:'#37474f',material:'Concrete'},U));G.part(p,F,Object.assign({name:'Street',pos:[0,.06,0],size:[12,.1,124],color:'#37474f',material:'Concrete'},U));
    [[-32,-32,16,40,'#78909c'],[32,-30,16,28,'#8d6e63'],[-30,32,18,20,'#5c6bc0'],[34,34,14,48,'#455a64']].forEach(([x,z,w,h,c])=>tower(F,x,z,w,h,c,'Concrete',4,'#ffb300'));
    [[-12,20,'#e53935'],[14,-18,'#1e88e5'],[50,6,'#fdd835'],[-48,-6,'#43a047']].forEach(([x,z,c])=>{G.part(p,F,{name:'Car',pos:[x,1.1,z],size:[3.6,1.8,7],color:c,material:'Metal'});G.part(p,F,{name:'CarTop',pos:[x,2.6,z],size:[3.2,1.2,3.6],color:'#263238',material:'Glass'});});
    for(let i=0;i<8;i++)G.part(p,F,{name:'Lamp',pos:[-42+i*12,3,8],size:[.5,6,.5],color:'#37474f',material:'Metal'});
    G.part(p,F,{name:'Fountain',shape:'cyl',pos:[0,1,0],size:[8,2,8],color:'#b0bec5',material:'Concrete'});}
  // 3. Frosty Peaks
  {const F=mapModel('Frosty Peaks');
    G.part(p,F,Object.assign({name:'Ground',pos:[0,-1,0],size:[124,2,124],color:'#eef4fb',material:'Snow'},U));
    for(let k=0;k<8;k++)G.part(p,F,Object.assign({name:'Mountain',pos:[-18,2+k*4,-18],size:[60-k*7,4,60-k*7],color:k>5?'#ffffff':['#9e9e9e','#a7a7a7','#b0b0b0','#bdbdbd','#cfcfcf','#e0e0e0'][k],material:k>4?'Snow':'Slate'},U));
    G.part(p,F,Object.assign({name:'Pond',pos:[30,.05,-30],size:[26,.2,20],color:'#b3e5fc',material:'Ice'},U));
    [[30,22],[44,42],[10,46]].forEach(([x,z])=>house(F,x,z,10,8,10,'#8d6e63','Wood','#f5f5f5'));
    [[-50,30],[-40,50],[50,-50],[-52,-52],[-20,40]].forEach(([x,z])=>{G.part(p,F,{name:'PineTrunk',pos:[x,2,z],size:[1.2,4,1.2],color:'#5d4037',material:'Wood'});[6,4.4,2.6].forEach((w,i)=>G.part(p,F,{name:'Pine',pos:[x,5+i*2.4,z],size:[w,2.4,w],color:'#1b5e20',material:'Grass'}));});
    G.part(p,F,{name:'SkiLodge',pos:[-18,34.6,-18],size:[8,2,8],color:'#ff7043',material:'Wood',label:'SUMMIT'});}
  // 4. Pirate Cove
  {const F=mapModel('Pirate Cove');
    G.part(p,F,Object.assign({name:'Ground',pos:[0,-1,0],size:[110,2,110],color:'#f2d79b',material:'Sand'},U));
    for(let i=0;i<6;i++)G.part(p,F,{name:'Dock',pos:[0,.6,-52-i*4],size:[8,1,3.8],color:'#8d6e63',material:'Wood'});
    for(let i=0;i<4;i++)G.part(p,F,{name:'Hull',pos:[20,2.5,-58-i*8],size:[14,7,8],color:'#5d4037',material:'Wood'});
    for(let i=0;i<4;i++)G.part(p,F,{name:'Deck',pos:[20,6.3,-58-i*8],size:[13,.6,8],color:'#a1887f',material:'Wood'});
    G.part(p,F,{name:'Gangplank',shape:'wedge',pos:[9,3.3,-70],size:[8,6,4],rot:[0,90,0],color:'#bcaaa4',material:'Wood'});
    G.part(p,F,{name:'Mast',shape:'cyl',pos:[20,16,-70],size:[1.2,20,1.2],color:'#4e342e',material:'Wood'});G.part(p,F,{name:'Sail',pos:[20,17,-69],size:[10,10,.3],color:'#fafafa',material:'Fabric'});
    G.part(p,F,{name:'CrowsNest',pos:[20,26.5,-70],size:[4,1,4],color:'#6d4c41',material:'Wood'});
    tower(F,-36,-30,8,30,'#f5f5f5','Concrete',5,'#e53935');G.part(p,F,{name:'Lamp',pos:[-36,31,-30],size:[6,2,6],color:'#ffeb3b',material:'Neon'});
    [[-20,20],[30,30],[-40,40],[10,0],[40,-10]].forEach(([x,z])=>{G.part(p,F,{name:'PalmTrunk',pos:[x,4,z],size:[1.2,8,1.2],color:'#8d6e63',material:'Wood'});G.part(p,F,{name:'PalmLeaves',pos:[x,8.3,z],size:[7,.6,7],color:'#43a047',material:'Grass'});});
    G.part(p,F,Object.assign({name:'Rock',pos:[38,3,40],size:[10,6,8],color:'#8d8d8d',material:'Slate'},U));
    house(F,0,30,10,7,8,'#bcaaa4','Wood','#795548');G.part(p,F,{name:'Treasure',pos:[0,1,30],size:[3,2,2],color:'#ffca28',material:'Metal',label:'TREASURE'});}
  // 5. Theme Park
  {const F=mapModel('Theme Park');
    G.part(p,F,Object.assign({name:'Ground',pos:[0,-1,0],size:[124,2,124],color:'#7cb342',material:'Grass'},U));
    G.part(p,F,Object.assign({name:'Path',pos:[0,.05,0],size:[10,.1,124],color:'#d7ccc8',material:'Concrete'},U));
    // ferris wheel: a ring of cabins on a frame
    G.part(p,F,{name:'WheelPost',pos:[-34,11,-30],size:[2,22,2],color:'#eceff1',material:'Metal'});
    for(let i=0;i<12;i++){const a=i/12*Math.PI*2;G.part(p,F,{name:'Cabin',pos:[-34,r3(22+Math.sin(a)*14),r3(-30+Math.cos(a)*14)],size:[3,3,3],color:['#e53935','#fdd835','#1e88e5','#43a047'][i%4],material:'Plastic'});}
    // roller coaster towers and track
    for(let i=0;i<6;i++){const h=6+i*3;G.part(p,F,{name:'CoasterPillar',pos:[20+i*6,h/2,-40],size:[1,h,1],color:'#90a4ae',material:'Metal'});G.part(p,F,{name:'Track',pos:[20+i*6,h+.3,-40],size:[6,.6,3],color:'#e53935',material:'Metal'});}
    tower(F,50,-10,8,26,'#ff7043','Plastic',4,'#ffeb3b');
    // carousel and stalls
    G.part(p,F,{name:'Carousel',shape:'cyl',pos:[24,1,24],size:[16,2,16],color:'#f8bbd0',material:'Wood'});G.part(p,F,{name:'CarouselRoof',shape:'cyl',pos:[24,9,24],size:[18,1,18],color:'#ec407a',material:'Fabric'});
    for(let i=0;i<6;i++){const a=i/6*Math.PI*2;G.part(p,F,{name:'Pole',pos:[r3(24+Math.cos(a)*6),5,r3(24+Math.sin(a)*6)],size:[.5,7,.5],color:'#ffd54f',material:'Metal'});}
    [[-40,30,'#ffcc80'],[-24,44,'#b39ddb'],[-50,10,'#80cbc4']].forEach(([x,z,c])=>house(F,x,z,9,7,8,c,'Wood','#f44336'));}
  // 6. Desert Oasis
  {const F=mapModel('Desert Oasis');
    G.part(p,F,Object.assign({name:'Ground',pos:[0,-1,0],size:[124,2,124],color:'#e6c27a',material:'Sand'},U));
    G.part(p,F,Object.assign({name:'Oasis',shape:'cyl',pos:[10,.05,10],size:[22,.2,22],color:'#29b6f6',material:'Glass'},U));
    for(let k=0;k<5;k++)G.part(p,F,Object.assign({name:'Pyramid',pos:[-36,1.5+k*3,-30],size:[30-k*6,3,30-k*6],color:['#d7b56d','#cfa95a','#c49c4c','#b98e3f','#ad8133'][k],material:'Sand'},U));
    [[30,-30,'#d7ccc8'],[-30,30,'#bcaaa4'],[36,30,'#efebe9']].forEach(([x,z,c])=>house(F,x,z,10,7,10,c,'Sand','#8d6e63'));
    tower(F,46,0,7,26,'#d7ccc8','Sand',4,'#8d6e63');
    [[0,-40],[-48,0],[18,40],[50,-50]].forEach(([x,z])=>{G.part(p,F,{name:'PalmTrunk',pos:[x,4,z],size:[1.2,8,1.2],color:'#8d6e63',material:'Wood'});G.part(p,F,{name:'PalmLeaves',pos:[x,8.3,z],size:[7,.6,7],color:'#43a047',material:'Grass'});});
    G.part(p,F,{name:'Camel',pos:[-10,2,40],size:[6,3,2],color:'#c49c4c',material:'Plastic'});}
  // 7. Rainforest Village: treehouses on stilts, rope bridges and a waterfall cliff
  {const F=mapModel('Rainforest Village');
    G.part(p,F,Object.assign({name:'Ground',pos:[0,-1,0],size:[124,2,124],color:'#33691e',material:'Grass'},U));
    G.part(p,F,Object.assign({name:'River',pos:[0,.05,30],size:[124,.2,10],color:'#4fc3f7',material:'Glass'},U));
    for(let k=0;k<6;k++)G.part(p,F,Object.assign({name:'Cliff',pos:[40,2+k*4,-40],size:[36-k*4,4,30-k*3],color:['#5d4037','#6d4c41','#795548','#5d4037','#4e342e','#3e2723'][k],material:'Slate'},U));
    G.part(p,F,{name:'Waterfall',pos:[40,12,-24.5],size:[8,24,1],color:'#81d4fa',material:'Glass',transparency:.4,canCollide:false});
    const th=(x,z,h)=>{[[-3,-3],[3,-3],[3,3],[-3,3]].forEach(([dx,dz])=>G.part(p,F,{name:'Stilt',pos:[x+dx,h/2,z+dz],size:[1,h,1],color:'#6d4c41',material:'Wood'}));
      G.part(p,F,{name:'Deck',pos:[x,h+.3,z],size:[9,.6,9],color:'#a1887f',material:'Wood'});G.part(p,F,{name:'Hut',pos:[x,h+2.8,z],size:[6,4.4,6],color:'#8d6e63',material:'Wood'});G.part(p,F,{name:'Thatch',pos:[x,h+5.4,z],size:[8,.8,8],color:'#c0a060',material:'Grass'});
      for(let i=0;i<Math.ceil(h/2);i++)G.part(p,F,{name:'Ladder',pos:[x+5,1+i*2,z-3+i*(6/Math.ceil(h/2))],size:[2.4,.6,2],color:'#795548',material:'Wood'});};
    th(-35,-30,10);th(-20,10,12);th(10,-15,8);th(-40,40,14);
    G.part(p,F,{name:'RopeBridge',pos:[-27.5,10.3,-10],size:[2.4,.4,40],rot:[0,-20,0],color:'#bcaaa4',material:'Wood'});
    for(let i=0;i<10;i++){const x=((i*43)%110)-55,z2=((i*71)%110)-55;if(Math.abs(z2-30)<8)continue;tree(F,x,z2,8,'#1b5e20');}}
  const centers=MAPS.map(m=>{const list=[p.nodes.find(n=>n.id===m.id),...p.nodes.filter(n=>n.parent===m.id)];const c=nodesBounds(list).getCenter(new V3());return [r3(c.x),r3(c.y),r3(c.z)];});
  /* ---------- disasters ---------- */
  const D='vdis',D2='vdis2',MP_='vmap';const VARS=[['disaster',D],['second disaster',D2],['map',MP_]];
  const on=k=>G.OR(G.cmp(G.vget(D),'EQ',G.num(k)),G.cmp(G.vget(D2),'EQ',G.num(k)));
  const notOn=k=>({block:{type:'logic_negate',inputs:{BOOL:on(k)}}});
  const near=(nm,r)=>G.cmp({block:{type:'s_distance',inputs:{PART:G.pnamed(nm)}}},'LT',G.num(r));
  const prop=(part,a)=>({block:{type:'s_prop',fields:{PROP:a},inputs:{PART:part}}});
  const park=(part,x,z)=>blk('p_setpos',{PART:part,X:bn(x||0),Y:bn(-80),Z:bn(z||0)});
  const brk=(x,y,z,r,pw)=>blk('p_break',{R:bn(r),X:typeof x==='number'?bn(x):x,Y:typeof y==='number'?bn(y):y,Z:typeof z==='number'?bn(z):z,P:bn(pw)});
  // every disaster script starts with the match, waits for the pick, then runs while its disaster is on
  const dscript=(part,name,k,body,after,extraVars)=>G.vars(G.script(p,part,name,blk('ev_msg',null,{MSG:'round start'}),G.wait(5.4),G.iff(notOn(k),G.wait(3)),
    blk('controls_whileUntil',{BOOL:on(k),DO:doIn(...body)},{MODE:'WHILE'}),...(after||[])),[...VARS,...(extraVars||[])]);
  const DS=G.folder(p,'Disasters').id;const PP=o=>G.part(p,DS,Object.assign({unbreakable:true,canCollide:false},o));
  // 1 flood
  const flood=PP({name:'Flood',pos:[0,-80,0],size:[130,4,130],color:'#1e88e5',material:'Glass',transparency:.35});
  dscript(flood.id,'Rise',1,[blk('p_setpos',{PART:bme(),X:bn(0),Y:bn(-4),Z:bn(0)}),G.sound('splash'),blk('p_glide',{PART:bme(),X:bn(0),Y:bn(16),Z:bn(0),S:bn(24)}),G.until(notOn(1))],[park(bme())]);
  G.vars(G.script(p,flood.id,'Drown',blk('ev_start'),G.forever(G.ifElse(G.AND(on(1),G.cmp(G.arith('ADD',G.ppos('y'),G.num(1)),'LT',G.arith('ADD',prop(bme(),'y'),G.num(2)))),
    [blk('pl_damage',{N:bn(7)}),G.wait(.5)],[G.wait(.3)]))),VARS);
  // 2 tsunami: waves smash through buildings
  const wave=PP({name:'Tsunami',pos:[0,-80,0],size:[132,16,10],color:'#29b6f6',material:'Glass',transparency:.25});
  p.nodes.push(emitterNode({parent:wave.id,name:'Spray',rate:30,speed:8},'snow'));
  dscript(wave.id,'Sweep',2,[G.msg('The sea pulls back... get HIGH!',2),G.wait(3),blk('p_setpos',{PART:bme(),X:bn(0),Y:bn(3),Z:bn(-80)}),G.sound('splash'),
    blk('p_glide',{PART:bme(),X:bn(0),Y:bn(0),Z:bn(160),S:bn(7)}),park(bme()),G.wait(3)],[park(bme())]);
  dscript(wave.id,'Smash',2,[G.wait(.3),G.iff(G.AND(G.cmp(prop(bme(),'y'),'GT',G.num(0)),G.cmp(prop(bme(),'z'),'LT',G.num(66))),
    ...[-48,-24,0,24,48].map(x=>brk(x,4,prop(bme(),'z'),11,55)))]);
  G.vars(G.script(p,wave.id,'Hit',blk('ev_touch'),G.iff(on(2),blk('pl_damage',{N:bn(35)}),blk('pl_fling',{P:bn(70)}),G.sound('splash')),G.wait(1.5)),VARS);
  // 3 meteor shower: red circles warn, impacts blast buildings apart
  for(let k=1;k<=8;k++){const sh=PP({name:'MeteorShadow'+k,shape:'cyl',pos:[0,-80,0],size:[9,.2,9],color:'#ff1744',material:'Neon',transparency:.45});
    const m=PP({name:'Meteor'+k,shape:'ball',pos:[0,-90,0],size:[4,4,4],color:'#ff7043',material:'Neon'});
    p.nodes.push(emitterNode({parent:m.id,name:'Trail'},'fire'),emitterNode({parent:sh.id,name:'Blast',enabled:false,speed:24,rate:60},'smoke'));
    const XV='vmtx'+k,ZV='vmtz'+k;
    dscript(m.id,'Fall',3,[G.wait(G.rnd(0,2)),G.vset(XV,G.rnd(-55,55)),G.vset(ZV,G.rnd(-55,55)),
      blk('p_setpos',{PART:G.pnamed('MeteorShadow'+k),X:G.vget(XV),Y:bn(.3),Z:G.vget(ZV)}),blk('p_setpos',{PART:bme(),X:G.vget(XV),Y:bn(80),Z:G.vget(ZV)}),
      blk('p_glideto',{PART:bme(),X:G.vget(XV),Y:bn(1.5),Z:G.vget(ZV),S:bn(1.8)}),G.sound('explode'),blk('pe_emit',{N:bn(40),PART:G.pnamed('MeteorShadow'+k)}),brk(G.vget(XV),2,G.vget(ZV),8,70),
      G.iff(near('Meteor'+k,9),blk('pl_damage',{N:bn(40)}),blk('pl_knock',{WHO:bme(),P:bn(60)},{RAG:'TRUE'})),park(bme()),park(G.pnamed('MeteorShadow'+k))],
      [park(bme()),park(G.pnamed('MeteorShadow'+k))],[['meteor x'+k,XV],['meteor z'+k,ZV]]);}
  // 4 tornado: rips up anything it touches
  const TM=G.model(p,'Tornado',DS);
  const TP=[[6,0],[9,6],[13,12],[18,18],[24,24]].map(([w,y],i)=>G.part(p,TM.id,{name:i?'Funnel':'TornadoBase',shape:'cyl',pos:[0,-100+y+3,0],size:[w,6,w],color:'#8a8f98',material:'Glass',transparency:.45+i*.06,canCollide:false,unbreakable:true}));
  p.nodes.push(emitterNode({parent:TP[0].id,name:'Dust',rate:30,speed:10},'smoke'),emitterNode({parent:TP[3].id,name:'Cloud',rate:16,speed:6},'smoke'));
  const TMn=G.mnamed('Tornado');
  dscript(TP[0].id,'Roam',4,[G.iff(G.cmp(prop(TMn,'y'),'LT',G.num(0)),blk('p_setpos',{PART:TMn,X:G.rnd(-50,50),Y:bn(15),Z:bn(-55)})),
    blk('p_glideto',{PART:TMn,X:G.rnd(-50,50),Y:bn(15),Z:G.rnd(-50,50),S:bn(4)})],[park(TMn)]);
  dscript(TP[1].id,'Rip',4,[G.wait(.3),brk(prop(G.pnamed('TornadoBase'),'x'),3,prop(G.pnamed('TornadoBase'),'z'),9,85)]);
  G.vars(G.script(p,TP[0].id,'Suck',blk('ev_start'),G.forever(G.ifElse(G.AND(on(4),near('TornadoBase',12)),[blk('pl_damage',{N:bn(15)}),blk('pl_fling',{P:bn(75)}),G.sound('boost'),G.wait(1.5)],
    [G.ifElse(G.AND(on(4),near('TornadoBase',32)),[blk('pl_knock',{WHO:G.pnamed('TornadoBase'),P:bn(-14)},{RAG:'FALSE'}),G.wait(.35)],[G.wait(.3)])]))),VARS);
  // 5 volcano: cracks glow, then burst into lava that melts nearby buildings; lava bombs rain down
  for(let k=1;k<=8;k++){const l=PP({name:'LavaCrack'+k,shape:'cyl',pos:[0,-80,0],size:[10,.6,10],color:'#5d1a00',material:'Slate'});
    p.nodes.push(emitterNode({parent:l.id,name:'Steam',rate:8},'smoke'));const XV='vlx'+k,ZV='vlz'+k;
    dscript(l.id,'Erupt',5,[G.vset(XV,G.rnd(-52,52)),G.vset(ZV,G.rnd(-52,52)),blk('p_setpos',{PART:bme(),X:G.vget(XV),Y:bn(.35),Z:G.vget(ZV)}),blk('p_color',{PART:bme()},{COLOUR:'#5d1a00'}),G.wait(1.6),
      blk('p_deadly',{PART:bme()},{B:'TRUE'}),blk('p_color',{PART:bme()},{COLOUR:'#ff3d00'}),G.sound('explode'),brk(G.vget(XV),2,G.vget(ZV),6,40),G.wait(G.rnd(3,5)),blk('p_deadly',{PART:bme()},{B:'FALSE'}),park(bme()),G.wait(G.rnd(0,1))],
      [blk('p_deadly',{PART:bme()},{B:'FALSE'}),park(bme())],[['lava x'+k,XV],['lava z'+k,ZV]]);}
  // 6 earthquake: the ground shakes, buildings crumble and rubble falls
  G.vars(G.script(p,'sss','Quake',blk('ev_start'),G.forever(G.ifElse(on(6),[G.iff(G.AND({block:{type:'s_grounded'}},G.cmp(G.ppos('y'),'LT',G.num(60))),blk('pl_launch',{P:G.rnd(14,28)}),blk('pl_damage',{N:bn(2)})),blk('g_shake',null,{POW:'.7'}),G.sound('explode'),G.wait(G.rnd(1,2))],[G.wait(.3)]))),VARS);
  dscript('sss','Crumble',6,[G.wait(G.rnd(1,2)),brk(G.rnd(-55,55),G.rnd(2,20),G.rnd(-55,55),9,16)]);
  for(let k=1;k<=6;k++){const r=PP({name:'Rubble'+k,pos:[0,-80,0],size:[3+k%3,3,3+(k+1)%3],color:['#8d6e63','#9e9e9e','#bcaaa4'][k%3],material:'Brick'});const XV='vrx'+k,ZV='vrz'+k;
    dscript(r.id,'Drop',6,[G.wait(G.rnd(1,4)),G.vset(XV,G.rnd(-50,50)),G.vset(ZV,G.rnd(-50,50)),blk('p_setpos',{PART:bme(),X:G.vget(XV),Y:bn(45),Z:G.vget(ZV)}),
      blk('p_glide',{PART:bme(),X:bn(0),Y:bn(-43),Z:bn(0),S:bn(1.4)}),G.sound('explode'),brk(G.vget(XV),2,G.vget(ZV),5,40),G.iff(near('Rubble'+k,5),blk('pl_damage',{N:bn(30)}),blk('pl_knock',{WHO:bme(),P:bn(60)},{RAG:'TRUE'})),park(bme())],
      [park(bme())],[['rubble x'+k,XV],['rubble z'+k,ZV]]);}
  // 7 lightning storm
  for(let k=1;k<=4;k++){const mk=PP({name:'StrikeMark'+k,shape:'cyl',pos:[0,-80,0],size:[12,.2,12],color:'#fff176',material:'Neon',transparency:.5});
    PP({name:'Bolt'+k,pos:[0,-200,0],size:[1.2,90,1.2],color:'#fffde7',material:'Neon'});const XV='vsx'+k,ZV='vsz'+k;
    dscript(mk.id,'Strike',7,[G.wait(G.rnd(0,2)),G.vset(XV,G.rnd(-55,55)),G.vset(ZV,G.rnd(-55,55)),blk('p_setpos',{PART:bme(),X:G.vget(XV),Y:bn(.3),Z:G.vget(ZV)}),G.sound('click'),G.wait(1.1),
      blk('p_setpos',{PART:G.pnamed('Bolt'+k),X:G.vget(XV),Y:bn(45),Z:G.vget(ZV)}),G.sound('explode'),brk(G.vget(XV),6,G.vget(ZV),5,45),
      G.iff(near('StrikeMark'+k,6.5),blk('pl_damage',{N:bn(45)}),blk('pl_knock',{WHO:bme(),P:bn(50)},{RAG:'TRUE'})),G.wait(.25),
      blk('p_setpos',{PART:G.pnamed('Bolt'+k),X:bn(0),Y:bn(-200),Z:bn(0)}),park(bme())],[park(bme())],[['strike x'+k,XV],['strike z'+k,ZV]]);}
  // 8 blizzard: freezing wind slows everyone and hailstones crash down
  for(let k=1;k<=6;k++){const h=PP({name:'Hail'+k,shape:'ball',pos:[0,-80,0],size:[2.4,2.4,2.4],color:'#e1f5fe',material:'Ice'});const XV='vhx'+k,ZV='vhz'+k;
    dscript(h.id,'Hail',8,[G.wait(G.rnd(0,2)),G.vset(XV,G.rnd(-55,55)),G.vset(ZV,G.rnd(-55,55)),blk('p_setpos',{PART:bme(),X:G.vget(XV),Y:bn(60),Z:G.vget(ZV)}),
      blk('p_glideto',{PART:bme(),X:G.vget(XV),Y:bn(1.2),Z:G.vget(ZV),S:bn(1.2)}),G.sound('explode'),brk(G.vget(XV),2,G.vget(ZV),4,30),G.iff(near('Hail'+k,4),blk('pl_damage',{N:bn(25)})),park(bme())],[park(bme())],[['hail x'+k,XV],['hail z'+k,ZV]]);}
  G.vars(G.script(p,'sss','Freezing',blk('ev_msg',null,{MSG:'round start'}),G.wait(6),G.until(G.OR(on(8),G.cmp(G.vget(D),'EQ',G.num(0)))),G.iff(on(8),blk('pl_speed',{V:bn(9)}),blk('pl_jump',{V:bn(38)}),
    G.whileDo(on(8),G.iff(G.cmp(G.rnd(1,4),'EQ',G.num(1)),blk('pl_damage',{N:bn(2)})),G.wait(1)),blk('pl_speed',{V:bn(16)}),blk('pl_jump',{V:bn(50)}))),VARS);
  // 9 sandstorm: a wall of wind pushes everyone east. Hold on behind something!
  const wind=PP({name:'WindSource',pos:[-400,10,0],size:[1,1,1],color:'#d7ccc8',transparency:1});
  const dust=PP({name:'Dust',pos:[0,-80,0],size:[130,30,130],color:'#d7b98e',material:'Glass',transparency:.75});
  dscript(dust.id,'Blow',9,[blk('p_setpos',{PART:bme(),X:bn(0),Y:bn(15),Z:bn(0)}),G.until(notOn(9))],[park(bme())]);
  G.vars(G.script(p,'sss','Gusts',blk('ev_start'),G.forever(G.ifElse(on(9),[blk('pl_knock',{WHO:G.pnamed('WindSource'),P:G.rnd(6,16)},{RAG:'FALSE'}),G.wait(.4)],[G.wait(.4)]))),VARS);
  dscript('sss','Sand blast',9,[G.wait(G.rnd(1,3)),brk(G.rnd(-50,0),G.rnd(2,12),G.rnd(-55,55),6,30)]);
  // 10 alien invasion: UFOs hover over the map and beam people (and buildings) up
  for(let k=1;k<=3;k++){const u=PP({name:'UFO'+k,shape:'ball',pos:[0,-80,0],size:[14,3,14],color:'#90a4ae',material:'Metal'});const bm=PP({name:'Beam'+k,shape:'cyl',pos:[0,-80,0],size:[8,30,8],color:'#76ff03',material:'Neon',transparency:.7});
    dscript(u.id,'Hover',10,[G.iff(G.cmp(prop(bme(),'y'),'LT',G.num(0)),blk('p_setpos',{PART:bme(),X:bn(-80+k*40),Y:bn(70),Z:bn(-70)})),G.vset('vux'+k,G.rnd(-50,50)),G.vset('vuz'+k,G.rnd(-50,50)),blk('p_glideto',{PART:bme(),X:G.vget('vux'+k),Y:bn(34),Z:G.vget('vuz'+k),S:bn(2.5)}),G.sound('boost'),
      blk('p_setpos',{PART:G.pnamed('Beam'+k),X:G.vget('vux'+k),Y:bn(17),Z:G.vget('vuz'+k)}),G.bc('beam '+k),brk(G.vget('vux'+k),4,G.vget('vuz'+k),5,-60),G.wait(2.5),park(G.pnamed('Beam'+k))],
      [park(bme()),park(G.pnamed('Beam'+k))],[['ufo x'+k,'vux'+k],['ufo z'+k,'vuz'+k]]);
    G.vars(G.script(p,'sss','Abduct '+k,G.onMsg('beam '+k),G.iff(G.AND(on(10),near('Beam'+k,5)),G.msg('👽 You are being ABDUCTED! Jump out of the beam!',2),blk('pl_launch',{P:bn(55)}),G.wait(.5),blk('pl_launch',{P:bn(45)}),G.wait(.5),blk('pl_damage',{N:bn(20)}))),VARS);}
  /* ---------- matches ---------- */
  const NAMES=['','FLOOD! The water is rising. Get to high ground!','TSUNAMI! Giant waves are coming. Climb something tall!','METEOR SHOWER! Watch for red circles!',
    'TORNADO! Stay away from the funnel!','VOLCANO! Dark cracks turn into lava!','EARTHQUAKE! Buildings are crumbling!','LIGHTNING STORM! Move away from the glowing rings!','BLIZZARD! Freezing wind slows you down. Watch for hail!','SANDSTORM! The wind pushes you east. Hide behind a wall!','ALIEN INVASION! Stay out of the green tractor beams!'];
  const SKY=['#8ec9ff','#6f8fb0','#6aa5d8','#ff9e80','#9e9e9e','#bf360c','#a1887f','#2b2f45','#eceff1','#c8a165','#1a237e'];
  const say=v=>[1,2,3,4,5,6,7,8,9,10].map(k=>G.iff(G.cmp(G.vget(v),'EQ',G.num(k)),G.msg('⚠ '+NAMES[k],3.5),blk('g_callout',{TEXT:G.txt(String(NAMES[k]).split(/[!.:]/)[0].toUpperCase().slice(0,22))}),blk('g_shake',null,{POW:'.3'}),blk('g_sky',null,{COLOUR:SKY[k]})));
  G.vars(G.script(p,'sss','Match',blk('ev_msg',null,{MSG:'round start'}),G.vset(D,G.num(0)),G.vset(D2,G.num(0)),G.sset('Survived',1),G.vset(MP_,G.rnd(1,MAPS.length)),
    ...MAPS.map((m,i)=>G.iff(G.cmp(G.vget(MP_),'EQ',G.num(i+1)),blk('rs_copy',{X:bn(centers[i][0]),Y:bn(centers[i][1]),Z:bn(centers[i][2])},{NAME:m.name}),G.msg('Map: '+m.name,3))),
    G.wait(5),G.vset(D,G.rnd(1,10)),G.sound('check'),...say(D),
    G.iff(G.cmp(G.rnd(1,3),'EQ',G.num(1)),G.wait(3),G.vset(D2,G.rnd(1,10)),
      blk('controls_whileUntil',{BOOL:G.cmp(G.vget(D2),'NEQ',G.vget(D)),DO:doIn(G.vset(D2,G.rnd(1,10)))},{MODE:'UNTIL'}),G.msg('DOUBLE DISASTER!',2),G.wait(2),...say(D2))),VARS);
  G.vars(G.script(p,'sss','MatchOver',blk('ev_msg',null,{MSG:'round end'}),G.vset(D,G.num(0)),G.vset(D2,G.num(0)),blk('g_sky',null,{COLOUR:SKY[0]}),
    G.iff(G.cmp(G.stat('Survived'),'EQ',G.num(1)),G.sadd('Streak',1),blk('data_change',{KEY:bt('nds_total'),N:bn(1)}),G.sadd('Total Survived',1),G.msg(G.join('You survived! Streak: ',G.stat('Streak'),' (+3 coins)'),3),blk('pl_coins',{N:bn(3)})),blk('pl_speed',{V:bn(16)}),blk('pl_jump',{V:bn(50)}),
    ...MAPS.map((m,i)=>G.iff(G.cmp(G.vget(MP_),'EQ',G.num(i+1)),blk('controls_repeat_ext',{TIMES:bn(3),DO:doIn(blk('p_destroy',{PART:G.mnamed(m.name)}))})))),VARS);
  G.script(p,'sss','Total',blk('ev_data_loaded'),G.sset('Total Survived',G.dget('nds_total',0)));
  G.script(p,'sss','Out',blk('ev_died'),G.sset('Survived',0),G.sset('Streak',0));
  G.welcome(p,G.sset('Streak',0),G.msg('Survive natural disasters with everyone in this game! Every match picks a map and a disaster.',5));
  G.best(p,'Streak','nds_streak');
  return G.def(p,'disasters','Disaster Zone');}

/* 15. Escape the Ghost: everyone is hunted by the same ghosts */
function ghostDef(){const G=GK;const p=G.proj('ghost','Escape the Ghost',{sky:'#0b0f1a',fog:150,brightness:.5,timer:false,saveStats:false,saveCheckpoint:false,deathStyle:'ragdoll'});
  const bp=p.nodes.find(n=>n.name==='Baseplate');Object.assign(bp,{size:[130,2,130],color:'#1c2a1c',material:'Grass'});
  const Mz=G.folder(p,'Haunted Maze');const n=8,S=13,o=-n*S/2;
  let seed=777;const rr=()=>{seed=(seed*16807)%2147483647;return seed/2147483647;};
  const vis=Array.from({length:n},()=>Array(n).fill(false)),right=Array.from({length:n},()=>Array(n).fill(true)),down=Array.from({length:n},()=>Array(n).fill(true));const st=[[0,0]];vis[0][0]=true;
  while(st.length){const [x,y]=st[st.length-1];const nb=[[1,0],[-1,0],[0,1],[0,-1]].map(([dx,dy])=>[x+dx,y+dy,dx,dy]).filter(([a,b])=>a>=0&&b>=0&&a<n&&b<n&&!vis[a][b]);
    if(!nb.length){st.pop();continue;}const [a,b,dx,dy]=nb[Math.floor(rr()*nb.length)];if(dx===1)right[x][y]=false;if(dx===-1)right[a][b]=false;if(dy===1)down[x][y]=false;if(dy===-1)down[a][b]=false;vis[a][b]=true;st.push([a,b]);}
  for(let k=0;k<12;k++){const x=Math.floor(rr()*(n-1)),y=Math.floor(rr()*(n-1));if(rr()<.5)right[x][y]=false;else down[x][y]=false;}
  const wall=(x,z,w,d)=>G.part(p,Mz.id,{name:'Hedge',pos:[r3(x),4,r3(z)],size:[w,8,d],color:'#24402a',material:'Grass'});
  wall(0,o,n*S+1,1);wall(0,-o,n*S+1,1);wall(o,0,1,n*S+1);wall(-o,0,1,n*S+1);
  for(let x=0;x<n;x++)for(let y=0;y<n;y++){if(right[x][y]&&x<n-1)wall(o+(x+1)*S,o+y*S+S/2,1,S+1);if(down[x][y]&&y<n-1)wall(o+x*S+S/2,o+(y+1)*S,S+1,1);}
  for(let i=0;i<14;i++)G.part(p,Mz.id,{name:'Grave',pos:[r3(o+S/2+Math.floor(rr()*n)*S+3),1,r3(o+S/2+Math.floor(rr()*n)*S-4)],size:[2,2,.6],color:'#78909c',material:'Slate'});
  G.spawnAt(p,o+S/2,.5,o+S/2,{size:[6,1,6],color:'#3949ab'});
  const GH='vghosts',GS='vghostspawned',SC='vscared',GV=[['extra ghosts',GH],['ghosts spawned',GS],['scared',SC]];
  const cell=()=>({X:G.arith('ADD',G.num(r3(o+S/2)),G.arith('MULTIPLY',G.rnd(0,n-1),G.num(S))),Z:G.arith('ADD',G.num(r3(o+S/2)),G.arith('MULTIPLY',G.rnd(0,n-1),G.num(S)))});
  const scatter=()=>{const out=[];for(let k=1;k<=5;k++){const c=cell();out.push(blk('p_setpos',{PART:G.pnamed('Key'+k),X:c.X,Y:bn(2),Z:c.Z}));}return out;};
  for(let k=1;k<=5;k++){const key=G.part(p,'workspace',{name:'Key'+k,shape:'ball',pos:[0,-100,0],size:[1.6,1.6,1.6],color:'#ffd54f',material:'Neon',canCollide:false,label:'KEY'});
    p.nodes.push(emitterNode({parent:key.id,name:'Glow'},'sparkles'));
    G.script(p,key.id,'Grab',blk('ev_touch'),G.sadd('Keys',1),G.sound('coin'),blk('p_setpos',{PART:bme(),X:bn(0),Y:bn(-100),Z:bn(0)}),
      G.iff(G.cmp(G.stat('Keys'),'GTE',G.num(5)),G.msg('All 5 keys! Run to the glowing gate!',3),blk('p_color',{PART:G.pnamed('Gate')},{COLOUR:'#3ddc84'}),blk('p_label',{PART:G.pnamed('Gate'),TEXT:bt('ESCAPE!')})));}
  const gate=G.part(p,'workspace',{name:'Gate',pos:[r3(-o-S/2),4,r3(-o-1.2)],size:[8,8,1],color:'#c62828',material:'Neon',label:'LOCKED',canCollide:false});
  const reset=()=>[G.sset('Keys',0),blk('p_color',{PART:G.pnamed('Gate')},{COLOUR:'#c62828'}),blk('p_label',{PART:G.pnamed('Gate'),TEXT:bt('LOCKED')}),...scatter()];
  G.vars(G.script(p,gate.id,'Escape',blk('ev_touch'),G.ifElse(G.cmp(G.stat('Keys'),'GTE',G.num(5)),[G.sound('win'),G.sadd('Night',1),G.msg(G.join('You escaped! Night ',G.stat('Night'),' begins... another ghost joins the hunt.'),4),
      ...reset(),blk('pl_tpxyz',{X:bn(r3(o+S/2)),Y:bn(3),Z:bn(r3(o+S/2))}),G.shChg(GH,1)],[G.msg('The gate is locked. Find all 5 keys!',2),G.wait(1)])),GV);
  const ghostLook={head:'#eceff1',torso:'#cfd8dc',arms:'#eceff1',legs:'#b0bec5'};
  const chase=r=>{G.hscript(p,r.id,'Haunt',blk('ev_start'),G.wait(4),G.forever(G.ifElse(G.cmp(G.nearD(bme()),'LT',G.num(45)),
      [G.walkN(bme())],[blk('rig_walk',{PART:bme(),X:G.rnd(-45,45),Z:G.rnd(-45,45)})]),G.wait(.25)));
    G.script(p,r.id,'Catch',blk('ev_touch'),G.sound('die'),blk('pl_kill'));
    p.nodes.push(emitterNode({parent:r.id,name:'Mist'},'smoke'));};
  const g1=rigNode({name:'Ghost',pos:[r3(-o-S/2),2.6,r3(-o-S/2)],scale:1.2,health:9999,respawn:0,walkSpeed:9,throughWalls:true,colors:ghostLook});p.nodes.push(g1);chase(g1);
  const g2=rigNode({name:'ExtraGhost',parent:'rs',pos:[0,2.6,0],scale:1.1,health:9999,respawn:0,walkSpeed:10,throughWalls:true,colors:ghostLook});p.nodes.push(g2);chase(g2);
  G.vars(G.hscript(p,'sss','More ghosts',blk('ev_start'),G.vset(GS,G.num(0)),G.forever(G.iff(G.cmp(G.vget(GH),'GT',G.vget(GS)),
    G.ifElse(G.cmp(G.vget(GS),'LT',G.num(8)),[blk('rs_copy',{X:bn(r3(-o-S/2)),Y:bn(2.6),Z:bn(r3(o+S/2))},{NAME:'ExtraGhost'}),G.msg('Another ghost joins the hunt...',2)],[]),G.vchg(GS,1)),G.wait(.5))),GV);
  G.vars(G.hscript(p,'sss','Scared',blk('ev_start'),G.forever(G.until(G.cmp(G.vget(SC),'EQ',G.num(1))),blk('rig_speed',{PART:G.pnamed('Ghost'),N:bn(3)}),blk('rig_speed',{PART:G.pnamed('ExtraGhost'),N:bn(3)}),
    G.wait(8),blk('rig_speed',{PART:G.pnamed('Ghost'),N:bn(9)}),blk('rig_speed',{PART:G.pnamed('ExtraGhost'),N:bn(10)}),G.vset(SC,G.num(0)))),GV);
  G.vars(G.script(p,'sss','Caught',blk('ev_died'),G.msg(G.join('The ghost caught you on night ',G.stat('Night'),'. Back to night 1!'),4),G.sset('Night',1),...reset(),
    G.iff(G.cmp(G.players(),'EQ',G.num(1)),G.vset(GH,G.num(0)),G.vset(GS,G.num(0)),blk('controls_repeat_ext',{TIMES:bn(20),DO:doIn(blk('p_destroy',{PART:G.pnamed('ExtraGhost')}))}),
      blk('p_setpos',{PART:G.pnamed('Ghost'),X:bn(r3(-o-S/2)),Y:bn(2.6),Z:bn(r3(-o-S/2))}))),GV);
  G.welcome(p,G.sset('Night',1),G.sset('Keys',0),...scatter(),G.msg('Find 5 glowing keys and reach the gate before the ghost catches you! Hide in the metal lockers when a ghost gets close.',5));
  G.best(p,'Night','ghost_night');
  G.hud(p,'GhostMeter','#311b92',G.join('🔑 ',G.stat('Keys'),'/5   👻 ',G.round({block:{type:'s_distance',inputs:{PART:G.pnamed('Ghost')}}}),' studs away'),.2);
  G.script(p,'sss','Heartbeat',blk('ev_start'),G.forever(G.ifElse(G.cmp({block:{type:'s_distance',inputs:{PART:G.pnamed('Ghost')}}},'LT',G.num(22)),[G.sound('click'),G.wait(.35),G.sound('click'),G.wait(.6)],[G.wait(.5)])));
  // the flashlight stuns a ghost for 3 seconds (8 second recharge)
  const fl=gkGun(p,'pack','Flashlight',{dmg:0,cool:8,color:'#fffde7',speed:300,body:'#fbc02d',tip:'Shine it at a ghost to stun it'});
  const hpn={block:{type:'s_partname',inputs:{PART:{block:{type:'tool_hitpart'},shadow:{type:'p_this'}}}}};
  G.script(p,fl.id,'Stun',blk('ev_tool_hit'),G.iff(G.OR(G.cmp(hpn,'EQ',G.txt('Ghost')),G.cmp(hpn,'EQ',G.txt('ExtraGhost'))),
    blk('rig_speed',{PART:{block:{type:'tool_hitpart'},shadow:{type:'p_this'}},N:bn(0)}),blk('rig_say',{PART:{block:{type:'tool_hitpart'},shadow:{type:'p_this'}},TEXT:bt('AAARGH! The light!'),S:bn(1.5)}),G.sound('check'),
    G.wait(3),blk('rig_speed',{PART:{block:{type:'tool_hitpart'},shadow:{type:'p_this'}},N:bn(9)})));
  // soul orbs give coins; night 3 brings thick fog
  for(let k=0;k<6;k++){const so=G.part(p,'workspace',{name:'SoulOrb'+k,shape:'ball',pos:[r3(o+S/2+Math.floor(rr()*n)*S),2.2,r3(o+S/2+Math.floor(rr()*n)*S)],size:[1.2,1.2,1.2],color:'#80d8ff',material:'Neon',canCollide:false});
    G.script(p,so.id,'Take',blk('ev_touch'),blk('p_visible',{PART:bme()},{B:'FALSE'}),blk('p_setpos',{PART:bme(),X:bn(0),Y:bn(-90),Z:bn(0)}),G.sadd('Souls',1),G.sound('coin'),blk('pl_coins',{N:bn(1)}));}
  G.script(p,'sss','Night mood',blk('ev_start'),G.forever(G.until(G.cmp(G.stat('Night'),'GTE',G.num(3))),blk('g_sky',null,{COLOUR:'#05060c'}),G.msg('Night 3: the fog rolls in...',2),G.until(G.cmp(G.stat('Night'),'LT',G.num(3))),blk('g_sky',null,{COLOUR:'#0b0f1a'})));
  // crypt lockers: step inside to hide. Ghosts can't see you while you hide (but they still bump into you)
  for(let k=0;k<6;k++){const cx=r3(o+S/2+Math.floor(rr()*n)*S),cz=r3(o+S/2+Math.floor(rr()*n)*S);const LK=G.model(p,'Locker'+k).id;
    G.part(p,LK,{name:'LockerBack',pos:[cx+2.6,3.5,cz],size:[.4,7,4],color:'#455a64',material:'Metal'});G.part(p,LK,{name:'LockerSide',pos:[cx+1,3.5,cz-2],size:[3.6,7,.4],color:'#546e7a',material:'Metal'});
    G.part(p,LK,{name:'LockerSide',pos:[cx+1,3.5,cz+2],size:[3.6,7,.4],color:'#546e7a',material:'Metal'});G.part(p,LK,{name:'LockerTop',pos:[cx+1,7.2,cz],size:[3.6,.4,4.4],color:'#37474f',material:'Metal'});
    const inside=G.part(p,'workspace',{name:'LockerInside'+k,pos:[cx+1,3,cz],size:[3,6,3.4],color:'#000000',transparency:.9,canCollide:false,label:'HIDE'});
    G.script(p,inside.id,'Hide',blk('ev_touch'),blk('pl_visible',null,{B:'FALSE'}),G.msg('Hiding in a locker... the ghosts lose track of you.',2),
      blk('controls_whileUntil',{BOOL:{block:{type:'s_touching',inputs:{PART:bme()}}},DO:doIn(G.wait(.3))},{MODE:'WHILE'}),blk('pl_visible',null,{B:'TRUE'}));}
  const lan=G.part(p,'workspace',{name:'Lantern',shape:'ball',pos:[r3(o+3*S+S/2),2,r3(o+5*S+S/2)],size:[1.6,1.6,1.6],color:'#fff59d',material:'Neon',canCollide:false,label:'LANTERN'});
  p.nodes.push(emitterNode({parent:lan.id,name:'Light',rate:8},'sparkles'));
  G.vars(G.script(p,lan.id,'Use',blk('ev_touch'),G.msg('Lantern! The ghosts are scared and slow for 8 seconds.',2.5),G.sound('win'),blk('p_visible',{PART:bme()},{B:'FALSE'}),G.shSet(SC,G.num(1)),
    G.wait(28),blk('p_visible',{PART:bme()},{B:'TRUE'})),GV);
  // heartbeat: the closer the ghost, the faster your heart beats
  G.script(p,'sss','Heartbeat',blk('ev_start'),G.wait(4),G.forever(G.ifElse(G.cmp({block:{type:'s_distance',inputs:{PART:G.pnamed('Ghost')}}},'LT',G.num(22)),
    [G.sound('heart'),G.wait(G.arith('DIVIDE',{block:{type:'s_distance',inputs:{PART:G.pnamed('Ghost')}}},G.num(25))),G.iff(G.cmp({block:{type:'s_distance',inputs:{PART:G.pnamed('Ghost')}}},'LT',G.num(10)),blk('g_shake',null,{POW:'.3'}))],[G.wait(.5)])));
  return G.def(p,'ghost','Escape the Ghost');}

/* 17. Mega Obby: 30 stages */
function megaObbyDef(){const G=GK;const p=G.proj('megaobby','Mega Obby',{sky:'#a5d8ff'});G.noBase(p);G.spawnAt(p,0,40,0,{size:[14,1,14]});
  const C=G.folder(p,'Stages');const P=o=>G.part(p,C.id,o);let z=-10,y=40,x=0,stage=0;
  const col=()=>OBBY_COLS[stage%OBBY_COLS.length];
  const check=()=>{stage++;P({name:'Stage '+stage,pos:[x,y,z-5],size:[10,1,10],color:'#3ddc84',behavior:'check',value:stage,label:'Stage '+stage});z-=10;};
  const T=[
    d=>{for(let i=0;i<5;i++){P({name:'Stone',pos:[x+(i%2?2.5:-2.5),y,z-4],size:[4-d*1.5,1,4-d*1.5],color:col()});z-=7+d*2;}},
    d=>{const L=20+d*10;P({name:'Lava',pos:[x,y-1,z-L/2],size:[14,1,L],color:'#ff3b30',material:'Neon',behavior:'kill'});P({name:'Beam',pos:[x,y+1,z-L/2],size:[2.2-d*1.2,1,L],color:col()});z-=L;},
    d=>{for(let i=0;i<3;i++){P({name:'JumpPad',pos:[x,y,z-3],size:[4,.4,4],color:'#22d3ee',material:'Neon',behavior:'jump',value:75});z-=6;y+=8;P({name:'Ledge',pos:[x,y,z-3],size:[5-d*2,1,5-d*2],color:col()});z-=6;}},
    d=>{for(let i=0;i<4;i++){const n=P({name:'Mover',pos:[x,y,z-5],size:[5-d,1,5-d],color:col()});G.script(p,n.id,'Slide',...SCR.glide(i%2?9:-9,0,0,1.8-d*.8).blocks.blocks);z-=10;}},
    d=>{for(let i=0;i<6;i++){const n=P({name:'Vanish',pos:[x+(i%2?2:-2),y,z-3],size:[3.5,1,3.5],color:'#a8e6ff',transparency:.15});G.script(p,n.id,'Vanish',...SCR.vanish().blocks.blocks);z-=6+d;}},
    d=>{P({name:'Floor',pos:[x,y,z-12],size:[14,1,24],color:col()});for(let i=0;i<(d>.5?2:1);i++){const sp=P({name:'Spinner',pos:[x,y+1.5,z-7-i*10],size:[13,1,1],color:'#ff3b30',material:'Neon',behavior:'kill'});G.script(p,sp.id,'Spin',...SCR.spin(3+d*4).blocks.blocks);}z-=24;},
    d=>{for(let i=0;i<6;i++){P({name:'Zig',pos:[x+(i%2?4:-4),y,z-3],size:[9,1,1.6-d*.3],rot:[0,i%2?35:-35,0],color:col()});z-=5;}},
    d=>{for(let i=0;i<4;i++){P({name:'Step',pos:[x,y+2+i*3,z-3],size:[4,1,3],color:col()});z-=5+d*2;}y+=12;},
    d=>{P({name:'Boost',pos:[x,y,z-3],size:[6,.4,6],color:'#ffd400',material:'Neon',behavior:'speed',value:2.4});z-=6;z-=10+d*6;P({name:'Landing',pos:[x,y,z-4],size:[8,1,8],color:col()});z-=8;},
    d=>{P({name:'Hall',pos:[x,y,z-15],size:[10,1,32],color:col()});for(let i=0;i<4;i++){const n=P({name:'Crusher',pos:[x,y+1.3,z-5-i*7],size:[10,1,1.2],color:'#ff3b30',material:'Neon',behavior:'kill'});G.script(p,n.id,'Bob',...SCR.glide(0,7,0,1.2-d*.4).blocks.blocks);}z-=32;},
    // wall hop: thin walls on alternating sides over a kill floor
    d=>{const L=30;P({name:'Lava',pos:[x,y-3,z-L/2],size:[16,1,L],color:'#ff3b30',material:'Neon',behavior:'kill'});for(let i=0;i<5;i++)P({name:'WallHop',pos:[x+(i%2?3.5:-3.5),y,z-3-i*6],size:[1.2-d*.4,1,5],color:col()});z-=L;},
    // spinning disk with a sweeping bar
    d=>{const dk=P({name:'Disk',shape:'cyl',pos:[x,y,z-9],size:[16,1,16],color:col()});const bar=P({name:'DiskBar',pos:[x,y+1.4,z-9],size:[15,1,1],color:'#ff3b30',material:'Neon',behavior:'kill'});G.script(p,bar.id,'Spin',...SCR.spin(2.5+d*3).blocks.blocks);z-=18;},
    // ghost path: almost invisible tiles
    d=>{for(let i=0;i<6;i++){P({name:'GhostTile',pos:[x+[-3,0,3,0,-3,0][i],y,z-3],size:[3.4-d,1,3.4-d],color:'#e3f2fd',transparency:.82});z-=6;}},
    // tiny tiles over lava
    d=>{P({name:'Lava',pos:[x,y-2,z-14],size:[16,1,28],color:'#ff3b30',material:'Neon',behavior:'kill'});for(let i=0;i<7;i++)P({name:'Tiny',pos:[x+((i*37)%7-3)*1.3,y,z-2-i*4],size:[1.8-d*.6,1,1.8-d*.6],color:col()});z-=28;}
  ];
  const NS=50;for(let s=0;s<NS;s++){const d=Math.min(1,s/(NS-1));T[(s*5)%T.length](d);check();
    if(s%10===9){const zone=(s+1)/10;const sky=['#a5d8ff','#b2ebf2','#ffe0b2','#e1bee7','#ffcdd2','#263238'][zone];
      const ms=P({name:'Milestone'+(s+1),pos:[x,y+3,z+5],size:[10,5,1],color:'#ffd740',material:'Neon',canCollide:false,transparency:.6,label:'⭐ '+(s+1)+' STAGES ⭐'});
      G.vars(G.script(p,ms.id,'Reward',blk('ev_touch'),G.iff(G.cmp(G.vget('vms'+(s+1)),'EQ',G.num(0)),G.vset('vms'+(s+1),G.num(1)),G.sound('win'),G.msg('⭐ '+(s+1)+' stages! +5 coins',2.5),blk('pl_coins',{N:bn(5)}),blk('g_sky',null,{COLOUR:sky}))),[['milestone '+(s+1),'vms'+(s+1)]]);}}
  // a secret room hidden under stage 7
  const sx=x+12;P({name:'SecretPlatform',pos:[sx,40-12,-160],size:[10,1,10],color:'#7e57c2',label:'SECRET!'});
  const sc=P({name:'SecretChest',pos:[sx,40-10.5,-160],size:[3,2,2],color:'#ffb300',material:'Wood',label:'💰'});
  G.vars(G.script(p,sc.id,'Open',blk('ev_touch'),G.iff(G.cmp(G.vget('vsecret'),'EQ',G.num(0)),G.vset('vsecret',G.num(1)),G.sound('win'),G.msg('You found the SECRET ROOM! +10 coins',3),blk('pl_coins',{N:bn(10)}))),[['secret','vsecret']]);
  P({name:'SecretHint',pos:[sx,40-6,-145],size:[1,1,1],color:'#7e57c2',material:'Neon',transparency:.3});
  P({name:'SecretBounce',pos:[sx+3,40-11.3,-163],size:[3,.4,3],color:'#22d3ee',material:'Neon',behavior:'jump',value:95});
  P({name:'Finish',pos:[x,y,z-8],size:[16,1,16],color:'#ffc93c',material:'Metal',behavior:'finish',label:'FINISH'});
  G.welcome(p,G.msg('50 stages that get harder as you go. Every 10 stages pays coins, and there is a secret room somewhere...',5));
  G.hud(p,'Progress','#1565c0',G.join('🏁 ',G.round(G.arith('MINUS',G.num(0),G.ppos('z'))),' of '+Math.round(-z)+' studs climbed'),.5);
  return G.def(p,'megaobby','Mega Obby');}

/* 18. Bomb Tag: players and bots pass one shared bomb; bots only fill the empty spots */
function bombTagDef(){const G=GK;const p=G.proj('bombtag','Bomb Tag',{sky:'#ffd9a8',timer:false,saveStats:false,saveCheckpoint:false,deathStyle:'ragdoll',lobby:true,lobbyWait:12,lobbyRound:150,lobbyScore:'Rounds',lobbyElim:true});
  const bp=p.nodes.find(n=>n.name==='Baseplate');Object.assign(bp,{size:[170,2,170],color:'#d7b98e',material:'Sand'});
  const A=G.folder(p,'Arena');const P=o=>G.part(p,A.id,o);
  P({name:'Floor',pos:[0,.1,0],size:[84,.2,84],color:'#f6e7c8',material:'Wood'});
  [[0,-42,86,2],[0,42,86,2],[-42,0,2,86],[42,0,2,86]].forEach(([x,z,w,d])=>P({name:'Wall',pos:[x,4,z],size:[w,8,d],color:'#e07a5f',material:'Brick'}));
  [[-16,-16],[16,16],[16,-16],[-16,16]].forEach(([x,z])=>P({name:'Pillar',shape:'cyl',pos:[x,6,z],size:[6,12,6],color:'#81b29a',material:'Brick'}));
  [[0,-27,14,2],[0,27,14,2],[-27,0,2,14],[27,0,2,14]].forEach(([x,z,w,d])=>P({name:'Barrier',pos:[x,4,z],size:[w,8,d],color:'#3d405b',material:'Concrete'}));
  [[-34,-34],[34,34],[34,-34],[-34,34]].forEach(([x,z])=>P({name:'SpeedPad',pos:[x,.3,z],size:[5,.4,5],color:'#ffd400',material:'Neon',behavior:'speed',value:1.4}));
  P({name:'Bench',pos:[0,1,56],size:[40,2,4],color:'#8d6e63',material:'Wood',label:'OUT'});
  G.spawnAt(p,0,.5,0,{size:[6,1,6],color:'#f2cc8f'});
  // second map: Candy Land, 300 studs east
  const BOX_='vbox_',BMV=[['map x',BOX_]];const ox=v=>G.arith('ADD',typeof v==='number'?G.num(v):v,G.vget(BOX_));
  {const OX=300,C2=G.folder(p,'Candy Land').id;const Q=o=>G.part(p,C2,o);
    Q({name:'Frosting',pos:[OX,-1,0],size:[170,2,170],color:'#f8bbd0',material:'Plastic'});Q({name:'Floor',pos:[OX,.1,0],size:[84,.2,84],color:'#fce4ec',material:'Plastic'});
    [[0,-42,86,2],[0,42,86,2],[-42,0,2,86],[42,0,2,86]].forEach(([x,z2,w,d],i)=>Q({name:'CandyWall',pos:[OX+x,4,z2],size:[w,8,d],color:['#ff80ab','#80d8ff','#ccff90','#ffe57f'][i],material:'Plastic'}));
    [[-16,-16],[16,16],[16,-16],[-16,16]].forEach(([x,z2],i)=>{Q({name:'Lollipop',shape:'cyl',pos:[OX+x,4,z2],size:[1,8,1],color:'#ffffff',material:'Plastic'});Q({name:'Candy',shape:'ball',pos:[OX+x,9,z2],size:[7,7,2],color:['#e91e63','#9c27b0','#00bcd4','#ff9800'][i],material:'Neon'});});
    [[0,-26],[0,26],[-26,0],[26,0]].forEach(([x,z2])=>Q({name:'Gumdrop',shape:'ball',pos:[OX+x,2,z2],size:[7,5,7],color:'#7cb342',material:'Plastic'}));
    [[-34,-34],[34,34],[34,-34],[-34,34]].forEach(([x,z2])=>Q({name:'SpeedPad',pos:[OX+x,.3,z2],size:[5,.4,5],color:'#ffd400',material:'Neon',behavior:'speed',value:1.4}));
    Q({name:'Bench',pos:[OX,1,56],size:[40,2,4],color:'#ff80ab',material:'Plastic',label:'OUT'});}
    {const OX=600,S3=G.folder(p,'Space Station').id;const Q=o=>G.part(p,S3,o);
    Q({name:'Hull',pos:[OX,-1,0],size:[170,2,170],color:'#263238',material:'Metal'});Q({name:'Floor',pos:[OX,.1,0],size:[84,.2,84],color:'#455a64',material:'Metal'});
    [[0,-42,86,2],[0,42,86,2],[-42,0,2,86],[42,0,2,86]].forEach(([x,z2,w,d])=>Q({name:'Window',pos:[OX+x,4,z2],size:[w,8,d],color:'#80deea',material:'Glass',transparency:.5}));
    [[-16,-16],[16,16],[16,-16],[-16,16]].forEach(([x,z2])=>Q({name:'Reactor',shape:'cyl',pos:[OX+x,6,z2],size:[6,12,6],color:'#00e5ff',material:'Neon'}));
    [[0,-26,14,2],[0,26,14,2],[-26,0,2,14],[26,0,2,14]].forEach(([x,z2,w,d])=>Q({name:'Console',pos:[OX+x,2,z2],size:[w,4,d],color:'#37474f',material:'Metal'}));
    [[-34,-34],[34,34],[34,-34],[-34,34]].forEach(([x,z2])=>Q({name:'SpeedPad',pos:[OX+x,.3,z2],size:[5,.4,5],color:'#ffd400',material:'Neon',behavior:'speed',value:1.4}));
    Q({name:'Bench',pos:[OX,1,56],size:[40,2,4],color:'#607d8b',material:'Metal',label:'OUT'});}
  G.vars(G.script(p,'sss','Pick map',G.onMsg('round start'),G.vset(BOX_,G.arith('MULTIPLY',G.rnd(0,2),G.num(300))),G.ifElse(G.cmp(G.vget(BOX_),'EQ',G.num(0)),[blk('g_sky',null,{COLOUR:'#ffd9a8'})],[G.ifElse(G.cmp(G.vget(BOX_),'EQ',G.num(300)),[blk('g_sky',null,{COLOUR:'#f3c4fb'}),G.msg('Map: CANDY LAND',2)],[blk('g_sky',null,{COLOUR:'#0d1b2a'}),G.msg('Map: SPACE STATION',2)])]),
    blk('pl_tpxyz',{X:ox(G.rnd(-10,10)),Y:bn(3),Z:G.rnd(-10,10)})),BMV);
  const MV=G.matchFlags(p);
  const VH='vholder',VB='vholderbot',VK='vpickbot',VF='vfuse',VLF='vleft',NB='vnbots',VC='vcool',OUT=k=>'vout'+k;
  const VARS=[['holder',VH],['holder is a bot',VB],['picked bot',VK],['fuse',VF],['bots left',VLF],['bots',NB],['cooldown',VC],...[1,2,3,4,5].map(k=>['out'+k,OUT(k)]),...MV,...BMV];
  const eq=(id,n)=>G.cmp(G.vget(id),'EQ',typeof n==='number'?G.num(n):n);
  const COLS=['#e53935','#1e88e5','#43a047','#8e24aa','#fb8c00'],START=[[-30,-30],[30,-30],[-30,30],[30,30],[0,-34]];
  const bot=k=>G.pnamed('Bot'+k),prop=G.prop;
  const botId=k=>G.txt('b'+k);
  const stopWalk=k=>blk('rig_walk',{PART:bot(k),X:prop(bot(k),'x'),Z:prop(bot(k),'z')});
  const isMine=()=>eq(VH,G.myId());
  for(let k=1;k<=5;k++){const r=rigNode({name:'Bot'+k,pos:[START[k-1][0],2.6,START[k-1][1]],health:999,respawn:0,walkSpeed:13,colors:{head:'#ffcc80',torso:COLS[k-1],arms:'#ffcc80',legs:'#37474f'}});p.nodes.push(r);
    const flee=a=>G.arith('ADD',prop(bme(),a),G.arith('ADD',G.arith('MULTIPLY',G.arith('MINUS',prop(bme(),a),G.nearAx(bme(),a)),G.num(.6)),G.rnd(-8,8)));
    G.vars(G.hscript(p,r.id,'Move',blk('ev_start'),G.forever(G.ifElse(eq(OUT(k),1),[G.wait(.5)],[
      G.ifElse(eq(VH,botId(k)),[G.walkN(bme())],[
        G.ifElse(G.AND(eq(VB,0),G.cmp(G.nearD(bme()),'LT',G.num(28))),[blk('rig_walk',{PART:bme(),X:flee('x'),Z:flee('z')})],
          [blk('rig_walk',{PART:bme(),X:G.arith('ADD',prop(bme(),'x'),G.rnd(-14,14)),Z:G.arith('ADD',prop(bme(),'z'),G.rnd(-14,14))}),G.wait(G.rnd(0,1))])])]))),VARS);
    G.vars(G.script(p,r.id,'Tag',blk('ev_touch'),G.iff(G.AND(G.AND(eq(VC,0),eq(OUT(k),0)),G.aliveIn()),
      G.ifElse(isMine(),[G.vset(VC,G.num(1)),G.shSet(VH,botId(k)),G.shSet(VB,G.num(1)),G.sound('pad'),G.msg('Passed! Now run from Bot'+k+'!',1.5),G.wait(1.5),G.vset(VC,G.num(0))],
        [G.iff(eq(VH,botId(k)),G.vset(VC,G.num(1)),G.shSet(VH,G.myId()),G.shSet(VB,G.num(0)),G.sound('pad'),G.wait(1.5),G.vset(VC,G.num(0)))]))),VARS);}
  G.vars(G.script(p,'player','Pass to a player',blk('ev_touch_player'),G.iff(G.AND(isMine(),eq(VC,0)),G.vset(VC,G.num(1)),G.shSet(VH,G.idOf({block:{type:'pl_touched'}})),G.shSet(VB,G.num(0)),
    G.sound('pad'),G.msg(G.join('Passed to ',G.nameOfP({block:{type:'pl_touched'}}),'!'),1.5),G.wait(1.5),G.vset(VC,G.num(0)))),VARS);
  G.vars(G.script(p,'sss','You have it',blk('ev_start'),G.forever(G.until(isMine()),G.sound('check'),G.msg('💣 YOU have the bomb! Tag someone before it blows!',2),G.whileDo(isMine(),blk('g_shake',null,{POW:'.3'}),G.wait(.8)))),VARS);
  const bomb=G.part(p,'workspace',{name:'Bomb',shape:'ball',pos:[0,-50,0],size:[2.6,2.6,2.6],color:'#263238',material:'Metal',canCollide:false});
  p.nodes.push(emitterNode({parent:bomb.id,name:'Fuse',rate:20,speed:4},'fire'));
  p.nodes.push(emitterNode({parent:bomb.id,name:'Boom',enabled:false,speed:30,rate:80},'fire'));
  /* every screen moves the bomb itself (smooth), from the shared "holder" */
  const above=(x,y,z)=>blk('p_setpos',{PART:bme(),X:x,Y:G.arith('ADD',y,G.num(4.4)),Z:z});
  G.vars(G.script(p,bomb.id,'Follow',blk('ev_start'),G.forever(G.ifElse(eq(VB,1),[...[1,2,3,4,5].map(k=>G.iff(eq(VH,botId(k)),above(prop(bot(k),'x'),prop(bot(k),'y'),prop(bot(k),'z'))))],
      [G.ifElse(eq(VB,0),[above(G.axOf(G.byId(G.vget(VH)),'x'),G.arith('ADD',G.axOf(G.byId(G.vget(VH)),'y'),G.num(2.4)),G.axOf(G.byId(G.vget(VH)),'z'))],[blk('p_setpos',{PART:bme(),X:bn(0),Y:bn(-50),Z:bn(0)})])]),
    blk('p_label',{PART:bme(),TEXT:G.vget(VF)}),G.wait(0))),VARS);
  // mystery boxes: dash, super jump or a teleport to a random corner
  [[-34,0],[34,0],[0,-34],[0,34]].forEach(([x,z],i)=>{const mb=P({name:'MysteryBox'+i,pos:[x,1.5,z],size:[2.4,2.4,2.4],color:'#ab47bc',material:'Neon',canCollide:false,label:'?'});
    G.vars(G.script(p,mb.id,'Open',blk('ev_touch'),G.iff(G.aliveIn(),blk('p_visible',{PART:bme()},{B:'FALSE'}),G.sound('win'),G.vset('vbox',G.rnd(1,3)),
      G.ifElse(G.cmp(G.vget('vbox'),'EQ',G.num(1)),[G.msg('DASH! Super speed for 3 seconds',1.5),blk('pl_speed',{V:bn(30)}),G.wait(3),blk('pl_speed',{V:bn(16)})],
        [G.ifElse(G.cmp(G.vget('vbox'),'EQ',G.num(2)),[G.msg('SUPER JUMP!',1.5),blk('pl_launch',{P:bn(110)})],[G.msg('TELEPORT!',1.5),G.ifElse(G.cmp(G.rnd(1,2),'EQ',G.num(1)),[blk('pl_tpxyz',{X:ox(-36),Y:bn(3),Z:bn(-36)})],[blk('pl_tpxyz',{X:ox(36),Y:bn(3),Z:bn(36)})])])]),
      G.wait(12),blk('p_visible',{PART:bme()},{B:'TRUE'}))),[...VARS,['box','vbox']]);});
  G.script(p,'sss','Survivor coins',G.onMsg('round end'),G.iff(G.aliveIn(),blk('pl_coins',{N:bn(5)})));
  G.vars(G.script(p,'sss','Boom',G.onMsg('boom'),blk('pe_emit',{N:bn(80),PART:G.pnamed('Bomb')}),G.sound('explode')),VARS);
  G.vars(G.script(p,'sss','Survived',G.onMsg('bomb round'),G.iff(G.AND(G.aliveIn(),G.NOT(isMine())),G.sadd('Rounds',1))),VARS);
  const nPlaying=G.plCount('playing');
  const setupBots=()=>[G.ifElse(G.cmp(G.players(),'GTE',G.num(6)),[G.vset(NB,G.num(0))],[G.vset(NB,G.arith('MINUS',G.num(6),G.players()))]),G.vset(VLF,G.vget(NB)),
    ...[1,2,3,4,5].map(k=>G.ifElse(G.cmp(G.num(k),'LTE',G.vget(NB)),[G.vset(OUT(k),G.num(0)),blk('p_setpos',{PART:bot(k),X:ox(START[k-1][0]),Y:bn(2.6),Z:bn(START[k-1][1])})],
      [G.vset(OUT(k),G.num(1)),blk('p_setpos',{PART:bot(k),X:ox(-20+k*6.5),Y:bn(4.6),Z:bn(56)})]))];
  const boomBot=[1,2,3,4,5].map(k=>G.iff(eq(VH,botId(k)),blk('rig_fling',{PART:bot(k),P:bn(150)}),G.vset(OUT(k),G.num(1)),G.vchg(VLF,-1),
    G.msg(G.join('BOOM! Bot'+k+' is out. ',G.vget(VLF),' bots left.'),2.5),G.wait(2.6),blk('p_setpos',{PART:bot(k),X:ox(-20+k*6.5),Y:bn(4.6),Z:bn(56)}),blk('rig_say',{PART:bot(k),TEXT:bt('I am out!'),S:bn(2)})));
  G.vars(G.hscript(p,'sss','Game',G.onMsg('round start'),G.vset(VH,G.txt('-')),G.vset(VB,G.num(-1)),G.vset(VF,G.num(0)),...setupBots(),G.wait(3),
    G.whileDo(G.AND(G.inMatch(),G.cmp(G.arith('ADD',nPlaying,G.vget(VLF)),'GTE',G.num(2))),G.vset(VF,G.rnd(9,15)),
      G.ifElse(G.cmp(G.rnd(1,G.arith('ADD',nPlaying,G.vget(VLF))),'LTE',nPlaying),[G.vset(VH,G.idOf(G.pref('randplaying'))),G.vset(VB,G.num(0))],
        [G.vset(VK,G.rnd(1,5)),
         ...[1,2,3,4,5].map(k=>G.iff(G.AND(eq(VK,k),eq(OUT(k),1)),G.vset(VK,G.num(0)))),
         blk('controls_whileUntil',{BOOL:G.cmp(G.vget(VK),'GT',G.num(0)),DO:doIn(G.vset(VK,G.rnd(1,5)),...[1,2,3,4,5].map(k=>G.iff(G.AND(eq(VK,k),eq(OUT(k),1)),G.vset(VK,G.num(0)))))},{MODE:'UNTIL'}),
         G.vset(VH,G.join('b',G.vget(VK))),G.vset(VB,G.num(1))]),
      ...[1,2,3,4,5].map(k=>stopWalk(k)),G.sound('check'),
      G.ifElse(eq(VB,1),[G.msg(G.join('Bot',G.vget(VK),' has the bomb. RUN!'),2)],[G.msg(G.join(G.nameOfP(G.byId(G.vget(VH))),' has the bomb. RUN!'),2)]),
      blk('controls_whileUntil',{BOOL:G.OR(G.NOT(G.inMatch()),G.cmp(G.vget(VF),'LTE',G.num(0))),DO:doIn(
        G.ifElse(G.cmp(G.vget(VF),'LTE',G.num(3)),[G.sound('click'),G.wait(.5),G.sound('click'),G.wait(.5)],[G.sound('click'),G.wait(1)]),G.vchg(VF,-1))},{MODE:'UNTIL'}),
      G.iff(G.inMatch(),G.bc('boom'),
        G.ifElse(eq(VB,1),[...boomBot],[G.asP(G.byId(G.vget(VH)),blk('pl_fling',{P:bn(140)}),G.msg('BOOM! You are out!',3),G.wait(1.2),blk('pl_damage',{N:bn(1000)})),G.wait(2)]),
        G.bc('bomb round')),
      G.vset(VH,G.txt('-')),G.vset(VB,G.num(-1)),G.wait(3)),
    G.vset(VH,G.txt('-')),G.vset(VB,G.num(-1)),G.iff(G.inMatch(),G.bc('bomb winner'),G.msg('We have a winner! Next match soon...',4))),VARS);
  G.script(p,'sss','Winner',G.onMsg('bomb winner'),G.iff(G.aliveIn(),G.sound('win'),G.sadd('Rounds',3),G.msg('🏆 LAST ONE STANDING! You win! +15 coins',4),blk('pl_coins',{N:bn(15)})));
  G.vars(G.hscript(p,'sss','Match over',G.onMsg('round end'),G.vset(VH,G.txt('-')),G.vset(VB,G.num(-1))),VARS);
  G.vars(G.welcome(p,G.vset(VC,G.num(0)),G.msg('Bomb Tag! Whoever holds the bomb when it blows is out. Touch anyone to pass it on, and run when they have it! Bots fill empty spots.',5)),VARS);
  G.best(p,'Rounds','bombtag_rounds');
  G.hud(p,'Bomb','#bf360c',G.join('💣 Fuse ',G.vget(VF),'s   ·   🤖 ',G.vget(VLF),' bots left'));
  return G.def(p,'bombtag','Bomb Tag');}

/* 19. Flag Raid: shared guards */
function flagRaidDef(){const G=GK;const p=G.proj('flagraid','Flag Raid',{sky:'#9fd4ff',timer:false,saveStats:false,saveCheckpoint:false,deathStyle:'ragdoll',lobby:true,lobbyWait:15,lobbyRound:180,lobbyScore:'Captures'});
  const bp=p.nodes.find(n=>n.name==='Baseplate');Object.assign(bp,{size:[200,2,240],color:'#6aa84f',material:'Grass'});
  const F=G.folder(p,'Field');const P=o=>G.part(p,F.id,o);
  [[0,-100,120,2],[0,100,120,2],[-60,0,2,200],[60,0,2,200]].forEach(([x,z,w,d])=>P({name:'Wall',pos:[x,5,z],size:[w,10,d],color:'#8d99ae',material:'Brick'}));
  P({name:'BlueBase',pos:[0,.15,80],size:[30,.3,24],color:'#90caf9',material:'Concrete'});
  P({name:'RedBase',pos:[0,.15,-80],size:[30,.3,24],color:'#ef9a9a',material:'Concrete'});
  P({name:'MidLine',pos:[0,.12,0],size:[118,.2,1],color:'#ffffff',material:'Neon'});
  [[-30,30,16,3],[30,30,16,3],[-14,-20,3,14],[14,-20,3,14],[-40,-45,12,3],[40,-45,12,3],[0,45,10,3],[-24,0,3,12],[24,0,3,12]].forEach(([x,z,w,d])=>P({name:'Hedge',pos:[x,4,z],size:[w,8,d],color:'#2e7d32',material:'Grass'}));
  [[-45,10],[46,-12],[-8,-55],[10,60],[38,62],[-38,-70]].forEach(([x,z])=>P({name:'Crate',pos:[x,2,z],size:[4,4,4],color:'#a1764b',material:'Wood'}));
  P({name:'Tunnel',pos:[-50,4,-30],size:[8,8,30],color:'#6d4c41',material:'Brick',transparency:.55,canCollide:false,label:'SECRET TUNNEL'});
  P({name:'TunnelFloor',pos:[-50,.2,-30],size:[8,.3,30],color:'#4e342e',material:'Wood'});
  P({name:'Tower',pos:[45,8,20],size:[10,16,10],color:'#b0bec5',material:'Concrete'});
  P({name:'TowerPad',pos:[37,.3,20],size:[5,.4,5],color:'#22d3ee',material:'Neon',behavior:'jump',value:100});
  P({name:'SpeedLane',pos:[50,.25,-20],size:[6,.3,40],color:'#ffd400',material:'Neon',behavior:'speed',value:1.6});
  G.spawnAt(p,0,.6,66,{size:[8,1,8],color:'#1e88e5'});
  for(const t of ['Sword','Healing potion']){const ns=G.prefab(p,t);ns[0].parent='pack';}
  G.prefab(p,'Healing potion',{x:-40,y:2,z:40});G.prefab(p,'Healing potion',{x:40,y:2,z:-5});
  // second map: Frozen Valley, 300 studs east. The capture pad and the flag move with the map
  const ROX='vrox',RV=[['map x',ROX]];const ox=v=>G.arith('ADD',typeof v==='number'?G.num(v):v,G.vget(ROX));
  {const OX=300,V2=G.folder(p,'Frozen Valley').id;const Q=o=>G.part(p,V2,o);
    Q({name:'Snowfield',pos:[OX,-1,0],size:[200,2,240],color:'#eceff1',material:'Snow'});
    [[0,-100,120,2],[0,100,120,2],[-60,0,2,200],[60,0,2,200]].forEach(([x,z2,w,d])=>Q({name:'IceWall',pos:[OX+x,5,z2],size:[w,10,d],color:'#b3e5fc',material:'Ice',transparency:.2}));
    Q({name:'BlueBase',pos:[OX,.15,80],size:[30,.3,24],color:'#90caf9',material:'Concrete'});Q({name:'RedBase',pos:[OX,.15,-80],size:[30,.3,24],color:'#ef9a9a',material:'Concrete'});
    Q({name:'River',pos:[OX,.12,0],size:[118,.2,10],color:'#4fc3f7',material:'Ice'});
    [[-20,0],[20,0]].forEach(([x,z2])=>Q({name:'Bridge',pos:[OX+x,.6,z2],size:[8,1,14],color:'#8d6e63',material:'Wood'}));
    for(let i=0;i<14;i++){const x=((i*41)%100)-50,z2=((i*67)%160)-80;if(Math.abs(z2)<10||Math.abs(z2)>70)continue;Q({name:'PineTrunk',pos:[OX+x,2,z2],size:[1.2,4,1.2],color:'#5d4037',material:'Wood'});[6,4.4,2.6].forEach((w,j)=>Q({name:'Pine',pos:[OX+x,5+j*2.4,z2],size:[w,2.4,w],color:'#1b5e20',material:'Grass'}));}
    [[-35,-40],[35,-40],[0,-55]].forEach(([x,z2])=>Q({name:'SnowWall',pos:[OX+x,2,z2],size:[12,4,2],color:'#ffffff',material:'Snow'}));
    Q({name:'Pole',pos:[OX,4,-84],size:[.5,8,.5],color:'#eeeeee',material:'Metal'});}
    {const OX=600,D3=G.folder(p,'Desert Canyon').id;const Q=o=>G.part(p,D3,o);
    Q({name:'Desert',pos:[OX,-1,0],size:[200,2,240],color:'#e6c27a',material:'Sand'});
    [[0,-100,120,2],[0,100,120,2],[-60,0,2,200],[60,0,2,200]].forEach(([x,z2,w,d])=>Q({name:'CanyonWall',pos:[OX+x,7,z2],size:[w,14,d],color:'#bf8040',material:'Slate'}));
    Q({name:'BlueBase',pos:[OX,.15,80],size:[30,.3,24],color:'#90caf9',material:'Concrete'});Q({name:'RedBase',pos:[OX,.15,-80],size:[30,.3,24],color:'#ef9a9a',material:'Concrete'});
    [[-30,20,14,10],[30,-20,14,12],[0,0,10,8],[-35,-45,12,6],[35,45,12,6]].forEach(([x,z2,w,h])=>Q({name:'Mesa',pos:[OX+x,h/2,z2],size:[w,h,w],color:'#d84315',material:'Slate'}));
    [[-15,30],[15,-30]].forEach(([x,z2])=>Q({name:'Cactus',pos:[OX+x,3,z2],size:[1.4,6,1.4],color:'#2e7d32',material:'Grass'}));
    Q({name:'Pole',pos:[OX,4,-84],size:[.5,8,.5],color:'#eeeeee',material:'Metal'});}
  G.vars(G.script(p,'sss','Pick map',G.onMsg('round start'),G.vset(ROX,G.arith('MULTIPLY',G.rnd(0,2),G.num(300))),G.ifElse(G.cmp(G.vget(ROX),'EQ',G.num(0)),[blk('g_sky',null,{COLOUR:'#9fd4ff'})],[G.ifElse(G.cmp(G.vget(ROX),'EQ',G.num(300)),[blk('g_sky',null,{COLOUR:'#cfd8dc'}),G.msg('Map: FROZEN VALLEY',2)],[blk('g_sky',null,{COLOUR:'#ffab91'}),G.msg('Map: DESERT CANYON',2)])]),
    blk('pl_tpxyz',{X:ox(G.rnd(-6,6)),Y:bn(3),Z:bn(66)})),RV);
  const CARRY='vcarry',CR='vcarriers',RE='vreinforce',RS='vrspawned',VARS=[...RV,['carrying',CARRY],['carriers',CR],['reinforcements',RE],['reinforcements spawned',RS]];const carrying=G.cmp(G.vget(CARRY),'EQ',G.num(1));
  P({name:'Pole',pos:[0,4,-84],size:[.5,8,.5],color:'#eeeeee',material:'Metal'});
  const flag=G.part(p,'workspace',{name:'RedFlag',pos:[1.5,7,-84],size:[3,2,.3],color:'#e53935',material:'Neon',canCollide:false,label:'FLAG'});
  p.nodes.push(emitterNode({parent:flag.id,name:'Glow',rate:6},'sparkles'));
  const home=()=>blk('p_setpos',{PART:G.pnamed('RedFlag'),X:ox(1.5),Y:bn(7),Z:bn(-84)});
  G.vars(G.script(p,flag.id,'Grab',blk('ev_touch'),G.iff(G.AND(G.cmp(G.vget(CARRY),'EQ',G.num(0)),{block:{type:'s_pl_alive'}}),G.vset(CARRY,G.num(1)),G.shChg(CR,1),G.sound('check'),
    G.msg('You grabbed the flag! Bring it back to your blue base! Every guard is coming for you...',2.5),blk('p_label',{PART:bme(),TEXT:bt('')}))),VARS);
  G.vars(G.script(p,flag.id,'Follow',blk('ev_start'),G.forever(G.iff(carrying,blk('p_setpos',{PART:bme(),X:G.arith('ADD',G.ppos('x'),G.num(.8)),Y:G.arith('ADD',G.ppos('y'),G.num(3.4)),Z:G.ppos('z')})),G.wait(0))),VARS);
  const cap=G.part(p,'workspace',{name:'CapturePad',pos:[0,.4,84],size:[10,.5,10],color:'#1e88e5',material:'Neon',label:'BRING THE FLAG HERE'});
  G.vars(G.script(p,cap.id,'Capture',blk('ev_touch'),G.iff(carrying,G.vset(CARRY,G.num(0)),G.shChg(CR,-1),G.sadd('Captures',1),G.sound('win'),blk('pe_emit',{N:bn(60),PART:bme()}),
    G.msg(G.join('CAPTURE! Total captures: ',G.stat('Captures'),'. Another guard joins the red team...'),3),home(),blk('p_label',{PART:G.pnamed('RedFlag'),TEXT:bt('FLAG')}),blk('pl_heal',{N:bn(40)}),
    G.shChg(RE,1),G.wait(.5))),VARS);
  p.nodes.push(emitterNode({parent:cap.id,name:'Party',enabled:false},'confetti'));
  const guard=(name,parent,pos,spd)=>{const r=rigNode({name,parent,pos,health:60,respawn:parent==='rs'?0:8,walkSpeed:spd,colors:{head:'#ffcc80',torso:'#c62828',arms:'#ffcc80',legs:'#212121'}});p.nodes.push(r);
    const near=G.AND(G.cmp(G.nearD(bme()),'LT',G.num(26)),G.cmp(G.nearAx(bme(),'z'),'LT',G.num(10)));
    const alarm=G.AND(G.cmp(G.vget(CR),'GT',G.num(0)),G.cmp(G.nearD(bme()),'LT',G.num(60)));
    G.vars(G.hscript(p,r.id,'Guard',blk('ev_start'),G.wait(2),G.forever(G.ifElse(G.OR(alarm,near),
      [G.walkN(bme()),G.wait(.2)],[G.iff(G.OR(G.cmp(G.prop(bme(),'x'),'GT',ox(100)),G.cmp(G.prop(bme(),'x'),'LT',ox(-100))),blk('p_setpos',{PART:bme(),X:ox(G.rnd(-20,20)),Y:bn(2.6),Z:bn(-60)})),blk('rig_walk',{PART:bme(),X:ox(G.rnd(-28,28)),Z:G.rnd(-90,-35)}),G.wait(G.rnd(0,2))]))),VARS);
    G.vars(G.script(p,r.id,'Tackle',blk('ev_touch'),blk('pl_damage',{N:bn(25)}),blk('pl_knock',{WHO:bme(),P:bn(70)},{RAG:'TRUE'}),G.sound('explode'),G.wait(1.5)),VARS);
    G.script(p,r.id,'KO',blk('ev_rig_died'),G.sadd('KOs',1),G.sound('coin'));return r;};
  [[-12,-60,12],[12,-60,12],[0,-40,13],[30,-30,11]].forEach(([x,z,sp])=>guard('Guard','workspace',[x,2.6,z],sp));
  guard('Reinforcement','rs',[0,2.6,0],14);
  G.vars(G.hscript(p,'sss','Reinforce',blk('ev_start'),G.vset(RS,G.num(0)),G.forever(G.iff(G.cmp(G.vget(RE),'GT',G.vget(RS)),G.vchg(RS,1),
    G.iff(G.cmp(G.vget(RS),'LTE',G.num(12)),blk('rs_copy',{X:ox(G.rnd(-20,20)),Y:bn(2.6),Z:bn(-70)},{NAME:'Reinforcement'}))),G.wait(.5))),VARS);
  G.vars(G.script(p,'sss','Dropped',blk('ev_died'),G.iff(carrying,G.vset(CARRY,G.num(0)),G.shChg(CR,-1),home(),blk('p_label',{PART:G.pnamed('RedFlag'),TEXT:bt('FLAG')}),G.msg('You dropped the flag! It went back to the red base.',3)),
    G.msg('Tackled! Back to your base.',2)),VARS);
  G.vars(G.script(p,'sss','New match',G.onMsg('round start'),G.wait(.05),blk('p_setpos',{PART:G.pnamed('CapturePad'),X:ox(0),Y:bn(.4),Z:bn(84)}),G.vset(CARRY,G.num(0)),home(),blk('p_label',{PART:G.pnamed('RedFlag'),TEXT:bt('FLAG')}),G.msg('Most flag captures in 3 minutes wins!',3)),VARS);
  G.vars(G.hscript(p,'sss','New match (host)',G.onMsg('round start'),G.vset(CR,G.num(0)),G.vset(RE,G.num(0)),G.vset(RS,G.num(0)),
    blk('controls_repeat_ext',{TIMES:bn(30),DO:doIn(blk('p_destroy',{PART:G.pnamed('Reinforcement')}))})),VARS);
  G.vars(G.script(p,'sss','Match over',G.onMsg('round end'),G.vset(CARRY,G.num(0)),home(),blk('p_label',{PART:G.pnamed('RedFlag'),TEXT:bt('FLAG')})),VARS);
  G.vars(G.welcome(p,G.vset(CARRY,G.num(0)),G.sset('Captures',0),G.sset('KOs',0),G.msg('Sneak into the red base, grab the flag and bring it home. Guards hit hard: use your sword (1), hedges, the tunnel and the tower!',5)),VARS);
  G.best(p,'Captures','flag_captures');
  G.hud(p,'Raid','#c62828',G.join('🚩 Captures ',G.stat('Captures'),'   ·   🎯 ',G.round(G.arith('ADD',G.arith('MULTIPLY',{block:{type:'s_distance',inputs:{PART:G.pnamed('RedFlag')}}},G.arith('MINUS',G.num(1),G.vget(CARRY))),G.arith('MULTIPLY',{block:{type:'s_distance',inputs:{PART:G.pnamed('CapturePad')}}},G.vget(CARRY)))),' studs to go'));
  // smoke bomb gadget: shield and a burst of speed to escape the guards
  const smk={id:uid(),cls:'Tool',name:'Smoke Bomb',parent:'pack',tooltip:'Escape! 3s shield and speed (15s recharge)',cooldown:15,swing:false};
  const sh=partNode({parent:smk.id,name:'Handle',pos:[0,3,0],size:[.8,.8,.8],shape:'ball',color:'#607d8b',material:'Metal'});smk.handle=sh.id;p.nodes.push(smk,sh);
  G.script(p,smk.id,'Use',blk('ev_tool_act'),G.sound('explode'),G.msg('SMOKE! Run!',1.5),blk('pl_shield',{S:bn(3)}),blk('pl_speed',{V:bn(26)}),G.wait(3),blk('pl_speed',{V:bn(16)}));
  G.script(p,cap.id,'Capture coins',blk('ev_touch'),G.wait(.1),G.iff(G.cmp(G.stat('Captures'),'GT',G.vget('vcc')),G.vset('vcc',G.stat('Captures')),blk('pl_coins',{N:bn(3)})));
  return G.def(p,'flagraid','Flag Raid');}

/* ======================= famous-style games ======================= */
/* tools used by several games */
function gkGun(p,parent,name,o){const T={id:uid(),cls:'Tool',name,parent,tooltip:o.tip||'Click to shoot',cooldown:o.cool,swing:false};
  const h=partNode({parent:T.id,name:'Handle',pos:[0,3,0],size:[.4,.9,.5],color:'#263238'});T.handle=h.id;
  p.nodes.push(T,h,partNode({parent:T.id,name:'Body',pos:[0,3.45,-.5-(o.len||0)/2],size:[.55,.55,1.8+(o.len||0)],color:o.body||'#455a64',material:'Metal'}),
    partNode({parent:T.id,name:'Barrel',shape:'cyl',pos:[0,3.45,-1.4-(o.len||0)],size:[.3,.35,.35],rot:[0,90,0],color:o.color,material:'Neon'}),
    scriptNode({parent:T.id,name:name+' Script',blocks:scriptOf(chain(blk('ev_tool_act'),blk('tool_shoot',{S:bn(o.speed||220)},{COLOUR:o.color})),chain(blk('ev_tool_hit'),hitBranch(o.dmg,o.extra)))}));return T;}
function gkMelee(p,parent,name,o){const T={id:uid(),cls:'Tool',name,parent,tooltip:o.tip||'Click to swing',cooldown:o.cool||.45,swing:true};
  const h=partNode({parent:T.id,name:'Handle',pos:[0,3,0],size:[.4,.4,1.2],color:'#4e342e',material:'Wood'});T.handle=h.id;
  p.nodes.push(T,h,partNode({parent:T.id,name:'Blade',pos:[0,3,-1.8],size:[.18,.4,2.4],color:o.color||'#dfe6f5',material:o.mat||'Metal'}));
  if(o.script!==false)p.nodes.push(scriptNode({parent:T.id,name:name+' Script',blocks:scriptOf(chain(blk('ev_tool_hit'),hitBranch(o.dmg,doIn(blk('g_sound',null,{SND:'explode'})))))}));return T;}

/* 20. Tower of Chaos: a random tower, the same for everyone, rebuilt every match */
/* bots that fill a lobby up to `total` fighters: they chase, shoot and can be knocked out. Host-run so everyone sees the same bots */
function gkFighterBots(p,o){const G=GK;const NB='vfbots',BV=[['fighter bots',NB],...(o.ox?[['map x',o.ox]]:[])],OX=v=>o.ox?G.arith('ADD',typeof v==='number'?G.num(v):v,G.vget(o.ox)):(typeof v==='number'?bn(v):v),n=o.max||5,cols=o.cols||['#e53935','#1e88e5','#43a047','#8e24aa','#fb8c00'];
  for(let k=1;k<=n;k++){const home=o.home[(k-1)%o.home.length];const r=rigNode({name:'Fighter'+k,pos:[home[0],2.6+(o.y||0),home[1]],health:o.hp||100,respawn:4,walkSpeed:o.speed||14,colors:{head:'#ffcc80',torso:cols[(k-1)%cols.length],arms:'#ffcc80',legs:'#212121'}});p.nodes.push(r);
    G.part(p,'workspace',{name:'FBolt'+k,shape:'ball',pos:[0,-50,0],size:[.8,.8,.8],color:cols[(k-1)%cols.length],material:'Neon',canCollide:false,unbreakable:true});
    G.vars(G.hscript(p,r.id,'Fight',blk('ev_start'),G.forever(G.ifElse(G.cmp(G.num(k),'GT',G.vget(NB)),[G.wait(.5)],
      [G.ifElse(G.cmp(G.nearD(bme()),'LT',G.num(32)),[blk('rig_walk',{PART:bme(),X:G.arith('ADD',G.nearAx(bme(),'x'),G.rnd(-9,9)),Z:G.arith('ADD',G.nearAx(bme(),'z'),G.rnd(-9,9))})],
        [G.ifElse(G.cmp(G.rnd(1,3),'EQ',G.num(1)),[blk('rig_walk',{PART:bme(),X:OX(G.rnd(-o.area,o.area)),Z:G.rnd(-o.area,o.area)})],[G.walkN(bme())]),G.wait(.3)])]))),BV);
    G.vars(G.hscript(p,r.id,'Shoot',blk('ev_start'),G.forever(G.wait(G.rnd(1,2)),G.iff(G.AND(G.cmp(G.num(k),'LTE',G.vget(NB)),G.AND(G.cmp({block:{type:'s_rig_health',inputs:{PART:bme()}}},'GT',G.num(0)),G.cmp(G.nearD(bme()),'LT',G.num(40)))),
      blk('p_setpos',{PART:G.pnamed('FBolt'+k),X:G.prop(bme(),'x'),Y:G.arith('ADD',G.prop(bme(),'y'),G.num(1)),Z:G.prop(bme(),'z')}),
      blk('p_glideto',{PART:G.pnamed('FBolt'+k),X:G.nearAx(bme(),'x'),Y:G.arith('ADD',G.nearAx(bme(),'y'),G.num(2.5)),Z:G.nearAx(bme(),'z'),S:bn(.35)}),
      G.iff(G.AND(G.cmp(G.nearD(G.pnamed('FBolt'+k)),'LT',G.num(4.8)),G.cmp(G.rnd(1,10),'LTE',G.num(Math.min(10,(o.acc||5)+3)))),G.asP({block:{type:'pl_ref_nearpart',inputs:{PART:G.pnamed('FBolt'+k)}}},blk('pl_damage',{N:bn(o.dmg||14)}))),
      blk('p_setpos',{PART:G.pnamed('FBolt'+k),X:bn(0),Y:bn(-50),Z:bn(0)})))),BV);
    G.script(p,r.id,'KO',blk('ev_rig_died'),G.sadd(o.stat||'KOs',1));
    G.vars(G.hscript(p,r.id,'Back to map',blk('ev_rig_died'),G.wait(4.3),blk('p_setpos',{PART:bme(),X:OX(home[0]),Y:bn(2.6+(o.y||0)),Z:bn(home[1])})),BV);}
  G.vars(G.hscript(p,'sss','Fill with bots',G.onMsg(o.msg||'round start'),G.ifElse(G.cmp(G.players(),'GTE',G.num(o.total)),[G.vset(NB,G.num(0))],[G.vset(NB,G.arith('MINUS',G.num(o.total),G.players()))]),
    G.iff(G.cmp(G.vget(NB),'GT',G.num(n)),G.vset(NB,G.num(n))),
    ...Array.from({length:n},(_,i)=>{const k=i+1,h=o.home[i%o.home.length];return G.ifElse(G.cmp(G.num(k),'LTE',G.vget(NB)),[blk('rig_heal',{PART:G.pnamed('Fighter'+k),N:bn(1000)}),blk('p_visible',{PART:G.pnamed('Fighter'+k)},{B:'TRUE'}),blk('p_setpos',{PART:G.pnamed('Fighter'+k),X:OX(h[0]),Y:bn(2.6+(o.y||0)),Z:bn(h[1])})],
      [blk('p_visible',{PART:G.pnamed('Fighter'+k)},{B:'FALSE'}),blk('p_setpos',{PART:G.pnamed('Fighter'+k),X:bn(k*6),Y:bn(2.6),Z:bn(300)})]);})),BV);}
/* mystery power-up boxes: speed, super jump, shield, heal or feather (low gravity). Each respawns after 15 seconds */
function gkPowerups(p,spots,o){const G=GK;o=o||{};const y=o.y||1.5;
  spots.forEach(([x,z],i)=>{const b=G.part(p,'workspace',{name:'PowerBox',pos:[x,y,z],size:[2.2,2.2,2.2],color:'#7c4dff',material:'Neon',canCollide:false,label:'?'});
    G.script(p,b.id,'Spin',blk('ev_start'),G.forever(blk('p_rotate',{PART:bme(),DEG:bn(5)},{AXIS:'y'}),G.wait(.04)));
    G.vars(G.script(p,b.id,'Open',blk('ev_touch'),blk('p_visible',{PART:bme()},{B:'FALSE'}),G.sound('win'),G.vset('vpwr',G.rnd(1,5)),
      G.ifElse(G.cmp(G.vget('vpwr'),'EQ',G.num(1)),[G.msg('⚡ SPEED for 6 seconds!',1.5),blk('pl_speed',{V:bn(26)}),G.wait(6),blk('pl_speed',{V:bn(16)})],
       [G.ifElse(G.cmp(G.vget('vpwr'),'EQ',G.num(2)),[G.msg('🦘 SUPER JUMP!',1.5),blk('pl_jump',{V:bn(80)}),G.wait(8),blk('pl_jump',{V:bn(50)})],
        [G.ifElse(G.cmp(G.vget('vpwr'),'EQ',G.num(3)),[G.msg('🛡️ SHIELD for 6 seconds!',1.5),blk('pl_shield',{S:bn(6)}),G.wait(6)],
         [G.ifElse(G.cmp(G.vget('vpwr'),'EQ',G.num(4)),[G.msg('❤️ Full heal!',1.5),blk('pl_heal',{N:bn(200)}),G.wait(1)],[G.msg('🪶 FEATHER: low gravity for 8 seconds!',1.5),blk('pl_gravity',{V:bn(80)}),G.wait(8),blk('pl_gravity',{V:bn(196.2)})])])])]),
      G.wait(9),blk('p_visible',{PART:bme()},{B:'TRUE'})),[['power','vpwr']]);});}
function towerHellDef(){const G=GK;const p=G.proj('towerhell','Tower of Chaos',{sky:'#1b1f3b',fog:700,brightness:.95,timer:false,saveStats:false,saveCheckpoint:false,lobby:true,lobbyWait:12,lobbyRound:240,lobbyScore:'Height'});
  const bp=p.nodes.find(n=>n.name==='Baseplate');Object.assign(bp,{size:[90,2,90],color:'#2b2f4a',material:'Slate'});
  G.spawnAt(p,0,.5,0,{size:[5,1,5],color:'#ffc93c'});
  const H=14,COLS=['#ff5252','#ffab40','#ffd740','#69f0ae','#40c4ff','#7c4dff','#ff4081','#b2ff59','#ff6e40','#e0e0e0','#64ffda','#ea80fc','#ffd180','#ff8a80'];
  const KINDS=['Stairs','Tiny Steps','Sliders','Vanishing','Spinner','Truss','Bouncy','Crushers','Lava Steps','Ghost Steps','Wall Hops','Elevators','Beams','Double Spinner'];
  const centers=[];
  KINDS.forEach((kind,ki)=>{const M=G.model(p,'Section'+(ki+1),'rs').id;const col=COLS[ki];const P=o=>G.part(p,M,o);
    // floor with a hole in the middle, glass walls
    [[-9.5,0,11,30],[9.5,0,11,30],[0,-9.5,8,11],[0,9.5,8,11]].forEach(([x,z,w,d])=>P({name:'Floor',pos:[x,.5,z],size:[w,1,d],color:col,material:'Plastic'}));
    [[0,-15,30,1],[0,15,30,1],[-15,0,1,30],[15,0,1,30]].forEach(([x,z,w,d])=>P({name:'Glass',pos:[x,H/2,z],size:[w,H,d],color:'#b3e5fc',material:'Glass',transparency:.75}));
    P({name:'Sign',pos:[0,H-1.5,-14.3],size:[6,1.4,.2],color:'#11141f',label:kind.toUpperCase()});
    const n=7,R=10,sz=kind==='Tiny Steps'?2.6:kind==='Truss'?1.4:kind==='Wall Hops'?1.2:kind==='Beams'?1:4;
    for(let i=0;i<n;i++){const a=i*Math.PI*2/8+.4,x=r3(Math.cos(a)*R),z=r3(Math.sin(a)*R),y=r3(2.4+i*1.35);
      const st=P({name:'Step',pos:[x,y,z],size:kind==='Truss'?[sz,1,sz*3]:kind==='Wall Hops'?[sz,1,4.2]:kind==='Beams'?[sz,1,6]:[sz,1,sz],transparency:kind==='Ghost Steps'?.88:0,rot:kind==='Truss'||kind==='Wall Hops'||kind==='Beams'?[0,r3(-a*180/Math.PI),0]:[0,0,0],color:i%2?col:'#ffffff',material:kind==='Bouncy'&&i%2?'Neon':'Plastic',
        behavior:kind==='Bouncy'&&i===3?'jump':'none',value:kind==='Bouncy'&&i===3?75:0});
      if(kind==='Lava Steps'&&i%2&&i<6)P({name:'LavaStrip',pos:[x,y+.55,z],size:[sz*.5,.12,sz],color:'#ff3d00',material:'Neon',behavior:'kill'});
      if(kind==='Elevators'&&i%2)G.script(p,st.id,'Lift',...SCR.glide(0,2.4,0,1.3).blocks.blocks);
      if(kind==='Sliders'&&i%2)G.script(p,st.id,'Slide',...SCR.glide(0,0,i%4===1?4:-4,1.4).blocks.blocks);
      if(kind==='Vanishing'&&i>0)G.script(p,st.id,'Vanish',...SCR.vanish().blocks.blocks);
      if(kind==='Crushers'&&i%2===0&&i>0){const kb=P({name:'Crusher',pos:[x,y+5.5,z],size:[sz+1,1,sz+1],color:'#ff1744',material:'Neon',behavior:'kill'});G.script(p,kb.id,'Bob',...SCR.glide(0,-3.2,0,.9).blocks.blocks);}}
    P({name:'Step',pos:[r3(Math.cos(7*Math.PI*2/8+.4)*5),11.2,r3(Math.sin(7*Math.PI*2/8+.4)*5)],size:[3,1,3],color:col});
    P({name:'Top',pos:[0,12,0],size:[4,1,4],color:'#ffffff',material:'Neon'});
    if(kind==='Double Spinner'){[3.5,8.5].forEach((hy,j)=>{const sp=P({name:'Spinner',pos:[0,hy,0],size:[22,1,1],color:'#ff1744',material:'Neon',behavior:'kill'});G.script(p,sp.id,'Spin',...SCR.spin(j?-2.6:2).blocks.blocks);});}
    if(kind==='Spinner'){const sp=P({name:'Spinner',pos:[0,6.5,0],size:[22,1,1],color:'#ff1744',material:'Neon',behavior:'kill'});G.script(p,sp.id,'Spin',...SCR.spin(2.2).blocks.blocks);}
    const list=p.nodes.filter(nd=>nd.parent===M);list.push(p.nodes.find(nd=>nd.id===M));const c=nodesBounds(list).getCenter(new V3());centers.push(r3(c.y));});
  const LEVELS=6,FIN=G.part(p,'workspace',{name:'TopOfTower',pos:[0,LEVELS*H+1.5,0],size:[14,1,14],color:'#ffd740',material:'Neon',label:'THE TOP!'});
  [[0,-7.5,14,1],[0,7.5,14,1],[-7.5,0,1,14],[7.5,0,1,14]].forEach(([x,z,w,d])=>G.part(p,'workspace',{name:'TopRail',pos:[x,LEVELS*H+3,z],size:[w,2,d],color:'#ffecb3',material:'Glass',transparency:.4}));
  const K='vsec',VARS=[['section',K],...G.MV];
  G.vars(G.script(p,'sss','Build tower',G.onMsg('round start'),
    ...Array.from({length:KINDS.length},(_,k)=>blk('controls_repeat_ext',{TIMES:bn(LEVELS),DO:doIn(blk('p_destroy',{PART:G.mnamed('Section'+(k+1))}))})),
    ...Array.from({length:LEVELS},(_,i)=>[G.vset(K,G.rnd(1,KINDS.length)),...KINDS.map((_,k)=>G.iff(G.cmp(G.vget(K),'EQ',G.num(k+1)),blk('rs_copy',{X:bn(0),Y:bn(r3(1+i*H+centers[k])),Z:bn(0)},{NAME:'Section'+(k+1)})))]).flat(),
    blk('pl_gravity',{V:bn(196.2)}),blk('pl_speed',{V:bn(16)}),blk('pl_jump',{V:bn(50)}),blk('pl_airjumps',{N:bn(0)}),G.vset('vmod',G.rnd(1,6)),
    G.ifElse(G.cmp(G.vget('vmod'),'EQ',G.num(2)),[blk('pl_gravity',{V:bn(120)}),G.msg('A new tower! Modifier: LOW GRAVITY 🌙',4)],
     [G.ifElse(G.cmp(G.vget('vmod'),'EQ',G.num(3)),[blk('pl_speed',{V:bn(24)}),G.msg('A new tower! Modifier: SPEED ⚡',4)],
      [G.ifElse(G.cmp(G.vget('vmod'),'EQ',G.num(4)),[blk('pl_airjumps',{N:bn(1)}),G.msg('A new tower! Modifier: DOUBLE JUMP 🦘',4)],
       [G.ifElse(G.cmp(G.vget('vmod'),'EQ',G.num(5)),[blk('pl_jump',{V:bn(62)}),G.msg('A new tower! Modifier: HIGH JUMP 🚀',4)],
        [G.msg('A new tower! No modifier this time. Climb as high as you can!',3)])])])])),VARS);
  G.matchFlags(p);
  G.script(p,FIN.id,'Top',blk('ev_touch'),G.iff(G.AND(G.aliveIn(),G.cmp(G.stat('Height'),'LT',G.num(999))),G.sset('Height',999),G.sound('win'),G.msg('YOU BEAT THE TOWER OF CHAOS! +15 coins',4),blk('pl_coins',{N:bn(15)}),blk('pe_emit',{N:bn(60),PART:bme()})));
  p.nodes.push(emitterNode({parent:FIN.id,name:'Party',enabled:false},'confetti'));
  G.vars(G.script(p,'sss','Height',blk('ev_start'),G.forever(G.iff(G.AND(G.aliveIn(),G.cmp(G.round(G.ppos('y')),'GT',G.stat('Height'))),G.sset('Height',G.round(G.ppos('y')))),G.wait(.3))),G.MV);
  G.hud(p,'Climb','#283593',G.join('🗼 Floors climbed: ',{block:{type:'math_round',fields:{OP:'ROUNDDOWN'},inputs:{NUM:G.arith('DIVIDE',G.ppos('y'),G.num(H))}}},' / ',String(LEVELS)));
  G.welcome(p,G.msg('Tower of Chaos: no checkpoints! Climb the random tower before time runs out. Highest climber wins.',5));
  return G.def(p,'towerhell','Tower of Chaos');}

/* 21. Whodunit: one murderer, one sheriff, everyone else innocent; bots fill empty spots */
function murderDef(){const G=GK;const p=G.proj('murder','Whodunit',{sky:'#22253a',fog:300,brightness:.8,timer:false,saveStats:false,saveCheckpoint:false,deathStyle:'ragdoll',lobby:true,lobbyWait:15,lobbyRound:150,lobbyScore:'Score',lobbyElim:true});
  const bp=p.nodes.find(n=>n.name==='Baseplate');Object.assign(bp,{size:[140,2,120],color:'#3a2f2a',material:'Wood'});
  const M=G.folder(p,'Mansion').id;const P=o=>G.part(p,M,o);
  P({name:'Floor',pos:[0,.1,0],size:[96,.2,72],color:'#8d6e63',material:'Wood'});
  // outer walls and rooms with doorways
  const wall=(x,z,w,d,col)=>P({name:'Wall',pos:[x,5,z],size:[w,10,d],color:col||'#d7ccc8',material:'Brick'});
  wall(0,-36,96,1);wall(0,36,96,1);wall(-48,0,1,72);wall(48,0,1,72);
  [[-16,-24],[16,-24],[-16,12],[16,12]].forEach(([x,z])=>{wall(x,z-12+5,1,14,'#bcaaa4');wall(x,z+12-1,1,6,'#bcaaa4');});
  wall(-32,-12,31,1,'#bcaaa4');wall(32,-12,31,1,'#bcaaa4');wall(-32,12,31,1,'#bcaaa4');wall(32,12,31,1,'#bcaaa4');
  const fur=[['Table',-32,-26,8,3,5,'#6d4c41'],['Bed',32,-28,8,2.4,12,'#5c6bc0'],['Couch',-34,26,10,3,4,'#8e24aa'],['Piano',32,26,8,4,5,'#212121'],['Bookcase',-46,0,2,8,10,'#5d4037'],
    ['Table',0,0,10,3,6,'#795548'],['Counter',30,-6,12,3.5,3,'#9e9e9e'],['Barrel',-6,-30,3,4,3,'#8d6e63'],['Crate',44,30,4,4,4,'#a1764b'],['Fountain',0,24,6,2,6,'#90a4ae']];
  fur.forEach(([nm,x,z,w,h,d,c])=>P({name:nm,pos:[x,h/2,z],size:[w,h,d],color:c,material:'Wood'}));
  for(let i=0;i<10;i++)P({name:'Lamp',pos:[-40+i*9,9.6,i%2?-30:30],size:[1.2,.6,1.2],color:'#fff59d',material:'Neon'});
  G.spawnAt(p,0,.5,-6,{size:[6,1,6],color:'#5d4037'});
  const MV=G.matchFlags(p);
  const MU='vmurderer',SH='vsheriff',NB='vnbots',OV='vover',VK='vpick',KL='vkills',D=k=>'vdead'+k;
  const VARS=[['murderer',MU],['sheriff',SH],['bots',NB],['game over',OV],['pick',VK],['murderer kills',KL],...[1,2,3,4,5].map(k=>['bot dead '+k,D(k)]),...MV];
  const eq=(id,v)=>G.cmp(G.vget(id),'EQ',typeof v==='number'?G.num(v):v);
  const BCOLS=['#e57373','#64b5f6','#81c784','#ffb74d','#ba68c8'];
  // second map: the Ice Palace, 300 studs east. Every round picks a map (the same for everyone)
  {const OX=300,M2=G.folder(p,'Ice Palace').id;const Q=o=>G.part(p,M2,o);
    Q({name:'IceGround',pos:[OX,-1,0],size:[140,2,120],color:'#e3f2fd',material:'Snow'});Q({name:'Floor',pos:[OX,.1,0],size:[96,.2,72],color:'#b3e5fc',material:'Ice'});
    const w2=(x,z2,w,d,col)=>Q({name:'Wall',pos:[OX+x,5,z2],size:[w,10,d],color:col||'#81d4fa',material:'Ice',transparency:.15});
    w2(0,-36,96,1);w2(0,36,96,1);w2(-48,0,1,72);w2(48,0,1,72);
    [[-24,-20],[24,-20],[-24,20],[24,20]].forEach(([x,z2])=>{w2(x,z2,14,1,'#4fc3f7');w2(x,z2,1,14,'#4fc3f7');});
    [['Throne',0,-30,8,6,4,'#e1f5fe'],['IceSculpture',-36,-6,4,7,4,'#b2ebf2'],['IceSculpture',36,6,4,7,4,'#b2ebf2'],['Snowman',-10,24,4,6,4,'#fafafa'],['Sled',30,30,6,1.4,3,'#d32f2f'],
     ['Igloo',-36,28,10,5,10,'#ffffff'],['Crystal',10,-10,3,9,3,'#80deea'],['Crystal',-12,8,3,6,3,'#80deea'],['Table',36,-28,8,3,5,'#90a4ae'],['Presents',0,10,4,3,4,'#ab47bc']].forEach(([nm,x,z2,w,h,d,c])=>Q({name:nm,pos:[OX+x,h/2,z2],size:[w,h,d],color:c,material:nm==='Crystal'?'Neon':'Ice'}));
    for(let i=0;i<10;i++)Q({name:'Lamp',pos:[OX-40+i*9,9.6,i%2?-30:30],size:[1.2,.6,1.2],color:'#b3e5fc',material:'Neon'});}
  // third map: the Cruise Ship, 600 studs east
  {const OX=600,M3=G.folder(p,'Cruise Ship').id;const Q=o=>G.part(p,M3,o);
    Q({name:'Ocean',pos:[OX,-2,0],size:[300,1,300],color:'#0277bd',material:'Glass',transparency:.2,canCollide:false});
    Q({name:'Hull',pos:[OX,-3,0],size:[100,6,76],color:'#fafafa',material:'Metal'});Q({name:'Deck',pos:[OX,.1,0],size:[96,.2,72],color:'#bcaaa4',material:'Wood'});
    const w3=(x,z2,w,d,col)=>Q({name:'Wall',pos:[OX+x,5,z2],size:[w,10,d],color:col||'#eceff1',material:'Metal'});
    w3(0,-36,96,1,'#90caf9');w3(0,36,96,1,'#90caf9');w3(-48,0,1,72,'#90caf9');w3(48,0,1,72,'#90caf9');
    for(let i=0;i<4;i++){w3(-36+i*24,-20,1,16,'#cfd8dc');w3(-36+i*24,20,1,16,'#cfd8dc');}
    Q({name:'Pool',pos:[OX,.2,0],size:[16,.2,10],color:'#4fc3f7',material:'Glass',transparency:.3,canCollide:false});
    [['Lifeboat',-40,-30,8,3,4,'#ff7043'],['Lifeboat',40,30,8,3,4,'#ff7043'],['DeckChair',8,8,2,1.5,5,'#ffca28'],['DeckChair',-8,-8,2,1.5,5,'#ffca28'],['Bar',30,-6,10,3.5,3,'#6d4c41'],
     ['Funnel',-20,0,6,9,6,'#d32f2f'],['Piano',20,24,6,4,4,'#212121'],['Crate',-36,28,4,4,4,'#a1764b'],['Table',0,-28,8,3,5,'#795548'],['Wheel',44,0,2,4,4,'#8d6e63']].forEach(([nm,x,z2,w,h,d,c])=>Q({name:nm,pos:[OX+x,h/2,z2],size:[w,h,d],color:c,material:'Wood'}));
    for(let i=0;i<10;i++)Q({name:'Lamp',pos:[OX-40+i*9,9.6,i%2?-30:30],size:[1.2,.6,1.2],color:'#fff9c4',material:'Neon'});}
  const MOX='vmox',MOXV=[['map x',MOX]];
  G.vars(G.script(p,'sss','Pick map',G.onMsg('round start'),G.vset(MOX,G.arith('MULTIPLY',G.rnd(0,2),G.num(300)))),MOXV);
  const ox=v=>G.arith('ADD',typeof v==='number'?G.num(v):v,G.vget(MOX));VARS.push(...MOXV);
  const SPOTS=[[-34,-28],[34,-24],[-34,24],[34,28],[0,-2]];
  for(let k=1;k<=5;k++){const r=rigNode({name:'Bot'+k,pos:[SPOTS[k-1][0],2.6,SPOTS[k-1][1]],health:100,respawn:2,walkSpeed:13,colors:{head:'#ffcc80',torso:BCOLS[k-1],arms:'#ffcc80',legs:'#37474f'}});p.nodes.push(r);
    const isMurd=eq(MU,G.txt('Bot'+k));
    G.vars(G.hscript(p,r.id,'Think',blk('ev_start'),G.forever(G.ifElse(G.OR(eq(D(k),1),G.cmp(G.num(k),'GT',G.vget(NB))),[G.wait(.5)],
      [G.ifElse(G.AND(isMurd,eq(OV,0)),[G.ifElse(G.cmp(G.nearD(bme()),'LT',G.num(45)),[G.walkN(bme()),G.wait(.2)],[blk('rig_walk',{PART:bme(),X:ox(G.rnd(-44,44)),Z:G.rnd(-34,34)})])],
        [blk('rig_walk',{PART:bme(),X:ox(G.rnd(-44,44)),Z:G.rnd(-34,34)}),G.wait(G.rnd(0,3))])]))),VARS);
    // a murderer bot stabs whoever it touches
    G.vars(G.script(p,r.id,'Stab',blk('ev_touch'),G.iff(G.AND(G.AND(isMurd,eq(OV,0)),G.aliveIn()),G.sound('explode'),G.msg('The murderer got you!',2.5),blk('pl_damage',{N:bn(1000)}))),VARS);
    G.vars(G.hscript(p,r.id,'Down',blk('ev_rig_died'),G.vset(D(k),G.num(1)),G.iff(isMurd,G.bc('murderer down')),G.wait(2.5),blk('p_setpos',{PART:bme(),X:bn(k*5),Y:bn(2.6),Z:bn(60)}),blk('p_visible',{PART:bme()},{B:'FALSE'})),VARS);}
  // weapons live in ReplicatedStorage and are handed out by role
  const knife=gkMelee(p,'rs','Knife',{dmg:1000,cool:.7,color:'#cfd8dc',tip:'Murderer only',script:false});
  G.vars(G.script(p,knife.id,'Stab',blk('ev_tool_hit'),hitBranch(1000,doIn(G.sound('explode'),G.sadd('Score',1)))),VARS);
  const gun=gkGun(p,'rs','Gun',{dmg:0,cool:2.2,color:'#ffd54f',speed:300,tip:'Sheriff: shoot the murderer only!'});
  const hp={block:{type:'tool_hitpart'},shadow:{type:'p_this'}};
  G.vars(G.script(p,gun.id,'Judge',blk('ev_tool_hit'),
    G.iff({block:{type:'s_isplayer',inputs:{PART:hp}}},G.ifElse(eq(MU,G.idOf({block:{type:'tool_hitpart'}})),[blk('pl_damage_other',{PART:hp,N:bn(1000)}),G.sadd('Score',3),G.msg('You got the murderer!',3)],
      [blk('pl_damage_other',{PART:hp,N:bn(1000)}),G.msg('That was an innocent! You lose your badge...',3),G.wait(1),blk('pl_damage',{N:bn(1000)})])),
    G.iff({block:{type:'s_isrig',inputs:{PART:hp}}},G.ifElse(eq(MU,{block:{type:'s_partname',inputs:{PART:hp}}}),[blk('rig_damage',{PART:hp,N:bn(1000)}),G.sadd('Score',3),G.msg('You got the murderer!',3)],
      [blk('rig_damage',{PART:hp,N:bn(1000)}),G.msg('That was an innocent! You lose your badge...',3),G.wait(1),blk('pl_damage',{N:bn(1000)})]))),VARS);
  // host: hand out roles, sheriff bots shoot the murderer, decide who wins
  const MB='vmurdbot',AB='valivebots';VARS.push(['murderer is a bot',MB],['bots alive',AB]);
  const nPl=G.plCount('playing');const total=G.arith('ADD',nPl,G.vget(NB));
  const pickAny=(id,flag)=>[G.ifElse(G.cmp(G.rnd(1,total),'LTE',nPl),[G.vset(id,G.idOf(G.pref('randplaying'))),...(flag?[G.vset(flag,G.num(0))]:[])],
    [G.vset(VK,G.rnd(1,G.vget(NB))),G.vset(id,G.join('Bot',G.vget(VK))),...(flag?[G.vset(flag,G.num(1))]:[])])];
  const distSq=(ax,az,bx,bz)=>G.arith('ADD',G.arith('MULTIPLY',G.arith('MINUS',ax,bx),G.arith('MINUS',ax,bx)),G.arith('MULTIPLY',G.arith('MINUS',az,bz),G.arith('MINUS',az,bz)));
  const bx=(k,a)=>G.prop(G.pnamed('Bot'+k),a);
  const sheriffBotShoots=[1,2,3,4,5].map(k=>G.iff(G.AND(G.AND(eq(SH,G.txt('Bot'+k)),eq(D(k),0)),eq(OV,0)),
    ...[1,2,3,4,5].filter(j=>j!==k).map(j=>G.iff(G.AND(G.AND(eq(MU,G.txt('Bot'+j)),eq(D(j),0)),G.cmp(distSq(bx(k,'x'),bx(k,'z'),bx(j,'x'),bx(j,'z')),'LT',G.num(300))),
      blk('rig_say',{PART:G.pnamed('Bot'+k),TEXT:bt('Got you, murderer!'),S:bn(2)}),blk('rig_damage',{PART:G.pnamed('Bot'+j),N:bn(1000)}))),
    G.iff(eq(MB,0),G.iff(G.cmp(distSq(bx(k,'x'),bx(k,'z'),G.axOf(G.byId(G.vget(MU)),'x'),G.axOf(G.byId(G.vget(MU)),'z')),'LT',G.num(250)),
        blk('rig_say',{PART:G.pnamed('Bot'+k),TEXT:bt('Got you, murderer!'),S:bn(2)}),G.asP(G.byId(G.vget(MU)),G.msg('The sheriff caught you!',3),blk('pl_damage',{N:bn(1000)}))))));
  const countBots=()=>[G.vset(AB,G.num(0)),...[1,2,3,4,5].map(k=>G.iff(G.AND(G.cmp(G.num(k),'LTE',G.vget(NB)),eq(D(k),0)),G.vchg(AB,1)))];
  G.vars(G.hscript(p,'sss','Roles',G.onMsg('round start'),G.vset(OV,G.num(0)),G.vset(MU,G.txt('-')),G.vset(SH,G.txt('-')),G.vset(MB,G.num(0)),
    G.ifElse(G.cmp(G.players(),'GTE',G.num(6)),[G.vset(NB,G.num(0))],[G.vset(NB,G.arith('MINUS',G.num(6),G.players()))]),
    ...[1,2,3,4,5].map(k=>[G.vset(D(k),G.num(0)),blk('rig_heal',{PART:G.pnamed('Bot'+k),N:bn(1000)}),
      G.ifElse(G.cmp(G.num(k),'LTE',G.vget(NB)),[blk('p_setpos',{PART:G.pnamed('Bot'+k),X:ox(SPOTS[k-1][0]),Y:bn(2.6),Z:bn(SPOTS[k-1][1])}),blk('p_visible',{PART:G.pnamed('Bot'+k)},{B:'TRUE'})],
        [blk('p_setpos',{PART:G.pnamed('Bot'+k),X:bn(k*5),Y:bn(2.6),Z:bn(60)}),blk('p_visible',{PART:G.pnamed('Bot'+k)},{B:'FALSE'})])]).flat(),
    ...pickAny(MU,MB),G.vset(SH,G.vget(MU)),blk('controls_whileUntil',{BOOL:G.cmp(G.vget(SH),'NEQ',G.vget(MU)),DO:doIn(...pickAny(SH,null))},{MODE:'UNTIL'}),
    ...countBots(),G.wait(1),G.bc('roles'),G.wait(4),
    blk('controls_whileUntil',{BOOL:G.OR(G.NOT(G.inMatch()),G.cmp(G.vget(OV),'EQ',G.num(1))),DO:doIn(G.wait(.6),...sheriffBotShoots,...countBots(),
      G.iff(G.AND(eq(MB,1),G.cmp(G.arith('ADD',nPl,G.arith('MINUS',G.vget(AB),G.num(1))),'LTE',G.num(0))),G.vset(OV,G.num(1)),G.msg('Everyone is gone. The murderer bot wins!',4)))},{MODE:'UNTIL'})),VARS);
  G.vars(G.hscript(p,'sss','Murderer down',G.onMsg('murderer down'),G.iff(eq(OV,0),G.vset(OV,G.num(1)),G.msg('The murderer is down! Innocents win!',4),G.bc('innocents win'))),VARS);
  G.vars(G.script(p,'sss','Murderer died',blk('ev_died'),G.iff(G.AND(eq(MU,G.myId()),eq(OV,0)),G.shSet(OV,G.num(1)),G.msg('You were caught! Innocents win.',3),G.bc('innocents win'))),VARS);
  G.vars(G.script(p,'sss','Your role',G.onMsg('roles'),blk('pl_tpxyz',{X:ox(G.rnd(-30,30)),Y:bn(3),Z:G.rnd(-20,20)}),G.ifElse(G.cmp(G.vget(MOX),'EQ',G.num(0)),[blk('g_sky',null,{COLOUR:'#22253a'})],[G.ifElse(G.cmp(G.vget(MOX),'EQ',G.num(300)),[blk('g_sky',null,{COLOUR:'#4a6fa5'}),G.msg('Map: ICE PALACE',2)],[blk('g_sky',null,{COLOUR:'#ffb74d'}),G.msg('Map: CRUISE SHIP',2)])]),
    G.ifElse(eq(MU,G.myId()),[G.sound('die'),G.msg('You are the MURDERER! Knife (1). Take everyone out without the sheriff catching you.',5),blk('tool_give',null,{NAME:'Knife'})],
      [G.ifElse(eq(SH,G.myId()),[G.sound('check'),G.msg('You are the SHERIFF! Gun (1). Find and shoot the murderer, but never an innocent.',5),blk('tool_give',null,{NAME:'Gun'})],
        [G.msg('You are INNOCENT. Stay alive and help the sheriff find the murderer!',5)])])),VARS);
  G.vars(G.script(p,'sss','Innocents win',G.onMsg('innocents win'),G.iff(G.AND(G.aliveIn(),G.NOT(eq(MU,G.myId()))),G.sadd('Score',2),G.sound('win'))),VARS);
  G.vars(G.script(p,'sss','Lost the knife',G.onMsg('round end'),blk('tool_take',null,{NAME:'Knife'}),blk('tool_take',null,{NAME:'Gun'})),VARS);
  // the murderer wins when only they are left: checked on every screen of a living murderer
  G.vars(G.script(p,'sss','Last one standing',G.onMsg('roles'),G.wait(3),G.whileDo(G.AND(G.aliveIn(),eq(OV,0)),
    G.iff(G.AND(eq(MU,G.myId()),G.cmp(G.arith('ADD',G.arith('MINUS',G.plCount('playing'),G.num(1)),G.vget('valivebots')),'LTE',G.num(0))),
      G.shSet(OV,G.num(1)),G.sadd('Score',5),G.sound('win'),G.msg('Everyone is gone. The MURDERER wins!',4)),G.wait(1))),VARS);
  // coins scattered around the mansion every round, like the real thing
  const CSP=[[-40,-30],[-24,-30],[24,-30],[40,-20],[-40,-4],[-6,-18],[8,-6],[40,4],[-40,20],[-20,30],[0,30],[20,20],[40,30],[-30,4]];
  CSP.forEach(([x,z],i)=>{const c=P({name:'MCoin'+i,shape:'cylinder',pos:[x,1.4,z],size:[1.4,.3,1.4],rot:[90,0,0],color:'#ffd54f',material:'Neon',canCollide:false});
    G.script(p,c.id,'Spin',blk('ev_start'),G.forever(blk('p_rotate',{PART:bme(),DEG:bn(8)},{AXIS:'y'}),G.wait(.05)));
    G.vars(G.script(p,c.id,'Take',blk('ev_touch'),G.iff(G.aliveIn(),blk('p_visible',{PART:bme()},{B:'FALSE'}),blk('p_collide',{PART:bme()},{B:'FALSE'}),G.sadd('Coins',1),G.sound('coin'),blk('pl_coins',{N:bn(1)}),blk('p_setpos',{PART:bme(),X:bn(x),Y:bn(-40),Z:bn(z)}))),VARS);
    G.vars(G.script(p,c.id,'Reset',G.onMsg('round start'),G.wait(.1),blk('p_setpos',{PART:bme(),X:ox(x),Y:bn(1.4),Z:bn(z)}),blk('p_visible',{PART:bme()},{B:'TRUE'})),MOXV);});
  // when the sheriff goes down, the gun drops. Any innocent can pick it up and become the new sheriff
  const GD='vgundrop',GX='vgunx',GZ='vgunz',GV=[[ 'gun dropped',GD],['gun x',GX],['gun z',GZ]];VARS.push(...GV);
  const gdp=G.part(p,'workspace',{name:'GunDrop',pos:[0,-40,0],size:[2.4,1,1],color:'#ffd54f',material:'Neon',canCollide:false,label:'🔫 GUN'});
  G.vars(G.script(p,gdp.id,'Place',blk('ev_start'),G.forever(G.ifElse(eq(GD,1),[blk('p_setpos',{PART:bme(),X:G.vget(GX),Y:bn(1.6),Z:G.vget(GZ)})],[blk('p_setpos',{PART:bme(),X:bn(0),Y:bn(-40),Z:bn(0)})]),G.wait(.3))),VARS);
  G.vars(G.script(p,gdp.id,'Pick up',blk('ev_touch'),G.iff(G.AND(G.AND(eq(GD,1),G.aliveIn()),G.NOT(eq(MU,G.myId()))),G.shSet(GD,G.num(0)),G.shSet(SH,G.myId()),blk('tool_give',null,{NAME:'Gun'}),G.sound('win'),G.msg('You picked up the gun! You are the new SHERIFF.',3))),VARS);
  G.vars(G.script(p,'sss','Sheriff down',blk('ev_died'),G.iff(G.AND(eq(SH,G.myId()),eq(OV,0)),G.shSet(GX,G.ppos('x')),G.shSet(GZ,G.ppos('z')),G.shSet(GD,G.num(1)),G.bc('gun dropped'))),VARS);
  [1,2,3,4,5].forEach(k=>G.vars(G.hscript(p,G.pnamed?'sss':'sss','Sheriff bot down '+k,blk('ev_start'),G.forever(G.until(G.AND(eq(SH,G.txt('Bot'+k)),eq(D(k),1))),G.iff(eq(OV,0),
    G.vset(GX,G.prop(G.pnamed('Bot'+k),'x')),G.vset(GZ,G.prop(G.pnamed('Bot'+k),'z')),G.vset(GD,G.num(1)),G.vset(SH,G.txt('-')),G.bc('gun dropped')),G.wait(1))),VARS));
  G.script(p,'sss','Gun dropped msg',G.onMsg('gun dropped'),G.sound('check'),G.msg('🔫 The sheriff is down! The gun dropped. Innocents, grab it!',3));
  G.vars(G.hscript(p,'sss','Gun reset',G.onMsg('round start'),G.vset(GD,G.num(0))),VARS);
  // bots pick up the gun too
  [1,2,3,4,5].forEach(k=>G.vars(G.hscript(p,'sss','Bot grabs gun '+k,blk('ev_start'),G.forever(G.wait(.5),G.iff(G.AND(G.AND(eq(GD,1),eq(D(k),0)),G.AND(G.NOT(eq(MU,G.txt('Bot'+k))),G.cmp(G.num(k),'LTE',G.vget(NB)))),
    G.iff(G.cmp(G.arith('ADD',G.arith('MULTIPLY',G.arith('MINUS',G.prop(G.pnamed('Bot'+k),'x'),G.vget(GX)),G.arith('MINUS',G.prop(G.pnamed('Bot'+k),'x'),G.vget(GX))),G.arith('MULTIPLY',G.arith('MINUS',G.prop(G.pnamed('Bot'+k),'z'),G.vget(GZ)),G.arith('MINUS',G.prop(G.pnamed('Bot'+k),'z'),G.vget(GZ)))),'LT',G.num(400)),
      blk('rig_walk',{PART:G.pnamed('Bot'+k),X:G.vget(GX),Z:G.vget(GZ)}),G.iff(G.cmp(G.arith('ADD',G.arith('MULTIPLY',G.arith('MINUS',G.prop(G.pnamed('Bot'+k),'x'),G.vget(GX)),G.arith('MINUS',G.prop(G.pnamed('Bot'+k),'x'),G.vget(GX))),G.arith('MULTIPLY',G.arith('MINUS',G.prop(G.pnamed('Bot'+k),'z'),G.vget(GZ)),G.arith('MINUS',G.prop(G.pnamed('Bot'+k),'z'),G.vget(GZ)))),'LT',G.num(9)),
        G.vset(GD,G.num(0)),G.vset(SH,G.txt('Bot'+k)),blk('rig_say',{PART:G.pnamed('Bot'+k),TEXT:bt('I have the gun now!'),S:bn(2)})))))),VARS));
  // a full coin bag (8 coins) buys innocents a speed burst, and the murderer a few seconds of invisibility
  G.vars(G.script(p,'sss','Coin bag',G.onMsg('round start'),G.sset('Coins',0),G.vset('vbag',G.num(0)),G.whileDo(G.inMatch(),
    G.iff(G.AND(G.cmp(G.stat('Coins'),'GTE',G.num(8)),G.cmp(G.vget('vbag'),'EQ',G.num(0))),G.vset('vbag',G.num(1)),G.sound('win'),
      G.ifElse(eq(MU,G.myId()),[G.msg('Coin bag full! You turn INVISIBLE for 6 seconds...',3),blk('pl_visible',null,{B:'FALSE'}),G.wait(6),blk('pl_visible',null,{B:'TRUE'})],
        [G.msg('Coin bag full! SPEED BOOST for 10 seconds!',3),blk('pl_speed',{V:bn(24)}),G.wait(10),blk('pl_speed',{V:bn(16)})])),G.wait(.5))),[...VARS,['bag','vbag']]);
  // a murderer bot quietly takes out innocent bots when no player is close enough to see
  [1,2,3,4,5].forEach(k=>G.vars(G.hscript(p,'sss','Bot murderer strikes '+k,G.onMsg('roles'),G.wait(G.rnd(16,24)),G.whileDo(G.AND(G.inMatch(),G.AND(eq(OV,0),G.AND(eq(MU,G.txt('Bot'+k)),eq(D(k),0)))),
    G.vset('vvic',G.rnd(1,5)),
    ...[1,2,3,4,5].filter(j=>j!==k).map(j=>G.iff(G.AND(G.AND(eq('vvic',j),eq(D(j),0)),G.AND(G.cmp(G.num(j),'LTE',G.vget(NB)),G.cmp(G.nearD(G.pnamed('Bot'+k)),'GT',G.num(22)))),
      blk('rig_damage',{PART:G.pnamed('Bot'+j),N:bn(1000)}),G.sound('die'),G.msg('😱 Bot'+j+' was found knocked out! The murderer is close...',3))),
    G.wait(G.rnd(14,24)))),[...VARS,['victim','vvic']]));
  // clues: every 20 seconds a witness clears one innocent bot, so the sheriff can work it out
  G.vars(G.hscript(p,'sss','Clues',G.onMsg('roles'),G.wait(22),G.vset('vclue',G.num(0)),G.whileDo(G.AND(G.inMatch(),eq(OV,0)),
    G.vchg('vclue',1),G.iff(G.cmp(G.vget('vclue'),'GT',G.num(5)),G.vset('vclue',G.num(1))),
    ...[1,2,3,4,5].map(j=>G.iff(G.AND(eq('vclue',j),G.AND(G.cmp(G.num(j),'LTE',G.vget(NB)),G.AND(eq(D(j),0),G.NOT(eq(MU,G.txt('Bot'+j)))))),
      G.sound('check'),G.msg('🔎 Clue: a witness saw Bot'+j+' far from the crime. Bot'+j+' is innocent!',3.5),G.wait(18))),G.wait(.5))),[...VARS,['clue','vclue']]);
  G.welcome(p,G.msg('Whodunit: find out who the murderer is before it is too late. Watch for clues! Bots fill the empty spots.',5));
  G.best(p,'Score','murder_score');
  G.vars(G.script(p,'sss','Role label',G.onMsg('roles'),G.ifElse(eq(MU,G.myId()),[G.vset('vrole',G.txt('🔪 MURDERER'))],[G.ifElse(eq(SH,G.myId()),[G.vset('vrole',G.txt('🔫 SHERIFF'))],[G.vset('vrole',G.txt('😇 INNOCENT'))])]),
    G.whileDo(G.inMatch(),G.iff(G.AND(eq(SH,G.myId()),G.NOT(eq(MU,G.myId()))),G.vset('vrole',G.txt('🔫 SHERIFF'))),G.wait(.5)),G.vset('vrole',G.txt('waiting for the next match'))),[...VARS,['role','vrole']]);
  G.vars(G.script(p,'sss','Role start',blk('ev_start'),G.vset('vrole',G.txt('waiting for the next match'))),[['role','vrole']]);
  G.hud(p,'Role','#37474f',G.join('You are ',G.vget('vrole'),'   ·   🪙 ',G.stat('Coins'),' / 8'));
  return G.def(p,'murder','Whodunit');}

/* 22. Haunted Hotel: 40 rooms, locked doors with keys, and Dasher (hide in a wardrobe!) */
function doorsDef(){const G=GK;const p=G.proj('doors','Haunted Hotel',{sky:'#07080d',fog:120,brightness:.55,timer:true,saveStats:false,saveCheckpoint:false,deathStyle:'ragdoll'});
  G.noBase(p);const N=40,L=30,Wd=24;let seed=4242;const rr=()=>{seed=(seed*16807)%2147483647;return seed/2147483647;};
  const R=G.folder(p,'Hotel').id,DM=G.model(p,'Doors').id,HM=G.model(p,'HidingSpots').id,KM=G.model(p,'Keys').id;const P=o=>G.part(p,R,o);
  P({name:'Lobby',pos:[0,-.5,12],size:[Wd,1,24],color:'#5d4037',material:'Wood'});
  G.spawnAt(p,0,.5,14,{size:[6,1,6],color:'#4e342e'});
  P({name:'Desk',pos:[6,1.5,16],size:[8,3,3],color:'#3e2723',material:'Wood',label:'Welcome to the Hotel'});
  const wallCol=['#4e342e','#3e4a3a','#4a3b52','#3b4252'];
  for(let i=0;i<N;i++){const z0=-i*L,zc=z0-L/2,col=wallCol[i%4],locked=i>0&&i%5===4;
    P({name:'Floor',pos:[0,-.5,zc],size:[Wd,1,L],color:i%2?'#5d4037':'#6d4c41',material:'Wood'});
    P({name:'Wall',pos:[-Wd/2-.5,5,zc],size:[1,10,L],color:col,material:'Brick'});P({name:'Wall',pos:[Wd/2+.5,5,zc],size:[1,10,L],color:col,material:'Brick'});
    P({name:'DoorWall',pos:[-Wd/4-2,5,z0-L],size:[Wd/2-4,10,1],color:col,material:'Brick'});P({name:'DoorWall',pos:[Wd/4+2,5,z0-L],size:[Wd/2-4,10,1],color:col,material:'Brick'});
    P({name:'Lintel',pos:[0,9,z0-L],size:[8,2,1],color:col,material:'Brick'});
    P({name:'Lamp',pos:[0,9.4,zc],size:[2,.4,2],color:'#ffe082',material:'Neon'});
    const dr=G.part(p,DM,{name:'Door'+(i+1),pos:[0,4,z0-L],size:[8,8,.8],color:locked?'#8d6e63':'#a1887f',material:'Wood',label:String(i+1).padStart(4,'0')+(locked?' 🔒':'')});
    G.script(p,dr.id,'Open',blk('ev_touch'),G.iff(G.cmp(G.stat('Door'),'EQ',G.num(i)),
      ...(locked?[G.ifElse(G.cmp(G.vget('vkey'),'GTE',G.num(i+1)),[G.sound('click')],[G.msg('Locked! Find the key in this room.',1.5),G.wait(1),blk('c_stop',null,{WHAT:'this'})])]:[]),
      blk('p_collide',{PART:bme()},{B:'FALSE'}),blk('p_transp',{PART:bme()},{V:bn(.85)}),G.sadd('Door',1),G.sound('pad'),
      ...(i===N-1?[G.sound('win'),G.msg('You made it through all 40 doors! You escaped the hotel! +40 coins',5),G.sset('Escaped',1),blk('pl_coins',{N:bn(40)})]:[])));
    // furniture
    for(let k=0;k<3;k++){const side=k%2?1:-1,z=zc+(k-1)*8+rr()*3;P({name:['Dresser','Bed','Table'][k],pos:[side*(Wd/2-3),1.2,r3(z)],size:[4,2.4,k===1?7:3],color:['#795548','#5c6bc0','#6d4c41'][k],material:'Wood'});}
    if(i%2===0){const sd=rr()<.5?-1:1,z=r3(zc+rr()*8-4);
      G.part(p,R,{name:'Wardrobe',pos:[sd*(Wd/2-1.6),4,z-2.2],size:[3,8,.4],color:'#3e2723',material:'Wood'});G.part(p,R,{name:'Wardrobe',pos:[sd*(Wd/2-1.6),4,z+2.2],size:[3,8,.4],color:'#3e2723',material:'Wood'});
      G.part(p,R,{name:'Wardrobe',pos:[sd*(Wd/2-1.6),8.2,z],size:[3,.4,4.8],color:'#3e2723',material:'Wood'});
      G.part(p,HM,{name:'HidingSpot',pos:[sd*(Wd/2-1.6),3,z],size:[2.6,6,3.8],color:'#000000',transparency:.92,canCollide:false,label:'HIDE'});}
    if(locked){const kx=r3((rr()-.5)*(Wd-8)),kz=r3(zc+(rr()-.5)*(L-10));P({name:'KeyTable',pos:[kx,1,kz],size:[3,2,3],color:'#4e342e',material:'Wood'});
      const ky=G.part(p,KM,{name:'Key'+(i+1),pos:[kx,2.6,kz],size:[1.4,.4,.6],color:'#ffd54f',material:'Neon',canCollide:false,label:'KEY'});
      G.script(p,ky.id,'Take',blk('ev_touch'),G.iff(G.cmp(G.vget('vkey'),'LT',G.num(i+1)),G.vset('vkey',G.num(i+1)),G.sound('coin'),G.msg('Got the key for door '+(i+1)+'!',1.5),blk('p_visible',{PART:bme()},{B:'FALSE'})));}}
  // gold piles in drawers: shop coins, and Gold for bragging rights
  for(let i=0;i<N;i++){if(rr()<.45)continue;const zc=-i*L-L/2,gx=r3((rr()<.5?-1:1)*(Wd/2-3)),gz=r3(zc+(rr()-.5)*(L-8));
    const gp=G.part(p,R,{name:'Gold',shape:'cylinder',pos:[gx,2.75,gz],size:[1.6,.5,1.6],color:'#ffca28',material:'Neon',canCollide:false});
    G.script(p,gp.id,'Pick up',blk('ev_touch'),blk('p_visible',{PART:bme()},{B:'FALSE'}),blk('p_collide',{PART:bme()},{B:'FALSE'}),G.sadd('Gold',5),G.sound('coin'),blk('pl_coins',{N:bn(1)}),blk('p_setpos',{PART:bme(),X:bn(gx),Y:bn(-50),Z:bn(gz)}));}
  G.script(p,'sss','Rebound',G.onMsg('ambush'),G.msg('It is turning around... STAY HIDDEN!',2.5),blk('g_sky',null,{COLOUR:'#003000'}),G.wait(.3),blk('g_sky',null,{COLOUR:'#07080d'}));
  P({name:'Exit',pos:[0,-.5,-N*L-10],size:[Wd,1,20],color:'#2e7d32',material:'Grass',label:'FREEDOM'});
  // Dasher: the lights flicker, then it tears down the hall. Hide in a wardrobe!
  const rush=G.part(p,'workspace',{name:'Dasher',shape:'ball',pos:[0,-60,40],size:[6,6,6],color:'#111111',material:'Neon',canCollide:false,unbreakable:true});
  p.nodes.push(emitterNode({parent:rush.id,name:'Shadow',rate:40,speed:6},'smoke'));
  G.hscript(p,rush.id,'Dasher',blk('ev_start'),G.wait(20),G.forever(G.wait(G.rnd(25,45)),G.bc('rush warning'),G.wait(3.2),G.bc('rush'),
    blk('p_setpos',{PART:bme(),X:bn(0),Y:bn(4),Z:bn(30)}),blk('p_glide',{PART:bme(),X:bn(0),Y:bn(0),Z:bn(-N*L-60),S:bn(7)}),G.iff(G.cmp(G.rnd(1,3),'EQ',G.num(1)),G.bc('ambush'),G.wait(2.5),G.bc('rush'),blk('p_glide',{PART:bme(),X:bn(0),Y:bn(0),Z:bn(N*L+60),S:bn(6)})),blk('p_setpos',{PART:bme(),X:bn(0),Y:bn(-60),Z:bn(40)})));
  G.script(p,'sss','Flicker',G.onMsg('rush warning'),G.sound('die'),G.msg('The lights flicker... HIDE!',2.5),blk('g_sky',null,{COLOUR:'#300000'}),G.wait(.2),blk('g_sky',null,{COLOUR:'#07080d'}),G.wait(.3),blk('g_sky',null,{COLOUR:'#300000'}),G.wait(.4),blk('g_sky',null,{COLOUR:'#07080d'}));
  G.script(p,'sss','Dasher passes',G.onMsg('rush'),G.sound('explode'),blk('controls_repeat_ext',{TIMES:bn(40),DO:doIn(
    G.iff(G.AND(G.cmp({block:{type:'s_distance',inputs:{PART:G.pnamed('Dasher')}}},'LT',G.num(16)),G.NOT({block:{type:'s_touching',inputs:{PART:G.mnamed('HidingSpots')}}})),G.msg('THE DASHER got you!',3),blk('pl_damage',{N:bn(1000)})),G.wait(.2))}));
  G.script(p,'sss','Died',blk('ev_died'),G.ifElse(G.cmp(G.vget('vsafe'),'GT',G.num(0)),[G.msg(G.join('You reached door ',G.stat('Door'),'. Back to the elevator at door ',G.vget('vsafe'),'!'),3)],[G.msg(G.join('You reached door ',G.stat('Door'),'. Back to the lobby!'),3)]),
    G.sset('Door',G.vget('vsafe')),G.vset('vkey',G.num(0)),
    blk('p_collide',{PART:G.mnamed('Doors')},{B:'TRUE'}),blk('p_transp',{PART:G.mnamed('Doors')},{V:bn(0)}),blk('p_visible',{PART:G.mnamed('Keys')},{B:'TRUE'}),
    ...Array.from({length:30},(_,i)=>G.iff(G.cmp(G.vget('vsafe'),'GTE',G.num(i+1)),blk('p_collide',{PART:G.pnamed('Door'+(i+1))},{B:'FALSE'}),blk('p_transp',{PART:G.pnamed('Door'+(i+1))},{V:bn(.85)}))));
  // elevator checkpoints at doors 10, 20 and 30
  [10,20,30].forEach(d=>{const z=-d*L-3;G.part(p,R,{name:'Elevator',pos:[0,.15,z-1],size:[8,.3,4],color:'#ffd54f',material:'Neon',canCollide:false,label:'⬆ SAVED'});});
  G.script(p,'sss','Elevator save',blk('ev_start'),G.vset('vsafe',G.num(0)),G.forever(G.iff(G.AND(G.cmp(G.stat('Door'),'GT',G.vget('vsafe')),G.OR(G.OR(G.cmp(G.stat('Door'),'EQ',G.num(10)),G.cmp(G.stat('Door'),'EQ',G.num(20))),G.cmp(G.stat('Door'),'EQ',G.num(30)))),
    G.vset('vsafe',G.stat('Door')),G.sound('check'),blk('g_callout',{TEXT:G.txt('SAVED!')}),G.msg(G.join('💾 Elevator checkpoint! If you get caught you come back to door ',G.vget('vsafe'),'.'),3)),G.wait(.3)));
  G.script(p,'sss','Back to elevator',blk('ev_spawn'),G.wait(.05),G.iff(G.cmp(G.vget('vsafe'),'GT',G.num(0)),blk('pl_tpxyz',{X:bn(0),Y:bn(3),Z:G.arith('MINUS',G.arith('MULTIPLY',G.vget('vsafe'),G.num(-L)),G.num(5))})));
  G.hud(p,'Hotel','#4e342e',G.join('🚪 Door ',G.stat('Door'),' / ',String(N),'   ·   💰 ',G.stat('Gold')));
  // THE WATCHER: eyes appear on the walls from room 20, then at door 25 it chases you through four rooms
  for(let i=19;i<29;i++){const zc=-i*L-L/2;for(let e=0;e<(i-17)*2;e++){const sd=e%2?1:-1;P({name:'Eye',shape:'ball',pos:[sd*(Wd/2-.1),r3(2+((e*37+i*11)%60)/10),r3(zc+((e*53)%(L-4))-L/2+2)],size:[.4,1,1.4],color:'#eceff1',material:'Neon',canCollide:false});}}
  for(let i=25;i<29;i++){const zc=-i*L-L/2;P({name:'FallenShelf',pos:[i%2?-4:4,.8,zc],size:[14,1.6,1.6],color:'#4e342e',material:'Wood'});P({name:'FallenShelf',pos:[i%2?7:-7,.8,zc-9],size:[8,1.6,1.6],color:'#4e342e',material:'Wood'});}
  const seek=G.part(p,'workspace',{name:'Watcher',pos:[0,-60,0],size:[3,9,3],color:'#0a0a0a',material:'Neon',canCollide:false,unbreakable:true,label:'👁'});
  p.nodes.push(emitterNode({parent:seek.id,name:'Ooze',rate:30,speed:3},'smoke'));
  G.vars(G.script(p,seek.id,'Chase',blk('ev_start'),G.forever(G.until(G.cmp(G.stat('Door'),'EQ',G.num(25))),G.sound('die'),G.msg('👁 THE WATCHER is coming. RUN! Jump over the fallen shelves!',3),blk('g_sky',null,{COLOUR:'#1a0000'}),
    G.vset('vsz',G.num(-25*L+22)),G.whileDo(G.AND(G.cmp(G.stat('Door'),'GTE',G.num(25)),G.cmp(G.stat('Door'),'LT',G.num(29))),
      G.vchg('vsz',-1.45),blk('p_setpos',{PART:bme(),X:G.ppos('x'),Y:bn(4.5),Z:G.vget('vsz')}),
      G.iff(G.cmp({block:{type:'s_distance',inputs:{PART:bme()}}},'LT',G.num(3.4)),G.msg('Watcher caught you...',3),blk('pl_damage',{N:bn(1000)})),G.wait(.1)),
    blk('p_setpos',{PART:bme(),X:bn(0),Y:bn(-60),Z:bn(0)}),blk('g_sky',null,{COLOUR:'#07080d'}),
    G.iff(G.cmp(G.stat('Door'),'GTE',G.num(29)),G.sound('win'),G.msg('You escaped THE WATCHER! +5 coins',3),blk('pl_coins',{N:bn(5)})),G.until(G.cmp(G.stat('Door'),'LT',G.num(25))))),[['seek z','vsz']]);
  // WHISPER lurks in the dark rooms (doors 8 to 20). When it says "Psst!", shine your flashlight at it within 3 seconds!
  const fl=gkGun(p,'pack','Flashlight',{dmg:0,cool:1,color:'#fffde7',speed:400,body:'#fbc02d',tip:'Shine it at Whisper!'});
  const scr=G.part(p,'workspace',{name:'Whisper',shape:'ball',pos:[0,-60,0],size:[2.4,2.4,2.4],color:'#111111',material:'Neon',canCollide:false,unbreakable:true,label:'👁️ Psst!'});
  const hpn={block:{type:'s_partname',inputs:{PART:{block:{type:'tool_hitpart'},shadow:{type:'p_this'}}}}};
  G.vars(G.script(p,fl.id,'Shine',blk('ev_tool_hit'),G.iff(G.AND(G.cmp(hpn,'EQ',G.txt('Whisper')),G.cmp(G.vget('vscreech'),'EQ',G.num(1))),G.vset('vscreech',G.num(0)),G.sound('check'),G.msg('Whisper hates the light! It fled.',2),
    blk('p_setpos',{PART:G.pnamed('Whisper'),X:bn(0),Y:bn(-60),Z:bn(0)}))),[['screech','vscreech']]);
  G.vars(G.script(p,'sss','Whisper',blk('ev_start'),G.wait(15),G.forever(G.wait(G.rnd(25,45)),G.iff(G.AND(G.cmp(G.stat('Door'),'GTE',G.num(8)),G.cmp(G.stat('Door'),'LT',G.num(20))),
    G.vset('vscreech',G.num(1)),blk('p_setpos',{PART:G.pnamed('Whisper'),X:G.arith('ADD',G.ppos('x'),G.rnd(-5,5)),Y:G.arith('ADD',G.ppos('y'),G.num(3)),Z:G.arith('ADD',G.ppos('z'),G.rnd(-6,6))}),G.sound('click'),G.msg('Psst! 👁️ (shine your flashlight at it!)',2),
    G.wait(3),G.iff(G.cmp(G.vget('vscreech'),'EQ',G.num(1)),G.vset('vscreech',G.num(0)),G.sound('die'),G.msg('WHISPER bit you!',2),blk('pl_damage',{N:bn(40)}),blk('p_setpos',{PART:G.pnamed('Whisper'),X:bn(0),Y:bn(-60),Z:bn(0)}))))),[['screech','vscreech']]);
  // STOPPER haunts room 33: when the hallway turns blue and it says TURN AROUND, walk backwards or get hurt
  {const zc=-32*L-L/2;P({name:'HaltGlow',pos:[0,9.2,zc],size:[Wd-2,.3,L-2],color:'#1e88e5',material:'Neon',transparency:.5});}
  G.vars(G.script(p,'sss','Stopper',blk('ev_start'),G.forever(G.until(G.cmp(G.stat('Door'),'EQ',G.num(32))),G.msg('Something is in this hallway... listen for STOPPER',2.5),G.wait(2),
    G.whileDo(G.cmp(G.stat('Door'),'EQ',G.num(32)),G.wait(G.rnd(2,4)),G.iff(G.cmp(G.stat('Door'),'EQ',G.num(32)),blk('g_sky',null,{COLOUR:'#0d47a1'}),G.sound('click'),G.msg('🛑 TURN AROUND!',1.2),G.vset('vhz',G.ppos('z')),G.wait(1.2),
      G.ifElse(G.cmp(G.ppos('z'),'LT',G.arith('MINUS',G.vget('vhz'),G.num(1))),[G.sound('die'),G.msg('Stopper hit you! Walk BACK when it says turn around.',2),blk('pl_damage',{N:bn(30)})],[G.msg('...go on.',.8)]),blk('g_sky',null,{COLOUR:'#07080d'}))))),[['halt z','vhz']]);
  // vitamins: a short speed boost
  for(let i=6;i<N;i+=7){const zc=-i*L-L/2;const v=P({name:'Vitamins',pos:[(i%2?1:-1)*(Wd/2-3),2.9,zc+6],size:[.8,1,.8],color:'#ff6f00',material:'Neon',canCollide:false,label:'💊'});
    G.script(p,v.id,'Take',blk('ev_touch'),blk('p_visible',{PART:bme()},{B:'FALSE'}),blk('p_setpos',{PART:bme(),X:bn(0),Y:bn(-70),Z:bn(0)}),G.msg('Vitamins! Speed for 8 seconds',1.5),G.sound('pad'),blk('pl_speed',{V:bn(23)}),G.wait(8),blk('pl_speed',{V:bn(16)}));}
  G.welcome(p,G.sset('Door',0),G.vset('vkey',G.num(0)),G.msg('Get through 40 doors. Every 5th door is locked: find its key. When the lights flicker, hide in a wardrobe! Your flashlight (1) scares off Whisper.',6));
  G.best(p,'Door','doors_best');
  return G.def(p,'doors','Haunted Hotel');}

/* 23. Weapon Ladder: every knockout gives you the next weapon; the golden knife wins */
function arsenalDef(){const G=GK;const p=G.proj('arsenal','Weapon Ladder',{sky:'#ffb74d',fog:500,timer:false,saveStats:false,saveCheckpoint:false,deathStyle:'ragdoll',lobby:true,lobbyWait:12,lobbyRound:180,lobbyScore:'KOs'});
  const bp=p.nodes.find(n=>n.name==='Baseplate');Object.assign(bp,{size:[150,2,150],color:'#c2b280',material:'Sand'});
  const A=G.folder(p,'Map').id;const P=o=>G.part(p,A,o);
  [[0,-72,146,2],[0,72,146,2],[-72,0,2,146],[72,0,2,146]].forEach(([x,z,w,d])=>P({name:'Wall',pos:[x,6,z],size:[w,12,d],color:'#8d6e63',material:'Brick'}));
  [[-30,-30,14,12,14],[30,30,14,16,14],[30,-34,18,8,10],[-34,30,10,10,18],[0,0,12,6,12],[-50,0,6,14,22],[50,0,6,14,22]].forEach(([x,z,w,h,d])=>{P({name:'Building',pos:[x,h/2,z],size:[w,h,d],color:'#bcaaa4',material:'Brick'});P({name:'Ramp',shape:'wedge',pos:[x,h/2,z+d/2+h/2],size:[4,h,h],rot:[0,180,0],color:'#a1887f',material:'Wood'});});
  [[-15,15],[15,-15],[-55,-55],[55,55],[0,-50],[0,50]].forEach(([x,z])=>P({name:'Crate',pos:[x,2,z],size:[4,4,4],color:'#a1764b',material:'Wood'}));
  G.spawnAt(p,0,6.5,0,{size:[6,1,6],color:'#ff7043'});
  // second map: Snow Fort, 300 studs east
  const AOX='vaox',AV=[['map x',AOX]];const ox=v=>G.arith('ADD',typeof v==='number'?G.num(v):v,G.vget(AOX));
  {const OX=300,S2=G.folder(p,'Snow Fort').id;const Q=o=>G.part(p,S2,o);
    Q({name:'Snow',pos:[OX,-1,0],size:[150,2,150],color:'#f5f9ff',material:'Snow'});
    [[0,-72,146,2],[0,72,146,2],[-72,0,2,146],[72,0,2,146]].forEach(([x,z2,w,d])=>Q({name:'IceWall',pos:[OX+x,6,z2],size:[w,12,d],color:'#b3e5fc',material:'Ice',transparency:.2}));
    [[-28,0],[28,0]].forEach(([x,z2],i)=>{const c=i?'#90caf9':'#ef9a9a';Q({name:'Fort',pos:[OX+x,3,z2-10],size:[16,6,2],color:c,material:'Snow'});Q({name:'Fort',pos:[OX+x,3,z2+10],size:[16,6,2],color:c,material:'Snow'});
      Q({name:'Fort',pos:[OX+x+(i?8:-8),3,z2],size:[2,6,22],color:c,material:'Snow'});Q({name:'Tower',pos:[OX+x+(i?8:-8),9,z2],size:[6,6,6],color:c,material:'Snow'});
      Q({name:'Ramp',shape:'wedge',pos:[OX+x+(i?8:-8),6,z2+7],size:[4,6,8],rot:[0,180,0],color:'#e3f2fd',material:'Snow'});});
    for(let i=0;i<12;i++){const a=i/12*Math.PI*2,r=48;Q({name:'Snowbank',pos:[OX+r3(Math.cos(a)*r),1.5,r3(Math.sin(a)*r)],size:[8,3,4],rot:[0,r3(-a*57.3),0],color:'#ffffff',material:'Snow'});}
    [[0,-40],[0,40],[0,0]].forEach(([x,z2])=>Q({name:'IceBlock',pos:[OX+x,2.5,z2],size:[5,5,5],color:'#80deea',material:'Ice',transparency:.25}));
    [[-50,-50],[50,50],[50,-50],[-50,50]].forEach(([x,z2])=>Q({name:'JumpPad',pos:[OX+x,.3,z2],size:[4,.4,4],color:'#22d3ee',material:'Neon',behavior:'jump',value:95}));}
  {const OX=600,R3=G.folder(p,'Rooftops').id;const Q=o=>G.part(p,R3,o);
    Q({name:'Street',pos:[OX,-1,0],size:[150,2,150],color:'#455a64',material:'Concrete'});
    const blds=[[-45,-45,24,18],[0,-45,20,26],[45,-45,24,14],[-45,0,20,22],[45,0,20,20],[-45,45,24,16],[0,45,20,24],[45,45,24,18]];
    blds.forEach(([x,z2,w,h],i)=>{Q({name:'Building',pos:[OX+x,h/2,z2],size:[w,h,w],color:['#8d6e63','#78909c','#a1887f','#90a4ae'][i%4],material:'Brick'});
      Q({name:'Roof',pos:[OX+x,h+.3,z2],size:[w-2,.6,w-2],color:'#37474f',material:'Concrete'});Q({name:'JumpPad',pos:[OX+x+w/2+3,.3,z2],size:[4,.4,4],color:'#22d3ee',material:'Neon',behavior:'jump',value:Math.min(150,60+h*3.4)});});
    [[-45,-22.5,-45,22.5],[45,-22.5,45,22.5],[-22.5,-45,22.5,-45],[-22.5,45,22.5,45]].forEach(([x1,z1,x2,z2])=>Q({name:'Plank',pos:[OX+(x1+x2)/2,16,(z1+z2)/2],size:[Math.abs(x2-x1)+3,.6,Math.abs(z2-z1)+3],color:'#8d6e63',material:'Wood'}));
    Q({name:'Center',pos:[OX,2,0],size:[16,4,16],color:'#607d8b',material:'Concrete'});}
  G.vars(G.script(p,'sss','Pick map',G.onMsg('round start'),G.vset(AOX,G.arith('MULTIPLY',G.rnd(0,2),G.num(300))),G.ifElse(G.cmp(G.vget(AOX),'EQ',G.num(0)),[blk('g_sky',null,{COLOUR:'#ffb74d'})],[G.ifElse(G.cmp(G.vget(AOX),'EQ',G.num(300)),[blk('g_sky',null,{COLOUR:'#b3e5fc'}),G.msg('Map: SNOW FORT',2)],[blk('g_sky',null,{COLOUR:'#ff8a65'}),G.msg('Map: ROOFTOPS',2)])]),
    blk('pl_tpxyz',{X:ox(G.rnd(-55,55)),Y:bn(4),Z:G.rnd(-55,55)})),AV);
  const TIERS=[['Blaster',25,.3,'#5cc8ff',230,0],['Rapid Blaster',12,.1,'#69f0ae',260,0],['Scatter Cannon',45,.8,'#ffab40',200,.6],['Flamethrower',9,.07,'#ff9100',95,.3],['Sniper',100,1.4,'#ea80fc',420,1.6],['Railgun',80,1.0,'#18ffff',600,1.8],['Rocket Launcher',70,1.2,'#ff5252',150,1]];
  TIERS.forEach(([nm,dmg,cool,col,spd,len],i)=>gkGun(p,i===0?'pack':'rs',nm,{dmg,cool,color:col,speed:spd,len,body:['#37474f','#1b5e20','#e65100','#bf360c','#4a148c','#006064','#b71c1c'][i],tip:'Weapon '+(i+1)+' of '+(TIERS.length+1)}));
  gkMelee(p,'rs','Golden Knife',{dmg:100,cool:.4,color:'#ffd54f',mat:'Neon',tip:'Get one knockout with this to WIN'});
  const NAMES=TIERS.map(t=>t[0]).concat(['Golden Knife']);
  const TI='vtier',MV=G.matchFlags(p),VARS=[['tier',TI],...MV];
  // when your knockouts go up, swap to the next weapon
  G.vars(G.script(p,'sss','Gun game',G.onMsg('round start'),G.vset(TI,G.num(0)),...NAMES.map(n=>blk('tool_take',null,{NAME:n})),blk('tool_give',null,{NAME:'Blaster'}),
    G.whileDo(G.inMatch(),G.iff(G.AND(G.cmp(G.stat('KOs'),'GT',G.vget(TI)),G.cmp(G.vget(TI),'LT',G.num(NAMES.length))),G.vchg(TI,1),
      ...NAMES.map((n,k)=>G.iff(G.cmp(G.vget(TI),'EQ',G.num(k+1)),blk('tool_take',null,{NAME:n}))),
      ...NAMES.map((n,k)=>G.iff(G.cmp(G.vget(TI),'EQ',G.num(k+1)),...(k+1<NAMES.length?[blk('tool_give',null,{NAME:NAMES[k+1]}),G.msg('New weapon: '+NAMES[k+1]+'! Press 1',1.6),G.sound('check'),blk('g_callout',{TEXT:G.txt(k+1===NAMES.length-1?'GOLDEN KNIFE!':'WEAPON '+(k+2)+'!')})]:[]))),
      G.iff(G.cmp(G.vget(TI),'EQ',G.num(NAMES.length)),G.sset('KOs',99),G.sound('win'),G.msg('GOLDEN KNIFE KNOCKOUT! YOU WIN! +20 coins',5),blk('pl_coins',{N:bn(20)}))),G.wait(.2))),VARS);
  // medkits and jump pads around the map
  [[-40,0],[40,0],[0,-40],[0,40]].forEach(([x,z],i)=>{const mk=P({name:'Medkit'+i,pos:[x,1.2,z],size:[2,1.4,2],color:'#ef5350',material:'Neon',canCollide:false,label:'+'});
    G.script(p,mk.id,'Heal',blk('ev_touch'),blk('pl_heal',{N:bn(50)}),G.sound('coin'),blk('p_visible',{PART:bme()},{B:'FALSE'}),G.wait(15),blk('p_visible',{PART:bme()},{B:'TRUE'}));});
  [[-30,-14],[30,14],[-14,30],[14,-30]].forEach(([x,z])=>P({name:'JumpPad',pos:[x,.3,z],size:[4,.4,4],color:'#22d3ee',material:'Neon',behavior:'jump',value:95}));
  G.vars(G.script(p,'sss','Respawn spot',blk('ev_spawn'),G.wait(.05),G.ifElse(G.cmp(G.rnd(1,4),'EQ',G.num(1)),[blk('pl_tpxyz',{X:ox(-60),Y:bn(4),Z:bn(-60)})],[G.ifElse(G.cmp(G.rnd(1,3),'EQ',G.num(1)),[blk('pl_tpxyz',{X:ox(60),Y:bn(4),Z:bn(60)})],[G.ifElse(G.cmp(G.rnd(1,2),'EQ',G.num(1)),[blk('pl_tpxyz',{X:ox(60),Y:bn(4),Z:bn(-60)})],[blk('pl_tpxyz',{X:ox(-60),Y:bn(4),Z:bn(60)})])])])),AV);
  // bots fill up to 6 fighters
  const NB='vnbots',BV=[['bots',NB],...AV],BCOLS=['#e53935','#1e88e5','#43a047','#8e24aa','#fb8c00'],HOME=[[-60,-60],[60,60],[60,-60],[-60,60],[0,-60]];
  for(let k=1;k<=5;k++){const r=rigNode({name:'Bot'+k,pos:[HOME[k-1][0],2.6,HOME[k-1][1]],health:100,respawn:3,walkSpeed:14,colors:{head:'#ffcc80',torso:BCOLS[k-1],arms:'#ffcc80',legs:'#212121'}});p.nodes.push(r);
    const bolt=G.part(p,'workspace',{name:'BotBolt'+k,shape:'ball',pos:[0,-50,0],size:[.8,.8,.8],color:BCOLS[k-1],material:'Neon',canCollide:false,unbreakable:true});
    G.vars(G.hscript(p,r.id,'Fight',blk('ev_start'),G.forever(G.ifElse(G.cmp(G.num(k),'GT',G.vget(NB)),[G.wait(.5)],
      [G.ifElse(G.cmp(G.nearD(bme()),'LT',G.num(30)),[blk('rig_walk',{PART:bme(),X:G.arith('ADD',G.nearAx(bme(),'x'),G.rnd(-8,8)),Z:G.arith('ADD',G.nearAx(bme(),'z'),G.rnd(-8,8))})],
        [G.walkN(bme()),G.wait(.3)])]))),[...BV]);
    G.vars(G.hscript(p,r.id,'Shoot',blk('ev_start'),G.forever(G.wait(G.arith('DIVIDE',G.rnd(14,28),G.num(10))),G.iff(G.AND(G.cmp(G.num(k),'LTE',G.vget(NB)),G.AND(G.cmp({block:{type:'s_rig_health',inputs:{PART:bme()}}},'GT',G.num(0)),G.cmp(G.nearD(bme()),'LT',G.num(40)))),
      blk('p_setpos',{PART:G.pnamed('BotBolt'+k),X:G.prop(bme(),'x'),Y:G.arith('ADD',G.prop(bme(),'y'),G.num(1)),Z:G.prop(bme(),'z')}),
      blk('p_glideto',{PART:G.pnamed('BotBolt'+k),X:G.nearAx(bme(),'x'),Y:G.arith('ADD',G.nearAx(bme(),'y'),G.num(2.5)),Z:G.nearAx(bme(),'z'),S:bn(.35)}),
      G.iff(G.AND(G.cmp(G.nearD(G.pnamed('BotBolt'+k)),'LT',G.num(4.8)),G.cmp(G.rnd(1,10),'LTE',G.num(8))),G.asP({block:{type:'pl_ref_nearpart',inputs:{PART:G.pnamed('BotBolt'+k)}}},blk('pl_damage',{N:bn(11)}))),
      blk('p_setpos',{PART:G.pnamed('BotBolt'+k),X:bn(0),Y:bn(-50),Z:bn(0)})))),BV);
    G.script(p,r.id,'KO',blk('ev_rig_died'),G.sadd('KOs',1));
    G.vars(G.hscript(p,r.id,'Back to map',blk('ev_rig_died'),G.wait(3.3),blk('p_setpos',{PART:bme(),X:ox(HOME[k-1][0]),Y:bn(2.6),Z:bn(HOME[k-1][1])})),BV);}
  G.vars(G.hscript(p,'sss','Bots',G.onMsg('round start'),G.ifElse(G.cmp(G.players(),'GTE',G.num(6)),[G.vset(NB,G.num(0))],[G.vset(NB,G.arith('MINUS',G.num(6),G.players()))]),
    ...[1,2,3,4,5].map(k=>G.ifElse(G.cmp(G.num(k),'LTE',G.vget(NB)),[blk('p_visible',{PART:G.pnamed('Bot'+k)},{B:'TRUE'}),blk('p_setpos',{PART:G.pnamed('Bot'+k),X:ox(HOME[k-1][0]),Y:bn(2.6),Z:bn(HOME[k-1][1])})],
      [blk('p_visible',{PART:G.pnamed('Bot'+k)},{B:'FALSE'}),blk('p_setpos',{PART:G.pnamed('Bot'+k),X:bn(k*6),Y:bn(2.6),Z:bn(200)})]))),BV);
  // knockout streak rewards
  G.vars(G.script(p,'sss','Streaks',G.onMsg('round start'),G.vset('vlk',G.num(0)),G.vset('vstk',G.num(0)),G.whileDo(G.inMatch(),
    G.iff(G.AND(G.cmp(G.stat('KOs'),'GT',G.vget('vlk')),G.cmp(G.stat('KOs'),'LT',G.num(50))),G.vchg('vstk',G.arith('MINUS',G.stat('KOs'),G.vget('vlk'))),G.vset('vlk',G.stat('KOs')),
      G.iff(G.cmp(G.vget('vstk'),'EQ',G.num(2)),G.sound('check'),G.msg('🔥 2 streak: +50 health!',1.5),blk('pl_heal',{N:bn(50)})),
      G.iff(G.cmp(G.vget('vstk'),'EQ',G.num(3)),G.sound('win'),G.msg('⚡ 3 streak: SPEED!',1.5),blk('pl_speed',{V:bn(22)})),
      G.iff(G.cmp(G.vget('vstk'),'EQ',G.num(5)),G.sound('win'),G.msg('🛡️ 5 streak: 8 second SHIELD!',1.5),blk('pl_shield',{S:bn(8)}))),G.wait(.3))),[['last kos','vlk'],['streak','vstk'],...G.MV]);
  G.vars(G.script(p,'sss','Streak lost',blk('ev_died'),G.vset('vstk',G.num(0)),blk('pl_speed',{V:bn(16)})),[['streak','vstk']]);
  // the rival bot climbs its own ladder: one step every 20 seconds and one each time you are knocked out
  const RV='vrival',RVV=[['rival tier',RV],['bots',NB],['tier',TI],...G.MV];
  G.vars(G.script(p,'sss','Rival ladder',G.onMsg('round start'),G.vset(RV,G.num(0)),G.wait(1),G.whileDo(G.AND(G.inMatch(),G.cmp(G.vget(RV),'LT',G.num(NAMES.length))),G.wait(20),
    G.iff(G.AND(G.inMatch(),G.cmp(G.vget(NB),'GT',G.num(0))),G.vchg(RV,1),G.iff(G.cmp(G.vget(RV),'EQ',G.num(NAMES.length-1)),G.sound('nope'),G.msg('⚠️ The rival bot has the Golden Knife! Hurry!',2.5)),
      G.iff(G.AND(G.cmp(G.vget(RV),'GTE',G.num(NAMES.length)),G.cmp(G.vget(TI),'LT',G.num(NAMES.length))),G.sound('die'),G.msg('Pixel (bot) finished the ladder first! Beat the rival next match.',4))))),RVV);
  G.vars(G.script(p,'sss','Rival gains',blk('ev_died'),G.iff(G.AND(G.inMatch(),G.AND(G.cmp(G.vget(NB),'GT',G.num(0)),G.cmp(G.vget(RV),'LT',G.num(NAMES.length)))),G.vchg(RV,1),
    G.iff(G.AND(G.cmp(G.vget(RV),'GTE',G.num(NAMES.length)),G.cmp(G.vget(TI),'LT',G.num(NAMES.length))),G.msg('Pixel (bot) finished the ladder first! Beat the rival next match.',4)))),RVV);
  G.hud(p,'Ladder','#e65100',G.join('🔫 You ',G.vget(TI),'/',String(NAMES.length),'   ·   🤖 Rival ',G.vget(RV),'/',String(NAMES.length)));
  G.welcome(p,G.sset('KOs',0),G.vset(RV,G.num(0)),G.msg('Weapon Ladder: every knockout upgrades your weapon. Get a knockout with the Golden Knife before the rival bot does!',5));
  return G.def(p,'arsenal','Weapon Ladder');}

/* 24. Trap Run: run the trap course; Death (a player, or a bot if there are few players) springs the traps */
function deathrunDef(){const G=GK;const p=G.proj('deathrun','Trap Run',{sky:'#263238',fog:500,brightness:.9,timer:false,saveStats:false,saveCheckpoint:false,deathStyle:'ragdoll',lobby:true,lobbyWait:12,lobbyRound:120,lobbyScore:'Score',lobbyElim:true});
  const TR=[1,2,3,4,5,6,7,8];G.noBase(p);const Y=20;
  G.spawnAt(p,0,20.5,10,{size:[12,1,10],color:'#43a047'});
  const MOX='vdox',MV2=[['map x',MOX]];
  const ROLE='vdeath',RQ=k=>'vtrap'+k,DONE=(k,S)=>'vtrapdone'+k+S,KV=[['death',ROLE],['map x',MOX],...TR.map(k=>['trap request '+k,RQ(k)]),...TR.map(k=>['trap done '+k,DONE(k,'')]),...TR.map(k=>['trap done B'+k,DONE(k,'B')]),...TR.map(k=>['trap done C'+k,DONE(k,'C')])];
  // two courses: the Dungeon and the Haunted Woods (300 studs east, traps in a different order)
  const COURSES=[{ox:0,S:'',path:'#546e7a',mat:'Concrete',order:[1,2,3,4,5,6,7,8],name:'DUNGEON'},{ox:300,S:'B',path:'#5d4037',mat:'Wood',order:[3,1,7,4,2,8,5,6],name:'HAUNTED WOODS'},{ox:600,S:'C',path:'#b3e5fc',mat:'Ice',order:[2,4,6,8,1,3,5,7],name:'ICE CAVERNS'}];
  const pick=(S)=>G.cmp(G.vget(MOX),'EQ',G.num(S==='C'?600:S?300:0));
  G.vars(G.script(p,'sss','Pick course',G.onMsg('round start'),G.vset(MOX,G.arith('MULTIPLY',G.rnd(0,2),G.num(300))),G.ifElse(G.cmp(G.vget(MOX),'EQ',G.num(0)),[blk('g_sky',null,{COLOUR:'#263238'})],[G.ifElse(G.cmp(G.vget(MOX),'EQ',G.num(300)),[blk('g_sky',null,{COLOUR:'#1b2a1b'}),G.msg('Course: HAUNTED WOODS',2)],[blk('g_sky',null,{COLOUR:'#4f6d8a'}),G.msg('Course: ICE CAVERNS',2)])]),
    blk('pl_tpxyz',{X:G.vget(MOX),Y:bn(23),Z:bn(8)})),MV2);
  COURSES.forEach(({ox,S,path,mat,order})=>{const C=G.folder(p,'Course'+S).id;const P=o=>G.part(p,C,Object.assign({},o,{name:o.name+S,pos:[o.pos[0]+ox,o.pos[1],o.pos[2]]}));
    let z=4;const seg=len=>{P({name:'Path',pos:[0,Y,z-len/2],size:[12,1,len],color:path,material:mat});z-=len;};
    if(S)P({name:'Start',pos:[0,Y,8],size:[12,1,10],color:'#43a047'});
    if(S==='C')for(let i=0;i<24;i++){const sd=i%2?1:-1;P({name:'Icicle',pos:[sd*(10+(i*5)%6),Y+8,-i*12],size:[1.5,6,1.5],color:'#e1f5fe',material:'Ice',canCollide:false});}
    if(S==='B')for(let i=0;i<20;i++){const sd=i%2?1:-1;P({name:'Tree',pos:[sd*(14+(i*7)%9),Y-6,-i*15],size:[2,22,2],color:'#3e2723',material:'Wood'});P({name:'Leaves',pos:[sd*(14+(i*7)%9),Y+6,-i*15],size:[8,6,8],color:'#1b5e20',material:'Grass',canCollide:false});}
    const Z={};
    const build={
      1:()=>{seg(8);Z[1]=z-6;P({name:'TrapDrop',pos:[0,Y,z-6],size:[12,1,12],color:'#8d6e63',material:'Wood',label:'1'});z-=12;},
      2:()=>{seg(8);Z[2]=z-6;P({name:'Path',pos:[0,Y,Z[2]],size:[12,1,12],color:path,material:mat});P({name:'TrapSpikes',pos:[0,Y-1.5,Z[2]],size:[11,1.5,11],color:'#b0bec5',material:'Metal',behavior:'kill'});z-=12;},
      3:()=>{seg(8);Z[3]=z-6;P({name:'Path',pos:[0,Y,Z[3]],size:[12,1,12],color:path,material:mat});P({name:'TrapSweep',pos:[-30,Y+1.6,Z[3]],size:[2,2,11],color:'#ff1744',material:'Neon',behavior:'kill'});z-=12;},
      4:()=>{seg(8);Z[4]=z-8;P({name:'Path',pos:[0,Y,Z[4]],size:[12,1,16],color:path,material:mat});P({name:'TrapLava',pos:[0,Y-3,Z[4]],size:[11.6,1,15.6],color:'#ff3d00',material:'Neon',behavior:'kill'});z-=16;},
      5:()=>{seg(30);Z[5]=z+15;Z.b=z+30;P({name:'TrapBoulder',shape:'ball',pos:[0,Y+3,-500],size:[8,8,8],color:'#6d4c41',material:'Slate',behavior:'kill'});},
      6:()=>{seg(6);Z[6]=z-2;P({name:'TrapLaser',pos:[0,Y-8,Z[6]],size:[12,6,.6],color:'#e040fb',material:'Neon',behavior:'kill',canCollide:false});seg(10);},
      7:()=>{Z[7]=z-5;P({name:'Path',pos:[0,Y,Z[7]],size:[12,1,10],color:path,material:mat});P({name:'TrapHammer',pos:[-16,Y+2.5,Z[7]],size:[6,4,2.4],color:'#6d4c41',material:'Metal',behavior:'kill'});z-=10;seg(6);},
      8:()=>{Z[8]=z-8;const BRM=G.model(p,'TrapBridge'+S).id;for(let i=0;i<4;i++)G.part(p,BRM,{name:'Plank',pos:[ox,Y,Z[8]+6-i*4],size:[12,1,3.8],color:'#8d6e63',material:'Wood'});z-=16;seg(8);}};
    seg(10);order.forEach(k=>build[k]());
    const fin=P({name:'Finish',pos:[0,Y,z-8],size:[16,1,16],color:'#ffd740',material:'Neon',label:'FINISH'});
    [-7,7].forEach(x=>P({name:'Rail',pos:[x,Y+3,(z-8)/2],size:[1,6,-z+30],color:'#90a4ae',material:'Glass',transparency:.6}));
    P({name:'Below',pos:[0,Y-20,(z-8)/2],size:[60,1,-z+60],color:'#ff3d00',material:'Neon',behavior:'kill'});
    const roomZ=r3((z-8)/2);P({name:'DeathRoom',pos:[22,Y+14,roomZ],size:[14,1,44],color:'#212121',material:'Metal',label:"DEATH'S ROOM"});
    TR.forEach(k=>P({name:'Mark'+k,pos:[0,Y+2,k===5?Z[5]:Z[k]+4],size:[1,1,1],color:'#000000',transparency:1,canCollide:false}));
    TR.forEach(k=>{const b=G.part(p,'workspace',{name:'Button'+k+S,pos:[18+ox,Y+15,r3(roomZ+20-order.indexOf(k)*5)],size:[3,.6,3],color:'#d50000',material:'Neon',label:String(order.indexOf(k)+1)});
      G.vars(G.script(p,b.id,'Press',blk('ev_touch'),G.iff(G.cmp(G.vget(ROLE),'EQ',G.myId()),G.shChg(RQ(k),1),G.sound('click'),G.msg('Trap '+(order.indexOf(k)+1)+'!',1),G.wait(2))),KV);});
    const deathBot=rigNode({name:'Death'+S,pos:[26+ox,Y+17.1,roomZ],scale:1.3,health:9999,respawn:0,walkSpeed:0,colors:{head:'#212121',torso:'#000000',arms:'#212121',legs:'#000000'}});p.nodes.push(deathBot);
    const n=nm=>G.pnamed(nm+S),X=v=>bn(v+ox);
    const ACT={1:[blk('p_collide',{PART:n('TrapDrop')},{B:'FALSE'}),blk('p_transp',{PART:n('TrapDrop')},{V:bn(.9)}),G.wait(2.5),blk('p_collide',{PART:n('TrapDrop')},{B:'TRUE'}),blk('p_transp',{PART:n('TrapDrop')},{V:bn(0)})],
      2:[blk('p_glide',{PART:n('TrapSpikes'),X:bn(0),Y:bn(2.5),Z:bn(0),S:bn(.2)}),G.wait(1.6),blk('p_glide',{PART:n('TrapSpikes'),X:bn(0),Y:bn(-2.5),Z:bn(0),S:bn(.6)})],
      3:[blk('p_setpos',{PART:n('TrapSweep'),X:X(-8),Y:bn(Y+1.6),Z:bn(Z[3])}),blk('p_glide',{PART:n('TrapSweep'),X:bn(16),Y:bn(0),Z:bn(0),S:bn(1)}),blk('p_setpos',{PART:n('TrapSweep'),X:X(-30),Y:bn(Y+1.6),Z:bn(Z[3])})],
      4:[blk('p_glide',{PART:n('TrapLava'),X:bn(0),Y:bn(3.6),Z:bn(0),S:bn(.6)}),G.wait(2.5),blk('p_glide',{PART:n('TrapLava'),X:bn(0),Y:bn(-3.6),Z:bn(0),S:bn(.8)})],
      5:[blk('p_setpos',{PART:n('TrapBoulder'),X:X(0),Y:bn(Y+4.5),Z:bn(Z.b-30)}),blk('p_glide',{PART:n('TrapBoulder'),X:bn(0),Y:bn(0),Z:bn(32),S:bn(1.6)}),blk('p_setpos',{PART:n('TrapBoulder'),X:X(0),Y:bn(Y+3),Z:bn(-500)})],
      6:[blk('p_setpos',{PART:n('TrapLaser'),X:X(0),Y:bn(Y+3.5),Z:bn(Z[6])}),G.wait(2),blk('p_setpos',{PART:n('TrapLaser'),X:X(0),Y:bn(Y-8),Z:bn(Z[6])})],
      7:[blk('p_setpos',{PART:n('TrapHammer'),X:X(-9),Y:bn(Y+2.5),Z:bn(Z[7])}),blk('p_glide',{PART:n('TrapHammer'),X:bn(18),Y:bn(0),Z:bn(0),S:bn(.7)}),blk('p_glide',{PART:n('TrapHammer'),X:bn(-18),Y:bn(0),Z:bn(0),S:bn(.7)}),blk('p_setpos',{PART:n('TrapHammer'),X:X(-16),Y:bn(Y+2.5),Z:bn(Z[7])})],
      8:[blk('p_color',{PART:G.mnamed('TrapBridge'+S)},{COLOUR:'#ff7043'}),G.wait(.4),blk('p_collide',{PART:G.mnamed('TrapBridge'+S)},{B:'FALSE'}),blk('p_transp',{PART:G.mnamed('TrapBridge'+S)},{V:bn(.85)}),G.wait(2.5),blk('p_collide',{PART:G.mnamed('TrapBridge'+S)},{B:'TRUE'}),blk('p_transp',{PART:G.mnamed('TrapBridge'+S)},{V:bn(0)}),blk('p_color',{PART:G.mnamed('TrapBridge'+S)},{COLOUR:'#8d6e63'})]};
    TR.forEach(k=>G.vars(G.hscript(p,'sss','Trap '+k+S,blk('ev_start'),G.vset(DONE(k,S),G.num(0)),G.forever(G.until(G.AND(pick(S),G.cmp(G.vget(RQ(k)),'GT',G.vget(DONE(k,S))))),G.vset(DONE(k,S),G.vget(RQ(k))),G.sound('explode'),...ACT[k],G.wait(3.5))),KV));
    G.vars(G.hscript(p,'sss','Death bot'+S,blk('ev_start'),G.forever(G.wait(.25),G.iff(G.AND(pick(S),G.cmp(G.vget(ROLE),'EQ',G.txt('bot'))),
      ...TR.map((k,i)=>G.iff(G.AND(G.cmp(G.vget(RQ(k)),'EQ',G.vget(DONE(k,S))),G.cmp({block:{type:'s_near_dist',inputs:{PART:n('Mark'+k)}}},'LT',G.num(k===5?24:9))),
        G.iff(G.cmp(G.rnd(1,3),'LTE',G.num(2)),G.vchg(RQ(k),1),blk('rig_say',{PART:n('Death'),TEXT:bt(['Bye!','Spikes!','Swing!','Hot!','Rolling!','Zap!','BONK!','Crumble!'][i]),S:bn(1)})),G.wait(.6)))))),KV);
    G.vars(G.script(p,fin.id,'Finish',blk('ev_touch'),G.iff(G.AND(G.aliveIn(),G.cmp(G.stat('Finished'),'EQ',G.num(0))),G.sset('Finished',1),G.sadd('Score',10),G.sound('win'),G.msg('You beat Trap Run! +10 coins',3),blk('pl_coins',{N:bn(10)}))),[...KV,...G.MV]);
    COURSES.find(c=>c.S===S).roomZ=roomZ;});
  const MV=G.matchFlags(p);
  const R0=COURSES[0].roomZ,R1=COURSES[1].roomZ,R2=COURSES[2].roomZ;
  G.vars(G.hscript(p,'sss','Pick Death',G.onMsg('round start'),...TR.map(k=>[G.vset(RQ(k),G.num(0)),G.vset(DONE(k,''),G.num(0)),G.vset(DONE(k,'B'),G.num(0)),G.vset(DONE(k,'C'),G.num(0))]).flat(),
    G.ifElse(G.cmp(G.players(),'GTE',G.num(3)),[G.vset(ROLE,G.idOf(G.pref('randplaying'))),G.asP(G.byId(G.vget(ROLE)),G.wait(.2),G.ifElse(G.cmp(G.vget(MOX),'EQ',G.num(0)),[G.tp(22,Y+16,R0)],[G.ifElse(G.cmp(G.vget(MOX),'EQ',G.num(300)),[G.tp(322,Y+16,R1)],[G.tp(622,Y+16,R2)])]),G.msg('You are DEATH! Step on the red buttons to spring traps on the runners.',5)),
      blk('p_visible',{PART:G.pnamed('Death')},{B:'FALSE'}),blk('p_visible',{PART:G.pnamed('DeathB')},{B:'FALSE'}),blk('p_visible',{PART:G.pnamed('DeathC')},{B:'FALSE'})],[G.vset(ROLE,G.txt('bot')),blk('p_visible',{PART:G.pnamed('Death')},{B:'TRUE'}),blk('p_visible',{PART:G.pnamed('DeathB')},{B:'TRUE'}),blk('p_visible',{PART:G.pnamed('DeathC')},{B:'TRUE'}),G.msg('Death is watching... run!',3)])),[...KV,...MV]);
  G.vars(G.script(p,'sss','Reset',G.onMsg('round start'),G.sset('Finished',0)),MV);
  G.vars(G.script(p,'sss','Runner down',blk('ev_died'),G.iff(G.NOT(G.cmp(G.vget(ROLE),'EQ',G.myId())),G.shChg('vdeathkills',1))),[['death kills','vdeathkills'],...KV]);
  G.vars(G.script(p,'sss','Death score',G.onMsg('round end'),G.iff(G.cmp(G.vget(ROLE),'EQ',G.myId()),G.sset('Score',G.arith('MULTIPLY',G.vget('vdeathkills'),G.num(4))))),[['death kills','vdeathkills'],...KV]);
  G.vars(G.hscript(p,'sss','Reset kills',G.onMsg('round start'),G.vset('vdeathkills',G.num(0))),[['death kills','vdeathkills']]);
  G.welcome(p,G.sset('Score',0),G.sset('Finished',0),G.msg('Trap Run: reach the end of the course while Death springs the traps! Three courses take turns.',5));
  {const dsel=(ox,S)=>G.arith('MULTIPLY',{block:{type:'s_distance',inputs:{PART:G.pnamed('Finish'+S)}}},G.cmp(G.vget('vdox'),'EQ',G.num(ox)));
   G.hud(p,'Finish','#455a64',G.join('🏁 ',G.round(G.arith('ADD',G.arith('ADD',dsel(0,''),dsel(300,'B')),dsel(600,'C'))),' studs to the finish   ·   ⭐ ',G.stat('Score')));}
  return G.def(p,'deathrun','Trap Run');}

/* 25. Hide and Seek: one seeker, everyone else hides. Bots hide (or seek) when players are short */
function hideSeekDef(){const G=GK;const p=G.proj('hideseek','Hide and Seek',{sky:'#a5d6f7',fog:600,timer:false,saveStats:false,saveCheckpoint:false,lobby:true,lobbyWait:12,lobbyRound:130,lobbyScore:'Score'});
  const bp=p.nodes.find(n=>n.name==='Baseplate');Object.assign(bp,{size:[200,2,200],color:'#7cb342',material:'Grass'});
  const H=G.folder(p,'Town').id;const P=o=>G.part(p,H,o);
  // four houses with rooms, beds and closets, plus a playground, hedges and bushes you can hide inside
  const house=(cx,cz,col,roof)=>{const w=(x,z,a,b)=>P({name:'Wall',pos:[cx+x,5,cz+z],size:[a,10,b],color:col,material:'Brick'});
    w(0,-14,30,1);w(-15,0,1,28);w(15,0,1,28);w(-10,14,10,1);w(10,14,10,1);w(0,0,1,10);w(-8,0,14,1);
    P({name:'Roof',pos:[cx,10.4,cz],size:[32,.8,30],color:roof,material:'Wood'});P({name:'Floor',pos:[cx,.15,cz],size:[30,.3,28],color:'#a1887f',material:'Wood'});
    P({name:'Bed',pos:[cx+9,1.4,cz-9],size:[7,1.2,9],color:'#5c6bc0',material:'Fabric'});[[-1,-1],[1,-1],[-1,1],[1,1]].forEach(([a,b])=>P({name:'BedLeg',pos:[cx+9+a*3,.4,cz-9+b*4],size:[.6,.8,.6],color:'#3e2723'}));
    P({name:'Closet',pos:[cx-13,4,cz-9],size:[2.6,8,.4],color:'#6d4c41',material:'Wood'});P({name:'Closet',pos:[cx-13,4,cz-4.6],size:[2.6,8,.4],color:'#6d4c41',material:'Wood'});P({name:'ClosetDoor',pos:[cx-11.6,4,cz-6.8],size:[.3,8,4.2],color:'#8d6e63',material:'Wood',transparency:.25,canCollide:false});
    P({name:'Couch',pos:[cx-6,1.4,cz+8],size:[8,2.8,3],color:'#8e24aa',material:'Fabric'});P({name:'Fridge',pos:[cx+12,3.5,cz+9],size:[3,7,3],color:'#eceff1',material:'Metal'});};
  house(-50,-50,'#ef9a9a','#b71c1c');house(50,-50,'#90caf9','#0d47a1');house(-50,50,'#fff59d','#f57f17');house(50,50,'#c5e1a5','#1b5e20');
  for(let i=0;i<14;i++){const a=i/14*Math.PI*2,r=i%2?82:26;P({name:'Bush',shape:'ball',pos:[r3(Math.cos(a)*r),2.2,r3(Math.sin(a)*r)],size:[6,5,6],color:'#2e7d32',material:'Grass',canCollide:false,transparency:.08});}
  [[-90,0,2,8,120],[90,0,2,8,120],[0,-90,120,8,2],[0,90,120,8,2]].forEach(([x,z,w,h,d])=>P({name:'Hedge',pos:[x,h/2,z],size:[w,h,d],color:'#1b5e20',material:'Grass'}));
  P({name:'Slide',shape:'wedge',pos:[0,3,0],size:[4,6,10],color:'#ff7043',material:'Plastic'});P({name:'Tower',pos:[0,3,-7],size:[6,6,4],color:'#ffca28',material:'Plastic'});
  P({name:'Tube',pos:[0,1.6,-14],size:[3.4,3.2,10],color:'#29b6f6',material:'Plastic',transparency:.35,canCollide:false});
  const JAIL=[0,1,-80];P({name:'Jail',pos:[JAIL[0],.4,JAIL[2]],size:[16,.8,10],color:'#616161',material:'Concrete',label:'FOUND'});
  G.spawnAt(p,0,.5,30,{size:[6,1,6],color:'#ffca28'});
  const SPOTS=[[-37,-55],[9-50,-9-50],[-63,-57],[63,-57],[59,-59],[-6+50,58],[-63,43],[62,59],[59,41],[0,-14],[26,0],[-26,0],[0,26],[0,-26],[-60,-30]];
  // second map: the Toy Warehouse, 400 studs east, with a crate fort at every hiding spot
  const HOX='vhox',HV=[['map x',HOX]];const ox=v=>G.arith('ADD',typeof v==='number'?G.num(v):v,G.vget(HOX));
  {const OX=400,W2=G.folder(p,'Toy Warehouse').id;const Q=o=>G.part(p,W2,o);
    Q({name:'WarehouseFloor',pos:[OX,-1,0],size:[200,2,200],color:'#8d6e63',material:'Concrete'});
    [[0,-95,190,2],[0,95,190,2],[-95,0,2,190],[95,0,2,190]].forEach(([x,z2,w,d])=>Q({name:'Wall',pos:[OX+x,8,z2],size:[w,16,d],color:'#78909c',material:'Metal'}));
    for(let r=0;r<4;r++)Q({name:'Shelf',pos:[OX-70+r*14,4,50],size:[3,8,40],color:'#ffb300',material:'Metal'});
    [[30,40,'#e53935'],[-10,-70,'#1e88e5'],[70,-10,'#43a047']].forEach(([x,z2,c])=>{Q({name:'ToyBlock',pos:[OX+x,4,z2],size:[8,8,8],color:c,material:'Plastic'});Q({name:'ToyBlock',pos:[OX+x+2,10,z2],size:[5,5,5],color:'#fdd835',material:'Plastic'});});
    Q({name:'BallPit',pos:[OX-50,.5,-60],size:[20,1,16],color:'#f06292',material:'Plastic'});for(let i=0;i<14;i++)Q({name:'Ball',shape:'ball',pos:[OX-58+(i%7)*2.6,1.6,-64+Math.floor(i/7)*6],size:[2,2,2],color:['#e53935','#fdd835','#1e88e5','#43a047'][i%4],canCollide:false});
    Q({name:'Jail',pos:[OX+JAIL[0],.4,JAIL[2]],size:[16,.8,10],color:'#616161',material:'Concrete',label:'FOUND'});
    SPOTS.forEach(([x,z2],i)=>{const c=['#a1764b','#8d6e63','#bcaaa4'][i%3];Q({name:'CrateFort',pos:[OX+x,3,z2-2.6],size:[6,6,.6],color:c,material:'Wood'});Q({name:'CrateFort',pos:[OX+x-2.7,3,z2],size:[.6,6,5],color:c,material:'Wood'});
      Q({name:'CrateFort',pos:[OX+x,3,z2+2.6],size:[6,6,.6],color:c,material:'Wood'});Q({name:'CrateFort',pos:[OX+x,6.2,z2],size:[6,.4,6],color:c,material:'Wood'});});}
  {const OX=800,H3=G.folder(p,'Haunted Mansion').id;const Q=o=>G.part(p,H3,o);
    Q({name:'MansionFloor',pos:[OX,-1,0],size:[200,2,200],color:'#3e2723',material:'Wood'});
    [[0,-95,190,2],[0,95,190,2],[-95,0,2,190],[95,0,2,190]].forEach(([x,z2,w,d])=>Q({name:'Wall',pos:[OX+x,9,z2],size:[w,18,d],color:'#4a148c',material:'Brick'}));
    [[-40,0,1,120],[40,0,1,120],[0,-40,60,1],[0,40,60,1]].forEach(([x,z2,w,d])=>Q({name:'InnerWall',pos:[OX+x,5,z2],size:[w,10,d],color:'#6a1b9a',material:'Brick'}));
    [[-60,-60],[60,-60],[-60,60],[60,60],[0,0]].forEach(([x,z2])=>Q({name:'Chandelier',pos:[OX+x,14,z2],size:[4,1,4],color:'#ffd54f',material:'Neon'}));
    [['Piano',20,-20,8,4,5,'#212121'],['Coffin',-20,20,3,2,7,'#4e342e'],['Bookcase',-80,-30,2,9,14,'#5d4037'],['Bookcase',80,30,2,9,14,'#5d4037'],['Couch',-60,60,10,3,4,'#880e4f'],['Table',60,-60,10,3,6,'#4e342e']].forEach(([nm,x,z2,w,h,d,c])=>Q({name:nm,pos:[OX+x,h/2,z2],size:[w,h,d],color:c,material:'Wood'}));
    Q({name:'Jail',pos:[OX+JAIL[0],.4,JAIL[2]],size:[16,.8,10],color:'#616161',material:'Concrete',label:'FOUND'});
    SPOTS.forEach(([x,z2],i)=>{Q({name:'Wardrobe',pos:[OX+x,4,z2-2.6],size:[6,8,.6],color:'#3e2723',material:'Wood'});Q({name:'Wardrobe',pos:[OX+x-2.7,4,z2],size:[.6,8,5],color:'#3e2723',material:'Wood'});
      Q({name:'Wardrobe',pos:[OX+x,4,z2+2.6],size:[6,8,.6],color:'#3e2723',material:'Wood'});Q({name:'Wardrobe',pos:[OX+x,8.2,z2],size:[6,.4,6],color:'#3e2723',material:'Wood'});});}
  G.vars(G.script(p,'sss','Pick map',G.onMsg('round start'),G.vset(HOX,G.arith('MULTIPLY',G.rnd(0,2),G.num(400))),G.iff(G.cmp(G.vget(HOX),'EQ',G.num(800)),blk('g_sky',null,{COLOUR:'#1a0d2e'})),G.iff(G.cmp(G.vget(HOX),'LT',G.num(800)),blk('g_sky',null,{COLOUR:'#a5d6f7'}))),HV);
  const MV=G.matchFlags(p),SK='vseeker',NB='vhbots',HL='vhidersleft',RD='vhsround',CG='vcaught',FB=k=>'vfound'+k;
  const VARS=[...HV,['seeker',SK],['hider bots',NB],['hiders left',HL],['phase',RD],...[1,2,3,4].map(k=>['found '+k,FB(k)]),...MV];
  const eq=(id,v)=>G.cmp(G.vget(id),'EQ',typeof v==='number'?G.num(v):v);
  const amSeeker=()=>eq(SK,G.myId());
  // bot hiders
  const HC=['#e53935','#1e88e5','#fdd835','#8e24aa'];
  for(let k=1;k<=4;k++){const r=rigNode({name:'Hider'+k,pos:[k*6,2.6,200],health:999,respawn:0,walkSpeed:14,colors:{head:'#ffcc80',torso:HC[k-1],arms:'#ffcc80',legs:'#455a64'}});p.nodes.push(r);
    G.vars(G.script(p,r.id,'Found',blk('ev_touch'),G.iff(G.AND(G.AND(amSeeker(),eq(RD,2)),G.AND(eq(FB(k),0),G.cmp(G.num(k),'LTE',G.vget(NB)))),
      G.shSet(FB(k),G.num(1)),G.shChg(HL,-1),G.sadd('Score',10),G.sound('coin'),G.msg('Found a hider!',1.5))),VARS);
    G.vars(G.hscript(p,r.id,'Caught',blk('ev_start'),G.forever(G.until(eq(FB(k),1)),blk('rig_say',{PART:bme(),TEXT:bt('Aww, you found me!'),S:bn(2)}),blk('p_setpos',{PART:bme(),X:ox(JAIL[0]-6+k*2.4),Y:bn(2.6),Z:bn(JAIL[2])}),G.until(eq(FB(k),0)))),VARS);}
  // bot seeker (only when you are alone)
  const sk=rigNode({name:'SeekerBot',pos:[0,2.6,220],scale:1.15,health:9999,respawn:0,walkSpeed:15,throughWalls:true,colors:{head:'#ffcc80',torso:'#212121',arms:'#ffcc80',legs:'#b71c1c'}});p.nodes.push(sk);
  G.vars(G.hscript(p,sk.id,'Seek',blk('ev_start'),G.forever(G.ifElse(G.AND(eq(SK,G.txt('bot')),eq(RD,2)),
    [G.ifElse(G.cmp(G.nearD(bme()),'LT',G.num(22)),[G.walkN(bme()),G.wait(.25)],[G.vset('vbspot',G.rnd(1,SPOTS.length)),...SPOTS.map((s,i)=>G.iff(G.cmp(G.vget('vbspot'),'EQ',G.num(i+1)),blk('rig_walk',{PART:bme(),X:ox(s[0]),Z:bn(s[1])}))),G.wait(G.rnd(1,2))])],[G.wait(.5)]))),[...VARS,['bot spot','vbspot']]);
  G.vars(G.script(p,sk.id,'Tag',blk('ev_touch'),G.iff(G.AND(G.AND(eq(SK,G.txt('bot')),eq(RD,2)),G.AND(G.aliveIn(),G.cmp(G.vget(CG),'EQ',G.num(0)))),
    G.vset(CG,G.num(1)),G.shChg(HL,-1),G.sound('die'),G.msg('The seeker found you!',2.5),blk('pl_tpxyz',{X:ox(JAIL[0]),Y:bn(3),Z:bn(JAIL[2])}))),[...VARS,['caught',CG]]);
  const d2=(a,b)=>G.arith('ADD',G.arith('MULTIPLY',G.arith('MINUS',G.prop(G.pnamed(a),'x'),G.prop(G.pnamed(b),'x')),G.arith('MINUS',G.prop(G.pnamed(a),'x'),G.prop(G.pnamed(b),'x'))),G.arith('MULTIPLY',G.arith('MINUS',G.prop(G.pnamed(a),'z'),G.prop(G.pnamed(b),'z')),G.arith('MINUS',G.prop(G.pnamed(a),'z'),G.prop(G.pnamed(b),'z'))));
  G.vars(G.hscript(p,'sss','Bot finds bots',G.onMsg('seek'),G.whileDo(G.AND(G.inMatch(),eq(RD,2)),
    ...[1,2,3,4].map(k=>G.iff(G.AND(G.AND(eq(SK,G.txt('bot')),eq(FB(k),0)),G.AND(G.cmp(G.num(k),'LTE',G.vget(NB)),G.cmp(d2('SeekerBot','Hider'+k),'LT',G.num(30)))),
      G.vset(FB(k),G.num(1)),G.vchg(HL,-1),blk('rig_say',{PART:G.pnamed('SeekerBot'),TEXT:bt('Found you!'),S:bn(2)}))),G.wait(.4))),VARS);
  // player seeker tags player hiders by touching them
  G.vars(G.script(p,'player','Tag hider',blk('ev_touch_player'),G.iff(G.AND(amSeeker(),eq(RD,2)),
    G.asP({block:{type:'pl_touched'}},G.iff(G.cmp(G.vget(CG),'EQ',G.num(0)),G.vset(CG,G.num(1)),G.shChg(HL,-1),G.sound('die'),G.msg('You were found!',2.5),blk('pl_tpxyz',{X:ox(JAIL[0]),Y:bn(3),Z:bn(JAIL[2])}))),
    G.sadd('Score',10),G.sound('coin'))),[...VARS,['caught',CG]]);
  // host: choose the seeker, place bots, run the phases
  G.vars(G.hscript(p,'sss','Rounds',G.onMsg('round start'),G.vset(RD,G.num(0)),
    G.ifElse(G.cmp(G.players(),'GTE',G.num(2)),[G.vset(SK,G.idOf(G.pref('randplaying')))],[G.vset('vsolo',G.arith('MINUS',G.num(1),G.vget('vsolo'))),
      G.ifElse(G.cmp(G.vget('vsolo'),'EQ',G.num(1)),[G.vset(SK,G.txt('bot'))],[G.vset(SK,G.idOf(G.pref('randplaying')))])]),
    G.ifElse(G.cmp(G.players(),'GTE',G.num(5)),[G.vset(NB,G.num(0))],[G.vset(NB,G.arith('MINUS',G.num(5),G.players()))]),
    G.iff(eq(SK,G.txt('bot')),G.vset(NB,G.num(3))),
    ...[1,2,3,4].map(k=>[G.vset(FB(k),G.num(0)),G.ifElse(G.cmp(G.num(k),'LTE',G.vget(NB)),[blk('p_setpos',{PART:G.pnamed('Hider'+k),X:ox(k*4-10),Y:bn(2.6),Z:bn(30)})],[blk('p_setpos',{PART:G.pnamed('Hider'+k),X:bn(k*6),Y:bn(2.6),Z:bn(200)})])]).flat(),
    G.vset(HL,G.arith('ADD',G.vget(NB),G.arith('MINUS',G.players(),G.num(1)))),G.iff(eq(SK,G.txt('bot')),G.vset(HL,G.arith('ADD',G.vget(NB),G.players()))),
    blk('p_setpos',{PART:G.pnamed('SeekerBot'),X:bn(0),Y:bn(2.6),Z:bn(220)}),
    G.bc('hide'),G.vset(RD,G.num(1)),G.wait(1),
    ...[1,2,3,4].map(k=>G.iff(G.cmp(G.num(k),'LTE',G.vget(NB)),G.vset('vspot',G.rnd(1,SPOTS.length)),...SPOTS.map((s,i)=>G.iff(G.cmp(G.vget('vspot'),'EQ',G.num(i+1)),blk('p_setpos',{PART:G.pnamed('Hider'+k),X:ox(s[0]),Y:bn(2.6),Z:bn(s[1])}))))),
    G.wait(19),G.vset(RD,G.num(2)),G.bc('seek'),
    G.iff(eq(SK,G.txt('bot')),blk('p_setpos',{PART:G.pnamed('SeekerBot'),X:ox(0),Y:bn(2.6),Z:bn(30)})),
    blk('controls_whileUntil',{BOOL:G.OR(G.NOT(G.inMatch()),G.cmp(G.vget(HL),'LTE',G.num(0))),DO:doIn(G.wait(.5))},{MODE:'UNTIL'}),
    G.iff(G.cmp(G.vget(HL),'LTE',G.num(0)),G.bc('all found')),G.vset(RD,G.num(3))),[...VARS,['spot','vspot']]);
  G.vars(G.script(p,'sss','Hide phase',G.onMsg('hide'),G.vset(CG,G.num(0)),
    G.ifElse(amSeeker(),[blk('pl_tpxyz',{X:ox(JAIL[0]),Y:bn(3),Z:bn(JAIL[2])}),blk('pl_freeze',null,{B:'TRUE'}),G.msg('You are the SEEKER! Count to 20 while everyone hides...',5),blk('g_sky',null,{COLOUR:'#000000'})],
      [blk('pl_tpxyz',{X:ox(G.rnd(-6,6)),Y:bn(3),Z:bn(30)}),G.sound('check'),G.ifElse(G.cmp(G.vget('vhox'),'EQ',G.num(800)),[G.msg('HAUNTED MANSION! The seeker is counting to 20. Hide in a wardrobe or behind the coffin...',5)],[G.ifElse(G.cmp(G.vget('vhox'),'GT',G.num(0)),[G.msg('HIDE! The seeker is counting to 20. Squeeze into a crate fort or behind the toy blocks!',5)],[G.msg('HIDE! The seeker is counting to 20. Bushes, closets and the tube are great spots.',5)])])])),[...VARS,['caught',CG]]);
  G.vars(G.script(p,'sss','Seek phase',G.onMsg('seek'),G.ifElse(G.cmp(G.vget('vhox'),'EQ',G.num(800)),[blk('g_sky',null,{COLOUR:'#1a0d2e'})],[blk('g_sky',null,{COLOUR:'#a5d6f7'})]),
    G.ifElse(amSeeker(),[blk('pl_freeze',null,{B:'FALSE'}),blk('pl_tpxyz',{X:ox(0),Y:bn(3),Z:bn(30)}),G.sound('check'),G.msg('Ready or not, here I come! Touch hiders to find them.',3)],[G.msg('The seeker is coming!',2)])),VARS);
  G.vars(G.script(p,'sss','Hiders HUD',G.onMsg('round start'),G.wait(2),G.whileDo(G.inMatch(),G.sset('Hiders left',G.vget(HL)),G.wait(.5))),VARS);
  G.vars(G.script(p,'sss','Survived',G.onMsg('round end'),blk('pl_freeze',null,{B:'FALSE'}),blk('g_sky',null,{COLOUR:'#a5d6f7'}),
    G.iff(G.AND(G.NOT(amSeeker()),G.cmp(G.vget(CG),'EQ',G.num(0))),G.sadd('Score',30),G.sound('win'),G.msg('Nobody found you! +30 points, +10 coins',3),blk('pl_coins',{N:bn(10)}))),[...VARS,['caught',CG]]);
  G.vars(G.script(p,'sss','All found',G.onMsg('all found'),G.iff(amSeeker(),G.sadd('Score',20),G.sound('win'),G.msg('You found everyone! +20',3))),VARS);
  // radar: every 20 seconds of seeking, every hider still hidden shows a speech bubble
  G.vars(G.hscript(p,'sss','Radar',G.onMsg('seek'),G.whileDo(G.AND(G.inMatch(),eq(RD,2)),G.wait(20),G.iff(G.AND(G.inMatch(),eq(RD,2)),G.bc('radar')))),VARS);
  G.vars(G.script(p,'sss','Pinged',G.onMsg('radar'),G.ifElse(amSeeker(),[G.sound('check'),G.msg('📡 RADAR PING! Look for the speech bubbles!',2)],
    [G.iff(G.cmp(G.vget(CG),'EQ',G.num(0)),G.sound('click'),G.msg('📡 The seeker pinged the radar. Your bubble is showing!',2),blk('pl_say',{TEXT:bt('📡 here!'),S:bn(2.5)}))])),[...VARS,['caught',CG]]);
  [1,2,3,4].forEach(k=>G.vars(G.hscript(p,G.pnamed?'sss':'sss','Bot ping '+k,G.onMsg('radar'),G.iff(G.AND(G.cmp(G.num(k),'LTE',G.vget(NB)),eq(FB(k),0)),blk('rig_say',{PART:G.pnamed('Hider'+k),TEXT:bt('📡 here!'),S:bn(2.5)}))),VARS));
  // taunt: risky points for brave hiders
  const tn={id:uid(),cls:'Tool',name:'Taunt',parent:'rs',tooltip:'+5 points, but everyone hears you! (10s recharge)',cooldown:10,swing:false};
  const th=partNode({parent:tn.id,name:'Handle',shape:'ball',pos:[0,3,0],size:[.8,.8,.8],color:'#ff4081',material:'Neon'});tn.handle=th.id;p.nodes.push(tn,th);
  G.vars(G.script(p,tn.id,'Taunt',blk('ev_tool_act'),G.iff(G.AND(eq(RD,2),G.cmp(G.vget(CG),'EQ',G.num(0))),G.sadd('Score',5),G.sound('boost'),blk('pl_say',{TEXT:bt('Nya nya! Can\'t find me!'),S:bn(2.5)}))),[...VARS,['caught',CG]]);
  G.vars(G.script(p,'sss','Give taunt',G.onMsg('hide'),blk('tool_take',null,{NAME:'Taunt'}),G.iff(G.NOT(amSeeker()),blk('tool_give',null,{NAME:'Taunt'}))),VARS);
  G.script(p,'sss','Take taunt',G.onMsg('round end'),blk('tool_take',null,{NAME:'Taunt'}));
  gkPowerups(p,[[-20,50],[20,-50],[70,0],[380,50],[420,-50],[470,0]]);
  // the seeker gets a sprint ability (8 second recharge)
  const spr={id:uid(),cls:'Tool',name:'Sprint',parent:'rs',tooltip:'Seeker sprint: 3 seconds of speed',cooldown:8,swing:false};
  const sph=partNode({parent:spr.id,name:'Handle',shape:'ball',pos:[0,3,0],size:[.8,.8,.8],color:'#ffd600',material:'Neon'});spr.handle=sph.id;p.nodes.push(spr,sph);
  G.script(p,spr.id,'Go',blk('ev_tool_act'),G.sound('boost'),blk('pl_speed',{V:bn(30)}),G.wait(3),blk('pl_speed',{V:bn(16)}));
  G.vars(G.script(p,'sss','Give sprint',G.onMsg('seek'),blk('tool_take',null,{NAME:'Sprint'}),G.iff(amSeeker(),blk('tool_give',null,{NAME:'Sprint'}))),VARS);
  G.script(p,'sss','Take sprint',G.onMsg('round end'),blk('tool_take',null,{NAME:'Sprint'}));
  G.hud(p,'Hiders','#2e7d32',G.join('🙈 Hiders left: ',G.vget(HL),'   ·   ⭐ ',G.stat('Score')));
  G.welcome(p,G.sset('Score',0),G.msg('Hide and Seek: one seeker, everyone else hides. Bots join when players are short, and playing alone you take turns hiding and seeking.',5));
  return G.def(p,'hideseek','Hide and Seek');}

/* 26. Panic Run: chasers chase everyone. Get downed, and a teammate can pick you up */
function evadeDef(){const G=GK;const p=G.proj('evade','Panic Run',{sky:'#4a148c',fog:360,brightness:.85,timer:false,saveStats:false,saveCheckpoint:false,lobby:true,lobbyWait:12,lobbyRound:150,lobbyScore:'Score',lobbyElim:true});
  const bp=p.nodes.find(n=>n.name==='Baseplate');Object.assign(bp,{size:[220,2,220],color:'#424242',material:'Concrete'});
  const C=G.folder(p,'City').id;const P=o=>G.part(p,C,o);let seed=99;const rr=()=>{seed=(seed*16807)%2147483647;return seed/2147483647;};
  [[0,-108,220,2],[0,108,220,2],[-108,0,2,220],[108,0,2,220]].forEach(([x,z,w,d])=>P({name:'Wall',pos:[x,10,z],size:[w,20,d],color:'#311b92',material:'Brick'}));
  const blds=[[-60,-60],[60,-60],[-60,60],[60,60],[0,-70],[0,70],[-70,0],[70,0]];
  blds.forEach(([x,z],i)=>{const h=10+i%3*6;P({name:'Building',pos:[x,h/2,z],size:[18,h,18],color:['#5e35b1','#3949ab','#00897b','#6d4c41'][i%4],material:'Brick'});
    P({name:'Ramp',shape:'wedge',pos:[x,h/2,z+9+h/1.4],size:[6,h,h*1.4],rot:[0,180,0],color:'#9e9e9e',material:'Concrete'});
    P({name:'Roof',pos:[x,h+.3,z],size:[18,.6,18],color:'#ffeb3b',material:'Neon',transparency:.6,canCollide:false});});
  for(let i=0;i<10;i++)P({name:'Car',pos:[r3((rr()-.5)*170),1.5,r3((rr()-.5)*170)],size:[4,3,8],color:['#e53935','#1e88e5','#fdd835','#43a047'][i%4],material:'Metal'});
  [[-30,30],[30,-30],[30,30],[-30,-30],[0,0]].forEach(([x,z])=>P({name:'JumpPad',pos:[x,.3,z],size:[5,.4,5],color:'#00e5ff',material:'Neon',behavior:'bounce',value:120}));
  [[-20,0],[20,0],[0,20],[0,-20]].forEach(([x,z])=>P({name:'SpeedPad',pos:[x,.3,z],size:[5,.4,5],color:'#ffd600',material:'Neon',behavior:'speed',value:1.6}));
  G.spawnAt(p,0,.5,40,{size:[6,1,6],color:'#7c4dff'});
  // cola cans: a short burst of speed
  [[-45,-20],[45,20],[-20,-80],[20,80],[-85,40],[85,-40]].forEach(([x,z])=>{const c=P({name:'Cola',shape:'cylinder',pos:[x,1.2,z],size:[1.2,2,1.2],color:'#d50000',material:'Neon',canCollide:false,label:'🥤'});
    G.script(p,c.id,'Drink',blk('ev_touch'),blk('p_visible',{PART:bme()},{B:'FALSE'}),blk('p_collide',{PART:bme()},{B:'FALSE'}),G.sound('pad'),G.msg('Cola! Super speed for 6 seconds',1.5),blk('pl_speed',{V:bn(27)}),
      G.wait(6),blk('pl_speed',{V:bn(16)}),G.wait(14),blk('p_visible',{PART:bme()},{B:'TRUE'}));});
  // second map: the Yellow Maze, 400 studs east. Endless yellow rooms with low walls to juke around
  const EOX='veox',EV=[['map x',EOX]];const ox=v=>G.arith('ADD',typeof v==='number'?G.num(v):v,G.vget(EOX));
  {const OX=400,B2=G.folder(p,'Yellow Maze').id;const Q=o=>G.part(p,B2,o);let sd=31;const r2=()=>{sd=(sd*16807)%2147483647;return sd/2147483647;};
    Q({name:'Carpet',pos:[OX,-1,0],size:[220,2,220],color:'#c8b560',material:'Fabric'});Q({name:'Ceiling',pos:[OX,14,0],size:[220,1,220],color:'#e6dc9a',material:'Plastic',transparency:.35});
    [[0,-108,220,2],[0,108,220,2],[-108,0,2,220],[108,0,2,220]].forEach(([x,z2,w,d])=>Q({name:'Wall',pos:[OX+x,7,z2],size:[w,14,d],color:'#d4c66a',material:'Plastic'}));
    for(let i=0;i<46;i++){const x=r3((r2()-.5)*190),z2=r3((r2()-.5)*190);if(Math.hypot(x,z2-40)<14)continue;const along=r2()<.5;Q({name:'Wall',pos:[OX+x,5,z2],size:along?[18,10,1.2]:[1.2,10,18],color:'#d4c66a',material:'Plastic'});}
    for(let i=0;i<20;i++)Q({name:'Light',pos:[OX+r3((r2()-.5)*180),13.4,r3((r2()-.5)*180)],size:[4,.3,2],color:'#fffde7',material:'Neon'});
    [[-30,30],[30,-30],[0,0],[-60,-60],[60,60]].forEach(([x,z2])=>Q({name:'JumpPad',pos:[OX+x,.3,z2],size:[5,.4,5],color:'#00e5ff',material:'Neon',behavior:'jump',value:90}));}
  // third map: the Shopping Mall, 800 studs east. Two floors joined by escalator ramps
  {const OX=800,M3=G.folder(p,'Shopping Mall').id;const Q=o=>G.part(p,M3,o);
    Q({name:'MallFloor',pos:[OX,-1,0],size:[220,2,220],color:'#eceff1',material:'Marble'});
    [[0,-108,220,2],[0,108,220,2],[-108,0,2,220],[108,0,2,220]].forEach(([x,z2,w,d])=>Q({name:'Wall',pos:[OX+x,12,z2],size:[w,24,d],color:'#b0bec5',material:'Concrete'}));
    [[-70,0],[70,0]].forEach(([x])=>Q({name:'UpperFloor',pos:[OX+x,12,0],size:[60,1,200],color:'#cfd8dc',material:'Marble'}));
    [[-38,-60,180],[38,60,0],[-38,60,0],[38,-60,180]].forEach(([x,z2,r])=>Q({name:'Escalator',shape:'wedge',pos:[OX+x,6,z2],size:[8,12,24],rot:[0,r,0],color:'#78909c',material:'Metal'}));
    for(let i=0;i<8;i++){const sd=i%2?1:-1;Q({name:'Shop',pos:[OX+sd*95,4,-84+i*24],size:[22,8,18],color:['#ef9a9a','#90caf9','#a5d6a7','#fff59d'][i%4],material:'Plastic',label:['TOYS','PIZZA','SHOES','GAMES','BOOKS','TECH','CANDY','PETS'][i]});}
    Q({name:'Fountain',shape:'cyl',pos:[OX,1,0],size:[16,2,16],color:'#4fc3f7',material:'Glass',transparency:.3});
    [[0,-50],[0,50],[-20,0],[20,0]].forEach(([x,z2])=>Q({name:'Planter',pos:[OX+x,1.5,z2],size:[8,3,4],color:'#558b2f',material:'Grass'}));
    [[0,-80],[0,80]].forEach(([x,z2])=>Q({name:'JumpPad',pos:[OX+x,.3,z2],size:[5,.4,5],color:'#00e5ff',material:'Neon',behavior:'jump',value:100}));}
  G.vars(G.script(p,'sss','Pick map',G.onMsg('round start'),G.vset(EOX,G.arith('MULTIPLY',G.rnd(0,2),G.num(400))),G.ifElse(G.cmp(G.vget(EOX),'EQ',G.num(0)),[blk('g_sky',null,{COLOUR:'#4a148c'})],[G.ifElse(G.cmp(G.vget(EOX),'EQ',G.num(400)),[blk('g_sky',null,{COLOUR:'#bfae5a'}),G.msg('Map: THE YELLOW MAZE',2)],[blk('g_sky',null,{COLOUR:'#90a4ae'}),G.msg('Map: SHOPPING MALL',2)])]),
    blk('pl_tpxyz',{X:ox(G.rnd(-5,5)),Y:bn(3),Z:bn(40)})),EV);
  const MV=G.matchFlags(p),NA='vchasers',DN='vdowned',RV='vrevives';
  const VARS=[['active chasers',NA],...MV,...EV];
  const NBS=[['Grinner','😁','#ffeb3b'],['Screamer','😱','#ff5252'],['Stare','😐','#b0bec5'],['Jester','🤡','#e040fb'],['Ghast','👻','#eeeeee'],['Toothy','😬','#ff9800']];
  NBS.forEach(([nm,face,col],k)=>{const r=rigNode({name:nm,pos:[-80+k*30,4,-90],scale:1.9,health:99999,respawn:0,walkSpeed:15+k*.8,throughWalls:false,colors:{head:col,torso:col,arms:col,legs:col}});p.nodes.push(r);
    G.vars(G.hscript(p,r.id,'Chase',blk('ev_start'),blk('rig_say',{PART:bme(),TEXT:bt(face+face+face),S:bn(99999)}),G.forever(G.ifElse(G.cmp(G.num(k+1),'GT',G.vget(NA)),[blk('p_setpos',{PART:bme(),X:bn(-80+k*30),Y:bn(4),Z:bn(-300)}),G.until(G.cmp(G.num(k+1),'LTE',G.vget(NA))),
        blk('p_setpos',{PART:bme(),X:ox(-80+k*30),Y:bn(4),Z:bn(-90)}),G.sound('die')],
      [G.iff(G.OR(G.cmp(G.prop(bme(),'x'),'GT',ox(150)),G.cmp(G.prop(bme(),'x'),'LT',ox(-150))),blk('p_setpos',{PART:bme(),X:ox(-80+k*30),Y:bn(4),Z:bn(-90)})),
       G.ifElse(G.cmp(G.nearD(bme()),'LT',G.num(70)),[G.walkN(bme()),G.wait(.2)],[blk('rig_walk',{PART:bme(),X:ox(G.rnd(-90,90)),Z:G.rnd(-90,90)}),G.wait(1)])]))),VARS);
    G.vars(G.script(p,r.id,'Down',blk('ev_touch'),G.iff(G.AND(G.aliveIn(),G.cmp(G.vget(DN),'EQ',G.num(0))),G.vset(DN,G.num(1)),G.sound('explode'),blk('pl_knock',{WHO:bme(),P:bn(60)},{RAG:'TRUE'}),G.bc('downed'))),[...VARS,['downed',DN]]);});
  // downed: frozen, calling for help; 20s to be picked up or you are out
  G.vars(G.script(p,'sss','Downed',G.onMsg('downed'),G.iff(G.cmp(G.vget(DN),'EQ',G.num(1)),blk('pl_freeze',null,{B:'TRUE'}),blk('pl_say',{TEXT:bt('HELP! Pick me up!'),S:bn(3)}),G.msg('You are DOWNED! A teammate can pick you up by touching you.',3),
    G.vset('vbleed',G.num(20)),blk('controls_whileUntil',{BOOL:G.OR(G.cmp(G.vget(DN),'EQ',G.num(0)),G.cmp(G.vget('vbleed'),'LTE',G.num(0))),DO:doIn(G.wait(1),G.vchg('vbleed',-1),G.sset('Bleed out',G.vget('vbleed')),blk('pl_say',{TEXT:bt('HELP!'),S:bn(1)}))},{MODE:'UNTIL'}),
    blk('pl_freeze',null,{B:'FALSE'}),G.sset('Bleed out',0),G.iff(G.cmp(G.vget(DN),'EQ',G.num(1)),G.vset(DN,G.num(0)),blk('pl_damage',{N:bn(1000)})))),[...VARS,['downed',DN],['bleed','vbleed']]);
  G.vars(G.script(p,'player','Revive',blk('ev_touch_player'),G.iff(G.AND(G.aliveIn(),G.cmp(G.vget(DN),'EQ',G.num(0))),
    G.asP({block:{type:'pl_touched'}},G.iff(G.cmp(G.vget(DN),'EQ',G.num(1)),G.vset(DN,G.num(0)),blk('pl_heal',{N:bn(100)}),G.sound('check'),G.msg('A teammate picked you up!',2))))),[...VARS,['downed',DN]]);
  G.vars(G.script(p,'sss','Picked',G.onMsg('round start'),G.vset(DN,G.num(0)),G.vset('vsw',G.num(0)),blk('pl_freeze',null,{B:'FALSE'})),[['downed',DN],['second wind','vsw']]);
  // playing alone? once per match you get a SECOND WIND and stand back up by yourself
  G.vars(G.script(p,'sss','Second wind',G.onMsg('downed'),G.iff(G.AND(G.cmp(G.players(),'EQ',G.num(1)),G.cmp(G.vget('vsw'),'EQ',G.num(0))),G.vset('vsw',G.num(1)),G.wait(4),
    G.iff(G.cmp(G.vget(DN),'EQ',G.num(1)),G.vset(DN,G.num(0)),blk('pl_heal',{N:bn(100)}),G.sound('check'),G.msg('💪 SECOND WIND! You got back up. Next time you will need a teammate!',3),blk('pl_shield',{S:bn(3)})))),[['downed',DN],['second wind','vsw']]);
  G.hud(p,'Chasers','#6a1b9a',G.join('😱 Chasers ',G.vget(NA),' / 6   ·   ⏱ ',G.stat('Score'),'s survived'));
  // survival points every second you are up
  G.vars(G.script(p,'sss','Points',G.onMsg('round start'),G.wait(1),G.whileDo(G.aliveIn(),G.iff(G.cmp(G.vget(DN),'EQ',G.num(0)),G.sadd('Score',1)),G.wait(1))),[...VARS,['downed',DN]]);
  G.vars(G.hscript(p,'sss','Waves',G.onMsg('round start'),G.vset(NA,G.num(0)),...NBS.flatMap(([nm],k)=>[blk('p_setpos',{PART:G.pnamed(nm),X:ox(-80+k*30),Y:bn(4),Z:bn(-90)}),blk('rig_walk',{PART:G.pnamed(nm),X:ox(-80+k*30),Z:bn(-90)})]),G.msg('Chasers are coming. Keep moving, use jump pads and pick up downed friends!',4),G.wait(5),
    G.whileDo(G.AND(G.inMatch(),G.cmp(G.vget(NA),'LT',G.num(6))),G.vchg(NA,1),G.msg(G.join('A chaser has appeared! (',G.vget(NA),')'),2),G.wait(20))),VARS);
  G.vars(G.hscript(p,'sss','Clear',G.onMsg('round end'),G.vset(NA,G.num(0))),VARS);
  // the Ghast blinks next to a random runner every 15 seconds; the Screamer gets a burst of speed
  G.vars(G.hscript(p,'sss','Ghast blink',G.onMsg('round start'),G.wait(30),G.whileDo(G.inMatch(),G.wait(15),G.iff(G.cmp(G.vget(NA),'GTE',G.num(5)),
    G.vset('vgt',G.idOf(G.pref('randplaying'))),blk('p_setpos',{PART:G.pnamed('Ghast'),X:G.arith('ADD',G.axOf(G.byId(G.vget('vgt')),'x'),G.rnd(-25,25)),Y:bn(4),Z:G.arith('ADD',G.axOf(G.byId(G.vget('vgt')),'z'),G.rnd(-25,25))}),G.bc('ghast blink')))),VARS);
  G.script(p,'sss','Blink msg',G.onMsg('ghast blink'),G.sound('die'),G.msg('👻 The Ghast blinked somewhere nearby...',2));
  G.vars(G.hscript(p,'sss','Screamer burst',G.onMsg('round start'),G.whileDo(G.inMatch(),G.wait(G.rnd(8,14)),G.iff(G.cmp(G.vget(NA),'GTE',G.num(2)),blk('rig_speed',{PART:G.pnamed('Screamer'),N:bn(24)}),blk('rig_say',{PART:G.pnamed('Screamer'),TEXT:bt('AAAAAAAAA!'),S:bn(2)}),G.wait(2.5),blk('rig_speed',{PART:G.pnamed('Screamer'),N:bn(15.8)})))),VARS);
  gkPowerups(p,[[-45,45],[45,-45],[0,-80],[355,45],[445,-45],[400,-80],[770,30],[830,-30]]);
  G.welcome(p,G.sset('Score',0),G.msg('Panic Run: run from the chasers! Downed players can be picked up by teammates.',5));
  G.best(p,'Score','evade_best');
  return G.def(p,'evade','Panic Run');}

/* 27. Plane Crash: survive turbulence, an engine fire and the crash. Parachute out, or brace in your seat */
function planeCrashDef(){const G=GK;const p=G.proj('planecrash','Plane Crash',{sky:'#90caf9',fog:900,timer:false,saveStats:false,saveCheckpoint:false,deathStyle:'ragdoll',lobby:true,lobbyWait:14,lobbyRound:150,lobbyScore:'Points',lobbyElim:true});
  G.noBase(p);const PY=140,PL=G.folder(p,'Plane').id,IS=G.folder(p,'Island').id,P=o=>G.part(p,PL,o),I=o=>G.part(p,IS,o);
  // the cabin, up in the sky
  P({name:'CabinFloor',pos:[0,PY,0],size:[14,1,70],color:'#78909c',material:'Metal'});
  P({name:'Hull',pos:[-7.5,PY+5,0],size:[1,10,70],color:'#eceff1',material:'Metal'});P({name:'Hull',pos:[7.5,PY+5,-8],size:[1,10,54],color:'#eceff1',material:'Metal'});
  P({name:'Hull',pos:[7.5,PY+5,31],size:[1,10,8],color:'#eceff1',material:'Metal'});
  P({name:'Ceiling',pos:[0,PY+10.5,0],size:[16,1,70],color:'#cfd8dc',material:'Metal'});P({name:'Nose',pos:[0,PY+5,-35.5],size:[16,11,1],color:'#eceff1',material:'Metal'});P({name:'Tail',pos:[0,PY+5,35.5],size:[16,11,1],color:'#eceff1',material:'Metal'});
  const door=P({name:'EmergencyDoor',pos:[7.5,PY+4,23.5],size:[1,8,7],color:'#ff7043',material:'Metal',label:'EXIT'});
  const SEATS=G.model(p,'Seats').id;
  for(let i=0;i<9;i++)for(const sx of [-4.5,4.5]){const z=-26+i*5.2;G.part(p,SEATS,{name:'Seat',pos:[sx,PY+1.2,z],size:[3.2,1.4,2.6],color:'#1565c0',material:'Fabric'});P({name:'SeatBack',pos:[sx,PY+3,z+1.4],size:[3.2,3.6,.5],color:'#0d47a1',material:'Fabric'});}
  for(let i=0;i<6;i++){P({name:'Window',pos:[-7.4,PY+5.5,-24+i*9],size:[1.2,2.2,3],color:'#bbdefb',material:'Glass',transparency:.4});}
  P({name:'Wing',pos:[-24,PY+1,0],size:[32,1,12],color:'#b0bec5',material:'Metal'});P({name:'Wing',pos:[24,PY+1,-6],size:[32,1,12],color:'#b0bec5',material:'Metal'});
  const eng=P({name:'Engine',shape:'cylinder',pos:[-22,PY-1.5,-2],size:[4,8,4],rot:[90,0,0],color:'#546e7a',material:'Metal'});
  const fireE=emitterNode({parent:eng.id,name:'EngineFire',enabled:false},'fire');p.nodes.push(fireE);const smokeE=emitterNode({parent:eng.id,name:'EngineSmoke',enabled:false},'smoke');p.nodes.push(smokeE);
  // parachute packs in the overhead bins: only some rounds have enough for everybody
  const PK=k=>'vpack'+k,NPK=6;
  for(let k=1;k<=NPK;k++){const z=-24+(k-1)*9.5,sx=k%2?-5.6:5.6;P({name:'Bin',pos:[sx,PY+9,z],size:[3,1.8,6],color:'#90a4ae',material:'Metal'});
    const pk=P({name:'Parachute'+k,pos:[sx*.42,PY+5.6,z],size:[2,1.6,2],color:'#ff7043',material:'Fabric',canCollide:false,label:'🪂'});
    G.vars(G.script(p,pk.id,'Grab',blk('ev_touch'),G.iff(G.AND(G.AND(G.aliveIn(),G.cmp(G.vget(PK(k)),'EQ',G.num(0))),G.cmp(G.stat('Parachute'),'EQ',G.num(0))),G.shSet(PK(k),G.num(1)),G.sset('Parachute',1),G.sound('coin'),G.msg('You grabbed a parachute! Jump out when the door opens.',3))),[['pack '+k,PK(k)]]);
    G.vars(G.script(p,pk.id,'Show',blk('ev_start'),G.forever(G.ifElse(G.cmp(G.vget(PK(k)),'EQ',G.num(0)),[blk('p_visible',{PART:bme()},{B:'TRUE'})],[blk('p_visible',{PART:bme()},{B:'FALSE'})]),G.wait(.3))),[['pack '+k,PK(k)]]);}
  P({name:'FireExtinguisher',pos:[-5.5,PY+1.4,-31],size:[1,2.2,1],color:'#d50000',material:'Plastic',label:'🧯'});
  // clouds that rush past the windows
  for(let i=0;i<14;i++){const c=G.part(p,'workspace',{name:'Cloud',shape:'ball',pos:[(i%2?-1:1)*(20+i*4),PY-6+(i%3)*8,-300+i*45],size:[18,7,12],color:'#ffffff',material:'Plastic',canCollide:false,transparency:.15});
    G.script(p,c.id,'Drift',blk('ev_start'),G.forever(blk('p_glide',{PART:bme(),X:bn(0),Y:bn(0),Z:bn(600),S:bn(9)}),blk('p_glide',{PART:bme(),X:bn(0),Y:bn(0),Z:bn(-600),S:bn(0)})));}
  // the island far below, with the crash site, a jungle, a hill and a helipad
  G.part(p,IS,{name:'Ocean',pos:[0,-3,0],size:[900,1,900],color:'#0277bd',material:'Water',transparency:.1,behavior:'kill',label:'🦈'});
  I({name:'Beach',shape:'cylinder',pos:[0,-1,40],size:[200,3,200],color:'#ffe082',material:'Sand'});
  I({name:'Jungle',shape:'cylinder',pos:[0,0,40],size:[160,3,160],color:'#558b2f',material:'Grass'});
  I({name:'Hill',shape:'ball',pos:[40,-8,80],size:[70,40,70],color:'#689f38',material:'Grass'});
  const pad=I({name:'Helipad',pos:[40,12.5,80],size:[16,1,16],color:'#37474f',material:'Concrete',label:'H'});
  let s2=7;const rr=()=>{s2=(s2*16807)%2147483647;return s2/2147483647;};
  for(let i=0;i<28;i++){const a=rr()*Math.PI*2,r=20+rr()*55,x=r3(Math.cos(a)*r),z=r3(40+Math.sin(a)*r);if(Math.hypot(x-40,z-80)<38)continue;
    I({name:'PalmTrunk',pos:[x,6,z],size:[1.4,10,1.4],color:'#795548',material:'Wood'});I({name:'PalmLeaves',shape:'ball',pos:[x,11.5,z],size:[8,2.5,8],color:'#2e7d32',material:'Grass',canCollide:false});}
  const WR=G.model(p,'Wreck').id;
  [[0,3,0,12,6,30,'#cfd8dc'],[-10,2,-14,20,2,8,'#b0bec5'],[8,2.5,18,10,5,12,'#eceff1'],[3,1,-24,6,2,6,'#90a4ae']].forEach(([x,y,z,w,h,d,c],i)=>G.part(p,WR,{name:'WreckPiece',pos:[x-30,y-300,z+10],size:[w,h,d],rot:[0,i*25,i*8],color:c,material:'Metal',canCollide:true}));
  const wf=G.part(p,'workspace',{name:'WreckFire',pos:[-30,-300,10],size:[24,1,30],color:'#ff6d00',material:'Neon',canCollide:false,transparency:.5});p.nodes.push(emitterNode({parent:wf.id,name:'Burning',rate:30,speed:8},'fire'));
  const heli=G.part(p,'workspace',{name:'Helicopter',pos:[40,-300,80],size:[10,5,16],color:'#ffeb3b',material:'Metal',label:'🚁 RESCUE',canCollide:false});
  const ST='vstage',VARS=[['stage',ST],...G.matchFlags(p),...Array.from({length:NPK},(_,k)=>['pack '+(k+1),PK(k+1)])];
  const eq=(id,n)=>G.cmp(G.vget(id),'EQ',G.num(n));
  // host runs the flight, with the same seeded events for everyone
  G.vars(G.hscript(p,'sss','Flight',G.onMsg('round start'),G.vset(ST,G.num(0)),
    ...Array.from({length:NPK},(_,k)=>G.vset(PK(k+1),G.num(0))),
    G.vset('vnpk',G.arith('ADD',G.players(),G.rnd(-1,1))),G.iff(G.cmp(G.vget('vnpk'),'LT',G.num(1)),G.vset('vnpk',G.num(1))),...Array.from({length:NPK},(_,k)=>G.iff(G.cmp(G.num(k+1),'GT',G.vget('vnpk')),G.vset(PK(k+1),G.num(1)))),
    blk('p_collide',{PART:G.pnamed('EmergencyDoor')},{B:'TRUE'}),blk('p_transp',{PART:G.pnamed('EmergencyDoor')},{V:bn(0)}),blk('p_setpos',{PART:G.pnamed('Helicopter'),X:bn(40),Y:bn(-300),Z:bn(80)}),
    blk('p_setpos',{PART:G.pnamed('WreckFire'),X:bn(-30),Y:bn(-300),Z:bn(10)}),
    G.wait(12),G.vset(ST,G.num(1)),G.bc('turbulence'),G.wait(G.rnd(12,18)),G.vset(ST,G.num(2)),G.bc('engine fire'),blk('pe_toggle',{PART:G.pnamed('Engine')},{B:'TRUE'}),
    G.wait(10),G.vset(ST,G.num(3)),G.bc('door open'),blk('p_collide',{PART:G.pnamed('EmergencyDoor')},{B:'FALSE'}),blk('p_transp',{PART:G.pnamed('EmergencyDoor')},{V:bn(1)}),
    G.wait(15),G.vset(ST,G.num(4)),G.bc('crash'),blk('pe_toggle',{PART:G.pnamed('Engine')},{B:'FALSE'}),
    G.iff(G.cmp(G.vget('vsea'),'EQ',G.num(0)),blk('p_setpos',{PART:G.pnamed('WreckFire'),X:bn(-30),Y:bn(2),Z:bn(10)})),
    G.vset('vflare',G.num(0)),G.vset('vwt',G.num(0)),blk('controls_whileUntil',{BOOL:G.OR(G.cmp(G.vget('vwt'),'GTE',G.num(40)),G.cmp(G.vget('vflare'),'EQ',G.num(1))),DO:doIn(G.wait(1),G.vchg('vwt',1))},{MODE:'UNTIL'}),G.vset(ST,G.num(5)),G.bc('rescue'),blk('p_setpos',{PART:G.pnamed('Helicopter'),X:bn(40),Y:bn(80),Z:bn(80)}),blk('p_glide',{PART:G.pnamed('Helicopter'),X:bn(0),Y:bn(-63.5),Z:bn(0),S:bn(5)}),
    G.wait(25),G.bc('heli leaving'),blk('p_glide',{PART:G.pnamed('Helicopter'),X:bn(0),Y:bn(90),Z:bn(-60),S:bn(4)})),[...VARS,['packs','vnpk']]);
  // sometimes the plane ditches in the sea instead: hop across the floating wreckage to the beach
  const WS=G.model(p,'WreckSea').id;[[0,0,0,12,4,26,'#cfd8dc'],[-9,0,-12,16,2,6,'#b0bec5']].forEach(([x,y,z2,w,h,d,c],i)=>G.part(p,WS,{name:'SeaWreck',pos:[x-30,y-300,z2-130],size:[w,h,d],rot:[0,i*30,i*10],color:c,material:'Metal'}));
  for(let i=0;i<6;i++)I({name:'Debris',pos:[-30+((i%2)?3:-3),-1.6,-113+i*8.5],size:[5,1,5],color:['#8d6e63','#b0bec5','#a1887f'][i%3],material:'Wood'});
  G.vars(G.script(p,'sss','Pick weather',G.onMsg('round start'),G.ifElse(G.cmp(G.rnd(1,3),'EQ',G.num(1)),[G.vset('vstorm',G.num(1))],[G.vset('vstorm',G.num(0))])),[['storm','vstorm']]);
  G.vars(G.script(p,'sss','Lightning',G.onMsg('turbulence'),G.iff(G.cmp(G.vget('vstorm'),'EQ',G.num(1)),blk('controls_repeat_ext',{TIMES:bn(8),DO:doIn(G.wait(G.rnd(1,3)),blk('g_sky',null,{COLOUR:'#e1f5fe'}),G.sound('explode'),G.wait(.15),blk('g_sky',null,{COLOUR:'#263238'}))}))),[['storm','vstorm']]);
  G.vars(G.script(p,'sss','Pick crash',G.onMsg('round start'),G.ifElse(G.cmp(G.rnd(1,2),'EQ',G.num(1)),[G.vset('vsea',G.num(0))],[G.vset('vsea',G.num(1))])),[['sea crash','vsea']]);
  G.vars(G.hscript(p,'sss','Wreck appears',G.onMsg('crash'),G.ifElse(G.cmp(G.vget('vsea'),'EQ',G.num(1)),[blk('p_glide',{PART:G.mnamed('WreckSea'),X:bn(0),Y:bn(300),Z:bn(0),S:bn(0)})],
    [blk('p_glide',{PART:G.mnamed('Wreck'),X:bn(0),Y:bn(300),Z:bn(0),S:bn(0)}),G.wait(1),blk('p_break',{X:bn(-30),Y:bn(2),Z:bn(10),R:bn(18),P:bn(60)})])),[...VARS,['sea crash','vsea']]);
  G.vars(G.hscript(p,'sss','Sea wreck resets',G.onMsg('round start'),G.iff(G.cmp(G.prop(G.mnamed('WreckSea'),'y'),'GT',G.num(-100)),blk('p_glide',{PART:G.mnamed('WreckSea'),X:bn(0),Y:bn(-300),Z:bn(0),S:bn(0)}))),VARS);
  G.vars(G.hscript(p,'sss','Wreck resets',G.onMsg('round start'),G.iff(G.cmp(G.prop(G.mnamed('Wreck'),'y'),'GT',G.num(-100)),blk('p_glide',{PART:G.mnamed('Wreck'),X:bn(0),Y:bn(-300),Z:bn(0),S:bn(0)}))),VARS);
  // everyone: phases on your own screen
  G.vars(G.script(p,'sss','Board',G.onMsg('round start'),G.sset('Parachute',0),G.sset('Rescued',0),blk('pl_chute',null,{B:'FALSE'}),G.vset('vjumped',G.num(0)),
    G.tp(0,PY+3,G.rnd(-20,20)),G.sound('check'),blk('g_sky',null,{COLOUR:'#90caf9'}),G.msg('Welcome aboard Flight 404! Find a seat... and check the overhead bins.',5)),[...VARS,['jumped','vjumped']]);
  G.vars(G.script(p,'sss','Turbulence',G.onMsg('turbulence'),G.msg('⚠ TURBULENCE! Sit in a seat to hold on!',3),G.sound('die'),blk('g_shake',null,{POW:'.7'}),G.wait(.5),blk('g_shake',null,{POW:'.7'}),G.wait(.5),blk('g_shake',null,{POW:'.7'}),G.iff(G.cmp(G.vget('vstorm'),'EQ',G.num(1)),blk('g_sky',null,{COLOUR:'#263238'}),G.msg('⛈ We are flying into a STORM!',2)),
    blk('controls_repeat_ext',{TIMES:bn(10),DO:doIn(G.wait(G.rnd(1,2)),G.iff(G.AND(G.aliveIn(),G.NOT({block:{type:'s_touching',inputs:{PART:G.mnamed('Seats')}}})),
      G.iff(G.cmp(G.ppos('y'),'GT',G.num(PY-5)),blk('pl_launch',{P:bn(30)}),blk('pl_damage',{N:bn(6)}))))})),VARS);
  G.vars(G.script(p,'sss','Fire',G.onMsg('engine fire'),blk('g_sky',null,{COLOUR:'#ff8a65'}),G.sound('explode'),G.msg('🔥 The left engine is on FIRE! We are going down!',4)),VARS);
  G.vars(G.script(p,'sss','Door',G.onMsg('door open'),G.sound('explode'),G.msg('The emergency door blew open! Jump with a parachute, or stay seated and BRACE!',5)),VARS);
  // jumping out and landing
  G.vars(G.script(p,'sss','Skydive',G.onMsg('door open'),G.whileDo(G.AND(G.aliveIn(),G.cmp(G.vget(ST),'LT',G.num(5))),
    G.iff(G.AND(G.cmp(G.ppos('y'),'LT',G.num(PY-8)),G.cmp(G.vget('vjumped'),'EQ',G.num(0))),G.vset('vjumped',G.num(1)),
      G.ifElse(G.cmp(G.stat('Parachute'),'EQ',G.num(1)),[G.msg('Parachute OPEN! Steer towards the island.',3),blk('pl_chute',null,{B:'TRUE'})],[G.msg('No parachute... aim for the trees!',3)])),G.wait(.2))),[...VARS,['jumped','vjumped']]);
  G.vars(G.script(p,'sss','Landing',blk('ev_land'),G.iff(G.AND(G.aliveIn(),G.cmp(G.vget('vjumped'),'EQ',G.num(1))),G.vset('vjumped',G.num(2)),
    G.ifElse(G.cmp({block:{type:'s_land_speed'}},'GT',G.num(60)),[G.sound('explode'),G.msg('SPLAT! You hit the ground way too fast.',3),blk('pl_damage',{N:bn(1000)})],
      [G.sadd('Points',20),G.sound('win'),G.msg('Safe landing! +20. Now get to the helipad on the hill!',4)]))),[...VARS,['jumped','vjumped']]);
  G.vars(G.script(p,'sss','Crash',G.onMsg('crash'),blk('g_sky',null,{COLOUR:'#90caf9'}),G.iff(G.AND(G.aliveIn(),G.cmp(G.vget('vjumped'),'EQ',G.num(0))),G.sound('explode'),blk('g_shake',null,{POW:'1.1'}),
    G.ifElse({block:{type:'s_touching',inputs:{PART:G.mnamed('Seats')}}},[G.ifElse(G.cmp(G.vget('vsea'),'EQ',G.num(1)),[G.msg('SPLASHDOWN! You survived in your seat! +15. Hop across the wreckage to the beach. Sharks!',5),G.tp(-30,3,-130)],[G.msg('BRACE! The plane slams into the island... you survived in your seat! +15',4),G.tp(-30,6,G.rnd(0,20))]),blk('pl_damage',{N:G.rnd(30,70)}),G.sadd('Points',15)],
      [G.iff(G.cmp(G.rnd(1,3),'EQ',G.num(1)),G.msg('You were thrown around the cabin... but somehow survived!',4),G.ifElse(G.cmp(G.vget('vsea'),'EQ',G.num(1)),[G.tp(-30,3,-130)],[G.tp(-30,6,G.rnd(0,20))]),blk('pl_damage',{N:bn(85)})),
       G.iff(G.cmp({block:{type:'s_health'}},'GT',G.num(99)),G.msg('You were not wearing a seatbelt...',3),blk('pl_damage',{N:bn(1000)}))]),G.vset('vjumped',G.num(2)))),[...VARS,['jumped','vjumped']]);
  G.vars(G.script(p,'sss','Rescue',G.onMsg('rescue'),G.iff(G.aliveIn(),G.sound('check'),G.msg('🚁 A rescue helicopter is landing on the hill! Get there in 25 seconds!',5))),VARS);
  G.vars(G.script(p,heli.id,'Board',blk('ev_touch'),G.iff(G.AND(G.aliveIn(),G.AND(G.cmp(G.stat('Rescued'),'EQ',G.num(0)),eq(ST,5))),G.sset('Rescued',1),G.sadd('Points',50),G.sound('win'),G.msg('RESCUED! +50 points, +15 coins. You survived the plane crash!',5),blk('pl_coins',{N:bn(15)}),G.tp(0,PY+3,0))),VARS);
  G.vars(G.script(p,'sss','Left behind',G.onMsg('heli leaving'),G.iff(G.AND(G.aliveIn(),G.cmp(G.stat('Rescued'),'EQ',G.num(0))),G.msg('The helicopter left without you... at least you are alive. +5',4),G.sadd('Points',5))),VARS);
  G.vars(G.script(p,'sss','Hot wreck',blk('ev_start'),G.forever(G.iff(G.AND(G.aliveIn(),G.cmp({block:{type:'s_distance',inputs:{PART:G.pnamed('WreckFire')}}},'LT',G.num(9))),blk('pl_damage',{N:bn(8)}),G.msg('Too hot! Move away from the fire.',1)),G.wait(.5))),VARS);
  // other passengers panic with you
  const PCOL=['#ef5350','#ab47bc','#26a69a','#ffa726','#8d6e63','#42a5f5'],LINES={turbulence:['Whoa!','Hold on!','I want my mom!','This is fine...','Seatbelts!','Eek!'],'engine fire':['FIRE!!','We are going down!','Is that normal?!','Mayday!','Not again...','AAAH!'],'door open':['JUMP!','Grab a parachute!','I am staying put!','Brace!','Go go go!','Bye!']};
  for(let k=0;k<6;k++){const sx=k%2?4.5:-4.5,z=-26+(k+2)*5.2;const r=rigNode({name:'Passenger'+(k+1),showName:false,pos:[sx,PY+3.2,z],scale:.9,health:999,respawn:0,walkSpeed:0,colors:{head:'#ffcc80',torso:PCOL[k],arms:'#ffcc80',legs:'#37474f'}});p.nodes.push(r);
    Object.entries(LINES).forEach(([ev,ls])=>G.hscript(p,r.id,'Panic '+ev,G.onMsg(ev),G.wait(k*.4),blk('rig_say',{PART:bme(),TEXT:bt(ls[k]),S:bn(2.5)})));
    G.hscript(p,r.id,'Gone',G.onMsg('crash'),blk('p_visible',{PART:bme()},{B:'FALSE'}));G.hscript(p,r.id,'Back',G.onMsg('round start'),blk('p_visible',{PART:bme()},{B:'TRUE'}));}
  // supply crates on the island: food heals, and a flare brings the helicopter sooner
  [[-50,20,'FOOD'],[30,0,'FOOD'],[-10,70,'FLARE']].forEach(([x,z,kind],i)=>{const c=I({name:'Crate'+i,pos:[x,2.2,z],size:[3,3,3],color:kind==='FLARE'?'#d50000':'#8d6e63',material:'Wood',label:kind==='FLARE'?'🧨 FLARE':'🍖 FOOD'});
    G.vars(G.script(p,c.id,'Open',blk('ev_touch'),G.iff(G.AND(G.aliveIn(),G.cmp(G.vget(ST),'GTE',G.num(4))),
      ...(kind==='FLARE'?[G.iff(G.cmp(G.vget('vflare'),'EQ',G.num(0)),G.shSet('vflare',G.num(1)),G.sadd('Points',10),G.sound('explode'),G.msg('You fired the FLARE! The helicopter is coming now! +10',3))]
        :[blk('pl_heal',{N:bn(50)}),G.sound('coin'),G.msg('Food! +50 health',2),blk('p_visible',{PART:bme()},{B:'FALSE'}),G.wait(30),blk('p_visible',{PART:bme()},{B:'TRUE'})]))),[...VARS,['flare','vflare']]);});
  G.welcome(p,G.sset('Points',0),G.msg('Plane Crash: grab a parachute, stay in your seat during turbulence, and survive the crash!',5));
  G.best(p,'Points','plane_best');
  G.hud(p,'Altitude','#0277bd',G.join('✈ Altitude ',G.round(G.ppos('y')),' studs   ·   ⭐ ',G.stat('Points'),' points'));
  return G.def(p,'planecrash','Plane Crash');}

const GAMES=[
  {id:'arena',name:'Brick Battle',tag:'Battle · 3 maps',desc:'Two-minute matches in a walled arena with swords, blasters and jump pads. Most knockouts wins.',mode:'project',make:arenaDef},
  {id:'tower',name:'Lava Tower',tag:'Obby · 8 stages',desc:'Climb a spiral of moving, fading and lava-striped platforms around a giant pillar. Spinners guard the middle.',
    build:buildTower,mode:'race',stageWord:'Stage',scene:{sky:0x2a1b3d,fogNear:120,fogFar:520,ground:0x5a2a1a},seed:7,objective:'Reach the golden top'},
  {id:'coins',name:'Coin Rush',tag:'Collect · 3:10',desc:'Hop between six islands, ride the ferry, launch off the jump pad and climb the volcano to grab every coin before the clock runs out.',
    build:buildCoins,mode:'coins',limit:190,scene:{sky:0x9fd8ff,fogNear:180,fogFar:620},seed:21,objective:'Collect every coin'},
  {id:'sky',name:'Skyline Sprint',tag:'Race · 4 checkpoints',desc:'A speedrun course above the clouds. Hit speed pads to clear big gaps, dodge spinners, beat your best time.',
    build:buildSky,mode:'race',stageWord:'Checkpoint',scene:{sky:0x7fb8ff,fogNear:150,fogFar:560,ground:0x9fb4d6},seed:3,objective:'Cross the finish line'},
  {id:'sandbox',name:'Free Build',tag:'Sandbox · build challenges',desc:'Place, paint and delete bricks, stamp ready-made builds, and add jump pads, lava and checkpoints to make your own obby. Saved in this browser.',
    build:buildSandbox,mode:'build',scene:{sky:0xa7d8ff,fogNear:220,fogFar:800},seed:1,objective:'Tap or click to build'},
  {id:'towerhell',cat:'Obby',name:'Tower of Chaos',tag:'Obby · 14 random sections',desc:'A new random tower every round, the same for everyone. No checkpoints! Climb the highest before time runs out.',mode:'project',make:towerHellDef},
  {id:'murder',cat:'Party',name:'Whodunit',tag:'Party · 3 maps',desc:'One murderer with a knife, one sheriff with a gun, everyone else innocent. Bots fill the empty spots.',mode:'project',make:murderDef},
  {id:'doors',cat:'Survival',name:'Haunted Hotel',tag:'Horror · 40 doors',desc:'Get through 40 rooms of a creepy hotel. Find keys for locked doors, and hide in a wardrobe when the lights flicker.',mode:'project',make:doorsDef},
  {id:'arsenal',cat:'Battle',name:'Weapon Ladder',tag:'Battle · 3 maps',desc:'Every knockout swaps you to the next weapon. Score a knockout with the Golden Knife to win the match.',mode:'project',make:arsenalDef},
  {id:'deathrun',cat:'Obby',name:'Trap Run',tag:'Obby · 3 courses',desc:'Runners race a trap course while Death springs spikes, lava, sweepers and a boulder from the control room.',mode:'project',make:deathrunDef},
  {id:'hideseek',cat:'Party',name:'Hide and Seek',tag:'Party · 3 maps',desc:'One seeker counts to 20 while everyone hides in bushes, closets and the playground tube. Bots join when players are short.',mode:'project',make:hideSeekDef},
  {id:'evade',cat:'Survival',name:'Panic Run',tag:'Survival · 3 maps',desc:'Shadow chasers hunt everyone across the city. Get downed and a teammate can pick you up. A new chaser joins every 20 seconds.',mode:'project',make:evadeDef},
  {id:'planecrash',cat:'Survival',name:'Plane Crash',tag:'Survival · lobby matches',desc:'Turbulence, an engine fire and a crash landing on an island. Grab a parachute and jump, or brace in your seat, then reach the rescue helicopter.',mode:'project',make:planeCrashDef},
  {id:'disasters',cat:'Survival',name:'Disaster Zone',tag:'Survival · 7 maps, 10 disasters',desc:'Everyone in the game gets the same map and disaster. Buildings smash apart in floods, tsunamis, meteors, tornadoes, volcanoes, earthquakes and lightning.',mode:'project',make:disastersDef},
  {id:'bombtag',cat:'Party',name:'Bomb Tag',tag:'Party · 3 maps',desc:'Hot potato with a ticking bomb. Tag a bot to pass it on, then run! Survive the most bomb rounds to win the match.',mode:'project',make:bombTagDef},
  {id:'flagraid',cat:'Battle',name:'Flag Raid',tag:'Battle · 3 maps',desc:'Sneak past the red guards, steal their flag and race it home. Most captures in 3 minutes wins, and every capture adds a guard.',mode:'project',make:flagRaidDef},
  {id:'ghost',cat:'Survival',name:'Escape the Ghost',tag:'Horror · endless nights',desc:'Find 5 glowing keys in a dark hedge maze and reach the gate before the ghost catches you. Each night adds a ghost.',mode:'project',make:ghostDef},
  {id:'megaobby',cat:'Obby',name:'Mega Obby',tag:'Obby · 50 stages',desc:'Thirty stages that get harder as you climb: lava beams, spinners, movers, vanishing tiles and more. Checkpoints are saved.',mode:'project',make:megaObbyDef},
  {id:'lavarise',cat:'Survival',name:'Lava Rising',tag:'Survival · 3 towers',desc:'Race up the spiral tower, the scaffold and the crystal spire before the lava reaches you. The lava gets faster every round.',mode:'project',make:lavaRiseDef},
  {id:'zombies',cat:'Battle',name:'Zombie Survival',tag:'Survival · 2 maps, endless waves',desc:'Hold off bigger and bigger waves of zombies, fast runners and huge brutes in a fenced town with a sword, a blaster and potions.',mode:'project',make:zombiesDef},
  {id:'rainbow',cat:'Obby',name:'Rainbow Obby',tag:'Obby · 15 stages',desc:'Ten colorful stages: lava beams, jump pads, moving and vanishing platforms, a spinner and a sky elevator.',mode:'project',make:rainbowDef},
  {id:'gems',cat:'Collect',name:'Gem Hunt',tag:'Collect · 3 maps',desc:'Most gems in 90 seconds wins, on a hilly island with jump pads. The super crystal is worth 5.',mode:'project',make:gemsDef},
  {id:'turbo',cat:'Race',name:'Turbo Track',tag:'Race · 3 tracks',desc:'Most laps in 2:30 wins on a sky racetrack with boost pads, a launcher and spinning sweepers. Beat your best lap too.',mode:'project',make:turboDef},
  {id:'sumo',cat:'Battle',name:'Sumo Smash',tag:'Party · 3 arenas',desc:'Last one on the ring wins! More and more sumos try to shove everyone off. Bonk them, and other players, with your bat.',mode:'project',make:sumoDef},
  {id:'colordrop',cat:'Party',name:'Color Drop',tag:'Party · 3 arenas',desc:'A color is called and every other tile vanishes. Everyone gets the same colors, rounds speed up, and the last one standing wins.',mode:'project',make:colorDropDef},
  {id:'maze',cat:'Puzzle',name:'Maze Escape',tag:'Puzzle · 2 mazes',desc:'Escape the maze, and the exit moves to another corner. How many escapes, and how fast?',mode:'project',make:mazeDef},
  {id:'targets',cat:'Battle',name:'Target Range',tag:'Aim · lobby matches',desc:'Most hits in 60 seconds wins. Moving targets, a fast golden target worth 3, and your record is saved.',mode:'project',make:targetsDef},
  {id:'cloudhop',cat:'Obby',name:'Cloud Hop',tag:'Obby · double jump',desc:'Double jump between clouds high in the sky. Grab the purple orb for a triple jump.',mode:'project',make:cloudHopDef},
  {id:'freezetag',cat:'Party',name:'Freeze Tag',tag:'Party · 3 maps',desc:'Most freezes wins! Runners flee from you; freeze them all before the level timer runs out to add a faster runner.',mode:'project',make:freezeTagDef},
  {id:'boss',cat:'Battle',name:'Boss Battle',tag:'Co-op · 4 bosses',desc:'Beat the giant Brick King again and again. Each level brings more minions.',mode:'project',make:bossDef}
];
GAMES.forEach(g=>{if(!g.cat)g.cat={arena:'Battle',tower:'Obby',coins:'Collect',sky:'Race',sandbox:'Build'}[g.id]||'Other';});
let GAME_CAT=store.get('gameCat','All');

/* ---------- rbxlx import ---------- */
const BRICK={1:0xf2f3f3,5:0xd7c59a,21:0xc4281c,23:0x0d69ac,24:0xf5cd30,26:0x1b2a35,28:0x287f47,37:0x4b974b,106:0xda8541,192:0x694028,194:0xa3a2a5,199:0x635f62,1001:0xf8f8f8,1003:0x111111,1004:0xff0000,1010:0x0000ff};
const MAT_ENUM={256:'Plastic',272:'Plastic',288:'Neon',512:'Wood',528:'Wood',848:'Brick',1280:'Grass',1088:'Metal',1040:'Metal',1056:'Metal',1568:'Glass'};
const MAT_OUT={Plastic:256,Studs:256,Neon:288,Wood:512,Brick:848,Grass:1280,Metal:1088,Glass:1568};
const PARTCLS=new Set(['Part','SpawnLocation','WedgePart','CornerWedgePart','TrussPart','MeshPart','Seat','VehicleSeat','UnionOperation']);
function parseRbxlx(text){
  if(/^<roblox!/.test(text.slice(0,16)))throw new Error('This is a binary .rbxl file. In Studio, use File → Save to File As and pick the .rbxlx (XML) type.');
  const doc=new DOMParser().parseFromString(text,'application/xml');
  if(doc.getElementsByTagName('parsererror').length||!doc.getElementsByTagName('roblox').length)throw new Error("This file isn't a readable .rbxlx place file.");
  const items=doc.getElementsByTagName('Item');const parts=[];let spawn=null,scripts=0;
  for(const it of items){
    const cls=it.getAttribute('class');
    if(cls==='Script'||cls==='LocalScript'||cls==='ModuleScript'){scripts++;continue;}
    if(!PARTCLS.has(cls))continue;
    let props=null;for(const c of it.children)if(c.tagName==='Properties'){props=c;break;}if(!props)continue;
    const get=(tag,name)=>{name=name.toLowerCase();for(const el of props.children)if(el.tagName===tag&&(el.getAttribute('name')||'').toLowerCase()===name)return el;return null;};
    const num=(el,tg)=>{const n=el.getElementsByTagName(tg)[0];return n?parseFloat(n.textContent):0;};
    const cf=get('CoordinateFrame','CFrame');if(!cf)continue;
    const pos=[num(cf,'X'),num(cf,'Y'),num(cf,'Z')];
    const R=['R00','R01','R02','R10','R11','R12','R20','R21','R22'].map(k=>num(cf,k));
    const sz=get('Vector3','size')||get('Vector3','Size');
    let size=sz?[num(sz,'X'),num(sz,'Y'),num(sz,'Z')]:[4,1,2];
    let color=0xa3a2a5;const c3=get('Color3uint8','Color3uint8');
    if(c3)color=(parseInt(c3.textContent,10)>>>0)&0xffffff;else{const bc=get('int','BrickColor');if(bc&&BRICK[+bc.textContent]!=null)color=BRICK[+bc.textContent];}
    const tr=parseFloat((get('float','Transparency')||{}).textContent||'0')||0;
    if(tr>=.98)continue;
    const cc=get('bool','CanCollide');const collide=!cc||cc.textContent.trim()!=='false';
    const an=get('bool','Anchored');const anchored=!an||an.textContent.trim()!=='false';
    const name=((get('string','Name')||{}).textContent||cls).trim();
    const sh=get('token','shape');let shape='block';
    if(cls==='Part'&&sh){const v=+sh.textContent;if(v===0)shape='ball';else if(v===2)shape='cyl';}
    if(cls==='WedgePart')shape='wedge';
    if(shape==='ball'){const d=Math.min(size[0],size[1],size[2]);size=[d,d,d];}
    const mt=get('token','Material');const material=mt&&MAT_ENUM[+mt.textContent]||'Plastic';
    const kind=/kill|lava|deadly|death/i.test(name)?'kill':cls==='SpawnLocation'?'spawn':'solid';
    const ident=Math.abs(R[0]-1)<1e-4&&Math.abs(R[4]-1)<1e-4&&Math.abs(R[8]-1)<1e-4;
    const p={pos,size,color,transparency:tr,collide,anchored,shape,kind,material,name,R:ident?null:R};
    parts.push(p);if(kind==='spawn'&&!spawn)spawn=p;
  }
  if(!parts.length)throw new Error('No parts were found in this file. Make sure the place has parts in Workspace.');
  return {parts,spawn,scripts};
}
const _m4=new THREE.Matrix4(),_eu=new THREE.Euler();
function rotFromR(R){if(!R)return [0,0,0];_m4.set(R[0],R[1],R[2],0,R[3],R[4],R[5],0,R[6],R[7],R[8],0,0,0,0,1);_eu.setFromRotationMatrix(_m4,'YXZ');
  return [r3(_eu.x/D2R),r3(_eu.y/D2R),r3(_eu.z/D2R)];}
function sampleRbxlx(){
  const L=[];let ref=1;
  const add=(name,cls,x,y,z,sx,sy,sz,rgb,o)=>L.push(Object.assign({name,cls,x,y,z,sx,sy,sz,rgb},o||{}));
  add('Baseplate','Part',0,-5,0,240,10,240,[99,95,98]);
  add('SpawnLocation','SpawnLocation',0,.5,0,12,1,12,[163,162,165]);
  for(let i=0;i<8;i++)add('Step','Part',16+i*5,1+i*1.5,-10,5,2+i*3,5,[13+i*28,105+i*10,172]);
  add('Platform','Part',60,13,-10,10,1,10,[245,205,48]);
  for(let i=0;i<6;i++)add('Pillar','Part',60,13,-24-i*8,3,26,3,[110,153,202],{shape:2,ry:Math.PI/2});
  add('KillBrick','Part',60,.6,-40,40,1,60,[255,40,40],{mat:288});
  add('GlassBridge','Part',30,13,-62,6,1,30,[160,220,255],{tr:.55});
  add('Tower','Part',-30,20,-30,14,40,14,[105,64,40]);
  add('TowerTop','Part',-30,40.5,-30,18,1,18,[75,151,75]);
  for(let i=0;i<10;i++){const a=i*.55;add('Stair','Part',-30+Math.cos(a)*14,2+i*3.8,-30+Math.sin(a)*14,6,1,6,[218,133,65],{ry:-a});}
  for(let i=0;i<5;i++)add('Ball','Part',-40+i*9,3,20,6,6,6,[200,60+i*35,120],{shape:0});
  add('Ramp','WedgePart',20,3,25,8,6,14,[120,180,90],{ry:Math.PI});
  add('Wall','Part',30,6,40,40,12,2,[248,248,248],{ry:Math.PI/6});
  add('LavaPit','Part',-20,.3,30,16,1,10,[255,90,20],{mat:288});
  const f=n=>(+n).toFixed(3);
  const items=L.map(p=>{const c=Math.cos(p.ry||0),s=Math.sin(p.ry||0);const col=(0xff000000|(p.rgb[0]<<16)|(p.rgb[1]<<8)|p.rgb[2])>>>0;
    return `<Item class="${p.cls}" referent="RBX${ref++}"><Properties><string name="Name">${p.name}</string><bool name="Anchored">true</bool>`+
    `<CoordinateFrame name="CFrame"><X>${f(p.x)}</X><Y>${f(p.y)}</Y><Z>${f(p.z)}</Z><R00>${f(c)}</R00><R01>0</R01><R02>${f(s)}</R02><R10>0</R10><R11>1</R11><R12>0</R12><R20>${f(-s)}</R20><R21>0</R21><R22>${f(c)}</R22></CoordinateFrame>`+
    `<Color3uint8 name="Color3uint8">${col}</Color3uint8><Vector3 name="size"><X>${p.sx}</X><Y>${p.sy}</Y><Z>${p.sz}</Z></Vector3>`+
    `<token name="shape">${p.shape!=null?p.shape:1}</token><float name="Transparency">${p.tr||0}</float>${p.mat?`<token name="Material">${p.mat}</token>`:''}</Properties></Item>`;}).join('');
  return `<roblox version="4"><Item class="Workspace" referent="RBX0"><Properties><string name="Name">Workspace</string></Properties>${items}</Item></roblox>`;
}
function importToNodes(data){
  const folder=groupNode('Folder',{name:'Imported'});const nodes=[folder];
  data.parts.slice(0,6000).forEach(p=>nodes.push(partNode({parent:folder.id,name:p.name,shape:p.shape,pos:p.pos.map(r3),size:p.size.map(r3),rot:rotFromR(p.R),
    color:toHex(p.color),material:p.material,transparency:p.transparency,canCollide:p.collide,anchored:true,behavior:p.kind==='kill'?'kill':p.kind==='spawn'?'spawn':'none'})));
  return nodes;
}
function readFileThen(f,cb){
  const err=$('#importErr');err.hidden=true;
  if(/\.rbxl$/i.test(f.name)){err.textContent='That is a binary .rbxl file. In Studio, use File → Save to File As and choose the .rbxlx (XML) type.';err.hidden=false;return;}
  f.text().then(text=>{let data;try{data=parseRbxlx(text);}catch(e){err.textContent=e.message;err.hidden=false;return;}cb(data,f.name.replace(/\.rbxlx?$/i,''));});
}
function playImported(data,name){
  const proj=newProjectObj('baseplate',name);proj.nodes=proj.nodes.filter(n=>n.cls!=='Part');proj.nodes.push(...importToNodes(data));
  startGame(projectDef(proj,false));
  if(data.scripts)logOut(data.scripts+' Lua scripts were skipped.','warn');
}
function editImported(data,name){
  const proj=newProjectObj('baseplate',name);proj.nodes=proj.nodes.filter(n=>n.cls!=='Part'||n.behavior!=='spawn');
  if(data.parts.some(p=>p.name==='Baseplate'))proj.nodes=proj.nodes.filter(n=>n.name!=='Baseplate');
  proj.nodes.push(...importToNodes(data));saveProject(proj);openStudio(proj);
  logOut('Imported '+Math.min(6000,data.parts.length)+' parts from '+name+'.','sys');
  if(data.scripts)logOut(data.scripts+' Lua scripts were skipped. Rebuild their logic with block scripts.','warn');
}
$('#file').addEventListener('change',e=>{const f=e.target.files[0];if(f)readFileThen(f,playImported);e.target.value='';});
$('#file2').addEventListener('change',e=>{const f=e.target.files[0];if(f)readFileThen(f,(d,n)=>requireAccount(()=>editImported(d,n)));e.target.value='';});
$('#sample').addEventListener('click',()=>playImported(parseRbxlx(sampleRbxlx()),'Sample Plaza'));
const drop=$('#drop');
['dragenter','dragover'].forEach(evn=>drop.addEventListener(evn,e=>{e.preventDefault();drop.classList.add('over');}));
['dragleave','drop'].forEach(evn=>drop.addEventListener(evn,e=>{e.preventDefault();drop.classList.remove('over');}));
drop.addEventListener('drop',e=>{const f=e.dataTransfer.files[0];if(f)readFileThen(f,playImported);});

/* ---------- projects ---------- */
function defaultSettings(){return {gravity:196.2,walkSpeed:16,jumpPower:50,sky:'#9fd8ff',fog:900,brightness:1,timer:true,saveStats:true,saveCheckpoint:true,saveEnabled:true,deathStyle:'ragdoll'};}
function partNode(o){return Object.assign({id:uid(),cls:'Part',name:'Part',parent:'workspace',shape:'block',pos:[0,.5,0],size:[4,1,2],rot:[0,0,0],color:'#a3a2a5',material:'Plastic',
  transparency:0,anchored:true,canCollide:true,locked:false,behavior:'none',value:0},o);}
function scriptNode(o){return Object.assign({id:uid(),cls:'Script',name:'Script',parent:'sss',enabled:true,blocks:null},o);}
function groupNode(cls,o){return Object.assign({id:uid(),cls,name:cls,parent:'workspace'},o);}
// block JSON helpers for prefab scripts
const bn=v=>({shadow:{type:'math_number',fields:{NUM:v}}});
const bt=s=>({shadow:{type:'text',fields:{TEXT:s}}});
const bme=()=>({shadow:{type:'p_this'}});
const bmodel=()=>({block:{type:'p_model'},shadow:{type:'p_this'}});
function hitBranch(dmg,extraDo){const hp=()=>({block:{type:'tool_hitpart'},shadow:{type:'p_this'}});
  const doRig=extraDo?{block:chain(blk('rig_damage',{PART:hp(),N:bn(dmg)}),JSON.parse(JSON.stringify(extraDo.block)))}:doIn(blk('rig_damage',{PART:hp(),N:bn(dmg)}));
  const doPl=extraDo?{block:chain(blk('pl_damage_other',{PART:hp(),N:bn(dmg)}),JSON.parse(JSON.stringify(extraDo.block)))}:doIn(blk('pl_damage_other',{PART:hp(),N:bn(dmg)}));
  return blk('controls_if',{IF0:{block:blk('s_isrig',{PART:hp()})},DO0:doRig,IF1:{block:blk('s_isplayer',{PART:hp()})},DO1:doPl},null,{extraState:{elseIfCount:1}});}
const bnamed=s=>({block:{type:'p_named',fields:{NAME:s}},shadow:{type:'p_this'}});
const blk=(type,inputs,fields,extra)=>Object.assign({type},inputs?{inputs}:{},fields?{fields}:{},extra||{});
function chain(...arr){for(let i=arr.length-1;i>0;i--)arr[i-1].next={block:arr[i]};return arr[0];}
const doIn=(...arr)=>({block:chain(...arr)});
function scriptOf(...tops){return {blocks:{languageVersion:0,blocks:tops.map((b,i)=>Object.assign(b,{x:40,y:40+i*200}))}};}
const SCR={
  glide:(x,y,z,s)=>scriptOf(chain(blk('ev_start'),blk('c_forever',{DO:doIn(blk('p_glide',{PART:bme(),X:bn(x),Y:bn(y),Z:bn(z),S:bn(s)}),blk('c_wait',{S:bn(.4)}),
    blk('p_glide',{PART:bme(),X:bn(-x),Y:bn(-y),Z:bn(-z),S:bn(s)}),blk('c_wait',{S:bn(.4)}))}))),
  spin:deg=>scriptOf(chain(blk('ev_start'),blk('c_forever',{DO:doIn(blk('p_rotate',{PART:bme(),DEG:bn(deg)},{AXIS:'y'}),blk('c_wait',{S:bn(0)}))}))),
  door:()=>scriptOf(chain(blk('ev_click'),blk('g_sound',null,{SND:'click'}),blk('p_collide',{PART:bme()},{B:'FALSE'}),blk('p_transp',{PART:bme(),V:bn(.75)}),blk('c_wait',{S:bn(3)}),
    blk('p_transp',{PART:bme(),V:bn(0)}),blk('p_collide',{PART:bme()},{B:'TRUE'}))),
  vanish:()=>scriptOf(chain(blk('ev_touch'),blk('c_wait',{S:bn(.5)}),blk('p_transp',{PART:bme(),V:bn(.9)}),blk('p_collide',{PART:bme()},{B:'FALSE'}),blk('c_wait',{S:bn(2.5)}),
    blk('p_transp',{PART:bme(),V:bn(0)}),blk('p_collide',{PART:bme()},{B:'TRUE'}))),
  teleport:to=>scriptOf(chain(blk('ev_touch'),blk('g_sound',null,{SND:'pad'}),blk('pl_teleport',{PART:bnamed(to)}))),
  button:msg=>scriptOf(chain(blk('ev_touch'),blk('p_color',{PART:bme()},{COLOUR:'#3ddc84'}),blk('c_broadcast',null,{MSG:msg}),blk('c_wait',{S:bn(4)}),blk('p_color',{PART:bme()},{COLOUR:'#ff4d5e'}))),
  gate:msg=>scriptOf(chain(blk('ev_msg',null,{MSG:msg}),blk('p_glide',{PART:bme(),X:bn(0),Y:bn(11),Z:bn(0),S:bn(1)}),blk('c_wait',{S:bn(3)}),blk('p_glide',{PART:bme(),X:bn(0),Y:bn(-11),Z:bn(0),S:bn(1)}))),
  score:()=>scriptOf(chain(blk('ev_touch'),blk('g_stat_change',{N:bn(1)},{STAT:'Points'}),blk('g_sound',null,{SND:'coin'}),
    blk('g_msg',{TEXT:{block:{type:'text_join',extraState:{itemCount:2},inputs:{ADD0:bt('Points: '),ADD1:{block:{type:'s_stat',fields:{STAT:'Points'}}}}}},S:bn(1.2)}))),
  welcome:txt=>scriptOf(chain(blk('ev_start'),blk('g_stat_set',{N:bn(0)},{STAT:'Coins'}),blk('g_msg',{TEXT:bt(txt),S:bn(3)}))),
  bobModel:()=>scriptOf(chain(blk('ev_start'),blk('c_forever',{DO:doIn(blk('p_glide',{PART:bmodel(),X:bn(0),Y:bn(5),Z:bn(0),S:bn(2.5)}),blk('p_glide',{PART:bmodel(),X:bn(0),Y:bn(-5),Z:bn(0),S:bn(2.5)}))}))),
  spinModel:()=>scriptOf(chain(blk('ev_start'),blk('c_forever',{DO:doIn(blk('p_rotate',{PART:bmodel(),DEG:bn(2)},{AXIS:'z'}),blk('c_wait',{S:bn(0)}))}))),
  touchDefault:()=>scriptOf(blk('ev_touch')),
  startDefault:()=>scriptOf(blk('ev_start'))
};
function newProjectObj(template,name){
  const p={id:uid(),name:name||(template==='obby'?'My Obby':'My Game'),updated:Date.now(),settings:defaultSettings(),nodes:[]};
  const N=p.nodes;
  N.push(partNode({name:'Baseplate',pos:[0,-1,0],size:[256,2,256],color:'#7a8a98',material:'Studs',locked:true}));
  N.push(partNode({name:'SpawnLocation',pos:[0,.5,0],size:[12,1,12],color:'#56627e',material:'Studs',behavior:'spawn'}));
  if(template==='obby'){
    const C=['#5c9dff','#9b6bff','#ff6bb5','#4fd1c5'];
    const course=groupNode('Folder',{name:'Course'});N.push(course);
    let z=-14,y=2;
    for(let i=0;i<4;i++){N.push(partNode({parent:course.id,name:'Platform',pos:[0,y,z],size:[6,1,6],color:C[i%4]}));z-=10;y+=1.5;}
    N.push(partNode({parent:course.id,name:'LavaFloor',pos:[0,.1,-60],size:[30,.6,60],color:'#ff4a1f',behavior:'kill'}));
    const mover=partNode({parent:course.id,name:'MovingPlatform',pos:[0,y,z-2],size:[8,1,8],color:'#ffb84d'});N.push(mover);
    N.push(scriptNode({parent:mover.id,name:'GlideScript',blocks:SCR.glide(14,0,0,2.2)}));
    z-=14;N.push(partNode({parent:course.id,name:'Checkpoint',pos:[0,y,z],size:[10,1,10],color:'#3ddc84',behavior:'check',value:1}));
    z-=16;N.push(partNode({parent:course.id,name:'SpinArena',pos:[0,y,z],size:[18,1,18],color:'#c7d2ea'}));
    const sp=partNode({parent:course.id,name:'Spinner',pos:[0,y+1,z],size:[16,1,1],color:'#ff3b30',behavior:'kill',material:'Neon'});N.push(sp);
    N.push(scriptNode({parent:sp.id,name:'SpinScript',blocks:SCR.spin(2.5)}));
    for(let i=0;i<3;i++)N.push(partNode({parent:course.id,name:'Coin',shape:'cyl',pos:[-5+i*5,y+2.5,z+5],size:[.3,2.3,2.3],color:'#ffc72c',behavior:'coin'}));
    z-=14;N.push(partNode({parent:course.id,name:'JumpPad',pos:[0,y+.2,z],size:[4,.4,4],color:'#22d3ee',material:'Neon',behavior:'jump',value:96}));
    z-=8;y+=16;N.push(partNode({parent:course.id,name:'HighLedge',pos:[0,y,z-4],size:[10,1,12],color:'#9b6bff'}));
    const v=partNode({parent:course.id,name:'VanishingTile',pos:[0,y,z-16],size:[6,1,6],color:'#a8e6ff'});N.push(v);N.push(scriptNode({parent:v.id,name:'VanishScript',blocks:SCR.vanish()}));
    N.push(partNode({parent:course.id,name:'Finish',pos:[0,y,z-30],size:[14,1,14],color:'#ffc93c',material:'Metal',behavior:'finish'}));
    N.push(scriptNode({name:'Welcome',blocks:SCR.welcome('Reach the gold platform!')}));
    const sg=guiNode('ScreenGui',{name:'HUD'});const lb=guiNode('TextLabel',{parent:sg.id,name:'CoinLabel',text:'Coins: 0',gpos:[1,-20,0,76],anchor:[1,0],gsize:[0,190,0,46],bg:'#ffc72c',bgT:.05,tc:'#2a1a00',font:'Display',ts:24,radius:23});
    N.push(sg,lb,scriptNode({parent:lb.id,name:'CoinScript',blocks:scriptOf(chain(blk('ev_start'),blk('c_forever',{DO:doIn(blk('gui_settext',{GUI:{shadow:{type:'gui_this'}},
      TEXT:{block:{type:'text_join',extraState:{itemCount:2},inputs:{ADD0:bt('Coins: '),ADD1:{block:{type:'s_stat',fields:{STAT:'Coins'}}}}}}}),blk('c_wait',{S:bn(.2)}))})))}));
  }else{
    N.push(scriptNode({name:'Welcome',blocks:scriptOf(chain(blk('ev_start'),blk('g_msg',{TEXT:bt('Welcome to my game!'),S:bn(3)})))}));
  }
  return p;
}
function listProjects(){return (store.get('projects',[])||[]).map(id=>store.get('proj:'+id,null)).filter(Boolean).sort((a,b)=>b.updated-a.updated);}
function saveProject(p){p.updated=Date.now();const ok=store.set('proj:'+p.id,p);const ids=store.get('projects',[])||[];if(!ids.includes(p.id)){ids.push(p.id);store.set('projects',ids);}return ok;}
function deleteProject(id){store.del('proj:'+id);store.set('projects',(store.get('projects',[])||[]).filter(x=>x!==id));const b=store.get('bests',{});delete b['proj:'+id];store.set('bests',b);}
function descendantsOf(proj,id){const out=[];const walk=pid=>{for(const n of proj.nodes)if(n.parent===pid){out.push(n);walk(n.id);}};walk(id);return out;}
function partOpts(n){
  const beh=n.behavior||'none';
  const kind={kill:'kill',check:'check',jump:'jump',speed:'speed',finish:'finish',spawn:'spawn'}[beh]||'solid';
  const o={pos:n.pos.slice(),size:n.size.slice(),shape:n.shape==='block'?'box':n.shape,kind,collide:n.canCollide!==false,name:n.name,
    look:{color:n.color,material:n.material,transparency:n.transparency||0,neon:kind==='kill'},
    data:{stage:n.value||1,power:n.value||100,boost:n.value||2.6}};
  if(n.shape==='mesh'){o.geo=MESHCACHE.get(n.meshId)||BOX;o.look.vc=!!(MESHINFO.get(n.meshId)||{}).vc;}
  const r=n.rot||[0,0,0];
  if(Math.abs(r[0])<1e-3&&Math.abs(r[2])<1e-3){if(Math.abs(r[1])>1e-3)o.yaw=r[1]*D2R;}
  else o.quat=new THREE.Quaternion().setFromEuler(new THREE.Euler(r[0]*D2R,r[1]*D2R,r[2]*D2R,'YXZ'));
  return o;
}
function serviceOf(proj,id){let n=proj.nodes.find(x=>x.id===id);let pid=n?n.parent:id;let guard_=0;while(pid&&!isService(pid)&&guard_++<200){const q=proj.nodes.find(x=>x.id===pid);pid=q?q.parent:null;}return pid;}
function instantiate(proj,list,off,map){
  off=off||new V3();
  for(const n of list){
    if(n.cls==='Part'){
      if(n.behavior==='coin'){coin(n.pos[0]+off.x,n.pos[1]+off.y,n.pos[2]+off.z);continue;}
      const o=partOpts(n);o.pos=[n.pos[0]+off.x,n.pos[1]+off.y,n.pos[2]+off.z];
      const inTool=hasToolAncestor(proj,n.id);if(inTool)o.collide=false;
      const p=addPart(o);p.node=n;map.set(n.id,p);if(n.label)setPartLabel(p,n.label);if(inTool)p.toolPickup=true;else if(n.anchored===false){p.vy=0;W.phys.push(p);}
    }else if(n.cls==='Rig')map.set(n.id,addRig(n,off));
  }
  for(const n of list)if(n.cls==='ParticleEmitter'){const par=map.get(n.parent);if(par){const e=new Emitter(n,par,scene);e.nodeId=n.id;W.emitters.push(e);}}
  for(const n of list)if(n.cls==='Tool')W.pickups.push({node:n,parts:toolParts(proj,n.id).map(d=>map.get(d.id)).filter(Boolean),taken:false});
  const models=new Map();
  for(const n of list){
    if(n.cls!=='Model'&&n.cls!=='Rig')continue;
    const parts=n.cls==='Rig'?[map.get(n.id)].concat(descendantsOf(proj,n.id).map(d=>map.get(d.id))).filter(Boolean):descendantsOf(proj,n.id).map(d=>map.get(d.id)).filter(Boolean);
    const g={isGroup:true,name:n.name,id:n.id,parts};models.set(n.id,g);
    if(!W.modelsByName.has(n.name))W.modelsByName.set(n.name,[]);W.modelsByName.get(n.name).push(g);
  }
  return models;
}
function nodesBounds(list){const bb=new THREE.Box3();
  for(const n of list){if(n.cls==='Part'){const h=new V3().fromArray(n.size).multiplyScalar(.5),c=new V3().fromArray(n.pos);bb.expandByPoint(c.clone().sub(h));bb.expandByPoint(c.clone().add(h));}
    else if(n.cls==='Rig'){const s=n.scale||1,h=new V3(2*s,2.6*s,.6*s),c=new V3().fromArray(n.pos);bb.expandByPoint(c.clone().sub(h));bb.expandByPoint(c.clone().add(h));}}
  if(bb.isEmpty())bb.expandByPoint(new V3());return bb;}
const SPAWN_TRIM=new THREE.MeshBasicMaterial({color:0x7dd3fc,transparent:true,opacity:.9});
function spawnTrim(p){const m=p.mesh;if(!m||!p.node||p.node.shape&&p.node.shape!=='block')return;const sx=m.scale.x,sy=m.scale.y,sz=m.scale.z;if(sx<3||sz<3)return;
  const g=new THREE.Group();g.scale.set(1/sx,1/sy,1/sz);const y=sy/2+.04,w=.35,i=.7;
  [[0,(sz/2-i),sx-2*i,w],[0,-(sz/2-i),sx-2*i,w],[(sx/2-i),0,w,sz-2*i+w],[-(sx/2-i),0,w,sz-2*i+w]].forEach(([x,z,a,b])=>{const e=new THREE.Mesh(BOX,SPAWN_TRIM);e.scale.set(a,.06,b);e.position.set(x,y,z);g.add(e);});
  m.add(g);}
function buildProject(proj){
  const S=proj.settings;
  PHYS.gravity=S.gravity;PHYS.walk=S.walkSpeed;PHYS.jump=S.jumpPower;
  registerAnims(proj);
  const list=descendantsOf(proj,'workspace');
  W.models=instantiate(proj,list,null,W.byId);
  let spawn=null,minY=Infinity,stages=0;
  for(const n of list){const p=W.byId.get(n.id);if(p&&!p.rig)minY=Math.min(minY,p.min.y);
    if(n.cls==='Part'&&n.behavior==='spawn'&&!spawn)spawn=p;if(n.cls==='Part'&&n.behavior==='check')stages=Math.max(stages,n.value||1);}
  if(spawn){W.spawn.set(spawn.pos.x,spawn.max.y+PH.y+.3,spawn.pos.z);try{spawnTrim(spawn);}catch(e){}}
  else W.spawn.set(0,(isFinite(minY)?Math.max(0,groundAt(0,0)):0)+PH.y+3,0);
  W.killY=(isFinite(minY)?minY:0)-60;W.stages=stages;
  state.total=W.coins.length;
}
function copyFromStorage(name,place){
  const proj=game&&game.project;if(!proj)return null;
  const tpl=proj.nodes.find(n=>n.name===name&&n.cls!=='Script'&&serviceOf(proj,n.id)==='rs');
  if(!tpl){warnOnce('rs:'+name,'Nothing named "'+name+'" is in ReplicatedStorage.');return null;}
  const list=[tpl,...descendantsOf(proj,tpl.id)];
  const hasRig=list.some(n=>n.cls==='Rig');if(hasRig&&!HOST.am&&!RT.allowRigCopy)return null;const bb=nodesBounds(list);const c=bb.getCenter(new V3());
  const off=place(c,bb);const map=new Map();const models=instantiate(proj,list,off,map);
  startScriptsFor(proj,list.filter(n=>n.cls==='Script'&&!hasToolAncestor(proj,n.id)),map,models);
  RT.last=models.get(tpl.id)||map.get(tpl.id)||{isGroup:true,name,parts:[...map.values()]};
  if(hasRig&&!RT.allowRigCopy){const rp=[...map.values()].find(p=>p.rig);if(rp){rp.key=rp.copyKey='c'+(++RT.copySeq)+':'+tpl.id;}}
  return RT.last;
}
function projectDef(proj,fromEditor){
  const S=proj.settings;
  return {id:'proj:'+proj.id,name:proj.name,mode:'project',fromEditor,project:proj,stageWord:'Checkpoint',
    scene:{sky:S.sky,fogNear:Math.min(200,S.fog*.25),fogFar:S.fog,brightness:S.brightness},build:()=>buildProject(proj),objective:fromEditor?'Testing '+proj.name:proj.name,room:fromEditor?null:'p-'+proj.id};
}

/* ---------- start / stop ---------- */
function startGame(def){
  mpLeave();try{if(def&&!def.fromEditor&&GAMES.some(g=>g.id===def.id))store.set('lastGame',def.id);}catch(e){}try{juiceReset();}catch(e){}
  if(def.room===undefined)def.room=def.id;
  game=def;t=0;GAMECOINS.left=150;
  PHYS.gravity=196.2;PHYS.walk=16;PHYS.jump=50;
  newScene(def.scene);
  state={time:0,stage:0,coins:0,total:0,deaths:0,over:false};
  rtReset();
  P.yaw=0;
  def.build(mulberry(def.seed||1));
  P.model=null;P.debris=[];
  respawn();
  P.backpack=[];P.equipped=null;P.held=null;P.health=P.maxHealth=100;lastHp=-1;
  lobbyStop();
  if(def.project){buildRuntimeGui(def.project);startScripts(def.project);giveStarterTools(def.project);saveBegin(def);}
  renderHotbar();$('#hp').hidden=!def.project;
  cam.yaw=def.id==='sky'?0:def.id==='tower'?Math.PI/2+.4:def.id==='maze'?-2.36:.6;cam.pitch=def.id==='maze'?.85:.3;cam.dist=coarse?22:20;cam.cur=cam.dist;
  $('#menu').hidden=true;$('#game').hidden=false;$('#overlay').hidden=true;$('#gcon').innerHTML='';
  hud.name.textContent=def.name;
  hud.timer.hidden=!(def.mode==='race'||def.mode==='coins'||(def.mode==='project'&&def.project.settings.timer));
  $('#btnStop').hidden=!def.fromEditor;
  $('#buildbar').hidden=def.mode!=='build';
  setStat('');
  if(def.mode==='build'){setupBuildBar();setBTool('build');saveBuild();}
  $('#touch').hidden=!coarse;
  const hint=$('#hint');hint.style.opacity=1;
  hint.textContent=coarse?(def.mode==='build'?'Stick to move · drag to look · tap to build':'Stick to move · drag to look · tap Jump'):
    (def.mode==='build'?'Click to build · drag to look · 1 2 3 switch tools · Enter chat · Esc pause':'WASD move · Space jump · drag to look · Enter chat · Tab players · R respawn');
  clearTimeout(startGame._h);startGame._h=setTimeout(()=>hint.style.opacity=0,7000);
  if(!def.project)toast(def.objective||def.name,'#ffd75e');
  if(def.fromEditor)logOut('Playtest started.','sys');
  running=true;paused=false;try{musicStart(game);}catch(e){}
  if(def.project)lobbyInit();
  ghostStart();
  mpJoin(def);
  cv.focus({preventScroll:true});
}
/* ---------- lobbies & matches ----------
   Matches run on a shared clock, so everyone in the same game is in the same lobby countdown and match
   without any server. Scripts hear "round start" and "round end" messages; scripts started by
   "round start" get the same random numbers for every player, so random picks match online. */
const LOBBY={on:false};
function lobbyCfg(){const S=game&&game.project&&game.project.settings;if(!S||!S.lobby)return null;
  return {wait:Math.max(5,Math.min(120,+S.lobbyWait||15)),round:Math.max(15,Math.min(900,+S.lobbyRound||90)),score:String(S.lobbyScore||'').trim().slice(0,40),elim:!!S.lobbyElim,low:!!S.lobbyLow};}
function lobbyInit(){
  const c=lobbyCfg();Object.assign(LOBBY,{on:!!c,cfg:c,off:0,idx:-1,phase:'',inRound:false,out:false,late:false,resUntil:0,txt:'',seed:0,sign:null,initT:t,quick:false});
  $('#lobbyBar').hidden=!c;$('#lobbyRes').hidden=true;$('#game').classList.toggle('haslobby',!!c);if(!c)return;
  let top=0;for(const p of W.parts){if(!p.rig&&p.max.y<5000)top=Math.max(top,p.max.y);}
  const cx=W.spawn.x,cz=W.spawn.z,y=Math.max(60,top+60);
  const L=o=>{const p=addPart(o);p.lobby=true;return p;};
  L({pos:[cx,y,cz],size:[44,1,44],color:0xeaf1ff,noShadow:true});
  [[0,-22,46,1],[0,22,46,1],[-22,0,1,46],[22,0,1,46]].forEach(([x,z,w,d])=>L({pos:[cx+x,y+1.5,cz+z],size:[w,2,d],color:0x8fb3ff,transparency:.45}));
  [[-21,-21],[21,-21],[-21,21],[21,21]].forEach(([x,z])=>L({pos:[cx+x,y+3,cz+z],size:[1.2,5,1.2],color:0xffd75e,neon:true}));
  [[-10,10],[10,10]].forEach(([x,z])=>L({pos:[cx+x,y+.6,cz+z],size:[4,.3,4],color:0x22d3ee,neon:true,kind:'jump',data:{power:70}}));
  LOBBY.sign=L({pos:[cx,y+6,cz-21],size:[22,6,.6],color:0x1e2a44});setPartLabel(LOBBY.sign,'LOBBY');
  LOBBY.spot=new V3(cx,y+.5+PH.y+.3,cz+4);
  lobbyTick();}
function lobbyNow(){return Date.now()/1000+LOBBY.off;}
function lobbyPhase(){const c=LOBBY.cfg,per=c.wait+c.round,now=lobbyNow(),idx=Math.floor(now/per),ph=now-idx*per;return {per,idx,ph,phase:ph<c.wait?'lobby':'play'};}
function lobbyTick(){
  if(!LOBBY.on||!running)return;const c=LOBBY.cfg;
  if(LOBBY.off&&MP.remotes.size&&!LOBBY.inRound&&lobbyPhase().phase==='lobby'){LOBBY.off=0;}
  // playing alone: no need to wait out a match in progress or a long lobby, start in about 5 seconds
  if(!LOBBY.quick&&t-LOBBY.initT>2.5){LOBBY.quick=true;if(!MP.remotes.size){const q=lobbyPhase(),want=Math.max(0,c.wait-5);
    if(q.phase==='play'&&!LOBBY.inRound)LOBBY.off+=q.per-q.ph+want;else if(q.phase==='lobby'&&q.ph<want)LOBBY.off+=want-q.ph;}}
  const {per,idx,ph,phase}=lobbyPhase();
  if(LOBBY.phase===''){LOBBY.phase=phase;LOBBY.idx=idx;LOBBY.late=phase==='play';lobbyToLobby();}
  else if(phase!==LOBBY.phase||idx!==LOBBY.idx){
    if(LOBBY.inRound)lobbyEnd();
    if(phase==='play')lobbyStart(idx);else{LOBBY.late=false;if(!MP.remotes.size&&c.wait-ph>7){LOBBY.off+=(c.wait-7)-ph;}}
    LOBBY.phase=phase;LOBBY.idx=idx;}
  const left=Math.max(0,Math.ceil(phase==='lobby'?c.wait-ph:per-ph)),mm=s=>Math.floor(s/60)+':'+String(s%60).padStart(2,'0'),np=1+MP.remotes.size;
  let txt;
  if(phase==='lobby')txt=`Lobby · match starts in ${mm(left)} · ${np} player${np>1?'s':''}`;
  else if(LOBBY.inRound&&!LOBBY.out)txt=`Match · ${mm(left)} left`+(c.score?` · ${c.score}: ${r3(RT.stats.get(c.score)||0)}`:'');
  else txt=(LOBBY.out?'You are out':'Match on')+` · next in ${mm(left+c.wait)}`;
  const solo=MP.remotes.size===0,canGo=solo&&(phase==='lobby'||!LOBBY.inRound||LOBBY.out);
  const key=txt+'|'+canGo+'|'+phase;
  {const canSpec=LOBBY.out&&LOBBY.inRound&&[...MP.remotes.values()].some(r=>!r.dead&&r.lb&&r.lb.r===LOBBY.idx&&!r.lb.o);const sb=$('#lobbySpec');if(sb&&sb.hidden===canSpec){sb.hidden=!canSpec;}if(!canSpec&&SPEC.on){SPEC.on=false;}
    if(sb){const t2=SPEC.on?'👁 Next player':'👁 Spectate';if(sb.textContent!==t2)sb.textContent=t2;}}
  if(key!==LOBBY.txt){LOBBY.txt=key;$('#lobbyTxt').textContent=txt;$('#lobbyGo').hidden=!canGo;$('#lobbyBar').classList.toggle('play',phase==='play'&&LOBBY.inRound&&!LOBBY.out);
    if(LOBBY.sign)setPartLabel(LOBBY.sign,(game&&game.name?game.name.toUpperCase()+' · ':'')+(phase==='lobby'?'NEXT MATCH IN '+left:LOBBY.inRound&&!LOBBY.out?'MATCH ON':'NEXT MATCH IN '+(left+c.wait)));}
  if(phase==='lobby'&&left<=3&&left>=1&&LOBBY.cd!==LOBBY.idx+':'+left){LOBBY.cd=LOBBY.idx+':'+left;juiceCall(String(left));}
  if(LOBBY.resUntil&&t>LOBBY.resUntil){LOBBY.resUntil=0;$('#lobbyRes').hidden=true;}}
function lobbySkip(){if(!LOBBY.on)return;const c=LOBBY.cfg,{per,ph}=lobbyPhase();LOBBY.off+=ph<c.wait?(c.wait-ph+.02):(per-ph+c.wait+.02);lobbyTick();}
$('#skipBtn').addEventListener('click',()=>{skipStage();cv.focus({preventScroll:true});});
$('#lobbyGo').addEventListener('click',()=>{lobbySkip();cv.focus({preventScroll:true});});
$('#lobbyInvite').addEventListener('click',()=>{copyInvite();cv.focus({preventScroll:true});});
$('#lobbySpec').addEventListener('click',()=>{if(SPEC.on)SPEC.i++;else{SPEC.on=true;SPEC.i=0;}const r=specTarget();if(r)toast('Watching '+nameOf(r.by),'#9fe3ff',1.5);cv.focus({preventScroll:true});});
function lobbyToLobby(){if(!LOBBY.spot)return;W.checkpoint=LOBBY.spot.clone();state.stage=0;
  if(!P.dead){if(P.rag)ragEndPlayer();P.pos.copy(LOBBY.spot).add(new V3((Math.random()-.5)*10,0,(Math.random()-.5)*6));P.vel.set(0,0,0);P.boost=0;}P.health=P.maxHealth;}
function lobbyStart(idx){const c=LOBBY.cfg;LOBBY.inRound=true;LOBBY.out=false;LOBBY.late=false;LOBBY.seed=idx;
  W.checkpoint=null;state.stage=0;$('#lobbyRes').hidden=true;LOBBY.resUntil=0;
  if(!P.dead){if(P.rag)ragEndPlayer();P.pos.copy(W.spawn).add(new V3((Math.random()-.5)*4,0,(Math.random()-.5)*4));P.vel.set(0,0,0);P.boost=0;}
  P.health=P.maxHealth;if(c.score)RT.stats.set(c.score,0);RT.t0=state.time;
  juiceCall('GO!');SFX.win();rtFire('msg','round start');MP.lastSent='';}
function lobbyEnd(){const c=LOBBY.cfg;LOBBY.inRound=false;rtFire('msg','round end');
  if(c.score){const rows=[{n:myName(),s:+(RT.stats.get(c.score)||0),me:true}];
    for(const r of MP.remotes.values())if(r.lb&&r.lb.r===LOBBY.idx)rows.push({n:nameOf(r.by),s:num(r.lb.s,0)});
    const myS=rows[0].s,bk='lbBest:'+game.id,pb=store.get(bk,null),newPB=myS>0&&(pb==null||(c.low?myS<pb:myS>pb));if(newPB)store.set(bk,myS);
    rows.sort((a,b)=>c.low?a.s-b.s:b.s-a.s);const best=rows[0].s,won=rows.length>0&&rows.find(r=>r.me).s===best&&(c.low||best>0);
    if(won&&rows.length>1){changeStat('Wins',1);questBump('win',game.id,1);gainXP(40);WALLET.wins=(WALLET.wins||0)+1;}questBump('match',game.id,1);gainXP(20);earnCoins(won&&rows.length>1?40:newPB?25:10,won&&rows.length>1?'you won!':newPB?'new personal best!':'match played');if(newPB&&pb!=null)setTimeout(()=>juiceCall('NEW BEST!'),400);
    $('#lobbyRes').innerHTML=`<h3>${won?(rows.length>1?'You win!':'Match over'):'Match over'}</h3><ol>${rows.slice(0,8).map((r,i)=>`<li class="${r.me?'me':''}"><span>${['🥇','🥈','🥉'][i]||(i+1)+'.'} ${esc(r.n)}</span><span>${r3(r.s)}</span></li>`).join('')}</ol><p class="sub">${newPB?'⭐ New personal best! ':pb!=null?'Your best: '+r3(pb)+' · ':''}${esc(c.score)} · next match soon</p>`;
    $('#lobbyRes').hidden=false;$('#toast').classList.remove('show');toastT=0;LOBBY.resUntil=t+6;SFX[won?'win':'check']();if(won||newPB)setTimeout(()=>{try{if(running&&!P.dead)playAnim('me',BD()[won&&rows.length>1?'dance':'cheer'],'auto',true);}catch(e){}},900);}
  else{toast('Match over!','#ffd75e',2);questBump('match',game.id,1);earnCoins(10,'match played');}
  lobbyToLobby();MP.lastSent='';}
function lobbyStop(){LOBBY.on=false;$('#lobbyBar').hidden=true;$('#lobbyRes').hidden=true;$('#game').classList.remove('haslobby');}
function stopGame(){
  musicStop();
  if(TEST2&&!TESTCLIENT)closeTest2();
  if(TESTCLIENT&&running)setTimeout(()=>window.parent.postMessage({by2:1,k:'closed'},'*'),0);
  if(game&&game.project&&SAVE.loaded)saveFlush(false,true);SAVE.gen++;SAVE.loaded=false;
  mpLeave();
  if(P.equipped)unequipTool();P.backpack=[];renderHotbar();
  running=false;paused=false;rtReset();lobbyStop();if(GHOST.mesh){scene.remove(GHOST.mesh);GHOST.mesh=null;}$('#bsaves').hidden=true;$('#game').hidden=true;keys.clear();jumpHeld=false;
  if(game&&game.fromEditor){logOut('Playtest stopped.','sys');ED.ecv.focus({preventScroll:true});return;}
  $('#menu').hidden=false;renderCards();
}
function pause(){if(!running||state.over)return;paused=true;keys.clear();jumpHeld=false;musicDuck(true);
  const restart=game.mode==='build'?'':'<button class="btn ghost" data-act="restart">Restart</button>';
  const back=game.fromEditor?'<button class="btn ghost" data-act="menu">Stop testing</button>':'<button class="btn ghost" data-act="menu">Back to games</button>';
  $('#panel').innerHTML=`<h2>Paused</h2><div class="btns"><button class="btn" data-act="resume">Resume</button>${restart}${back}</div>
  <div class="setrow"><span>Sound</span><button class="btn ghost" data-act="mute">${muted?'Off':'On'}</button></div>
  <div class="setrow"><span>Music</span><button class="btn ghost" data-act="music">${MUSIC.on?'On':'Off'}</button></div>
  <div class="setrow"><span>Screen shake</span><button class="btn ghost" data-act="shake">${SHAKE_ON?'On':'Off'}</button></div>
  <div class="setrow"><label for="sens">Camera speed</label><input id="sens" type="range" min=".4" max="2.2" step=".1" value="${cam.sens}"></div>`;
  $('#overlay').hidden=false;
  $('#sens').oninput=e=>{cam.sens=+e.target.value;store.set('sens',cam.sens);};}
function resume(){paused=false;$('#overlay').hidden=true;musicDuck(false);cv.focus({preventScroll:true});}
$('#panel').addEventListener('click',e=>{const b=e.target.closest('[data-act]');if(!b)return;const a=b.dataset.act;
  if(a==='resume')resume();else if(a==='restart')startGame(game);else if(a==='menu')stopGame();
  else if(a==='mute'){muted=!muted;store.set('muted',muted);b.textContent=muted?'Off':'On';if(muted)musicStop();else if(MUSIC.on&&running){musicStart(game);musicDuck(true);}}
  else if(a==='shake'){SHAKE_ON=!SHAKE_ON;store.set('shakeOn',SHAKE_ON);b.textContent=SHAKE_ON?'On':'Off';}
  else if(a==='music'){MUSIC.on=!MUSIC.on;store.set('musicOn',MUSIC.on);b.textContent=MUSIC.on?'On':'Off';if(!MUSIC.on)musicStop();else if(running){musicStart(game);musicDuck(true);}}});
$('#btnPause').addEventListener('click',()=>paused?resume():pause());
$('#helpBtn').addEventListener('click',()=>{if(game&&game._help)toast(game._help,'#fff',7);cv.focus({preventScroll:true});});
$('#btnStop').addEventListener('click',()=>stopGame());
document.addEventListener('visibilitychange',()=>{if(document.hidden&&running&&!paused)pause();});

function finish(){
  if(state.over)return;state.over=true;SFX.win();try{['#ffd54f','#ff5c8a','#5cc8ff','#7dffa8','#b388ff'].forEach((c,i)=>setTimeout(()=>burstAt(P.pos.clone().add(new V3((Math.random()-.5)*6,2+Math.random()*3,(Math.random()-.5)*6)),c),i*90));juiceCall(game.mode==='coins'?(state.coins>=state.total?'EVERY COIN!':'TIME!'):'FINISHED!');setTimeout(()=>{try{if(running&&!P.dead)playAnim('me',BD().dance,'auto',true);}catch(e){}},250);}catch(e){}if(!game.fromEditor){earnCoins(25,'finished!');questBump('finish',game.id,1);gainXP(40);}if(game.project)saveFlush(false,true);
  mpEmit('fin',{time:r3(state.time)});
  const bests=store.get('bests',{});let html='';
  if(game.mode==='race'||game.mode==='project'){const prev=bests[game.id];const nb=!state.skipped&&(prev==null||state.time<prev);if(nb&&!game.fromEditor){bests[game.id]=state.time;store.set('bests',bests);ghostSave();if(state.splits)store.set('splits:'+game.id,state.splits);}
    const stats=[...RT.stats].map(([k,v])=>esc(k)+' '+r3(v)).join(' · ');
    html=`<h2>${game.mode==='project'?'You win!':'Course complete!'}</h2><div class="big">${fmt(state.time)}</div><div class="sub">${game.fromEditor?'Playtest':nb?'<span class="badge">New best</span>':'Best '+fmt(prev)} · ${state.deaths} ${state.deaths===1?'fall':'falls'}${stats?' · '+stats:''}</div>`;}
  else if(game.mode==='coins'){const all=state.coins>=state.total;const prev=bests[game.id];
    const score={coins:state.coins,time:state.time};
    const better=!prev||score.coins>prev.coins||(score.coins===prev.coins&&score.time<prev.time);if(better){bests[game.id]=score;store.set('bests',bests);}
    html=`<h2>${all?'Every coin!':"Time's up!"}</h2><div class="big">${state.coins}/${state.total}</div><div class="sub">${all?'Done in '+fmt(state.time)+' · ':''}${better?'<span class="badge">New best</span>':'Best '+prev.coins+' coins'}</div>`;}
  const back=game.fromEditor?'Back to Studio':'Back to games';
  $('#panel').innerHTML=html+`<div class="btns"><button class="btn" data-act="restart">Play again</button><button class="btn ghost" data-act="menu">${back}</button></div>`;
  setTimeout(()=>{if(running)$('#overlay').hidden=false;},500);
}

/* ---------- game input ---------- */
addEventListener('keydown',e=>{
  if(!running)return;
  if(e.target&&e.target.id==='chatIn')return;
  if(MP.gr&&!paused&&(e.code==='Enter'||e.code==='Slash')&&!MP.chatOpen){e.preventDefault();openChat();return;}
  if(e.code==='Tab'&&MP.gr){e.preventDefault();MP.plistOpen=!MP.plistOpen;updateOnlineUI();return;}
  if(e.code==='Escape'||e.code==='KeyP'){paused?resume():pause();e.preventDefault();return;}
  if(e.code==='F5'&&game.fromEditor){e.preventDefault();stopGame();return;}
  if(paused)return;
  if(e.code==='Space'){e.preventDefault();if(!e.repeat)P.jumpBuf=.15;jumpHeld=true;}
  if(e.code==='KeyR'&&!e.repeat&&!P.dead&&!state.over){die('kill');}
  if(game.mode==='build'){if(e.code==='Digit1')setBTool('build');if(e.code==='Digit2')setBTool('paint');if(e.code==='Digit3')setBTool('delete');if(e.code==='Digit4')setBTool('pick');if(e.code==='Digit5')setBTool('stamp');}
  if(/^Arrow/.test(e.code))e.preventDefault();
  if(!e.repeat)rtFire('key',e.code);
  if(game.mode!=='build'&&/^Digit[1-9]$/.test(e.code)&&!e.repeat){const i=+e.code.slice(5)-1;if(P.backpack[i])equipTool(P.backpack[i]);}
  keys.add(e.code);
});
addEventListener('keyup',e=>{keys.delete(e.code);if(e.code==='Space')jumpHeld=false;});
addEventListener('blur',()=>{keys.clear();jumpHeld=false;});
let drag=null;
cv.addEventListener('contextmenu',e=>e.preventDefault());
cv.addEventListener('pointerdown',e=>{if(drag)return;drag={id:e.pointerId,x:e.clientX,y:e.clientY,moved:0};try{cv.setPointerCapture(e.pointerId);}catch(_){}});
cv.addEventListener('pointermove',e=>{
  if(drag&&drag.id===e.pointerId){const dx=e.clientX-drag.x,dy=e.clientY-drag.y;drag.x=e.clientX;drag.y=e.clientY;drag.moved+=Math.abs(dx)+Math.abs(dy);
    const k=(coarse?.008:.006)*cam.sens;cam.yaw-=dx*k;cam.pitch=Math.max(-1.2,Math.min(1.35,cam.pitch+dy*k*.85));}
  if(running&&game.mode==='build'&&!paused)updateGhost(e);
});
const endDrag=e=>{if(!drag||drag.id!==e.pointerId)return;const tap=drag.moved<7;drag=null;
  if(!tap||e.type!=='pointerup'||!running||paused)return;
  if(RT.mouse&&RT.mouse.length)RT.mouse.forEach(h=>spawnRun(h.body,h));
  if(game.mode==='build')builderClick(e);
  else{let used=false;if(RT.click.length){const owns=(h,p)=>h.part===p||(h.parts&&h.parts.includes(p));const hit=pickAt(e,p=>RT.click.some(h=>owns(h,p)));if(hit){used=true;const p=hit.object.userData.part;RT.click.filter(h=>owns(h,p)).forEach(h=>spawnRun(h.body,h));}}
    if(!used&&P.equipped){AIM.x=e.clientX;AIM.y=e.clientY;AIM.at=performance.now();activateTool();}}
};
cv.addEventListener('pointerup',endDrag);cv.addEventListener('pointercancel',endDrag);
/* mouse state for the Sensing blocks */
const MOUSE={down:0,x:0,y:0,seen:false};
cv.addEventListener('pointerdown',e=>{if(e.button===0||e.pointerType!=='mouse'){MOUSE.down++;}MOUSE.x=e.clientX;MOUSE.y=e.clientY;MOUSE.seen=true;});
const mUp=e=>{if(e.button===0||e.pointerType!=='mouse')MOUSE.down=Math.max(0,MOUSE.down-1);};
addEventListener('pointerup',mUp);addEventListener('pointercancel',mUp);addEventListener('blur',()=>{MOUSE.down=0;});
cv.addEventListener('pointermove',e=>{MOUSE.x=e.clientX;MOUSE.y=e.clientY;MOUSE.seen=true;});
function mousePart(){if(!MOUSE.seen)return null;const hit=pickAt({clientX:MOUSE.x,clientY:MOUSE.y});return hit?hit.object.userData.part:null;}
cv.addEventListener('wheel',e=>{e.preventDefault();cam.dist=Math.max(.5,Math.min(80,cam.dist*(1+e.deltaY*.0012)));if(cam.dist<1.6)cam.dist=.5;},{passive:false});
const joyEl=$('#joy'),knob=$('#knob');let joyId=null;
joyEl.addEventListener('pointerdown',e=>{joyId=e.pointerId;joyEl.setPointerCapture(e.pointerId);joyMove(e);});
joyEl.addEventListener('pointermove',e=>{if(e.pointerId===joyId)joyMove(e);});
const joyEnd=e=>{if(e.pointerId!==joyId)return;joyId=null;joy.x=joy.y=0;knob.style.transform='';};
joyEl.addEventListener('pointerup',joyEnd);joyEl.addEventListener('pointercancel',joyEnd);
function joyMove(e){const r=joyEl.getBoundingClientRect();let x=e.clientX-(r.left+r.width/2),y=e.clientY-(r.top+r.height/2);const l=Math.hypot(x,y),m=50;
  if(l>m){x*=m/l;y*=m/l;}knob.style.transform=`translate(${x}px,${y}px)`;joy.x=x/m;joy.y=-y/m;}
const jb=$('#jumpBtn');
jb.addEventListener('pointerdown',e=>{e.preventDefault();P.jumpBuf=.15;jumpHeld=true;});
['pointerup','pointercancel','pointerleave'].forEach(evn=>jb.addEventListener(evn,()=>{jumpHeld=false;}));

/* ---------- game loop ---------- */
const tmp=new V3(),tmp2=new V3();
const camRay=new THREE.Raycaster();let lastTimerTxt='',lastStatTxt=null,lastHp=-1;
function update(dt){
  t+=dt;
  for(const p of W.dyn){p.delta.subVectors(p.pos,p.lastPos);p.lastPos.copy(p.pos);}
  const tw=(Date.now()/1000)%86400;
  for(const p of W.movers){const m=p.move;const s=Math.sin(tw*m.speed+(m.phase||0))*m.dist;tmp.copy(p.base).addScaledVector(m.axis,s);
    p.delta.subVectors(tmp,p.pos);p.pos.copy(tmp);p.mesh.position.copy(tmp);computeAABB(p);}
  for(const p of W.fades){const d=p.data,m=p.mesh.material;
    if(d.state==='solid'){if(d.touched){d.timer-=dt;m.opacity=.35+.65*Math.max(0,d.timer/.7)*(.75+.25*Math.sin(t*40));if(d.timer<=0){d.state='gone';d.timer=2.4;p.active=false;m.opacity=.08;}}}
    else{d.timer-=dt;if(d.timer<=0){d.state='solid';d.touched=false;p.active=true;m.opacity=1;}}}
  for(const p of W.phys){if(p.destroyed)continue;const prevMin=p.min.y;p.vy=(p.vy||0)-PHYS.gravity*dt;const dy=Math.max(-150,p.vy)*dt;p.pos.y+=dy;
    if(p.vx||p.vz){p.pos.x+=p.vx*dt;p.pos.z+=p.vz*dt;}p.mesh.position.copy(p.pos);computeAABB(p);let landed=false;
    for(const s of W.solids){if(s===p||s.noCollide||!s.active||s.decor||s.rig)continue;
      if(p.min.x<s.max.x&&p.max.x>s.min.x&&p.min.z<s.max.z&&p.max.z>s.min.z&&p.min.y<s.max.y&&(p.max.y>s.min.y||prevMin>=s.max.y-.05)&&dy<0&&(p.min.y>s.max.y-1.6||prevMin>=s.max.y-.05)){p.pos.y+=s.max.y-p.min.y;p.vy=0;landed=true;p.mesh.position.copy(p.pos);computeAABB(p);}}
    if(p.vx||p.vz){if(landed){const k=Math.pow(.004,dt);p.vx*=k;p.vz*=k;if(Math.abs(p.vx)+Math.abs(p.vz)<.4)p.vx=p.vz=0;}}
    if(p.spin&&!landed){p.mesh.rotation.x+=p.spin.x*dt;p.mesh.rotation.z+=p.spin.z*dt;}
    p.mesh.position.copy(p.pos);p.base.copy(p.pos);W.dyn.add(p);if(p.pos.y<W.killY)destroyPart(p);}
  for(const s of W.spinners)s.pivot.rotation.y=(tw*s.speed)%(Math.PI*2);
  if(W.labels&&W.labels.length)for(const L of W.labels){if(L.p.destroyed){L.s.visible=false;continue;}L.s.position.set(L.p.pos.x,L.p.max.y+.9+L.s.scale.y/2,L.p.pos.z);L.s.visible=L.p.mesh.visible;}
  animateAcc(P.model,t);for(const r of MP.remotes.values())animateAcc(r.model,t);coinTick(dt);questTick(dt);ghostTick();hostTick(dt);
  if(W.rigs.length)updateRigs(dt);
  if(game.project||W.projectiles.length)updateTools(dt);
  if(W.emitters.length){W.emitters.forEach(e=>e.update(dt));W.emitters=W.emitters.filter(e=>{if(e.parent.destroyed&&!e.ps.length){e.dispose();return false;}return true;});}
  const pulse=.55+.35*Math.sin(t*4);W.pulse.forEach(m=>m.emissiveIntensity=pulse);
  if(B.clearArm>0){B.clearArm-=dt;if(B.clearArm<=0)$('#bclear').textContent='Clear';}
  P.padCool-=dt;if(P.boost>0)P.boost-=dt;

  if(!P.dead&&!state.over&&P.rag){
    ragStep(P.rag,dt);P.pos.copy(P.rag.pos);
    for(const p of W.special){if(p.active&&p.kind==='kill'&&partOverlap(p,-.12)){die('kill');break;}}
    if(!P.dead&&P.pos.y<W.killY)die('kill');
    if(!P.dead&&t>=P.rag.until&&(P.rag.rest>.25||t>P.rag.until+2))ragEndPlayer();
    if(P.model)P.model.visible=cam.dist>1&&!P.hidden&&!(cam.cur<1.9&&cam.dist>2.5);
  }else if(!P.dead&&!state.over){
    if(P.ground&&(P.ground.move||W.dyn.has(P.ground)))P.pos.add(P.ground.delta);
    let ix=(keys.has('KeyD')||keys.has('ArrowRight')?1:0)-(keys.has('KeyA')||keys.has('ArrowLeft')?1:0)+joy.x;
    let iy=(keys.has('KeyW')||keys.has('ArrowUp')?1:0)-(keys.has('KeyS')||keys.has('ArrowDown')?1:0)+joy.y;
    const sprint=keys.has('ShiftLeft')||keys.has('ShiftRight')||Math.hypot(joy.x,joy.y)>.95;
    const n=Math.ceil(dt/.008),h=dt/n;for(let i=0;i<n;i++)physics(h,ix,iy,sprint);
    if(P.ground&&P.ground.kind==='fade'&&!P.ground.data.touched){P.ground.data.touched=true;P.ground.data.timer=.7;}
    for(const p of W.special){if(p.active&&partOverlap(p,-.12)){handleTouch(p);if(P.dead||state.over)break;}}
    if(!P.dead)for(const s of W.spinners){tmp.copy(P.pos);s.pivot.worldToLocal(tmp);if(Math.abs(tmp.x)<s.len/2+.6&&Math.abs(tmp.z)<1.4&&Math.abs(tmp.y)<3){die('kill');break;}}
    if(!P.dead&&P.pos.y<W.killY)die('kill');
    const magR=P.magnetUntil>t?150:10.5;for(const c of W.coins){if(c.got)continue;if(c.mesh.position.distanceToSquared(P.pos)<magR){c.got=true;c.pop=.3;state.coins++;SFX.coin();try{juicePop(c.mesh.position.clone().add(new V3(0,-2,0)),'+1','big',.7);}catch(e){}
      if(game.mode==='project')changeStat('Coins',1);
      if(game.mode==='coins'&&state.coins>=state.total)finish();}}
    const m=P.model,u=m.userData;m.position.copy(P.pos);
    const hs=Math.hypot(P.vel.x,P.vel.z);
    if(hs>1){const target=Math.atan2(P.vel.x,P.vel.z);let d=target-P.yaw;d=Math.atan2(Math.sin(d),Math.cos(d));P.yaw+=d*Math.min(1,dt*14);}
    m.rotation.y=P.yaw;
    if(P.onGround){P.walk+=hs*dt*.55;const sw=Math.sin(P.walk)*Math.min(1,hs/16)*.95;
      u.lLeg.rotation.x=sw;u.rLeg.rotation.x=-sw;u.lArm.rotation.x+=(-sw-u.lArm.rotation.x)*.4;u.rArm.rotation.x+=(sw-u.rArm.rotation.x)*.4;}
    else{u.lLeg.rotation.x*=.85;u.rLeg.rotation.x*=.85;u.lArm.rotation.x+=(-2.9-u.lArm.rotation.x)*.2;u.rArm.rotation.x+=(-2.9-u.rArm.rotation.x)*.2;}
    if(!P.equipped)u.lArm.rotation.z*=.8,u.rArm.rotation.z*=.8;
    relaxPose(u,Math.min(1,dt*10),true);
    {const B=W.baseAnims;if(B){const which=!P.onGround?B.jump:hs>1?B.walk:B.idle;
      if(which!==P.baseWhich){P.baseWhich=which;P.baseT=0;P.baseW=0;}
      if(which){P.baseT+=dt*(which.speed||1)*(which===B.walk?Math.max(.5,hs/16):1);P.baseW=Math.min(1,P.baseW+dt*8);
        applyPose(u,sampleAnim(which,which.loop?P.baseT%which.length:Math.min(P.baseT,which.length)),P.baseW);}}}
    if(P.anim){P.anim=stepAnim(P.anim,dt,hs>1.5||!P.onGround);if(P.anim)applyPose(u,sampleAnim(P.anim.a,P.anim.t),P.anim.w);else MP.lastSent='';}
    if(P.equipped){const e=P.equipped,sw=t-e.swingT0;let a=-1.57;
      if(sw<.32){a=sw<.12?-1.57-1.3*(sw/.12):-2.87+2.4*((sw-.12)/.2);}
      u.rArm.rotation.x=a;u.rArm.rotation.z=0;}
    m.visible=cam.dist>1&&!P.hidden;
    if(P.bubble&&P.bubbleUntil&&t>P.bubbleUntil){P.bubble.parent&&P.bubble.parent.remove(P.bubble);P.bubble=null;P.bubbleUntil=0;P.sayText='';MP.lastSent='';}
    if(P.shieldUntil>t){if(!P.shieldMesh){const sm=new THREE.Mesh(new THREE.SphereGeometry(3.6,24,16),new THREE.MeshBasicMaterial({color:0x7fd4ff,transparent:true,opacity:.22,depthWrite:false,blending:THREE.AdditiveBlending}));sm.position.y=.6;m.add(sm);P.shieldMesh=sm;}
      P.shieldMesh.material.opacity=.16+Math.sin(t*8)*.06+(P.shieldUntil-t<1.5?Math.sin(t*30)*.08:0);}
    else if(P.shieldMesh){P.shieldMesh.parent&&P.shieldMesh.parent.remove(P.shieldMesh);P.shieldMesh.geometry.dispose();P.shieldMesh.material.dispose();P.shieldMesh=null;}
  }else if(P.dead){
    P.deadT-=dt;if(P.rag){ragStep(P.rag,dt);P.pos.copy(P.rag.pos);}
    for(const d of P.debris){d.v.y-=PHYS.gravity*.35*dt;d.m.position.addScaledVector(d.v,dt);d.m.rotation.x+=d.s.x*dt;d.m.rotation.y+=d.s.y*dt;d.m.rotation.z+=d.s.z*dt;}
    if(P.deadT<=0&&!state.over)respawn();
  }
  for(const c of W.coins){
    if(c.got){if(c.pop>0){c.pop-=dt;c.mesh.position.y+=dt*14;c.mesh.scale.setScalar(Math.max(.01,c.pop/.3));c.mesh.rotation.y+=dt*20;}else c.mesh.visible=false;continue;}
    c.mesh.rotation.y+=dt*2.6;c.mesh.position.y=c.by+Math.sin(t*2+c.ph)*.35;}
  if(game.project&&!state.over){scriptFrame();saveTick();lobbyTick();}
  if(MP.remotes.size)updateRemotes(dt);
  if(MP.gr&&(MP.sendT-=dt)<=0){MP.sendT=MP.p2p&&NETLIB&&NETLIB.kind==='supabase'?.1:.066;sendPresence();if((MP.plT=(MP.plT||0)-.066)<=0){MP.plT=1;if(MP.plistOpen)renderPlayerList();}}
  if(game.project){const hp=Math.ceil(P.health);if(hp!==lastHp){lastHp=hp;$('#dmg').classList.toggle('low',!P.dead&&hp>0&&P.health/P.maxHealth<=.25);$('#hpFill').style.width=(100*P.health/P.maxHealth)+'%';$('#hpFill').style.background=P.health/P.maxHealth>.5?'':P.health/P.maxHealth>.25?'var(--warn)':'var(--bad)';$('#hpTxt').textContent=hp;}}
  rtTick();

  if(!state.over&&game.mode!=='build'&&game.mode!=='free')state.time+=dt;
  if(game.mode==='race'||game.mode==='project'){const s=fmt(state.time);if(s!==lastTimerTxt){hud.timer.textContent=s;lastTimerTxt=s;}hud.timer.style.color='';}
  if(game.mode==='race')setStat((game.stageWord||'Stage')+' '+state.stage+'/'+W.stages);
  else if(game.mode==='project'){let s=[...RT.stats].map(([k,v])=>k+' '+r3(v)).join(' · ');if(W.stages>1&&!LOBBY.on&&!RT.stats.has('Stage'))s=('Stage '+state.stage+'/'+W.stages)+(s?' · '+s:'');if(s!==lastStatTxt){setStat(s);lastStatTxt=s;}}
  else if(game.mode==='coins'){const rem=game.limit-state.time;const s=fmt(rem);if(s!==lastTimerTxt){hud.timer.textContent=s;lastTimerTxt=s;}
    hud.timer.style.color=rem<20?'#ff7a85':'';setStat('Coins '+state.coins+'/'+state.total);if(rem<=0)finish();}
  if(toastT>0){toastT-=dt;if(toastT<=0)$('#toast').classList.remove('show');}
}
const SPEC={on:false,i:0};
function specTarget(){if(!SPEC.on||!LOBBY.on||!LOBBY.out||!LOBBY.inRound)return null;const alive=[...MP.remotes.values()].filter(r=>!r.dead&&r.lb&&r.lb.r===LOBBY.idx&&!r.lb.o);if(!alive.length)return null;return alive[SPEC.i%alive.length];}
function updateCamera(dt){
  const st=specTarget();const target=tmp2.copy(st?st.pos:P.pos);target.y+=1.6;
  const cp=Math.cos(cam.pitch),dir=tmp.set(Math.sin(cam.yaw)*cp,Math.sin(cam.pitch),Math.cos(cam.yaw)*cp);
  if(cam.dist<1){camera.position.copy(target);camera.position.y+=.5;camera.lookAt(target.x-dir.x,target.y+.5-dir.y,target.z-dir.z);}
  else{
    let d=cam.dist;
    camRay.set(target,dir);camRay.far=d;
    const ms=[];for(const p of W.parts)if(p.opaque&&p.mesh.visible&&!p.decor&&!p.noCollide&&p.kind!=='water')ms.push(p.mesh);
    const hit=camRay.intersectObjects(ms,false)[0];if(hit)d=Math.max(1.2,hit.distance-.6);
    cam.cur=d<cam.cur?d:cam.cur+(d-cam.cur)*Math.min(1,dt*6);
    camera.position.copy(target).addScaledVector(dir,cam.cur);camera.lookAt(target);
  }
  if(JU.shake>0&&!paused){const a=JU.shake*JU.shake*.35;camera.position.x+=(Math.random()-.5)*a;camera.position.y+=(Math.random()-.5)*a;camera.position.z+=(Math.random()-.5)*a;}
  if(skyDome){skyDome.position.copy(camera.position);skyDome.material.uniforms.time.value=t;}
  const fovT=P.boost>0?84:70;if(Math.abs(camera.fov-fovT)>.1){camera.fov+=(fovT-camera.fov)*Math.min(1,dt*6);camera.updateProjectionMatrix();}
  sun.position.set(P.pos.x+50,P.pos.y+110,P.pos.z+35);sun.target.position.copy(P.pos);
}
const clock=new THREE.Clock();
/* ---------- game feel: hit numbers, hitmarkers, KO callouts, kill feed, screen shake, comeback assist ---------- */
const JU={lastLocal:-9,lastPart:null,nums:[],shake:0,kos:[],streak:0,deaths:[],callT:0};
const _jv=new V3();
function juiceTick(dt){
  const box=$('#juice');if(!box)return;const w=innerWidth,h=innerHeight;
  for(let i=JU.nums.length-1;i>=0;i--){const n=JU.nums[i];n.age+=dt;
    if(n.age>n.life){n.el.remove();JU.nums.splice(i,1);continue;}
    _jv.copy(n.p);_jv.y+=n.age*3.2;_jv.project(camera);
    if(_jv.z>1){n.el.style.opacity=0;continue;}
    const k=n.age/n.life,sc=n.age<.1?1+(.1-n.age)*6:1;
    n.el.style.left=((_jv.x*.5+.5)*w+n.dx*n.age*30)+'px';n.el.style.top=((-_jv.y*.5+.5)*h)+'px';
    n.el.style.opacity=String(Math.min(1,(1-k)*2.2));n.el.style.transform='translate(-50%,-50%) scale('+sc.toFixed(2)+')';}
  JU.shake=Math.max(0,JU.shake-dt*2.4);
  JU.bt=(JU.bt||0)-dt;if(JU.bt<=0){JU.bt=.15;juiceBoss();}
}
function juiceBoss(){const el=$('#jboss');if(!el)return;let best=null,bd=1e9;
  for(const r of W.rigs){if(r.dead||r.destroyed||!r.mesh.visible||!(r.maxHealth>=300)||((r.node&&r.node.scale)||1)<1.9)continue;const d=r.pos.distanceTo(P.pos);if(d<90&&d<bd){bd=d;best=r;}}
  if(!best){if(JU.bossOn){el.classList.remove('on');JU.bossOn=false;}return;}
  const f=Math.max(0,best.health/best.maxHealth);if(!JU.bossOn||JU.bossR!==best){el.querySelector('b').textContent=botDisp(best.name).toUpperCase();JU.bossR=best;}
  el.querySelector('u').style.width=(f*100).toFixed(1)+'%';el.querySelector('s').style.width=(f*100).toFixed(1)+'%';if(!JU.bossOn){el.classList.add('on');JU.bossOn=true;}}
function juicePop(p,txt,cls,life){if(!p)return;const box=$('#juice');if(!box||JU.nums.length>40)return;
  const el=document.createElement('div');el.className='jnum'+(cls?' '+cls:'');el.textContent=txt;box.appendChild(el);
  JU.nums.push({el,p:p.clone().add(new V3(0,3.4,0)),age:0,life:life||.9,dx:(Math.random()-.5)*2});}
function juiceHitmark(kill){const e=$('#jhit');if(!e)return;e.classList.toggle('kill',!!kill);e.classList.add('on');requestAnimationFrame(()=>requestAnimationFrame(()=>e.classList.remove('on')));
  beep(kill?1500:1900,kill?600:1700,kill?.12:.035,'square',kill?.05:.03);}
const REDUCED_MOTION=(()=>{try{return matchMedia('(prefers-reduced-motion: reduce)').matches;}catch(e){return false;}})();
let SHAKE_ON=store.get('shakeOn',true);
function juiceShake(a){if(REDUCED_MOTION||!SHAKE_ON)return;JU.shake=Math.min(1.2,Math.max(JU.shake,a));}
function juiceLocal(){return t-JU.lastLocal<.25;}
function juiceRigHit(r,n){if(!r||!(n>0))return;const local=juiceLocal();
  if(!local&&P.pos.distanceTo(r.pos)>60)return;
  const big=n>=40;juicePop(r.pos,String(Math.round(n)),big?'big':'',big?1.1:.85);
  if(local){juiceHitmark(false);if(big)juiceShake(.25);}}
function juiceKO(r,force){if(!r)return;if(!force&&!juiceLocal())return;
  juiceHitmark(true);juiceShake(.45);juicePop(r.pos,'KO!','ko',1.2);
  const now=t;JU.kos=JU.kos.filter(x=>now-x<4);JU.kos.push(now);JU.streak++;
  const m=JU.kos.length;const call=m>=4?'RAMPAGE!':m===3?'TRIPLE KO!':m===2?'DOUBLE KO!':JU.streak===5?'ON FIRE! 5 in a row':JU.streak===10?'UNSTOPPABLE! 10 in a row':JU.streak===15?'LEGENDARY! 15':'';
  if(call)juiceCall(call);
  juiceFeed('<b>You</b> knocked out '+escH(botDisp(r.name||'a bot')));}
function juiceCall(txt){const e=$('#jcall');if(!e)return;e.textContent=txt;e.classList.remove('on');void e.offsetWidth;e.classList.add('on');JU.callT=t;
  const danger=/FLOOD|TSUNAMI|METEOR|TORNADO|VOLCANO|EARTHQUAKE|QUAKE|LIGHTNING|ACID|BLIZZARD|FIRE|STORM|SINKHOLE|WIND/.test(txt);
  (danger?[392,330,262]:[880,1175,1568]).forEach((f,i)=>setTimeout(()=>beep(f,f*(danger?.98:1.01),danger?.16:.09,danger?'sawtooth':'square',.04),i*(danger?120:70)));
  e.classList.toggle('danger',danger);
  clearTimeout(JU.callTO);JU.callTO=setTimeout(()=>e.classList.remove('on'),1300);}
function juiceFeed(html){const f=$('#jfeed');if(!f)return;const d=document.createElement('div');d.innerHTML=html;f.appendChild(d);while(f.children.length>4)f.firstChild.remove();setTimeout(()=>d.remove(),4100);}
function escH(x){return String(x).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[c]);}
function juiceAssist(n){const now=t;JU.deaths=JU.deaths.filter(x=>now-x<180);const d=JU.deaths.length;
  if(n>=100)return n;return n*(d>=6?.7:d>=4?.8:d>=2?.9:1);}
function skipBtnShow(on){const b=$('#skipBtn');if(b)b.hidden=!on;}
function skipStage(){const next=state.stage+1;const cp=W.parts.find(p=>p.kind==='check'&&p.data&&p.data.stage===next&&!p.destroyed);skipBtnShow(false);JU.stageDeaths=0;
  if(!cp||P.dead)return;state.skipped=true;P.pos.set(cp.pos.x,cp.max.y+PH.y+.5,cp.pos.z);P.vel.set(0,0,0);toast('Skipped to stage '+next+'. You can do it!','#ffd75e',2);}
function juiceReset(){{const hb=$('#helpBtn');if(hb)hb.hidden=true;}if(game)game._help=null;{const q=$('#bq');if(q)q.hidden=true;}JU.stageDeaths=0;skipBtnShow(false);JU.bossOn=false;JU.bossR=null;{const b=$('#jboss');if(b)b.classList.remove('on');}JU.nums.forEach(n=>n.el.remove());JU.nums=[];JU.kos=[];JU.streak=0;JU.deaths=[];JU.shake=0;const f=$('#jfeed');if(f)f.textContent='';}
function loop(){
  requestAnimationFrame(loop);
  const dt=Math.min(clock.getDelta(),.05);
  if(running){
    if(!paused)update(dt);
    updateCamera(dt);juiceTick(dt);
    setParticleScale(renderer,camera);
    renderer.render(scene,camera);
  }else if(ED.open)studioFrame(dt);
}

/* =====================================================================
   BRICKYARD STUDIO
   ===================================================================== */
const SERVICES=[{id:'workspace',name:'Workspace',ico:'W'},{id:'lighting',name:'Lighting',ico:'L'},{id:'rs',name:'ReplicatedStorage',ico:'RS'},{id:'pack',name:'StarterPack',ico:'SP'},{id:'gui',name:'StarterGui',ico:'SG'},{id:'sss',name:'ServerScriptService',ico:'S'},{id:'player',name:'StarterPlayer',ico:'P'}];
const isService=id=>SERVICES.some(s=>s.id===id);
const BEHAVIORS=[['none','None'],['spawn','Spawn point'],['kill','Kill brick'],['check','Checkpoint'],['jump','Jump pad'],['speed','Speed pad'],['coin','Coin'],['finish','Finish line']];
const SHAPES=[['block','Block'],['ball','Ball'],['cyl','Cylinder'],['wedge','Wedge']];
const ED={open:false,proj:null,sel:[],tool:'move',snap:true,mSnap:1,rSnap:15,space:'world',hist:[],hi:-1,expanded:new Set(['workspace','sss']),meshes:new Map(),
  tabs:[],tab:'viewport',ws:null,clip:null,emitters:[],rigs:[],assets:[],cam:{pos:new V3(46,38,52),yaw:.72,pitch:-.48},helpers:[],keys:new Set(),saveTimer:0,pd:null,ecv:$('#ecv'),
  rename:null,drag:null,fly:0,gizmoMoved:false,pivotLast:new V3(),loadingWs:false};
let erenderer=null,escene=null,ecam=null,eworld=null,tc=null,epivot=null,esun=null;
function nodeOf(id){return ED.proj?ED.proj.nodes.find(n=>n.id===id):null;}
function kidsOf(id){return ED.proj.nodes.filter(n=>n.parent===id);}
function isAncestor(aId,nId){let n=nodeOf(nId);while(n){if(n.parent===aId)return true;n=nodeOf(n.parent);}return false;}
const isBody=n=>n&&(n.cls==='Part'||n.cls==='Rig');
function partsUnder(ids){const out=new Set();ids.forEach(id=>{const n=nodeOf(id);if(isBody(n))out.add(n);descendantsOf(ED.proj,id).forEach(d=>{if(isBody(d))out.add(d);});});return [...out];}

function initStudio3D(){
  if(erenderer)return;
  erenderer=new THREE.WebGLRenderer({canvas:ED.ecv,antialias:true});
  erenderer.setPixelRatio(Math.min(devicePixelRatio,2));erenderer.shadowMap.enabled=true;
  escene=new THREE.Scene();
  ecam=new THREE.PerspectiveCamera(70,1,.1,4000);
  escene.add(new THREE.HemisphereLight(0xffffff,0x46506a,.8));
  esun=new THREE.DirectionalLight(0xffffff,.8);esun.position.set(80,160,60);esun.castShadow=true;esun.shadow.mapSize.set(2048,2048);
  const sc=esun.shadow.camera;sc.left=-160;sc.right=160;sc.top=160;sc.bottom=-160;sc.far=500;esun.shadow.bias=-.0008;
  escene.add(esun);
  eworld=new THREE.Group();escene.add(eworld);
  epivot=new THREE.Object3D();escene.add(epivot);
  if(THREE.TransformControls){
    tc=new THREE.TransformControls(ecam,ED.ecv);tc.setSize(coarse?1.3:1);
    tc.addEventListener('objectChange',onGizmoChange);
    tc.addEventListener('mouseDown',()=>{ED.gizmoMoved=false;ED.pivotLast.copy(epivot.position);ED.grp=tc.object===epivot?groupStart():null;});
    tc.addEventListener('mouseUp',()=>{const wasGrp=!!ED.grp;ED.grp=null;if(ED.gizmoMoved){commit();renderProps();}ED.gizmoMoved=false;if(wasGrp)refreshGizmo();});
    escene.add(tc);
  }else logOut('The move/scale/rotate handles could not load. You can still edit Position, Size and Orientation in Properties.','warn');
  const ro=new ResizeObserver(()=>resizeStudio());ro.observe($('#stView'));
}
function resizeStudio(){const el=$('#stView');const w=el.clientWidth,h=el.clientHeight;if(!w||!h)return;erenderer.setSize(w,h,false);ecam.aspect=w/h;ecam.updateProjectionMatrix();
  if(ED.ws&&window.Blockly)Blockly.svgResize(ED.ws);}

function openStudio(proj){
  ED.proj=proj;ED.sel=[];ED.tabs=[];ED.tab='viewport';ED.hist=[];ED.hi=-1;
  if(innerWidth<700){$('#stOut').classList.add('min');$('#outToggle').textContent='Show';}
  if(!proj.settings)proj.settings=defaultSettings();
  $('#menu').hidden=true;$('#studio').hidden=false;ED.open=true;
  initStudio3D();
  const sp=proj.nodes.find(n=>n.behavior==='spawn');
  const c=sp?new V3(...sp.pos):new V3();
  ED.cam.yaw=.72;ED.cam.pitch=-.48;ED.cam.pos.set(c.x+36,c.y+34,c.z+40);
  $('#stName').value=proj.name;
  commit(true);
  refreshAll();setTool(ED.tool);updateSnapUI();
  ensureMeshes(proj).then(()=>{if(ED.proj===proj){rebuildWorld();refreshGizmo();}});loadAssetList();
  requestAnimationFrame(()=>{resizeStudio();ED.ecv.focus({preventScroll:true});});
  $('#outLog').innerHTML='';OUT.length=0;
  logOut('Opened '+proj.name+'. Press Play to test it.','sys');
}
function closeStudio(){
  saveNow(true);ED.open=false;$('#studio').hidden=true;$('#menu').hidden=false;if(tc)tc.detach();renderCards();
}
function refreshAll(){rebuildWorld();renderExplorer();renderProps();renderTabs();refreshGizmo();if(ED.tab==='gui')renderGuiEditor();}

/* ---- history & saving ---- */
function snapshot(){return JSON.stringify({name:ED.proj.name,settings:ED.proj.settings,nodes:ED.proj.nodes});}
function commit(initial){const s=snapshot();if(!initial&&ED.hist[ED.hi]===s)return;ED.hist=ED.hist.slice(0,ED.hi+1);ED.hist.push(s);if(ED.hist.length>100)ED.hist.shift();ED.hi=ED.hist.length-1;if(!initial)scheduleSave();updateUndoUI();}
function restore(s){const o=JSON.parse(s);ED.proj.name=o.name;ED.proj.settings=o.settings;ED.proj.nodes=o.nodes;$('#stName').value=o.name;
  ED.sel=ED.sel.filter(id=>isService(id)||nodeOf(id));ED.tabs=ED.tabs.filter(id=>nodeOf(id));if(ED.tab!=='viewport'&&ED.tab!=='gui'&&!nodeOf(ED.tab))ED.tab='viewport';
  refreshAll();if(ED.tab==='gui')renderGuiEditor();else if(ED.tab!=='viewport')loadScriptToWs(nodeOf(ED.tab));scheduleSave();updateUndoUI();}
function undo(){if(ED.hi<=0)return;ED.hi--;restore(ED.hist[ED.hi]);}
function redo(){if(ED.hi>=ED.hist.length-1)return;ED.hi++;restore(ED.hist[ED.hi]);}
function updateUndoUI(){const u=$('[data-act="undo"]'),r=$('[data-act="redo"]');u.disabled=ED.hi<=0;r.disabled=ED.hi>=ED.hist.length-1;}
function scheduleSave(){$('#stSaved').textContent='Saving…';clearTimeout(ED.saveTimer);ED.saveTimer=setTimeout(()=>saveNow(false),600);}
function saveNow(thumb){clearTimeout(ED.saveTimer);if(!ED.proj)return;if(thumb)captureThumb();const ok=saveProject(ED.proj);
  $('#stSaved').textContent=ok?'Saved':'Not saved: browser storage is full';if(!ok)logOut('Saving failed because browser storage is full. Delete an old game from the launcher to free space.','err');}
function captureThumb(){try{if(!erenderer)return;if(tc)tc.visible=false;ED.helpers.forEach(h=>h.visible=false);erenderer.render(escene,ecam);
  const src=erenderer.domElement;const c=document.createElement('canvas');c.width=320;c.height=180;const g=c.getContext('2d');
  const sw=src.width,sh=src.height,ar=16/9;let w=sw,h=sw/ar;if(h>sh){h=sh;w=sh*ar;}g.drawImage(src,(sw-w)/2,(sh-h)/2,w,h,0,0,320,180);
  ED.proj.thumb=c.toDataURL('image/jpeg',.72);if(tc)tc.visible=true;ED.helpers.forEach(h=>h.visible=true);}catch(e){}}

/* ---- viewport world ---- */
function makePartMesh(n){
  let geo,m;
  if(n.behavior==='coin'){geo=COIN;m=COINMAT;}
  else{const vc=n.shape==='mesh'&&!!(MESHINFO.get(n.meshId)||{}).vc;
    geo=n.shape==='ball'?SPH:n.shape==='cyl'?CYLX:n.shape==='wedge'?WEDGE:n.shape==='mesh'?(MESHCACHE.get(n.meshId)||BOX):BOX;
    m=lookMat({color:n.color,material:n.material,transparency:Math.min(.85,n.transparency||0),neon:n.behavior==='kill',vc},n.size);}
  const mesh=new THREE.Mesh(geo,m);
  mesh.position.fromArray(n.pos);
  if(n.behavior==='coin')mesh.scale.set(1,1,1);else mesh.scale.fromArray(n.size);
  const r=n.rot||[0,0,0];mesh.rotation.set(r[0]*D2R,r[1]*D2R,r[2]*D2R,'YXZ');
  mesh.castShadow=(n.transparency||0)<.5;mesh.receiveShadow=true;mesh.userData.id=n.id;
  return mesh;
}
function rebuildWorld(){
  const attachedId=tc&&tc.object&&tc.object.userData.id;
  eworld.traverse(m=>{if(m.material&&!m.material.userData.shared){if(m.material.map)m.material.map.dispose();m.material.dispose();}});
  eworld.clear();ED.meshes.clear();
  ED.emitters.forEach(e=>e.dispose());ED.emitters=[];ED.rigs=[];
  const wl=descendantsOf(ED.proj,'workspace');
  for(const n of wl){
    if(n.cls==='Part'){const m=makePartMesh(n);eworld.add(m);ED.meshes.set(n.id,m);if(n.label){const sp=textSprite(n.label);sp.scale.multiplyScalar(.8);sp.position.set(n.pos[0],n.pos[1]+n.size[1]/2+.9+sp.scale.y/2,n.pos[2]);eworld.add(sp);}}
    else if(n.cls==='Rig'){const g=makeRigMesh(n);g.position.fromArray(n.pos);g.rotation.set(0,((n.rot||[0,0,0])[1]||0)*D2R,0);eworld.add(g);ED.meshes.set(n.id,g);ED.rigs.push({g,n,ph:Math.random()*5});}
  }
  for(const n of wl)if(n.cls==='ParticleEmitter'){const pm=ED.meshes.get(n.parent);if(pm){const e=new Emitter(n,{mesh:pm,rig:(nodeOf(n.parent)||{}).cls==='Rig',destroyed:false},escene);e.nodeId=n.id;ED.emitters.push(e);}}
  const S=ED.proj.settings;escene.background=new THREE.Color(S.sky);escene.fog=new THREE.Fog(new THREE.Color(S.sky),Math.min(200,S.fog*.25),S.fog*1.6);
  if(attachedId&&tc)refreshGizmo();
  rebuildHelpers();
}
function rebuildHelpers(){
  ED.helpers.forEach(h=>{escene.remove(h);h.geometry.dispose();});ED.helpers=[];
  for(const n of partsUnder(ED.sel)){const m=ED.meshes.get(n.id);if(!m)continue;const h=new THREE.BoxHelper(m,0x5cc8ff);escene.add(h);ED.helpers.push(h);}
}
function refreshGizmo(){
  if(!tc)return;
  tc.detach();
  if(ED.tool==='select'||!ED.sel.length)return;
  const nodes=ED.sel.map(nodeOf).filter(Boolean);
  if(nodes.length===1&&isBody(nodes[0])){const m=ED.meshes.get(nodes[0].id);if(!m)return;tc.setMode(ED.tool==='scale'?'scale':ED.tool==='rotate'?'rotate':'translate');
    tc.setSpace(ED.tool==='scale'?'local':ED.space);tc.attach(m);return;}
  const parts=partsUnder(ED.sel);if(!parts.length)return;
  const bb=new THREE.Box3();parts.forEach(n=>{const m=ED.meshes.get(n.id);if(m)bb.expandByObject(m);});
  bb.getCenter(epivot.position);epivot.rotation.set(0,0,0);epivot.scale.set(1,1,1);epivot.userData.id=null;
  tc.setMode(ED.tool==='scale'?'scale':ED.tool==='rotate'?'rotate':'translate');tc.setSpace('world');tc.attach(epivot);
}
function snapV(v,s){return Math.round(v/s)*s;}
/* Rotating or scaling several parts at once turns/scales them around the centre of the selection. */
function groupStart(){epivot.quaternion.identity();epivot.scale.set(1,1,1);
  return {c:epivot.position.clone(),items:partsUnder(ED.sel).map(n=>{const r=n.rot||[0,0,0];
    return {n,pos:new V3().fromArray(n.pos),q:new THREE.Quaternion().setFromEuler(new THREE.Euler(r[0]*D2R,r[1]*D2R,r[2]*D2R,'YXZ')),size:(n.size||[1,1,1]).slice(),scale:n.scale||1};})};}
function applyGroupRotation(G,q){
  for(const it of G.items){const n=it.n;const p=it.pos.clone().sub(G.c).applyQuaternion(q).add(G.c);n.pos=p.toArray().map(r3);
    const nq=q.clone().multiply(it.q);const e=new THREE.Euler().setFromQuaternion(nq,'YXZ');
    n.rot=n.cls==='Rig'?[0,r3(e.y/D2R),0]:[r3(e.x/D2R),r3(e.y/D2R),r3(e.z/D2R)];
    const m=ED.meshes.get(n.id);if(m){m.position.fromArray(n.pos);if(n.cls==='Rig')m.rotation.set(0,n.rot[1]*D2R,0);else m.rotation.set(n.rot[0]*D2R,n.rot[1]*D2R,n.rot[2]*D2R,'YXZ');}}
}
function applyGroupScale(G,f){
  for(const it of G.items){const n=it.n;n.pos=it.pos.clone().sub(G.c).multiplyScalar(f).add(G.c).toArray().map(r3);const m=ED.meshes.get(n.id);if(!m)continue;m.position.fromArray(n.pos);
    if(n.cls==='Rig'){n.scale=r3(Math.max(.3,Math.min(8,it.scale*f)));m.scale.setScalar(n.scale);}
    else if(n.behavior!=='coin'){n.size=it.size.map(v=>r3(Math.max(.2,v*f)));m.scale.fromArray(n.size);}}
}
function turnSelection(axis){
  const parts=partsUnder(ED.sel);if(!parts.length){logOut('Select some parts or models first.','warn');return;}
  const bb=new THREE.Box3();parts.forEach(n=>{const m=ED.meshes.get(n.id);if(m)bb.expandByObject(m);else bb.expandByPoint(new V3().fromArray(n.pos));});
  const c=new V3();bb.getCenter(c);epivot.position.copy(c);const G=groupStart();
  applyGroupRotation(G,new THREE.Quaternion().setFromAxisAngle(axis==='x'?new V3(1,0,0):new V3(0,1,0),Math.PI/2));
  commit();rebuildWorld();refreshGizmo();renderProps();ED.helpers.forEach(h=>h.update());
}
function onGizmoChange(){
  ED.gizmoMoved=true;
  const o=tc.object;if(!o)return;
  if(o===epivot&&ED.grp&&tc.mode==='rotate'){applyGroupRotation(ED.grp,epivot.quaternion);}
  else if(o===epivot&&ED.grp&&tc.mode==='scale'){const sc=epivot.scale;const f=[sc.x,sc.y,sc.z].reduce((a,v)=>Math.abs(v-1)>Math.abs(a-1)?v:a,1);applyGroupScale(ED.grp,Math.max(.05,Math.min(20,f)));}
  else if(o===epivot){const d=epivot.position.clone().sub(ED.pivotLast);ED.pivotLast.copy(epivot.position);
    for(const n of partsUnder(ED.sel)){n.pos=n.pos.map((v,i)=>r3(v+d.getComponent(i)));const m=ED.meshes.get(n.id);if(m)m.position.fromArray(n.pos);}
  }else{const n=nodeOf(o.userData.id);if(!n)return;
    if(n.cls==='Rig'){const sc=Math.max(.3,Math.min(8,tc.mode==='scale'?Math.max(o.scale.x,o.scale.y,o.scale.z):o.scale.x));o.scale.setScalar(sc);n.scale=r3(sc);
      if(tc.mode==='rotate'){const e=new THREE.Euler().setFromQuaternion(o.quaternion,'YXZ');o.rotation.set(0,e.y,0);}
      n.pos=o.position.toArray().map(r3);n.rot=[0,r3(o.rotation.y/D2R),0];ED.helpers.forEach(h=>h.update());updateTransformInputs();return;}
    if(n.behavior==='coin'){o.scale.set(1,1,1);}
    else{if(n.shape==='ball'){const s=Math.max(o.scale.x,o.scale.y,o.scale.z);o.scale.set(s,s,s);}
      o.scale.set(Math.max(.2,o.scale.x),Math.max(.2,o.scale.y),Math.max(.2,o.scale.z));n.size=o.scale.toArray().map(r3);}
    n.pos=o.position.toArray().map(r3);
    const e=new THREE.Euler().setFromQuaternion(o.quaternion,'YXZ');n.rot=[r3(e.x/D2R),r3(e.y/D2R),r3(e.z/D2R)];
  }
  ED.helpers.forEach(h=>h.update());
  updateTransformInputs();
}
function updateSnapUI(){
  $('#snapBtn').setAttribute('aria-pressed',ED.snap);
  if(tc){tc.setTranslationSnap(ED.snap?ED.mSnap:null);tc.setRotationSnap(ED.snap?ED.rSnap*D2R:null);tc.setScaleSnap(ED.snap?ED.mSnap:null);}
  $('#spaceBtn').innerHTML=`<span class="gl">${ED.space==='world'?'🌐':'⬚'}</span>${ED.space==='world'?'World':'Local'}`;
}
function setTool(t){ED.tool=t;document.querySelectorAll('[data-tool]').forEach(b=>{if(b.closest('#ribbon'))b.setAttribute('aria-pressed',b.dataset.tool===t);});refreshGizmo();}

/* ---- selection ---- */
function select(ids,additive){
  if(additive){ids.forEach(id=>{const i=ED.sel.indexOf(id);if(i>=0)ED.sel.splice(i,1);else ED.sel.push(id);});}
  else ED.sel=ids.slice();
  ED.sel.forEach(id=>{let n=nodeOf(id);while(n){ED.expanded.add(n.parent);n=nodeOf(n.parent);}});
  renderExplorer();renderProps();refreshGizmo();rebuildHelpers();
  const f=nodeOf(ED.sel[0]);if((isGuiNode(f)||ED.sel[0]==='gui')&&ED.tab!=='gui'&&!additive)switchTab('gui');else if(ED.tab==='gui')renderGuiEditor();
}
function viewportPick(e){
  const r=ED.ecv.getBoundingClientRect();ndc.set(((e.clientX-r.left)/r.width)*2-1,-((e.clientY-r.top)/r.height)*2+1);
  raycaster.setFromCamera(ndc,ecam);raycaster.far=4000;
  const ms=[...ED.meshes.values()].filter(m=>{const n=nodeOf(m.userData.id);return n&&!n.locked;});
  const hit=raycaster.intersectObjects(ms,true).find(h=>h.object.isMesh)||null;
  if(!hit){if(!e.shiftKey)select([]);return;}
  let id=hit.object.userData.id;
  if(!(e.altKey||e.ctrlKey||e.metaKey)){let n=nodeOf(id),top=null;while(n&&n.parent!=='workspace'){const p=nodeOf(n.parent);if(p&&(p.cls==='Model'||p.cls==='Tool'))top=p;n=p;}if(top)id=top.id;}
  select([id],e.shiftKey);
}

/* ---- Insert Object menu (the + on each Explorer row) ---- */
const INS_KINDS=[
  ['Parts','part','Part','P','Part'],['Parts','ball','Ball','P','Part'],['Parts','cyl','Cylinder','P','Part'],['Parts','wedge','Wedge','P','Part'],['Parts','mesh','MeshPart (from Assets)','MP','Part'],
  ['Gameplay','spawn','SpawnLocation','P','Part'],['Gameplay','kill','Kill brick','P','Part'],['Gameplay','check','Checkpoint','P','Part'],['Gameplay','jump','Jump pad','P','Part'],['Gameplay','speed','Speed pad','P','Part'],['Gameplay','coin','Coin','P','Part'],['Gameplay','finish','Finish','P','Part'],
  ['Containers','model','Model','M','Model'],['Containers','folder','Folder','F','Folder'],
  ['Scripting','script','Script','S','Script'],['Scripting','animation','Animation','◆','Animation'],
  ['Characters & effects','rig','Rig','R','Rig'],['Characters & effects','tool','Tool','⚔','Tool'],['Characters & effects','particles','ParticleEmitter','✦','ParticleEmitter'],
  ['GUI','gui-screen','ScreenGui','SG','ScreenGui'],['GUI','gui-frame','Frame','▭','Frame'],['GUI','gui-text','TextLabel','T','TextLabel'],['GUI','gui-button','TextButton','B','TextButton']];
function insertKindsFor(pid){
  const n=nodeOf(pid);const c=n?n.cls:null;let ok;
  const world=k=>['Part','Model','Folder','Script','Rig','Tool','Animation'].includes(k);
  if(pid==='lighting')ok=()=>false;
  else if(pid==='gui')ok=k=>k==='ScreenGui';
  else if(pid==='player')ok=k=>['Script','Animation','Folder'].includes(k);
  else if(pid==='pack')ok=k=>k==='Tool';
  else if(pid==='sss')ok=k=>['Script','Folder'].includes(k);
  else if(pid==='workspace'||pid==='rs')ok=world;
  else if(!n)ok=()=>false;
  else if(c==='ScreenGui'||c==='Frame'||c==='TextLabel'||c==='TextButton')ok=k=>['Frame','TextLabel','TextButton','Script'].includes(k);
  else if(c==='Folder'||c==='Model')ok=k=>world(k)||k==='ParticleEmitter'&&false;
  else if(c==='Part')ok=k=>['Script','ParticleEmitter'].includes(k);
  else if(c==='Rig')ok=k=>['Script','ParticleEmitter','Animation'].includes(k);
  else if(c==='Tool')ok=k=>['Part','Script','ParticleEmitter'].includes(k);
  else ok=()=>false;
  return INS_KINDS.filter(x=>ok(x[4])&&!(x[1]==='particles'&&c==='Tool')&&!(x[1]==='mesh'&&!['workspace','rs'].includes(pid)&&c!=='Folder'&&c!=='Model'&&c!=='Tool'));
}
let insState=null;
function showInsertMenu(pid,x,y){
  const kinds=insertKindsFor(pid);if(!kinds.length)return;const n=nodeOf(pid);const nm=n?n.name:(SERVICES.find(s=>s.id===pid)||{}).name||pid;
  let m=$('#insMenu');if(!m){m=document.createElement('div');m.id='insMenu';m.setAttribute('role','dialog');m.setAttribute('aria-label','Insert object');document.body.appendChild(m);}
  m.innerHTML=`<div class="ihead"><b>Insert into ${esc(nm)}</b><input type="search" placeholder="Search objects" aria-label="Search objects" autocomplete="off"></div><div class="ilist" role="listbox"></div>`;
  insState={pid,kinds,hl:0};m.hidden=false;
  const inp=m.querySelector('input'),list=m.querySelector('.ilist');
  const draw=()=>{const q=inp.value.trim().toLowerCase();const items=kinds.filter(k=>!q||k[2].toLowerCase().includes(q)||k[0].toLowerCase().includes(q)||k[4].toLowerCase().includes(q));insState.items=items;insState.hl=Math.min(insState.hl,Math.max(0,items.length-1));
    if(!items.length){list.innerHTML='<div class="inone">Nothing matches, or it can’t go inside '+esc(nm)+'.</div>';return;}
    let h='',sec='';items.forEach((k,i)=>{if(k[0]!==sec&&!q){sec=k[0];h+=`<div class="isec">${sec}</div>`;}
      h+=`<button class="iitem${i===insState.hl?' hl':''}" type="button" role="option" data-ik="${k[1]}"><span class="ico ${k[4]}">${k[3]}</span>${esc(k[2])}${k[2]!==k[4]&&k[4]!=='Part'?'':''}</button>`;});list.innerHTML=h;};
  draw();
  inp.addEventListener('input',()=>{insState.hl=0;draw();});
  inp.addEventListener('keydown',e=>{e.stopPropagation();const it=insState.items||[];
    if(e.key==='Escape'){e.preventDefault();closeInsertMenu();}
    else if(e.key==='ArrowDown'){e.preventDefault();insState.hl=Math.min(it.length-1,insState.hl+1);draw();}
    else if(e.key==='ArrowUp'){e.preventDefault();insState.hl=Math.max(0,insState.hl-1);draw();}
    else if(e.key==='Enter'){e.preventDefault();const k=it[insState.hl];if(k){closeInsertMenu();insertInto(k[1],pid);}}});
  list.addEventListener('click',e=>{const b=e.target.closest('[data-ik]');if(!b)return;closeInsertMenu();insertInto(b.dataset.ik,pid);});
  const r=m.getBoundingClientRect();m.style.left=Math.max(8,Math.min(x,innerWidth-r.width-8))+'px';m.style.top=Math.max(8,Math.min(y,innerHeight-r.height-8))+'px';
  setTimeout(()=>inp.focus(),0);
}
function closeInsertMenu(){const m=$('#insMenu');if(m)m.hidden=true;insState=null;}
document.addEventListener('pointerdown',e=>{if(insState&&!e.target.closest('#insMenu')&&!e.target.closest('[data-add]'))closeInsertMenu();});
function insertInto(kind,pid){
  const before=new Set(ED.proj.nodes.map(n=>n.id));const hi0=ED.hi;
  select([pid]);insert(kind);if(kind==='mesh')return;
  const fresh=ED.proj.nodes.filter(n=>!before.has(n.id));if(!fresh.length)return;
  const ids=new Set(fresh.map(n=>n.id));const tops=fresh.filter(n=>!ids.has(n.parent));
  const move=tops.filter(n=>n.parent!==pid);
  if(move.length){if(canParentTo(move.map(n=>n.id),pid)){move.forEach(n=>{n.parent=pid;});
      const pn=nodeOf(pid);if(pn&&pn.pos&&(pn.cls==='Part'||pn.cls==='Rig'))move.forEach(n=>{if(n.pos&&n.cls==='Part')n.pos=[pn.pos[0],r3(pn.pos[1]+(pn.size?pn.size[1]/2:2)+(n.size?n.size[1]/2:1)),pn.pos[2]];});
      if(ED.hi>hi0){ED.hist[ED.hi]=snapshot();}else commit();
      ED.expanded.add(pid);refreshAll();select(tops.map(n=>n.id));}
    else logOut('That can’t go inside '+((nodeOf(pid)||{}).name||pid)+', so it was added next to it.','warn');}
}

/* ---- explorer ---- */
function renderExplorer(){
  const el=$('#explorer');const by=new Map();
  for(const n of ED.proj.nodes){if(!by.has(n.parent))by.set(n.parent,[]);by.get(n.parent).push(n);}
  let h='';
  const row=(id,name,ico,icoCls,depth,hasKids,extra)=>{const sel=ED.sel.includes(id)?' sel':'';const open=ED.expanded.has(id);
    return `<div class="ex-row${sel}" data-id="${id}" draggable="${isService(id)?'false':'true'}" style="padding-left:${6+depth*14}px" role="treeitem" aria-selected="${!!sel}" aria-expanded="${hasKids?open:''}">`+
    `<button class="tw" data-tw="${id}" tabindex="-1" aria-label="Expand">${hasKids?(open?'▾':'▸'):''}</button><span class="ico ${icoCls}">${ico}</span>`+
    (ED.rename===id?`<input id="renameIn" value="${esc(name)}" aria-label="Rename">`:`<span class="nm${extra||''}">${esc(name)}</span>`)+
    (insertKindsFor(id).length?`<button class="exadd" type="button" data-add="${id}" tabindex="-1" title="Insert object into ${esc(name)}" aria-label="Insert object into ${esc(name)}">+</button>`:'')+`</div>`;};
  const walk=(pid,d)=>{for(const n of by.get(pid)||[]){const k=(by.get(n.id)||[]).length>0;
    const ic=n.cls==='Animation'?['◆','Animation']:n.cls==='ScreenGui'?['SG','ScreenGui']:n.cls==='Frame'?['▭','Frame']:n.cls==='TextLabel'?['T','TextLabel']:n.cls==='TextButton'?['B','TextButton']:n.cls==='Tool'?['⚔','Tool']:n.shape==='mesh'?['MP','MeshPart']:n.cls==='ParticleEmitter'?['✦','ParticleEmitter']:[n.cls[0],n.cls];
    h+=row(n.id,n.name,ic[0],ic[1],d,k,(n.cls==='Script'||n.cls==='ParticleEmitter')&&n.enabled===false?' off':'');if(k&&ED.expanded.has(n.id))walk(n.id,d+1);}};
  SERVICES.forEach(s=>{const k=(by.get(s.id)||[]).length>0;h+=row(s.id,s.name,s.ico,'svc',0,k);if(k&&ED.expanded.has(s.id))walk(s.id,1);});
  el.innerHTML=h;
  const ri=$('#renameIn');if(ri){ri.focus();ri.select();
    const done=ok=>{if(ED.rename==null)return;const n=nodeOf(ED.rename);ED.rename=null;if(ok&&n&&ri.value.trim()){n.name=ri.value.trim().slice(0,60);commit();renderTabs();renderProps();}renderExplorer();};
    ri.addEventListener('keydown',e=>{e.stopPropagation();if(e.key==='Enter')done(true);if(e.key==='Escape')done(false);});ri.addEventListener('blur',()=>done(true));}
}
const exEl=$('#explorer');
exEl.addEventListener('click',e=>{
  const ad=e.target.closest('[data-add]');if(ad){e.stopPropagation();const r=ad.getBoundingClientRect();showInsertMenu(ad.dataset.add,r.right+6,r.top);return;}
  const tw=e.target.closest('[data-tw]');if(tw){const id=tw.dataset.tw;ED.expanded.has(id)?ED.expanded.delete(id):ED.expanded.add(id);renderExplorer();return;}
  const r=e.target.closest('.ex-row');if(!r||e.target.id==='renameIn')return;select([r.dataset.id],e.shiftKey||e.ctrlKey||e.metaKey);closeDrawers(false);
});
exEl.addEventListener('dblclick',e=>{const r=e.target.closest('.ex-row');if(!r)return;const n=nodeOf(r.dataset.id);if(!n)return;
  if(n.cls==='Script')openScript(n.id);else if(n.cls==='Animation')openAnim(n.id);else{ED.rename=n.id;renderExplorer();}});
exEl.addEventListener('contextmenu',e=>{const r=e.target.closest('.ex-row');if(!r)return;e.preventDefault();if(!ED.sel.includes(r.dataset.id))select([r.dataset.id]);showCtx(e.clientX,e.clientY);});
exEl.addEventListener('dragstart',e=>{const r=e.target.closest('.ex-row');if(!r)return;ED.drag=ED.sel.includes(r.dataset.id)?ED.sel.filter(id=>!isService(id)):[r.dataset.id];e.dataTransfer.setData('text/plain','x');e.dataTransfer.effectAllowed='move';});
function canParentTo(ids,target){
  if(target==='lighting')return false;
  if(target==='player'&&!ids.every(id=>['Script','Animation','Folder'].includes((nodeOf(id)||{}).cls)))return false;
  if(ids.some(id=>(nodeOf(id)||{}).cls==='Animation')){const tn0=nodeOf(target);if(tn0&&tn0.cls==='Part')return false;}
  const tn=nodeOf(target);const tGui=target==='gui'||isGuiNode(tn);
  const movingGui=ids.map(nodeOf).filter(Boolean);
  if(tGui){if(!movingGui.every(n=>isGuiNode(n)||n.cls==='Script'))return false;if(movingGui.some(n=>n.cls==='ScreenGui')&&target!=='gui')return false;if(target==='gui'&&movingGui.some(n=>n.cls!=='ScreenGui'))return false;}
  else if(movingGui.some(isGuiNode))return false;
  const t=nodeOf(target);if(t&&(t.cls==='Script'||t.cls==='ParticleEmitter'||t.cls==='Animation'))return false;
  if(target==='pack'&&!ids.every(id=>(nodeOf(id)||{}).cls==='Tool'))return false;
  return ids.every(id=>id!==target&&!isAncestor(id,target)&&(nodeOf(id)||{}).cls!==undefined);
}
exEl.addEventListener('dragover',e=>{const r=e.target.closest('.ex-row');exEl.querySelectorAll('.drop-in').forEach(x=>x.classList.remove('drop-in'));
  if(!r||!ED.drag||!canParentTo(ED.drag,r.dataset.id))return;e.preventDefault();r.classList.add('drop-in');});
exEl.addEventListener('dragleave',e=>{const r=e.target.closest('.ex-row');if(r)r.classList.remove('drop-in');});
exEl.addEventListener('drop',e=>{e.preventDefault();const r=e.target.closest('.ex-row');exEl.querySelectorAll('.drop-in').forEach(x=>x.classList.remove('drop-in'));
  if(!r||!ED.drag||!canParentTo(ED.drag,r.dataset.id))return;ED.drag.forEach(id=>{const n=nodeOf(id);if(n)n.parent=r.dataset.id;});ED.expanded.add(r.dataset.id);ED.drag=null;commit();refreshAll();});
exEl.addEventListener('dragend',()=>{ED.drag=null;});

/* ---- context menu ---- */
function showCtx(x,y){
  const id=ED.sel[0];const n=nodeOf(id);const m=$('#ctxMenu');let h='';
  const it=(act,label,key)=>`<button type="button" data-act="${act}">${label}${key?`<span>${key}</span>`:''}</button>`;
  if(n){h+=it('rename','Rename','F2');if(n.cls==='Animation')h+=it('openanim','Edit animation');if(n.cls==='Script')h+=it('openscript','Edit blocks')+it('toggleScript',n.enabled===false?'Enable':'Disable');
    h+=it('dup','Duplicate','Ctrl+D')+it('copy','Copy','Ctrl+C')+it('paste','Paste into','Ctrl+V')+it('del','Delete','Del')+'<hr>';
    if(n.cls!=='Script')h+=it('group','Group','Ctrl+G');if(n.cls==='Model'||n.cls==='Folder')h+=it('ungroup','Ungroup','Ctrl+U');
    if(insertKindsFor(id).length)h+=it('ins-obj','Insert object…','Ctrl+I');h+=it('ins-script','Insert script')+it('focus','Zoom to','F');}
  else if(id==='player')h+=it('ins-script','Insert script')+it('ins-anim','Insert animation')+it('paste','Paste into','Ctrl+V');
  else if(id==='workspace'||id==='sss')h+=it('ins-script','Insert script')+it('paste','Paste into','Ctrl+V')+(id==='workspace'?it('ins-folder','Insert folder'):'');
  else return;
  m.innerHTML=h;m.hidden=false;const W_=innerWidth,H_=innerHeight;const r=m.getBoundingClientRect();
  m.style.left=Math.min(x,W_-r.width-8)+'px';m.style.top=Math.min(y,H_-r.height-8)+'px';
}
document.addEventListener('pointerdown',e=>{if(!e.target.closest('#ctxMenu'))$('#ctxMenu').hidden=true;});
$('#ctxMenu').addEventListener('click',e=>{const b=e.target.closest('[data-act]');if(!b)return;$('#ctxMenu').hidden=true;doAct(b.dataset.act);});

/* ---- actions ---- */
function targetParent(forScript,allowTool){
  if(ED.sel[0]==='rs')return 'rs';
  const n=nodeOf(ED.sel[0]);
  if(forScript&&ED.sel[0]==='player')return 'player';
  if(n&&n.cls==='Animation'){if(forScript)return n.parent;const pp=nodeOf(n.parent);return pp&&['Folder','Model'].includes(pp.cls)?pp.id:'workspace';}
  if(forScript){if(n&&n.cls==='ParticleEmitter')return n.parent;if(n&&n.cls!=='Script')return n.id;if(n&&n.cls==='Script')return n.parent;if(ED.sel[0]==='workspace')return 'workspace';return 'sss';}
  const okC=c=>c==='Folder'||c==='Model'||(allowTool&&c==='Tool');
  if(n&&okC(n.cls))return n.id;
  if(n&&n.cls==='Part'&&n.parent!=='workspace'){const p=nodeOf(n.parent);if(p&&okC(p.cls))return p.id;if(p&&p.cls==='Tool')return serviceOf(ED.proj,p.id)==='workspace'?'workspace':serviceOf(ED.proj,p.id);}
  if(n&&n.cls==='Tool')return serviceOf(ED.proj,n.id)==='workspace'?'workspace':'workspace';
  return 'workspace';
}
function dropPoint(size){
  const dir=camForward();raycaster.set(ED.cam.pos,dir);raycaster.far=600;
  const hit=raycaster.intersectObjects([...ED.meshes.values()],false)[0];
  let p;
  if(hit&&hit.distance<300){const nrm=hit.face.normal.clone().transformDirection(hit.object.matrixWorld);p=hit.point.clone();
    if(nrm.y>.5)p.y+=size[1]/2;else p.addScaledVector(nrm,Math.max(size[0],size[2])/2);}
  else p=ED.cam.pos.clone().addScaledVector(dir,24);
  const s=ED.snap?ED.mSnap:.5;
  return [snapV(p.x,s),r3(p.y),snapV(p.z,s)];
}
function nextStage(){let m=0;ED.proj.nodes.forEach(n=>{if(n.behavior==='check')m=Math.max(m,n.value||0);});return m+1;}
const PRESETS={
  part:()=>({name:'Part',size:[4,1,2]}),
  ball:()=>({name:'Ball',shape:'ball',size:[4,4,4]}),
  cyl:()=>({name:'Cylinder',shape:'cyl',size:[2,4,4]}),
  wedge:()=>({name:'Wedge',shape:'wedge',size:[4,2,4]}),
  spawn:()=>({name:'SpawnLocation',size:[12,1,12],color:'#56627e',material:'Studs',behavior:'spawn'}),
  kill:()=>({name:'KillBrick',size:[8,1,8],color:'#ff3b30',material:'Neon',behavior:'kill'}),
  check:()=>({name:'Checkpoint',size:[10,1,10],color:'#3ddc84',behavior:'check',value:nextStage()}),
  jump:()=>({name:'JumpPad',size:[4,.4,4],color:'#22d3ee',material:'Neon',behavior:'jump',value:100}),
  speed:()=>({name:'SpeedPad',size:[6,.4,5],color:'#ffd400',material:'Neon',behavior:'speed',value:2.6}),
  coin:()=>({name:'Coin',shape:'cyl',size:[.3,2.3,2.3],color:'#ffc72c',behavior:'coin'}),
  finish:()=>({name:'Finish',size:[14,1,14],color:'#ffc93c',material:'Metal',behavior:'finish'})
};
function rigNode(o){return Object.assign({id:uid(),cls:'Rig',name:'Rig',parent:'workspace',pos:[0,2.6,0],rot:[0,0,0],scale:1,
  colors:{head:'#f5cd30',torso:'#1e88e5',arms:'#f5cd30',legs:'#2b3a7a'},anim:'idle',walkSpeed:12,showName:true},o);}
function emitterNode(o,preset){return Object.assign({id:uid(),cls:'ParticleEmitter',name:'ParticleEmitter',parent:'workspace',enabled:true,preset:preset||'sparkles'},PPRESETS[preset||'sparkles'],o);}
function insertedNote(n){if(serviceOf(ED.proj,n.id)==='rs')logOut('Added '+n.name+' to ReplicatedStorage. It stays out of the world until a script copies it in with a Storage block.','sys');else logOut('Inserted '+n.name+'.','sys');}
function insert(kind){
  if(kind==='mesh'){showPane('assets');if(innerWidth<=900){closeDrawers();$('#stLeft').classList.add('open');$('#scrim').classList.add('on');}if(!ED.assets.length)$('#meshFile').click();return;}
  if(kind==='animation'){
    let par='player';const s0=nodeOf(ED.sel[0]);
    if(ED.sel[0]==='rs'||ED.sel[0]==='player')par=ED.sel[0];else if(s0&&['Rig','Folder','Model'].includes(s0.cls))par=s0.id;else if(s0&&s0.cls==='Animation')par=s0.parent;
    const n={id:uid(),cls:'Animation',name:nextName('Animation'),parent:par,length:2,loop:false,speed:1,stopOnMove:false,keys:[AK(0,{}),AK(1,{RightArm:[0,0,150]}),AK(2,{})]};
    ED.proj.nodes.push(n);ED.expanded.add(par);commit();refreshAll();select([n.id]);openAnim(n.id);
    logOut('Added an Animation. Move the playhead, press + Keyframe and drag the sliders to pose the character.','sys');return;}
  if(kind==='gui-screen'){const g=guiNode('ScreenGui',{name:nextName('ScreenGui')});ED.proj.nodes.push(g);ED.expanded.add('gui');commit();refreshAll();select([g.id]);return;}
  if(kind.startsWith('gui-')){const cls={'gui-text':'TextLabel','gui-button':'TextButton','gui-frame':'Frame'}[kind];const out=[];
    let par=null;const s0=nodeOf(ED.sel[0]);
    if(s0&&(s0.cls==='ScreenGui'||s0.cls==='Frame'))par=s0.id;else if(s0&&isGuiNode(s0))par=s0.parent;
    if(!par){const sg=ED.proj.nodes.find(n=>n.cls==='ScreenGui'&&n.parent==='gui');if(sg)par=sg.id;else{const g=guiNode('ScreenGui',{name:'MainGui'});out.push(g);par=g.id;}}
    const n=guiNode(cls,{parent:par,name:nextName(cls)});const cnt=ED.proj.nodes.filter(x=>x.parent===par).length;n.gpos=[0,24+cnt*16,0,120+cnt*16];out.push(n);
    ED.proj.nodes.push(...out);ED.expanded.add('gui');ED.expanded.add(par);commit();refreshAll();select([n.id]);logOut('Added a '+cls+'. Drag it on the GUI tab, and edit its text in Properties.','sys');return;}
  if(kind==='tool'){const tn={id:uid(),cls:'Tool',name:nextName('Tool'),parent:'workspace',tooltip:'',cooldown:.3,swing:true,handle:null};
    const h=partNode({parent:tn.id,name:'Handle',size:[.5,.5,3],color:'#8d6e63'});const pnt=dropPoint([1,1,3]);h.pos=[pnt[0],r3(pnt[1]+2.5),pnt[2]];tn.handle=h.id;
    ED.proj.nodes.push(tn,h);ED.expanded.add(tn.id);commit();refreshAll();select([tn.id]);
    logOut('Inserted a Tool. Add parts inside it to shape it. The front of the tool points toward -Z. Leave it in Workspace as a pickup, or drag it into StarterPack so players start with it.','sys');return;}
  if(kind==='rig'){const n=rigNode({parent:targetParent()});n.pos=dropPoint([4,5.2,1.2]);n.name=nextName('Rig');ED.proj.nodes.push(n);commit();refreshAll();select([n.id]);insertedNote(n);return;}
  if(kind==='particles'){let par=null;const s0=nodeOf(ED.sel[0]);
    if(s0&&(s0.cls==='Part'||s0.cls==='Rig'))par=s0.id;else if(s0&&s0.cls==='ParticleEmitter')par=s0.parent;
    const out=[];if(!par){const h=partNode({name:'ParticlePart',parent:targetParent(),size:[2,1,2],transparency:1,canCollide:false});h.pos=dropPoint(h.size);out.push(h);par=h.id;}
    const e=emitterNode({parent:par},'sparkles');out.push(e);ED.proj.nodes.push(...out);ED.expanded.add(par);commit();refreshAll();select([e.id]);logOut('Added a ParticleEmitter. Pick a preset in Properties.','sys');return;}

  if(kind==='folder'||kind==='model'){const g=groupNode(kind==='folder'?'Folder':'Model',{parent:targetParent()});ED.proj.nodes.push(g);commit();refreshAll();select([g.id]);return;}
  if(kind==='script'){const par=targetParent(true);const pn=nodeOf(par);
    const s=scriptNode({parent:par,blocks:pn&&pn.cls==='Part'?SCR.touchDefault():SCR.startDefault()});ED.proj.nodes.push(s);ED.expanded.add(par);commit();refreshAll();select([s.id]);openScript(s.id);return;}
  const o=PRESETS[kind]();const n=partNode(Object.assign(o,{parent:targetParent(false,['part','ball','cyl','wedge'].includes(kind))}));
  n.pos=dropPoint(n.behavior==='coin'?[2.3,2.3,2.3]:n.size);if(n.behavior==='coin')n.pos[1]=r3(n.pos[1]+1.5);
  ED.proj.nodes.push(n);commit();refreshAll();select([n.id]);
  insertedNote(n);
}
function nextName(base){const names=new Set(ED.proj.nodes.map(n=>n.name));if(!names.has(base))return base;let i=2;while(names.has(base+i))i++;return base+i;}
function cloneNodes(ids){
  const roots=ids.map(nodeOf).filter(n=>n&&!ids.includes(n.parent));const all=[];
  const copy=(n,par)=>{const c=JSON.parse(JSON.stringify(n));c.id=uid();c.parent=par;all.push(c);kidsOf(n.id).forEach(k=>copy(k,c.id));return c;};
  const tops=roots.map(n=>copy(n,n.parent));return {tops,all};
}
function duplicate(){
  const ids=ED.sel.filter(id=>!isService(id));if(!ids.length)return;
  const {tops,all}=cloneNodes(ids);
  const parts=all.filter(n=>n.cls==='Part'||n.cls==='Rig');let h=0;
  const bb=new THREE.Box3();ids.forEach(id=>partsUnder([id]).forEach(n=>{const m=ED.meshes.get(n.id);if(m)bb.expandByObject(m);}));
  if(!bb.isEmpty())h=r3(bb.max.y-bb.min.y);
  parts.forEach(n=>{n.pos=[n.pos[0],r3(n.pos[1]+h),n.pos[2]];});
  ED.proj.nodes.push(...all);commit();refreshAll();select(tops.map(n=>n.id));
}
function copySel(){const ids=ED.sel.filter(id=>!isService(id));if(!ids.length)return;ED.clip=JSON.stringify(cloneNodes(ids).all.map(n=>n));logOut('Copied '+ids.length+' item'+(ids.length>1?'s':'')+'.','sys');}
function paste(){
  if(!ED.clip)return;const arr=JSON.parse(ED.clip);const map=new Map();arr.forEach(n=>map.set(n.id,uid()));
  const par=ED.sel[0]&&(isService(ED.sel[0])?(ED.sel[0]==='sss'||ED.sel[0]==='workspace'?ED.sel[0]:'workspace'):((nodeOf(ED.sel[0])||{}).cls==='Script'?'workspace':ED.sel[0]))||'workspace';
  const tops=[];arr.forEach(n=>{const top=!map.has(n.parent);n.id=map.get(n.id);n.parent=top?par:map.get(n.parent);if(top)tops.push(n.id);});
  ED.proj.nodes.push(...arr);ED.expanded.add(par);commit();refreshAll();select(tops);
}
function del(){
  const ids=ED.sel.filter(id=>!isService(id));if(!ids.length)return;
  const gone=new Set();ids.forEach(id=>{gone.add(id);descendantsOf(ED.proj,id).forEach(d=>gone.add(d.id));});
  ED.proj.nodes=ED.proj.nodes.filter(n=>!gone.has(n.id));ED.tabs=ED.tabs.filter(id=>!gone.has(id));if(gone.has(ED.tab))switchTab('viewport');
  ED.sel=[];commit();refreshAll();
}
function group(){
  const ids=ED.sel.filter(id=>{const n=nodeOf(id);return n&&n.cls!=='Script';});if(!ids.length)return;
  const first=nodeOf(ids[0]);const m=groupNode('Model',{parent:first.parent});
  ED.proj.nodes.push(m);ids.forEach(id=>{const n=nodeOf(id);if(!ids.includes(n.parent))n.parent=m.id;});ED.expanded.add(m.parent);commit();refreshAll();select([m.id]);
}
function ungroup(){
  const out=[];ED.sel.forEach(id=>{const n=nodeOf(id);if(!n||(n.cls!=='Model'&&n.cls!=='Folder'))return;kidsOf(n.id).forEach(k=>{k.parent=n.parent;out.push(k.id);});ED.proj.nodes=ED.proj.nodes.filter(x=>x!==n);});
  if(!out.length)return;commit();refreshAll();select(out);
}
function camForward(){const c=Math.cos(ED.cam.pitch);return new V3(-Math.sin(ED.cam.yaw)*c,Math.sin(ED.cam.pitch),-Math.cos(ED.cam.yaw)*c);}
function focusSel(){
  const parts=partsUnder(ED.sel.length?ED.sel:['workspace']);if(!parts.length)return;
  const bb=new THREE.Box3();parts.forEach(n=>{const m=ED.meshes.get(n.id);if(m)bb.expandByObject(m);});
  const c=bb.getCenter(new V3()),r=Math.min(400,Math.max(6,bb.getSize(new V3()).length()*.75));
  ED.cam.pos.copy(c).addScaledVector(camForward(),-r);
}
function doAct(a){
  switch(a){
    case 'undo':undo();break;case 'redo':redo();break;case 'copy':copySel();break;case 'paste':paste();break;
    case 'ins-obj':{const id=ED.sel[0]||'workspace';const row=exEl.querySelector(`.ex-row[data-id="${id}"]`);const r=row?row.getBoundingClientRect():{right:innerWidth/2-130,top:innerHeight/3};showInsertMenu(id,r.right+6,r.top);break;}
    case 'openanim':openAnim(ED.sel[0]);break;case 'ins-anim':insert('animation');break;
    case 'turn':turnSelection('y');break;case 'tilt':turnSelection('x');break;
    case 'dup':duplicate();break;case 'del':del();break;case 'group':group();break;case 'ungroup':ungroup();break;
    case 'snap':ED.snap=!ED.snap;updateSnapUI();break;
    case 'space':ED.space=ED.space==='world'?'local':'world';updateSnapUI();refreshGizmo();break;
    case 'export':showExport();break;case 'focus':focusSel();break;
    case 'rename':if(nodeOf(ED.sel[0])){ED.rename=ED.sel[0];closeDrawers(false);if(innerWidth<=900)$('#stLeft').classList.add('open');renderExplorer();}break;
    case 'openscript':openScript(ED.sel[0]);break;
    case 'toggleScript':{const n=nodeOf(ED.sel[0]);if(n){n.enabled=n.enabled===false;commit();renderExplorer();renderProps();}break;}
    case 'ins-script':insert('script');break;case 'ins-folder':insert('folder');break;
  }
}
$('#ribbon').addEventListener('click',e=>{const b=e.target.closest('button');if(!b)return;
  if(b.dataset.act)doAct(b.dataset.act);else if(b.dataset.tool)setTool(b.dataset.tool);else if(b.dataset.ins)insert(b.dataset.ins);});
$('#mSnap').addEventListener('change',e=>{ED.mSnap=+e.target.value;updateSnapUI();});
$('#rSnap').addEventListener('change',e=>{ED.rSnap=+e.target.value;updateSnapUI();});
$('#stName').addEventListener('change',e=>{ED.proj.name=e.target.value.trim()||'Untitled game';e.target.value=ED.proj.name;commit();});
$('#stName').addEventListener('keydown',e=>{e.stopPropagation();if(e.key==='Enter')e.target.blur();});
$('#stBack').addEventListener('click',closeStudio);
$('#stPlay').addEventListener('click',playtest);
$('#stPlay2').addEventListener('click',playtest2);
/* ---- fake second player for testing: a second copy of Brickyard in a small window, linked to this one ---- */
let TEST2=null;
function makeLinkRoom(post,selfId,otherId){
  let mine={},other=null;const peerFns=[],topicFns={};
  const peerObj=(id,pr,me)=>({peer:id,by:me?null:(nickById(pr)||'nick:Player'),presence:pr||{},isMe:!!me,sameTab:!!me,kind:'viewer',guest:false,updatedAt:Date.now()});
  const list=()=>[peerObj(selfId,mine,true)].concat(other?[peerObj(otherId,other,false)]:[]);
  const fire=(j,l)=>{const peers=list();peerFns.forEach(f=>{try{f({peers,joined:j||[],left:l||[],updated:[]});}catch(e){}});};
  return {link:true,name:'test-link',
    recv(m){if(!m)return;if(m.k==='pres'){const isNew=!other;other=m.pr&&typeof m.pr==='object'?m.pr:{};if(isNew){try{post({k:'pres',pr:JSON.parse(JSON.stringify(mine))});}catch(e){}}fire(isNew?[peerObj(otherId,other,false)]:[]);}
      else if(m.k==='ev'&&typeof m.topic==='string')(topicFns[m.topic]||[]).forEach(f=>{try{f({topic:m.topic,data:m.data,peer:otherId,by:nickById(other),isMe:false,sameTab:false,kind:'viewer',guest:false});}catch(e){}});
      else if(m.k==='bye'&&other){const p=peerObj(otherId,other,false);other=null;fire([],[p]);}},
    emit:async(topic,data)=>{try{post({k:'ev',topic,data:JSON.parse(JSON.stringify(data??null))});}catch(e){}(topicFns[topic]||[]).forEach(f=>{try{f({topic,data,peer:selfId,by:null,isMe:true,sameTab:true,kind:'viewer',guest:false});}catch(e){}});},
    on:(topic,fn)=>{(topicFns[topic]=topicFns[topic]||[]).push(fn);return()=>{topicFns[topic]=(topicFns[topic]||[]).filter(x=>x!==fn);};},
    presence:async patch=>{const n=Object.assign({},mine,patch);for(const k in patch)if(patch[k]===null)delete n[k];mine=n;try{post({k:'pres',pr:JSON.parse(JSON.stringify(mine))});}catch(e){}},
    peers:list,onPeers:fn=>{peerFns.push(fn);setTimeout(()=>fn({peers:list(),joined:list(),left:[],updated:[]}),0);return()=>{const i=peerFns.indexOf(fn);if(i>=0)peerFns.splice(i,1);};},
    connected:()=>true,onConnection:fn=>{setTimeout(()=>fn(true),0);return()=>{};},
    leave:async()=>{try{post({k:'bye'});}catch(e){}}};
}
function closeTest2(){if(!TEST2)return;const T=TEST2;TEST2=null;try{T.iframe.contentWindow.postMessage({by2:1,k:'stop'},'*');}catch(e){}T.room.recv({k:'bye'});T.wrap.remove();}
function playtest2(){
  if(ED.ws&&ED.tab!=='viewport')saveWs();saveNow(true);
  closeTest2();
  const proj=JSON.parse(JSON.stringify(ED.proj));
  const wrap=document.createElement('div');wrap.id='p2wrap';
  wrap.innerHTML='<div class="p2bar">Player 2 (test)<span>Click inside to control Player 2 · click the main game to switch back</span><button class="mini" type="button" aria-label="Close Player 2">✕</button></div>';
  const fr=document.createElement('iframe');fr.name='by-testclient';fr.title='Player 2 test window';fr.setAttribute('allow','autoplay');wrap.appendChild(fr);
  const T={wrap,iframe:fr,proj};
  T.room=makeLinkRoom(m=>{if(fr.contentWindow)fr.contentWindow.postMessage(Object.assign({by2:1},m),'*');},'host','tester');
  TEST2=T;
  wrap.querySelector('button').onclick=()=>{closeTest2();logOut('Closed Player 2.','sys');cv.focus({preventScroll:true});};
  wrap.addEventListener('pointerdown',()=>{T.userFocus=true;});fr.addEventListener('focus',()=>wrap.classList.add('focus'));
  addEventListener('blur',()=>{setTimeout(()=>{if(document.activeElement===fr)wrap.classList.add('focus');},0);});
  cv.addEventListener('pointerdown',()=>wrap.classList.remove('focus'));
  if(IS_SITE)fr.src=location.href.split('#')[0];else fr.srcdoc=BOOT_HTML;
  $('#game').appendChild(wrap);
  const def=projectDef(proj,true);def.link=T.room;def.objective='Testing '+proj.name+' with 2 players';
  startGame(def);
  logOut('Started a test with 2 players. Player 2 opens in the small window: click inside it to control them.','sys');
}
addEventListener('message',e=>{const m=e.data;if(!m||m.by2!==1)return;
  if(TESTCLIENT){if(e.source!==window.parent)return;
    if(m.k==='start'){(m.meshes||[]).map(meshFromJSON).filter(Boolean).forEach(a=>cacheAsset(a));const def=projectDef(m.proj,true);def.link=CHILD_LINK;def.testP2=true;def.objective='Player 2 (test)';startGame(def);P.pos.x+=4;if(P.model)P.model.position.copy(P.pos);}
    else if(m.k==='stop'){if(running)stopGame();}
    else CHILD_LINK.recv(m);return;}
  if(!TEST2||e.source!==TEST2.iframe.contentWindow)return;
  if(m.k==='closed'){closeTest2();logOut('Player 2 stopped, so the test window closed.','sys');return;}
  if(m.k==='ready'){ensureMeshes(TEST2.proj).then(()=>{if(!TEST2)return;const ms=usedMeshIds(TEST2.proj).map(meshToJSON).filter(Boolean);
    TEST2.iframe.contentWindow.postMessage({by2:1,k:'start',proj:TEST2.proj,meshes:ms},'*');
    [300,900].forEach(ms_=>setTimeout(()=>{if(TEST2&&document.activeElement===TEST2.iframe&&!TEST2.userFocus){cv.focus({preventScroll:true});TEST2.wrap.classList.remove('focus');}},ms_));});}
  else TEST2.room.recv(m);});
const CHILD_LINK=TESTCLIENT?makeLinkRoom(m=>{window.parent.postMessage(Object.assign({by2:1},m),'*');},'tester','host'):null;
function playtest(){
  if(ED.ws&&ED.tab!=='viewport')saveWs();
  saveNow(true);
  startGame(projectDef(JSON.parse(JSON.stringify(ED.proj)),true));
}
function showPane(name){document.querySelectorAll('.pane-tabs button').forEach(x=>x.setAttribute('aria-pressed',x.dataset.pane===name));
  ['explorer','toolbox','assets'].forEach(p=>$('#'+p).hidden=p!==name);if(name==='assets')renderAssets();}
document.querySelectorAll('.pane-tabs button').forEach(b=>b.addEventListener('click',()=>showPane(b.dataset.pane)));
function closeDrawers(all){if(innerWidth>900)return;if(all!==false||true){$('#stLeft').classList.remove('open');$('#stRight').classList.remove('open');$('#scrim').classList.remove('on');}}
$('#stExpBtn').addEventListener('click',()=>{const o=!$('#stLeft').classList.contains('open');closeDrawers();if(o){$('#stLeft').classList.add('open');$('#scrim').classList.add('on');}});
$('#stPropBtn').addEventListener('click',()=>{const o=!$('#stRight').classList.contains('open');closeDrawers();if(o){$('#stRight').classList.add('open');$('#scrim').classList.add('on');}});
$('#scrim').addEventListener('click',()=>closeDrawers());
$('#outClear').addEventListener('click',()=>{$('#outLog').innerHTML='';OUT.length=0;});
$('#outToggle').addEventListener('click',e=>{const o=$('#stOut');o.classList.toggle('min');e.target.textContent=o.classList.contains('min')?'Show':'Hide';resizeStudio();});

/* ---- properties ---- */
const pv3=(k,arr,step)=>`<div class="v3">${[0,1,2].map(i=>`<input type="number" step="${step||1}" data-k="${k}" data-i="${i}" value="${r3(arr[i])}" aria-label="${k} ${'XYZ'[i]}">`).join('')}</div>`;
const prow=(label,html,id)=>`<div class="pr"><label${id?` for="${id}"`:''}>${label}</label>${html}</div>`;
const psel=(k,val,opts,id)=>`<select data-k="${k}" id="${id||'p_'+k}">${opts.map(([v,l])=>`<option value="${v}"${String(v)===String(val)?' selected':''}>${l}</option>`).join('')}</select>`;
const pchk=(k,val)=>`<input type="checkbox" data-k="${k}" id="p_${k}"${val?' checked':''}>`;
const pnum=(k,val,step,min)=>`<input type="number" data-k="${k}" id="p_${k}" value="${r3(val)}" step="${step||1}"${min!=null?` min="${min}"`:''}>`;
const ptext=(k,val)=>`<input type="text" data-k="${k}" id="p_${k}" value="${esc(val)}">`;
const pcolor=(k,val)=>`<input type="color" data-k="${k}" id="p_${k}" value="${esc(val)}">`;
const pgrp=(t,rows)=>`<div class="pg"><div class="pg-h">${t}</div>${rows}</div>`;
function renderProps(){
  const el=$('#props');const id=ED.sel[0];
  if(!id){el.innerHTML='<p class="pnote">Select something in the Explorer or click a part in the viewport to see its properties.</p>';return;}
  const S=ED.proj.settings;let h='';
  if(id==='workspace')h=pgrp('Workspace',prow('Gravity',pnum('s.gravity',S.gravity,1,1),'p_s.gravity')+prow('Show timer',pchk('s.timer',S.timer),'p_s.timer'))+`<p class="pnote">Roblox default gravity is 196.2 studs/s². Lower it for floaty, moon-like jumps.</p>`+
    pgrp('Lobby & matches',prow('Use a lobby',pchk('s.lobby',!!S.lobby),'p_s.lobby')+(S.lobby?prow('Lobby time (s)',pnum('s.lobbyWait',S.lobbyWait||15,1,5),'p_s.lobbyWait')+prow('Match time (s)',pnum('s.lobbyRound',S.lobbyRound||90,5,15),'p_s.lobbyRound')+
      prow('Score stat',`<input type="text" data-k="s.lobbyScore" id="p_s.lobbyScore" value="${esc(S.lobbyScore||'')}" maxlength="40" placeholder="e.g. KOs">`,'p_s.lobbyScore')+prow('Lowest score wins',pchk('s.lobbyLow',!!S.lobbyLow),'p_s.lobbyLow')+prow('Out when you die',pchk('s.lobbyElim',!!S.lobbyElim),'p_s.lobbyElim'):'')+
      `<p class="pnote">Players wait in a floating lobby, then everyone in the game starts the match together and goes back to the lobby when time runs out. Scripts get the messages <b>round start</b> and <b>round end</b>, and scripts that start from <b>round start</b> pick the same random numbers for every player. The score stat is reset at the start and ranked at the end.</p>`);
  else if(id==='lighting')h=pgrp('Lighting',prow('Sky color',pcolor('s.sky',S.sky),'p_s.sky')+prow('Fog distance',pnum('s.fog',S.fog,50,100),'p_s.fog')+prow('Brightness',`<input type="range" min=".3" max="1.8" step=".05" data-k="s.brightness" id="p_s.brightness" value="${S.brightness}">`,'p_s.brightness'));
  else if(id==='player')h=pgrp('StarterPlayer',prow('WalkSpeed',pnum('s.walkSpeed',S.walkSpeed,1,0),'p_s.walkSpeed')+prow('JumpPower',pnum('s.jumpPower',S.jumpPower,1,0),'p_s.jumpPower'))+`<p class="pnote">Defaults match Roblox: WalkSpeed 16, JumpPower 50.</p>`+
    pgrp('Saving progress',prow('Save progress',pchk('s.saveEnabled',S.saveEnabled!==false),'p_s.saveEnabled')+prow('Save stats',pchk('s.saveStats',S.saveStats!==false),'p_s.saveStats')+prow('Save checkpoint',pchk('s.saveCheckpoint',S.saveCheckpoint!==false),'p_s.saveCheckpoint')+
      `<p class="pnote">${S.saveEnabled===false?'<b>Saving is off:</b> nothing is saved or loaded, so every visit starts fresh. The Saving blocks still work during a game. ':''}Each player's progress saves by itself every few seconds and when they leave: their stats, their last checkpoint, and anything scripts store with the Saving blocks. It is kept in their Brickyard account (or in their browser if they are not signed in) and loads next time they play. Playtests use a separate test save.</p><div class="pr"><span class="l"></span><div class="btnrow"><button class="mini" type="button" data-pa="clearTestSave">Clear my test save</button></div></div>`)+
    pgrp('Death',prow('Death style',psel('s.deathStyle',S.deathStyle==='ragdoll'?'ragdoll':'break',[['break','Break apart (classic)'],['ragdoll','Ragdoll']]),'p_s.deathStyle')+`<p class="pnote">Ragdoll makes players and rigs go limp and tumble when they are knocked out. The Player and Rigs blocks can also ragdoll or fling them at any time.</p>`)+
    pgrp('Scripts & animations',`<p class="pnote">Scripts here run for the player: use "when I spawn", "when I jump" and the Player blocks. Animations here can be turned into emotes with their Emote setting. Name one <b>Idle</b>, <b>Walk</b> or <b>Jump</b> to replace the player's default movement animation.</p><div class="pr"><span class="l"></span><div class="btnrow"><button class="mini pri" type="button" data-pa="playerScript">Add script</button><button class="mini" type="button" data-pa="playerAnim">Add animation</button></div></div>`);
  else if(id==='rs')h=pgrp('ReplicatedStorage',`<p class="pnote">Store templates here: parts, models, rigs and folders that stay out of the world until a script copies them in with the Storage blocks. Scripts inside a template start running in each copy.</p><div class="pr"><span class="l"></span><div class="btnrow"><button class="mini pri" type="button" data-pa="insRS">Add a part here</button></div></div>`);
  else if(id==='gui')h=pgrp('StarterGui',`<p class="pnote">On-screen interface: ScreenGuis hold Frames, TextLabels and TextButtons that show over the game for every player. Edit them on the GUI tab and script them with the GUI blocks.</p><div class="pr"><span class="l"></span><div class="btnrow"><button class="mini pri" type="button" data-pa="insGui">Add a text label</button><button class="mini" type="button" data-pa="insGuiB">Add a button</button></div></div>`);
  else if(id==='pack')h=pgrp('StarterPack',`<p class="pnote">Tools here go into every player's hotbar when the game starts. Build a tool in Workspace so you can see it, then drag it here.</p><div class="pr"><span class="l"></span><div class="btnrow"><button class="mini pri" type="button" data-pa="insTool">Add a tool here</button></div></div>`);
  else if(id==='sss')h=pgrp('ServerScriptService',`<p class="pnote">Scripts here run for the whole game. Put scripts inside a part when they need "this part" or touch and click events.</p><div class="pr"><span class="l"></span><div class="btnrow"><button class="mini pri" type="button" data-pa="addScript">Add script</button></div></div>`);
  else{
    const n=nodeOf(id);if(!n){el.innerHTML='';return;}
    const multi=ED.sel.length>1?`<p class="pnote">${ED.sel.length} items selected. Changes apply to every selected ${n.cls}.</p>`:'';
    const par=isService(n.parent)?SERVICES.find(s=>s.id===n.parent).name:(nodeOf(n.parent)||{}).name;
    h=multi+pgrp('Data',prow('Name',ptext('name',n.name),'p_name')+prow('ClassName',`<span class="ro">${n.shape==='wedge'?'WedgePart':n.behavior==='spawn'?'SpawnLocation':n.cls}</span>`)+prow('Parent',`<span class="ro">${esc(par||'')}</span>`));
    const scriptsBox=()=>pgrp('Scripts',kidsOf(n.id).filter(k=>k.cls==='Script').map(s=>`<div class="pr"><span class="l">${esc(s.name)}</span><div class="btnrow"><button class="mini" type="button" data-pa="open" data-sid="${s.id}">Edit blocks</button></div></div>`).join('')+
      `<div class="pr"><span class="l"></span><div class="btnrow"><button class="mini pri" type="button" data-pa="addScript">Add script</button><button class="mini" type="button" data-pa="addFx">Add particles</button></div></div>`);
    const pv4=(k,arr,lbl)=>`<div class="v3" style="grid-template-columns:repeat(2,minmax(0,1fr));row-gap:4px">${[0,1,2,3].map(i=>`<input type="number" step="${i%2?1:.01}" data-k="${k}" data-i="${i}" value="${r3(num(arr[i],0))}" aria-label="${lbl} ${['X scale','X offset','Y scale','Y offset'][i]}" title="${['X scale','X offset (px)','Y scale','Y offset (px)'][i]}">`).join('')}</div>`;
    if(n.cls==='Animation'){const a=animData(n);
      h+=pgrp('Animation',prow('Length (s)',pnum('length',a.length,.1,.1),'p_length')+prow('Loop',pchk('loop',a.loop),'p_loop')+prow('Speed',pnum('speed',a.speed,.1,.05),'p_speed')+
        prow('Stop when moving',pchk('stopOnMove',a.stopOnMove),'p_stopOnMove')+(serviceOf(ED.proj,n.id)==='player'&&!['idle','walk','jump'].includes(a.name.toLowerCase())?prow('Emote',pchk('emote',!!n.emote),'p_emote'):'')+`<div class="pr"><span class="l">Keyframes</span><span class="ro">${a.keys.length}</span></div>`+
        `<div class="pr"><span class="l"></span><div class="btnrow"><button class="mini pri" type="button" data-pa="editAnim">Edit animation</button></div></div>`)+
        `<p class="pnote">Play it with "play animation ${esc(a.name)}" in the Animation blocks.${serviceOf(ED.proj,n.id)==='player'?(['idle','walk','jump'].includes(a.name.toLowerCase())?' Because it is named '+esc(a.name)+', it replaces the player\'s default '+esc(a.name.toLowerCase())+' animation.':n.emote?' Emote is on, so players can use it from the Emotes menu or /e '+esc(a.name.toLowerCase())+'.':' Turn on Emote to add it to the in-game Emotes menu.'):' To make it an emote, put it in StarterPlayer and turn on Emote.'}</p>`;}
    else if(n.cls==='ScreenGui'){h+=pgrp('ScreenGui',prow('Enabled',pchk('visible',n.visible!==false),'p_visible'))+scriptsBox()+`<p class="pnote">A ScreenGui fills the screen. Put Frames, TextLabels and TextButtons inside it.</p>`;}
    else if(isGuiNode(n)){
      h+=pgrp('Layout',prow('Position',pv4('gpos',n.gpos||[0,0,0,0],'Position'))+prow('Size',pv4('gsize',n.gsize||[0,100,0,40],'Size'))+
        prow('Anchor',`<div class="v3" style="grid-template-columns:repeat(2,minmax(0,1fr))">${[0,1].map(i=>`<input type="number" step=".5" min="0" max="1" data-k="anchor" data-i="${i}" value="${r3(num((n.anchor||[0,0])[i],0))}" aria-label="Anchor ${'XY'[i]}">`).join('')}</div>`)+
        `<p class="pnote">Top row is X, bottom row is Y: scale (0–1 of the parent) then offset in pixels, like Roblox UDim2. Anchor 0.5, 0.5 centres it on its position.</p>`);
      h+=pgrp('Appearance',prow('Visible',pchk('visible',n.visible!==false),'p_visible')+prow('Background',pcolor('bg',n.bg||'#16213a'),'p_bg')+
        prow('Transparency',`<input type="range" min="0" max="1" step=".05" data-k="bgT" id="p_bgT" value="${num(n.bgT,0)}">`,'p_bgT')+prow('Corner radius',pnum('radius',n.radius||0,1,0),'p_radius')+
        prow('Border color',pcolor('stroke',n.stroke||'#ffffff'),'p_stroke')+prow('Border width',pnum('strokeW',n.strokeW||0,1,0),'p_strokeW'));
      if(n.cls!=='Frame')h+=pgrp('Text',prow('Text',ptext('text',n.text||''),'p_text')+prow('Text color',pcolor('tc',n.tc||'#ffffff'),'p_tc')+prow('Text size',pnum('ts',n.ts||20,1,6),'p_ts')+
        prow('Font',psel('font',n.font||'Body',GUI_FONT_LIST.map(f=>[f[0],f[1]])),'p_font')+
        prow('Outline color',pcolor('strokeTc',n.strokeTc||'#000000'),'p_strokeTc')+prow('Outline width',pnum('strokeT',n.strokeT||0,.5,0),'p_strokeT')+prow('Drop shadow',pchk('tshadow',!!n.tshadow),'p_tshadow')+prow('Align',psel('align',n.align||'center',[['left','Left'],['center','Center'],['right','Right']]),'p_align'));
      h+=scriptsBox();
    }else if(n.cls==='Tool'){const ps=toolParts(ED.proj,n.id);const hh=toolHandle(ED.proj,n);
      h+=pgrp('Tool',prow('ToolTip',ptext('tooltip',n.tooltip||''),'p_tooltip')+prow('Handle',psel('handle',hh?hh.id:'',ps.length?ps.map(q=>[q.id,q.name]):[['','(add a part)']]),'p_handle')+
        prow('Cooldown (s)',pnum('cooldown',n.cooldown??.3,.05,.05),'p_cooldown')+prow('Swing on use',pchk('swing',n.swing!==false),'p_swing'));
      h+=scriptsBox()+`<p class="pnote">${serviceOf(ED.proj,n.id)==='pack'?'Players start with this tool in their hotbar.':serviceOf(ED.proj,n.id)==='workspace'?'In Workspace this tool is a pickup: players get it by touching it. Drag it into StarterPack so every player starts with it.':'Give it to players with the "give the player tool" block.'} The player holds the Handle, and the tool points forward along -Z, so build blades and barrels in that direction. Press 1–9 or tap the hotbar to equip, then click or tap to use.</p>`;
    }else if(n.cls==='Rig'){const C=n.colors||{};
      h+=pgrp('Appearance',prow('Head',pcolor('colors.head',C.head||'#f5cd30'),'p_colors.head')+prow('Shirt',pcolor('colors.torso',C.torso||'#1e88e5'),'p_colors.torso')+
        prow('Arms',pcolor('colors.arms',C.arms||'#f5cd30'),'p_colors.arms')+prow('Pants',pcolor('colors.legs',C.legs||'#2b3a7a'),'p_colors.legs')+prow('Name tag',pchk('showName',n.showName!==false),'p_showName'));
      h+=pgrp('Transform',prow('Position',pv3('pos',n.pos,ED.snap?ED.mSnap:.1))+prow('Facing (Y°)',`<input type="number" data-k="rot" data-i="1" id="p_rot1" value="${r3((n.rot||[0,0,0])[1])}" step="${ED.snap?ED.rSnap:1}">`,'p_rot1')+prow('Scale',pnum('scale',n.scale||1,.1,.3),'p_scale'));
      h+=pgrp('Humanoid',prow('Animation',psel('anim',n.anim||'idle',RIG_ANIMS),'p_anim')+prow('WalkSpeed',pnum('walkSpeed',n.walkSpeed||12,1,0),'p_walkSpeed')+
        prow('Health',pnum('health',n.health||100,5,1),'p_health')+prow('Respawn after (s)',pnum('respawn',n.respawn||0,1,0),'p_respawn')+prow('Walk through walls',pchk('throughWalls',!!n.throughWalls),'p_throughWalls'));
      h+=scriptsBox()+`<p class="pnote">Rigs are characters you can script with the Rigs blocks: walk, say, face the player and play animations. Players bump into them like a part. Walls stop them unless Walk through walls is on, and they will not walk off edges.</p>`;
    }else if(n.cls==='ParticleEmitter'){
      h+=pgrp('Emitter',prow('Enabled',pchk('enabled',n.enabled!==false),'p_enabled')+prow('Preset',psel('preset',n.preset||'custom',[['custom','Custom']].concat(Object.keys(PPRESETS).map(k=>[k,k[0].toUpperCase()+k.slice(1)]))),'p_preset')+
        `<div class="pr"><span class="l"></span><div class="btnrow"><button class="mini" type="button" data-pa="burst">Preview burst</button></div></div>`);
      h+=pgrp('Look',prow('Shape',psel('shape',n.shape,PSHAPES),'p_shape')+prow('Start color',pcolor('color0',n.color0),'p_color0')+prow('End color',pcolor('color1',n.color1),'p_color1')+
        prow('Rainbow',pchk('rainbow',!!n.rainbow),'p_rainbow')+prow('Glow',pchk('glow',!!n.glow),'p_glow')+prow('Start size',pnum('size0',n.size0,.1,0),'p_size0')+prow('End size',pnum('size1',n.size1,.1,0),'p_size1'));
      h+=pgrp('Motion',prow('Rate /s',pnum('rate',n.rate,1,0),'p_rate')+prow('Lifetime min',pnum('lifeMin',n.lifeMin,.1,.05),'p_lifeMin')+prow('Lifetime max',pnum('lifeMax',n.lifeMax,.1,.05),'p_lifeMax')+
        prow('Speed',pnum('speed',n.speed,.5,0),'p_speed')+prow('Spread °',pnum('spread',n.spread,5,0),'p_spread')+prow('Gravity',pnum('accel',n.accel,1),'p_accel')+
        prow('Direction',psel('dir',n.dir||'Top',Object.keys(PDIRS).map(k=>[k,k])),'p_dir'));
    }else if(n.cls==='Part'){
      const vl={check:['Stage',1,1],jump:['Launch power',5,10],speed:['Boost seconds',.1,.1]}[n.behavior];
      h+=pgrp('Appearance',prow('Color',pcolor('color',n.color),'p_color')+prow('Material',psel('material',n.material,MATERIALS.map(m=>[m,m])),'p_material')+
        prow('Transparency',`<input type="range" min="0" max="1" step=".05" data-k="transparency" id="p_transparency" value="${n.transparency||0}">`,'p_transparency')+(n.shape==='mesh'?prow('Mesh',`<span class="ro">${esc(n.meshName||'mesh')}${MESHINFO.get(n.meshId)?' · '+MESHINFO.get(n.meshId).tris.toLocaleString()+' triangles':' · not in this browser'}</span>`):prow('Shape',psel('shape',n.shape,SHAPES),'p_shape')));
      h+=pgrp('Transform',prow('Position',pv3('pos',n.pos,ED.snap?ED.mSnap:.1))+prow('Size',pv3('size',n.size,ED.snap?ED.mSnap:.1))+prow('Orientation',pv3('rot',n.rot||[0,0,0],ED.snap?ED.rSnap:1)));
      h+=pgrp('Behavior',prow('Anchored',pchk('anchored',n.anchored!==false),'p_anchored')+prow('CanCollide',pchk('canCollide',n.canCollide!==false),'p_canCollide')+prow('Unbreakable',pchk('unbreakable',!!n.unbreakable),'p_unbreakable')+
        prow('Locked',pchk('locked',!!n.locked),'p_locked')+prow('Label',ptext('label',n.label||''),'p_label')+prow('Gameplay',psel('behavior',n.behavior||'none',BEHAVIORS),'p_behavior')+(vl?prow(vl[0],pnum('value',n.value||vl[1],vl[2],0),'p_value'):''));
      h+=scriptsBox();
      if(n.shape==='mesh')h+=`<p class="pnote">Mesh parts collide like a box of their Size.</p>`;
      if(n.anchored===false)h+=`<p class="pnote">Unanchored parts fall and land on other parts when the game runs.</p>`;
      if(n.shape==='wedge'&&((n.rot||[0,0,0])[0]||(n.rot||[0,0,0])[2]))h+=`<p class="pnote">Tilted wedges collide like boxes. Rotate wedges only around Y to keep the ramp walkable.</p>`;
    }else if(n.cls==='Script'){
      h+=pgrp('Script',prow('Enabled',pchk('enabled',n.enabled!==false),'p_enabled')+prow('Host only',pchk('hostOnly',!!n.hostOnly),'p_hostOnly')+`<p class="pnote">Host-only scripts run on one computer in a multiplayer game, like a Roblox server script. Use them for bots and game rules: bots, moved parts, messages, sounds and variables from host scripts are shared with every player.</p><div class="pr"><span class="l"></span><div class="btnrow"><button class="mini pri" type="button" data-pa="open" data-sid="${n.id}">Edit blocks</button></div></div>`);
    }else{
      const c=descendantsOf(ED.proj,n.id).length;
      if(n.cls==='Model'){const scripts=kidsOf(n.id).filter(k=>k.cls==='Script');
        h+=pgrp('Scripts',scripts.map(s=>`<div class="pr"><span class="l">${esc(s.name)}</span><div class="btnrow"><button class="mini" type="button" data-pa="open" data-sid="${s.id}">Edit blocks</button></div></div>`).join('')+
          `<div class="pr"><span class="l"></span><div class="btnrow"><button class="mini pri" type="button" data-pa="addScript">Add script</button></div></div>`);}
      h+=`<p class="pnote">${n.cls} with ${c} item${c===1?'':'s'} inside.${n.cls==='Model'?' Scripts inside a Model can use the "this model" block to move or change all of it at once.':''} ${n.cls==='Model'?'Clicking any part of a Model in the viewport selects the whole Model. Hold Ctrl or Alt to pick a single part.':'Folders keep your Explorer tidy.'}</p>`;
    }
  }
  el.innerHTML=h;
}
function updateTransformInputs(){
  const n=nodeOf(ED.sel[0]);if(!n||n.cls!=='Part')return;
  document.querySelectorAll('#props .v3 input').forEach(i=>{const a=n[i.dataset.k];if(a&&document.activeElement!==i)i.value=r3(a[+i.dataset.i]);});
}
function applyProp(el,commitIt){
  const k=el.dataset.k;if(!k)return;
  let v=el.type==='checkbox'?el.checked:el.type==='number'||el.type==='range'?parseFloat(el.value):el.value;
  if(el.type==='number'&&!isFinite(v))return;
  if(k.startsWith('s.')){ED.proj.settings[k.slice(2)]=v;rebuildWorld();if(commitIt)commit();if(k==='s.lobby')renderProps();return;}
  if(k.startsWith('colors.')){ED.sel.map(nodeOf).filter(n=>n&&n.cls==='Rig').forEach(n=>{n.colors=Object.assign({},n.colors,{[k.slice(7)]:v});});rebuildWorld();refreshGizmo();if(commitIt)commit();return;}
  const first=nodeOf(ED.sel[0]);if(!first)return;
  const targets=ED.sel.map(nodeOf).filter(n=>n&&n.cls===first.cls);
  for(const n of targets){
    if(el.dataset.i!=null){const i=+el.dataset.i;const arr=(n[k]||[0,0,0]).slice();if(k==='size')v=Math.max(.2,v);arr[i]=v;if(k==='size'&&n.shape==='ball'){arr[0]=arr[1]=arr[2]=v;}n[k]=arr;}
    else if(k==='name'){if(String(v).trim())n.name=String(v).trim().slice(0,60);}
    else{n[k]=v;
      if(k==='behavior'){if(v==='check')n.value=nextStage();else if(v==='jump')n.value=100;else if(v==='speed')n.value=2.6;
        if(v==='coin'){n.shape='cyl';n.size=[.3,2.3,2.3];n.color='#ffc72c';}if(v==='kill'&&n.color==='#a3a2a5')n.color='#ff3b30';}
      if(k==='shape'&&v==='ball'&&n.cls==='Part'){const s=Math.max(...n.size);n.size=[s,s,s];}
      if(k==='preset'&&PPRESETS[v])Object.assign(n,PPRESETS[v]);
      if(n.cls==='ParticleEmitter'&&k!=='preset'&&k!=='enabled'&&k!=='name')n.preset='custom';
      if(k==='scale'&&n.cls==='Rig')n.scale=Math.max(.3,Math.min(8,v));
    }
  }
  if(k==='name'){renderExplorer();renderTabs();}
  if(first.cls==='Animation'){if(ED.tab===first.id)renderAnimEditor();if(el.type==='checkbox')setTimeout(renderProps,0);}
  else if(isGuiNode(first)){renderGuiEditor();}
  else if(k!=='name'&&first.cls!=='Script'&&first.cls!=='Folder'&&first.cls!=='Model'&&first.cls!=='Tool'){rebuildWorld();if(ED.sel.length===1)refreshGizmo();}
  if(commitIt){commit();if(['behavior','anchored','shape','enabled','preset'].includes(k)){renderProps();renderExplorer();}}
}
$('#props').addEventListener('input',e=>{if(e.target.type==='text'&&e.target.dataset.k!=='text')return;applyProp(e.target,false);});
$('#props').addEventListener('change',e=>applyProp(e.target,true));
$('#props').addEventListener('keydown',e=>{e.stopPropagation();if(e.key==='Enter'&&e.target.tagName==='INPUT')e.target.blur();});
$('#props').addEventListener('click',e=>{const b=e.target.closest('[data-pa]');if(!b)return;
  const pa=b.dataset.pa;
  if(pa==='open')openScript(b.dataset.sid);else if(pa==='addScript')insert('script');else if(pa==='addFx')insert('particles');
  else if(pa==='insRS'){select(['rs']);insert('part');}
  else if(pa==='clearTestSave'){store.del('save:'+('test-'+ED.proj.id).replace(/[^A-Za-z0-9_-]/g,'_').slice(0,100));logOut('Cleared your test save. The next playtest starts fresh.','sys');}
  else if(pa==='playerScript'){select(['player']);insert('script');}
  else if(pa==='playerAnim'){select(['player']);insert('animation');}
  else if(pa==='editAnim'){openAnim(ED.sel[0]);}
  else if(pa==='insGui'){select(['gui']);insert('gui-text');}
  else if(pa==='insGuiB'){select(['gui']);insert('gui-button');}
  else if(pa==='insTool'){insert('tool');const tn=nodeOf(ED.sel[0]);if(tn){tn.parent='pack';commit();refreshAll();logOut('Added a Tool to StarterPack. Drag it into Workspace to see and shape it.','sys');}}
  else if(pa==='burst'){const e=ED.emitters.find(x=>x.nodeId===ED.sel[0]);if(e)e.emit(40);}});

/* ---- toolbox (prefab models) ---- */
const PREFABS=[
  {sec:'Scripted',name:'Moving platform',desc:'Glides back and forth forever.',ico:['Part','#ffb84d'],make:o=>{const p=partNode({name:'MovingPlatform',pos:[o.x,o.y+.5,o.z],size:[8,1,8],color:'#ffb84d'});return [p,scriptNode({parent:p.id,name:'GlideScript',blocks:SCR.glide(12,0,0,2)})];}},
  {sec:'Scripted',name:'Spinning kill bar',desc:'A neon bar that spins and knocks you out.',ico:['Part','#ff3b30'],make:o=>{const m=groupNode('Model',{name:'Spinner'});
    const b=partNode({parent:m.id,name:'Bar',pos:[o.x,o.y+1.5,o.z],size:[16,1,1],color:'#ff3b30',material:'Neon',behavior:'kill'});
    return [m,b,partNode({parent:m.id,name:'Post',shape:'cyl',pos:[o.x,o.y+.5,o.z],size:[1,1.4,1.4],rot:[0,0,90],color:'#3b3f4a'}),scriptNode({parent:b.id,name:'SpinScript',blocks:SCR.spin(2.5)})];}},
  {sec:'Scripted',name:'Click-to-open door',desc:'Click the door to walk through it for 3 seconds.',ico:['Part','#8d6e63'],make:o=>{const d=partNode({name:'Door',pos:[o.x,o.y+5,o.z],size:[6,10,1],color:'#8d6e63',material:'Wood'});
    return [d,scriptNode({parent:d.id,name:'DoorScript',blocks:SCR.door()})];}},
  {sec:'Scripted',name:'Vanishing tile',desc:'Disappears soon after you step on it, then returns.',ico:['Part','#a8e6ff'],make:o=>{const p=partNode({name:'VanishingTile',pos:[o.x,o.y+.5,o.z],size:[6,1,6],color:'#a8e6ff'});
    return [p,scriptNode({parent:p.id,name:'VanishScript',blocks:SCR.vanish()})];}},
  {sec:'Scripted',name:'Teleporter pair',desc:'Step on pad A to appear on pad B.',ico:['Model','#b18cff'],make:o=>{const m=groupNode('Model',{name:'Teleporters'});
    const a=partNode({parent:m.id,name:'TeleportA',pos:[o.x-8,o.y+.2,o.z],size:[5,.4,5],color:'#b18cff',material:'Neon'});
    const b=partNode({parent:m.id,name:'TeleportB',pos:[o.x+30,o.y+.2,o.z],size:[5,.4,5],color:'#5cc8ff',material:'Neon'});
    return [m,a,b,scriptNode({parent:a.id,name:'TeleportScript',blocks:SCR.teleport('TeleportB')})];}},
  {sec:'Scripted',name:'Button and gate',desc:'Stepping on the button broadcasts "open" and the gate rises.',ico:['Model','#ff4d5e'],make:o=>{const m=groupNode('Model',{name:'ButtonGate'});
    const b=partNode({parent:m.id,name:'Button',pos:[o.x-6,o.y+.25,o.z],size:[3,.5,3],color:'#ff4d5e'});
    const g=partNode({parent:m.id,name:'Gate',pos:[o.x+4,o.y+5,o.z],size:[1,10,12],color:'#6b7fa8',material:'Metal'});
    return [m,b,g,scriptNode({parent:b.id,name:'ButtonScript',blocks:SCR.button('open')}),scriptNode({parent:g.id,name:'GateScript',blocks:SCR.gate('open')})];}},
  {sec:'Scripted',name:'Score zone',desc:'A see-through zone that adds a point each time you enter.',ico:['Part','#3ddc84'],make:o=>{const z=partNode({name:'ScoreZone',pos:[o.x,o.y+3,o.z],size:[8,6,8],color:'#3ddc84',transparency:.7,canCollide:false});
    return [z,scriptNode({parent:z.id,name:'ScoreScript',blocks:SCR.score()})];}},
  {sec:'Scripted',name:'Floating island',desc:'A grassy island with a tree that bobs up and down using "this model".',ico:['Model','#58b947'],make:o=>{const m=groupNode('Model',{name:'FloatingIsland'});
    return [m,partNode({parent:m.id,name:'Ground',pos:[o.x,o.y+4,o.z],size:[12,2,12],color:'#58b947',material:'Grass'}),partNode({parent:m.id,name:'Dirt',pos:[o.x,o.y+2.5,o.z],size:[9,1,9],color:'#8d6e63'}),
      partNode({parent:m.id,name:'Trunk',pos:[o.x+2,o.y+7,o.z-2],size:[1.4,4,1.4],color:'#6d4c41',material:'Wood'}),partNode({parent:m.id,name:'Leaves',pos:[o.x+2,o.y+10,o.z-2],size:[5,3,5],color:'#2e7d32',material:'Grass'}),
      scriptNode({parent:m.id,name:'BobScript',blocks:SCR.bobModel()})];}},
  {sec:'Scripted',name:'Spinning windmill',desc:'Blades grouped as a Model that spin together around their center.',ico:['Model','#f5f5f5'],make:o=>{const m=groupNode('Model',{name:'Windmill'});const bl=groupNode('Model',{parent:m.id,name:'Blades'});
    return [m,partNode({parent:m.id,name:'Tower',shape:'cyl',pos:[o.x,o.y+7,o.z],size:[14,3,3],rot:[0,0,90],color:'#e8d39a',material:'Brick'}),bl,
      partNode({parent:bl.id,name:'Hub',pos:[o.x,o.y+14,o.z+2],size:[1.6,1.6,1.6],color:'#455a64'}),
      partNode({parent:bl.id,name:'BladeA',pos:[o.x,o.y+14,o.z+2],size:[14,1.4,.4],color:'#f5f5f5'}),partNode({parent:bl.id,name:'BladeB',pos:[o.x,o.y+14,o.z+2],size:[1.4,14,.4],color:'#f5f5f5'}),
      scriptNode({parent:bl.id,name:'SpinScript',blocks:SCR.spinModel()})];}},
  ...['wave','dance','cheer','bow','jumpingjacks','spin','flex','sit','point'].map(k=>({sec:'Animations',name:BUILTIN_ANIMS[k].name+' emote',desc:'A keyframe animation in StarterPlayer with Emote turned on, so players can use it from the Emotes menu. Open it to edit the poses.',ico:['Animation','#ff5fa2'],
    make:()=>[{id:uid(),cls:'Animation',name:BUILTIN_ANIMS[k].name,parent:'player',length:BUILTIN_ANIMS[k].length,loop:BUILTIN_ANIMS[k].loop,speed:1,stopOnMove:true,emote:true,keys:JSON.parse(JSON.stringify(BUILTIN_ANIMS[k].keys))}]})),
  {sec:'Animations',name:'Custom walk',desc:'Replaces the player\'s walk with a big arm-swing walk you can edit.',ico:['Animation','#ff5fa2'],make:()=>[{id:uid(),cls:'Animation',name:'Walk',parent:'player',length:.8,loop:true,speed:1,keys:JSON.parse(JSON.stringify(BUILTIN_ANIMS.walk.keys))}]},
  {sec:'Animations',name:'Custom idle',desc:'Replaces the player\'s standing pose with a gentle breathing idle.',ico:['Animation','#ff5fa2'],make:()=>[{id:uid(),cls:'Animation',name:'Idle',parent:'player',length:3,loop:true,speed:1,keys:JSON.parse(JSON.stringify(BUILTIN_ANIMS.idle.keys))}]},
  {sec:'Animations',name:'Dancing NPC',desc:'A rig that dances forever with the Dance animation.',ico:['Rig','#ff5fa2'],make:o=>{const r=rigNode({name:'Dancer',pos:[o.x,o.y+2.6,o.z],colors:{head:'#f5cd30',torso:'#ff5fa2',arms:'#f5cd30',legs:'#2b3a7a'}});
    return [r,scriptNode({parent:r.id,name:'DanceScript',blocks:scriptOf(chain(blk('ev_start'),blk('anim_play_rig',{NAME:bt('Dance'),PART:bme()},{MODE:'loop'})))})];}},
  {sec:'Animations',name:'Wave on spawn',desc:'A StarterPlayer script: your character waves every time you spawn.',ico:['Script','#9966ff'],make:()=>[scriptNode({parent:'player',name:'SpawnWave',blocks:scriptOf(chain(blk('ev_spawn'),blk('c_wait',{S:bn(.5)}),blk('anim_play_me',{NAME:bt('Wave')},{MODE:'once'})))})]},
  {sec:'Gameplay',name:'Freeze button',desc:'Click it to freeze everyone else for 3 seconds in an online game.',ico:['Part','#7fd4ff'],make:o=>{const pt=partNode({name:'FreezeButton',pos:[o.x,o.y+.5,o.z],size:[4,1,4],color:'#7fd4ff',material:'Neon'});
    return [pt,scriptNode({parent:pt.id,name:'FreezeScript',blocks:scriptOf(chain(blk('ev_click'),blk('pl_as',{WHO:{shadow:{type:'pl_ref',fields:{WHO:'others'}}},DO:doIn(blk('pl_freeze',null,{B:'TRUE'}),blk('pl_say',{TEXT:bt('Brrr!'),S:bn(3)}),blk('c_wait',{S:bn(3)}),blk('pl_freeze',null,{B:'FALSE'}))})))})];}},
  {sec:'GUI',name:'Coin counter',desc:'A label in the top corner that shows your Coins stat.',ico:['TextLabel','#b2f0e8'],make:()=>{const sg=guiNode('ScreenGui',{name:'CoinGui'});
    const lb=guiNode('TextLabel',{parent:sg.id,name:'CoinLabel',text:'Coins: 0',gpos:[1,-20,0,76],anchor:[1,0],gsize:[0,200,0,48],bg:'#ffc72c',bgT:.05,tc:'#2a1a00',font:'Display',ts:24,radius:24});
    return [sg,lb,scriptNode({parent:lb.id,name:'CoinScript',blocks:scriptOf(chain(blk('ev_start'),blk('c_forever',{DO:doIn(blk('gui_settext',{GUI:{shadow:{type:'gui_this'}},
      TEXT:{block:{type:'text_join',extraState:{itemCount:2},inputs:{ADD0:bt('Coins: '),ADD1:{block:{type:'s_stat',fields:{STAT:'Coins'}}}}}}}),blk('c_wait',{S:bn(.2)}))})))})];}},
  {sec:'GUI',name:'Welcome popup',desc:'A centred panel with a message and a button that closes it.',ico:['Frame','#7fdbcf'],make:()=>{const sg=guiNode('ScreenGui',{name:'PopupGui'});
    const fr=guiNode('Frame',{parent:sg.id,name:'Popup',gpos:[.5,0,.5,0],anchor:[.5,.5],gsize:[0,420,0,220],radius:18,strokeW:2,stroke:'#5cc8ff'});
    const tl=guiNode('TextLabel',{parent:fr.id,name:'Title',text:'Welcome to my game!',gpos:[0,20,0,24],gsize:[1,-40,0,90],bgT:1,font:'Display',ts:30});
    const bt_=guiNode('TextButton',{parent:fr.id,name:'CloseButton',text:'Play',gpos:[.5,0,1,-24],anchor:[.5,1],gsize:[0,180,0,52]});
    return [sg,fr,tl,bt_,scriptNode({parent:bt_.id,name:'CloseScript',blocks:scriptOf(chain(blk('ev_gui_click'),blk('gui_visible',{GUI:{block:{type:'gui_named',fields:{NAME:'Popup'}},shadow:{type:'gui_this'}}},{B:'FALSE'})))})];}},
  {sec:'GUI',name:'Sprint button',desc:'A button that makes you run fast for 3 seconds.',ico:['TextButton','#4dd0c0'],make:()=>{const sg=guiNode('ScreenGui',{name:'SprintGui'});
    const b_=guiNode('TextButton',{parent:sg.id,name:'SprintButton',text:'Sprint!',gpos:[1,-24,1,-110],anchor:[1,1],gsize:[0,160,0,56],bg:'#3ddc84',tc:'#04210f'});
    return [sg,b_,scriptNode({parent:b_.id,name:'SprintScript',blocks:scriptOf(chain(blk('ev_gui_click'),blk('gui_settext',{GUI:{shadow:{type:'gui_this'}},TEXT:bt('Zoom!')}),blk('pl_speed',{V:bn(34)}),
      blk('g_sound',null,{SND:'boost'}),blk('c_wait',{S:bn(3)}),blk('pl_speed',{V:bn(16)}),blk('gui_settext',{GUI:{shadow:{type:'gui_this'}},TEXT:bt('Sprint!')})))})];}},
  {sec:'GUI',name:'Timer display',desc:'A big timer at the top of the screen.',ico:['TextLabel','#b2f0e8'],make:()=>{const sg=guiNode('ScreenGui',{name:'TimerGui'});
    const lb=guiNode('TextLabel',{parent:sg.id,name:'TimerLabel',text:'0',gpos:[.5,0,0,16],anchor:[.5,0],gsize:[0,160,0,60],font:'Display',ts:36,bgT:.4,radius:16});
    return [sg,lb,scriptNode({parent:lb.id,name:'TimerScript',blocks:scriptOf(chain(blk('ev_start'),blk('c_forever',{DO:doIn(blk('gui_settext',{GUI:{shadow:{type:'gui_this'}},
      TEXT:{block:{type:'s_timer'}}}),blk('c_wait',{S:bn(.1)}))})))})];}},
  {sec:'Tools',name:'Sword',desc:'Click to slash. Hits on rigs deal 25 damage.',ico:['Tool','#c0c7d4'],make:o=>{const T={id:uid(),cls:'Tool',name:'Sword',parent:'workspace',tooltip:'A trusty blade',cooldown:.45,swing:true};
    const y=o.y+3,z=o.z;const h=partNode({parent:T.id,name:'Handle',pos:[o.x,y,z],size:[.4,.4,1.2],color:'#6d4c41',material:'Wood'});T.handle=h.id;
    return [T,h,partNode({parent:T.id,name:'Guard',pos:[o.x,y,z-.75],size:[1.6,.35,.3],color:'#ffc93c',material:'Metal'}),partNode({parent:T.id,name:'Blade',pos:[o.x,y,z-2.5],size:[.18,.5,3.2],color:'#dfe6f5',material:'Metal'}),
      scriptNode({parent:T.id,name:'SwordScript',blocks:scriptOf(chain(blk('ev_tool_hit'),hitBranch(25,doIn(blk('g_sound',null,{SND:'explode'})))))})];}},
  {sec:'Tools',name:'Blaster',desc:'Shoots glowing bolts. Each hit on a rig deals 20 damage.',ico:['Tool','#5cc8ff'],make:o=>{const T={id:uid(),cls:'Tool',name:'Blaster',parent:'workspace',tooltip:'Pew pew',cooldown:.25,swing:false};
    const y=o.y+3,z=o.z;const h=partNode({parent:T.id,name:'Handle',pos:[o.x,y,z],size:[.4,.9,.5],color:'#263238'});T.handle=h.id;
    const tip=partNode({parent:T.id,name:'Barrel',shape:'cyl',pos:[o.x,y+.45,z-1.4],size:[.3,.35,.35],rot:[0,90,0],color:'#5cc8ff',material:'Neon'});
    return [T,h,partNode({parent:T.id,name:'Body',pos:[o.x,y+.45,z-.5],size:[.55,.55,1.8],color:'#455a64',material:'Metal'}),tip,
      scriptNode({parent:T.id,name:'BlasterScript',blocks:scriptOf(chain(blk('ev_tool_act'),blk('tool_shoot',{S:bn(220)},{COLOUR:'#5cc8ff'})),
        chain(blk('ev_tool_hit'),hitBranch(20)))})];}},
  {sec:'Tools',name:'Magic wand',desc:'Sparkling wand that shoots magic. Hits turn parts purple and hurt rigs.',ico:['Tool','#d68cff'],make:o=>{const T={id:uid(),cls:'Tool',name:'Magic Wand',parent:'workspace',tooltip:'Bibbidi',cooldown:.35,swing:false};
    const y=o.y+3,z=o.z;const h=partNode({parent:T.id,name:'Handle',shape:'cyl',pos:[o.x,y,z-.6],size:[2.4,.25,.25],rot:[0,90,0],color:'#3b2a20',material:'Wood'});T.handle=h.id;
    const star=partNode({parent:T.id,name:'Star',shape:'ball',pos:[o.x,y,z-1.9],size:[.5,.5,.5],color:'#d68cff',material:'Neon'});
    return [T,h,star,emitterNode({parent:star.id,name:'Sparkles',rate:10,size0:.4},'magic'),
      scriptNode({parent:T.id,name:'WandScript',blocks:scriptOf(chain(blk('ev_tool_act'),blk('tool_shoot',{S:bn(90)},{COLOUR:'#d68cff'})),
        chain(blk('ev_tool_hit'),blk('controls_if',{IF0:{block:blk('s_isrig',{PART:{block:{type:'tool_hitpart'},shadow:{type:'p_this'}}})},DO0:doIn(blk('rig_damage',{PART:{block:{type:'tool_hitpart'},shadow:{type:'p_this'}},N:bn(35)})),
          ELSE:doIn(blk('p_color',{PART:{block:{type:'tool_hitpart'},shadow:{type:'p_this'}}},{COLOUR:'#b18cff'}))},null,{extraState:{hasElse:true}})))})];}},
  {sec:'Tools',name:'Speed coil',desc:'Hold it to run at speed 30.',ico:['Tool','#3ddc84'],make:o=>{const T={id:uid(),cls:'Tool',name:'Speed Coil',parent:'workspace',tooltip:'Zoom!',cooldown:.3,swing:false};
    const h=partNode({parent:T.id,name:'Handle',shape:'cyl',pos:[o.x,o.y+3,o.z],size:[.8,.8,.8],rot:[0,90,0],color:'#3ddc84',material:'Neon'});T.handle=h.id;
    return [T,h,scriptNode({parent:T.id,name:'CoilScript',blocks:scriptOf(chain(blk('ev_tool_equip'),blk('pl_speed',{V:bn(30)})),chain(blk('ev_tool_unequip'),blk('pl_speed',{V:bn(16)})))})];}},
  {sec:'Tools',name:'Gravity coil',desc:'Hold it for floaty, high jumps.',ico:['Tool','#b18cff'],make:o=>{const T={id:uid(),cls:'Tool',name:'Gravity Coil',parent:'workspace',tooltip:'Moon jumps',cooldown:.3,swing:false};
    const h=partNode({parent:T.id,name:'Handle',shape:'cyl',pos:[o.x,o.y+3,o.z],size:[.8,.8,.8],rot:[0,90,0],color:'#b18cff',material:'Neon'});T.handle=h.id;
    return [T,h,scriptNode({parent:T.id,name:'CoilScript',blocks:scriptOf(chain(blk('ev_tool_equip'),blk('pl_gravity',{V:bn(70)})),chain(blk('ev_tool_unequip'),blk('pl_gravity',{V:bn(196.2)})))})];}},
  {sec:'Tools',name:'Healing potion',desc:'Use it to heal 50 health. It is used up.',ico:['Tool','#ff6b9a'],make:o=>{const T={id:uid(),cls:'Tool',name:'Potion',parent:'workspace',tooltip:'Heals 50',cooldown:.5,swing:false};
    const h=partNode({parent:T.id,name:'Handle',shape:'ball',pos:[o.x,o.y+3,o.z],size:[1,1,1],color:'#ff6b9a',material:'Glass'});T.handle=h.id;
    return [T,h,partNode({parent:T.id,name:'Cork',pos:[o.x,o.y+3,o.z-.6],size:[.35,.35,.35],color:'#8d6e63',material:'Wood'}),
      scriptNode({parent:T.id,name:'PotionScript',blocks:scriptOf(chain(blk('ev_tool_act'),blk('pl_heal',{N:bn(50)}),blk('g_sound',null,{SND:'check'}),blk('tool_take',null,{NAME:'Potion'})))})];}},
  {sec:'Characters',name:'Training dummy',desc:'A rig with 100 health that respawns 3 seconds after you knock it out.',ico:['Rig','#c7ccd6'],make:o=>{const r=rigNode({name:'Dummy',pos:[o.x,o.y+2.6,o.z],respawn:3,health:100,colors:{head:'#e8d39a',torso:'#c7a77a',arms:'#e8d39a',legs:'#8d6e63'}});
    return [r,scriptNode({parent:r.id,name:'KOScript',blocks:scriptOf(chain(blk('ev_rig_died'),blk('g_stat_change',{N:bn(1)},{STAT:'KOs'})))})];}},
  {sec:'Characters',name:'Shopkeeper',desc:'A rig that turns, waves and greets you when clicked.',ico:['Rig','#ffd75e'],make:o=>{const r=rigNode({name:'Shopkeeper',pos:[o.x,o.y+2.6,o.z],colors:{head:'#f5cd30',torso:'#8e24aa',arms:'#f5cd30',legs:'#3b2a20'}});
    return [r,scriptNode({parent:r.id,name:'GreetScript',blocks:scriptOf(chain(blk('ev_click'),blk('rig_face',{PART:bme()}),blk('rig_anim',{PART:bme()},{ANIM:'wave'}),
      blk('rig_say',{PART:bme(),TEXT:bt('Welcome to my shop!'),S:bn(3)}),blk('c_wait',{S:bn(3)}),blk('rig_anim',{PART:bme()},{ANIM:'idle'})))})];}},
  {sec:'Characters',name:'Patrolling guard',desc:'A rig that walks back and forth forever.',ico:['Rig','#5c9dff'],make:o=>{const r=rigNode({name:'Guard',pos:[o.x,o.y+2.6,o.z],colors:{head:'#f5cd30',torso:'#263238',arms:'#263238',legs:'#1b1b1b'},walkSpeed:10});
    return [r,scriptNode({parent:r.id,name:'PatrolScript',blocks:scriptOf(chain(blk('ev_start'),blk('c_forever',{DO:doIn(blk('rig_walk',{PART:bme(),X:bn(o.x+12),Z:bn(o.z)}),blk('c_wait',{S:bn(1)}),
      blk('rig_walk',{PART:bme(),X:bn(o.x-12),Z:bn(o.z)}),blk('c_wait',{S:bn(1)}))})))})];}},
  {sec:'Characters',name:'Follower',desc:'A small rig that follows you around and cheers.',ico:['Rig','#3ddc84'],make:o=>{const r=rigNode({name:'Buddy',pos:[o.x,o.y+1.56,o.z],scale:.6,colors:{head:'#f5cd30',torso:'#3ddc84',arms:'#f5cd30',legs:'#1e88e5'},walkSpeed:14});
    return [r,scriptNode({parent:r.id,name:'FollowScript',blocks:scriptOf(chain(blk('ev_start'),blk('c_forever',{DO:doIn(blk('rig_walkp',{PART:bme()}),blk('rig_anim',{PART:bme()},{ANIM:'cheer'}),blk('c_wait',{S:bn(.5)}),blk('rig_anim',{PART:bme()},{ANIM:'idle'}))})))})];}},
  {sec:'Effects',name:'Campfire',desc:'Logs with fire and smoke particle emitters.',ico:['ParticleEmitter','#ff8a1f'],make:o=>{const m=groupNode('Model',{name:'Campfire'});
    const fire=partNode({parent:m.id,name:'Flames',pos:[o.x,o.y+.9,o.z],size:[2,.6,2],transparency:1,canCollide:false});
    return [m,partNode({parent:m.id,name:'Log',pos:[o.x,o.y+.4,o.z],size:[4,.8,.8],rot:[0,45,0],color:'#6d4c41',material:'Wood'}),partNode({parent:m.id,name:'Log',pos:[o.x,o.y+.4,o.z],size:[4,.8,.8],rot:[0,-45,0],color:'#5d4037',material:'Wood'}),
      fire,emitterNode({parent:fire.id,name:'Fire'},'fire'),emitterNode({parent:fire.id,name:'Smoke'},'smoke')];}},
  {sec:'Effects',name:'Sparkle pickup',desc:'A glowing gem with sparkles that gives a point and bursts when touched.',ico:['ParticleEmitter','#d68cff'],make:o=>{const g=partNode({name:'Gem',shape:'ball',pos:[o.x,o.y+2,o.z],size:[2,2,2],color:'#d68cff',material:'Neon',canCollide:false});
    return [g,emitterNode({parent:g.id,name:'Sparkles'},'magic'),scriptNode({parent:g.id,name:'GemScript',blocks:scriptOf(chain(blk('ev_touch'),blk('pe_emit',{N:bn(60),PART:bme()}),blk('g_sound',null,{SND:'coin'}),
      blk('g_stat_change',{N:bn(1)},{STAT:'Gems'}),blk('p_visible',{PART:bme()},{B:'FALSE'}),blk('pe_toggle',{PART:bme()},{B:'FALSE'}),blk('c_wait',{S:bn(1.5)}),blk('p_destroy',{PART:bme()})))})];}},
  {sec:'Storage',name:'Crate spawner',desc:'Puts a Crate template in ReplicatedStorage and a button that drops copies of it.',ico:['Part','#0fbd8c'],make:o=>{
    const crate=partNode({parent:'rs',name:'Crate',pos:[0,1.5,0],size:[3,3,3],color:'#b07a45',material:'Wood',anchored:false});
    const btn=partNode({name:'CrateButton',pos:[o.x,o.y+.25,o.z],size:[4,.5,4],color:'#0fbd8c',material:'Neon'});
    return [crate,btn,scriptNode({parent:btn.id,name:'SpawnScript',blocks:scriptOf(chain(blk('ev_touch'),blk('g_sound',null,{SND:'pad'}),
      blk('rs_copy',{X:bn(o.x+6),Y:bn(o.y+14),Z:bn(o.z)},{NAME:'Crate'}),blk('c_wait',{S:bn(.6)})))})];}},
  {sec:'Models',name:'Tree',desc:'Trunk and leaves, grouped as a Model.',ico:['Model','#2e7d32'],make:o=>{const m=groupNode('Model',{name:'Tree'});
    return [m,partNode({parent:m.id,name:'Trunk',pos:[o.x,o.y+4,o.z],size:[2,8,2],color:'#6d4c41',material:'Wood'}),partNode({parent:m.id,name:'Leaves',pos:[o.x,o.y+10,o.z],size:[8,5,8],color:'#2e7d32',material:'Grass'})];}},
  {sec:'Models',name:'House',desc:'Four walls with a doorway and a wedge roof.',ico:['Model','#e8d39a'],make:o=>{const m=groupNode('Model',{name:'House'});const c='#e8d39a';const P=(name,pos,size,extra)=>partNode(Object.assign({parent:m.id,name,pos,size,color:c,material:'Brick'},extra||{}));
    const x=o.x,y=o.y,z=o.z;return [m,P('Floor',[x,y+.25,z],[20,.5,16],{color:'#8d6e63',material:'Wood'}),P('BackWall',[x,y+5,z-7.5],[20,9,1]),P('LeftWall',[x-9.5,y+5,z],[1,9,14]),P('RightWall',[x+9.5,y+5,z],[1,9,14]),
      P('FrontLeft',[x-6,y+5,z+7.5],[8,9,1]),P('FrontRight',[x+6,y+5,z+7.5],[8,9,1]),P('FrontTop',[x,y+8,z+7.5],[4,3,1]),
      P('RoofFront',[x,y+11.5,z+4.5],[21,4,9],{shape:'wedge',rot:[0,180,0],color:'#c4281c',material:'Plastic'}),P('RoofBack',[x,y+11.5,z-4.5],[21,4,9],{shape:'wedge',color:'#c4281c',material:'Plastic'})];}},
  {sec:'Models',name:'Staircase',desc:'Ten steps going up.',ico:['Model','#9fb4d6'],make:o=>{const m=groupNode('Model',{name:'Staircase'});const out=[m];
    for(let i=0;i<10;i++)out.push(partNode({parent:m.id,name:'Step',pos:[o.x,o.y+.5+i,o.z-i*2],size:[6,1,2],color:'#9fb4d6'}));return out;}},
  {sec:'Models',name:'Ramp',desc:'A walkable wedge ramp.',ico:['Part','#7cb342'],make:o=>[partNode({name:'Ramp',shape:'wedge',pos:[o.x,o.y+3,o.z],size:[8,6,16],color:'#7cb342'})]},
  {sec:'Models',name:'Obby segment',desc:'Five jumps over a lava strip, with a checkpoint.',ico:['Folder','#5c9dff'],make:o=>{const f=groupNode('Folder',{name:'ObbySegment'});const out=[f];
    for(let i=0;i<5;i++)out.push(partNode({parent:f.id,name:'Jump',pos:[o.x,o.y+1+i*1.2,o.z-6-i*9],size:[5,1,5],color:['#5c9dff','#9b6bff','#ff6bb5','#4fd1c5','#ffb84d'][i]}));
    out.push(partNode({parent:f.id,name:'Lava',pos:[o.x,o.y+.1,o.z-24],size:[16,.4,44],color:'#ff4a1f',behavior:'kill'}));
    out.push(partNode({parent:f.id,name:'Checkpoint',pos:[o.x,o.y+7,o.z-54],size:[10,1,10],color:'#3ddc84',behavior:'check',value:nextStage()}));return out;}}
];
function renderToolbox(){let h='',sec='';PREFABS.forEach((p,i)=>{if(p.sec!==sec){sec=p.sec;h+=`<div class="tb-sub">${sec}</div>`;}
  h+=`<button type="button" class="tb-item" data-pf="${i}"><span class="ico ${p.ico[0]}" style="background:${p.ico[1]}"></span><span><b>${esc(p.name)}</b><span>${esc(p.desc)}</span></span></button>`;});$('#toolbox').innerHTML=h;}
$('#toolbox').addEventListener('click',e=>{const b=e.target.closest('[data-pf]');if(!b)return;const pf=PREFABS[+b.dataset.pf];
  const p=dropPoint([1,0,1]);const nodes=pf.make({x:p[0],y:r3(p[1]),z:p[2]});const par=targetParent();
  nodes.forEach(n=>{if(n.parent!=='rs'&&n.parent!=='gui'&&n.parent!=='player'&&!nodes.some(m=>m.id===n.parent))n.parent=par;});
  ED.proj.nodes.push(...nodes);if(nodes.some(n=>n.parent==='rs'))ED.expanded.add('rs');if(nodes.some(n=>n.parent==='player'))ED.expanded.add('player');if(nodes.some(n=>n.parent==='gui'))ED.expanded.add('gui');commit();refreshAll();select([(nodes.find(n=>n.parent!=='rs')||nodes[0]).id]);closeDrawers();logOut('Inserted '+pf.name+'.','sys');
  if(nodes.some(n=>n.parent==='rs'))logOut('Its template is in ReplicatedStorage.','sys');});

/* ---- animation editor ---- */
const AE={r:null,scene:null,cam:null,rig:null,yaw:.7,pitch:.12,dist:13,time:0,playing:false,selKey:null,raf:0,last:0,drag:null};
function openAnim(id){const n=nodeOf(id);if(!n||n.cls!=='Animation')return;if(!ED.tabs.includes(id))ED.tabs.push(id);switchTab(id);closeDrawers();}
function curAnimNode(){const n=nodeOf(ED.tab);return n&&n.cls==='Animation'?n:null;}
function ensureAnimView(){
  if(AE.r)return true;
  try{AE.r=new THREE.WebGLRenderer({canvas:$('#anCv'),antialias:true});}catch(e){logOut('The animation preview could not start WebGL.','err');return false;}
  AE.r.setPixelRatio(Math.min(2,devicePixelRatio||1));AE.r.setClearColor(0x1a2438);
  AE.scene=new THREE.Scene();AE.scene.add(new THREE.HemisphereLight(0xdfefff,0x334055,.9));const dl=new THREE.DirectionalLight(0xffffff,.8);dl.position.set(5,10,7);AE.scene.add(dl);
  const grid=new THREE.GridHelper(20,20,0x3a4c70,0x24324d);grid.position.y=-3;AE.scene.add(grid);
  AE.cam=new THREE.PerspectiveCamera(40,1,.1,200);
  AE.rig=makeRigMesh({name:'',showName:false,colors:{}});AE.scene.add(AE.rig);
  const cv=$('#anCv');let drag=null;
  cv.addEventListener('pointerdown',e=>{drag={x:e.clientX,y:e.clientY};cv.setPointerCapture(e.pointerId);cv.style.cursor='grabbing';});
  cv.addEventListener('pointermove',e=>{if(!drag)return;AE.yaw-=(e.clientX-drag.x)*.01;AE.pitch=Math.max(-.6,Math.min(1.2,AE.pitch+(e.clientY-drag.y)*.01));drag={x:e.clientX,y:e.clientY};});
  const up=()=>{drag=null;cv.style.cursor='';};cv.addEventListener('pointerup',up);cv.addEventListener('pointercancel',up);
  cv.addEventListener('wheel',e=>{e.preventDefault();AE.dist=Math.max(6,Math.min(30,AE.dist*(1+Math.sign(e.deltaY)*.1)));},{passive:false});
  const ps=$('#anPreset');Object.keys(BUILTIN_ANIMS).forEach(k=>{const o=document.createElement('option');o.value=k;o.textContent=BUILTIN_ANIMS[k].name;ps.appendChild(o);});
  return true;
}
function animLoop(ts){
  const n=curAnimNode();if(!n||!ED.open){AE.raf=0;AE.playing=false;return;}
  const dt=Math.min(.1,(ts-(AE.last||ts))/1000);AE.last=ts;const a=animData(n);
  if(AE.playing){AE.time+=dt*a.speed;if(AE.time>=a.length){if(a.loop)AE.time%=a.length;else{AE.time=a.length;AE.playing=false;updateAnimBar(n);}}updateAnimHead(a);}
  const u=AE.rig.userData.rig;relaxPose(u,1,true);applyPose(u,sampleAnim(a,AE.time),1);
  const cv=$('#anCv'),w=cv.clientWidth,h=cv.clientHeight;
  if(w&&h){if(cv.width!==Math.round(w*AE.r.getPixelRatio())||cv.height!==Math.round(h*AE.r.getPixelRatio())){AE.r.setSize(w,h,false);AE.cam.aspect=w/h;AE.cam.updateProjectionMatrix();}
    AE.cam.position.set(Math.sin(AE.yaw)*Math.cos(AE.pitch)*AE.dist,.6+Math.sin(AE.pitch)*AE.dist,Math.cos(AE.yaw)*Math.cos(AE.pitch)*AE.dist);AE.cam.lookAt(0,.6,0);AE.r.render(AE.scene,AE.cam);}
  if(AE.playing&&AE.selKey)AE.selKey=null,renderAnimSide(n);
  AE.raf=requestAnimationFrame(animLoop);
}
function renderAnimEditor(){
  const n=curAnimNode();if(!n||!ensureAnimView())return;
  n.keys=animData(n).keys;n.length=animData(n).length;
  if(AE.selKey&&!n.keys.includes(AE.selKey))AE.selKey=n.keys.find(k=>Math.abs(k.t-AE.time)<.001)||null;
  AE.time=Math.min(AE.time,n.length);updateAnimBar(n);renderAnimTimeline(n);renderAnimSide(n);updateClipUI();
  if(!AE.raf){AE.last=0;AE.raf=requestAnimationFrame(animLoop);}
}
function updateAnimBar(n){const a=animData(n);$('#anPlay').textContent=AE.playing?'❚❚ Pause':'▶ Play';$('#anLoop').checked=a.loop;
  if(document.activeElement!==$('#anLen'))$('#anLen').value=a.length;if(document.activeElement!==$('#anSpd'))$('#anSpd').value=a.speed;}
function updateAnimHead(a){$('#anHead').style.left=`calc(8px + (100% - 16px) * ${AE.time/a.length})`;$('#anTimeTxt').textContent=AE.time.toFixed(2)+' s / '+a.length.toFixed(2)+' s';}
function renderAnimTimeline(n){
  const a=animData(n);const ru=$('#anRuler');ru.innerHTML='';const step=a.length<=2?.25:a.length<=6?.5:a.length<=15?1:2;
  for(let x=0;x<=a.length+1e-6;x+=step){const i=document.createElement('i');i.style.left=(x/a.length*100)+'%';const sp=document.createElement('span');sp.textContent=r3(x)+'s';i.appendChild(sp);ru.appendChild(i);}
  const ks=$('#anKeys');ks.innerHTML='';
  n.keys.forEach((k,i)=>{const b=document.createElement('button');b.type='button';b.className='an-key'+(k===AE.selKey?' sel':'');b.style.left=(k.t/a.length*100)+'%';b.dataset.ki=i;b.title='Keyframe at '+k.t.toFixed(2)+' s';b.setAttribute('aria-label',b.title);ks.appendChild(b);});
  updateAnimHead(a);
}
function renderAnimSide(n){
  const a=animData(n);const k=AE.selKey;const pose=k?k.pose:sampleAnim(a,AE.time);const dis=k?'':' disabled';
  let h=k?`<h4>Keyframe at ${k.t.toFixed(2)} s</h4><div class="pr"><span class="l">Easing in</span><select data-ae="ease">${EASES.map(([v,l])=>`<option value="${v}"${k.ease===v?' selected':''}>${l}</option>`).join('')}</select></div>`
    :`<p class="an-note">Showing the pose at ${AE.time.toFixed(2)} s. Click a ◆ on the timeline to edit that keyframe, or press <b>+ Keyframe</b> to add one here.</p>`;
  for(const [j,label] of JOINTS){const v=pose[j]||Z3;h+=`<h4>${label}</h4>`+['X','Y','Z'].map((ax,i)=>`<div class="jr"><b>${ax}</b><input type="range" min="-180" max="180" step="1" value="${Math.round(v[i])}" data-ae="j" data-j="${j}" data-i="${i}" aria-label="${label} ${ax} rotation"${dis}><span>${Math.round(v[i])}°</span></div>`).join('');
    if(j==='Body'){const rv=(pose.Root||Z3)[1];h+=`<div class="jr"><b>↕</b><input type="range" min="-3" max="3" step=".05" value="${rv}" data-ae="j" data-j="Root" data-i="1" aria-label="Body height"${dis}><span>${r3(rv)}</span></div>`;}}
  if(k)h+=`<div class="row" style="margin-top:10px;gap:6px"><button class="mini" type="button" data-ae="zero">Reset this pose</button><button class="mini" type="button" data-ae="copyprev">Copy previous</button></div>`;
  $('#anSide').innerHTML=h;
}
$('#anSide').addEventListener('input',e=>{const el=e.target;const k=AE.selKey;if(!k||el.dataset.ae!=='j')return;const j=el.dataset.j,i=+el.dataset.i;
  const v=(k.pose[j]||[0,0,0]).slice();v[i]=parseFloat(el.value)||0;k.pose[j]=v;el.nextElementSibling.textContent=j==='Root'?r3(v[i]):Math.round(v[i])+'°';});
$('#anSide').addEventListener('change',e=>{const el=e.target;const k=AE.selKey;if(!k)return;if(el.dataset.ae==='ease'){k.ease=el.value;}commit();});
$('#anSide').addEventListener('click',e=>{const b=e.target.closest('button[data-ae]');const n=curAnimNode();const k=AE.selKey;if(!b||!n||!k)return;
  if(b.dataset.ae==='zero')k.pose={};
  else if(b.dataset.ae==='copyprev'){const i=n.keys.indexOf(k);if(i>0)k.pose=JSON.parse(JSON.stringify(n.keys[i-1].pose));}
  commit();renderAnimSide(n);});
$('#anPlay').addEventListener('click',()=>{const n=curAnimNode();if(!n)return;const a=animData(n);if(!AE.playing&&AE.time>=a.length-1e-3)AE.time=0;AE.playing=!AE.playing;AE.selKey=null;updateAnimBar(n);renderAnimTimeline(n);renderAnimSide(n);});
$('#anLoop').addEventListener('change',e=>{const n=curAnimNode();if(!n)return;n.loop=e.target.checked;commit();renderProps();});
$('#anLen').addEventListener('change',e=>{const n=curAnimNode();if(!n)return;const v=Math.max(.1,Math.min(30,parseFloat(e.target.value)||n.length));
  const f=v/n.length;n.keys.forEach(k=>k.t=r3(k.t*f));n.length=v;AE.time=Math.min(AE.time*f,v);commit();renderAnimEditor();renderProps();});
$('#anSpd').addEventListener('change',e=>{const n=curAnimNode();if(!n)return;n.speed=Math.max(.05,Math.min(10,parseFloat(e.target.value)||1));commit();renderProps();});
$('#anPreset').addEventListener('change',e=>{const n=curAnimNode();const k=e.target.value;e.target.value='';if(!n||!BUILTIN_ANIMS[k])return;const B=BUILTIN_ANIMS[k];
  n.length=B.length;n.loop=B.loop;n.keys=JSON.parse(JSON.stringify(B.keys));AE.selKey=null;AE.time=0;commit();renderAnimEditor();renderProps();logOut('Loaded the '+B.name+' preset. Undo (Ctrl+Z) brings your keyframes back.','sys');});
$('#anMirror').addEventListener('click',()=>{const n=curAnimNode();if(!n)return;
  n.keys.forEach(k=>{[['LeftArm','RightArm'],['LeftLeg','RightLeg']].forEach(([l,r])=>{const v=k.pose[l];if(v)k.pose[r]=[v[0],-v[1],-v[2]];else delete k.pose[r];});});
  commit();renderAnimSide(n);logOut('Mirrored the left arm and leg onto the right side.','sys');});
$('#anAdd').addEventListener('click',()=>{const n=curAnimNode();if(!n)return;AE.playing=false;const a=animData(n);const t0=r3(Math.round(AE.time/.05)*.05);
  let k=n.keys.find(x=>Math.abs(x.t-t0)<.001);if(!k){const sp=sampleAnim(a,t0);const pose={};JNAMES.forEach(j=>{const v=sp[j];if(v&&v.some(c=>Math.abs(c)>.01))pose[j]=v.map(c=>r3(c));});
    k={t:t0,ease:'smooth',pose};n.keys.push(k);n.keys.sort((x,y)=>x.t-y.t);commit();}
  AE.selKey=k;AE.time=k.t;updateAnimBar(n);renderAnimTimeline(n);renderAnimSide(n);});
$('#anDel').addEventListener('click',()=>{const n=curAnimNode();if(!n||!AE.selKey)return;if(n.keys.length<=1){logOut('An animation needs at least one keyframe.','warn');return;}
  n.keys=n.keys.filter(k=>k!==AE.selKey);AE.selKey=null;commit();renderAnimTimeline(n);renderAnimSide(n);renderProps();});
function mirrorPose(p){const o={};const m=v=>[v[0],-v[1],-v[2]];
  if(p.Body)o.Body=m(p.Body);if(p.Head)o.Head=m(p.Head);if(p.Root)o.Root=[-p.Root[0],p.Root[1],p.Root[2]];
  if(p.LeftArm)o.RightArm=m(p.LeftArm);if(p.RightArm)o.LeftArm=m(p.RightArm);if(p.LeftLeg)o.RightLeg=m(p.LeftLeg);if(p.RightLeg)o.LeftLeg=m(p.RightLeg);return o;}
function animCopy(){const n=curAnimNode();if(!n)return;const a=animData(n);
  const pose=AE.selKey?AE.selKey.pose:(()=>{const sp=sampleAnim(a,AE.time),o={};JNAMES.forEach(j=>{if(sp[j].some(c=>Math.abs(c)>.01))o[j]=sp[j].map(r3);});return o;})();
  AE.clip={pose:JSON.parse(JSON.stringify(pose)),ease:AE.selKey?AE.selKey.ease:'smooth'};try{store.set('animClip',AE.clip);}catch(e){}
  updateClipUI();logOut(AE.selKey?'Copied the keyframe at '+AE.selKey.t.toFixed(2)+' s.':'Copied the pose at '+AE.time.toFixed(2)+' s.','sys');}
function animPaste(mirror){const n=curAnimNode();if(!n)return;if(!AE.clip){try{AE.clip=store.get('animClip',null);}catch(e){}}
  if(!AE.clip||!AE.clip.pose){logOut('Copy a keyframe first (select a ◆, then Copy or Ctrl+C).','warn');return;}
  AE.playing=false;const pose=cleanPose(mirror?mirrorPose(AE.clip.pose):JSON.parse(JSON.stringify(AE.clip.pose)));
  let k=AE.selKey;if(!k){const t0=r3(Math.round(AE.time/.05)*.05);k=n.keys.find(x=>Math.abs(x.t-t0)<.001);if(!k){k={t:t0,ease:AE.clip.ease||'smooth',pose:{}};n.keys.push(k);n.keys.sort((x,y)=>x.t-y.t);}}
  k.pose=pose;AE.selKey=k;AE.time=k.t;commit();updateAnimBar(n);renderAnimTimeline(n);renderAnimSide(n);renderProps();}
function updateClipUI(){let has=!!AE.clip;if(!has){try{has=!!store.get('animClip',null);}catch(e){}}$('#anPaste').disabled=!has;$('#anPasteM').disabled=!has;}
$('#anCopy').addEventListener('click',animCopy);$('#anPaste').addEventListener('click',()=>animPaste(false));$('#anPasteM').addEventListener('click',()=>animPaste(true));
function trackTime(e,a){const r=$('#anKeys').getBoundingClientRect();return Math.max(0,Math.min(a.length,(e.clientX-r.left)/r.width*a.length));}
$('#anTrack').addEventListener('pointerdown',e=>{const n=curAnimNode();if(!n)return;const a=animData(n);AE.playing=false;updateAnimBar(n);
  const kb=e.target.closest('.an-key');$('#anTrack').setPointerCapture(e.pointerId);
  if(kb){const k=n.keys[+kb.dataset.ki];AE.selKey=k;AE.time=k.t;AE.drag={k,x:e.clientX,moved:false};}
  else{AE.time=trackTime(e,a);const near=n.keys.find(k=>Math.abs(k.t-AE.time)<a.length*.015);if(near){AE.selKey=near;AE.time=near.t;}else AE.selKey=null;AE.drag={scrub:true};}
  renderAnimTimeline(n);renderAnimSide(n);e.preventDefault();});
$('#anTrack').addEventListener('pointermove',e=>{const d=AE.drag;const n=curAnimNode();if(!d||!n)return;const a=animData(n);
  if(d.scrub){AE.time=trackTime(e,a);AE.selKey=null;updateAnimHead(a);return;}
  if(Math.abs(e.clientX-d.x)>3)d.moved=true;if(!d.moved)return;d.k.t=r3(Math.round(trackTime(e,a)/.05)*.05);AE.time=d.k.t;
  const el=$('#anKeys').querySelector('.an-key.sel');if(el)el.style.left=(d.k.t/a.length*100)+'%';updateAnimHead(a);});
const anUp=()=>{const d=AE.drag;AE.drag=null;const n=curAnimNode();if(!d||!n)return;if(d.scrub){renderAnimSide(n);return;}
  if(d.moved){const dup=n.keys.find(k=>k!==d.k&&Math.abs(k.t-d.k.t)<.001);if(dup)n.keys=n.keys.filter(k=>k!==dup);n.keys.sort((x,y)=>x.t-y.t);commit();}renderAnimTimeline(n);renderAnimSide(n);};
$('#anTrack').addEventListener('pointerup',anUp);$('#anTrack').addEventListener('pointercancel',anUp);

/* ---- GUI editor ---- */
let GUIE={k:1,w:1280,h:720,drag:null};
function renderGuiEditor(){
  if(!ED.proj||ED.tab!=='gui')return;
  const [w,h]=($('#guiDevice').value||'1280x720').split('x').map(Number);GUIE.w=w;GUIE.h=h;
  const st=$('#guiStage'),sc=$('#guiScreen');const sw=st.clientWidth-24,sh=st.clientHeight-24;const k=Math.min(1,sw/w,sh/h);GUIE.k=k;
  sc.style.width=w+'px';sc.style.height=h+'px';sc.style.transform=`translate(${Math.max(12,(st.clientWidth-w*k)/2)}px,${Math.max(12,(st.clientHeight-h*k)/2)}px) scale(${k})`;
  sc.style.backgroundImage=ED.proj.thumb?`url(${ED.proj.thumb})`:'';
  const map=buildGuiDom(ED.proj,sc,{editor:true});
  if(!ED.proj.nodes.some(n=>n.cls==='ScreenGui')){const hint=document.createElement('div');hint.style.cssText='position:absolute;inset:0;display:grid;place-items:center;color:#0d1420;font:700 22px Figtree,sans-serif;opacity:.6;text-align:center;padding:40px';hint.textContent='Insert a Text, Button or Frame from the ribbon to start your interface.';sc.appendChild(hint);}
  for(const id of ED.sel){const el=map.get(id);const n=nodeOf(id);if(el&&n&&n.cls!=='ScreenGui'){el.classList.add('sel');const hd=document.createElement('div');hd.className='gh';hd.dataset.handle='1';el.appendChild(hd);}}
}
$('#guiDevice').addEventListener('change',renderGuiEditor);
addEventListener('resize',()=>{if(ED.open&&ED.tab==='gui')renderGuiEditor();});
$('#guiScreen').addEventListener('pointerdown',e=>{
  const el=e.target.closest('[data-id]');if(!el||el.classList.contains('gui-sg')){select([]);return;}
  const id=el.dataset.id;if(!ED.sel.includes(id))select([id],e.shiftKey);
  const n=nodeOf(id);if(!n||n.cls==='ScreenGui')return;
  GUIE.drag={id,mode:e.target.dataset.handle?'size':'move',x:e.clientX,y:e.clientY,start:(e.target.dataset.handle?n.gsize:n.gpos).slice(),moved:false};
  try{$('#guiScreen').setPointerCapture(e.pointerId);}catch(_){}e.preventDefault();
});
$('#guiScreen').addEventListener('pointermove',e=>{const d=GUIE.drag;if(!d)return;const n=nodeOf(d.id);if(!n)return;
  const dx=(e.clientX-d.x)/GUIE.k,dy=(e.clientY-d.y)/GUIE.k;if(Math.abs(dx)+Math.abs(dy)>2)d.moved=true;if(!d.moved)return;
  const sn=v=>ED.snap?Math.round(v/4)*4:Math.round(v);const a=d.start.slice();
  if(d.mode==='move'){a[1]=sn(a[1]+dx);a[3]=sn(a[3]+dy);n.gpos=a;}else{a[1]=Math.max(8-a[0]*GUIE.w,sn(a[1]+dx));a[3]=Math.max(8-a[2]*GUIE.h,sn(a[3]+dy));n.gsize=a;}
  const el=$('#guiScreen').querySelector(`[data-id="${d.id}"]`);if(el)styleGuiEl(el,n);
  document.querySelectorAll('#props .v3 input').forEach(i=>{const arr=n[i.dataset.k];if(arr&&document.activeElement!==i)i.value=r3(num(arr[+i.dataset.i],0));});});
const guiUp=e=>{const d=GUIE.drag;if(!d)return;GUIE.drag=null;if(d.moved){commit();renderGuiEditor();renderProps();}};
$('#guiScreen').addEventListener('pointerup',guiUp);$('#guiScreen').addEventListener('pointercancel',guiUp);
$('#guiScreen').addEventListener('dblclick',e=>{const el=e.target.closest('[data-id]');const n=el&&nodeOf(el.dataset.id);if(n&&n.cls!=='Frame'&&n.cls!=='ScreenGui'){const i=$('#p_text');if(i){i.focus();i.select();}}});

/* ---- assets: mesh uploader ---- */
function assetMsg(t,err){const m=$('#assetMsg');m.hidden=!t;m.textContent=t||'';m.classList.toggle('err',!!err);}
function loadAssetList(){return IDB.all().then(list=>{ED.assets=(list||[]).map(a=>{cacheAsset(a);return {id:a.id,name:a.name,tris:a.tris,ext:a.ext,vc:!!a.col,created:a.created};}).sort((a,b)=>b.created-a.created);renderAssets();})
  .catch(()=>{assetMsg('This browser blocked local storage for meshes, so uploads cannot be saved here.',true);});}
let assetDelArm=null;
function renderAssets(){const el=$('#assetList');if(!el)return;
  if(!ED.assets.length){el.innerHTML='<p class="pnote">No meshes yet. Upload one to use it as a MeshPart.</p>';return;}
  el.innerHTML=ED.assets.map(a=>`<div class="as-item"><b title="${esc(a.name)}">${esc(a.name)}</b><span>${a.tris.toLocaleString()} triangles${a.vc?' · colored':''}</span>
    <div class="acts"><button class="mini pri" type="button" data-asi="${a.id}">Insert</button><button class="mini danger" type="button" data-asd="${a.id}" aria-label="Delete ${esc(a.name)}">${assetDelArm===a.id?'Sure?':'✕'}</button></div></div>`).join('');}
$('#assetList').addEventListener('click',e=>{const ins=e.target.closest('[data-asi]'),dl=e.target.closest('[data-asd]');
  if(ins){const a=ED.assets.find(x=>x.id===ins.dataset.asi);if(!a)return;const mx=Math.max(...a.ext)||1,k=8/mx;
    const n=partNode({name:a.name.replace(/\.[^.]+$/,'').replace(/[^\w\- ]+/g,'').slice(0,40)||'Mesh',shape:'mesh',meshId:a.id,meshName:a.name,size:a.ext.map(v=>Math.max(.2,r3(v*k))),color:a.vc?'#ffffff':'#a3a2a5',parent:targetParent(false,true)});
    n.pos=dropPoint(n.size);ED.proj.nodes.push(n);commit();refreshAll();select([n.id]);closeDrawers();insertedNote(n);}
  if(dl){const id=dl.dataset.asd;if(assetDelArm!==id){assetDelArm=id;renderAssets();setTimeout(()=>{if(assetDelArm===id){assetDelArm=null;renderAssets();}},3000);return;}
    assetDelArm=null;IDB.del(id).then(()=>{ED.assets=ED.assets.filter(x=>x.id!==id);renderAssets();}).catch(()=>{});
    const used=ED.proj.nodes.filter(n=>n.meshId===id).length;if(used)logOut('Deleted the mesh. '+used+' part'+(used>1?'s':'')+' that used it now show as blocks.','warn');}});
$('#meshFile').addEventListener('change',e=>{const f=e.target.files[0];if(f)uploadMesh(f);e.target.value='';});
const adrop=$('#assetDrop');
['dragenter','dragover'].forEach(evn=>adrop.addEventListener(evn,e=>{e.preventDefault();adrop.classList.add('over');}));
['dragleave','drop'].forEach(evn=>adrop.addEventListener(evn,e=>{e.preventDefault();adrop.classList.remove('over');}));
adrop.addEventListener('drop',e=>{const f=e.dataTransfer.files[0];if(f)uploadMesh(f);});
function sampler(img){try{const w=Math.min(256,img.width||256),h=Math.min(256,img.height||256);const c=document.createElement('canvas');c.width=w;c.height=h;const g=c.getContext('2d');g.drawImage(img,0,0,w,h);
  const d=g.getImageData(0,0,w,h).data;return (u,v)=>{u=u-Math.floor(u);v=v-Math.floor(v);const x=Math.min(w-1,Math.floor(u*w)),y=Math.min(h-1,Math.floor(v*h)),i=(y*w+x)*4;return [d[i]/255,d[i+1]/255,d[i+2]/255];};}catch(e){return null;}}
function objectToArrays(root,linearColors){
  root.updateMatrixWorld(true);const P=[],N=[],C=[];let colored=false;const v=new V3(),nv=new V3(),nm=new THREE.Matrix3();
  root.traverse(o=>{if(!o.isMesh||!o.geometry)return;let g=o.geometry;if(g.index)g=g.toNonIndexed();if(!g.attributes.position)return;
    const pos=g.attributes.position,nrm=g.attributes.normal,uv=g.attributes.uv,ca=g.attributes.color;
    const m=Array.isArray(o.material)?o.material[0]:o.material;const base=m&&m.color?m.color.clone():new THREE.Color(1,1,1);if(linearColors)base.convertLinearToSRGB();
    const smp=m&&m.map&&m.map.image&&uv?sampler(m.map.image):null;const flip=m&&m.map&&m.map.flipY;
    if((base.r+base.g+base.b)<2.99||ca||smp)colored=true;nm.getNormalMatrix(o.matrixWorld);
    for(let i=0;i<pos.count;i++){v.fromBufferAttribute(pos,i).applyMatrix4(o.matrixWorld);P.push(v.x,v.y,v.z);
      if(nrm){nv.fromBufferAttribute(nrm,i).applyMatrix3(nm).normalize();N.push(nv.x,nv.y,nv.z);}else N.push(0,0,0);
      let r=base.r,gg=base.g,bb=base.b;
      if(ca){const cc=new THREE.Color(ca.getX(i),ca.getY(i),ca.getZ(i));if(linearColors)cc.convertLinearToSRGB();r*=cc.r;gg*=cc.g;bb*=cc.b;}
      if(smp){const s_=smp(uv.getX(i),flip?1-uv.getY(i):uv.getY(i));r*=s_[0];gg*=s_[1];bb*=s_[2];}
      C.push(r,gg,bb);}});
  return {pos:new Float32Array(P),nrm:N.some(x=>x!==0)?new Float32Array(N):null,col:colored?new Float32Array(C):null};
}
function finalizeMesh(name,arr){
  const tris=arr.pos.length/9;if(!tris)throw new Error('No triangles were found in '+name+'.');
  if(tris>150000)throw new Error(name+' has '+Math.round(tris).toLocaleString()+' triangles. The limit is 150,000, so simplify it in a 3D app first.');
  const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.BufferAttribute(arr.pos,3));
  if(arr.nrm)g.setAttribute('normal',new THREE.BufferAttribute(arr.nrm,3));else g.computeVertexNormals();
  g.computeBoundingBox();const bb=g.boundingBox,ext=bb.getSize(new V3()),c=bb.getCenter(new V3());
  if(![ext.x,ext.y,ext.z].every(isFinite))throw new Error(name+' has broken vertex data.');
  const e=[Math.max(ext.x,1e-4),Math.max(ext.y,1e-4),Math.max(ext.z,1e-4)];
  const Pa=g.attributes.position.array,Na=g.attributes.normal.array,n8=new Int8Array(Na.length);
  for(let i=0;i<Pa.length;i+=3){Pa[i]=(Pa[i]-c.x)/e[0];Pa[i+1]=(Pa[i+1]-c.y)/e[1];Pa[i+2]=(Pa[i+2]-c.z)/e[2];
    let x=Na[i]*e[0],y=Na[i+1]*e[1],z=Na[i+2]*e[2];const l=Math.hypot(x,y,z)||1;n8[i]=Math.round(x/l*127);n8[i+1]=Math.round(y/l*127);n8[i+2]=Math.round(z/l*127);}
  let c8=null;if(arr.col){c8=new Uint8Array(arr.col.length);for(let i=0;i<arr.col.length;i++)c8[i]=Math.max(0,Math.min(255,Math.round(arr.col[i]*255)));}
  return {id:uid(),name,tris:Math.round(tris),pos:new Float32Array(Pa),nrm:n8,col:c8,ext:[r3(ext.x),r3(ext.y),r3(ext.z)],created:Date.now()};
}
async function uploadMesh(f){
  const ext=(f.name.split('.').pop()||'').toLowerCase();
  if(!['obj','stl','glb','gltf'].includes(ext)){assetMsg('Choose an .obj, .stl, .glb or .gltf file.',true);return;}
  if(f.size>40*1024*1024){assetMsg(f.name+' is larger than 40 MB.',true);return;}
  assetMsg('Processing '+f.name+'…');
  try{
    let arr;
    if(ext==='obj'){if(!THREE.OBJLoader)throw new Error('The OBJ reader could not load. Check your connection.');arr=objectToArrays(new THREE.OBJLoader().parse(await f.text()),false);}
    else if(ext==='stl'){if(!THREE.STLLoader)throw new Error('The STL reader could not load. Check your connection.');const g=new THREE.STLLoader().parse(await f.arrayBuffer());
      const m=new THREE.Mesh(g,new THREE.MeshStandardMaterial({vertexColors:!!g.attributes.color}));arr=objectToArrays(m,false);}
    else{if(!THREE.GLTFLoader)throw new Error('The glTF reader could not load. Check your connection.');const buf=await f.arrayBuffer();
      const gltf=await new Promise((res,rej)=>new THREE.GLTFLoader().parse(ext==='gltf'?new TextDecoder().decode(buf):buf,'',res,err=>rej(new Error(/draco/i.test(String(err&&err.message||err))?'This file uses Draco compression, which Brickyard cannot read. Export it again without compression.':ext==='gltf'?'This .gltf points to separate files. Export it as a single .glb instead.':'Could not read '+f.name+'.'))));
      arr=objectToArrays(gltf.scene,true);}
    const a=finalizeMesh(f.name,arr);
    await IDB.put(a);cacheAsset(a);ED.assets.unshift({id:a.id,name:a.name,tris:a.tris,ext:a.ext,vc:!!a.col,created:a.created});
    assetMsg('Uploaded '+f.name+' ('+a.tris.toLocaleString()+' triangles). Press Insert to add it.');renderAssets();logOut('Uploaded mesh '+f.name+'.','sys');
  }catch(e){assetMsg((e&&e.message)||'Could not read that file.',true);}
}

/* ---- doc tabs & block editor ---- */
function renderTabs(){
  let h=`<button class="doc-tab" role="tab" type="button" data-tab="viewport" aria-selected="${ED.tab==='viewport'}">3D Viewport</button><button class="doc-tab" role="tab" type="button" data-tab="gui" aria-selected="${ED.tab==='gui'}">GUI</button>`;
  ED.tabs.forEach(id=>{const n=nodeOf(id);if(!n)return;const par=nodeOf(n.parent);
    h+=`<div class="doc-tab" role="tab" data-tab="${id}" aria-selected="${ED.tab===id}" tabindex="0"><span>${esc(n.name)}${par?' · '+esc(par.name):''}</span><button class="x" type="button" data-close="${id}" aria-label="Close tab">×</button></div>`;});
  $('#docTabs').innerHTML=h;
}
$('#docTabs').addEventListener('click',e=>{const c=e.target.closest('[data-close]');if(c){closeTab(c.dataset.close);return;}const tb=e.target.closest('[data-tab]');if(tb)switchTab(tb.dataset.tab);});
function closeTab(id){if(ED.tab===id){saveWs();ED.tab='viewport';}ED.tabs=ED.tabs.filter(x=>x!==id);renderTabs();switchTab(ED.tab);}
function openScript(id){const n=nodeOf(id);if(!n||n.cls!=='Script')return;if(!ED.tabs.includes(id))ED.tabs.push(id);switchTab(id);closeDrawers();}
function switchTab(id){
  if(ED.tab!=='viewport'&&ED.tab!==id)saveWs();
  ED.tab=id;renderTabs();
  const isV=id==='viewport',isG=id==='gui',isA=!isV&&!isG&&(nodeOf(id)||{}).cls==='Animation';$('#stView').hidden=!isV;$('#stBlocks').hidden=isV||isG||isA;$('#stGui').hidden=!isG;$('#stAnim').hidden=!isA;
  if(isV){requestAnimationFrame(resizeStudio);return;}
  if(isA){AE.selKey=null;AE.time=0;AE.playing=false;requestAnimationFrame(renderAnimEditor);return;}
  if(isG){requestAnimationFrame(renderGuiEditor);return;}
  if(!ensureBlockly())return;
  requestAnimationFrame(()=>{Blockly.svgResize(ED.ws);loadScriptToWs(nodeOf(id));});
}
function loadScriptToWs(n){
  if(n&&n.cls==='Animation'){renderAnimEditor();return;}
  if(!ED.ws||!n||n.cls!=='Script')return;ED.loadingWs=true;
  Blockly.Events.disable();
  try{ED.ws.clear();Blockly.serialization.workspaces.load(n.blocks||SCR.startDefault(),ED.ws);}
  catch(e){logOut('Could not load blocks for '+n.name+': '+e.message,'err');}
  try{projVarNames().forEach(nm=>{if(!ED.ws.getVariable(nm,''))ED.ws.createVariable(nm,'');});}catch(e){}
  Blockly.Events.enable();ED.loadingWs=false;
  ED.ws.scroll(0,0);
}
/* Variables are global: every script in a game shares them by name, so the editor shows every variable in every script. */
function projVarNames(){const set=new Set((ED.proj&&ED.proj.vars)||[]);if(ED.proj)for(const n of ED.proj.nodes)if(n.cls==='Script'&&n.blocks&&Array.isArray(n.blocks.variables))n.blocks.variables.forEach(v=>{if(v&&v.name&&!v.type)set.add(v.name);});return [...set].sort((a,b)=>a.localeCompare(b));}
function varUsed(blocks,id){let used=false;const walk=b=>{if(!b||used)return;const f=b.fields&&b.fields.VAR;if(f&&(f.id===id||f===id))used=true;
  if(b.inputs)for(const k in b.inputs){walk(b.inputs[k].block);walk(b.inputs[k].shadow);}if(b.next)walk(b.next.block);};
  ((blocks&&blocks.blocks&&blocks.blocks.blocks)||[]).forEach(walk);return used;}
function onVarEvent(e){
  if(!ED.proj)return;const P_=ED.proj;P_.vars=Array.isArray(P_.vars)?P_.vars:[];const cur=ED.tab;
  if(e.type===Blockly.Events.VAR_CREATE&&!e.varType){if(!P_.vars.includes(e.varName))P_.vars.push(e.varName);}
  else if(e.type===Blockly.Events.VAR_RENAME){const o=e.oldName,nn=e.newName;P_.vars=P_.vars.map(v=>v===o?nn:v);if(!P_.vars.includes(nn))P_.vars.push(nn);
    let k=0;for(const n of P_.nodes){if(n.cls!=='Script'||n.id===cur||!n.blocks||!Array.isArray(n.blocks.variables))continue;const vs=n.blocks.variables;
      if(vs.some(v=>v.name===nn))continue;vs.forEach(v=>{if(v.name===o){v.name=nn;k++;}});}
    if(k)logOut('Renamed the variable "'+o+'" to "'+nn+'" in every script.','sys');}
  else if(e.type===Blockly.Events.VAR_DELETE){const nm=e.varName;const still=[];
    for(const n of P_.nodes){if(n.cls!=='Script'||n.id===cur||!n.blocks||!Array.isArray(n.blocks.variables))continue;const vs=n.blocks.variables;
      const v=vs.find(x=>x.name===nm);if(!v)continue;if(varUsed(n.blocks,v.id))still.push(n.name);else n.blocks.variables=vs.filter(x=>x!==v);}
    if(still.length)logOut('"'+nm+'" is still used in '+still.join(', ')+', so it stays in those scripts.','warn');else P_.vars=P_.vars.filter(v=>v!==nm);}
}
function saveWs(){if(!ED.ws||ED.tab==='viewport'||ED.tab==='gui')return;const n=nodeOf(ED.tab);if(!n||n.cls!=='Script')return;n.blocks=Blockly.serialization.workspaces.save(ED.ws);}
let wsSaveT=0;
/* In-page replacements for prompt/confirm/alert, which are blocked inside embedded pages. Blockly uses them to create, rename and delete variables. */
function byDialog(kind,msg,def,cb){
  const wrap=document.createElement('div');wrap.className='emodal bdlg';wrap.setAttribute('role','dialog');wrap.setAttribute('aria-modal','true');
  wrap.innerHTML=`<div class="panel"><p class="bdmsg"></p>${kind==='prompt'?'<input type="text" autocomplete="off" spellcheck="false">':''}<div class="row"><button class="btn" type="button" data-b="ok">OK</button>${kind==='alert'?'':'<button class="btn ghost" type="button" data-b="no">Cancel</button>'}</div></div>`;
  wrap.querySelector('.bdmsg').textContent=String(msg||'');const inp=wrap.querySelector('input');if(inp)inp.value=def==null?'':String(def);
  const prevFocus=document.activeElement;let done=false;
  const finish=ok=>{if(done)return;done=true;wrap.remove();try{prevFocus&&prevFocus.focus&&prevFocus.focus({preventScroll:true});}catch(e){}
    if(kind==='prompt')cb&&cb(ok?inp.value:null);else if(kind==='confirm')cb&&cb(!!ok);else cb&&cb();};
  wrap.addEventListener('click',e=>{const b=e.target.closest('[data-b]');if(b)finish(b.dataset.b==='ok');else if(e.target===wrap&&kind!=='alert')finish(false);});
  wrap.addEventListener('keydown',e=>{e.stopPropagation();if(e.key==='Enter'){e.preventDefault();finish(true);}else if(e.key==='Escape'){e.preventDefault();finish(kind==='alert');}});
  document.body.appendChild(wrap);setTimeout(()=>{(inp||wrap.querySelector('[data-b="ok"]')).focus();if(inp)inp.select();},20);
}
function ensureBlockly(){
  if(ED.ws)return true;
  if(window.Blockly&&Blockly.dialog&&!ensureBlockly.dlg){ensureBlockly.dlg=true;
    Blockly.dialog.setPrompt((m,d,cb)=>byDialog('prompt',m,d,cb));Blockly.dialog.setConfirm((m,cb)=>byDialog('confirm',m,null,cb));Blockly.dialog.setAlert((m,cb)=>byDialog('alert',m,null,cb));}
  if(!window.Blockly){$('#blockly').innerHTML='<div class="bl-empty">The block editor could not load. Check your connection and reload the page.</div>';return false;}
  defineBlocks();
  ED.ws=Blockly.inject('blockly',{toolbox:TOOLBOX,renderer:'zelos',theme:BLOCK_THEME,sounds:false,media:'',trashcan:false,
    zoom:{controls:false,wheel:true,startScale:coarse?.7:.8,maxScale:2,minScale:.35},move:{scrollbars:true,drag:true,wheel:false},
    grid:{spacing:28,length:3,colour:'#243250',snap:false}});
  ED.ws.registerToolboxCategoryCallback('BY_VARS',w=>{const X=Blockly.utils.xml;const out=[];
    const note=X.createElement('label');note.setAttribute('text','Variables are shared by every script in this game');out.push(note);
    out.push(...Blockly.Variables.flyoutCategory(w));const vs=w.getVariablesOfType('');
    if(vs.length){const v=vs[0];const l2=X.createElement('label');l2.setAttribute('text','Online: change it for every player at once');out.push(l2);
      for(const [type,inp,num] of [['var_share_set','VALUE','0'],['var_share_change','N','1']]){const bx=X.createElement('block');bx.setAttribute('type',type);bx.appendChild(Blockly.Variables.generateVariableFieldDom(v));
        bx.appendChild(X.textToDom(`<value name="${inp}"><shadow type="math_number"><field name="NUM">${num}</field></shadow></value>`));out.push(bx);}}
    return out;});
  ED.ws.addChangeListener(e=>{if(!ED.loadingWs&&(e.type===Blockly.Events.VAR_CREATE||e.type===Blockly.Events.VAR_RENAME||e.type===Blockly.Events.VAR_DELETE))onVarEvent(e);});
  ED.ws.addChangeListener(e=>{if(e.isUiEvent||ED.loadingWs||ED.tab==='viewport')return;clearTimeout(wsSaveT);wsSaveT=setTimeout(()=>{saveWs();scheduleSave();},250);});
  return true;
}
$('#viewLua').addEventListener('click',()=>{saveWs();const n=nodeOf(ED.tab);if(!n)return;
  showModal(`<h2>${esc(n.name)} as Lua</h2><p class="sub">This is the Roblox Lua that Brickyard writes for this script when you export. It needs the BY helper library, which export adds at the top of every script.</p>
  <textarea readonly id="luaOut" aria-label="Lua code">${esc(luaForScript(n,false))}</textarea><div class="row"><button class="btn" type="button" data-m="copy">Copy</button><button class="btn ghost" type="button" data-m="close">Close</button></div>`);});

/* ---- modal / export ---- */
function showModal(html){$('#epanel').innerHTML=html;$('#emodal').hidden=false;}
$('#emodal').addEventListener('click',e=>{if(e.target.id==='emodal'){$('#emodal').hidden=true;return;}const b=e.target.closest('[data-m]');if(!b)return;
  if(b.dataset.m==='close')$('#emodal').hidden=true;
  if(b.dataset.m==='copy'){const ta=b.dataset.t?$('#'+b.dataset.t):$('#epanel textarea');const done=()=>{b.textContent='Copied';setTimeout(()=>b.textContent='Copy',1500);};
    try{navigator.clipboard.writeText(ta.value).then(done,()=>{ta.focus();ta.select();b.textContent='Press Ctrl+C';});}catch(_){ta.focus();ta.select();b.textContent='Press Ctrl+C';}}});
function showExport(){
  if(ED.ws&&ED.tab!=='viewport')saveWs();
  const xml=exportRbxlx(ED.proj);
  showModal(`<h2>Export to Roblox Studio</h2><ol><li>Copy the text below.</li><li>Paste it into a plain text editor and save it as <b>${esc(ED.proj.name.replace(/[^\w\- ]+/g,''))}.rbxlx</b>.</li><li>In Roblox Studio, choose File → Open from File and pick that file.</li></ol>
  <p class="sub">Parts, folders, models, rigs, particle emitters, ReplicatedStorage, colors, materials and settings carry over. Block scripts become Lua Scripts. Key-press and rig-animation blocks become comments, because Roblox needs a LocalScript or animation asset ids for those. Uploaded meshes become placeholder blocks named after the mesh, because Roblox needs you to upload the mesh file there.</p>
  <textarea readonly aria-label="Exported place file">${esc(xml)}</textarea><div class="row"><button class="btn" type="button" data-m="copy">Copy</button><button class="btn ghost" type="button" data-m="close">Close</button></div>`);
}

/* ---- Lua generation ---- */
const LUA_LIB=`-- Brickyard block helpers
local Players = game:GetService("Players")
local TweenService = game:GetService("TweenService")
local BY = _G.BY or { vars = {}, on = {}, t0 = os.clock() }
_G.BY = BY
local function player() return Players:GetPlayers()[1] end
local function hum() local p = player() local c = p and p.Character return c and c:FindFirstChildOfClass("Humanoid") end
local function root() local p = player() local c = p and p.Character return c and c:FindFirstChild("HumanoidRootPart") end
function BY.fire(name) for _, f in ipairs(BY.on[name] or {}) do task.spawn(f) end end
function BY.listen(name, f) BY.on[name] = BY.on[name] or {} table.insert(BY.on[name], f) end
function BY.stat(name)
  local p = player() or Players.PlayerAdded:Wait()
  local ls = p:FindFirstChild("leaderstats") or Instance.new("Folder")
  ls.Name = "leaderstats" ls.Parent = p
  local v = ls:FindFirstChild(name) or Instance.new("NumberValue")
  v.Name = name v.Parent = ls
  return v
end
local function parts(obj)
  if not obj then return {} end
  if obj:IsA("BasePart") then return { obj } end
  local t = {}
  for _, d in ipairs(obj:GetDescendants()) do if d:IsA("BasePart") then table.insert(t, d) end end
  return t
end
local function sizeOf(obj) if obj:IsA("Model") then return obj:GetExtentsSize() end return obj.Size end
function BY.move(obj, x, y, z) if obj then obj:PivotTo(obj:GetPivot() + Vector3.new(x, y, z)) end end
function BY.setpos(obj, x, y, z) if obj then obj:PivotTo(CFrame.new(x, y, z) * obj:GetPivot().Rotation) end end
function BY.glide(obj, x, y, z, t, relative)
  if not obj then task.wait(t) return end
  local start = obj:GetPivot()
  local goal = relative and start + Vector3.new(x, y, z) or CFrame.new(x, y, z) * start.Rotation
  local cv = Instance.new("CFrameValue")
  cv.Value = start
  cv.Changed:Connect(function(v) obj:PivotTo(v) end)
  local tw = TweenService:Create(cv, TweenInfo.new(t, Enum.EasingStyle.Linear), { Value = goal })
  tw:Play() tw.Completed:Wait() cv:Destroy()
end
function BY.rotate(obj, deg, axis)
  if not obj then return end
  local r = math.rad(deg)
  local a = axis == "x" and CFrame.Angles(r, 0, 0) or axis == "z" and CFrame.Angles(0, 0, r) or CFrame.Angles(0, r, 0)
  obj:PivotTo(obj:GetPivot() * a)
end
function BY.set(obj, prop, value) for _, p in ipairs(parts(obj)) do p[prop] = value end end
function BY.clone(obj, x, y, z) if obj then local c = obj:Clone() c.Parent = obj.Parent c:PivotTo(c:GetPivot() + Vector3.new(x, y, z)) end end
function BY.destroy(obj) if obj then obj:Destroy() end end
function BY.kill() local h = hum() if h then h.Health = 0 end end
function BY.copy(name, place)
  local t = game:GetService("ReplicatedStorage"):FindFirstChild(name, true)
  if not t then warn("Nothing named " .. name .. " in ReplicatedStorage") return nil end
  local c = t:Clone()
  c.Parent = workspace
  if c:IsA("PVInstance") then place(c) end
  BY.last = c
  return c
end
function BY.copyTo(name, x, y, z) return BY.copy(name, function(c) c:PivotTo(CFrame.new(x, y, z) * c:GetPivot().Rotation) end) end
function BY.copyOnto(name, target)
  if not target then return nil end
  return BY.copy(name, function(c)
    local top = target:GetPivot().Position + Vector3.new(0, sizeOf(target).Y / 2 + sizeOf(c).Y / 2, 0)
    c:PivotTo(CFrame.new(top) * c:GetPivot().Rotation)
  end)
end
function BY.walk(rig, x, z)
  if not rig then return end
  local p = rig:GetPivot().Position
  local goal = Vector3.new(x, p.Y, z)
  local d = (goal - p).Magnitude
  if d < 0.1 then return end
  rig:PivotTo(CFrame.lookAt(p, goal))
  BY.glide(rig, x, p.Y, z, d / 12, false)
end
function BY.walkToPlayer(rig) local r = root() if r then BY.walk(rig, r.Position.X, r.Position.Z) end end
function BY.face(rig)
  local r = root() if not (rig and r) then return end
  local p = rig:GetPivot().Position
  rig:PivotTo(CFrame.lookAt(p, Vector3.new(r.Position.X, p.Y, r.Position.Z)))
end
function BY.say(rig, text)
  if not rig then return end
  local head = rig:FindFirstChild("Head") or (rig:IsA("BasePart") and rig)
  if head then game:GetService("Chat"):Chat(head, tostring(text)) end
end
BY.hits = BY.hits or {}
BY.swingHits = BY.swingHits or {}
function BY.tool(s) return s:FindFirstAncestorOfClass("Tool") end
function BY.onToolHit(tool, f)
  if not tool then return end
  BY.hits[tool] = BY.hits[tool] or {}
  table.insert(BY.hits[tool], f)
  for _, p in ipairs(tool:GetDescendants()) do
    if p:IsA("BasePart") then
      p.Touched:Connect(function(hit)
        if (tool:GetAttribute("SwingUntil") or 0) < os.clock() then return end
        if tool.Parent and hit:IsDescendantOf(tool.Parent) then return end
        local seen = BY.swingHits[tool]
        if not seen or seen[hit] then return end
        seen[hit] = true
        f(hit)
      end)
    end
  end
end
function BY.swing(tool) if tool then tool:SetAttribute("SwingUntil", os.clock() + 0.35) BY.swingHits[tool] = {} end end
function BY.shoot(tool, color, speed)
  local handle = tool and tool:FindFirstChild("Handle") local r = root()
  if not (handle and r) then return end
  local ball = Instance.new("Part")
  ball.Shape = Enum.PartType.Ball ball.Size = Vector3.new(0.7, 0.7, 0.7) ball.Material = Enum.Material.Neon
  ball.Color = color ball.Anchored = true ball.CanCollide = false
  local pos, dir = handle.Position, r.CFrame.LookVector
  ball.Position = pos ball.Parent = workspace
  local params = RaycastParams.new()
  params.FilterDescendantsInstances = { tool.Parent, ball }
  task.spawn(function()
    local t0 = os.clock()
    while os.clock() - t0 < 3 do
      local dt = task.wait()
      local result = workspace:Raycast(pos, dir * speed * dt, params)
      if result then
        for _, f in ipairs(BY.hits[tool] or {}) do task.spawn(f, result.Instance) end
        break
      end
      pos = pos + dir * speed * dt
      ball.Position = pos
    end
    ball:Destroy()
  end)
end
function BY.giveTool(name)
  local p = player() if not p then return end
  local src = game:GetService("StarterPack"):FindFirstChild(name) or game:GetService("ReplicatedStorage"):FindFirstChild(name, true) or workspace:FindFirstChild(name, true)
  if src and src:IsA("Tool") then src:Clone().Parent = p.Backpack end
end
function BY.takeTool(name)
  local p = player() if not p then return end
  for _, c in ipairs({ p.Backpack, p.Character }) do
    local t = c and c:FindFirstChild(name)
    if t and t:IsA("Tool") then t:Destroy() end
  end
end
function BY.hasTool(name)
  local p = player() if not p then return false end
  return p.Backpack:FindFirstChild(name) ~= nil or (p.Character ~= nil and p.Character:FindFirstChild(name) ~= nil)
end
function BY.unequip() local h = hum() if h then h:UnequipTools() end end
local function rigHum(obj)
  local m = obj and (obj:IsA("Model") and obj or obj:FindFirstAncestorOfClass("Model"))
  if not m or Players:GetPlayerFromCharacter(m) then return nil end
  return m:FindFirstChildOfClass("Humanoid")
end
function BY.isRig(obj) return rigHum(obj) ~= nil end
local function playerHum(obj)
  local m = obj and (obj:IsA("Model") and obj or obj:FindFirstAncestorOfClass("Model"))
  if not m or not Players:GetPlayerFromCharacter(m) then return nil end
  return m:FindFirstChildOfClass("Humanoid")
end
function BY.isPlayer(obj) return playerHum(obj) ~= nil end
function BY.hurtPlayer(obj, n) local h = playerHum(obj) if h then h:TakeDamage(n) end end
function BY.damage(obj, n) local h = rigHum(obj) if h then h:TakeDamage(n) end end
function BY.healRig(obj, n) local h = rigHum(obj) if h then h.Health = math.min(h.MaxHealth, h.Health + n) end end
function BY.rigSpeed(obj, n) local h = rigHum(obj) if h then h.WalkSpeed = n end end
function BY.rigHealth(obj) local h = rigHum(obj) return h and h.Health or 0 end
function BY.hurt(n) local h = hum() if h then h:TakeDamage(n) end end
function BY.heal(n) local h = hum() if h then h.Health = math.min(h.MaxHealth, h.Health + n) end end
function BY.health() local h = hum() return h and h.Health or 0 end
BY.saved = {} -- In Roblox, use DataStoreService to keep these between sessions.
function BY.gui(name)
  local pl = Players.LocalPlayer
  if not pl then return nil end
  return pl:WaitForChild("PlayerGui"):FindFirstChild(name, true)
end
function BY.setText(g, text) if g then g.Text = tostring(text) end end
function BY.guiText(g) return g and g.Text or "" end
function BY.setGui(g, prop, value) if g then g[prop] = value end end
function BY.emit(obj, n) if obj then for _, d in ipairs(obj:GetDescendants()) do if d:IsA("ParticleEmitter") then d:Emit(n) end end end end
function BY.particles(obj, on) if obj then for _, d in ipairs(obj:GetDescendants()) do if d:IsA("ParticleEmitter") then d.Enabled = on end end end end
function BY.teleport(obj) local r = root() if r and obj then r.CFrame = CFrame.new(obj:GetPivot().Position + Vector3.new(0, sizeOf(obj).Y / 2 + 3, 0)) end end
function BY.launch(power) local r = root() if r then local v = r.AssemblyLinearVelocity r.AssemblyLinearVelocity = Vector3.new(v.X, power, v.Z) end end
function BY.humanoid(prop, value) local h = hum() if h then if prop == "JumpPower" then h.UseJumpPower = true end h[prop] = value end end
function BY.message(text, t) local m = Instance.new("Message") m.Text = tostring(text) m.Parent = workspace task.delay(t, function() m:Destroy() end) end
function BY.dist(obj) local r = root() if r and obj then return (r.Position - obj:GetPivot().Position).Magnitude end return 0 end
function BY.ppos(axis) local r = root() if not r then return 0 end if axis == "speed" then return r.AssemblyLinearVelocity.Magnitude end return r.Position[string.upper(axis)] end
function BY.prop(obj, prop)
  if not obj then return 0 end
  if prop == "x" or prop == "y" or prop == "z" then return obj:GetPivot().Position[string.upper(prop)] end
  local s = sizeOf(obj)
  if prop == "sx" then return s.X elseif prop == "sy" then return s.Y elseif prop == "sz" then return s.Z end
  local first = parts(obj)[1]
  return first and first.Transparency or 0
end
function BY.touching(obj)
  local p = player() local c = p and p.Character
  if not (c and obj) then return false end
  for _, part in ipairs(parts(obj)) do
    for _, q in ipairs(workspace:GetPartsInPart(part)) do if q:IsDescendantOf(c) then return true end end
  end
  return false
end
function BY.grounded() local h = hum() return h ~= nil and h.FloorMaterial ~= Enum.Material.Air end\nlocal landV, chuteOn = 0, false\nfunction BY.parachute(on) chuteOn = on local h = hum() if not h then return end local r = h.Parent:FindFirstChild('HumanoidRootPart') if not r then return end local f = r:FindFirstChild('BYChute') if on and not f then f = Instance.new('VectorForce') f.Name = 'BYChute' f.Attachment0 = r:FindFirstChildOfClass('Attachment') f.RelativeTo = Enum.ActuatorRelativeTo.World f.Force = Vector3.new(0, workspace.Gravity * r.AssemblyMass * 0.92, 0) f.Parent = r elseif not on and f then f:Destroy() end end\nfunction BY.landSpeed() return landV end
function BY.respawn(part) local p = player() if p and part and part:IsA("SpawnLocation") then p.RespawnLocation = part end end
`;
const luaStr=s=>'"'+String(s).replace(/\\/g,'\\\\').replace(/"/g,'\\"').replace(/\n/g,'\\n')+'"';
const luaNum=v=>{const n=Number(v);return isFinite(n)?String(n):'0';};
function luaForScript(node,withLib){
  const data=node.blocks;const L={vmap:new Map(((data&&data.variables)||[]).map(v=>[v.id,v.name])),notes:new Set()};
  const vn=b=>{const f=fld(b,'VAR');return luaStr(typeof f==='string'?f:(L.vmap.get(f&&f.id)||'?'));};
  const V=(b,n,d)=>{const x=inp(b,n);return x?lv(x):(d||'nil');};
  const Pt=b=>V(b,'PART','script.Parent');
  function lv(b){switch(b.type){
    case 'math_number':return luaNum(fld(b,'NUM'));case 'text':return luaStr(fld(b,'TEXT')??'');
    case 'math_round':{const o=fld(b,'OP');return o==='ROUNDUP'?`math.ceil(${V(b,'NUM','0')})`:o==='ROUNDDOWN'?`math.floor(${V(b,'NUM','0')})`:`math.floor(${V(b,'NUM','0')} + 0.5)`;}
    case 'math_arithmetic':return `(${V(b,'A','0')} ${{ADD:'+',MINUS:'-',MULTIPLY:'*',DIVIDE:'/',POWER:'^'}[fld(b,'OP')]||'+'} ${V(b,'B','0')})`;
    case 'math_random_int':return `math.random(${V(b,'FROM','1')}, ${V(b,'TO','10')})`;
    case 'logic_compare':return `(${V(b,'A','0')} ${{EQ:'==',NEQ:'~=',LT:'<',LTE:'<=',GT:'>',GTE:'>='}[fld(b,'OP')]||'=='} ${V(b,'B','0')})`;
    case 'logic_operation':return `(${V(b,'A','false')} ${fld(b,'OP')==='AND'?'and':'or'} ${V(b,'B','false')})`;
    case 'logic_negate':return `(not ${V(b,'BOOL','false')})`;case 'logic_boolean':return fld(b,'BOOL')==='TRUE'?'true':'false';
    case 'text_join':{const n=(b.extraState&&b.extraState.itemCount!=null)?b.extraState.itemCount:2;const a=[];for(let i=0;i<n;i++)a.push(`tostring(${V(b,'ADD'+i,'""')})`);return a.length?a.join(' .. '):'""';}
    case 'variables_get':return `(BY.vars[${vn(b)}] or 0)`;
    case 'p_this':return 'script.Parent';case 'p_named':return `workspace:FindFirstChild(${luaStr(fld(b,'NAME'))}, true)`;
    case 'rs_last':return 'BY.last';
    case 's_anim_playing':return 'false';
    case 'gui_this':return 'script.Parent';case 'gui_named':return `BY.gui(${luaStr(fld(b,'NAME'))})`;case 's_gui_text':return `BY.guiText(${V(b,'GUI','script.Parent')})`;
    case 'tool_hitpart':return 'hitPart';case 's_isplayer':return `BY.isPlayer(${Pt(b)})`;case 's_players':return '#Players:GetPlayers()';case 's_isrig':return `BY.isRig(${Pt(b)})`;case 's_health':return 'BY.health()';
    case 's_rig_health':return `BY.rigHealth(${Pt(b)})`;case 's_has_tool':return `BY.hasTool(${luaStr(fld(b,'NAME'))})`;
    case 'p_model':return 'script:FindFirstAncestorOfClass("Model")';case 'p_model_named':return `workspace:FindFirstChild(${luaStr(fld(b,'NAME'))}, true)`;
    case 's_mouse_down':L.notes.add('Mouse checks need a LocalScript in Roblox (UserInputService), so they are false here.');return 'false';
    case 's_mouse_part':L.notes.add('"part under mouse" needs a LocalScript in Roblox (Player:GetMouse().Target).');return 'nil';
    case 's_mouse_xy':return '0';
    case 's_key':L.notes.add('Key-press checks need a LocalScript in Roblox, so they are false here.');return 'false';
    case 's_touching':return `BY.touching(${Pt(b)})`;case 's_distance':return `BY.dist(${Pt(b)})`;
    case 's_is_host':return 'true';case 's_pl_id':return 'tostring(player().UserId)';case 's_pl_idof':return 'tostring(player().UserId)';case 's_pl_axisof':return `BY.ppos(${luaStr(fld(b,'AXIS'))})`;case 's_near_axis':return `BY.ppos(${luaStr(fld(b,'AXIS'))})`;case 's_near_dist':return `BY.dist(${Pt(b)})`;
    case 's_player':return `BY.ppos(${luaStr(fld(b,'AXIS'))})`;case 's_prop':return `BY.prop(${Pt(b)}, ${luaStr(fld(b,'PROP'))})`;
    case 's_pl_ragdoll':return 'false';
    case 's_partname':return `(${Pt(b)} and ${Pt(b)}.Name or "")`;
    case 's_touch_name':return `(function() local names = {} for _, plr in Players:GetPlayers() do local c = plr.Character if c then for _, p in workspace:GetPartsInPart(script.Parent) do if p:IsDescendantOf(c) then table.insert(names, plr.Name) break end end end end return ${fld(b,'MODE')==='all'?'table.concat(names, ", ")':'names[1] or ""'} end)()`;
    case 's_touch_count':return '(function() local n = 0 for _, plr in Players:GetPlayers() do local c = plr.Character if c then for _, p in workspace:GetPartsInPart(script.Parent) do if p:IsDescendantOf(c) then n += 1 break end end end end return n end)()';
    case 's_pl_name':return '(player() and player().Name or "")';case 's_touch_player':L.notes.add('Player-to-player touch checks need a Touched handler on the character in Roblox.');return 'false';case 'pl_ref':case 'pl_ref_touchme':case 'pl_touched':case 'pl_ref_touch':case 'pl_ref_named':return 'Players:GetPlayers()';
    case 's_pl_nameof':return '(player() and player().Name or "")';case 's_pl_hpof':return 'BY.health()';case 's_pl_countof':return '#Players:GetPlayers()';case 's_pl_maxhp':return '(hum() and hum().MaxHealth or 100)';case 's_pl_speed':return '(hum() and hum().WalkSpeed or 16)';
    case 's_land_speed':return 'BY.landSpeed()';case 's_pl_moving':return '(hum() ~= nil and hum().MoveDirection.Magnitude > 0)';case 's_pl_alive':return '(hum() ~= nil and hum().Health > 0)';
    case 's_pl_shield':return '(player() and player().Character and player().Character:FindFirstChildOfClass("ForceField") ~= nil)';case 's_pl_tool':return '(function() local c = player() and player().Character local t = c and c:FindFirstChildOfClass("Tool") return t and t.Name or "" end)()';
    case 'data_get':L.notes.add('Saved data needs DataStoreService in Roblox; the export keeps it in BY.saved for the session only.');return `(BY.saved[tostring(${V(b,'KEY','""')})] or 0)`;
    case 'data_get_or':return `(BY.saved[tostring(${V(b,'KEY','""')})] or ${V(b,'DEF','0')})`;
    case 'data_has':return `(BY.saved[tostring(${V(b,'KEY','""')})] ~= nil)`;case 'data_loaded':return 'true';case 'data_returning':return 'false';
    case 's_timer':return '(os.clock() - BY.t0)';case 's_stat':return `BY.stat(${luaStr(fld(b,'STAT'))}).Value`;case 's_grounded':return 'BY.grounded()';
  }return 'nil';}
  const chainL=(b,ind)=>{let s='';while(b){s+=ls(b,ind);b=b.next&&b.next.block;}return s;};
  const body=(b,n,ind)=>chainL(D(b,n),ind+'  ');
  const xyz=b=>`${V(b,'X','0')}, ${V(b,'Y','0')}, ${V(b,'Z','0')}`;
  const TF=b=>fld(b,'B')==='TRUE'?'true':'false';
  function ls(b,i){const l=s=>i+s+'\n';switch(b.type){
    case 'c_wait':return l(`task.wait(${V(b,'S','0')})`);
    case 'c_forever':return l('while true do')+body(b,'DO',i)+l('  task.wait()')+l('end');
    case 'controls_repeat_ext':return l(`for _ = 1, ${V(b,'TIMES','10')} do`)+body(b,'DO',i)+l('end');
    case 'controls_whileUntil':return l(`while ${fld(b,'MODE')==='UNTIL'?'not ':''}${V(b,'BOOL','false')} do`)+body(b,'DO',i)+l('  task.wait()')+l('end');
    case 'controls_if':{const es=b.extraState||{};const n=(es.elseIfCount||0)+1;let s='';for(let k=0;k<n;k++)s+=l(`${k?'elseif':'if'} ${V(b,'IF'+k,'false')} then`)+body(b,'DO'+k,i);
      if(es.hasElse)s+=l('else')+body(b,'ELSE',i);return s+l('end');}
    case 'c_wait_until':return l(`repeat task.wait() until ${V(b,'COND','true')}`);
    case 'c_broadcast':return l(`BY.fire(${luaStr(fld(b,'MSG'))})`);case 'c_stop':return l('do return end');
    case 'variables_set':case 'var_share_set':return l(`BY.vars[${vn(b)}] = ${V(b,'VALUE','0')}`);
    case 'var_share_change':return l(`BY.vars[${vn(b)}] = (BY.vars[${vn(b)}] or 0) + ${V(b,'N','1')}`);
    case 'math_change':return l(`BY.vars[${vn(b)}] = (BY.vars[${vn(b)}] or 0) + ${V(b,'DELTA','1')}`);
    case 'p_move':return l(`BY.move(${Pt(b)}, ${xyz(b)})`);case 'p_setpos':return l(`BY.setpos(${Pt(b)}, ${xyz(b)})`);
    case 'p_glide':return l(`BY.glide(${Pt(b)}, ${xyz(b)}, ${V(b,'S','1')}, true)`);case 'p_glideto':return l(`BY.glide(${Pt(b)}, ${xyz(b)}, ${V(b,'S','1')}, false)`);
    case 'p_rotate':return l(`BY.rotate(${Pt(b)}, ${V(b,'DEG','0')}, ${luaStr(fld(b,'AXIS')||'y')})`);
    case 'p_color':return l(`BY.set(${Pt(b)}, "Color", Color3.fromHex(${luaStr(fld(b,'COLOUR')||'#ffffff')}))`);
    case 'p_transp':return l(`BY.set(${Pt(b)}, "Transparency", ${V(b,'V','0')})`);
    case 'p_material':{const m=fld(b,'MAT');return l(`BY.set(${Pt(b)}, "Material", Enum.Material.${m==='Studs'?'Plastic':m||'Plastic'})`);}
    case 'p_collide':return l(`BY.set(${Pt(b)}, "CanCollide", ${TF(b)})`);case 'p_anchor':return l(`BY.set(${Pt(b)}, "Anchored", ${TF(b)})`);
    case 'p_visible':return l(`BY.set(${Pt(b)}, "Transparency", ${fld(b,'B')==='TRUE'?0:1})`);
    case 'p_label':L.notes.add('Part labels map to a BillboardGui with a TextLabel in Roblox.');return l(`-- set label of part to ${V(b,'TEXT','""')}`);
    case 'p_deadly':return l(`BY.set(${Pt(b)}, "Deadly", ${TF(b)}) -- handled by the Deadly kill script`);
    case 'p_break':L.notes.add('Break blocks become a Roblox Explosion.');return l(`do local e = Instance.new("Explosion") e.Position = Vector3.new(${V(b,'X','0')}, ${V(b,'Y','0')}, ${V(b,'Z','0')}) e.BlastRadius = ${V(b,'R','10')} e.BlastPressure = (${V(b,'P','60')}) * 2000 e.DestroyJointRadiusPercent = 0 e.Parent = workspace end`);
    case 'p_clone':return l(`BY.clone(${Pt(b)}, ${xyz(b)})`);case 'p_destroy':return l(`BY.destroy(${Pt(b)})`);
    case 'rs_copy':return l(`BY.copyTo(${luaStr(fld(b,'NAME'))}, ${xyz(b)})`);
    case 'rs_onto':return l(`BY.copyOnto(${luaStr(fld(b,'NAME'))}, ${Pt(b)})`);
    case 'rig_walk':return l(`BY.walk(${Pt(b)}, ${V(b,'X','0')}, ${V(b,'Z','0')})`);
    case 'rig_walkp':case 'rig_walkn':return l(`BY.walkToPlayer(${Pt(b)})`);
    case 'rig_anim':L.notes.add('Rig animations need Animation asset ids in Roblox, so play blocks are comments.');return l(`-- ${'make rig play '+fld(b,'ANIM')}`);
    case 'rig_say':return l(`BY.say(${Pt(b)}, ${V(b,'TEXT','""')})`);
    case 'rig_face':return l(`BY.face(${Pt(b)})`);
    case 'gui_settext':return l(`BY.setText(${V(b,'GUI','script.Parent')}, ${V(b,'TEXT','""')})`);
    case 'gui_visible':return l(`BY.setGui(${V(b,'GUI','script.Parent')}, "Visible", ${fld(b,'B')==='TRUE'?'true':'false'})`);
    case 'gui_font':return l(`BY.setGui(${V(b,'GUI','script.Parent')}, "Font", Enum.Font:FromValue(${GUI_FONT_TOK[fld(b,'FONT')]||19}))`);
    case 'gui_outline':return l(`BY.setGui(${V(b,'GUI','script.Parent')}, "TextStrokeColor3", Color3.fromHex(${luaStr(fld(b,'COLOUR')||'#000000')}))`)+l(`BY.setGui(${V(b,'GUI','script.Parent')}, "TextStrokeTransparency", (${V(b,'W','1')}) > 0 and 0 or 1)`);
    case 'gui_textsize':return l(`BY.setGui(${V(b,'GUI','script.Parent')}, "TextSize", ${V(b,'N','20')})`);
    case 'gui_color':return l(`BY.setGui(${V(b,'GUI','script.Parent')}, "${fld(b,'WHAT')==='text'?'TextColor3':'BackgroundColor3'}", Color3.fromHex(${luaStr(fld(b,'COLOUR')||'#ffffff')}))`);
    case 'anim_play_me':case 'anim_play_rig':L.notes.add('Brickyard keyframe animations need to be re-made in the Roblox Animation Editor, so play blocks become comments.');return l(`-- play animation ${V(b,'NAME','""')}${b.type==='anim_play_rig'?' on rig':' on the player'} (${fld(b,'MODE')})`);
    case 'anim_stop_me':case 'anim_stop_rig':return l('-- stop animation');
    case 'tool_swing':L.notes.add('The swing animation needs an Animation asset in Roblox. The hit window still works.');return l('BY.swing(BY.tool(script))');
    case 'tool_shoot':return l(`BY.shoot(BY.tool(script), Color3.fromHex(${luaStr(fld(b,'COLOUR')||'#5cc8ff')}), ${V(b,'S','120')})`);
    case 'tool_give':return l(`BY.giveTool(${luaStr(fld(b,'NAME'))})`);case 'tool_take':return l(`BY.takeTool(${luaStr(fld(b,'NAME'))})`);case 'tool_unequip':return l('BY.unequip()');
    case 'pl_damage':return l(`BY.hurt(${V(b,'N','10')})`);case 'pl_damage_other':return l(`BY.hurtPlayer(${Pt(b)}, ${V(b,'N','10')})`);case 'pl_heal':return l(`BY.heal(${V(b,'N','10')})`);
    case 'rig_damage':return l(`BY.damage(${Pt(b)}, ${V(b,'N','10')})`);case 'rig_heal':return l(`BY.healRig(${Pt(b)}, ${V(b,'N','10')})`);case 'rig_speed':return l(`BY.rigSpeed(${Pt(b)}, ${V(b,'N','12')})`);
    case 'pe_emit':return l(`BY.emit(${Pt(b)}, ${V(b,'N','30')})`);
    case 'pe_toggle':return l(`BY.particles(${Pt(b)}, ${fld(b,'B')==='TRUE'?'true':'false'})`);
    case 'pl_kill':return l('BY.kill()');case 'pl_teleport':return l(`BY.teleport(${Pt(b)})`);case 'pl_launch':return l(`BY.launch(${V(b,'P','80')})`);
    case 'pl_as':L.notes.add('"as player" runs its blocks for the first player only in the Roblox export; loop over Players:GetPlayers() to target others.');return l('do -- as player '+fld(D(b,'WHO')||{},'WHO'))+body(b,'DO',i)+l('end');
    case 'data_set':L.notes.add('Saved data needs DataStoreService in Roblox; the export keeps it in BY.saved for the session only.');return l(`BY.saved[tostring(${V(b,'KEY','""')})] = ${V(b,'V','0')}`);
    case 'data_change':return l(`BY.saved[tostring(${V(b,'KEY','""')})] = (BY.saved[tostring(${V(b,'KEY','""')})] or 0) + ${V(b,'N','1')}`);
    case 'data_del':return l(`BY.saved[tostring(${V(b,'KEY','""')})] = nil`);case 'data_clear':return l('BY.saved = {}');case 'data_now':return l('-- save progress now (DataStoreService)');
    case 'pl_knock':return l(`BY.launch(${V(b,'P','60')})`);
    case 'pl_ragdoll':case 'pl_fling':case 'pl_getup':L.notes.add('Ragdolls need a ragdoll script in Roblox (Humanoid physics state plus BallSocketConstraints).');return l('-- '+b.type.replace('pl_','')+' the player');
    case 'rig_ragdoll':case 'rig_fling':return l('-- '+b.type.replace('rig_','')+' the rig');case 'data_enable':return l('-- turn auto-save '+(fld(b,'B')==='TRUE'?'on':'off'));
    case 'pl_sethp':return l(`BY.humanoid("Health", ${V(b,'N','100')})`);
    case 'pl_maxhp':return l(`BY.humanoid("MaxHealth", ${V(b,'N','100')})`)+(fld(b,'FILL')==='TRUE'?l(`BY.humanoid("Health", ${V(b,'N','100')})`):'');
    case 'pl_tpxyz':return l(`do local p = player() local c = p and p.Character if c then c:PivotTo(CFrame.new(${V(b,'X','0')}, ${V(b,'Y','0')}, ${V(b,'Z','0')})) end end`);
    case 'pl_respawn':return l('do local p = player() if p then p:LoadCharacter() end end');
    case 'pl_coins':L.notes.add('Shop coins are a Brickyard feature. In Roblox, use a leaderstat or a DataStore for currency.');return l('-- give shop coins (Brickyard only)');
    case 'pl_chute':return l(fld(b,'B')==='TRUE'?'BY.parachute(true)':'BY.parachute(false)');
    case 'pl_freeze':return l(fld(b,'B')==='TRUE'?'do local h = hum() if h then h.WalkSpeed = 0 h.JumpPower = 0 end end':'do local h = hum() if h then h.WalkSpeed = 16 h.JumpPower = 50 end end');
    case 'pl_visible':return l(`do local p = player() local c = p and p.Character if c then for _, d in c:GetDescendants() do if d:IsA("BasePart") and d.Name ~= "HumanoidRootPart" then d.Transparency = ${fld(b,'B')==='TRUE'?0:1} end end end end`);
    case 'pl_shirt':return l(`do local p = player() local c = p and p.Character local t = c and c:FindFirstChild("Torso") if t then t.Color = Color3.fromHex(${luaStr(fld(b,'COLOUR')||'#e53935')}) end end`);
    case 'pl_say':return l(`do local p = player() local c = p and p.Character local h = c and c:FindFirstChild("Head") if h then game:GetService("Chat"):Chat(h, tostring(${V(b,'TEXT','""')})) end end`);
    case 'pl_shield':return l(`do local p = player() local c = p and p.Character if c then local f = Instance.new("ForceField", c) game:GetService("Debris"):AddItem(f, ${V(b,'S','5')}) end end`);
    case 'pl_airjumps':L.notes.add('Air jumps need a custom double-jump LocalScript in Roblox.');return l('-- set extra air jumps to '+V(b,'N','1'));
    case 'pl_face':return l(`do local p = player() local c = p and p.Character local t = ${Pt(b)} if c and t then local r = c:GetPivot().Position c:PivotTo(CFrame.lookAt(r, Vector3.new(t.Position.X, r.Y, t.Position.Z))) end end`);
    case 'pl_camera':L.notes.add('Camera settings belong in a LocalScript in Roblox; first person maps to StarterPlayer.CameraMode.');return l('-- set camera to '+fld(b,'MODE'));
    case 'pl_speed':return l(`BY.humanoid("WalkSpeed", ${V(b,'V','16')})`);case 'pl_jump':return l(`BY.humanoid("JumpPower", ${V(b,'V','50')})`);
    case 'pl_gravity':return l(`workspace.Gravity = ${V(b,'V','196.2')}`);case 'pl_checkpoint':return l(`BY.respawn(${Pt(b)})`);
    case 'g_callout':return l(`BY.message(${V(b,'TEXT','""')}, 2)`);case 'g_music':return l('-- background music (Brickyard only)');case 'g_shake':return l('-- screen shake (Brickyard only)');
    case 'g_msg':return l(`BY.message(${V(b,'TEXT','""')}, ${V(b,'S','2')})`);case 'g_print':return l(`print(${V(b,'TEXT','""')})`);
    case 'g_stat_change':return l(`BY.stat(${luaStr(fld(b,'STAT'))}).Value += ${V(b,'N','1')}`);case 'g_stat_set':return l(`BY.stat(${luaStr(fld(b,'STAT'))}).Value = ${V(b,'N','0')}`);
    case 'g_win':return l('BY.message("You win!", 5)');
    case 'g_sound':L.notes.add('Sound blocks need a Sound with an asset id in Roblox.');return l(`-- play sound ${fld(b,'SND')}`);
    case 'g_sky':return l(`game:GetService("Lighting").Ambient = Color3.fromHex(${luaStr(fld(b,'COLOUR')||'#9fd8ff')})`);
    case 'g_reset_timer':return l('BY.t0 = os.clock()');
  }return '';}
  let out='';
  for(const top of ((data&&data.blocks&&data.blocks.blocks)||[])){
    const nb=top.next&&top.next.block;const B_=chainL(nb,'    ');
    switch(top.type){
      case 'ev_start':out+=`task.spawn(function()\n${chainL(nb,'  ')}end)\n\n`;break;
      case 'ev_touch':out+=`do\n  local busy = false\n  script.Parent.Touched:Connect(function(hit)\n    if busy or not Players:GetPlayerFromCharacter(hit.Parent) then return end\n    busy = true\n${B_}    busy = false\n  end)\nend\n\n`;break;
      case 'ev_click':out+=`do\n  local cd = script.Parent:FindFirstChildOfClass("ClickDetector") or Instance.new("ClickDetector", script.Parent)\n  cd.MouseClick:Connect(function()\n${B_}  end)\nend\n\n`;break;
      case 'ev_tool_act':case 'ev_tool_equip':case 'ev_tool_unequip':{const evn={ev_tool_act:'Activated',ev_tool_equip:'Equipped',ev_tool_unequip:'Unequipped'}[top.type];
        out+=`do\n  local tool = BY.tool(script)\n  if tool then tool.${evn}:Connect(function()\n${B_}  end) end\nend\n\n`;break;}
      case 'ev_tool_hit':out+=`BY.onToolHit(BY.tool(script), function(hitPart)\n${chainL(nb,'  ')}end)\n\n`;break;
      case 'ev_gui_click':out+=`script.Parent.MouseButton1Click:Connect(function()\n${chainL(nb,'  ')}end)\n\n`;break;
      case 'ev_spawn':out+=`Players.PlayerAdded:Connect(function(p)\n  p.CharacterAdded:Connect(function(c)\n${chainL(nb,'    ')}  end)\nend)\n\n`;break;
      case 'ev_jump':out+=`Players.PlayerAdded:Connect(function(p)\n  p.CharacterAdded:Connect(function(c)\n    c:WaitForChild("Humanoid").StateChanged:Connect(function(_, s)\n      if s ~= Enum.HumanoidStateType.Jumping then return end\n${chainL(nb,'      ')}    end)\n  end)\nend)\n\n`;break;
      case 'ev_land':out+=`Players.PlayerAdded:Connect(function(p)\n  p.CharacterAdded:Connect(function(c)\n    c:WaitForChild("Humanoid").StateChanged:Connect(function(_, s)\n      if s ~= Enum.HumanoidStateType.Landed then return end\n${chainL(nb,'      ')}    end)\n  end)\nend)\n\n`;break;
      case 'ev_hurt':out+=`Players.PlayerAdded:Connect(function(p)\n  p.CharacterAdded:Connect(function(c)\n    local h = c:WaitForChild("Humanoid")\n    local last = h.Health\n    h.HealthChanged:Connect(function(v)\n      local hurt = v < last\n      last = v\n      if not hurt then return end\n${chainL(nb,'      ')}    end)\n  end)\nend)\n\n`;break;
      case 'ev_touch_player':L.notes.add('"when I touch another player" needs a Touched handler on the character in Roblox.');out+=`--[[ when I touch another player\n${chainL(nb,'  ')}]]\n\n`;break;
      case 'ev_data_loaded':out+=`task.spawn(function()\n${chainL(nb,'  ')}end)\n\n`;break;
      case 'ev_rig_died':out+=`do\n  local m = script:FindFirstAncestorOfClass("Model")\n  local h = m and m:FindFirstChildOfClass("Humanoid")\n  if h then h.Died:Connect(function()\n${B_}  end) end\nend\n\n`;break;
      case 'ev_touch_model':out+=`do\n  local busy = false\n  local model = script:FindFirstAncestorOfClass("Model")\n  for _, part in ipairs(model and model:GetDescendants() or {}) do\n    if part:IsA("BasePart") then\n      part.Touched:Connect(function(hit)\n        if busy or not Players:GetPlayerFromCharacter(hit.Parent) then return end\n        busy = true\n${chainL(nb,'        ')}        busy = false\n      end)\n    end\n  end\nend\n\n`;break;
      case 'ev_click_model':out+=`do\n  local model = script:FindFirstAncestorOfClass("Model")\n  local cd = model and (model:FindFirstChildOfClass("ClickDetector") or Instance.new("ClickDetector", model))\n  if cd then cd.MouseClick:Connect(function()\n${B_}  end) end\nend\n\n`;break;
      case 'ev_mouse':L.notes.add('Mouse click events need a LocalScript in Roblox.');out+=`--[[ when mouse clicked (needs a LocalScript)\n${chainL(nb,'  ')}]]\n\n`;break;
      case 'ev_key':L.notes.add('Key-press events need a LocalScript in Roblox.');out+=`--[[ when ${fld(top,'KEY')} pressed (needs a LocalScript)\n${chainL(nb,'  ')}]]\n\n`;break;
      case 'ev_every':out+=`task.spawn(function()\n  while true do\n    task.wait(${luaNum(fld(top,'S'))})\n${chainL(nb,'    ')}  end\nend)\n\n`;break;
      case 'ev_msg':out+=`BY.listen(${luaStr(fld(top,'MSG'))}, function()\n${chainL(nb,'  ')}end)\n\n`;break;
      case 'ev_died':out+=`Players.PlayerAdded:Connect(function(p)\n  p.CharacterAdded:Connect(function(c)\n    c:WaitForChild("Humanoid").Died:Connect(function()\n${chainL(nb,'      ')}    end)\n  end)\nend)\n\n`;break;
    }
  }
  const notes=[...L.notes].map(s=>'-- Note: '+s+'\n').join('');
  return (withLib?LUA_LIB+'\n':'')+notes+(out||'-- This script has no event blocks yet.\n');
}
const BEHAVIOR_LUA={
  kill:'script.Parent.Touched:Connect(function(hit)\n  local h = hit.Parent:FindFirstChildOfClass("Humanoid")\n  if h then h.Health = 0 end\nend)\n',
  jump:p=>`script.Parent.Touched:Connect(function(hit)\n  local r = hit.Parent:FindFirstChild("HumanoidRootPart")\n  if r then local v = r.AssemblyLinearVelocity r.AssemblyLinearVelocity = Vector3.new(v.X, ${p}, v.Z) end\nend)\n`,
  speed:s=>`local busy = {}\nscript.Parent.Touched:Connect(function(hit)\n  local h = hit.Parent:FindFirstChildOfClass("Humanoid")\n  if not h or busy[h] then return end\n  busy[h] = true\n  local old = h.WalkSpeed\n  h.WalkSpeed = 42\n  task.wait(${s})\n  h.WalkSpeed = old\n  busy[h] = nil\nend)\n`,
  coin:'local Players = game:GetService("Players")\nlocal taken = false\nscript.Parent.Touched:Connect(function(hit)\n  local p = Players:GetPlayerFromCharacter(hit.Parent)\n  if not p or taken then return end\n  taken = true\n  local ls = p:FindFirstChild("leaderstats") or Instance.new("Folder")\n  ls.Name = "leaderstats" ls.Parent = p\n  local c = ls:FindFirstChild("Coins") or Instance.new("NumberValue")\n  c.Name = "Coins" c.Parent = ls\n  c.Value += 1\n  script.Parent:Destroy()\nend)\n',
  finish:'local Players = game:GetService("Players")\nlocal done = {}\nscript.Parent.Touched:Connect(function(hit)\n  local p = Players:GetPlayerFromCharacter(hit.Parent)\n  if not p or done[p] then return end\n  done[p] = true\n  local m = Instance.new("Message") m.Text = p.DisplayName .. " wins!" m.Parent = workspace\n  task.delay(4, function() m:Destroy() end)\nend)\n',
  check:'local Players = game:GetService("Players")\nscript.Parent.Touched:Connect(function(hit)\n  local p = Players:GetPlayerFromCharacter(hit.Parent)\n  if p then p.RespawnLocation = script.Parent end\nend)\n'
};
function exportRbxlx(proj){
  let ref=0;const R=()=>'RBX'+(ref++);const x=esc;
  const S=proj.settings;const by=new Map();proj.nodes.forEach(n=>{if(!by.has(n.parent))by.set(n.parent,[]);by.get(n.parent).push(n);});
  const scriptItem=(name,src)=>`<Item class="Script" referent="${R()}"><Properties><string name="Name">${x(name)}</string><ProtectedString name="Source"><![CDATA[${src.replace(/\]\]>/g,']] >')}]]></ProtectedString></Properties></Item>`;
  const m4=new THREE.Matrix4();const f=v=>luaNum(r3(v));let TX=null;
  const item=n=>{
    if(n.cls==='Tool'){const prev=TX;const h=toolHandle(proj,n);TX={handle:h&&h.id,refs:new Map()};const kids_=(by.get(n.id)||[]).map(item).join('');
      const hr=TX.refs.get(TX.handle);const welds=[...TX.refs].filter(([id])=>id!==TX.handle).map(([,ref])=>`<Item class="WeldConstraint" referent="${R()}"><Properties><string name="Name">Weld</string><Ref name="Part0">${hr}</Ref><Ref name="Part1">${ref}</Ref></Properties></Item>`).join('');
      TX=prev;return `<Item class="Tool" referent="${R()}"><Properties><string name="Name">${x(n.name)}</string><string name="ToolTip">${x(n.tooltip||'')}</string><bool name="RequiresHandle">true</bool><bool name="CanBeDropped">true</bool></Properties>${kids_}${hr?welds:''}</Item>`;}
    const kids=(by.get(n.id)||[]).map(item).join('');
    if(n.cls==='Script')return n.enabled===false?'':scriptItem(n.name,luaForScript(n,true));
    if(n.cls==='Animation')return '';
    if(n.cls==='Folder'||n.cls==='Model')return `<Item class="${n.cls}" referent="${R()}"><Properties><string name="Name">${x(n.name)}</string></Properties>${kids}</Item>`;
    if(n.cls==='ParticleEmitter'){const c0=new THREE.Color(n.rainbow?'#ffffff':n.color0),c1=new THREE.Color(n.rainbow?'#ffffff':n.color1);const cs=c=>`${r3(c.r)} ${r3(c.g)} ${r3(c.b)}`;
      const ND={Right:0,Top:1,Back:2,Left:3,Bottom:4,Front:5};
      return `<Item class="ParticleEmitter" referent="${R()}"><Properties><string name="Name">${x(n.name)}</string><bool name="Enabled">${n.enabled!==false}</bool><float name="Rate">${n.rate}</float>`+
        `<NumberRange name="Lifetime">${n.lifeMin} ${n.lifeMax} </NumberRange><NumberRange name="Speed">${n.speed} ${n.speed} </NumberRange><Vector2 name="SpreadAngle"><X>${n.spread}</X><Y>${n.spread}</Y></Vector2>`+
        `<ColorSequence name="Color">0 ${cs(c0)} 0 1 ${cs(c1)} 0 </ColorSequence><NumberSequence name="Size">0 ${Math.max(0,n.size0)} 0 1 ${Math.max(0,n.size1)} 0 </NumberSequence>`+
        `<NumberSequence name="Transparency">0 0 0 1 1 0 </NumberSequence><float name="LightEmission">${n.glow?1:0}</float><Vector3 name="Acceleration"><X>0</X><Y>${n.accel}</Y><Z>0</Z></Vector3>`+
        `<token name="EmissionDirection">${ND[n.dir]??1}</token></Properties></Item>`;}
    if(n.cls==='Rig'){const sc=n.scale||1,C=n.colors||{};const yaw=((n.rot||[0,0,0])[1]||0)*D2R+Math.PI;
      const M=new THREE.Matrix4().makeRotationY(yaw).setPosition(new V3().fromArray(n.pos));
      const pp=(name,off,size,color,extra,inner)=>{const w=new V3(...off).multiplyScalar(sc).applyMatrix4(M);const e2=M.elements;const cc=new THREE.Color(color);
        const col=(0xff000000|(Math.round(cc.r*255)<<16)|(Math.round(cc.g*255)<<8)|Math.round(cc.b*255))>>>0;
        return `<Item class="Part" referent="${R()}"><Properties><string name="Name">${name}</string><bool name="Anchored">true</bool><bool name="CanCollide">${extra==='root'?'false':'true'}</bool>`+
        `<CoordinateFrame name="CFrame"><X>${f(w.x)}</X><Y>${f(w.y)}</Y><Z>${f(w.z)}</Z><R00>${f(e2[0])}</R00><R01>${f(e2[4])}</R01><R02>${f(e2[8])}</R02><R10>${f(e2[1])}</R10><R11>${f(e2[5])}</R11><R12>${f(e2[9])}</R12><R20>${f(e2[2])}</R20><R21>${f(e2[6])}</R21><R22>${f(e2[10])}</R22></CoordinateFrame>`+
        `<Color3uint8 name="Color3uint8">${col}</Color3uint8><Vector3 name="size"><X>${f(size[0]*sc)}</X><Y>${f(size[1]*sc)}</Y><Z>${f(size[2]*sc)}</Z></Vector3><float name="Transparency">${extra==='root'?1:0}</float></Properties>${inner||''}</Item>`;};
      const headMesh=`<Item class="SpecialMesh" referent="${R()}"><Properties><string name="Name">Mesh</string><token name="MeshType">0</token><Vector3 name="Scale"><X>1.25</X><Y>1.25</Y><Z>1.25</Z></Vector3></Properties></Item>`+
        `<Item class="Decal" referent="${R()}"><Properties><string name="Name">face</string><Content name="Texture"><url>rbxasset://textures/face.png</url></Content><token name="Face">5</token></Properties></Item>`;
      return `<Item class="Model" referent="${R()}"><Properties><string name="Name">${x(n.name)}</string></Properties>`+
        `<Item class="Humanoid" referent="${R()}"><Properties><string name="Name">Humanoid</string><float name="WalkSpeed">${n.walkSpeed||12}</float><float name="MaxHealth">${n.health||100}</float><float name="Health">${n.health||100}</float></Properties></Item>`+
        pp('HumanoidRootPart',[0,.5,0],[2,2,1],'#a3a2a5','root')+pp('Torso',[0,.5,0],[2,2,1],C.torso||'#1e88e5')+pp('Head',[0,2.1,0],[2,1,1],C.head||'#f5cd30','',headMesh)+
        pp('Left Arm',[-1.5,.5,0],[1,2,1],C.arms||'#f5cd30')+pp('Right Arm',[1.5,.5,0],[1,2,1],C.arms||'#f5cd30')+pp('Left Leg',[-.5,-1.5,0],[1,2,1],C.legs||'#2b3a7a')+pp('Right Leg',[.5,-1.5,0],[1,2,1],C.legs||'#2b3a7a')+
        kids+`</Item>`;}
    const beh=n.behavior||'none';
    const meshNote=n.shape==='mesh'?`<Item class="StringValue" referent="${R()}"><Properties><string name="Name">BrickyardMesh</string><string name="Value">${x(n.meshName||'mesh')}: upload this mesh in Studio's Asset Manager and swap this block for a MeshPart</string></Properties></Item>`:'';
    const collide=beh==='coin'?false:n.canCollide!==false;
    const cls=n.shape==='wedge'?'WedgePart':(beh==='spawn'||beh==='check')?'SpawnLocation':'Part';
    const r=n.rot||[0,0,0];m4.makeRotationFromEuler(new THREE.Euler(r[0]*D2R,r[1]*D2R,r[2]*D2R,'YXZ'));const e=m4.elements;
    const c=new THREE.Color(n.color);const col=(0xff000000|(Math.round(c.r*255)<<16)|(Math.round(c.g*255)<<8)|Math.round(c.b*255))>>>0;
    const shape=n.shape==='ball'?0:n.shape==='cyl'?2:1;
    let extra='';
    if(BEHAVIOR_LUA[beh]){const src=typeof BEHAVIOR_LUA[beh]==='function'?BEHAVIOR_LUA[beh](beh==='jump'?(n.value||100):(n.value||2.6)):BEHAVIOR_LUA[beh];extra+=scriptItem(beh[0].toUpperCase()+beh.slice(1)+'Script',src);}
    const killFlag=proj.nodes.some(k=>k.parent===n.id&&k.cls==='Script'&&JSON.stringify(k.blocks||{}).includes('p_deadly'));
    if(killFlag)extra+=scriptItem('DeadlyScript','script.Parent.Touched:Connect(function(hit)\n  if not script.Parent:GetAttribute("Deadly") then return end\n  local h = hit.Parent:FindFirstChildOfClass("Humanoid")\n  if h then h.Health = 0 end\nend)\n');
    if(n.shape==='mesh')extra+=meshNote;
    const myRef=R();const inT=!!TX;if(inT)TX.refs.set(n.id,myRef);const isH=inT&&TX.handle===n.id;
    return `<Item class="${cls}" referent="${myRef}"><Properties><string name="Name">${x(isH?'Handle':n.name)}</string><bool name="Anchored">${inT?false:n.anchored!==false}</bool><bool name="CanCollide">${inT?isH:collide}</bool><bool name="Locked">${!!n.locked}</bool>`+
      `<CoordinateFrame name="CFrame"><X>${f(n.pos[0])}</X><Y>${f(n.pos[1])}</Y><Z>${f(n.pos[2])}</Z><R00>${f(e[0])}</R00><R01>${f(e[4])}</R01><R02>${f(e[8])}</R02><R10>${f(e[1])}</R10><R11>${f(e[5])}</R11><R12>${f(e[9])}</R12><R20>${f(e[2])}</R20><R21>${f(e[6])}</R21><R22>${f(e[10])}</R22></CoordinateFrame>`+
      `<Color3uint8 name="Color3uint8">${col}</Color3uint8><Vector3 name="size"><X>${f(n.size[0])}</X><Y>${f(n.size[1])}</Y><Z>${f(n.size[2])}</Z></Vector3>`+
      (cls==='Part'?`<token name="shape">${shape}</token>`:'')+`<token name="Material">${MAT_OUT[n.material]||256}</token><float name="Transparency">${n.transparency||0}</float>`+
      (cls==='SpawnLocation'?'<bool name="Neutral">true</bool><bool name="Enabled">true</bool>':'')+`</Properties>${extra}${kids}</Item>`;
  };
  const ws=(by.get('workspace')||[]).map(item).join('');
  const sss=(by.get('sss')||[]).map(item).join('');
  const spx=proj.nodes.filter(n=>n.cls==='Script'&&n.enabled!==false&&serviceOf(proj,n.id)==='player').map(n=>`<Item class="LocalScript" referent="${R()}"><Properties><string name="Name">${x(n.name)}</string><ProtectedString name="Source"><![CDATA[${luaForScript(n,true).replace(/\]\]>/g,']] >')}]]></ProtectedString></Properties></Item>`).join('');
  const rsx=(by.get('rs')||[]).map(item).join('');
  const packx=(by.get('pack')||[]).map(item).join('');
  const c3=hex=>{const c=new THREE.Color(/^#[0-9a-f]{6}$/i.test(hex||'')?hex:'#000000');return `<R>${r3(c.r)}</R><G>${r3(c.g)}</G><B>${r3(c.b)}</B>`;};
  const ud=(a)=>`<XS>${num(a[0],0)}</XS><XO>${Math.round(num(a[1],0))}</XO><YS>${num(a[2],0)}</YS><YO>${Math.round(num(a[3],0))}</YO>`;
  const FONTTOK=GUI_FONT_TOK;
  const guiItem=n=>{const kids=(by.get(n.id)||[]).map(k=>k.cls==='Script'?(k.enabled===false?'':`<Item class="LocalScript" referent="${R()}"><Properties><string name="Name">${x(k.name)}</string><ProtectedString name="Source"><![CDATA[${luaForScript(k,true).replace(/\]\]>/g,']] >')}]]></ProtectedString></Properties></Item>`):isGuiNode(k)?guiItem(k):'').join('');
    if(n.cls==='ScreenGui')return `<Item class="ScreenGui" referent="${R()}"><Properties><string name="Name">${x(n.name)}</string><bool name="Enabled">${n.visible!==false}</bool><bool name="ResetOnSpawn">false</bool></Properties>${kids}</Item>`;
    const txt=n.cls!=='Frame'?`<string name="Text">${x(n.text||'')}</string><Color3 name="TextColor3">${c3(n.tc)}</Color3><float name="TextSize">${Math.round(num(n.ts,20))}</float><token name="Font">${FONTTOK[n.font]||19}</token>${num(n.strokeT,0)>0?`<Color3 name="TextStrokeColor3">${c3(n.strokeTc||'#000000')}</Color3><float name="TextStrokeTransparency">0</float>`:''}<token name="TextXAlignment">${n.align==='left'?0:n.align==='right'?1:2}</token><bool name="TextWrapped">true</bool>`:'';
    const tstroke=n.cls!=='Frame'&&num(n.strokeT,0)>1?`<Item class="UIStroke" referent="${R()}"><Properties><Color3 name="Color">${c3(n.strokeTc||'#000000')}</Color3><float name="Thickness">${num(n.strokeT,1)}</float><token name="ApplyStrokeMode">0</token></Properties></Item>`:'';
    const corner=num(n.radius,0)>0?`<Item class="UICorner" referent="${R()}"><Properties><UDim name="CornerRadius"><S>0</S><O>${Math.round(num(n.radius,0))}</O></UDim></Properties></Item>`:'';
    const stroke=num(n.strokeW,0)>0?`<Item class="UIStroke" referent="${R()}"><Properties><Color3 name="Color">${c3(n.stroke)}</Color3><float name="Thickness">${num(n.strokeW,1)}</float><token name="ApplyStrokeMode">1</token></Properties></Item>`:'';
    return `<Item class="${n.cls}" referent="${R()}"><Properties><string name="Name">${x(n.name)}</string><bool name="Visible">${n.visible!==false}</bool><UDim2 name="Position">${ud(n.gpos||[0,0,0,0])}</UDim2><UDim2 name="Size">${ud(n.gsize||[0,100,0,40])}</UDim2>`+
      `<Vector2 name="AnchorPoint"><X>${num((n.anchor||[0,0])[0],0)}</X><Y>${num((n.anchor||[0,0])[1],0)}</Y></Vector2><Color3 name="BackgroundColor3">${c3(n.bg)}</Color3><float name="BackgroundTransparency">${num(n.bgT,0)}</float><int name="BorderSizePixel">0</int>${txt}</Properties>${corner}${stroke}${tstroke}${kids}</Item>`;};
  const guix=(by.get('gui')||[]).filter(isGuiNode).map(guiItem).join('');
  const sky=new THREE.Color(S.sky);const skyC=(0xff000000|(Math.round(sky.r*255)<<16)|(Math.round(sky.g*255)<<8)|Math.round(sky.b*255))>>>0;
  return `<roblox xmlns:xmime="http://www.w3.org/2005/05/xmlmime" version="4">\n<Item class="Workspace" referent="${R()}"><Properties><string name="Name">Workspace</string><float name="Gravity">${S.gravity}</float></Properties>${ws}</Item>\n`+
    `<Item class="Lighting" referent="${R()}"><Properties><string name="Name">Lighting</string><float name="FogEnd">${S.fog}</float><Color3uint8 name="FogColor">${skyC}</Color3uint8><float name="Brightness">${r3(2*S.brightness)}</float></Properties></Item>\n`+
    `<Item class="StarterGui" referent="${R()}"><Properties><string name="Name">StarterGui</string></Properties>${guix}</Item>\n`+
    `<Item class="StarterPack" referent="${R()}"><Properties><string name="Name">StarterPack</string></Properties>${packx}</Item>\n`+
    `<Item class="ReplicatedStorage" referent="${R()}"><Properties><string name="Name">ReplicatedStorage</string></Properties>${rsx}</Item>\n`+
    `<Item class="StarterPlayer" referent="${R()}"><Properties><string name="Name">StarterPlayer</string><float name="CharacterWalkSpeed">${S.walkSpeed}</float><bool name="CharacterUseJumpPower">true</bool><float name="CharacterJumpPower">${S.jumpPower}</float></Properties><Item class="StarterPlayerScripts" referent="${R()}"><Properties><string name="Name">StarterPlayerScripts</string></Properties>${spx}</Item></Item>\n`+
    `<Item class="ServerScriptService" referent="${R()}"><Properties><string name="Name">ServerScriptService</string></Properties>${sss}</Item>\n</roblox>\n`;
}

/* ---- viewport input ---- */
const ecv=ED.ecv;
ecv.addEventListener('contextmenu',e=>e.preventDefault());
ecv.addEventListener('pointerdown',e=>{
  $('#ctxMenu').hidden=true;
  const onGizmo=!!(tc&&tc.object&&tc.axis!==null&&e.button===0);
  if(ED.pd)return;
  ED.pd={id:e.pointerId,x:e.clientX,y:e.clientY,btn:e.button,gizmo:onGizmo,moved:0};
  if(!onGizmo){try{ecv.setPointerCapture(e.pointerId);}catch(_){}}
});
ecv.addEventListener('pointermove',e=>{
  const pd=ED.pd;if(!pd||pd.id!==e.pointerId||pd.gizmo||(tc&&tc.dragging))return;
  const dx=e.clientX-pd.x,dy=e.clientY-pd.y;pd.x=e.clientX;pd.y=e.clientY;pd.moved+=Math.abs(dx)+Math.abs(dy);
  if(pd.btn===1){const f=camForward(),rgt=new V3(Math.cos(ED.cam.yaw),0,-Math.sin(ED.cam.yaw)),up=new V3().crossVectors(rgt,f);
    ED.cam.pos.addScaledVector(rgt,-dx*.08).addScaledVector(up,dy*.08);return;}
  if(pd.moved>4){const k=coarse?.007:.005;ED.cam.yaw-=dx*k;ED.cam.pitch=Math.max(-1.5,Math.min(1.5,ED.cam.pitch-dy*k));}
});
const eUp=e=>{const pd=ED.pd;if(!pd||pd.id!==e.pointerId)return;ED.pd=null;
  if(e.type==='pointerup'&&pd.btn===0&&!pd.gizmo&&pd.moved<6&&!(tc&&tc.dragging))viewportPick(e);
  if(e.type==='pointerup'&&pd.btn===2&&pd.moved<6){viewportPick(e);showCtx(e.clientX,e.clientY);}};
ecv.addEventListener('pointerup',eUp);ecv.addEventListener('pointercancel',eUp);
ecv.addEventListener('wheel',e=>{e.preventDefault();ED.cam.pos.addScaledVector(camForward(),-e.deltaY*.06*(e.shiftKey?.3:1));},{passive:false});
[['flyFwd',1],['flyBack',-1]].forEach(([id,d])=>{const b=$('#'+id);b.addEventListener('pointerdown',e=>{e.preventDefault();ED.fly=d;});['pointerup','pointercancel','pointerleave'].forEach(evn=>b.addEventListener(evn,()=>{ED.fly=0;}));});
addEventListener('keydown',e=>{
  if(!ED.open||running)return;
  if(!$('#emodal').hidden){if(e.key==='Escape')$('#emodal').hidden=true;return;}
  const tag=(e.target.tagName||'').toLowerCase();
  const inField=tag==='input'||tag==='textarea'||tag==='select';
  if(e.key==='F5'){e.preventDefault();playtest();return;}
  if(inField)return;
  const inBlocks=ED.tab!=='viewport'&&(e.target.closest&&e.target.closest('#stBlocks,.blocklyWidgetDiv,.blocklyDropDownDiv'));
  if(!inBlocks&&curAnimNode()&&!e.target.closest('input,select,textarea')){const mod0=e.ctrlKey||e.metaKey,k0=e.key.toLowerCase();
    if(mod0&&k0==='z'&&!e.shiftKey){e.preventDefault();undo();}else if(mod0&&(k0==='y'||(k0==='z'&&e.shiftKey))){e.preventDefault();redo();}
    else if(e.key===' '){e.preventDefault();$('#anPlay').click();}else if(e.key==='Delete'||e.key==='Backspace'){e.preventDefault();$('#anDel').click();}
    else if(e.key==='k'||e.key==='K'){e.preventDefault();$('#anAdd').click();}
    else if(mod0&&k0==='c'){e.preventDefault();animCopy();}else if(mod0&&k0==='v'){e.preventDefault();animPaste(e.shiftKey);}
    return;}
  if(inBlocks||(ED.tab!=='viewport'&&ED.tab!=='gui'))return;
  const mod=e.ctrlKey||e.metaKey;
  if(mod){const k=e.key.toLowerCase();
    if(k==='z'&&!e.shiftKey){e.preventDefault();undo();}else if(k==='y'||(k==='z'&&e.shiftKey)){e.preventDefault();redo();}
    else if(k==='d'){e.preventDefault();duplicate();}else if(k==='c'){copySel();}else if(k==='v'){paste();}
    else if(k==='r'&&ED.tab==='viewport'){e.preventDefault();turnSelection('y');}else if(k==='t'&&ED.tab==='viewport'){e.preventDefault();turnSelection('x');}
    else if(k==='i'){e.preventDefault();doAct('ins-obj');}
    else if(k==='g'){e.preventDefault();group();}else if(k==='u'){e.preventDefault();ungroup();}
    return;}
  if(e.key==='Delete'||e.key==='Backspace'){e.preventDefault();del();return;}
  if(e.key==='F2'){e.preventDefault();doAct('rename');return;}
  if(e.key==='Escape'){select([]);return;}
  if(/^[1-4]$/.test(e.key)){setTool(['select','move','scale','rotate'][+e.key-1]);return;}
  if(e.code==='KeyF'){focusSel();return;}
  if(['KeyW','KeyA','KeyS','KeyD','KeyQ','KeyE','ShiftLeft','ShiftRight'].includes(e.code)&&document.activeElement===ecv){ED.keys.add(e.code);e.preventDefault();}
});
addEventListener('keyup',e=>ED.keys.delete(e.code));
addEventListener('blur',()=>ED.keys.clear());
function studioFrame(dt){
  if(ED.tab!=='viewport')return;
  const f=camForward(),rgt=new V3(Math.cos(ED.cam.yaw),0,-Math.sin(ED.cam.yaw));
  const k=ED.keys;const sp=(k.has('ShiftLeft')||k.has('ShiftRight')?14:48)*dt;
  if(k.has('KeyW'))ED.cam.pos.addScaledVector(f,sp);if(k.has('KeyS'))ED.cam.pos.addScaledVector(f,-sp);
  if(k.has('KeyD'))ED.cam.pos.addScaledVector(rgt,sp);if(k.has('KeyA'))ED.cam.pos.addScaledVector(rgt,-sp);
  if(k.has('KeyE'))ED.cam.pos.y+=sp;if(k.has('KeyQ'))ED.cam.pos.y-=sp;
  if(ED.fly)ED.cam.pos.addScaledVector(f,ED.fly*40*dt);
  ecam.position.copy(ED.cam.pos);ecam.lookAt(ED.cam.pos.clone().add(f));
  esun.position.set(ED.cam.pos.x+80,Math.max(160,ED.cam.pos.y+120),ED.cam.pos.z+60);esun.target.position.set(ED.cam.pos.x,0,ED.cam.pos.z);esun.target.updateMatrixWorld();
  for(const h of ED.helpers)h.update();
  for(const r of ED.rigs)animateRig(r.g.userData.rig,r.n.anim||'idle',performance.now()/1000+r.ph,false,dt);
  ED.emitters.forEach(e=>e.update(dt));
  setParticleScale(erenderer,ecam);
  erenderer.render(escene,ecam);
}

/* ---- blocks: definitions, theme, toolbox ---- */
const KEYOPTS=[['E','KeyE'],['F','KeyF'],['G','KeyG'],['Q','KeyQ'],['Z','KeyZ'],['X','KeyX'],['C','KeyC'],['V','KeyV'],['1','Digit1'],['2','Digit2'],['3','Digit3'],['space','Space'],['shift','ShiftLeft']];
const TFOPT=[['true','TRUE'],['false','FALSE']];
let BLOCK_THEME=null,TOOLBOX=null;
function defineBlocks(){
  if(BLOCK_THEME)return;
  const st={event:['#e6a800','#cc9600','#b38400'],control:['#ffab19','#ec9c13','#cf8b17'],part:['#4c97ff','#4280d7','#3373cc'],player:['#9966ff','#855cd6','#774dcb'],
    game:['#ff6680','#ff4d6a','#ff3355'],storage:['#0fbd8c','#0da57a','#0b8e69'],gui:['#00b8a9','#00a396','#008c81'],data:['#2e9bd6','#2789bf','#1f76a6'],anim:['#ff5fa2','#e84d8f','#cc3d7b'],tool:['#e8604c','#d14f3c','#b8402f'],rig:['#e6a14c','#cf8c3a','#b5782c'],fx:['#c46cff','#ad55eb','#9440d4'],sense:['#5cb1d6','#47a8d1','#2e8eb8'],ops:['#59c059','#46b946','#389438'],vars:['#ff8c1a','#ff8000','#db6e00']};
  const bs=(c,hat)=>Object.assign({colourPrimary:c[0],colourSecondary:c[1],colourTertiary:c[2]},hat?{hat:'cap'}:{});
  BLOCK_THEME=Blockly.Theme.defineTheme('brickyard',{base:Blockly.Themes.Classic,
    blockStyles:{event_blocks:bs(st.event,true),control_blocks:bs(st.control),part_blocks:bs(st.part),player_blocks:bs(st.player),game_blocks:bs(st.game),storage_blocks:bs(st.storage),gui_blocks:bs(st.gui),data_blocks:bs(st.data),anim_blocks:bs(st.anim),tool_blocks:bs(st.tool),rig_blocks:bs(st.rig),fx_blocks:bs(st.fx),sense_blocks:bs(st.sense),
      logic_blocks:bs(st.ops),math_blocks:bs(st.ops),text_blocks:bs(st.ops),loop_blocks:bs(st.control),variable_blocks:bs(st.vars),variable_dynamic_blocks:bs(st.vars),colour_blocks:bs(st.ops),list_blocks:bs(st.ops),procedure_blocks:bs(st.game)},
    categoryStyles:{events:{colour:st.event[0]},control:{colour:st.control[0]},parts:{colour:st.part[0]},player:{colour:st.player[0]},game:{colour:st.game[0]},storage:{colour:st.storage[0]},gui:{colour:st.gui[0]},data:{colour:st.data[0]},anim:{colour:st.anim[0]},tools:{colour:st.tool[0]},rigs:{colour:st.rig[0]},fx:{colour:st.fx[0]},sensing:{colour:st.sense[0]},ops:{colour:st.ops[0]},variables:{colour:st.vars[0]}},
    componentStyles:{workspaceBackgroundColour:'#121a2b',toolboxBackgroundColour:'#162135',toolboxForegroundColour:'#edf2ff',flyoutBackgroundColour:'#1b2840',flyoutForegroundColour:'#c9d3ec',
      flyoutOpacity:.97,scrollbarColour:'#3a4c70',scrollbarOpacity:.7,insertionMarkerColour:'#ffffff',insertionMarkerOpacity:.35,cursorColour:'#ff8a1f'},
    fontStyle:{family:'Figtree, system-ui, sans-serif',weight:'700',size:11}});
  const N=n=>({type:'input_value',name:n,check:'Number'});
  const PT=()=>({type:'input_value',name:'PART',check:'Part'});
  const S_=(o,style)=>Object.assign({previousStatement:null,nextStatement:null,inputsInline:true,style},o);
  const V_=(o,out,style)=>Object.assign({output:out,inputsInline:true,style},o);
  const H_=(o)=>Object.assign({nextStatement:null,style:'event_blocks'},o);
  Blockly.common.defineBlocksWithJsonArray([
    H_({type:'ev_start',message0:'when game starts',tooltip:'Runs once when the game begins.'}),
    H_({type:'ev_touch',message0:'when player touches this part',tooltip:'Runs each time the player steps onto or bumps into the part this script is in.'}),
    H_({type:'ev_click',message0:'when this part is clicked',tooltip:'Runs when the player clicks or taps the part this script is in.'}),
    H_({type:'ev_touch_model',message0:'when player touches this model',tooltip:'Runs when the player touches any part of the Model this script is in.'}),
    H_({type:'ev_click_model',message0:'when this model is clicked',tooltip:'Runs when the player clicks any part of the Model this script is in.'}),
    H_({type:'ev_mouse',message0:'when mouse clicked',tooltip:'Runs every time the player clicks or taps anywhere in the game.'}),
    H_({type:'ev_key',message0:'when %1 key pressed',args0:[{type:'field_dropdown',name:'KEY',options:KEYOPTS}]}),
    H_({type:'ev_every',message0:'every %1 seconds',args0:[{type:'field_number',name:'S',value:1,min:.05,precision:.05}]}),
    H_({type:'ev_msg',message0:'when I receive %1',args0:[{type:'field_input',name:'MSG',text:'open'}],tooltip:'Runs when any script broadcasts this message.'}),
    H_({type:'ev_died',message0:'when player dies'}),
    S_({type:'c_broadcast',message0:'broadcast %1',args0:[{type:'field_input',name:'MSG',text:'open'}]},'event_blocks'),
    S_({type:'c_wait',message0:'wait %1 seconds',args0:[N('S')],tooltip:'Pauses this script. 0 waits one frame.'},'control_blocks'),
    {type:'c_forever',message0:'forever %1 %2',args0:[{type:'input_dummy'},{type:'input_statement',name:'DO'}],previousStatement:null,style:'control_blocks'},
    S_({type:'c_wait_until',message0:'wait until %1',args0:[{type:'input_value',name:'COND',check:'Boolean'}]},'control_blocks'),
    {type:'c_stop',message0:'stop this script',previousStatement:null,style:'control_blocks'},
    V_({type:'p_this',message0:'this part',tooltip:'The part this script is inside.'},'Part','part_blocks'),
    V_({type:'p_named',message0:'part named %1',args0:[{type:'field_input',name:'NAME',text:'Part'}]},'Part','part_blocks'),
    V_({type:'p_model',message0:'this model',tooltip:'The Model this script is inside. Part blocks move, rotate, color or clone every part in it together.'},'Part','part_blocks'),
    V_({type:'p_model_named',message0:'model named %1',args0:[{type:'field_input',name:'NAME',text:'Model'}]},'Part','part_blocks'),
    S_({type:'p_move',message0:'move %1 by x %2 y %3 z %4',args0:[PT(),N('X'),N('Y'),N('Z')]},'part_blocks'),
    S_({type:'p_setpos',message0:'set %1 position to x %2 y %3 z %4',args0:[PT(),N('X'),N('Y'),N('Z')]},'part_blocks'),
    S_({type:'p_glide',message0:'glide %1 by x %2 y %3 z %4 in %5 s',args0:[PT(),N('X'),N('Y'),N('Z'),N('S')],tooltip:'Smoothly slides the part. Players standing on it ride along.'},'part_blocks'),
    S_({type:'p_glideto',message0:'glide %1 to x %2 y %3 z %4 in %5 s',args0:[PT(),N('X'),N('Y'),N('Z'),N('S')]},'part_blocks'),
    S_({type:'p_label',message0:'set label of %1 to %2',args0:[PT(),{type:'input_value',name:'TEXT'}],tooltip:'Shows text floating above the part, like a sign or a price tag. Use empty text to remove it.'},'part_blocks'),
    S_({type:'p_rotate',message0:'rotate %1 by %2 degrees around %3',args0:[PT(),N('DEG'),{type:'field_dropdown',name:'AXIS',options:[['Y','y'],['X','x'],['Z','z']]}]},'part_blocks'),
    S_({type:'p_color',message0:'set %1 color to %2',args0:[PT(),{type:'field_colour',name:'COLOUR',colour:'#ff4d5e'}]},'part_blocks'),
    S_({type:'p_transp',message0:'set %1 transparency to %2',args0:[PT(),N('V')]},'part_blocks'),
    S_({type:'p_material',message0:'set %1 material to %2',args0:[PT(),{type:'field_dropdown',name:'MAT',options:MATERIALS.map(m=>[m,m])}]},'part_blocks'),
    S_({type:'p_collide',message0:'set %1 can collide %2',args0:[PT(),{type:'field_dropdown',name:'B',options:TFOPT}]},'part_blocks'),
    S_({type:'p_visible',message0:'set %1 visible %2',args0:[PT(),{type:'field_dropdown',name:'B',options:TFOPT}]},'part_blocks'),
    S_({type:'p_anchor',message0:'set %1 anchored %2',args0:[PT(),{type:'field_dropdown',name:'B',options:TFOPT}],tooltip:'Unanchored parts fall.'},'part_blocks'),
    S_({type:'p_deadly',message0:'set %1 deadly %2',args0:[PT(),{type:'field_dropdown',name:'B',options:TFOPT}]},'part_blocks'),
    S_({type:'p_break',message0:'break parts within %1 studs of x %2 y %3 z %4 power %5',args0:[N('R'),N('X'),N('Y'),N('Z'),N('P')],inputsInline:true,tooltip:'Explosion! Nearby parts come loose and fly, and parts resting on them fall. Big parts (over 40 studs) and parts marked Unbreakable stay put.'},'part_blocks'),
    S_({type:'p_clone',message0:'clone %1 and move it by x %2 y %3 z %4',args0:[PT(),N('X'),N('Y'),N('Z')]},'part_blocks'),
    S_({type:'p_destroy',message0:'destroy %1',args0:[PT()]},'part_blocks'),
    S_({type:'rs_copy',message0:'copy %1 from ReplicatedStorage to x %2 y %3 z %4',args0:[{type:'field_input',name:'NAME',text:'Crate'},N('X'),N('Y'),N('Z')],tooltip:'Makes a copy of an item stored in ReplicatedStorage and puts it in the world. Scripts inside the copy start running.'},'storage_blocks'),
    S_({type:'rs_onto',message0:'copy %1 from ReplicatedStorage onto %2',args0:[{type:'field_input',name:'NAME',text:'Crate'},PT()]},'storage_blocks'),
    V_({type:'rs_last',message0:'last copied item',tooltip:'The most recent copy made from ReplicatedStorage. Use it with Parts blocks.'},'Part','storage_blocks'),
    S_({type:'rig_walk',message0:'make %1 walk to x %2 z %3',args0:[PT(),N('X'),N('Z')],tooltip:'The rig walks there, following the ground. The script waits until it arrives.'},'rig_blocks'),
    S_({type:'rig_walkp',message0:'make %1 walk to the player',args0:[PT()]},'rig_blocks'),
    S_({type:'rig_walkn',message0:'make %1 walk to the nearest player',args0:[PT()],tooltip:'Chases whichever player is closest, including other players online.'},'rig_blocks'),
    V_({type:'s_near_axis',message0:'%2 of the nearest player to %1',args0:[PT(),{type:'field_dropdown',name:'AXIS',options:[['x','x'],['y','y'],['z','z']]}]},'Number','rig_blocks'),
    V_({type:'s_near_dist',message0:'distance from %1 to the nearest player',args0:[PT()]},'Number','rig_blocks'),
    S_({type:'rig_anim',message0:'make %1 play %2',args0:[PT(),{type:'field_dropdown',name:'ANIM',options:RIG_ANIMS.map(a=>[a[1].toLowerCase(),a[0]])}]},'rig_blocks'),
    S_({type:'rig_say',message0:'make %1 say %2 for %3 seconds',args0:[PT(),{type:'input_value',name:'TEXT'},N('S')]},'rig_blocks'),
    S_({type:'rig_face',message0:'make %1 face the player',args0:[PT()]},'rig_blocks'),
    H_({type:'ev_tool_act',message0:'when this tool is used',tooltip:'Runs when the player clicks or taps while holding this tool.'}),
    H_({type:'ev_tool_equip',message0:'when this tool is equipped'}),
    H_({type:'ev_tool_unequip',message0:'when this tool is put away'}),
    H_({type:'ev_tool_hit',message0:'when this tool hits a part',tooltip:'Runs when a swing or a projectile from this tool hits something. Use the "hit part" block inside.'}),
    H_({type:'ev_rig_died',message0:'when this rig dies'}),
    H_({type:'ev_spawn',message0:'when I spawn',tooltip:'Runs when the game starts and every time the player respawns. Great in StarterPlayer scripts.'}),
    H_({type:'ev_jump',message0:'when I jump',tooltip:'Runs each time the player jumps.'}),
    S_({type:'anim_play_me',message0:'play animation %1 on my character %2',args0:[{type:'input_value',name:'NAME'},{type:'field_dropdown',name:'MODE',options:[['once','once'],['once and wait','wait'],['looping','loop']]}],tooltip:'Plays an Animation from your game (by name) or a built-in one: Wave, Dance, Cheer, Point, Sit, Bow, Jumping jacks, Spin, Flex.'},'anim_blocks'),
    S_({type:'anim_play_rig',message0:'play animation %1 on rig %2 %3',args0:[{type:'input_value',name:'NAME'},PT(),{type:'field_dropdown',name:'MODE',options:[['once','once'],['once and wait','wait'],['looping','loop']]}]},'anim_blocks'),
    S_({type:'anim_stop_me',message0:'stop my animation'},'anim_blocks'),
    S_({type:'anim_stop_rig',message0:'stop animation on rig %1',args0:[PT()]},'anim_blocks'),
    V_({type:'s_anim_playing',message0:'my animation is playing?'},'Boolean','anim_blocks'),
    H_({type:'ev_gui_click',message0:'when this button is clicked',tooltip:'Runs when the player clicks or taps the TextButton this script is in.'}),
    V_({type:'gui_this',message0:'this gui',tooltip:'The GUI element this script is inside.'},'Gui','gui_blocks'),
    V_({type:'gui_named',message0:'gui named %1',args0:[{type:'field_input',name:'NAME',text:'Label'}]},'Gui','gui_blocks'),
    S_({type:'gui_settext',message0:'set text of %1 to %2',args0:[{type:'input_value',name:'GUI',check:'Gui'},{type:'input_value',name:'TEXT'}]},'gui_blocks'),
    S_({type:'gui_visible',message0:'set %1 visible %2',args0:[{type:'input_value',name:'GUI',check:'Gui'},{type:'field_dropdown',name:'B',options:[['true','TRUE'],['false','FALSE']]}]},'gui_blocks'),
    S_({type:'gui_font',message0:'set font of %1 to %2',args0:[{type:'input_value',name:'GUI',check:'Gui'},{type:'field_dropdown',name:'FONT',options:GUI_FONT_LIST.map(f=>[f[1],f[0]])}]},'gui_blocks'),
    S_({type:'gui_outline',message0:'set text outline of %1 to %2 width %3',args0:[{type:'input_value',name:'GUI',check:'Gui'},{type:'field_colour',name:'COLOUR',colour:'#000000'},N('W')]},'gui_blocks'),
    S_({type:'gui_textsize',message0:'set text size of %1 to %2',args0:[{type:'input_value',name:'GUI',check:'Gui'},N('N')]},'gui_blocks'),
    S_({type:'gui_color',message0:'set %1 %2 color to %3',args0:[{type:'input_value',name:'GUI',check:'Gui'},{type:'field_dropdown',name:'WHAT',options:[['background','bg'],['text','text']]},{type:'field_colour',name:'COLOUR',colour:'#3ddc84'}]},'gui_blocks'),
    V_({type:'s_gui_text',message0:'text of %1',args0:[{type:'input_value',name:'GUI',check:'Gui'}]},'String','gui_blocks'),
    V_({type:'tool_hitpart',message0:'hit part',tooltip:'The part or rig this tool just hit.'},'Part','tool_blocks'),
    S_({type:'tool_swing',message0:'swing this tool',tooltip:'Plays a slash and checks what the tool touches for a moment.'},'tool_blocks'),
    S_({type:'tool_shoot',message0:'shoot a %1 projectile at speed %2',args0:[{type:'field_colour',name:'COLOUR',colour:'#5cc8ff'},N('S')],tooltip:'Fires toward the middle of the screen. Hits run "when this tool hits a part".'},'tool_blocks'),
    S_({type:'tool_give',message0:'give the player tool %1',args0:[{type:'field_input',name:'NAME',text:'Sword'}],tooltip:'Looks in StarterPack, then ReplicatedStorage, then anywhere.'},'tool_blocks'),
    S_({type:'tool_take',message0:'take tool %1 from the player',args0:[{type:'field_input',name:'NAME',text:'Sword'}]},'tool_blocks'),
    S_({type:'tool_unequip',message0:'make the player put away their tool'},'tool_blocks'),
    V_({type:'s_has_tool',message0:'player has tool %1 ?',args0:[{type:'field_input',name:'NAME',text:'Sword'}]},'Boolean','tool_blocks'),
    V_({type:'s_isrig',message0:'%1 is a rig?',args0:[PT()]},'Boolean','sense_blocks'),
    V_({type:'s_isplayer',message0:'%1 is another player?',args0:[PT()],tooltip:'True when a tool hit another player in this online game.'},'Boolean','sense_blocks'),
    V_({type:'s_players',message0:'players online'},'Number','sense_blocks'),
    V_({type:'s_is_host',message0:'I am the host',tooltip:'True on the one computer that runs bots and host-only scripts in a multiplayer game (and always when you play alone).'},'Boolean','sense_blocks'),
    S_({type:'pl_damage_other',message0:'damage player %1 by %2',args0:[PT(),N('N')],tooltip:'Hurts another player in an online game, for example the "hit part" of a sword.'},'player_blocks'),
    S_({type:'pl_damage',message0:'damage the player by %1',args0:[N('N')]},'player_blocks'),
    S_({type:'pl_heal',message0:'heal the player by %1',args0:[N('N')]},'player_blocks'),
    V_({type:'s_health',message0:'player health'},'Number','sense_blocks'),
    S_({type:'rig_damage',message0:'damage %1 by %2',args0:[PT(),N('N')]},'rig_blocks'),
    S_({type:'rig_heal',message0:'heal %1 by %2',args0:[PT(),N('N')]},'rig_blocks'),
    S_({type:'rig_speed',message0:'set walk speed of %1 to %2',args0:[PT(),N('N')]},'rig_blocks'),
    V_({type:'s_rig_health',message0:'health of %1',args0:[PT()]},'Number','rig_blocks'),
    S_({type:'pe_emit',message0:'emit %1 particles from %2',args0:[N('N'),PT()],tooltip:'Bursts particles from every ParticleEmitter inside the part or model.'},'fx_blocks'),
    S_({type:'pe_toggle',message0:'turn particles in %1 %2',args0:[PT(),{type:'field_dropdown',name:'B',options:[['on','TRUE'],['off','FALSE']]}]},'fx_blocks'),
    S_({type:'pl_kill',message0:'kill the player'},'player_blocks'),
    S_({type:'pl_teleport',message0:'teleport player onto %1',args0:[PT()]},'player_blocks'),
    S_({type:'pl_launch',message0:'launch player up with power %1',args0:[N('P')]},'player_blocks'),
    S_({type:'pl_speed',message0:'set walk speed to %1',args0:[N('V')]},'player_blocks'),
    S_({type:'pl_jump',message0:'set jump power to %1',args0:[N('V')]},'player_blocks'),
    S_({type:'pl_gravity',message0:'set gravity to %1',args0:[N('V')]},'player_blocks'),
    {type:'pl_as',message0:'as player %1 do',args0:[{type:'input_value',name:'WHO',check:['Player','Part']}],message1:'%1',args1:[{type:'input_statement',name:'DO'}],previousStatement:null,nextStatement:null,style:'player_blocks',
      tooltip:'Runs the blocks inside for other players too. Each chosen player runs them on their own character, so "damage the player", "freeze", "teleport" and the rest affect them. Works in online games.'},
    V_({type:'pl_ref',message0:'%1',args0:[{type:'field_dropdown',name:'WHO',options:[['everyone','all'],['everyone else','others'],['me','me'],['a random other player','random'],['the nearest other player','nearest'],['the player who sent this','sender'],['everyone still in the match','playing'],['a random player still in the match','randplaying']]}]},'Player','player_blocks'),
    V_({type:'s_touch_name',message0:'name of %1 touching this part',args0:[{type:'field_dropdown',name:'MODE',options:[['the player','first'],['all players','all']]}],tooltip:'The name of the player standing on or bumping into the part or model this script is in (blank if nobody is). "all players" lists every name, separated by commas.'},'String','sense_blocks'),
    V_({type:'s_touch_count',message0:'number of players touching this part',tooltip:'How many players (you included) are standing on or bumping into the part or model this script is in. Online, it counts everyone in the game.'},'Number','sense_blocks'),
    V_({type:'s_touch_player',message0:'touching player %1 ?',args0:[{type:'input_value',name:'WHO',check:['Player','Part']}],tooltip:'True while your character is bumping into one of these players. Leave it as "everyone else" to check for any player.'},'Boolean','player_blocks'),
    V_({type:'pl_ref_touchme',message0:'players touching me'},'Player','player_blocks'),
    V_({type:'pl_touched',message0:'touched player'},'Player','player_blocks'),
    H_({type:'ev_touch_player',message0:'when I touch another player',tooltip:'Runs once each time your character bumps into another player. Use "touched player" inside to know who. Great for tag games.'}),
    V_({type:'pl_ref_touch',message0:'players touching %1',args0:[PT()]},'Player','player_blocks'),
    V_({type:'pl_ref_named',message0:'player named %1',args0:[{type:'input_value',name:'NAME'}]},'Player','player_blocks'),
    V_({type:'s_pl_nameof',message0:'name of %1',args0:[{type:'input_value',name:'WHO',check:['Player','Part']}]},'String','player_blocks'),
    V_({type:'pl_ref_nearpart',message0:'the player nearest to %1',args0:[PT()]},'Player','player_blocks'),
    V_({type:'s_pl_id',message0:'my player id',tooltip:'A code that is different for every player in the game. Store it in a shared variable to remember a player.'},'String','player_blocks'),
    V_({type:'s_pl_idof',message0:'player id of %1',args0:[{type:'input_value',name:'WHO',check:['Player','Part']}]},'String','player_blocks'),
    V_({type:'s_pl_axisof',message0:'%2 position of %1',args0:[{type:'input_value',name:'WHO',check:['Player','Part']},{type:'field_dropdown',name:'AXIS',options:[['x','x'],['y','y'],['z','z']]}]},'Number','player_blocks'),
    V_({type:'s_pl_hpof',message0:'health of %1',args0:[{type:'input_value',name:'WHO',check:['Player','Part']}]},'Number','player_blocks'),
    V_({type:'s_pl_countof',message0:'number of %1',args0:[{type:'input_value',name:'WHO',check:['Player','Part']}]},'Number','player_blocks'),
    S_({type:'var_share_set',message0:'set %1 for everyone to %2',args0:[{type:'field_variable',name:'VAR',variable:'item'},{type:'input_value',name:'VALUE'}],tooltip:'Sets this variable for you and every other player in an online game.'},'variable_blocks'),
    S_({type:'var_share_change',message0:'change %1 for everyone by %2',args0:[{type:'field_variable',name:'VAR',variable:'item'},N('N')],tooltip:'Changes this variable for you and every other player in an online game.'},'variable_blocks'),
    S_({type:'pl_knock',message0:'knock the player away from %1 with power %2 %3 ragdoll',args0:[{type:'input_value',name:'WHO',check:['Player','Part']},N('P'),{type:'field_checkbox',name:'RAG',checked:false}],tooltip:'Pushes the player away from another player. Inside "as player", use "the player who sent this" to push them away from you.'},'player_blocks'),
    S_({type:'pl_ragdoll',message0:'ragdoll the player for %1 seconds',args0:[N('S')],tooltip:'The player goes limp and tumbles with physics, then gets back up.'},'player_blocks'),
    S_({type:'pl_fling',message0:'fling the player with power %1',args0:[N('P')],tooltip:'Throws the player backwards and up as a ragdoll.'},'player_blocks'),
    S_({type:'pl_getup',message0:'make the player get up'},'player_blocks'),
    V_({type:'s_pl_ragdoll',message0:'player is ragdolled?'},'Boolean','player_blocks'),
    S_({type:'rig_ragdoll',message0:'ragdoll rig %1 for %2 seconds',args0:[PT(),N('S')]},'rig_blocks'),
    S_({type:'rig_fling',message0:'fling rig %1 away from the player with power %2',args0:[PT(),N('P')]},'rig_blocks'),
    S_({type:'data_enable',message0:'turn auto-save %1',args0:[{type:'field_dropdown',name:'B',options:[['off','FALSE'],['on','TRUE']]}],tooltip:'Stops (or restarts) saving this player\'s progress for the rest of this game.'},'data_blocks'),
    S_({type:'pl_sethp',message0:'set health to %1',args0:[N('N')]},'player_blocks'),
    S_({type:'pl_maxhp',message0:'set max health to %1 %2 refill',args0:[N('N'),{type:'field_checkbox',name:'FILL',checked:true}]},'player_blocks'),
    S_({type:'pl_tpxyz',message0:'teleport player to x %1 y %2 z %3',args0:[N('X'),N('Y'),N('Z')]},'player_blocks'),
    S_({type:'pl_respawn',message0:'respawn the player'},'player_blocks'),
    S_({type:'pl_coins',message0:'give the player %1 shop coins',args0:[N('N')],tooltip:'Pays real coins the player can spend in the Avatar shop. Each play session can pay out up to 150 coins, and playtests pay nothing.'},'player_blocks'),
    S_({type:'pl_chute',message0:'parachute %1',args0:[{type:'field_dropdown',name:'B',options:[['open','TRUE'],['close','FALSE']]}],tooltip:'Opens a parachute over the player so they float down slowly. It closes by itself on landing.'},'player_blocks'),
    S_({type:'pl_freeze',message0:'freeze the player %1',args0:[{type:'field_dropdown',name:'B',options:[['on','TRUE'],['off','FALSE']]}],tooltip:'A frozen player cannot walk or jump. Handy for cutscenes and countdowns.'},'player_blocks'),
    S_({type:'pl_visible',message0:'make the player %1',args0:[{type:'field_dropdown',name:'B',options:[['invisible','FALSE'],['visible','TRUE']]}]},'player_blocks'),
    S_({type:'pl_shirt',message0:'set shirt color to %1',args0:[{type:'field_colour',name:'COLOUR',colour:'#e53935'}]},'player_blocks'),
    S_({type:'pl_say',message0:'player says %1 for %2 seconds',args0:[{type:'input_value',name:'TEXT'},N('S')],tooltip:'Shows a speech bubble over the player. Other players online see it too.'},'player_blocks'),
    S_({type:'pl_shield',message0:'give the player a force field for %1 seconds',args0:[N('S')],tooltip:'The player cannot take damage while the bubble is up.'},'player_blocks'),
    S_({type:'pl_airjumps',message0:'set extra air jumps to %1',args0:[N('N')],tooltip:'1 gives a double jump, 2 a triple jump, and so on.'},'player_blocks'),
    S_({type:'pl_face',message0:'turn the player to face %1',args0:[PT()]},'player_blocks'),
    S_({type:'pl_camera',message0:'set camera to %1 zoom %2',args0:[{type:'field_dropdown',name:'MODE',options:[['first person','first'],['third person','third'],['zoom distance','zoom']]},N('N')],tooltip:'The zoom number is only used for "zoom distance".'},'player_blocks'),
    H_({type:'ev_data_loaded',message0:'when my save data loads',tooltip:'Runs once the player\'s saved progress has loaded, a moment after the game starts. Read saved values here.'}),
    S_({type:'data_set',message0:'save %1 as %2',args0:[{type:'input_value',name:'KEY'},{type:'input_value',name:'V'}],tooltip:'Stores a value in this player\'s save data. It is kept for next time they play.'},'data_blocks'),
    S_({type:'data_change',message0:'change saved %1 by %2',args0:[{type:'input_value',name:'KEY'},N('N')]},'data_blocks'),
    S_({type:'data_del',message0:'erase saved %1',args0:[{type:'input_value',name:'KEY'}]},'data_blocks'),
    S_({type:'data_clear',message0:'erase all my progress',tooltip:'Clears this player\'s saved values, stats and checkpoint.'},'data_blocks'),
    S_({type:'data_now',message0:'save progress now %1 show message',args0:[{type:'field_checkbox',name:'SHOW',checked:true}],tooltip:'Progress also saves by itself every few seconds and when the player leaves.'},'data_blocks'),
    V_({type:'data_get',message0:'saved %1',args0:[{type:'input_value',name:'KEY'}],tooltip:'A value from this player\'s save data, or 0 if nothing is saved under that name.'},null,'data_blocks'),
    V_({type:'data_get_or',message0:'saved %1 or %2 if nothing saved',args0:[{type:'input_value',name:'KEY'},{type:'input_value',name:'DEF'}],tooltip:'Reads a saved value, but gives the second value when this player has nothing saved yet (for example on their first visit).'},null,'data_blocks'),
    V_({type:'data_has',message0:'has saved %1 ?',args0:[{type:'input_value',name:'KEY'}]},'Boolean','data_blocks'),
    V_({type:'data_loaded',message0:'save data loaded?'},'Boolean','data_blocks'),
    V_({type:'data_returning',message0:'returning player?',tooltip:'True if this player had saved progress from an earlier visit.'},'Boolean','data_blocks'),
    H_({type:'ev_land',message0:'when I land',tooltip:'Runs when the player lands after a jump or a fall.'}),
    H_({type:'ev_hurt',message0:'when I take damage',tooltip:'Runs each time the player loses health.'}),
    V_({type:'s_pl_name',message0:'player name'},'String','player_blocks'),
    V_({type:'s_pl_maxhp',message0:'max health'},'Number','player_blocks'),
    V_({type:'s_pl_speed',message0:'walk speed'},'Number','player_blocks'),
    V_({type:'s_land_speed',message0:'landing speed'},'Number','player_blocks'),
    V_({type:'s_pl_moving',message0:'player is moving?'},'Boolean','player_blocks'),
    V_({type:'s_pl_alive',message0:'player is alive?'},'Boolean','player_blocks'),
    V_({type:'s_pl_shield',message0:'player has force field?'},'Boolean','player_blocks'),
    V_({type:'s_pl_tool',message0:'held tool name'},'String','player_blocks'),
    S_({type:'pl_checkpoint',message0:'set respawn point to %1',args0:[PT()]},'player_blocks'),
    S_({type:'g_msg',message0:'show message %1 for %2 seconds',args0:[{type:'input_value',name:'TEXT'},N('S')]},'game_blocks'),
    S_({type:'g_print',message0:'print %1',args0:[{type:'input_value',name:'TEXT'}],tooltip:'Writes to the Output panel.'},'game_blocks'),
    S_({type:'g_stat_change',message0:'change stat %1 by %2',args0:[{type:'field_input',name:'STAT',text:'Coins'},N('N')],tooltip:'Stats show at the top of the screen, like leaderstats.'},'game_blocks'),
    S_({type:'g_stat_set',message0:'set stat %1 to %2',args0:[{type:'field_input',name:'STAT',text:'Coins'},N('N')]},'game_blocks'),
    S_({type:'g_win',message0:'win the game'},'game_blocks'),
    S_({type:'g_sound',message0:'play sound %1',args0:[{type:'field_dropdown',name:'SND',options:[['coin','coin'],['jump','jump'],['boing','pad'],['checkpoint','check'],['victory','win'],['whoosh','boost'],['click','click'],['boom','explode'],['oof','die'],['heartbeat','heart']]}]},'game_blocks'),
    S_({type:'g_sky',message0:'set sky color to %1',args0:[{type:'field_colour',name:'COLOUR',colour:'#1a1f3d'}]},'game_blocks'),
    S_({type:'g_callout',message0:'show big callout %1',args0:[{type:'input_value',name:'TEXT'}],tooltip:'A big bouncy message in the middle of the screen, like DOUBLE KO!'},'game_blocks'),
    S_({type:'g_music',message0:'play music %1',args0:[{type:'field_dropdown',name:'STYLE',options:[['battle','battle'],['party','party'],['obby','obby'],['race','race'],['spooky','horror'],['survival','survival'],['chill build','build'],['off','off']]}],tooltip:'Background music for this player. Choose off to stop it.'},'game_blocks'),
    S_({type:'g_shake',message0:'shake the screen %1',args0:[{type:'field_dropdown',name:'POW',options:[['a little','.3'],['a lot','.7'],['HUGE','1.1']]}],tooltip:'Shakes the camera, great for explosions.'},'game_blocks'),
    S_({type:'g_reset_timer',message0:'reset timer'},'game_blocks'),
    V_({type:'s_mouse_down',message0:'mouse down?',tooltip:'True while the player holds the left mouse button (or a finger) on the game.'},'Boolean','sense_blocks'),
    V_({type:'s_mouse_part',message0:'part under mouse',tooltip:'The part the mouse is pointing at, or nothing.'},'Part','sense_blocks'),
    V_({type:'s_mouse_xy',message0:'mouse %1',args0:[{type:'field_dropdown',name:'AXIS',options:[['x','x'],['y','y']]}],tooltip:'Mouse position like Scratch: x from -240 to 240, y from -180 to 180, with 0, 0 in the middle.'},'Number','sense_blocks'),
    V_({type:'s_partname',message0:'name of %1',args0:[PT()],tooltip:'The name of a part, rig or model. Handy with "hit part" to check what a tool hit.'},'String','sense_blocks'),
    V_({type:'s_touching',message0:'player touching %1 ?',args0:[PT()]},'Boolean','sense_blocks'),
    V_({type:'s_key',message0:'key %1 pressed?',args0:[{type:'field_dropdown',name:'KEY',options:KEYOPTS}]},'Boolean','sense_blocks'),
    V_({type:'s_grounded',message0:'player on ground?'},'Boolean','sense_blocks'),
    V_({type:'s_distance',message0:'distance from player to %1',args0:[PT()]},'Number','sense_blocks'),
    V_({type:'s_player',message0:'player %1',args0:[{type:'field_dropdown',name:'AXIS',options:[['x','x'],['y','y'],['z','z'],['speed','speed']]}]},'Number','sense_blocks'),
    V_({type:'s_prop',message0:'%1 of %2',args0:[{type:'field_dropdown',name:'PROP',options:[['x position','x'],['y position','y'],['z position','z'],['size x','sx'],['size y','sy'],['size z','sz'],['transparency','tr']]},PT()]},'Number','sense_blocks'),
    V_({type:'s_timer',message0:'timer'},'Number','sense_blocks'),
    V_({type:'s_stat',message0:'stat %1',args0:[{type:'field_input',name:'STAT',text:'Coins'}]},'Number','sense_blocks')
  ]);
  const K=(type,inputs,fields,extra)=>Object.assign({kind:'block',type},inputs?{inputs}:{},fields?{fields}:{},extra||{});
  const n_=v=>({shadow:{type:'math_number',fields:{NUM:v}}}),t_=s=>({shadow:{type:'text',fields:{TEXT:s}}}),me=()=>({shadow:{type:'p_this'}});
  const xyz=(x,y,z)=>({PART:me(),X:n_(x),Y:n_(y),Z:n_(z)});
  TOOLBOX={kind:'categoryToolbox',contents:[
    {kind:'category',name:'Events',categorystyle:'events',contents:[K('ev_start'),K('ev_touch'),K('ev_click'),K('ev_touch_model'),K('ev_click_model'),K('ev_key'),K('ev_mouse'),K('ev_every'),K('ev_msg'),K('c_broadcast'),K('ev_died')]},
    {kind:'category',name:'Control',categorystyle:'control',contents:[K('c_wait',{S:n_(1)}),K('c_forever'),K('controls_repeat_ext',{TIMES:n_(10)}),K('controls_if'),
      K('controls_if',null,null,{extraState:{hasElse:true}}),K('c_wait_until'),K('controls_whileUntil'),K('c_stop')]},
    {kind:'category',name:'Parts',categorystyle:'parts',contents:[K('p_this'),K('p_named'),K('p_model'),K('p_model_named'),K('p_glide',Object.assign(xyz(0,0,10),{S:n_(2)})),K('p_glideto',Object.assign(xyz(0,10,0),{S:n_(2)})),
      K('p_move',xyz(0,1,0)),K('p_setpos',xyz(0,10,0)),K('p_rotate',{PART:me(),DEG:n_(15)}),K('p_color',{PART:me()}),K('p_transp',{PART:me(),V:n_(.5)}),K('p_material',{PART:me()}),K('p_label',{PART:me(),TEXT:t_('Hello!')}),
      K('p_collide',{PART:me()},{B:'FALSE'}),K('p_visible',{PART:me()},{B:'FALSE'}),K('p_anchor',{PART:me()},{B:'FALSE'}),K('p_deadly',{PART:me()}),K('p_break',{R:n_(10),X:n_(0),Y:n_(2),Z:n_(0),P:n_(60)}),K('p_clone',xyz(0,5,0)),K('p_destroy',{PART:me()})]},
    {kind:'category',name:'Player',categorystyle:'player',contents:[K('pl_kill'),K('pl_damage',{N:n_(20)}),K('pl_heal',{N:n_(20)}),K('pl_teleport',{PART:{shadow:{type:'p_this'},block:{type:'p_named',fields:{NAME:'Part'}}}}),K('pl_launch',{P:n_(90)}),
      K('pl_speed',{V:n_(24)}),K('pl_jump',{V:n_(70)}),K('pl_gravity',{V:n_(100)}),K('pl_checkpoint',{PART:me()}),
      K('pl_as',{WHO:{shadow:{type:'pl_ref',fields:{WHO:'others'}}},DO:{block:{type:'pl_freeze',fields:{B:'TRUE'},next:{block:{type:'c_wait',inputs:{S:n_(3)},next:{block:{type:'pl_freeze',fields:{B:'FALSE'}}}}}}}}),
      K('pl_as',{WHO:{block:{type:'tool_hitpart'}},DO:{block:{type:'pl_launch',inputs:{P:n_(90)}}}}),
      K('s_touch_player',{WHO:{shadow:{type:'pl_ref',fields:{WHO:'others'}}}}),K('s_touch_count'),K('s_touch_name'),K('ev_touch_player'),
      K('pl_as',{WHO:{block:{type:'pl_touched'}},DO:{block:{type:'pl_say',inputs:{TEXT:t_("You're it!"),S:n_(2)}}}}),
      K('pl_touched'),K('pl_ref_touchme'),K('pl_ref',null,{WHO:'others'}),K('pl_ref_touch',{PART:me()}),K('pl_ref_named',{NAME:t_('Player1')}),
      K('s_pl_nameof',{WHO:{shadow:{type:'pl_ref',fields:{WHO:'nearest'}}}}),K('s_pl_id'),K('pl_ref_nearpart',{PART:me()}),K('s_pl_idof',{WHO:{shadow:{type:'pl_ref',fields:{WHO:'nearest'}}}}),K('s_pl_axisof',{WHO:{shadow:{type:'pl_ref',fields:{WHO:'nearest'}}}}),K('s_pl_hpof',{WHO:{shadow:{type:'pl_ref',fields:{WHO:'nearest'}}}}),K('s_pl_countof',{WHO:{shadow:{type:'pl_ref',fields:{WHO:'others'}}}}),
      K('pl_as',{WHO:{block:{type:'pl_ref_touchme'}},DO:{block:{type:'pl_knock',inputs:{WHO:{shadow:{type:'pl_ref',fields:{WHO:'sender'}}},P:n_(60)}}}}),K('pl_knock',{WHO:{shadow:{type:'pl_ref',fields:{WHO:'sender'}}},P:n_(60)}),
      K('pl_ragdoll',{S:n_(3)}),K('pl_fling',{P:n_(80)}),K('pl_getup'),K('s_pl_ragdoll'),
      K('ev_spawn'),K('ev_jump'),K('ev_land'),K('ev_hurt'),
      K('pl_sethp',{N:n_(100)}),K('pl_maxhp',{N:n_(200)}),K('pl_tpxyz',{X:n_(0),Y:n_(20),Z:n_(0)}),K('pl_respawn'),K('pl_freeze',null,{B:'TRUE'}),K('pl_chute',null,{B:'TRUE'}),K('pl_coins',{N:n_(5)}),K('pl_visible',null,{B:'FALSE'}),
      K('pl_shirt'),K('pl_say',{TEXT:t_('Hello!'),S:n_(3)}),K('pl_shield',{S:n_(5)}),K('pl_airjumps',{N:n_(1)}),K('pl_face',{PART:{shadow:{type:'p_this'},block:{type:'p_named',fields:{NAME:'Part'}}}}),K('pl_camera',{N:n_(30)}),
      K('s_pl_name'),K('s_health'),K('s_pl_maxhp'),K('s_pl_speed'),K('s_pl_moving'),K('s_land_speed'),K('s_pl_alive'),K('s_pl_shield'),K('s_pl_tool'),K('s_grounded'),K('s_player')]},
    {kind:'category',name:'Saving',categorystyle:'data',contents:[K('ev_data_loaded'),K('data_set',{KEY:t_('level'),V:n_(1)}),K('data_change',{KEY:t_('gems'),N:n_(1)}),K('data_get',{KEY:t_('level')}),K('data_get_or',{KEY:t_('strength'),DEF:n_(50)}),K('data_has',{KEY:t_('level')}),
      K('data_returning'),K('data_loaded'),K('data_now'),K('data_enable',null,{B:'FALSE'}),K('data_del',{KEY:t_('level')}),K('data_clear'),
      K('ev_data_loaded',null,null,{next:{block:{type:'controls_if',inputs:{IF0:{block:{type:'data_returning'}},DO0:{block:{type:'g_msg',inputs:{TEXT:t_('Welcome back!'),S:n_(3)}}}}}}})]},
    {kind:'category',name:'Animation',categorystyle:'anim',contents:[K('ev_spawn'),K('ev_jump'),K('anim_play_me',{NAME:t_('Wave')},{MODE:'once'}),K('anim_play_rig',{NAME:t_('Dance'),PART:me()},{MODE:'loop'}),
      K('anim_stop_me'),K('anim_stop_rig',{PART:me()}),K('s_anim_playing')]},
    {kind:'category',name:'GUI',categorystyle:'gui',contents:[K('ev_gui_click'),K('gui_this'),K('gui_named'),
      K('gui_settext',{GUI:{shadow:{type:'gui_this'},block:{type:'gui_named',fields:{NAME:'Label'}}},TEXT:t_('Hello!')}),
      K('gui_font',{GUI:{shadow:{type:'gui_this'}}},{FONT:'Cartoon'}),K('gui_outline',{GUI:{shadow:{type:'gui_this'}},W:n_(2)}),K('gui_textsize',{GUI:{shadow:{type:'gui_this'}},N:n_(32)}),
      K('gui_visible',{GUI:{shadow:{type:'gui_this'}}},{B:'FALSE'}),K('gui_color',{GUI:{shadow:{type:'gui_this'}}}),K('s_gui_text',{GUI:{shadow:{type:'gui_this'}}})]},
    {kind:'category',name:'Tools',categorystyle:'tools',contents:[K('ev_tool_act'),K('ev_tool_equip'),K('ev_tool_unequip'),K('ev_tool_hit'),K('tool_hitpart'),
      K('s_isrig',{PART:{shadow:{type:'p_this'},block:{type:'tool_hitpart'}}}),K('s_isplayer',{PART:{shadow:{type:'p_this'},block:{type:'tool_hitpart'}}}),K('pl_damage_other',{PART:{shadow:{type:'p_this'},block:{type:'tool_hitpart'}},N:n_(20)}),K('tool_swing'),K('tool_shoot',{S:n_(120)}),K('tool_give'),K('tool_take'),K('tool_unequip'),K('s_has_tool')]},
    {kind:'category',name:'Rigs',categorystyle:'rigs',contents:[K('ev_rig_died'),K('rig_damage',{PART:me(),N:n_(25)}),K('rig_heal',{PART:me(),N:n_(25)}),K('s_rig_health',{PART:me()}),K('rig_speed',{PART:me(),N:n_(16)}),K('rig_walk',{PART:me(),X:n_(0),Z:n_(10)}),K('rig_walkp',{PART:me()}),K('rig_walkn',{PART:me()}),K('s_near_axis',{PART:me()}),K('s_near_dist',{PART:me()}),K('rig_anim',{PART:me()}),
      K('rig_say',{PART:me(),TEXT:t_('Hello!'),S:n_(3)}),K('rig_ragdoll',{PART:me(),S:n_(3)}),K('rig_fling',{PART:me(),P:n_(80)}),K('rig_face',{PART:me()})]},
    {kind:'category',name:'Effects',categorystyle:'fx',contents:[K('pe_emit',{N:n_(30),PART:me()}),K('pe_toggle',{PART:me()})]},
    {kind:'category',name:'Storage',categorystyle:'storage',contents:[{kind:'label',text:'ReplicatedStorage'},K('rs_copy',{X:n_(0),Y:n_(20),Z:n_(0)}),K('rs_onto',{PART:me()}),K('rs_last')]},
    {kind:'category',name:'Game',categorystyle:'game',contents:[K('g_msg',{TEXT:t_('Hello!'),S:n_(2)}),K('g_callout',{TEXT:t_('YOU WIN!')}),K('g_music'),K('g_shake'),K('g_print',{TEXT:t_('Hello from my script')}),K('g_stat_change',{N:n_(1)}),K('g_stat_set',{N:n_(0)}),
      K('g_win'),K('g_sound'),K('g_sky'),K('g_reset_timer')]},
    {kind:'category',name:'Sensing',categorystyle:'sensing',contents:[K('s_health'),K('s_players'),K('s_is_host'),K('s_touching',{PART:me()}),K('s_touch_count'),K('s_touch_name'),K('s_partname',{PART:me()}),K('s_key'),K('s_mouse_down'),K('s_mouse_part'),K('s_mouse_xy'),K('s_grounded'),K('s_distance',{PART:me()}),K('s_player'),K('s_prop',{PART:me()}),K('s_timer'),K('s_stat')]},
    {kind:'category',name:'Operators',categorystyle:'ops',contents:[K('math_number'),K('math_arithmetic',{A:n_(1),B:n_(1)}),K('math_random_int',{FROM:n_(1),TO:n_(10)}),K('math_round',{NUM:n_(3.1)}),
      K('logic_compare',{A:n_(0),B:n_(0)}),K('logic_operation'),K('logic_negate'),K('logic_boolean'),K('text'),K('text_join',{ADD0:t_('Score: ')})]},
    {kind:'category',name:'Variables',categorystyle:'variables',custom:'BY_VARS'}
  ]};
}

/* ---------- launcher ---------- */
function shade(hex,f){const r=(hex>>16)&255,g=(hex>>8)&255,b=hex&255;const c=v=>Math.max(0,Math.min(255,Math.round(v*f)));return `rgb(${c(r)},${c(g)},${c(b)})`;}
function drawIso(canvas,cubes,skyA,skyB){
  canvas.width=640;canvas.height=360;const g=canvas.getContext('2d');
  const gr=g.createLinearGradient(0,0,0,360);gr.addColorStop(0,skyA);gr.addColorStop(1,skyB);g.fillStyle=gr;g.fillRect(0,0,640,360);
  const s=26,ox=320,oy=96;const pr=(x,y,z)=>[ox+(x-z)*s*.866,oy+(x+z)*s*.5-y*s];
  cubes.sort((a,b)=>(a[0]+a[2])-(b[0]+b[2])||a[1]-b[1]);
  const poly=(pts,fill)=>{g.beginPath();pts.forEach((p,i)=>{const q=pr(p[0],p[1],p[2]);i?g.lineTo(q[0],q[1]):g.moveTo(q[0],q[1]);});g.closePath();g.fillStyle=fill;g.fill();};
  for(const [x,y,z,c] of cubes){
    if(c==='coin'){const q=pr(x+.5,y+.5,z+.5);g.fillStyle='#ffc72c';g.beginPath();g.ellipse(q[0],q[1],9,13,0,0,7);g.fill();g.fillStyle='#fff3b0';g.fillRect(q[0]-2,q[1]-7,3,8);continue;}
    poly([[x,y+1,z],[x+1,y+1,z],[x+1,y+1,z+1],[x,y+1,z+1]],shade(c,1.15));
    poly([[x,y,z+1],[x+1,y,z+1],[x+1,y+1,z+1],[x,y+1,z+1]],shade(c,.86));
    poly([[x+1,y,z],[x+1,y,z+1],[x+1,y+1,z+1],[x+1,y+1,z]],shade(c,.66));
  }
}
const TB=(fn,a,b)=>c=>{const q=[];fn(q);drawIso(c,q,a,b);};
const floor=(q,n,col,y)=>{for(let x=0;x<n;x++)for(let z=0;z<n;z++)q.push([x,y==null?-1:y,z,typeof col==='function'?col(x,z):col]);};
const THUMBS_MORE={
  towerhell:TB(q=>{for(let y=0;y<7;y++){const c=[0xe53935,0x8e24aa,0x1e88e5,0x43a047,0xfdd835,0xfb8c00,0x00acc1][y];q.push([3,y,3,c],[5,y,3,c]);q.push([3+(y%3),y,5,0xb3e5fc]);}q.push([4,7,4,0xffd54f]);},'#1b1f3b','#3a3f6b'),
  murder:TB(q=>{floor(q,9,0x8d6e63);for(let i=0;i<9;i++)q.push([i,0,0,0xd7ccc8],[0,0,i,0xd7ccc8]);q.push([3,0,4,0x212121],[3,1,4,0xffcc80],[6,0,5,0x1e88e5],[6,1,5,0xffcc80],[4,1,4,0xcfd8dc],[7,1,5,0xffd54f]);},'#22253a','#4a4e6a'),
  doors:TB(q=>{floor(q,9,0x5d4037);for(let i=0;i<9;i++)q.push([0,0,i,0x4e342e],[0,1,i,0x4e342e],[8,0,i,0x4e342e],[8,1,i,0x4e342e]);q.push([3,0,0,0xa1887f],[4,0,0,0xa1887f],[3,1,0,0xa1887f],[4,1,0,0xa1887f],[1,0,5,0x3e2723],[1,1,5,0x3e2723],[6,0,4,0xffd54f]);},'#07080d','#2a1b1b'),
  arsenal:TB(q=>{floor(q,9,0xc2b280);q.push([2,0,2,0xbcaaa4],[2,1,2,0xbcaaa4],[6,0,6,0xbcaaa4],[6,1,6,0xbcaaa4],[6,2,6,0xbcaaa4]);q.push([4,0,4,0xe53935],[4,1,4,0xffcc80],[5,1,4,0xffd54f],[3,0,6,0x1e88e5],[3,1,6,0xffcc80]);},'#ffb74d','#ffe0b2'),
  deathrun:TB(q=>{for(let z=0;z<9;z++)q.push([4,0,z,z===3?0xff3d00:0x546e7a],[3,0,z,z===3?0xff3d00:0x546e7a]);q.push([3,1,6,0xb0bec5],[4,1,6,0xb0bec5],[7,3,2,0x212121],[7,4,2,0x212121],[6,3,4,0xd50000],[4,1,0,0xffd740]);},'#263238','#455a64'),
  hideseek:TB(q=>{floor(q,9,0x7cb342);q.push([1,0,1,0xef9a9a],[2,0,1,0xef9a9a],[1,1,1,0xb71c1c],[2,1,1,0xb71c1c],[6,0,6,0x90caf9],[7,0,6,0x90caf9],[6,1,6,0x0d47a1],[7,1,6,0x0d47a1]);q.push([4,0,3,0x2e7d32],[5,0,6,0x2e7d32],[2,0,6,0x2e7d32],[4,0,5,0x212121],[4,1,5,0xffcc80]);},'#a5d6f7','#e1f5fe'),
  evade:TB(q=>{floor(q,9,0x424242);q.push([1,0,1,0x5e35b1],[1,1,1,0x5e35b1],[1,2,1,0x5e35b1],[7,0,7,0x3949ab],[7,1,7,0x3949ab]);q.push([4,0,4,0xffeb3b],[4,1,4,0xffeb3b],[4,2,4,0xffeb3b],[6,0,3,0x1e88e5],[6,1,3,0xffcc80],[2,0,5,0x00e5ff]);},'#4a148c','#7b1fa2'),
  planecrash:TB(q=>{for(let x=0;x<9;x++)for(let z=0;z<9;z++)q.push([x,-1,z,Math.hypot(x-4,z-5)<3.2?0x558b2f:0x0277bd]);q.push([4,3,1,0xeceff1],[5,3,1,0xeceff1],[3,3,1,0xb0bec5],[6,3,1,0xb0bec5],[4,3,0,0xeceff1],[4,4,1,0xff6d00],[3,1,4,0xff7043],[5,0,6,0xffeb3b]);},'#90caf9','#e3f2fd'),
  disasters:TB(q=>{floor(q,9,0x5aa646);q.push([2,0,2,0xef9a9a],[2,1,2,0x6d4c41],[6,0,6,0xb0bec5],[6,1,6,0xb0bec5],[6,2,6,0xb0bec5]);q.push([4,5,2,0xff7043],[7,6,4,0xff7043],[1,4,6,0xff7043]);for(let x=0;x<9;x++)q.push([x,-1,8,0x1e88e5]);},'#5a7fb5','#c6d8f0'),
  ghost:TB(q=>{floor(q,9,0x1c2a1c);const M=['111111111','100010001','101110101','100000101','111011101','100010001','101110111','100000001','111111111'];M.forEach((r,z)=>[...r].forEach((ch,x)=>{if(ch==='1')q.push([x,0,z,0x24402a]);}));q.push([3,0,3,0xffd54f],[7,0,5,0xffd54f],[5,0,7,0xeceff1],[5,1,7,0xeceff1]);},'#05070d','#1a2238'),
  bombtag:TB(q=>{floor(q,9,0xf6e7c8);for(let i=0;i<9;i++){q.push([i,0,0,0xe07a5f],[0,0,i,0xe07a5f]);}q.push([2,0,2,0x81b29a],[2,1,2,0x81b29a],[6,0,6,0x81b29a],[6,1,6,0x81b29a]);q.push([4,0,4,0x1e88e5],[4,1,4,0xf5cd30],[4,2,4,0x263238],[6,0,3,0xe53935],[6,1,3,0xffcc80]);},'#ffc98a','#ffecd2'),
  flagraid:TB(q=>{for(let x=0;x<9;x++)for(let z=0;z<9;z++)q.push([x,-1,z,z<2?0xef9a9a:z>6?0x90caf9:0x6aa84f]);q.push([4,0,0,0xeeeeee],[4,1,0,0xeeeeee],[4,2,0,0xe53935],[5,2,0,0xe53935]);q.push([2,0,4,0x2e7d32],[3,0,4,0x2e7d32],[6,0,5,0x2e7d32]);q.push([3,0,2,0xc62828],[3,1,2,0xffcc80],[5,0,7,0x1e88e5],[5,1,7,0xf5cd30]);},'#8cc8ff','#e3f2ff'),
  megaobby:TB(q=>{for(let i=0;i<10;i++)q.push([i,Math.floor(i/2),4-(i%3),i===9?0xffc93c:parseInt(OBBY_COLS[i].slice(1),16)]);q.push([3,0,6,0xff3b30],[4,0,6,0xff3b30],[6,2,1,0x22d3ee]);},'#7fc6ff','#d6efff'),
  lavarise:TB(q=>{floor(q,8,0xff5a1f);for(let y=0;y<7;y++){q.push([3,y,3,0x4a3f63]);q.push([4,y,4,0x4a3f63]);}for(let i=0;i<10;i++){const a=i*.62;q.push([Math.round(3.5+3*Math.cos(a)),Math.floor(i*.7),Math.round(3.5+3*Math.sin(a)),STAGE_COLS[i%8]]);}q.push([4,7,4,0xffc93c]);},'#3a1d2e','#7a2a2a'),
  zombies:TB(q=>{floor(q,9,0x4f6b3a);q.push([1,0,1,0xa1887f],[1,1,1,0x5d4037],[6,0,2,0x90a4ae],[6,1,2,0x5d4037]);q.push([4,0,5,0x7cb342],[4,1,5,0x4e6b3a],[4,2,5,0x7cb342],[6,0,6,0x7cb342],[6,1,6,0x4e6b3a],[6,2,6,0x7cb342],[2,0,6,0xc0c7d4]);},'#55606e','#8a96a6'),
  rainbow:TB(q=>{[[0,0],[1,0],[2,1],[3,1],[4,2],[5,2],[6,3],[7,3],[8,4]].forEach(([i,y],k)=>q.push([i,y,4-(k%2),k===8?0xffc93c:OBBY_COLS[k].replace?parseInt(OBBY_COLS[k].slice(1),16):0x5c9dff]));q.push([3,0,6,0xff3b30],[4,0,6,0xff3b30]);},'#7fc6ff','#d6efff'),
  gems:TB(q=>{floor(q,9,0x58b947);q.push([2,0,2,0x4a9f3c],[2,1,2,0x3f8a33],[6,0,5,0x6d4c41],[6,1,5,0x2e7d32],[6,2,5,0x2e7d32],[4,0,6,0x2f8fd8]);q.push([1,0,6,'coin'],[5,0,2,'coin'],[2,2,2,'coin'],[7,0,7,'coin']);},'#8fd0ff','#e0f6ff'),
  turbo:TB(q=>{for(let i=0;i<9;i++){q.push([i,1,3,i===2||i===6?0xffd400:0x3b4252]);q.push([i,1,4,i===2||i===6?0xffd400:0x3b4252]);}q.push([8,1,5,0xffc93c],[4,2,3,0xff7b5c]);},'#5f9eff','#bcdcff'),
  sumo:TB(q=>{for(let x=0;x<9;x++)for(let z=0;z<9;z++){const d=Math.hypot(x-4,z-4);if(d<4.6)q.push([x,0,z,d>3.8?0xc62828:0xf5e6c8]);}q.push([3,1,3,0xef5350],[3,2,3,0xffcc80],[5,1,5,0xef5350],[5,2,5,0xffcc80],[5,1,3,0x1e88e5],[5,2,3,0xf5cd30]);},'#ffb57a','#ffe2c4'),
  colordrop:TB(q=>{const C=[0xef5350,0x42a5f5,0x66bb6a,0xffee58];for(let x=0;x<8;x++)for(let z=0;z<8;z++){const k=(x*3+z*5+((x*z)%3))%4;if(k===1||(x+z)%5)q.push([x,0,z,C[k]]);}q.push([3,1,3,0x1e88e5],[3,2,3,0xf5cd30]);},'#1d2340','#3a4374'),
  maze:TB(q=>{floor(q,9,0xa1887f);const M=['111111111','100010001','101010111','101000101','101111101','100001001','111101011','100000001','111111111'];M.forEach((r,z)=>[...r].forEach((ch,x)=>{if(ch==='1')q.push([x,0,z,0xe0e0e0]);}));q.push([7,0,7,0xffc93c]);},'#b9c7d9','#e8eef6'),
  targets:TB(q=>{floor(q,9,0x9ccc65);for(let x=0;x<9;x++)q.push([x,0,0,0x78909c],[x,1,0,0x78909c]);q.push([2,1,2,0xef5350],[5,2,2,0xffffff],[7,1,3,0xef5350],[4,0,7,0x6d4c41],[4,1,7,0x455a64]);},'#a8d4ff','#e6f3ff'),
  cloudhop:TB(q=>{[[0,0,4],[2,1,4],[4,2,3],[6,3,4],[8,4,4]].forEach(([x,y,z],i)=>{q.push([x,y,z,i===4?0xffc93c:0xffffff]);q.push([x,y,z+1,i===4?0xffc93c:0xffffff]);});q.push([5,4,3,0xd68cff]);},'#6fb2ff','#d8ecff'),
  freezetag:TB(q=>{floor(q,9,0xe3f2fd);q.push([2,0,2,0xbbdefb],[2,1,2,0xbbdefb],[6,0,6,0xbbdefb],[4,0,4,0xe53935],[4,1,4,0xf5cd30],[6,0,3,0x81d4fa],[6,1,3,0x81d4fa]);},'#bfe3ff','#effaff'),
  boss:TB(q=>{floor(q,9,0x3e3550);q.push([0,0,0,0x6a5a8a],[0,1,0,0x6a5a8a],[8,0,0,0x6a5a8a],[8,1,0,0x6a5a8a]);for(let y=0;y<3;y++){q.push([4,y,3,0x311b92]);q.push([5,y,3,0x311b92]);}for(let y=3;y<5;y++){q.push([4,y,3,0x6a1b9a]);q.push([5,y,3,0x6a1b9a]);}q.push([4,5,3,0xffcc80],[5,5,3,0xffcc80],[2,0,7,0xc0c7d4]);},'#2b1d3a','#4a3260')
};
const THUMBS={
  tower:c=>{const q=[];for(let x=0;x<8;x++)for(let z=0;z<8;z++)q.push([x,-1,z,0xff5a1f]);for(let y=0;y<7;y++){q.push([3,y,3,0x4a3f63]);q.push([4,y,3,0x4a3f63]);q.push([3,y,4,0x4a3f63]);q.push([4,y,4,0x4a3f63]);}
    for(let i=0;i<12;i++){const a=i*.55,x=Math.round(3.5+3*Math.cos(a)),z=Math.round(3.5+3*Math.sin(a));q.push([x,Math.floor(i*.55),z,STAGE_COLS[Math.floor(i/3)]]);}
    q.push([5,6,6,0xffc93c]);drawIso(c,q,'#2a1b3d','#5a2a3a');},
  coins:c=>{const q=[];for(let x=-1;x<9;x++)for(let z=-1;z<9;z++){const isl=(x>0&&x<5&&z>0&&z<5)||(x>5&&x<8&&z>2&&z<6);q.push([x,-1,z,isl?0x58b947:0x2f8fd8]);}
    q.push([2,0,2,0x4a9f3c]);q.push([3,0,2,0x4a9f3c]);q.push([2,0,3,0x4a9f3c]);q.push([2,1,2,0x3f8a33]);q.push([6,0,3,0x6d4c41]);q.push([6,1,3,0x2e7d32]);
    q.push([1,0,4,'coin']);q.push([4,0,1,'coin']);q.push([2,2,2,'coin']);q.push([7,0,5,'coin']);q.push([5,-.3,4,'coin']);drawIso(c,q,'#8fd0ff','#d8f1ff');},
  sky:c=>{const q=[];const path=[[0,2],[1,2],[2,2],[3,2],[5,2],[6,2],[7,3],[7,4],[7,5],[8,6]];path.forEach(([x,z],i)=>q.push([x,i>6?2:1,z,i===2?0xffd400:i===9?0xffc93c:0xc7d2ea]));
    q.push([1,-1,6,0xffffff]);q.push([2,-1,6,0xffffff]);q.push([5,-2,0,0xffffff]);q.push([6,-2,0,0xffffff]);q.push([6,-2,-1,0xffffff]);drawIso(c,q,'#5f9eff','#bcdcff');},
  sandbox:c=>{const q=[];for(let x=0;x<8;x++)for(let z=0;z<8;z++)q.push([x,-1,z,0x7d8e9b]);
    const cols=[0xe53935,0xfb8c00,0xfdd835,0x7cb342,0x1e88e5];for(let i=0;i<5;i++)for(let h=0;h<=i;h++)q.push([i+1,h,5,cols[i]]);
    q.push([2,0,2,0x5e35b1]);q.push([3,0,2,0x5e35b1]);q.push([2,1,2,0xd81b60]);drawIso(c,q,'#a7d8ff','#e6f4ff');},
  baseplate:c=>{const q=[];for(let x=0;x<8;x++)for(let z=0;z<8;z++)q.push([x,-1,z,0x7a8a98]);q.push([3,0,3,0xc7ccd6]);q.push([4,0,3,0xc7ccd6]);q.push([3,0,4,0xc7ccd6]);q.push([4,0,4,0xc7ccd6]);drawIso(c,q,'#9fd8ff','#e1f3ff');},
  arena:c=>{const q=[];for(let x=0;x<9;x++)for(let z=0;z<9;z++)q.push([x,-1,z,0x6f8a5a]);for(let i=0;i<9;i++){q.push([i,0,0,0x9fa8b8]);q.push([0,0,i,0x9fa8b8]);}
    q.push([2,0,2,0xe57373]);q.push([2,1,2,0xe57373]);q.push([6,0,6,0x64b5f6]);q.push([6,1,6,0x64b5f6]);q.push([4,0,4,0xcfd8dc]);q.push([5,0,3,0x8d6e63]);q.push([3,1,6,0xc0c7d4]);drawIso(c,q,'#8ec9ff','#dff1ff');},
  obby:c=>{const q=[];for(let x=0;x<9;x++)for(let z=0;z<9;z++)q.push([x,-1,z,(z>2&&z<7)?0xff4a1f:0x7a8a98]);[[1,0,0x5c9dff],[2,1,0x9b6bff],[3,1,0xff6bb5],[5,2,0x4fd1c5],[6,2,0x3ddc84],[8,3,0xffc93c]].forEach(([x,y,c2])=>q.push([x,y,4,c2]));drawIso(c,q,'#9fd8ff','#e1f3ff');}
};
const ago=ms=>{const s=(Date.now()-ms)/1000;if(s<60)return 'just now';if(s<3600)return Math.floor(s/60)+' min ago';if(s<86400)return Math.floor(s/3600)+' h ago';return Math.floor(s/86400)+' d ago';};
let delArm=null;
document.addEventListener('click',e=>{const k=e.target.closest('#gameChips [data-cont]');if(k){const gm=GAMES.find(g=>g.id===k.dataset.cont);if(gm)startGame(gm.make?gm.make():gm);return;}});
document.addEventListener('click',e=>{const c=e.target.closest('#gameChips [data-cat]');if(!c)return;GAME_CAT=c.dataset.cat;store.set('gameCat',GAME_CAT);renderCards();});
const NEW_GAMES=new Set(['lavarise','zombies','turbo','colordrop','murder','arena','arsenal','sandbox','boss','maze']);
function renderBadges(){const g=$('#badgeGrid');if(!g)return;const got=BADGES.filter(b=>WALLET.badges.has(b[0])).length;
  g.innerHTML=BADGES.map(([id,ic,nm,ds,fn,r])=>`<span class="bdg${WALLET.badges.has(id)?' got':''}" data-bdg="${id}" title="${esc(ds)} · ${r} coins"><span class="bi">${ic}</span><span class="bn">${esc(nm)}</span></span>`).join('');
  $('#badgeNote').textContent=got+' of '+BADGES.length+' earned · hover for how to get each one';}
document.addEventListener('click',e=>{const b=e.target.closest('[data-bdg]');if(!b)return;const d=BADGES.find(x=>x[0]===b.dataset.bdg);if(d)toast(d[1]+' '+d[2]+': '+d[3]+(WALLET.badges.has(d[0])?' ✓':' · '+d[5]+' coins'),'#ffd54f',2.5);});
function renderCards(){
  {const d=new Date(),m=d.getMonth()+1,dd=d.getDate();const on=(m===10&&dd>=15)||(m===11&&dd<=2);const eb=$('#eventBanner');if(eb)eb.hidden=!on;}
  renderQuests();renderBadges();
  const grid=$('#grid');grid.innerHTML='';const bests=store.get('bests',{});
  const chips=$('#gameChips');if(chips){const cats=['All',...new Set(GAMES.map(g=>g.cat))];chips.innerHTML=cats.map(c=>`<button type="button" class="chip" aria-pressed="${c===GAME_CAT}" data-cat="${c}">${c}${c==='All'?' ('+GAMES.length+')':''}</button>`).join('');
    const lg=GAMES.find(g=>g.id===store.get('lastGame',''));if(lg)chips.insertAdjacentHTML('afterbegin',`<button type="button" class="chip cont" data-cont="${lg.id}">▶ Play again: ${esc(lg.name)}</button>`);}
  const FEAT=featuredId();GAMES.filter(gm=>GAME_CAT==='All'||gm.cat===GAME_CAT).slice().sort((a,b)=>(b.id===FEAT)-(a.id===FEAT)).forEach(gm=>{const b=document.createElement('button');b.type='button';b.className='card'+(gm.id===FEAT?' feat':'');
    const bv=bests[gm.id];let best='';
    const lb=store.get('lbBest:'+gm.id,null);
    if(lb!=null&&gm.mode==='project'&&gm.cat!=='Obby')best=`Your best <b>${r3(lb)}</b>`;
    else if(gm.id==='arena')best='Online PvP';
    else if(gm.mode==='project')best=gm.cat==='Obby'?(bv!=null?`Best <b>${fmt(bv)}</b>`:'Not finished yet'):'Endless';
    else if(gm.mode==='race')best=bv!=null?`Best <b>${fmt(bv)}</b>`:'No time yet';
    else if(gm.mode==='coins')best=bv?`Best <b>${bv.coins}</b> coins`:'No score yet';
    else{const n=(store.get('build',null)||[]).length;best=n?`<b>${n}</b> blocks saved`:'Fresh baseplate';}
    const qi=questsToday().findIndex(q=>q.g===gm.id),qS=questState();
    b.innerHTML=`${gm.id===featuredId()?'<span class="featb">⭐ 2× COINS TODAY</span>':NEW_GAMES.has(gm.id)?'<span class="newb">UPDATED</span>':''}${qi>=0&&!qS.c[qi]?'<span class="qdot">QUEST</span>':''}<canvas aria-hidden="true"></canvas><div class="body"><span class="tag">${gm.tag}</span><h3>${gm.name}</h3><p>${gm.desc}</p><div class="meta"><span class="best">${best}</span><span class="playpill">Play</span></div></div>`;
    (THUMBS[gm.id]||THUMBS_MORE[gm.id]||THUMBS.baseplate)(b.querySelector('canvas'));
    b.dataset.room=gm.id;b.onclick=()=>startGame(gm.make?gm.make():gm);grid.appendChild(b);});
  updateCardCounts();
  const my=$('#mygrid');my.innerHTML='';
  const canMake=!!ACC.doc;const sub=$('#mySec .sechead p');
  if(sub)sub.textContent=canMake?'Made in Brickyard Studio by @'+ACC.doc.username+' and saved in this browser.':accountsAvailable()||hasClaude()?'Create a free Brickyard account to make and publish games.':'Making games needs a Brickyard account, available in Brickyard inside Claude.';
  if(!canMake){const c=document.createElement('div');c.className='card signcard';
    c.innerHTML=`<div class="body"><span class="tag">Brickyard account</span><h3>${(hasClaude()||SB.client)?'Create an account to start building':'Play games here'}</h3><p>${(hasClaude()||SB.client)?'Build games in Brickyard Studio with block code, then publish them for everyone. '+(SB.client?'Sign up free with your email.':'Your account uses your Claude sign-in.'):'This copy of Brickyard plays games and shared links. To build and publish your own, use the Brickyard website.'}</p>${(hasClaude()||SB.client)?`<div class="meta"><span></span><button class="mini pri" type="button">${SB.client&&SB.uid?'Pick a username':SB.client?'Sign up or sign in':'Create account'}</button></div>`:''}</div>`;
    const bb=c.querySelector('button');if(bb)bb.onclick=()=>showAccountModal(null);my.appendChild(c);}
  if(canMake)[['baseplate','Baseplate','An empty studded baseplate and a spawn point. Build anything.'],['obby','Obby starter','A short obby with a moving platform, a spinner, coins and block scripts to learn from.']].forEach(([tpl,name,desc])=>{
    const b=document.createElement('button');b.type='button';b.className='card newcard';
    b.innerHTML=`<canvas aria-hidden="true"></canvas><div class="body"><span class="tag">New in Studio</span><h3>${name}</h3><p>${desc}</p><div class="meta"><span class="best">Template</span><span class="playpill">Create</span></div></div>`;
    THUMBS[tpl](b.querySelector('canvas'));b.onclick=()=>requireAccount(()=>{const p=newProjectObj(tpl);saveProject(p);openStudio(p);});my.appendChild(b);});
  if(accountsAvailable()||!MP.p2p||listProjects().length)listProjects().forEach(p=>{const d=document.createElement('div');d.className='card';
    const bv=bests['proj:'+p.id];const parts=p.nodes.filter(n=>n.cls==='Part'||n.cls==='Rig').length,scripts=p.nodes.filter(n=>n.cls==='Script').length;
    d.innerHTML=`${p.thumb?`<img class="thumb" alt="" src="${p.thumb}">`:'<canvas aria-hidden="true"></canvas>'}<div class="body"><span class="tag">Edited ${ago(p.updated)}</span><h3>${esc(p.name)}</h3>
      <p>${parts} parts · ${scripts} script${scripts===1?'':'s'}${bv!=null?' · best '+fmt(bv):''}</p>
      <div class="meta"><div class="acts"><button class="mini pri" type="button" data-pp="play">Play</button><button class="mini" type="button" data-pp="edit">Edit</button></div>
      <button class="mini danger" type="button" data-pp="del">${delArm===p.id?'Tap again to delete':'Delete'}</button></div></div>`;
    if(!p.thumb)THUMBS.baseplate(d.querySelector('canvas'));
    d.addEventListener('click',e=>{const b=e.target.closest('[data-pp]');if(!b)return;const a=b.dataset.pp;
      if(a==='play')ensureMeshes(p).then(()=>startGame(projectDef(p,false)));else if(a==='edit')requireAccount(()=>openStudio(p));
      else if(a==='del'){if(delArm===p.id){deleteProject(p.id);delArm=null;}else{delArm=p.id;setTimeout(()=>{if(delArm===p.id){delArm=null;renderCards();}},3500);}renderCards();}});
    my.appendChild(d);});
}
function updateCardCounts(){
  document.querySelectorAll('[data-room]').forEach(el=>{const n=MP.counts[el.dataset.room]||0;let tag=el.querySelector('.live');
    if(!n){if(tag)tag.remove();return;}if(!tag){tag=document.createElement('span');tag.className='live';const meta=el.querySelector('.meta');if(meta)meta.prepend(tag);}tag.textContent=n+' playing';});
}
/* ---- community games (db) ---- */
async function sbRefreshCommunity(){
  if(!SB.client)return;
  try{const {data,error}=await SB.client.from('games').select('owner,id,name,thumb,parts,scripts,updated_at,profiles(username)').order('updated_at',{ascending:false}).limit(120);if(error)throw error;
    MP.comm=(data||[]).filter(g=>g&&/^[a-z0-9]{2,20}$/.test(g.id||'')).map(g=>{if(g.profiles&&g.profiles.username)ACC.names[g.owner]=g.profiles.username;
      return {owner:g.owner,id:g.id,name:String(g.name||'Untitled').slice(0,60),updated:Date.parse(g.updated_at)||0,thumb:typeof g.thumb==='string'&&g.thumb.startsWith('data:image/jpeg;base64,')?g.thumb:'',parts:num(g.parts,0),scripts:num(g.scripts,0)};});
    renderCommunity();}catch(e){}
}
function subscribeCommunity(){
  if(MP.commUnsub||!MP.db)return;
  MP.commUnsub=MP.db.collection('index').onSnapshot(snap=>{const out=[];
    for(const d of snap.docs){const body=d.data()||{};const list=Array.isArray(body.games)?body.games:[];
      for(const g of list){if(!g||typeof g.id!=='string'||!/^[a-z0-9]{2,20}$/.test(g.id))continue;out.push({owner:d.id,id:g.id,name:String(g.name||'Untitled').slice(0,60),updated:num(g.updated,0),
        thumb:typeof g.thumb==='string'&&g.thumb.startsWith('data:image/jpeg;base64,')?g.thumb:'',parts:num(g.parts,0),scripts:num(g.scripts,0)});}}
    out.sort((a,b)=>b.updated-a.updated);MP.comm=out;resolveNames(out.map(g=>g.owner));renderCommunity();
  },()=>{});
}
let commDelArm=null;
function renderCommunity(){
  const sec=$('#commSec'),grid=$('#commgrid');if(!sec)return;sec.hidden=!MP.comm.length;grid.innerHTML='';
  for(const g of MP.comm){const d=document.createElement('div');d.className='card';d.dataset.room='p-'+g.id;const mine=myUid()&&g.owner===myUid();if(!ACC.names[g.owner]&&!ACC.miss[g.owner])resolveNames([g.owner]);
    d.innerHTML=`${g.thumb?'<img class="thumb" alt="">':'<canvas aria-hidden="true"></canvas>'}<div class="body"><span class="tag"></span><h3></h3><p></p>
      <div class="meta"><div class="acts"><button class="mini pri" type="button" data-cg="play">Play</button><button class="mini" type="button" data-cg="copy">Copy to my games</button></div>
      ${mine?`<button class="mini danger" type="button" data-cg="unpub">${commDelArm===g.id?'Tap again':'Unpublish'}</button>`:''}</div></div>`;
    if(g.thumb)d.querySelector('img').src=g.thumb;else THUMBS.baseplate(d.querySelector('canvas'));
    d.querySelector('.tag').textContent='By '+(mine?'you':'@'+nameOf(g.owner))+' · '+ago(g.updated);d.querySelector('h3').textContent=g.name;
    d.querySelector('p').textContent=g.parts+' parts · '+g.scripts+' script'+(g.scripts===1?'':'s');
    d.addEventListener('click',e=>{const b=e.target.closest('[data-cg]');if(!b)return;const a=b.dataset.cg;
      if(a==='unpub'){if(commDelArm!==g.id){commDelArm=g.id;renderCommunity();setTimeout(()=>{if(commDelArm===g.id){commDelArm=null;renderCommunity();}},3000);return;}commDelArm=null;unpublishGame(g.id);return;}
      b.disabled=true;b.textContent='Loading…';
      fetchCommunity(g).then(proj=>{if(!proj){b.textContent='Could not load';return;}
        if(a==='play')ensureMeshes(proj).then(()=>startGame(projectDef(proj,false)));
        else requireAccount(()=>{proj.id=uid();proj.name=proj.name+' (copy)';proj.updated=Date.now();saveProject(proj);renderCards();openStudio(proj);});}).catch(()=>{b.textContent='Could not load';});});
    grid.appendChild(d);}
  updateCardCounts();
}
async function fetchCommunity(g){
  let d;
  if(SB.client){const {data,error}=await SB.client.from('games').select('json,meshes').eq('owner',g.owner).eq('id',g.id).maybeSingle();if(error||!data)return null;d=data;}
  else{const snap=await MP.db.doc('games/'+g.owner+'/list/'+g.id).get();if(!snap.exists)return null;d=snap.data();}
  const proj=JSON.parse(String(d.json||'null'));if(!proj||!Array.isArray(proj.nodes))return null;
  proj.id=g.id;proj.settings=Object.assign(defaultSettings(),proj.settings||{});
  const refs=d.meshes&&typeof d.meshes==='object'?d.meshes:{};
  const sbPath=/^[0-9a-f-]{36}\/n[a-z0-9]{3,12}\.json$/;
  await Promise.all(Object.entries(refs).map(async([mid,aid])=>{if(MESHCACHE.has(mid)||typeof aid!=='string'||!(SB.client?sbPath.test(aid):/^[A-Za-z0-9_-]{4,80}$/.test(aid)))return;
    try{const cached=await IDB.get(mid).catch(()=>null);if(cached){cacheAsset(cached);return;}
      const r=await fetch(SB.client?SB.url+'/storage/v1/object/public/meshes/'+aid:'/_blob/'+aid);if(!r.ok)return;const a=meshFromJSON(await r.json());if(a&&a.id===mid){cacheAsset(a);IDB.put(a).catch(()=>{});}}catch(e){}}));
  return proj;
}
async function publishGame(){
  const btn=$('#stPublish');
  if(!ACC.doc)return requireAccount(publishGame);
  if(SB.client)return sbPublishGame();
  if(!MP.db||!MP.me.id){logOut(MP.db?'Sign in to Claude to publish games.':'Publishing needs this page to be opened in Claude with shared data available.','warn');return;}
  saveWs();saveNow(true);
  const proj=JSON.parse(JSON.stringify(ED.proj));delete proj.thumb;
  const json=JSON.stringify(proj);
  if(json.length>240000){logOut('This game is too big to publish ('+Math.round(json.length/1024)+' KB of 235 KB). Remove some parts or scripts.','err');return;}
  let thumb='';try{if(ED.proj.thumb){const im=new Image();im.src=ED.proj.thumb;await im.decode();const c=document.createElement('canvas');c.width=192;c.height=108;c.getContext('2d').drawImage(im,0,0,192,108);thumb=c.toDataURL('image/jpeg',.6);}}catch(e){}
  btn.disabled=true;btn.textContent='Publishing…';
  const meshRefs={};const ids=usedMeshIds(proj);let meshFail=0;
  if(ids.length){await ensureMeshes(proj);const assets=hasClaude()?await claude.use('assets').catch(()=>null):null;const known=store.get('meshAssets',{})||{};
    for(const id of ids){if(known[id]){meshRefs[id]=known[id];continue;}const j=meshToJSON(id);if(!j||!assets){meshFail++;continue;}
      try{const r=await assets.upload(new Blob([JSON.stringify(j)],{type:'application/json'}));meshRefs[id]=r.id;known[id]=r.id;store.set('meshAssets',known);}catch(e){meshFail++;}}}
  try{
    await MP.db.doc('games/'+MP.me.id+'/list/'+proj.id).set({json,name:proj.name,updated:Date.now(),meshes:meshRefs});
    const ref=MP.db.doc('index/'+MP.me.id);const cur=await ref.get();const list=(cur.exists&&Array.isArray(cur.data().games)?cur.data().games:[]).filter(g=>g&&g.id!==proj.id).map(g=>Object.assign({},g));
    list.unshift({id:proj.id,name:proj.name.slice(0,60),updated:Date.now(),thumb,parts:proj.nodes.filter(n=>n.cls==='Part'||n.cls==='Rig').length,scripts:proj.nodes.filter(n=>n.cls==='Script').length});
    while(JSON.stringify({games:list}).length>230000)list.pop();
    await ref.set({games:list});
    const meshes=proj.nodes.filter(n=>n.shape==='mesh').length;
    logOut('Published '+proj.name+' to Community games. Everyone with this page can play it'+(meshFail?'. '+meshFail+' mesh'+(meshFail>1?'es':'')+' could not be uploaded, so other players see '+(meshFail>1?'them':'it')+' as blocks.':meshes?', meshes included.':'.'),'sys');
  }catch(e){logOut(e&&e.code==='quota_exceeded'?'Publishing failed because the shared space is full.':'You do not have permission to publish games on this page. Ask its owner to make you a Contributor.','err');}
  btn.disabled=false;btn.textContent='Publish';
}
async function sbPublishGame(){
  const btn=$('#stPublish');
  if(!SB.uid||!ACC.doc)return requireAccount(sbPublishGame);
  saveWs();saveNow(true);
  const proj=JSON.parse(JSON.stringify(ED.proj));delete proj.thumb;const json=JSON.stringify(proj);
  if(json.length>240000){logOut('This game is too big to publish ('+Math.round(json.length/1024)+' KB of 235 KB). Remove some parts or scripts.','err');return;}
  let thumb='';try{if(ED.proj.thumb){const im=new Image();im.src=ED.proj.thumb;await im.decode();const c=document.createElement('canvas');c.width=192;c.height=108;c.getContext('2d').drawImage(im,0,0,192,108);thumb=c.toDataURL('image/jpeg',.6);}}catch(e){}
  btn.disabled=true;btn.textContent='Publishing…';
  const meshRefs={};const ids=usedMeshIds(proj);let meshFail=0;const up=store.get('sbMeshUp',{})||{};
  if(ids.length){await ensureMeshes(proj);
    for(const id of ids){const path=SB.uid+'/'+id+'.json';if(up[path]){meshRefs[id]=path;continue;}const j=meshToJSON(id);if(!j){meshFail++;continue;}
      try{const {error}=await SB.client.storage.from('meshes').upload(path,new Blob([JSON.stringify(j)],{type:'application/json'}),{upsert:true,contentType:'application/json'});if(error)throw error;meshRefs[id]=path;up[path]=1;store.set('sbMeshUp',up);}catch(e){meshFail++;}}}
  try{
    const {error}=await SB.client.from('games').upsert({owner:SB.uid,id:proj.id,name:proj.name.slice(0,60)||'Untitled',json,thumb,parts:proj.nodes.filter(n=>n.cls==='Part'||n.cls==='Rig').length,
      scripts:proj.nodes.filter(n=>n.cls==='Script').length,meshes:meshRefs,updated_at:new Date().toISOString()},{onConflict:'owner,id'});if(error)throw error;
    const meshes=proj.nodes.filter(n=>n.shape==='mesh').length;
    logOut('Published '+proj.name+' to Community games on the Brickyard website'+(meshFail?'. '+meshFail+' mesh'+(meshFail>1?'es':'')+' could not be uploaded, so other players see '+(meshFail>1?'them':'it')+' as blocks.':meshes?', meshes included.':'.'),'sys');
    sbRefreshCommunity();
  }catch(e){logOut('Publishing failed: '+sbErr(e),'err');}
  btn.disabled=false;btn.textContent='Publish';
}
async function unpublishGame(id){
  if(SB.client){if(!SB.uid)return;try{await SB.client.from('games').delete().eq('owner',SB.uid).eq('id',id);}catch(e){}sbRefreshCommunity();return;}
  if(!MP.db||!MP.me.id)return;
  try{const ref=MP.db.doc('index/'+MP.me.id);const cur=await ref.get();const list=(cur.exists&&Array.isArray(cur.data().games)?cur.data().games:[]).filter(g=>g&&g.id!==id).map(g=>Object.assign({},g));
    await ref.set({games:list});await MP.db.doc('games/'+MP.me.id+'/list/'+id).delete();}catch(e){}
}
const b64e=u8=>{let bin='';for(let i=0;i<u8.length;i+=0x8000)bin+=String.fromCharCode.apply(null,u8.subarray(i,i+0x8000));return btoa(bin);};
const b64d=s=>{const bin=atob(s);const u=new Uint8Array(bin.length);for(let i=0;i<bin.length;i++)u[i]=bin.charCodeAt(i);return u;};
function meshToJSON(id){const g=MESHCACHE.get(id),info=MESHINFO.get(id);if(!g||!info)return null;
  const pos=g.attributes.position.array,nrm=g.attributes.normal.array,col=g.attributes.color?g.attributes.color.array:null;
  return {v:1,id,name:info.name,tris:info.tris,ext:info.ext,pos:b64e(new Uint8Array(pos.buffer,pos.byteOffset,pos.byteLength)),nrm:b64e(new Uint8Array(nrm.buffer,nrm.byteOffset,nrm.byteLength)),col:col?b64e(new Uint8Array(col.buffer,col.byteOffset,col.byteLength)):null};}
function meshFromJSON(j){
  if(!j||j.v!==1||typeof j.id!=='string'||!/^n[a-z0-9]{3,12}$/.test(j.id)||typeof j.pos!=='string'||typeof j.nrm!=='string')return null;
  const pu=b64d(j.pos),nu=b64d(j.nrm);if(pu.length%36!==0||nu.length*4!==pu.length)return null;
  const pos=new Float32Array(pu.buffer.slice(0)),nrm=new Int8Array(nu.buffer.slice(0));if(pos.length>150000*9)return null;
  let col=null;if(typeof j.col==='string'){const cu=b64d(j.col);if(cu.length===nu.length)col=new Uint8Array(cu.buffer.slice(0));}
  const ext=Array.isArray(j.ext)&&j.ext.length===3?j.ext.map(v=>Math.max(1e-3,num(v,1))):[1,1,1];
  return {id:j.id,name:String(j.name||'mesh').slice(0,80),tris:pos.length/9,pos,nrm,col,ext,created:Date.now()};
}
function usedMeshIds(proj){return [...new Set(proj.nodes.filter(n=>n.shape==='mesh'&&n.meshId).map(n=>n.meshId))];}
function saveMeshesToIDB(list){(list||[]).forEach(a=>{IDB.put(a).catch(()=>{});});}
async function packProject(proj){
  const p=JSON.parse(JSON.stringify(proj));delete p.thumb;
  await ensureMeshes(proj);const ms=usedMeshIds(proj).map(meshToJSON).filter(Boolean);if(ms.length)p._meshes=ms;
  const bytes=new TextEncoder().encode(JSON.stringify(p));
  const cs=new Blob([bytes]).stream().pipeThrough(new CompressionStream('deflate-raw'));const buf=new Uint8Array(await new Response(cs).arrayBuffer());
  let bin='';for(let i=0;i<buf.length;i+=0x8000)bin+=String.fromCharCode.apply(null,buf.subarray(i,i+0x8000));
  return btoa(bin).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
}
async function unpackProject(code){
  const bin=atob(code.replace(/-/g,'+').replace(/_/g,'/'));const u=Uint8Array.from(bin,c=>c.charCodeAt(0));
  const ds=new Blob([u]).stream().pipeThrough(new DecompressionStream('deflate-raw'));const txt=await new Response(ds).text();
  const p=JSON.parse(txt);if(!p||!Array.isArray(p.nodes))throw new Error('bad');
  p.nodes=p.nodes.filter(n=>n&&typeof n==='object'&&typeof n.id==='string'&&typeof n.cls==='string');
  p.settings=Object.assign(defaultSettings(),p.settings||{});p.name=String(p.name||'Shared game').slice(0,60);
  const ms=Array.isArray(p._meshes)?p._meshes.map(meshFromJSON).filter(Boolean):[];delete p._meshes;ms.forEach(a=>cacheAsset(a));p.__meshes=ms;
  return p;
}
function fnv(str){let h=0x811c9dc5;for(let i=0;i<str.length;i++){h^=str.charCodeAt(i);h=Math.imul(h,16777619);}return (h>>>0).toString(36);}
function standaloneHtml(name,code){
  const sc='<'+'script';const ec='<'+'/script>';
  return '<!doctype html>\n<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">\n'+
    '<title>'+esc(name)+'</title>\n<meta name="description" content="'+esc(name)+', a game made with Brickyard">\n</head><body>\n'+
    sc+'>window.BY_EMBED='+JSON.stringify({code,name}).replace(/</g,'\\u003c')+';'+ec+'\n'+sc+' src="'+SITE_URL+'boot.js">'+ec+'\n</body></html>\n';
}
async function saveTextFile(filename,text,type){
  if(hasClaude()){try{const d=await claude.use('downloads');if(!d)return false;await d.save({filename,data:new Blob([text],{type})});return true;}catch(e){return false;}}
  try{const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([text],{type}));a.download=filename;document.body.appendChild(a);a.click();setTimeout(()=>{URL.revokeObjectURL(a.href);a.remove();},2000);return true;}catch(e){return false;}
}
async function showPublish(){
  if(!ACC.doc)return requireAccount(showPublish);
  saveWs();saveNow(true);
  const proj=ED.proj;let code='';try{code=await packProject(proj);}catch(e){}
  const link=code?SITE_URL+'#g='+code:'';const meshes=proj.nodes.filter(n=>n.shape==='mesh').length;
  const comm=(SB.client&&SB.uid)||(!MP.p2p&&MP.db&&MP.me.id);
  showModal(`<h2>Publish ${esc(proj.name)}</h2>
    <div class="pubopt"><h3>Share a link</h3><p>Anyone who opens this link plays your game on the Brickyard website, and everyone with the same link can play together online. The whole game is stored inside the link, so sharing it again after changes makes a new link.</p>
      ${link?`<textarea readonly id="pubLink" aria-label="Share link">${esc(link)}</textarea><div class="row"><button class="btn" type="button" data-m="copy" data-t="pubLink">Copy link</button><a class="btn ghost" href="${esc(link)}" target="_blank" rel="noopener">Open it</a></div>`:'<p class="err">This browser could not make a link.</p>'}
      <p class="fine">${usedMeshIds(proj).length?'Your meshes are packed into the link. ':''}${link.length>60000?'This link is long ('+Math.round(link.length/1000)+'k characters), so some chat apps may cut it off. The website file below always works.':Math.round(link.length/100)/10+'k characters.'}</p></div>
    <div class="pubopt"><h3>Download as a website</h3><p>Saves <b>${esc(fileName(proj.name))}.html</b>, a web page that runs your game. Upload it to GitHub Pages, itch.io (as an HTML game), Netlify Drop or any web host. It loads the Brickyard engine from ${esc(SITE_URL.replace('https://',''))}.</p>
      <div class="row"><button class="btn" type="button" id="pubDl"${code?'':' disabled'}>Download website</button></div><p class="fine" id="pubDlMsg"></p></div>
    ${comm?`<div class="pubopt"><h3>Community games</h3><p>${SB.client?'Lists the game in Community games on the Brickyard website, for everyone to play.':'Lists the game in Community games on this Claude page, for everyone who can open it.'}</p><div class="row"><button class="btn" type="button" id="pubComm">Publish to Community</button></div></div>`:''}
    <div class="row"><button class="btn ghost" type="button" data-m="close">Close</button></div>`);
  const dl=$('#pubDl');if(dl)dl.onclick=async()=>{const ok=await saveTextFile(fileName(proj.name)+'.html',standaloneHtml(proj.name,code),'text/html');$('#pubDlMsg').textContent=ok?'Saved. Upload the file to any web host to publish it.':'The download did not start. Copy the share link instead.';};
  const pc=$('#pubComm');if(pc)pc.onclick=()=>{$('#emodal').hidden=true;publishGame();};
}
const fileName=n=>(String(n).replace(/[^\w\- ]+/g,'').trim().replace(/\s+/g,'-')||'my-game').slice(0,50);
$('#stPublish').addEventListener('click',showPublish);
let SHARED=null;
function bootPlayLink(){const m=location.hash.match(/^#play=([a-z0-9]+)/);if(!m)return;const gm=GAMES.find(g=>g.id===m[1]);if(!gm)return;
  history.replaceState(null,'',location.pathname+location.search);setTimeout(()=>{try{if(!running)startGame(gm.make?gm.make():gm);}catch(e){}},600);}
function inviteLink(){return SITE_URL+'#play='+encodeURIComponent(game&&game.id||'');}
async function copyInvite(){const url=inviteLink();try{await navigator.clipboard.writeText(url);toast('📨 Invite link copied! Send it to a friend to play together.','#9fe3ff',3);}catch(e){toast('Invite link: '+url,'#9fe3ff',6);}}
async function bootShared(){
  let code=null;const embed=window.BY_EMBED&&typeof window.BY_EMBED.code==='string';
  if(embed)code=window.BY_EMBED.code;else if(location.hash.startsWith('#g='))code=location.hash.slice(3);
  if(!code)return;
  const sec=$('#sharedSec');sec.hidden=false;
  try{const proj=await unpackProject(code);proj.saveId=proj.saveId||('s-'+String(proj.id||fnv(code)));proj.id='s'+fnv(code);const meshes=proj.__meshes||[];delete proj.__meshes;SHARED={proj,code,embed,meshes};}
  catch(e){$('#sharedTitle').textContent='This game link is broken';$('#sharedNote').textContent='Part of the link may be missing. Ask for the link again.';return;}
  if(embed){document.title=SHARED.proj.name;['mySec','commSec','drop'].forEach(id=>{const el=$('#'+id);if(el)(el.closest('.sec')||el).hidden=true;});
    const g=$('#grid');if(g)g.closest('.sec').hidden=true;$('#sharedTitle').textContent=SHARED.proj.name;$('#sharedNote').innerHTML='Made with <a href="'+SITE_URL+'" target="_blank" rel="noopener">Brickyard</a>.';$('.lede').hidden=true;}
  renderShared();
}
function renderShared(){
  if(!SHARED)return;const g=$('#sharedgrid');g.innerHTML='';const p=SHARED.proj;const d=document.createElement('div');d.className='card';d.dataset.room='h-'+fnv(SHARED.code);
  d.innerHTML=`<canvas aria-hidden="true"></canvas><div class="body"><span class="tag">${SHARED.embed?'Play now':'Shared game'}</span><h3></h3><p></p>
    <div class="meta"><div class="acts"><button class="mini pri" type="button" data-sh="play">Play</button><button class="mini" type="button" data-sh="copy">Open in Studio</button></div></div></div>`;
  d.querySelector('h3').textContent=p.name;const parts=p.nodes.filter(n=>n.cls==='Part'||n.cls==='Rig').length,sc=p.nodes.filter(n=>n.cls==='Script').length;
  d.querySelector('p').textContent=parts+' parts · '+sc+' script'+(sc===1?'':'s');THUMBS[p.nodes.some(n=>n.behavior==='kill')?'obby':'baseplate'](d.querySelector('canvas'));
  d.addEventListener('click',e=>{const b=e.target.closest('[data-sh]');if(!b)return;
    if(b.dataset.sh==='play'){(SHARED.meshes||[]).forEach(a=>cacheAsset(a));const proj=JSON.parse(JSON.stringify(SHARED.proj));proj.id=SHARED.proj.id;const def=projectDef(proj,false);def.room='h-'+fnv(SHARED.code);startGame(def);}
    else requireAccount(()=>{const proj=JSON.parse(JSON.stringify(SHARED.proj));proj.id=uid();proj.updated=Date.now();saveMeshesToIDB(SHARED.meshes);saveProject(proj);renderCards();openStudio(proj);});});
  g.appendChild(d);updateCardCounts();
}
function renderSwatches(){const w=$('#swatches');if(!w){renderCoins();return;}w.innerHTML='';SHIRTS.forEach(c=>{const b=document.createElement('button');b.type='button';b.className='sw';b.style.background=c;
  b.setAttribute('aria-label','Shirt '+c);b.setAttribute('aria-pressed',c===shirt);b.onclick=()=>{shirt=c;store.set('shirt',c);renderSwatches();};w.appendChild(b);});}
renderToolbox();renderSwatches();renderCards();
loop();
if(TESTCLIENT){muted=true;MP.me={name:'Player 2',id:null};document.documentElement.classList.add('testclient');$('#menu').hidden=true;
  window.parent.postMessage({by2:1,k:'ready'},'*');}
else{initMP();bootShared();bootPlayLink();}
window.__by={toast,MUSIC,musicStart,musicTick,setActx:a=>{actx=a;},JU,juiceKO,juiceRigHit,damageRig,makeRag,ragStep,SB,SAVE,findAnim,playAnim,BD,openAnim,AE,ACC,renderGuiEditor,showAccountModal,MP,arenaDef,packProject,unpackProject,standaloneHtml,get SHARED(){return SHARED},IDB,MESHCACHE,uploadMesh,finalizeMesh,get ecam(){return ecam},get tc(){return tc},cam,ED,W,RT,P,state:()=>state,startGame,openStudio,newProjectObj,saveProject,insert,select,doAct,openScript,playtest,stopGame,exportRbxlx,luaForScript,parseRbxlx,listProjects,GAMES,projectDef,running:()=>running,_t:{WALLET,earnCoins,LOBBY,lobbySkip,breakAt,OUT,equipTool,activateTool,AIM,aimRay,physics,keys,PH,PHYS,setPaused:v=>{paused=v;},handleTouch,get t(){return t}}};
})();
