(function(){
const $=s=>document.querySelector(s);
if(!window.THREE){ $('#importErr').hidden=false; $('#importErr').textContent='The 3D library could not load. Check your connection and reload the page.'; return; }
const V3=THREE.Vector3, D2R=Math.PI/180;
const store={get(k,d){try{const v=localStorage.getItem('by:'+k);return v==null?d:JSON.parse(v)}catch(e){return d}},set(k,v){try{localStorage.setItem('by:'+k,JSON.stringify(v));return true}catch(e){return false}},del(k){try{localStorage.removeItem('by:'+k)}catch(e){}}};
const coarse=matchMedia('(pointer:coarse)').matches;
if(coarse) document.documentElement.classList.add('coarse');
const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const uid=()=>'n'+Math.random().toString(36).slice(2,10);
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
  explode:()=>beep(200,40,.5,'sawtooth',.07)
};

/* ---------- helpers ---------- */
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
  if(n.showName!==false&&n.name){const tag=textSprite(n.name);tag.position.set(0,3.5,0);g.add(tag);}
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
function newScene(o){o=o||{};
  W.anims=new Map();W.baseAnims=null;W.emotes=[];P.anim=null;Object.assign(P,{frozen:false,hidden:false,shieldUntil:0,airJumps:0,airLeft:0,shirtOverride:null,airT:0,sayText:''});$('#emoteMenu').hidden=true;
  const gl=$('#guiLayer');if(gl)gl.innerHTML='';W.gui=new Map();W.guiByName=new Map();
  if(scene)disposeScene();
  scene=new THREE.Scene();
  const sky=new THREE.Color(o.sky!=null?o.sky:0x9fd8ff);
  scene.background=sky; scene.fog=new THREE.Fog(sky.clone(),o.fogNear||160,o.fogFar||760);
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
  if(!r||!r.rig||r.dead||r.destroyed||!(n>0))return;r.health=Math.max(0,r.health-n);r.flashT=.12;
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
    if(r.hpSprite)r.hpSprite.visible=false;(r.diedHandlers||[]).forEach(h=>spawnRun(h.body,h));
    if(r.respawn>0)r.respawnAt=t+Math.max(r.respawn,1);else r.ragDestroyAt=t+4;return;}
  _rigDieBreak(r);}
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
    if(r.flashT>0){r.flashT-=dt;if(r.flashT<=0)r.mesh.traverse(o=>{if(o.isMesh&&o.userData.orig){o.material=o.userData.orig;o.userData.orig=null;}});}
    if(r.rag&&!r.dead){ragStep(r.rag,dt);if(t>=r.rag.until&&(r.rag.rest>.25||t>r.rag.until+2))ragEndRig(r);continue;}
    if(r.dead){if(r.rag)ragStep(r.rag,dt);if(r.ragDestroyAt&&t>=r.ragDestroyAt){r.ragDestroyAt=0;destroyPart(r);continue;}
      if(r.respawnAt&&t>=r.respawnAt){if(r.rag){r.rag=null;r.mesh.quaternion.identity();r.mesh.rotation.set(0,r.yaw,0);const u=r.mesh.userData.rig;['lArm','rArm','lLeg','rLeg','head'].forEach(k=>u[k].rotation.set(0,0,0));}
        r.dead=false;r.respawnAt=0;r.health=r.maxHealth;r.mesh.visible=true;r.active=true;setPartPos(r,r.home.clone());rigHpSprite(r);}continue;}
    if(r.walk){const w=r.walk,tg=w.target();
      if(!tg||t>w.until){r.walk=null;w.done();}
      else{const d=new V3(tg.x-r.pos.x,0,tg.z-r.pos.z),dist=d.length();
        if(dist<=w.stop){r.walk=null;w.done();}
        else{d.multiplyScalar(Math.min(dist-w.stop*.5,r.speed*dt)/dist);const np=r.pos.clone().add(d);
          const s=r.node.scale||1,gy=groundAt(np.x,np.z,r.pos.y-2.5*s+1.3,r);if(isFinite(gy))np.y=gy+2.5*s;
          setPartPos(r,np);r.yaw=Math.atan2(d.x,d.z);r.mesh.rotation.y=r.yaw;moving=true;}}}
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

/* ---------- avatar ---------- */
function makeAvatar(shirtColor){
  const g=new THREE.Group();const body=new THREE.Group();g.add(body);
  const skin=mat(0xf5cd30),sh=mat(/^#[0-9a-f]{6}$/i.test(shirtColor||'')?shirtColor:shirt),pants=mat(0x2b3a7a);
  const bx=(w,h,d,m,x,y,z,parent)=>{const me=new THREE.Mesh(BOX,m);me.scale.set(w,h,d);me.position.set(x,y,z);me.castShadow=true;(parent||body).add(me);return me;};
  bx(2,2,1,sh,0,.5,0);
  const head=new THREE.Mesh(BOX,[skin,skin,skin,skin,faceMat,skin]);head.scale.set(1.25,1.25,1.25);head.position.set(0,2.1,0);head.castShadow=true;body.add(head);
  const pv=(x,y)=>{const p=new THREE.Group();p.position.set(x,y,0);body.add(p);return p;};
  const lArm=pv(-1.5,1.4),rArm=pv(1.5,1.4),lLeg=pv(-.5,-.5),rLeg=pv(.5,-.5);
  bx(1,2,1,skin,0,-.9,0,lArm);bx(1,2,1,skin,0,-.9,0,rArm);bx(1,2,1,pants,0,-1,0,lLeg);bx(1,2,1,pants,0,-1,0,rLeg);
  g.userData={lArm,rArm,lLeg,rLeg,head,body};
  return g;
}

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
  const was=P.onGround;P.onGround=false;P.ground=null;
  moveAxis(0,P.vel.x*dt,was);moveAxis(2,P.vel.z*dt,was);moveAxis(1,P.vel.y*dt,false);
  if(W.obbs.length)resolveOBB();
  if(P.onGround){if(!was&&P.airT>.25&&RT.land&&RT.land.length)rtFire('land');P.airT=0;}else P.airT=(P.airT||0)+dt;
}
function respawn(){
  P.debris.forEach(d=>scene.remove(d.m));P.debris=[];P.rag=null;
  if(P.model)scene.remove(P.model);
  P.model=makeAvatar(P.shirtOverride||undefined);scene.add(P.model);P.anim=null;P.baseWhich=null;P.shieldMesh=null;P.bubble=null;
  if(RT.spawn&&RT.spawn.length)setTimeout(()=>rtFire('spawn'),0);
  P.pos.copy(W.checkpoint||W.spawn);P.vel.set(0,0,0);P.dead=false;P.boost=0;P.onGround=false;P.ground=null;P.health=P.maxHealth;
  P.model.position.copy(P.pos);P.model.rotation.y=P.yaw;
}
function die(kind){
  if(P.dead||state.over)return;
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

function damagePlayer(n){if(P.dead||state.over||!(n>0))return;if(P.shieldUntil>t)return;P.health=Math.max(0,P.health-n);if(RT.hurt&&RT.hurt.length)setTimeout(()=>rtFire('hurt'),0);const d=$('#dmg');d.classList.add('on');requestAnimationFrame(()=>requestAnimationFrame(()=>d.classList.remove('on')));
  if(P.health<=0)die('kill');}
function setShirt(c){if(!/^#[0-9a-f]{6}$/i.test(c||''))return;P.shirtOverride=c;if(!P.model||P.dead)return;
  const old=P.model;const nm=makeAvatar(c);nm.position.copy(old.position);nm.rotation.copy(old.rotation);
  if(P.held){P.held.parent&&P.held.parent.remove(P.held);nm.userData.rArm.add(P.held);}if(P.bubble&&P.bubble.parent===old){old.remove(P.bubble);nm.add(P.bubble);}
  if(P.shieldMesh){old.remove(P.shieldMesh);nm.add(P.shieldMesh);}scene.remove(old);scene.add(nm);P.model=nm;MP.lastSent='';}
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
  }return [];
}
function targetName(x){return x==='me'?myName():nameOf(x.by);}
function healPlayer(n){if(P.dead)return;P.health=Math.min(P.maxHealth,P.health+Math.max(0,n));}

/* ---------- online multiplayer ---------- */
const MP={room:null,user:null,db:null,me:{name:'',id:null},peerMe:null,gr:null,remotes:new Map(),unsubs:[],names:{},counts:{},lastSent:'',sendT:0,swWall:0,
  world:null,worldUnsub:null,worldDocs:new Map(),comm:[],commUnsub:null,connected:false,chatOpen:false,plistOpen:false,lastChat:0};
const ROOM_TOPICS=['chat','hit','ko','shot','fin'];
const SITE_URL='https://froggiewins.github.io/brickyard/';
const P2P_APP='brickyard-froggiewins-v1';
function nickById(pr){return pr&&typeof pr.nm==='string'&&pr.nm.trim()?'nick:'+pr.nm.replace(/[\u0000-\u001f]/g,'').trim().slice(0,20):null;}
function makeP2PRoom(name){
  const T=window.Trystero;const room=T.joinRoom({appId:P2P_APP},name);
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
  const connect=()=>{if(room||!window.Trystero)return;room=window.Trystero.joinRoom({appId:P2P_APP},'world');
    aOp=room.makeAction('wop');const aReq=room.makeAction('wreq'),aSt=room.makeAction('wst');
    aOp.onMessage=op=>apply(op);
    aReq.onMessage=(_,meta)=>{if(meta&&meta.peerId)aSt.send([...docs].slice(0,4000),{target:meta.peerId});};
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
  ACC.unsub=MP.db.doc('accounts/'+MP.me.id).onSnapshot(sn=>{const d=sn.exists?sn.data():null;
    ACC.doc=d&&typeof d.username==='string'?{username:d.username,color:/^#[0-9a-f]{6}$/i.test(d.color||'')?d.color:'#ff8a1f',bio:String(d.bio||'').slice(0,140),created:num(d.created,0)}:null;
    if(ACC.doc)ACC.names[MP.me.id]=ACC.doc.username;ACC.loaded=true;MP.lastSent='';renderAccountChip();renderCards();renderCommunity();},()=>{ACC.loaded=true;renderAccountChip();});
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
        const lease=await ref.acquire({holder:MP.me.id,ttlMs:5000});if(!lease.acquired)throw {msg:'Someone is claiming @'+u+' right now. Try again in a moment.'};
        if(await taken())throw {msg:'@'+u+' is taken. Try another.'};await ref.set({uid:MP.me.id});}
      await MP.db.doc('accounts/'+MP.me.id).set({username:u,color:col,bio,created:d?d.created:Date.now()});
      if(d&&d.username!==u){try{const old=MP.db.doc('names/'+d.username);const c=await old.get();if(c.exists&&c.data().uid===MP.me.id)await old.delete();}catch(_){}}}
      ACC.doc={username:u,color:col,bio,created:d?d.created:Date.now()};ACC.names[myUid()]=u;if(SB.client)sbApplyName();renderAccountChip();closeM();renderCards();
      if(!d)toastMenu('Welcome, @'+u+'!');if(after)after();
    }catch(x){btn.disabled=false;btn.textContent=d?'Save':'Create account';err(x&&x.msg?x.msg:'Saving failed. You may need Contributor access to this page.');}
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
    if(!window.Trystero){$('#onlineNote').textContent='Games run solo here. Play at '+SITE_URL+' to play online.';return;}
    if(!window.isSecureContext||!(window.crypto&&crypto.subtle)){$('#onlineNote').textContent='Games run solo here. Open this page over https to play online.';return;}
    MP.p2p=true;MP.room=makeP2PLobby();MP.worldDb=makeP2PWorld();
    const nk=$('#nick');nk.value=store.get('nick',null)||('Player'+Math.floor(100+Math.random()*900));store.set('nick',nk.value);MP.me={name:nk.value,id:localId()};$('#nickWrap').hidden=false;
    nk.addEventListener('change',()=>{const v=nk.value.replace(/[\u0000-\u001f]/g,'').trim().slice(0,20)||'Player';nk.value=v;store.set('nick',v);MP.me.name=v;MP.lastSent='';});
    $('#onlineNote').textContent='Games are online: anyone who opens this site can play with you, connected peer to peer.';
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
  if(!MP.room||def.fromEditor||!def.room){updateOnlineUI();return;}
  MP.room.presence({game:def.room}).catch(()=>{});
  const rn=('g-'+def.room).toLowerCase().replace(/[^a-z0-9_.-]/g,'-').slice(0,48);
  try{
    const gr=await MP.room.join(rn);
    if(!running||game!==def){gr.leave().catch(()=>{});return;}
    MP.gr=gr;
    MP.unsubs.push(gr.onPeers(onGamePeers,()=>{}),gr.on('chat',onChat,()=>{}),gr.on('hit',onHit,()=>{}),gr.on('ko',onKO,()=>{}),gr.on('shot',onShot,()=>{}),gr.on('fin',onFin,()=>{}),gr.on('run',onRun,()=>{}));
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
function setRemoteTag(r){if(r.tag){r.model.remove(r.tag);r.tag.material.map.dispose();r.tag.material.dispose();}r.tag=textSprite(nameOf(r.by));r.tag.position.set(0,3.6,0);r.model.add(r.tag);}
function applyPresence(r,pr){
  const p=pr.p;r.tgt.set(num(p[0],0),num(p[1],5),num(p[2],0));if(r.first){r.pos.copy(r.tgt);r.first=false;}
  r.tyaw=num(pr.yaw,0);r.mv=num(pr.mv,0);r.air=!!pr.air;r.hp=num(pr.hp,100);
  const dead=!!pr.dead;r.rgq=Array.isArray(pr.rg)&&pr.rg.length===4?new THREE.Quaternion(num(pr.rg[0],0),num(pr.rg[1],0),num(pr.rg[2],0),num(pr.rg[3],1)).normalize():null;if(dead!==r.dead){r.dead=dead;}
  if(typeof pr.sh==='string'&&/^#[0-9a-f]{6}$/i.test(pr.sh)&&pr.sh!==r.sh){r.sh=pr.sh;const vis=r.model.visible;scene.remove(r.model);r.model=makeAvatar(r.sh);r.mesh=r.model;r.model.visible=vis;scene.add(r.model);setRemoteTag(r);r.toolKey='';r.held=null;}
  const tk=pr.tool&&typeof pr.tool.n==='string'?pr.tool.n.slice(0,40)+'|'+(pr.tool.c||''):'';
  if(tk!==r.toolKey){r.toolKey=tk;if(r.held){r.held.parent&&r.held.parent.remove(r.held);r.held=null;}if(tk)r.held=makeRemoteHeld(pr.tool),r.model.userData.rArm.add(r.held);}
  if(num(pr.sw,0)!==r.lastSw){r.lastSw=num(pr.sw,0);if(r.lastSw)r.swT0=t;}
  r.stats=pr.st&&typeof pr.st==='object'?pr.st:{};
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
  const pr={p:[r3(P.pos.x),r3(P.pos.y),r3(P.pos.z)],yaw:r3(P.yaw),mv:r3(Math.hypot(P.vel.x,P.vel.z)),air:!P.onGround,dead:P.dead,sh:shirt,
    ...(P.shirtOverride?{sh:P.shirtOverride}:{}),tool:P.equipped?{n:P.equipped.name.slice(0,40),c:P.equipped.color}:null,sw:MP.swWall,hp:Math.round(P.health),st:myStats(),em:P.anim&&!P.anim.out?P.anim.net:'',inv:!!P.hidden,say:P.sayText||'',rg:P.rag?P.rag.q.toArray().map(v=>Math.round(v*100)/100):null};
  if(MP.p2p)pr.nm=MP.me.name;
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
  const body=D(blk,'DO');if(body)spawnRun(body,Object.assign({},base,{from:msg.peer}));}
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
const GUI_FONTS={Display:"'Lilita One','Arial Black',sans-serif",Body:"'Figtree',system-ui,sans-serif",Mono:"ui-monospace,Menlo,Consolas,monospace"};
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
  el.style.fontWeight=n.font==='Display'?'400':'700';el.style.justifyContent=n.align==='left'?'flex-start':n.align==='right'?'flex-end':'center';el.style.textAlign=n.align||'center';
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
function swingTool(e){e.swingT0=t;e.swingUntil=t+.35;e.hitSet=new Set();SFX.click();MP.swWall=Date.now();}
function fireToolHit(e,p){if(!p||p.destroyed)return;e.handlers.hit.forEach(h=>spawnRun(h.body,Object.assign({},h,{hit:p})));}
function shootFrom(e,color,speed){
  if(!e||P.dead)return;const start=new V3();
  if(P.held){P.held.updateMatrixWorld(true);P.held.getWorldPosition(start);const fwd=new V3(0,0,1).applyQuaternion(P.model.quaternion);start.addScaledVector(fwd,1.5);}
  else start.copy(P.pos).add(new V3(0,1.2,0));
  const aim=new V3();camera.getWorldDirection(aim);const target=camera.position.clone().addScaledVector(aim,250);
  const dir=target.sub(start).normalize();
  const m=new THREE.Mesh(SPH,mat(color||'#5cc8ff',{neon:true}));m.scale.setScalar(.7);m.position.copy(start);scene.add(m);
  W.projectiles.push({m,v:dir.multiplyScalar(Math.max(5,Math.min(600,speed||120))),life:3,tool:e,color:color||'#5cc8ff'});SFX.boost();
  mpEmit('shot',{o:start.toArray().map(r3),v:W.projectiles[W.projectiles.length-1].v.toArray().map(r3),c:color||'#5cc8ff'});
}
function pointInPart(p,v,r){
  if(p.obb){const c=Math.cos(p.yaw),sn=Math.sin(p.yaw),dx=v.x-p.pos.x,dz=v.z-p.pos.z;const lx=dx*c-dz*sn,lz=dx*sn+dz*c,ly=v.y-p.pos.y;
    return Math.abs(lx)<p.size.x/2+r&&Math.abs(lz)<p.size.z/2+r&&Math.abs(ly)<p.size.y/2+r;}
  return v.x>p.min.x-r&&v.x<p.max.x+r&&v.y>p.min.y-r&&v.y<p.max.y+r&&v.z>p.min.z-r&&v.z<p.max.z+r;}
function burstAt(v,color){const o=new THREE.Object3D();o.position.copy(v);o.scale.setScalar(.6);o.updateMatrixWorld();
  const e=new Emitter(Object.assign({},PPRESETS.sparkles,{shape:'spark',color0:color,color1:color,speed:8,spread:180,size0:.9,size1:0,lifeMin:.25,lifeMax:.5,rate:0}),{mesh:o,destroyed:true},scene);e.emit(24);W.emitters.push(e);}
function updateTools(dt){
  const e=P.equipped;
  if(e&&P.held&&t<e.swingUntil){const bb=new THREE.Box3().setFromObject(P.held);
    for(const p of W.parts){if(!p.active||p.destroyed||p.decor||p.kind==='water'||e.hitSet.has(p)||p.toolPickup)continue;
      if(bb.min.x<p.max.x&&bb.max.x>p.min.x&&bb.min.y<p.max.y&&bb.max.y>p.min.y&&bb.min.z<p.max.z&&bb.max.z>p.min.z){e.hitSet.add(p);fireToolHit(e,p);}}
    for(const p of MP.remotes.values()){if(p.dead||e.hitSet.has(p))continue;
      if(bb.min.x<p.max.x&&bb.max.x>p.min.x&&bb.min.y<p.max.y&&bb.max.y>p.min.y&&bb.min.z<p.max.z&&bb.max.z>p.min.z){e.hitSet.add(p);fireToolHit(e,p);}}}
  for(const pr of W.projectiles){pr.life-=dt;const steps=Math.max(1,Math.ceil(pr.v.length()*dt/1.2));let hit=null;
    for(let i=0;i<steps&&!hit;i++){pr.m.position.addScaledVector(pr.v,dt/steps);
      if(!pr.visual)for(const p of MP.remotes.values()){if(!p.dead&&pointInPart(p,pr.m.position,.4)){hit=p;break;}}
      if(!hit)for(const p of W.parts){if(!p.active||p.destroyed||p.decor||p.toolPickup||(p.noCollide&&!p.rig))continue;if(pointInPart(p,pr.m.position,.35)){hit=p;break;}}}
    if(hit){pr.life=0;burstAt(pr.m.position,pr.color);if(hit.kind!=='water'&&!pr.visual)fireToolHit(pr.tool,hit);}
    if(pr.life<=0){scene.remove(pr.m);}}
  W.projectiles=W.projectiles.filter(pr=>pr.life>0);
  for(const pk of W.pickups){if(pk.taken||P.dead)continue;
    if(pk.parts.some(p=>!p.destroyed&&partOverlap(p,-.2))){pk.taken=true;pk.parts.forEach(destroyPart);giveTool(pk.node);}}
  for(const d of W.debris){d.life-=dt;d.v.y-=PHYS.gravity*.35*dt;d.m.position.addScaledVector(d.v,dt);d.m.rotation.x+=d.s.x*dt;d.m.rotation.z+=d.s.z*dt;if(d.life<=0)scene.remove(d.m);}
  W.debris=W.debris.filter(d=>d.life>0);
  if(!P.dead&&P.health<P.maxHealth)P.health=Math.min(P.maxHealth,P.health+P.maxHealth*.01*dt);
}
function renderHotbar(){
  const hb=$('#hotbar');if(!hb)return;hb.hidden=!P.backpack.length;
  hb.innerHTML=P.backpack.map((e,i)=>`<button type="button" class="slot" data-slot="${i}" aria-pressed="${P.equipped===e}" title="${esc(e.node.tooltip||e.name)}"><span class="k">${i<9?i+1:''}</span><i style="background:${esc(e.color)}"></i><b>${esc(e.name)}</b></button>`).join('');
  $('#useBtn').hidden=!(coarse&&P.equipped);
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
function rtReset(){RT.gen++;MOUSE.down=0;Object.assign(RT,{dataLoaded:[],ptouch:[],bases:new Map(),bmap:new Map(),land:[],hurt:[],mouse:[],spawn:[],jump:[],waiters:[],touch:[],click:[],key:[],msg:new Map(),died:[],vars:new Map(),stats:new Map(),warned:new Set(),t0:0,last:null});}
function sleep(s,ctx){return new Promise(res=>RT.waiters.push({at:t+Math.max(0,+s||0),res,gen:ctx.gen}));}
function rtTick(){if(!RT.waiters.length)return;const due=[];
  RT.waiters=RT.waiters.filter(w=>{if(w.gen!==RT.gen)return false;if(w.at<=t+1e-9){due.push(w);return false;}return true;});due.forEach(w=>w.res());}
function rtErr(e,ctx){if(e===STOP||ctx.gen!==RT.gen)return;logOut((ctx.script||'Script')+': '+((e&&e.message)||e),'err');}
function spawnRun(body,base){if(!body)return Promise.resolve();const ctx=Object.assign({},base,{gen:RT.gen,ops:0});return run(body,ctx).catch(e=>rtErr(e,ctx));}
function rtFire(kind,arg){
  if(kind==='died')RT.died.forEach(h=>spawnRun(h.body,h));
  else if(kind==='msg')(RT.msg.get(arg)||[]).forEach(h=>spawnRun(h.body,h));
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
function moveParts(ps,d){if(d.lengthSq()===0)return;ps.forEach(p=>setPartPos(p,p.pos.clone().add(d)));}
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
    case 'math_arithmetic':{const a=numv(inp(b,'A'),ctx),c=numv(inp(b,'B'),ctx);
      switch(fld(b,'OP')){case 'ADD':return a+c;case 'MINUS':return a-c;case 'MULTIPLY':return a*c;case 'DIVIDE':return c===0?0:a/c;case 'POWER':return Math.pow(a,c);}return 0;}
    case 'math_random_int':{let a=Math.round(numv(inp(b,'FROM'),ctx)),c=Math.round(numv(inp(b,'TO'),ctx));if(a>c)[a,c]=[c,a];return a+Math.floor(Math.random()*(c-a+1));}
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
    case 'data_get':{const k=String(ev(inp(b,'KEY'),ctx)??'');return k in SAVE.d?SAVE.d[k]:0;}
    case 'data_has':return String(ev(inp(b,'KEY'),ctx)??'') in SAVE.d;
    case 'data_loaded':return SAVE.loaded;
    case 'data_returning':return SAVE.hadSave;
    case 's_pl_name':return myName();
    case 'pl_ref':return {plr:fld(b,'WHO')||'me'};
    case 'pl_ref_touchme':return {plist:otherPlayers().filter(r=>touchingMe(r))};
    case 'pl_touched':if(!ctx.touched)warnOnce('tp:'+ctx.script,ctx.script+': "touched player" only has a value inside "when I touch another player".');return ctx.touched||null;
    case 's_touch_player':{const x=inp(b,'WHO');const tg=resolveTargets(x?ev(x,ctx):{plr:'others'});return tg.some(r=>r!=='me'&&touchingMe(r));}
    case 'pl_ref_touch':{const ps=partsOf(partv(b,ctx));const out=[];if(!ps.length)return {plist:out};
      if(!P.dead&&ps.some(p=>partOverlap(p,-.12)))out.push('me');
      for(const r of otherPlayers()){if(r.dead)continue;if(ps.some(p=>r.min.x<p.max.x&&r.max.x>p.min.x&&r.min.y<p.max.y&&r.max.y>p.min.y&&r.min.z<p.max.z&&r.max.z>p.min.z))out.push(r);}
      return {plist:out};}
    case 'pl_ref_named':{const nm=String(ev(inp(b,'NAME'),ctx)??'').trim().toLowerCase().replace(/^@/,'');const out=[];if(!nm)return {plist:out};
      if(myName().toLowerCase()===nm)out.push('me');for(const r of otherPlayers())if(nameOf(r.by).toLowerCase()===nm)out.push(r);return {plist:out};}
    case 's_pl_nameof':{const x=inp(b,'WHO');const tg=resolveTargets(x?ev(x,ctx):null);return tg.length?targetName(tg[0]):'';}
    case 's_pl_hpof':{const x=inp(b,'WHO');const tg=resolveTargets(x?ev(x,ctx):null);if(!tg.length)return 0;return tg[0]==='me'?r3(P.health):r3(num(tg[0].hp,100));}
    case 's_pl_countof':{const x=inp(b,'WHO');return resolveTargets(x?ev(x,ctx):null).length;}
    case 's_pl_maxhp':return r3(P.maxHealth);
    case 's_pl_ragdoll':return !!P.rag&&!P.dead;
    case 's_pl_speed':return r3(PHYS.walk);
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
    if(ctx.gen!==RT.gen)throw STOP;
    await stmt(b,ctx);
    b=b.next&&b.next.block;
  }
}
const D=(b,n)=>{const x=b.inputs&&b.inputs[n];return x&&x.block;};
/* ---------- player save data (auto-saved progress) ---------- */
const SAVE={key:null,backend:'local',d:{},loaded:false,gen:0,last:'',lastT:0,busy:false,hadSave:false};
function saveKeyFor(def){const p=def.project;if(!p)return null;const raw=def.fromEditor?'test-'+p.id:String(p.saveId||p.id);return raw.replace(/[^A-Za-z0-9_-]/g,'_').slice(0,100)||null;}
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
  switch(b.type){
    case 'c_wait':ctx.ops=0;await sleep(numv(inp(b,'S'),ctx),ctx);break;
    case 'c_forever':while(true){await run(D(b,'DO'),ctx);ctx.ops=0;await sleep(0,ctx);}
    case 'controls_repeat_ext':{const n=Math.min(1e6,Math.floor(numv(inp(b,'TIMES'),ctx)));for(let i=0;i<n;i++){await run(D(b,'DO'),ctx);await guard(ctx);}break;}
    case 'controls_whileUntil':{const until=fld(b,'MODE')==='UNTIL';while(until!==truthy(ev(inp(b,'BOOL'),ctx))){await run(D(b,'DO'),ctx);await guard(ctx);}break;}
    case 'controls_if':{const es=b.extraState||{};const n=(es.elseIfCount||0)+1;let done=false;
      for(let i=0;i<n;i++){if(truthy(ev(inp(b,'IF'+i),ctx))){await run(D(b,'DO'+i),ctx);done=true;break;}}
      if(!done&&es.hasElse)await run(D(b,'ELSE'),ctx);break;}
    case 'c_wait_until':while(!truthy(ev(inp(b,'COND'),ctx))){ctx.ops=0;await sleep(0,ctx);}break;
    case 'c_broadcast':rtFire('msg',String(fld(b,'MSG')));break;
    case 'c_stop':throw STOP;
    case 'variables_set':RT.vars.set(varName(b,ctx),ev(inp(b,'VALUE'),ctx));break;
    case 'math_change':{const k=varName(b,ctx);RT.vars.set(k,(Number(RT.vars.get(k))||0)+numv(inp(b,'DELTA'),ctx));break;}
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
    case 'p_color':partsOf(partv(b,ctx)).forEach(p=>{if(p.rig){p.mesh.userData.rig.torso.material=mat(fld(b,'COLOUR')||'#ffffff');return;}applyLook(p);p.look.color=fld(b,'COLOUR')||'#ffffff';applyLook(p);});break;
    case 'p_transp':{const tv=Math.max(0,Math.min(1,numv(inp(b,'V'),ctx)));partsOf(partv(b,ctx)).forEach(p=>{applyLook(p);p.look.transparency=tv;applyLook(p);});break;}
    case 'p_material':partsOf(partv(b,ctx)).forEach(p=>{applyLook(p);p.look.material=fld(b,'MAT')||'Plastic';applyLook(p);});break;
    case 'p_collide':partsOf(partv(b,ctx)).forEach(p=>{p.noCollide=fld(b,'B')!=='TRUE';});break;
    case 'p_visible':partsOf(partv(b,ctx)).forEach(p=>{p.mesh.visible=fld(b,'B')==='TRUE';});break;
    case 'p_anchor':partsOf(partv(b,ctx)).forEach(p=>{if(fld(b,'B')==='TRUE')removeFrom(W.phys,p);else if(!W.phys.includes(p)){p.vy=0;W.phys.push(p);}});break;
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
    case 'p_destroy':partsOf(partv(b,ctx)).forEach(destroyPart);break;
    case 'rs_copy':{const v=new V3(numv(inp(b,'X'),ctx),numv(inp(b,'Y'),ctx),numv(inp(b,'Z'),ctx));copyFromStorage(String(fld(b,'NAME')||''),(c,bb)=>v.clone().sub(c));break;}
    case 'rs_onto':{const tp=topOf(partv(b,ctx));if(!tp)break;copyFromStorage(String(fld(b,'NAME')||''),(c,bb)=>new V3(tp.x-c.x,tp.y-bb.min.y,tp.z-c.z));break;}
    case 'rig_walk':case 'rig_walkp':{const r=partsOf(partv(b,ctx)).find(p=>p.rig);if(!r){warnOnce('rigw:'+ctx.script,ctx.script+': the walk block needs a Rig.');break;}
      const tx=numv(inp(b,'X'),ctx),tz=numv(inp(b,'Z'),ctx);
      if(r.walk)r.walk.done();
      await new Promise(res=>{r.walk={target:b.type==='rig_walk'?()=>({x:tx,z:tz}):()=>(P.dead?null:{x:P.pos.x,z:P.pos.z}),stop:b.type==='rig_walk'?.3:4,until:t+30,done:res};});break;}
    case 'rig_anim':partsOf(partv(b,ctx)).forEach(p=>{if(p.rig)p.anim=fld(b,'ANIM')||'idle';});break;
    case 'rig_say':{const v=ev(inp(b,'TEXT'),ctx);partsOf(partv(b,ctx)).forEach(p=>{if(p.rig)rigSay(p,typeof v==='number'?String(r3(v)):String(v??''),numv(inp(b,'S'),ctx)||3);});break;}
    case 'rig_face':partsOf(partv(b,ctx)).forEach(p=>{if(p.rig&&!P.dead){p.yaw=Math.atan2(P.pos.x-p.pos.x,P.pos.z-p.pos.z);p.mesh.rotation.y=p.yaw;}});break;
    case 'gui_settext':{const g=guiv(b,ctx);const v=ev(inp(b,'TEXT'),ctx);if(g&&g.el._tx)g.el._tx.textContent=(typeof v==='number'?String(r3(v)):String(v??'')).slice(0,400);break;}
    case 'gui_visible':{const g=guiv(b,ctx);if(g)g.el.hidden=fld(b,'B')!=='TRUE';break;}
    case 'gui_color':{const g=guiv(b,ctx);const c=fld(b,'COLOUR')||'#ffffff';if(g){if(fld(b,'WHAT')==='text')g.el.style.color=c;else g.el.style.background=hexA(c,g.node.bgT);}break;}
    case 'tool_swing':{const e=ctx.tool||P.equipped;if(e)swingTool(e);break;}
    case 'tool_shoot':{const e=ctx.tool||P.equipped;if(e&&P.equipped===e)shootFrom(e,fld(b,'COLOUR'),numv(inp(b,'S'),ctx));break;}
    case 'tool_give':{const nm=String(fld(b,'NAME')||'');const tn=findToolNode(nm);if(tn)giveTool(tn);else warnOnce('tg:'+nm,'No Tool named "'+nm+'" was found.');break;}
    case 'tool_take':removeToolByName(String(fld(b,'NAME')||''));break;
    case 'tool_unequip':unequipTool();break;
    case 'pl_damage':damagePlayer(numv(inp(b,'N'),ctx));break;
    case 'pl_damage_other':{const v=partv(b,ctx);const n=Math.max(0,Math.min(100,numv(inp(b,'N'),ctx)));if(v&&v.remote&&!v.dead){mpEmit('hit',{to:v.peer,n});v.flashT=.12;}break;}
    case 'pl_heal':healPlayer(numv(inp(b,'N'),ctx));break;
    case 'rig_damage':{const n=numv(inp(b,'N'),ctx);partsOf(partv(b,ctx)).filter(p=>p.rig).forEach(r=>damageRig(r,n));break;}
    case 'rig_heal':{const n=numv(inp(b,'N'),ctx);partsOf(partv(b,ctx)).filter(p=>p.rig).forEach(r=>healRig(r,n));break;}
    case 'pe_emit':{const ps=partsOf(partv(b,ctx));const n=numv(inp(b,'N'),ctx);W.emitters.forEach(e=>{if(ps.includes(e.parent))e.emit(n);});break;}
    case 'pe_toggle':{const ps=partsOf(partv(b,ctx));const on=fld(b,'B')==='TRUE';W.emitters.forEach(e=>{if(ps.includes(e.parent))e.on=on;});break;}
    case 'pl_kill':die('kill');break;
    case 'pl_teleport':{const tp=topOf(partv(b,ctx));if(tp&&!P.dead){P.pos.set(tp.x,tp.y+PH.y+.3,tp.z);P.vel.set(0,0,0);}break;}
    case 'pl_launch':P.vel.y=numv(inp(b,'P'),ctx);P.onGround=false;P.coyote=0;break;
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
    case 'rig_ragdoll':partsOf(partv(b,ctx)).filter(p=>p.rig).forEach(r=>ragdollRig(r,numv(inp(b,'S'),ctx)));break;
    case 'rig_fling':{const pw=Math.max(0,Math.min(400,numv(inp(b,'P'),ctx)));partsOf(partv(b,ctx)).filter(p=>p.rig).forEach(r=>{const d=new V3(r.pos.x-P.pos.x,0,r.pos.z-P.pos.z);if(d.lengthSq()<.01)d.set(0,0,1);d.normalize().multiplyScalar(pw*.6);d.y=pw*.8;ragdollRig(r,2.5,d);});break;}
    case 'data_enable':SAVE.off=fld(b,'B')!=='TRUE';break;
    case 'pl_sethp':{if(P.dead)break;const v=Math.max(0,Math.min(P.maxHealth,numv(inp(b,'N'),ctx)));if(v<P.health)damagePlayer(P.health-v);else P.health=v;break;}
    case 'pl_maxhp':{P.maxHealth=Math.max(1,Math.min(100000,numv(inp(b,'N'),ctx)));P.health=Math.min(P.health,P.maxHealth);if(fld(b,'FILL')==='TRUE'&&!P.dead)P.health=P.maxHealth;break;}
    case 'pl_tpxyz':if(!P.dead){P.pos.set(numv(inp(b,'X'),ctx),numv(inp(b,'Y'),ctx),numv(inp(b,'Z'),ctx));P.vel.set(0,0,0);}break;
    case 'pl_respawn':if(!state.over){if(P.dead)P.deadT=0;else{if(P.equipped)unequipTool();respawn();}}break;
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
    case 'g_msg':{const v=ev(inp(b,'TEXT'),ctx);toast(typeof v==='number'?String(r3(v)):String(v??''),'#fff',numv(inp(b,'S'),ctx)||2);break;}
    case 'g_print':{const v=ev(inp(b,'TEXT'),ctx);logOut(typeof v==='number'?String(r3(v)):String(v??''),'info');break;}
    case 'g_stat_change':changeStat(fld(b,'STAT'),numv(inp(b,'N'),ctx),false);break;
    case 'g_stat_set':changeStat(fld(b,'STAT'),numv(inp(b,'N'),ctx),true);break;
    case 'g_win':finish();break;
    case 'g_sound':{const f=SFX[fld(b,'SND')];if(f)f();break;}
    case 'g_sky':{const c=new THREE.Color(fld(b,'COLOUR')||'#9fd8ff');scene.background=c;scene.fog.color.copy(c);break;}
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
    const base={part,model,vmap,script:s.name||'Script',tool:(opts&&opts.tool)||null,gui,sid:s.id};
    RT.bmap.set(s.id,indexScriptBlocks(s));RT.bases.set(s.id,base);
    for(const top of s.blocks.blocks.blocks||[]){
      const body=top.next&&top.next.block;
      const h=Object.assign({body},base);
      switch(top.type){
        case 'ev_start':spawnRun(body,base);break;
        case 'ev_touch':if(part)RT.touch.push(Object.assign(h,{was:false,running:false}));else logOut(base.script+': "when player touches this part" needs the script to be inside a part.','warn');break;
        case 'ev_touch_model':if(model)RT.touch.push(Object.assign(h,{group:model,parts:model.parts,was:false,running:false}));else logOut(base.script+': "when player touches this model" needs the script to be inside a Model.','warn');break;
        case 'ev_click_model':if(model)RT.click.push(Object.assign(h,{group:model,parts:model.parts}));else logOut(base.script+': "when this model is clicked" needs the script to be inside a Model.','warn');break;
        case 'ev_click':if(part)RT.click.push(h);else logOut(base.script+': "when this part is clicked" needs the script to be inside a part.','warn');break;
        case 'ev_key':RT.key.push(Object.assign(h,{key:fld(top,'KEY')}));break;
        case 'ev_mouse':RT.mouse.push(h);break;
        case 'ev_every':{const n=Math.max(.05,Number(fld(top,'S'))||1);const ctx=Object.assign({},base,{gen:RT.gen,ops:0});
          (async()=>{while(true){await sleep(n,ctx);await run(body,ctx);}})().catch(e=>rtErr(e,ctx));break;}
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
function toast(s,color,dur){const el=$('#toast');el.textContent=s;el.style.color=color||'#fff';el.classList.add('show');toastT=dur||1.8;}
function setStat(s){hud.stat.hidden=!s;if(hud.stat.textContent!==s)hud.stat.textContent=s;}

function handleTouch(p){
  const d=p.data;
  switch(p.kind){
    case 'kill': die('kill');break;
    case 'water': die('water');break;
    case 'check':
      if(d.stage>state.stage){state.stage=d.stage;W.checkpoint=new V3(p.pos.x,p.max.y+PH.y+.2,p.pos.z);
        p.mesh.material=mat(0x9dffb8,{neon:true});SFX.check();toast((game.stageWord||'Checkpoint')+' '+d.stage+' reached','#9dffb8');}
      break;
    case 'jump': if(P.padCool<=0){P.vel.y=d.power||100;P.padCool=.35;P.onGround=false;P.coyote=0;SFX.pad();}break;
    case 'speed': if(P.boost<1.6)SFX.boost();P.boost=d.boost||2.6;break;
    case 'finish': finish();break;
  }
}

/* ---------- builder (Free Build) ---------- */
const B={tool:'build',size:2,color:'#e53935',ghost:null,clearArm:0};
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
function placeBrick(x,y,z,s,color){const p=block(x,y,z,s,s,s,color);p.data.built=true;p.data.rec=[x,y,z,s,color];return p;}
function saveBuild(){if(MP.world){setStat(W.parts.filter(p=>p.data.built).length+' blocks');return;}store.set('build',W.parts.filter(p=>p.data.built).map(p=>p.data.rec));setStat(W.parts.filter(p=>p.data.built).length+' blocks');}
function removePart(p){scene.remove(p.mesh);removeFrom(W.parts,p);removeFrom(W.solids,p);}
function builderClick(e){
  const hit=pickAt(e);if(!hit)return;const part=hit.object.userData.part;
  if(MP.world){
    if(B.tool==='build'){const c=cellFor(hit);if(!canPlace(c,B.size)){SFX.nope();return;}if(W.parts.filter(p=>p.data.built).length>=4000){toast('The shared world is full','#ff9aa4');return;}
      const id=brickId(c.x,c.y,c.z,B.size);SFX.place();worldWrite(()=>MP.world.doc(id).set({x:c.x,y:c.y,z:c.z,s:B.size,c:B.color,by:MP.me.id||null}));}
    else if(B.tool==='delete'){if(part&&part.data.docId){SFX.del();const id=part.data.docId;worldWrite(()=>MP.world.doc(id).delete());}else SFX.nope();}
    else if(B.tool==='paint'){if(part&&part.data.docId){SFX.place();const id=part.data.docId,col=B.color;worldWrite(()=>MP.world.doc(id).update({c:col}));}else SFX.nope();}
    updateGhost(e);return;}
  if(B.tool==='build'){const c=cellFor(hit);if(!canPlace(c,B.size)){SFX.nope();return;}placeBrick(c.x,c.y,c.z,B.size,B.color);SFX.place();saveBuild();}
  else if(B.tool==='delete'){if(part&&part.data.built){removePart(part);SFX.del();saveBuild();}else SFX.nope();}
  else if(B.tool==='paint'){if(part&&part.data.built){part.mesh.material=mat(B.color);part.data.rec[4]=B.color;SFX.place();saveBuild();}else SFX.nope();}
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
  const bc=$('#bcolors');bc.innerHTML='';
  BCOLORS.forEach(c=>{const b=document.createElement('button');b.type='button';b.className='sw';b.style.background=c;b.setAttribute('aria-label','Color '+c);
    b.setAttribute('aria-pressed',c===B.color);b.onclick=()=>{B.color=c;bc.querySelectorAll('.sw').forEach(x=>x.setAttribute('aria-pressed',x===b));};bc.appendChild(b);});
}
$('#btools').addEventListener('click',e=>{const b=e.target.closest('button');if(!b)return;setBTool(b.dataset.tool);});
$('#bsizes').addEventListener('click',e=>{const b=e.target.closest('button');if(!b)return;B.size=+b.dataset.size;$('#bsizes').querySelectorAll('button').forEach(x=>x.setAttribute('aria-pressed',x===b));});
function setBTool(t){B.tool=t;$('#btools').querySelectorAll('button').forEach(x=>x.setAttribute('aria-pressed',x.dataset.tool===t));if(B.ghost)B.ghost.visible=false;}
$('#bclear').addEventListener('click',()=>{const b=$('#bclear');
  if(B.clearArm>0){if(MP.world){const mine=[...MP.worldDocs].filter(([,d])=>d.by&&d.by===MP.me.id).map(([id])=>id);(async()=>{for(const id of mine){try{await MP.world.doc(id).delete();}catch(e){break;}}})();toast('Cleared your blocks','#9fe3ff');}
    else{W.parts.filter(p=>p.data.built).forEach(removePart);saveBuild();}SFX.del();B.clearArm=0;b.textContent='Clear';}
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
  const types=['steps','move','lava','fade','spin','move','fade','lava'];
  W.stages=types.length;
  types.forEach((type,s)=>{
    const col=STAGE_COLS[s];
    for(let j=0;j<6;j++){
      if(type==='spin'&&j===2){const [x,yy,z]=place(16,4);pad(x,yy,z,16,16,col);addSpinner(x,yy+1.2,z,15,1.5+s*.08);continue;}
      const w=type==='lava'?7:4.5+rnd()*1.5;const [x,yy,z]=place(w,3.2+rnd()*1.3);
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
  run(28);speedPad(z+5);gap(16);
  pad(0,y,z-10,20,20,0xffc93c,{kind:'finish',metal:.35});
  W.stages=cp;W.killY=y-80;
  for(let i=0;i<40;i++){const cz=-rnd()*(Math.abs(z)+80)+40,cx=(rnd()-.5)*260,cy=60+rnd()*90;
    if(Math.abs(cx)<20)continue;block(cx,cy,cz,12+rnd()*30,4+rnd()*5,10+rnd()*24,0xffffff,{collide:false,decor:true,transparency:.15,noShadow:true});}
}
function buildCoins(rnd){
  pad(0,0,0,900,900,0x2f8fd8,{kind:'water',h:2,transparency:.12,noShadow:true});
  const isl=[{x:0,z:0,w:70,d:70,top:3},{x:105,z:15,w:40,d:40,top:6},{x:-10,z:110,w:46,d:36,top:4},{x:-105,z:-15,w:42,d:48,top:4},{x:25,z:-105,w:36,d:36,top:3}];
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
  isl.forEach(I=>{const n=Math.floor(I.w*I.d/400);for(let i=0;i<n;i++){const x=I.x+(rnd()-.5)*(I.w-6),z=I.z+(rnd()-.5)*(I.d-6);
    if(coinsAt.some(c=>Math.hypot(c[0]-x,c[1]-z)<6))continue;const g=groundAt(x,z,30);if(g>I.top+.5)continue;
    block(x,g+3.5,z,1.6,7,1.6,0x6d4c41,{decor:true});block(x,g+9.5,z,7,5,7,0x2e7d32,{decor:true});}});
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
  saved.forEach(r=>placeBrick(r[0],r[1],r[2],r[3],r[4]));
  const gm=new THREE.MeshBasicMaterial({color:0xffffff,transparent:true,opacity:.45,depthWrite:false});
  B.ghost=new THREE.Mesh(BOX,gm);B.ghost.visible=false;scene.add(B.ghost);
}
function arenaDef(){
  const p=newProjectObj('baseplate','Brick Battle');p.id='arena';p.settings.timer=false;p.settings.sky='#8ec9ff';
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
  N.find(n=>n.name==='Welcome').blocks=scriptOf(chain(blk('ev_start'),blk('g_stat_set',{N:bn(0)},{STAT:'KOs'}),blk('g_msg',{TEXT:bt('Grab your sword (1) or blaster (2). Knock out dummies and other players!'),S:bn(4)})));
  const def=projectDef(p,false);return Object.assign(def,{id:'arena',room:'arena',name:'Brick Battle'});
}
const GAMES=[
  {id:'arena',name:'Brick Battle',tag:'Online battle',desc:'Swords, blasters and jump pads in a walled arena. Knock out training dummies and anyone else who joins.',mode:'project',make:arenaDef},
  {id:'tower',name:'Lava Tower',tag:'Obby · 8 stages',desc:'Climb a spiral of moving, fading and lava-striped platforms around a giant pillar. Spinners guard the middle.',
    build:buildTower,mode:'race',stageWord:'Stage',scene:{sky:0x2a1b3d,fogNear:120,fogFar:520,ground:0x5a2a1a},seed:7,objective:'Reach the golden top'},
  {id:'coins',name:'Coin Rush',tag:'Collect · 2:30',desc:'Hop between islands, ride the ferry and launch off the jump pad to grab every coin before the clock runs out.',
    build:buildCoins,mode:'coins',limit:150,scene:{sky:0x9fd8ff,fogNear:180,fogFar:620},seed:21,objective:'Collect every coin'},
  {id:'sky',name:'Skyline Sprint',tag:'Race · 4 checkpoints',desc:'A speedrun course above the clouds. Hit speed pads to clear big gaps, dodge spinners, beat your best time.',
    build:buildSky,mode:'race',stageWord:'Checkpoint',scene:{sky:0x7fb8ff,fogNear:150,fogFar:560,ground:0x9fb4d6},seed:3,objective:'Cross the finish line'},
  {id:'sandbox',name:'Free Build',tag:'Sandbox',desc:'Place, paint and delete bricks on a studded baseplate. Your build is saved in this browser for next time.',
    build:buildSandbox,mode:'build',scene:{sky:0xa7d8ff,fogNear:220,fogFar:800},seed:1,objective:'Tap or click to build'}
];

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
  N.push(partNode({name:'SpawnLocation',pos:[0,.5,0],size:[12,1,12],color:'#c7ccd6',behavior:'spawn'}));
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
      const p=addPart(o);p.node=n;map.set(n.id,p);if(inTool)p.toolPickup=true;else if(n.anchored===false){p.vy=0;W.phys.push(p);}
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
function buildProject(proj){
  const S=proj.settings;
  PHYS.gravity=S.gravity;PHYS.walk=S.walkSpeed;PHYS.jump=S.jumpPower;
  registerAnims(proj);
  const list=descendantsOf(proj,'workspace');
  W.models=instantiate(proj,list,null,W.byId);
  let spawn=null,minY=Infinity,stages=0;
  for(const n of list){const p=W.byId.get(n.id);if(p&&!p.rig)minY=Math.min(minY,p.min.y);
    if(n.cls==='Part'&&n.behavior==='spawn'&&!spawn)spawn=p;if(n.cls==='Part'&&n.behavior==='check')stages=Math.max(stages,n.value||1);}
  if(spawn)W.spawn.set(spawn.pos.x,spawn.max.y+PH.y+.3,spawn.pos.z);
  else W.spawn.set(0,(isFinite(minY)?Math.max(0,groundAt(0,0)):0)+PH.y+3,0);
  W.killY=(isFinite(minY)?minY:0)-60;W.stages=stages;
  state.total=W.coins.length;
}
function copyFromStorage(name,place){
  const proj=game&&game.project;if(!proj)return null;
  const tpl=proj.nodes.find(n=>n.name===name&&n.cls!=='Script'&&serviceOf(proj,n.id)==='rs');
  if(!tpl){warnOnce('rs:'+name,'Nothing named "'+name+'" is in ReplicatedStorage.');return null;}
  const list=[tpl,...descendantsOf(proj,tpl.id)];const bb=nodesBounds(list);const c=bb.getCenter(new V3());
  const off=place(c,bb);const map=new Map();const models=instantiate(proj,list,off,map);
  startScriptsFor(proj,list.filter(n=>n.cls==='Script'&&!hasToolAncestor(proj,n.id)),map,models);
  RT.last=models.get(tpl.id)||map.get(tpl.id)||{isGroup:true,name,parts:[...map.values()]};
  return RT.last;
}
function projectDef(proj,fromEditor){
  const S=proj.settings;
  return {id:'proj:'+proj.id,name:proj.name,mode:'project',fromEditor,project:proj,stageWord:'Checkpoint',
    scene:{sky:S.sky,fogNear:Math.min(200,S.fog*.25),fogFar:S.fog,brightness:S.brightness},build:()=>buildProject(proj),objective:fromEditor?'Testing '+proj.name:proj.name,room:fromEditor?null:'p-'+proj.id};
}

/* ---------- start / stop ---------- */
function startGame(def){
  mpLeave();
  if(def.room===undefined)def.room=def.id;
  game=def;t=0;
  PHYS.gravity=196.2;PHYS.walk=16;PHYS.jump=50;
  newScene(def.scene);
  state={time:0,stage:0,coins:0,total:0,deaths:0,over:false};
  rtReset();
  P.yaw=0;
  def.build(mulberry(def.seed||1));
  P.model=null;P.debris=[];
  respawn();
  P.backpack=[];P.equipped=null;P.held=null;P.health=P.maxHealth=100;lastHp=-1;
  if(def.project){buildRuntimeGui(def.project);startScripts(def.project);giveStarterTools(def.project);saveBegin(def);}
  renderHotbar();$('#hp').hidden=!def.project;
  cam.yaw=def.id==='sky'?0:def.id==='tower'?Math.PI/2+.4:.6;cam.pitch=.3;cam.dist=coarse?22:20;cam.cur=cam.dist;
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
  running=true;paused=false;
  mpJoin(def);
  cv.focus({preventScroll:true});
}
function stopGame(){
  if(game&&game.project&&SAVE.loaded)saveFlush(false,true);SAVE.gen++;SAVE.loaded=false;
  mpLeave();
  if(P.equipped)unequipTool();P.backpack=[];renderHotbar();
  running=false;paused=false;rtReset();$('#game').hidden=true;keys.clear();jumpHeld=false;
  if(game&&game.fromEditor){logOut('Playtest stopped.','sys');ED.ecv.focus({preventScroll:true});return;}
  $('#menu').hidden=false;renderCards();
}
function pause(){if(!running||state.over)return;paused=true;keys.clear();jumpHeld=false;
  const restart=game.mode==='build'?'':'<button class="btn ghost" data-act="restart">Restart</button>';
  const back=game.fromEditor?'<button class="btn ghost" data-act="menu">Stop testing</button>':'<button class="btn ghost" data-act="menu">Back to games</button>';
  $('#panel').innerHTML=`<h2>Paused</h2><div class="btns"><button class="btn" data-act="resume">Resume</button>${restart}${back}</div>
  <div class="setrow"><span>Sound</span><button class="btn ghost" data-act="mute">${muted?'Off':'On'}</button></div>
  <div class="setrow"><label for="sens">Camera speed</label><input id="sens" type="range" min=".4" max="2.2" step=".1" value="${cam.sens}"></div>`;
  $('#overlay').hidden=false;
  $('#sens').oninput=e=>{cam.sens=+e.target.value;store.set('sens',cam.sens);};}
function resume(){paused=false;$('#overlay').hidden=true;cv.focus({preventScroll:true});}
$('#panel').addEventListener('click',e=>{const b=e.target.closest('[data-act]');if(!b)return;const a=b.dataset.act;
  if(a==='resume')resume();else if(a==='restart')startGame(game);else if(a==='menu')stopGame();
  else if(a==='mute'){muted=!muted;store.set('muted',muted);b.textContent=muted?'Off':'On';}});
$('#btnPause').addEventListener('click',()=>paused?resume():pause());
$('#btnStop').addEventListener('click',()=>stopGame());
document.addEventListener('visibilitychange',()=>{if(document.hidden&&running&&!paused)pause();});

function finish(){
  if(state.over)return;state.over=true;SFX.win();if(game.project)saveFlush(false,true);
  mpEmit('fin',{time:r3(state.time)});
  const bests=store.get('bests',{});let html='';
  if(game.mode==='race'||game.mode==='project'){const prev=bests[game.id];const nb=prev==null||state.time<prev;if(nb&&!game.fromEditor){bests[game.id]=state.time;store.set('bests',bests);}
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
  if(game.mode==='build'){if(e.code==='Digit1')setBTool('build');if(e.code==='Digit2')setBTool('paint');if(e.code==='Digit3')setBTool('delete');}
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
    if(!used&&P.equipped)activateTool();}
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
  for(const p of W.phys){if(p.destroyed)continue;p.vy=(p.vy||0)-PHYS.gravity*dt;const dy=Math.max(-150,p.vy)*dt;p.pos.y+=dy;computeAABB(p);
    for(const s of W.solids){if(s===p||s.noCollide||!s.active||s.decor)continue;
      if(p.min.x<s.max.x&&p.max.x>s.min.x&&p.min.z<s.max.z&&p.max.z>s.min.z&&p.min.y<s.max.y&&p.max.y>s.min.y&&dy<0){p.pos.y+=s.max.y-p.min.y;p.vy=0;computeAABB(p);}}
    p.mesh.position.copy(p.pos);p.base.copy(p.pos);W.dyn.add(p);if(p.pos.y<W.killY)destroyPart(p);}
  for(const s of W.spinners)s.pivot.rotation.y=(tw*s.speed)%(Math.PI*2);
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
    if(P.model)P.model.visible=cam.dist>1&&!P.hidden;
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
    for(const c of W.coins){if(c.got)continue;if(c.mesh.position.distanceToSquared(P.pos)<10.5){c.got=true;c.pop=.3;state.coins++;SFX.coin();
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
  if(game.project&&!state.over){scriptFrame();saveTick();}
  if(MP.remotes.size)updateRemotes(dt);
  if(MP.gr&&(MP.sendT-=dt)<=0){MP.sendT=.066;sendPresence();if((MP.plT=(MP.plT||0)-.066)<=0){MP.plT=1;if(MP.plistOpen)renderPlayerList();}}
  if(game.project){const hp=Math.ceil(P.health);if(hp!==lastHp){lastHp=hp;$('#hpFill').style.width=(100*P.health/P.maxHealth)+'%';$('#hpFill').style.background=P.health/P.maxHealth>.5?'':P.health/P.maxHealth>.25?'var(--warn)':'var(--bad)';$('#hpTxt').textContent=hp;}}
  rtTick();

  if(!state.over&&game.mode!=='build'&&game.mode!=='free')state.time+=dt;
  if(game.mode==='race'||game.mode==='project'){const s=fmt(state.time);if(s!==lastTimerTxt){hud.timer.textContent=s;lastTimerTxt=s;}hud.timer.style.color='';}
  if(game.mode==='race')setStat((game.stageWord||'Stage')+' '+state.stage+'/'+W.stages);
  else if(game.mode==='project'){const s=[...RT.stats].map(([k,v])=>k+' '+r3(v)).join(' · ');if(s!==lastStatTxt){setStat(s);lastStatTxt=s;}}
  else if(game.mode==='coins'){const rem=game.limit-state.time;const s=fmt(rem);if(s!==lastTimerTxt){hud.timer.textContent=s;lastTimerTxt=s;}
    hud.timer.style.color=rem<20?'#ff7a85':'';setStat('Coins '+state.coins+'/'+state.total);if(rem<=0)finish();}
  if(toastT>0){toastT-=dt;if(toastT<=0)$('#toast').classList.remove('show');}
}
function updateCamera(dt){
  const target=tmp2.copy(P.pos);target.y+=1.6;
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
  const fovT=P.boost>0?84:70;if(Math.abs(camera.fov-fovT)>.1){camera.fov+=(fovT-camera.fov)*Math.min(1,dt*6);camera.updateProjectionMatrix();}
  sun.position.set(P.pos.x+50,P.pos.y+110,P.pos.z+35);sun.target.position.copy(P.pos);
}
const clock=new THREE.Clock();
function loop(){
  requestAnimationFrame(loop);
  const dt=Math.min(clock.getDelta(),.05);
  if(running){
    if(!paused)update(dt);
    updateCamera(dt);
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
    if(n.cls==='Part'){const m=makePartMesh(n);eworld.add(m);ED.meshes.set(n.id,m);}
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

/* ---- explorer ---- */
function renderExplorer(){
  const el=$('#explorer');const by=new Map();
  for(const n of ED.proj.nodes){if(!by.has(n.parent))by.set(n.parent,[]);by.get(n.parent).push(n);}
  let h='';
  const row=(id,name,ico,icoCls,depth,hasKids,extra)=>{const sel=ED.sel.includes(id)?' sel':'';const open=ED.expanded.has(id);
    return `<div class="ex-row${sel}" data-id="${id}" draggable="${isService(id)?'false':'true'}" style="padding-left:${6+depth*14}px" role="treeitem" aria-selected="${!!sel}" aria-expanded="${hasKids?open:''}">`+
    `<button class="tw" data-tw="${id}" tabindex="-1" aria-label="Expand">${hasKids?(open?'▾':'▸'):''}</button><span class="ico ${icoCls}">${ico}</span>`+
    (ED.rename===id?`<input id="renameIn" value="${esc(name)}" aria-label="Rename">`:`<span class="nm${extra||''}">${esc(name)}</span>`)+`</div>`;};
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
    h+=it('ins-script','Insert script')+it('focus','Zoom to','F');}
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
  spawn:()=>({name:'SpawnLocation',size:[12,1,12],color:'#c7ccd6',behavior:'spawn'}),
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
  if(id==='workspace')h=pgrp('Workspace',prow('Gravity',pnum('s.gravity',S.gravity,1,1),'p_s.gravity')+prow('Show timer',pchk('s.timer',S.timer),'p_s.timer'))+`<p class="pnote">Roblox default gravity is 196.2 studs/s². Lower it for floaty, moon-like jumps.</p>`;
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
        prow('Font',psel('font',n.font||'Body',[['Body','Figtree'],['Display','Lilita One'],['Mono','Monospace']]),'p_font')+prow('Align',psel('align',n.align||'center',[['left','Left'],['center','Center'],['right','Right']]),'p_align'));
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
        prow('Health',pnum('health',n.health||100,5,1),'p_health')+prow('Respawn after (s)',pnum('respawn',n.respawn||0,1,0),'p_respawn'));
      h+=scriptsBox()+`<p class="pnote">Rigs are characters you can script with the Rigs blocks: walk, say, face the player and play animations. Players bump into them like a part.</p>`;
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
      h+=pgrp('Behavior',prow('Anchored',pchk('anchored',n.anchored!==false),'p_anchored')+prow('CanCollide',pchk('canCollide',n.canCollide!==false),'p_canCollide')+
        prow('Locked',pchk('locked',!!n.locked),'p_locked')+prow('Gameplay',psel('behavior',n.behavior||'none',BEHAVIORS),'p_behavior')+(vl?prow(vl[0],pnum('value',n.value||vl[1],vl[2],0),'p_value'):''));
      h+=scriptsBox();
      if(n.shape==='mesh')h+=`<p class="pnote">Mesh parts collide like a box of their Size.</p>`;
      if(n.anchored===false)h+=`<p class="pnote">Unanchored parts fall and land on other parts when the game runs.</p>`;
      if(n.shape==='wedge'&&((n.rot||[0,0,0])[0]||(n.rot||[0,0,0])[2]))h+=`<p class="pnote">Tilted wedges collide like boxes. Rotate wedges only around Y to keep the ramp walkable.</p>`;
    }else if(n.cls==='Script'){
      h+=pgrp('Script',prow('Enabled',pchk('enabled',n.enabled!==false),'p_enabled')+`<div class="pr"><span class="l"></span><div class="btnrow"><button class="mini pri" type="button" data-pa="open" data-sid="${n.id}">Edit blocks</button></div></div>`);
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
  if(k.startsWith('s.')){ED.proj.settings[k.slice(2)]=v;rebuildWorld();if(commitIt)commit();return;}
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
      scriptNode({parent:T.id,name:'BlasterScript',blocks:scriptOf(chain(blk('ev_tool_act'),blk('tool_shoot',{S:bn(140)},{COLOUR:'#5cc8ff'})),
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
  Blockly.Events.enable();ED.loadingWs=false;
  ED.ws.scroll(0,0);
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
function BY.grounded() local h = hum() return h ~= nil and h.FloorMaterial ~= Enum.Material.Air end
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
    case 's_player':return `BY.ppos(${luaStr(fld(b,'AXIS'))})`;case 's_prop':return `BY.prop(${Pt(b)}, ${luaStr(fld(b,'PROP'))})`;
    case 's_pl_ragdoll':return 'false';
    case 's_pl_name':return '(player() and player().Name or "")';case 's_touch_player':L.notes.add('Player-to-player touch checks need a Touched handler on the character in Roblox.');return 'false';case 'pl_ref':case 'pl_ref_touchme':case 'pl_touched':case 'pl_ref_touch':case 'pl_ref_named':return 'Players:GetPlayers()';
    case 's_pl_nameof':return '(player() and player().Name or "")';case 's_pl_hpof':return 'BY.health()';case 's_pl_countof':return '#Players:GetPlayers()';case 's_pl_maxhp':return '(hum() and hum().MaxHealth or 100)';case 's_pl_speed':return '(hum() and hum().WalkSpeed or 16)';
    case 's_pl_moving':return '(hum() ~= nil and hum().MoveDirection.Magnitude > 0)';case 's_pl_alive':return '(hum() ~= nil and hum().Health > 0)';
    case 's_pl_shield':return '(player() and player().Character and player().Character:FindFirstChildOfClass("ForceField") ~= nil)';case 's_pl_tool':return '(function() local c = player() and player().Character local t = c and c:FindFirstChildOfClass("Tool") return t and t.Name or "" end)()';
    case 'data_get':L.notes.add('Saved data needs DataStoreService in Roblox; the export keeps it in BY.saved for the session only.');return `(BY.saved[tostring(${V(b,'KEY','""')})] or 0)`;
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
    case 'variables_set':return l(`BY.vars[${vn(b)}] = ${V(b,'VALUE','0')}`);
    case 'math_change':return l(`BY.vars[${vn(b)}] = (BY.vars[${vn(b)}] or 0) + ${V(b,'DELTA','1')}`);
    case 'p_move':return l(`BY.move(${Pt(b)}, ${xyz(b)})`);case 'p_setpos':return l(`BY.setpos(${Pt(b)}, ${xyz(b)})`);
    case 'p_glide':return l(`BY.glide(${Pt(b)}, ${xyz(b)}, ${V(b,'S','1')}, true)`);case 'p_glideto':return l(`BY.glide(${Pt(b)}, ${xyz(b)}, ${V(b,'S','1')}, false)`);
    case 'p_rotate':return l(`BY.rotate(${Pt(b)}, ${V(b,'DEG','0')}, ${luaStr(fld(b,'AXIS')||'y')})`);
    case 'p_color':return l(`BY.set(${Pt(b)}, "Color", Color3.fromHex(${luaStr(fld(b,'COLOUR')||'#ffffff')}))`);
    case 'p_transp':return l(`BY.set(${Pt(b)}, "Transparency", ${V(b,'V','0')})`);
    case 'p_material':{const m=fld(b,'MAT');return l(`BY.set(${Pt(b)}, "Material", Enum.Material.${m==='Studs'?'Plastic':m||'Plastic'})`);}
    case 'p_collide':return l(`BY.set(${Pt(b)}, "CanCollide", ${TF(b)})`);case 'p_anchor':return l(`BY.set(${Pt(b)}, "Anchored", ${TF(b)})`);
    case 'p_visible':return l(`BY.set(${Pt(b)}, "Transparency", ${fld(b,'B')==='TRUE'?0:1})`);
    case 'p_deadly':return l(`BY.set(${Pt(b)}, "Deadly", ${TF(b)}) -- handled by the Deadly kill script`);
    case 'p_clone':return l(`BY.clone(${Pt(b)}, ${xyz(b)})`);case 'p_destroy':return l(`BY.destroy(${Pt(b)})`);
    case 'rs_copy':return l(`BY.copyTo(${luaStr(fld(b,'NAME'))}, ${xyz(b)})`);
    case 'rs_onto':return l(`BY.copyOnto(${luaStr(fld(b,'NAME'))}, ${Pt(b)})`);
    case 'rig_walk':return l(`BY.walk(${Pt(b)}, ${V(b,'X','0')}, ${V(b,'Z','0')})`);
    case 'rig_walkp':return l(`BY.walkToPlayer(${Pt(b)})`);
    case 'rig_anim':L.notes.add('Rig animations need Animation asset ids in Roblox, so play blocks are comments.');return l(`-- ${'make rig play '+fld(b,'ANIM')}`);
    case 'rig_say':return l(`BY.say(${Pt(b)}, ${V(b,'TEXT','""')})`);
    case 'rig_face':return l(`BY.face(${Pt(b)})`);
    case 'gui_settext':return l(`BY.setText(${V(b,'GUI','script.Parent')}, ${V(b,'TEXT','""')})`);
    case 'gui_visible':return l(`BY.setGui(${V(b,'GUI','script.Parent')}, "Visible", ${fld(b,'B')==='TRUE'?'true':'false'})`);
    case 'gui_color':return l(`BY.setGui(${V(b,'GUI','script.Parent')}, "${fld(b,'WHAT')==='text'?'TextColor3':'BackgroundColor3'}", Color3.fromHex(${luaStr(fld(b,'COLOUR')||'#ffffff')}))`);
    case 'anim_play_me':case 'anim_play_rig':L.notes.add('Brickyard keyframe animations need to be re-made in the Roblox Animation Editor, so play blocks become comments.');return l(`-- play animation ${V(b,'NAME','""')}${b.type==='anim_play_rig'?' on rig':' on the player'} (${fld(b,'MODE')})`);
    case 'anim_stop_me':case 'anim_stop_rig':return l('-- stop animation');
    case 'tool_swing':L.notes.add('The swing animation needs an Animation asset in Roblox. The hit window still works.');return l('BY.swing(BY.tool(script))');
    case 'tool_shoot':return l(`BY.shoot(BY.tool(script), Color3.fromHex(${luaStr(fld(b,'COLOUR')||'#5cc8ff')}), ${V(b,'S','120')})`);
    case 'tool_give':return l(`BY.giveTool(${luaStr(fld(b,'NAME'))})`);case 'tool_take':return l(`BY.takeTool(${luaStr(fld(b,'NAME'))})`);case 'tool_unequip':return l('BY.unequip()');
    case 'pl_damage':return l(`BY.hurt(${V(b,'N','10')})`);case 'pl_damage_other':return l(`BY.hurtPlayer(${Pt(b)}, ${V(b,'N','10')})`);case 'pl_heal':return l(`BY.heal(${V(b,'N','10')})`);
    case 'rig_damage':return l(`BY.damage(${Pt(b)}, ${V(b,'N','10')})`);case 'rig_heal':return l(`BY.healRig(${Pt(b)}, ${V(b,'N','10')})`);
    case 'pe_emit':return l(`BY.emit(${Pt(b)}, ${V(b,'N','30')})`);
    case 'pe_toggle':return l(`BY.particles(${Pt(b)}, ${fld(b,'B')==='TRUE'?'true':'false'})`);
    case 'pl_kill':return l('BY.kill()');case 'pl_teleport':return l(`BY.teleport(${Pt(b)})`);case 'pl_launch':return l(`BY.launch(${V(b,'P','80')})`);
    case 'pl_as':L.notes.add('"as player" runs its blocks for the first player only in the Roblox export; loop over Players:GetPlayers() to target others.');return l('do -- as player '+fld(D(b,'WHO')||{},'WHO'))+body(b,'DO',i)+l('end');
    case 'data_set':L.notes.add('Saved data needs DataStoreService in Roblox; the export keeps it in BY.saved for the session only.');return l(`BY.saved[tostring(${V(b,'KEY','""')})] = ${V(b,'V','0')}`);
    case 'data_change':return l(`BY.saved[tostring(${V(b,'KEY','""')})] = (BY.saved[tostring(${V(b,'KEY','""')})] or 0) + ${V(b,'N','1')}`);
    case 'data_del':return l(`BY.saved[tostring(${V(b,'KEY','""')})] = nil`);case 'data_clear':return l('BY.saved = {}');case 'data_now':return l('-- save progress now (DataStoreService)');
    case 'pl_ragdoll':case 'pl_fling':case 'pl_getup':L.notes.add('Ragdolls need a ragdoll script in Roblox (Humanoid physics state plus BallSocketConstraints).');return l('-- '+b.type.replace('pl_','')+' the player');
    case 'rig_ragdoll':case 'rig_fling':return l('-- '+b.type.replace('rig_','')+' the rig');case 'data_enable':return l('-- turn auto-save '+(fld(b,'B')==='TRUE'?'on':'off'));
    case 'pl_sethp':return l(`BY.humanoid("Health", ${V(b,'N','100')})`);
    case 'pl_maxhp':return l(`BY.humanoid("MaxHealth", ${V(b,'N','100')})`)+(fld(b,'FILL')==='TRUE'?l(`BY.humanoid("Health", ${V(b,'N','100')})`):'');
    case 'pl_tpxyz':return l(`do local p = player() local c = p and p.Character if c then c:PivotTo(CFrame.new(${V(b,'X','0')}, ${V(b,'Y','0')}, ${V(b,'Z','0')})) end end`);
    case 'pl_respawn':return l('do local p = player() if p then p:LoadCharacter() end end');
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
  const FONT={Display:'Enum.Font.FredokaOne',Body:'Enum.Font.GothamBold',Mono:'Enum.Font.Code'};const FONTTOK={Display:20,Body:25,Mono:16};
  const guiItem=n=>{const kids=(by.get(n.id)||[]).map(k=>k.cls==='Script'?(k.enabled===false?'':`<Item class="LocalScript" referent="${R()}"><Properties><string name="Name">${x(k.name)}</string><ProtectedString name="Source"><![CDATA[${luaForScript(k,true).replace(/\]\]>/g,']] >')}]]></ProtectedString></Properties></Item>`):isGuiNode(k)?guiItem(k):'').join('');
    if(n.cls==='ScreenGui')return `<Item class="ScreenGui" referent="${R()}"><Properties><string name="Name">${x(n.name)}</string><bool name="Enabled">${n.visible!==false}</bool><bool name="ResetOnSpawn">false</bool></Properties>${kids}</Item>`;
    const txt=n.cls!=='Frame'?`<string name="Text">${x(n.text||'')}</string><Color3 name="TextColor3">${c3(n.tc)}</Color3><float name="TextSize">${Math.round(num(n.ts,20))}</float><token name="Font">${FONTTOK[n.font]||25}</token><token name="TextXAlignment">${n.align==='left'?0:n.align==='right'?1:2}</token><bool name="TextWrapped">true</bool>`:'';
    const corner=num(n.radius,0)>0?`<Item class="UICorner" referent="${R()}"><Properties><UDim name="CornerRadius"><S>0</S><O>${Math.round(num(n.radius,0))}</O></UDim></Properties></Item>`:'';
    const stroke=num(n.strokeW,0)>0?`<Item class="UIStroke" referent="${R()}"><Properties><Color3 name="Color">${c3(n.stroke)}</Color3><float name="Thickness">${num(n.strokeW,1)}</float><token name="ApplyStrokeMode">1</token></Properties></Item>`:'';
    return `<Item class="${n.cls}" referent="${R()}"><Properties><string name="Name">${x(n.name)}</string><bool name="Visible">${n.visible!==false}</bool><UDim2 name="Position">${ud(n.gpos||[0,0,0,0])}</UDim2><UDim2 name="Size">${ud(n.gsize||[0,100,0,40])}</UDim2>`+
      `<Vector2 name="AnchorPoint"><X>${num((n.anchor||[0,0])[0],0)}</X><Y>${num((n.anchor||[0,0])[1],0)}</Y></Vector2><Color3 name="BackgroundColor3">${c3(n.bg)}</Color3><float name="BackgroundTransparency">${num(n.bgT,0)}</float><int name="BorderSizePixel">0</int>${txt}</Properties>${corner}${stroke}${kids}</Item>`;};
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
    S_({type:'p_rotate',message0:'rotate %1 by %2 degrees around %3',args0:[PT(),N('DEG'),{type:'field_dropdown',name:'AXIS',options:[['Y','y'],['X','x'],['Z','z']]}]},'part_blocks'),
    S_({type:'p_color',message0:'set %1 color to %2',args0:[PT(),{type:'field_colour',name:'COLOUR',colour:'#ff4d5e'}]},'part_blocks'),
    S_({type:'p_transp',message0:'set %1 transparency to %2',args0:[PT(),N('V')]},'part_blocks'),
    S_({type:'p_material',message0:'set %1 material to %2',args0:[PT(),{type:'field_dropdown',name:'MAT',options:MATERIALS.map(m=>[m,m])}]},'part_blocks'),
    S_({type:'p_collide',message0:'set %1 can collide %2',args0:[PT(),{type:'field_dropdown',name:'B',options:TFOPT}]},'part_blocks'),
    S_({type:'p_visible',message0:'set %1 visible %2',args0:[PT(),{type:'field_dropdown',name:'B',options:TFOPT}]},'part_blocks'),
    S_({type:'p_anchor',message0:'set %1 anchored %2',args0:[PT(),{type:'field_dropdown',name:'B',options:TFOPT}],tooltip:'Unanchored parts fall.'},'part_blocks'),
    S_({type:'p_deadly',message0:'set %1 deadly %2',args0:[PT(),{type:'field_dropdown',name:'B',options:TFOPT}]},'part_blocks'),
    S_({type:'p_clone',message0:'clone %1 and move it by x %2 y %3 z %4',args0:[PT(),N('X'),N('Y'),N('Z')]},'part_blocks'),
    S_({type:'p_destroy',message0:'destroy %1',args0:[PT()]},'part_blocks'),
    S_({type:'rs_copy',message0:'copy %1 from ReplicatedStorage to x %2 y %3 z %4',args0:[{type:'field_input',name:'NAME',text:'Crate'},N('X'),N('Y'),N('Z')],tooltip:'Makes a copy of an item stored in ReplicatedStorage and puts it in the world. Scripts inside the copy start running.'},'storage_blocks'),
    S_({type:'rs_onto',message0:'copy %1 from ReplicatedStorage onto %2',args0:[{type:'field_input',name:'NAME',text:'Crate'},PT()]},'storage_blocks'),
    V_({type:'rs_last',message0:'last copied item',tooltip:'The most recent copy made from ReplicatedStorage. Use it with Parts blocks.'},'Part','storage_blocks'),
    S_({type:'rig_walk',message0:'make %1 walk to x %2 z %3',args0:[PT(),N('X'),N('Z')],tooltip:'The rig walks there, following the ground. The script waits until it arrives.'},'rig_blocks'),
    S_({type:'rig_walkp',message0:'make %1 walk to the player',args0:[PT()]},'rig_blocks'),
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
    S_({type:'pl_damage_other',message0:'damage player %1 by %2',args0:[PT(),N('N')],tooltip:'Hurts another player in an online game, for example the "hit part" of a sword.'},'player_blocks'),
    S_({type:'pl_damage',message0:'damage the player by %1',args0:[N('N')]},'player_blocks'),
    S_({type:'pl_heal',message0:'heal the player by %1',args0:[N('N')]},'player_blocks'),
    V_({type:'s_health',message0:'player health'},'Number','sense_blocks'),
    S_({type:'rig_damage',message0:'damage %1 by %2',args0:[PT(),N('N')]},'rig_blocks'),
    S_({type:'rig_heal',message0:'heal %1 by %2',args0:[PT(),N('N')]},'rig_blocks'),
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
    V_({type:'pl_ref',message0:'%1',args0:[{type:'field_dropdown',name:'WHO',options:[['everyone','all'],['everyone else','others'],['me','me'],['a random other player','random'],['the nearest other player','nearest']]}]},'Player','player_blocks'),
    V_({type:'s_touch_player',message0:'touching player %1 ?',args0:[{type:'input_value',name:'WHO',check:['Player','Part']}],tooltip:'True while your character is bumping into one of these players. Leave it as "everyone else" to check for any player.'},'Boolean','player_blocks'),
    V_({type:'pl_ref_touchme',message0:'players touching me'},'Player','player_blocks'),
    V_({type:'pl_touched',message0:'touched player'},'Player','player_blocks'),
    H_({type:'ev_touch_player',message0:'when I touch another player',tooltip:'Runs once each time your character bumps into another player. Use "touched player" inside to know who. Great for tag games.'}),
    V_({type:'pl_ref_touch',message0:'players touching %1',args0:[PT()]},'Player','player_blocks'),
    V_({type:'pl_ref_named',message0:'player named %1',args0:[{type:'input_value',name:'NAME'}]},'Player','player_blocks'),
    V_({type:'s_pl_nameof',message0:'name of %1',args0:[{type:'input_value',name:'WHO',check:['Player','Part']}]},'String','player_blocks'),
    V_({type:'s_pl_hpof',message0:'health of %1',args0:[{type:'input_value',name:'WHO',check:['Player','Part']}]},'Number','player_blocks'),
    V_({type:'s_pl_countof',message0:'number of %1',args0:[{type:'input_value',name:'WHO',check:['Player','Part']}]},'Number','player_blocks'),
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
    V_({type:'data_has',message0:'has saved %1 ?',args0:[{type:'input_value',name:'KEY'}]},'Boolean','data_blocks'),
    V_({type:'data_loaded',message0:'save data loaded?'},'Boolean','data_blocks'),
    V_({type:'data_returning',message0:'returning player?',tooltip:'True if this player had saved progress from an earlier visit.'},'Boolean','data_blocks'),
    H_({type:'ev_land',message0:'when I land',tooltip:'Runs when the player lands after a jump or a fall.'}),
    H_({type:'ev_hurt',message0:'when I take damage',tooltip:'Runs each time the player loses health.'}),
    V_({type:'s_pl_name',message0:'player name'},'String','player_blocks'),
    V_({type:'s_pl_maxhp',message0:'max health'},'Number','player_blocks'),
    V_({type:'s_pl_speed',message0:'walk speed'},'Number','player_blocks'),
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
    S_({type:'g_sound',message0:'play sound %1',args0:[{type:'field_dropdown',name:'SND',options:[['coin','coin'],['jump','jump'],['boing','pad'],['checkpoint','check'],['victory','win'],['whoosh','boost'],['click','click'],['boom','explode'],['oof','die']]}]},'game_blocks'),
    S_({type:'g_sky',message0:'set sky color to %1',args0:[{type:'field_colour',name:'COLOUR',colour:'#1a1f3d'}]},'game_blocks'),
    S_({type:'g_reset_timer',message0:'reset timer'},'game_blocks'),
    V_({type:'s_mouse_down',message0:'mouse down?',tooltip:'True while the player holds the left mouse button (or a finger) on the game.'},'Boolean','sense_blocks'),
    V_({type:'s_mouse_part',message0:'part under mouse',tooltip:'The part the mouse is pointing at, or nothing.'},'Part','sense_blocks'),
    V_({type:'s_mouse_xy',message0:'mouse %1',args0:[{type:'field_dropdown',name:'AXIS',options:[['x','x'],['y','y']]}],tooltip:'Mouse position like Scratch: x from -240 to 240, y from -180 to 180, with 0, 0 in the middle.'},'Number','sense_blocks'),
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
      K('p_move',xyz(0,1,0)),K('p_setpos',xyz(0,10,0)),K('p_rotate',{PART:me(),DEG:n_(15)}),K('p_color',{PART:me()}),K('p_transp',{PART:me(),V:n_(.5)}),K('p_material',{PART:me()}),
      K('p_collide',{PART:me()},{B:'FALSE'}),K('p_visible',{PART:me()},{B:'FALSE'}),K('p_anchor',{PART:me()},{B:'FALSE'}),K('p_deadly',{PART:me()}),K('p_clone',xyz(0,5,0)),K('p_destroy',{PART:me()})]},
    {kind:'category',name:'Player',categorystyle:'player',contents:[K('pl_kill'),K('pl_damage',{N:n_(20)}),K('pl_heal',{N:n_(20)}),K('pl_teleport',{PART:{shadow:{type:'p_this'},block:{type:'p_named',fields:{NAME:'Part'}}}}),K('pl_launch',{P:n_(90)}),
      K('pl_speed',{V:n_(24)}),K('pl_jump',{V:n_(70)}),K('pl_gravity',{V:n_(100)}),K('pl_checkpoint',{PART:me()}),
      K('pl_as',{WHO:{shadow:{type:'pl_ref',fields:{WHO:'others'}}},DO:{block:{type:'pl_freeze',fields:{B:'TRUE'},next:{block:{type:'c_wait',inputs:{S:n_(3)},next:{block:{type:'pl_freeze',fields:{B:'FALSE'}}}}}}}}),
      K('pl_as',{WHO:{block:{type:'tool_hitpart'}},DO:{block:{type:'pl_launch',inputs:{P:n_(90)}}}}),
      K('s_touch_player',{WHO:{shadow:{type:'pl_ref',fields:{WHO:'others'}}}}),K('ev_touch_player'),
      K('pl_as',{WHO:{block:{type:'pl_touched'}},DO:{block:{type:'pl_say',inputs:{TEXT:t_("You're it!"),S:n_(2)}}}}),
      K('pl_touched'),K('pl_ref_touchme'),K('pl_ref',null,{WHO:'others'}),K('pl_ref_touch',{PART:me()}),K('pl_ref_named',{NAME:t_('Player1')}),
      K('s_pl_nameof',{WHO:{shadow:{type:'pl_ref',fields:{WHO:'nearest'}}}}),K('s_pl_hpof',{WHO:{shadow:{type:'pl_ref',fields:{WHO:'nearest'}}}}),K('s_pl_countof',{WHO:{shadow:{type:'pl_ref',fields:{WHO:'others'}}}}),
      K('pl_ragdoll',{S:n_(3)}),K('pl_fling',{P:n_(80)}),K('pl_getup'),K('s_pl_ragdoll'),
      K('ev_spawn'),K('ev_jump'),K('ev_land'),K('ev_hurt'),
      K('pl_sethp',{N:n_(100)}),K('pl_maxhp',{N:n_(200)}),K('pl_tpxyz',{X:n_(0),Y:n_(20),Z:n_(0)}),K('pl_respawn'),K('pl_freeze',null,{B:'TRUE'}),K('pl_visible',null,{B:'FALSE'}),
      K('pl_shirt'),K('pl_say',{TEXT:t_('Hello!'),S:n_(3)}),K('pl_shield',{S:n_(5)}),K('pl_airjumps',{N:n_(1)}),K('pl_face',{PART:{shadow:{type:'p_this'},block:{type:'p_named',fields:{NAME:'Part'}}}}),K('pl_camera',{N:n_(30)}),
      K('s_pl_name'),K('s_health'),K('s_pl_maxhp'),K('s_pl_speed'),K('s_pl_moving'),K('s_pl_alive'),K('s_pl_shield'),K('s_pl_tool'),K('s_grounded'),K('s_player')]},
    {kind:'category',name:'Saving',categorystyle:'data',contents:[K('ev_data_loaded'),K('data_set',{KEY:t_('level'),V:n_(1)}),K('data_change',{KEY:t_('gems'),N:n_(1)}),K('data_get',{KEY:t_('level')}),K('data_has',{KEY:t_('level')}),
      K('data_returning'),K('data_loaded'),K('data_now'),K('data_enable',null,{B:'FALSE'}),K('data_del',{KEY:t_('level')}),K('data_clear'),
      K('ev_data_loaded',null,null,{next:{block:{type:'controls_if',inputs:{IF0:{block:{type:'data_returning'}},DO0:{block:{type:'g_msg',inputs:{TEXT:t_('Welcome back!'),S:n_(3)}}}}}}})]},
    {kind:'category',name:'Animation',categorystyle:'anim',contents:[K('ev_spawn'),K('ev_jump'),K('anim_play_me',{NAME:t_('Wave')},{MODE:'once'}),K('anim_play_rig',{NAME:t_('Dance'),PART:me()},{MODE:'loop'}),
      K('anim_stop_me'),K('anim_stop_rig',{PART:me()}),K('s_anim_playing')]},
    {kind:'category',name:'GUI',categorystyle:'gui',contents:[K('ev_gui_click'),K('gui_this'),K('gui_named'),
      K('gui_settext',{GUI:{shadow:{type:'gui_this'},block:{type:'gui_named',fields:{NAME:'Label'}}},TEXT:t_('Hello!')}),
      K('gui_visible',{GUI:{shadow:{type:'gui_this'}}},{B:'FALSE'}),K('gui_color',{GUI:{shadow:{type:'gui_this'}}}),K('s_gui_text',{GUI:{shadow:{type:'gui_this'}}})]},
    {kind:'category',name:'Tools',categorystyle:'tools',contents:[K('ev_tool_act'),K('ev_tool_equip'),K('ev_tool_unequip'),K('ev_tool_hit'),K('tool_hitpart'),
      K('s_isrig',{PART:{shadow:{type:'p_this'},block:{type:'tool_hitpart'}}}),K('s_isplayer',{PART:{shadow:{type:'p_this'},block:{type:'tool_hitpart'}}}),K('pl_damage_other',{PART:{shadow:{type:'p_this'},block:{type:'tool_hitpart'}},N:n_(20)}),K('tool_swing'),K('tool_shoot',{S:n_(120)}),K('tool_give'),K('tool_take'),K('tool_unequip'),K('s_has_tool')]},
    {kind:'category',name:'Rigs',categorystyle:'rigs',contents:[K('ev_rig_died'),K('rig_damage',{PART:me(),N:n_(25)}),K('rig_heal',{PART:me(),N:n_(25)}),K('s_rig_health',{PART:me()}),K('rig_walk',{PART:me(),X:n_(0),Z:n_(10)}),K('rig_walkp',{PART:me()}),K('rig_anim',{PART:me()}),
      K('rig_say',{PART:me(),TEXT:t_('Hello!'),S:n_(3)}),K('rig_ragdoll',{PART:me(),S:n_(3)}),K('rig_fling',{PART:me(),P:n_(80)}),K('rig_face',{PART:me()})]},
    {kind:'category',name:'Effects',categorystyle:'fx',contents:[K('pe_emit',{N:n_(30),PART:me()}),K('pe_toggle',{PART:me()})]},
    {kind:'category',name:'Storage',categorystyle:'storage',contents:[{kind:'label',text:'ReplicatedStorage'},K('rs_copy',{X:n_(0),Y:n_(20),Z:n_(0)}),K('rs_onto',{PART:me()}),K('rs_last')]},
    {kind:'category',name:'Game',categorystyle:'game',contents:[K('g_msg',{TEXT:t_('Hello!'),S:n_(2)}),K('g_print',{TEXT:t_('Hello from my script')}),K('g_stat_change',{N:n_(1)}),K('g_stat_set',{N:n_(0)}),
      K('g_win'),K('g_sound'),K('g_sky'),K('g_reset_timer')]},
    {kind:'category',name:'Sensing',categorystyle:'sensing',contents:[K('s_health'),K('s_players'),K('s_touching',{PART:me()}),K('s_key'),K('s_mouse_down'),K('s_mouse_part'),K('s_mouse_xy'),K('s_grounded'),K('s_distance',{PART:me()}),K('s_player'),K('s_prop',{PART:me()}),K('s_timer'),K('s_stat')]},
    {kind:'category',name:'Operators',categorystyle:'ops',contents:[K('math_number'),K('math_arithmetic',{A:n_(1),B:n_(1)}),K('math_random_int',{FROM:n_(1),TO:n_(10)}),
      K('logic_compare',{A:n_(0),B:n_(0)}),K('logic_operation'),K('logic_negate'),K('logic_boolean'),K('text'),K('text_join',{ADD0:t_('Score: ')})]},
    {kind:'category',name:'Variables',categorystyle:'variables',custom:'VARIABLE'}
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
function renderCards(){
  const grid=$('#grid');grid.innerHTML='';const bests=store.get('bests',{});
  GAMES.forEach(gm=>{const b=document.createElement('button');b.type='button';b.className='card';
    const bv=bests[gm.id];let best='';
    if(gm.id==='arena')best='Online PvP';
    else if(gm.mode==='race')best=bv!=null?`Best <b>${fmt(bv)}</b>`:'No time yet';
    else if(gm.mode==='coins')best=bv?`Best <b>${bv.coins}</b> coins`:'No score yet';
    else{const n=(store.get('build',null)||[]).length;best=n?`<b>${n}</b> blocks saved`:'Fresh baseplate';}
    b.innerHTML=`<canvas aria-hidden="true"></canvas><div class="body"><span class="tag">${gm.tag}</span><h3>${gm.name}</h3><p>${gm.desc}</p><div class="meta"><span class="best">${best}</span><span class="playpill">Play</span></div></div>`;
    THUMBS[gm.id](b.querySelector('canvas'));
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
function renderSwatches(){const w=$('#swatches');w.innerHTML='';SHIRTS.forEach(c=>{const b=document.createElement('button');b.type='button';b.className='sw';b.style.background=c;
  b.setAttribute('aria-label','Shirt '+c);b.setAttribute('aria-pressed',c===shirt);b.onclick=()=>{shirt=c;store.set('shirt',c);renderSwatches();};w.appendChild(b);});}
renderToolbox();renderSwatches();renderCards();
loop();
initMP();
bootShared();
window.__by={makeRag,ragStep,SB,SAVE,findAnim,playAnim,BD,openAnim,AE,ACC,renderGuiEditor,showAccountModal,MP,arenaDef,packProject,unpackProject,standaloneHtml,get SHARED(){return SHARED},IDB,MESHCACHE,uploadMesh,finalizeMesh,get ecam(){return ecam},get tc(){return tc},cam,ED,W,RT,P,state:()=>state,startGame,openStudio,newProjectObj,saveProject,insert,select,doAct,openScript,playtest,stopGame,exportRbxlx,luaForScript,parseRbxlx,listProjects,GAMES,projectDef,running:()=>running};
})();
