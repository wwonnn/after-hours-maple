(() => {
'use strict';
const $=id=>document.getElementById(id), canvas=$('scene'), ctx=canvas.getContext('2d',{alpha:false});
const TAU=Math.PI*2, clamp=(v,a,b)=>Math.max(a,Math.min(b,v)), lerp=(a,b,t)=>a+(b-a)*t;
let seed=74021;function rnd(){seed=(seed*1664525+1013904223)>>>0;return seed/4294967296;}const rand=(a,b)=>a+rnd()*(b-a);
const reduced=matchMedia('(prefers-reduced-motion: reduce)').matches;
let W=innerWidth,H=innerHeight,DPR=1,time=0,last=0,paused=false,uiTimer=0,toastTimer;
let state='unlit',burn=0,ashLength=0,heat=0,pull=0,inhaleTime=0,inhaleHeld=false,inhaleCapped=false,lightTime=0,snuffTime=0,handIn=1;
let breathState='idle',mouth=0,exhaleHeld=false,pendingInhale=false,purgeRate=0,exhaleFlow=0,exhaleAge=0,force=.45;
let tapTime=-1,tapQueue=0,ashPose=0,emberFlash=0,crush=0,disposed=false;
let trayAsh=[],butts=[],tipHistory=[],residualSmoke=0,lastButt=null;
const TYPES={1:{width:.65,band:'#c6d9c9',label:'SLIM'},3:{width:.85,band:'#c7b786',label:'REGULAR'},5:{width:1.05,band:'#a98b64',label:'WIDE'}};
let cigaretteType=3;
const INHALE_SAMPLE='__INHALE_AUDIO_BASE64__';
let smoke=[],debris=[],tip={x:0,y:0},mouse={x:0,y:0},look={x:0,y:0},wind=.15,density=.75,rainVolume=.55;
const bars=Array.from({length:35},()=>{const b=document.createElement('i');$('breathTrack').append(b);return b;});
const bokeh=Array.from({length:65},()=>({x:rnd(),y:rand(.2,.75),r:rand(3,20),a:rand(.08,.35),warm:rnd()>.63,phase:rand(0,TAU)}));
const drops=Array.from({length:110},()=>({x:rnd(),y:rnd(),s:rand(.035,.18),len:rand(8,50),a:rand(.025,.11)}));
const buildings=Array.from({length:20},(_,i)=>({x:i/19,w:rand(.035,.08),h:rand(.13,.5),lights:Array.from({length:22},()=>({x:rnd(),y:rnd(),a:rand(.02,.17)}))}));
const paperMarks=Array.from({length:1100},()=>({x:rand(-10,10),y:rand(-252,-65),a:rand(.03,.14),l:rand(.3,1.4)}));
const corkMarks=Array.from({length:430},()=>({x:rand(-10,10),y:rand(-66,0),a:rand(.12,.4),l:rand(.5,2.5)}));
const ashMarks=Array.from({length:260},()=>({x:rand(-10,10),y:rnd(),a:rnd(),r:rand(.3,1.8)}));
const grain=document.createElement('canvas');grain.width=grain.height=160;
{const c=grain.getContext('2d'),img=c.createImageData(160,160);for(let i=0;i<img.data.length;i+=4){const v=rnd()> .5?255:0;img.data[i]=img.data[i+1]=img.data[i+2]=v;img.data[i+3]=rnd()*15;}c.putImageData(img,0,0);}
const smokeTexture=document.createElement('canvas');smokeTexture.width=smokeTexture.height=128;
{const c=smokeTexture.getContext('2d');for(let i=0;i<32;i++){const x=64+rand(-27,27),y=64+rand(-27,27),r=rand(14,34);const g=c.createRadialGradient(x,y,0,x,y,r);g.addColorStop(0,'rgba(178,195,193,.075)');g.addColorStop(.35,'rgba(156,179,176,.04)');g.addColorStop(1,'rgba(145,164,164,0)');c.fillStyle=g;c.fillRect(0,0,128,128);}}
let audio=null,soundWanted=true;
function createAudio(){if(audio)return;const AC=window.AudioContext||window.webkitAudioContext;if(!AC)return;try{
 const ac=new AC(),master=ac.createGain();master.gain.value=soundWanted?.7:0;master.connect(ac.destination);
 const buffer=ac.createBuffer(1,ac.sampleRate*4,ac.sampleRate),data=buffer.getChannelData(0);let prev=0;for(let i=0;i<data.length;i++){prev=(prev+Math.random()*.04-.02)/1.025;data[i]=prev*6;}
 const noise=ac.createBufferSource();noise.buffer=buffer;noise.loop=true;
 const rain=ac.createBiquadFilter();rain.type='lowpass';rain.frequency.value=1700;const rainGain=ac.createGain();rainGain.gain.value=rainVolume*.15;noise.connect(rain);rain.connect(rainGain);rainGain.connect(master);
 const breath=ac.createBiquadFilter();breath.type='bandpass';breath.frequency.value=600;breath.Q.value=.7;const breathGain=ac.createGain();breathGain.gain.value=0;noise.connect(breath);breath.connect(breathGain);breathGain.connect(master);
 const white=ac.createBuffer(1,ac.sampleRate,ac.sampleRate),wd=white.getChannelData(0);for(let i=0;i<wd.length;i++)wd[i]=Math.random()*2-1;
 noise.start();audio={ac,master,noise,buffer,white,rainGain,breath,breathGain,on:soundWanted,inhaleBuffer:null,voices:[],nextGrain:0,firstGrain:true};
 const bytes=Uint8Array.from(atob(INHALE_SAMPLE),c=>c.charCodeAt(0));
 $('inhale').dataset.sampleStatus='loading';
 ac.decodeAudioData(bytes.buffer).then(decoded=>{audio.inhaleBuffer=decoded;$('inhale').dataset.sampleStatus='ready';$('inhale').dataset.sampleDuration=String(decoded.duration);}).catch(()=>{$('inhale').dataset.sampleStatus='error';toast('흡입 녹음을 읽지 못했습니다. 페이지를 다시 열어 주세요');});
 refreshSoundButton();
 }catch(e){console.warn('Audio unavailable',e);}}
function refreshSoundButton(){const on=!!audio&&audio.on;$('sound').setAttribute('aria-pressed',String(on));$('sound').setAttribute('aria-label',on?'소리 끄기':'소리 켜기');$('sound').title=(on?'소리 끄기':'소리 켜기')+' · M';$('soundWaves').setAttribute('d',on?'M16 8c3 2 3 6 0 8m3-11c5 4 5 10 0 14':'m16 9 5 6m0-6-5 6');}
function setSound(){const wasOn=!!audio&&audio.on;createAudio();if(!audio){toast('이 브라우저에서는 소리를 지원하지 않습니다');return;}soundWanted=audio.on=!wasOn;if(!paused)audio.ac.resume().catch(()=>{});audio.master.gain.setTargetAtTime(audio.on?.7:0,audio.ac.currentTime,.08);if(!audio.on)stopInhaleAudio();refreshSoundButton();}
function noiseHit(delay,duration,frequency,volume,white=false){
 if(!audio||!audio.on)return;const a=audio.ac,t=a.currentTime+delay,source=a.createBufferSource(),filter=a.createBiquadFilter(),gain=a.createGain();source.buffer=white?audio.white:audio.buffer;filter.type='bandpass';filter.frequency.value=frequency;filter.Q.value=.8;source.connect(filter);filter.connect(gain);gain.connect(audio.master);gain.gain.setValueAtTime(.0001,t);gain.gain.linearRampToValueAtTime(volume,t+.006);gain.gain.exponentialRampToValueAtTime(.0001,t+duration);source.start(t,0,duration);source.onended=()=>{source.disconnect();filter.disconnect();gain.disconnect();};
}
function metalHit(delay,freq,volume,duration){if(!audio||!audio.on)return;const a=audio.ac,t=a.currentTime+delay,o=a.createOscillator(),g=a.createGain();o.type='triangle';o.frequency.setValueAtTime(freq,t);o.frequency.exponentialRampToValueAtTime(freq*.7,t+duration);g.gain.setValueAtTime(volume,t);g.gain.exponentialRampToValueAtTime(.0001,t+duration);o.connect(g);g.connect(audio.master);o.start(t);o.stop(t+duration);o.onended=()=>{o.disconnect();g.disconnect();};}
function sfx(kind){
 if(kind==='lid'){noiseHit(0,.075,3100,.30,true);metalHit(.008,2300,.10,.10);metalHit(.025,3400,.035,.08);}
 else if(kind==='spark'){noiseHit(0,.12,3800,.25,true);noiseHit(.035,.07,5400,.20,true);noiseHit(.09,.35,1300,.23);}
 else if(kind==='close'){metalHit(0,1800,.085,.06);noiseHit(0,.045,2600,.15,true);}
 else if(kind==='ash'){noiseHit(0,.045,700,.14);metalHit(.002,240,.03,.04);}
 else if(kind==='snuff'){noiseHit(0,.33,1050,.26);noiseHit(.16,.2,1700,.10,true);}
 else if(kind==='ember'){noiseHit(0,.03,3200,.027,true);}
}
function stopInhaleAudio(){if(!audio)return;const t=audio.ac.currentTime;for(const v of audio.voices){v.gain.gain.cancelScheduledValues(t);v.gain.gain.setValueAtTime(Math.max(.0001,v.gain.gain.value),t);v.gain.gain.exponentialRampToValueAtTime(.0001,t+.045);try{v.source.stop(t+.05);}catch{}}audio.voices=[];audio.nextGrain=0;audio.firstGrain=true;}
function updateInhaleAudio(){
 if(!audio||!audio.on||!audio.inhaleBuffer||breathState!=='inhaling')return;
 const a=audio.ac,t=a.currentTime;if(t<audio.nextGrain)return;
 const source=a.createBufferSource(),gain=a.createGain(),length=audio.firstGrain?.83:.72;
 source.buffer=audio.inhaleBuffer;source.playbackRate.value=1;
 const offset=audio.firstGrain?.035:.53+Math.random()*.43;
 source.connect(gain);gain.connect(audio.master);gain.gain.setValueAtTime(.0001,t);gain.gain.linearRampToValueAtTime(.9,t+.075);gain.gain.setValueAtTime(.9,t+length-.15);gain.gain.linearRampToValueAtTime(.0001,t+length);
 source.start(t,Math.min(offset,Math.max(0,source.buffer.duration-length)),length);audio.nextGrain=t+length-.15;audio.firstGrain=false;
 const voice={source,gain};audio.voices.push(voice);source.onended=()=>{source.disconnect();gain.disconnect();const i=audio.voices.indexOf(voice);if(i>=0)audio.voices.splice(i,1);};
}
function toast(message){$('toast').textContent=message;$('toast').classList.add('show');clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('toast').classList.remove('show'),2500);}
function updateButtons(){
 const lit=state==='lit';$('inhale').disabled=!lit||tapTime>=0;$('exhale').disabled=mouth<=.001||breathState==='purging';$('ash').disabled=!lit||breathState==='inhaling'||breathState==='purging';$('snuff').disabled=!lit;
 $('light').disabled=state==='lighting'||lit||state==='snuffing';$('lightText').textContent=state==='out'?'새로 시작':state==='lighting'?'점화 중':lit?'불 붙음':'불 붙이기';$('light').classList.toggle('primary',state==='unlit'||state==='out');$('inhale').classList.toggle('primary',lit);$('inhale').classList.toggle('active',breathState==='inhaling');$('exhale').classList.toggle('active',breathState==='exhaling'||breathState==='purging');$('status').classList.toggle('lit',lit);
 for(const id of [1,3,5]){$('type'+id).setAttribute('aria-pressed',String(cigaretteType===id));$('type'+id).disabled=state==='snuffing';}
}
function trayGeometry(){return{x:W*(W<600?.27:.35),y:H*(W<600?.725:.827),r:Math.min(W*.115,125)};}
function depositButt(){if(disposed||burn<.1)return;const b={u:rand(-.5,.5),v:rand(-.09,.09),angle:rand(-.35,.35),type:cigaretteType,length:clamp((252-burn)/4,21,55),crushed:true};butts.push(b);if(butts.length>18)butts.shift();lastButt=b;disposed=true;}
function reset(){
 if((state==='lit'||state==='out'||state==='snuffing')&&!disposed){depositButt();}
 stopInhaleAudio();state='unlit';breathState='idle';burn=ashLength=heat=pull=inhaleTime=mouth=lightTime=snuffTime=ashPose=emberFlash=crush=exhaleFlow=0;inhaleHeld=inhaleCapped=exhaleHeld=pendingInhale=disposed=false;tapTime=-1;tapQueue=0;tipHistory=[];handIn=0;
 $('hint').style.opacity='1';$('hint').textContent='불을 붙인 뒤, 흡입과 내쉬기를 따로 조작하세요';updateButtons();updateUI();
}
function selectType(value){if(state==='snuffing')return;reset();cigaretteType=value;updateButtons();toast(value+'mg · '+TYPES[value].label+' 담배를 꺼냈습니다');}
function light(){if(state==='out')reset();if(state!=='unlit'||paused)return;createAudio();if(audio&&!paused)audio.ac.resume().catch(()=>{});state='lighting';lightTime=0;sfx('lid');$('hint').style.opacity='0';updateButtons();}
function beginDraw(){breathState='inhaling';inhaleTime=0;pendingInhale=false;exhaleFlow=0;stopInhaleAudio();updateButtons();}
function startInhale(){
 if(state!=='lit'||inhaleHeld||paused||tapTime>=0)return;
 inhaleHeld=true;inhaleCapped=false;exhaleHeld=false;stopInhaleAudio();$('hint').style.opacity='0';
 if(mouth>.001){breathState='purging';purgeRate=mouth/.38;pendingInhale=true;exhaleAge=0;}
 else beginDraw();updateButtons();
}
function endInhale(){inhaleHeld=false;pendingInhale=false;if(breathState==='inhaling'){stopInhaleAudio();breathState=mouth>.001?'holding':'idle';}inhaleTime=0;updateButtons();}
function startExhale(){if(paused||mouth<=.001||breathState==='purging')return;endInhale();exhaleHeld=true;breathState='exhaling';exhaleAge=0;updateButtons();}
function endExhale(){exhaleHeld=false;if(breathState==='exhaling')breathState=mouth>.001?'holding':'idle';exhaleFlow=0;updateButtons();}
function ash(){if(state!=='lit'||breathState==='inhaling'||breathState==='purging')return;if(tapTime>=0){tapQueue=Math.min(tapQueue+1,2);return;}tapTime=0;updateButtons();}
function dropAsh(fraction=.65,overTray=false){
 const amount=ashLength*fraction;if(amount<.15)return;const tray=trayGeometry(),t=cigaretteTransform();updateTip(t);
 for(let i=0;i<Math.min(48,Math.ceil(amount*2.8));i++){const chunky=i<Math.min(3,amount/2);debris.push({x:tip.x+rand(-4,4),y:tip.y,vx:rand(-13,13),vy:rand(18,48),r:chunky?rand(2.6,4.8):rand(.6,1.6),rot:rand(0,TAU),life:2.5,hot:rnd()>.93,overTray,landingY:overTray?tray.y:Math.max(tray.y,H*.87)});}
 ashLength=Math.max(0,ashLength-amount);emberFlash=.8;
}
function snuff(){if(state!=='lit')return;endInhale();tapTime=-1;tapQueue=0;ashPose=0;state='snuffing';snuffTime=0;crush=0;updateButtons();}
function updateUI(){
 const pct=Math.max(0,Math.round((1-burn/165)*100));$('remaining').textContent=pct+'%';$('remainingBar').style.width=pct+'%';
 const breathText=breathState==='purging'?'남은 연기 먼저 내보내기':breathState==='inhaling'?'천천히 들이마시는 중':breathState==='exhaling'?'연기를 내쉬는 중':mouth>.001?'입에 연기를 머금는 중':null;
 $('status').textContent=state==='snuffing'?'눌러 비벼 끄는 중':tapTime>=0?'재떨이 위에서 톡톡 터는 중':breathText||(state==='unlit'?'불을 붙여 주세요':state==='lighting'?'불씨를 옮기는 중':state==='out'?'재떨이에 내려놓았습니다':'천천히 타들어 가는 중');
 $('breathLabel').textContent=mouth>.001||breathState==='inhaling'?(breathState==='holding'?'머금기':breathState==='purging'?'짧게 내보내기':breathState==='inhaling'?'들이마시기':'내쉬기')+' · '+Math.round(mouth*100)+'%':state==='lit'?'흡입 Space · 내쉬기 E':'';
 $('mouthBar').style.width=(mouth*100)+'%';$('mouthMeter').setAttribute('aria-valuenow',String(Math.round(mouth*100)));
 const amount=breathState==='inhaling'?clamp(inhaleTime/2,0,1):breathState==='exhaling'||breathState==='purging'?clamp(exhaleFlow*2,0,1):0;
 bars.forEach((bar,i)=>{const level=Math.sin(i/34*Math.PI);bar.style.height=(3+level*amount*23*(.8+Math.sin(time*8+i*.5)*.2))+'px';bar.style.opacity=String(.15+amount*.7);});updateButtons();
}
function resize(){W=innerWidth;H=innerHeight;DPR=Math.min(devicePixelRatio||1,1.75);canvas.width=Math.round(W*DPR);canvas.height=Math.round(H*DPR);ctx.setTransform(DPR,0,0,DPR,0,0);smoke=[];debris=[];}
addEventListener('resize',resize);resize();
function ellipse(x,y,rx,ry,color){ctx.fillStyle=color;ctx.beginPath();ctx.ellipse(x,y,rx,ry,0,0,TAU);ctx.fill();}
function glow(x,y,r,color){const g=ctx.createRadialGradient(x,y,0,x,y,r);g.addColorStop(0,color);g.addColorStop(1,'transparent');ctx.fillStyle=g;ctx.fillRect(x-r,y-r,r*2,r*2);}
function background(){
 const g=ctx.createLinearGradient(0,0,W,H);g.addColorStop(0,'#101b21');g.addColorStop(.48,'#18282a');g.addColorStop(1,'#0b171a');ctx.fillStyle=g;ctx.fillRect(0,0,W,H);
 ctx.save();ctx.translate(look.x*5,look.y*3);
 glow(W*.63,H*.27,W*.45,'#32433b60');glow(W*.91,H*.4,W*.25,'#64706024');
 buildings.forEach(b=>{ctx.fillStyle='#0c191d';const x=b.x*W,y=H*(.8-b.h);ctx.fillRect(x,y,b.w*W,b.h*H);b.lights.forEach(l=>{ctx.fillStyle=`rgba(160,184,152,${l.a})`;ctx.fillRect(x+l.x*b.w*W,y+l.y*b.h*H,2+W*.002,4);});});
 ctx.save();ctx.filter='blur(7px)';for(const b of bokeh){const flicker=1+Math.sin(time*.4+b.phase)*.05;glow(b.x*W,b.y*H,b.r*(W<600?.65:1.1),b.warm?`rgba(223,171,96,${b.a*flicker})`:`rgba(146,182,171,${b.a*flicker})`);}ctx.restore();
 ctx.fillStyle='#111e2075';ctx.fillRect(0,0,W,H);
 // Rain is behind the window frame, with a few brighter trails on the glass.
 ctx.lineWidth=.75;for(const d of drops){const x=d.x*W,y=((d.y+time*d.s*(reduced?.07:.32))%1)*H;ctx.strokeStyle=`rgba(168,190,181,${d.a})`;ctx.beginPath();ctx.moveTo(x,y);ctx.lineTo(x-d.len*.15,y+d.len);ctx.stroke();}
 ctx.fillStyle='#080f13';ctx.fillRect(W*.78,0,11,H*.785);ctx.fillStyle='#65746a18';ctx.fillRect(W*.78+11,0,2,H*.785);ctx.fillStyle='#0b1215';ctx.fillRect(0,H*.765,W,11);ctx.fillStyle='#8b8d6b20';ctx.fillRect(0,H*.765,W,1);
 ctx.restore();
 const desk=ctx.createLinearGradient(0,H*.78,0,H);desk.addColorStop(0,'#27312c');desk.addColorStop(.04,'#202923');desk.addColorStop(.1,'#18211d');desk.addColorStop(1,'#0b1413');ctx.fillStyle=desk;ctx.fillRect(0,H*.78,W,H*.22);
 ctx.strokeStyle='#aaa38907';ctx.lineWidth=1;for(let i=0;i<25;i++){const y=H*.79+i*i*.3;ctx.beginPath();ctx.moveTo(0,y);ctx.bezierCurveTo(W*.3,y-4,W*.6,y+4,W,y-1);ctx.stroke();}
 // Glass ashtray, concentric reflections and shallow perspective.
 const tray=trayGeometry(),ax=tray.x,ay=tray.y,ar=tray.r;
 ellipse(ax+8,ay+18,ar*1.2,ar*.29,'#0006');ellipse(ax,ay+7,ar,ar*.3,'#59645b23');
 for(let i=0;i<5;i++){ctx.lineWidth=i===0?3:1;ctx.strokeStyle=['#b3b8a352','#d4d7bd19','#0009','#a6b2a340','#87998835'][i];ctx.beginPath();ctx.ellipse(ax,ay+i*1.3,ar-i*5,ar*.3-i*1.7,0,0,TAU);ctx.stroke();}
 ellipse(ax,ay+3,ar*.76,ar*.18,'#0a121679');ctx.strokeStyle='#d3d1a95c';ctx.lineWidth=2;ctx.beginPath();ctx.ellipse(ax,ay,ar,ar*.3,0,Math.PI*1.05,Math.PI*1.53);ctx.stroke();
 for(const p of trayAsh){ctx.save();ctx.translate(ax+p.u*ar,ay+p.v*ar);ctx.rotate(p.rot);ctx.fillStyle=p.color;ctx.fillRect(-p.r,-p.r*.4,p.r*2,p.r*.8);ctx.restore();}
 for(const b of butts){ctx.save();ctx.translate(ax+b.u*ar,ay+b.v*ar);ctx.rotate(b.angle);const s=Math.min(1,ar/75),radius=2.7*TYPES[b.type].width;ctx.scale(s,s);ctx.fillStyle='#9c7b48';ctx.fillRect(0,-radius,17,radius*2);ctx.fillStyle=TYPES[b.type].band;ctx.fillRect(15,-radius,2,radius*2);const paper=ctx.createLinearGradient(0,-radius,0,radius);paper.addColorStop(0,'#b0b6a1');paper.addColorStop(1,'#626c5e');ctx.fillStyle=paper;ctx.fillRect(17,-radius,b.length-17,radius*2);path('#323a31',c=>{c.moveTo(b.length-4,-radius);c.lineTo(b.length+2,-radius*1.3);c.lineTo(b.length-1,0);c.lineTo(b.length+3,radius*.8);c.lineTo(b.length-4,radius);});ctx.strokeStyle='#444d3b';ctx.lineWidth=.6;ctx.beginPath();ctx.moveTo(b.length-8,-radius);ctx.lineTo(b.length-5,radius);ctx.moveTo(b.length-3,-radius);ctx.lineTo(b.length-6,radius);ctx.stroke();ctx.restore();}
 // A soft falloff directs the eye towards the lit end.
 const vignette=ctx.createRadialGradient(W*.56,H*.46,H*.1,W*.5,H*.5,Math.max(W,H)*.7);vignette.addColorStop(0,'transparent');vignette.addColorStop(1,'#03070bc9');ctx.fillStyle=vignette;ctx.fillRect(0,0,W,H);
}
function path(fill,draw,stroke){ctx.beginPath();draw(ctx);ctx.fillStyle=fill;ctx.fill();if(stroke){ctx.strokeStyle=stroke;ctx.lineWidth=.7;ctx.stroke();}}
function drawHand(){
 // The palm sits behind the cigarette; layered gradients model the curled fingers.
 const skin=ctx.createLinearGradient(-30,10,115,160);skin.addColorStop(0,'#ae8b72');skin.addColorStop(.22,'#88715d');skin.addColorStop(.58,'#594a3e');skin.addColorStop(1,'#272824');
 path(skin,c=>{c.moveTo(11,-20);c.bezierCurveTo(37,-19,44,2,52,15);c.bezierCurveTo(66,23,89,28,106,53);c.bezierCurveTo(117,71,126,125,130,176);c.lineTo(30,203);c.bezierCurveTo(16,143,-12,114,-30,81);c.bezierCurveTo(-46,53,-46,35,-36,21);c.bezierCurveTo(-26,7,-10,-10,11,-20);});
 const finger=ctx.createLinearGradient(-23,-22,25,21);finger.addColorStop(0,'#4f453a');finger.addColorStop(.34,'#ab8c73');finger.addColorStop(.58,'#b5987b');finger.addColorStop(.85,'#8f735e');finger.addColorStop(1,'#584b3f');
 path(finger,c=>{c.moveTo(-8,29);c.bezierCurveTo(-24,10,-48,-39,-43,-57);c.bezierCurveTo(-39,-68,-26,-68,-20,-59);c.bezierCurveTo(-8,-42,3,-20,22,-9);c.bezierCurveTo(31,-4,34,8,27,18);c.bezierCurveTo(20,30,4,37,-8,29);},'#b79a791a');
 for(let i=0;i<3;i++){const y=35+i*24;const f=ctx.createLinearGradient(5,y-17,53,y+18);f.addColorStop(0,'#ab8b71');f.addColorStop(.4,'#92765f');f.addColorStop(1,'#3d3730');path(f,c=>{c.moveTo(4,y-15);c.bezierCurveTo(18,y-21,60,y-7,61,y+7);c.bezierCurveTo(60,y+19,42,y+23,29,y+15);c.bezierCurveTo(8,y+8,-3,y-4,4,y-15);});ctx.strokeStyle='#3b302c55';ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(31,y+7);ctx.quadraticCurveTo(41,y+4,45,y+8);ctx.stroke();}
 const sleeve=ctx.createLinearGradient(12,140,135,188);sleeve.addColorStop(0,'#252f2c');sleeve.addColorStop(.5,'#18221f');sleeve.addColorStop(1,'#0c1415');path(sleeve,c=>{c.moveTo(23,157);c.quadraticCurveTo(65,172,124,136);c.lineTo(165,270);c.lineTo(47,284);c.closePath();});ctx.strokeStyle='#6a716333';ctx.lineWidth=3;ctx.beginPath();ctx.moveTo(25,163);ctx.quadraticCurveTo(69,178,126,143);ctx.stroke();
}
function drawThumb(){const g=ctx.createLinearGradient(-24,3,37,55);g.addColorStop(0,'#b2967b');g.addColorStop(.26,'#b4997d');g.addColorStop(.63,'#8c735d');g.addColorStop(1,'#4e4338');path(g,c=>{c.moveTo(-31,43);c.bezierCurveTo(-40,30,-34,15,-21,8);c.bezierCurveTo(-8,1,1,-11,12,-14);c.bezierCurveTo(24,-17,36,-7,34,5);c.bezierCurveTo(32,18,17,28,7,37);c.bezierCurveTo(-5,49,-20,54,-31,43);},'#dac19c15');const n=ctx.createLinearGradient(3,-7,25,14);n.addColorStop(0,'#c1a58c');n.addColorStop(.5,'#b39980');n.addColorStop(1,'#927a65');path(n,c=>{c.moveTo(7,-5);c.quadraticCurveTo(22,-15,28,-3);c.quadraticCurveTo(31,4,22,11);c.lineTo(7,17);c.quadraticCurveTo(-1,6,7,-5);},'#d7baa240');ctx.strokeStyle='#4d40364a';ctx.lineWidth=.8;for(let i=0;i<3;i++){ctx.beginPath();ctx.moveTo(-21+i*3,30+i*3);ctx.quadraticCurveTo(-12+i*3,29+i*2,-8+i*3,34+i*3);ctx.stroke();}}
function smoothstep(v){v=clamp(v,0,1);return v*v*(3-2*v);}
function cigaretteTransform(){
 const mobile=W<600;let scale=Math.min(H/680,W/(mobile?390:1100))*1.05;
 let x=W*(mobile?.77:.65)+look.x*7,y=H*(mobile?.715:.76)+look.y*4,angle=-.43;
 const sway=reduced?0:Math.sin(time*.78)*1.5;
 // The filter approaches the off-screen mouth, increasing in apparent size.
 x=lerp(x,W*.60,pull);y=lerp(y,H*1.02,pull);angle=lerp(angle,-.12,pull);scale*=1+pull*.26;
 const tray=trayGeometry(),top=-252+burn-ashLength;
 if(ashPose>0){
  const pulse=h=>Math.exp(-Math.pow((tapTime-h)/.055,2))-.34*Math.exp(-Math.pow((tapTime-h-.105)/.085,2));
  const shake=pulse(.52)+pulse(.87),a=-1.26+shake*.095;
  const tx=tray.x+Math.sin(a)*top*scale,ty=tray.y-H*.14-Math.cos(a)*top*scale;
  x=lerp(x,tx+shake*5,ashPose);y=lerp(y,ty+shake*8,ashPose);angle=lerp(angle,a,ashPose);
 }
 if(state==='snuffing'){
  const reach=smoothstep(snuffTime/.72),twist=snuffTime>.72&&snuffTime<1.45?Math.sin((snuffTime-.72)*24)*.055:0;
  const a=-1.82+twist,tx=tray.x+Math.sin(a)*top*scale,ty=tray.y-Math.cos(a)*top*scale+crush*3;
  x=lerp(x,tx,reach);y=lerp(y,ty,reach);angle=lerp(angle,a,reach);
  if(snuffTime>1.48)y+=smoothstep((snuffTime-1.48)/.7)*H*.65;
 }
 y+=(1-handIn)*H*.35;return{x,y:y+sway*(1-ashPose)*(1-pull),angle,scale};
}
function updateTip(t=cigaretteTransform()){
 const top=-252+burn-Math.max(0,ashLength);tip.x=t.x-Math.sin(t.angle)*top*t.scale;tip.y=t.y+Math.cos(t.angle)*top*t.scale;
}
function drawCigarette(){if(disposed)return;const t=cigaretteTransform(),top=-252+burn;updateTip(t);
 if(heat>.01){glow(tip.x,tip.y,85*t.scale,`rgba(220,105,33,${heat*.065})`);}
 ctx.save();ctx.translate(t.x,t.y);ctx.rotate(t.angle);ctx.scale(t.scale,t.scale);drawHand();ctx.save();ctx.scale(TYPES[cigaretteType].width,1);
 // Filter: cork speckle, curved edge shading, seam, and paper collar.
 const cork=ctx.createLinearGradient(-10,0,10,0);cork.addColorStop(0,'#694d30');cork.addColorStop(.2,'#af8c54');cork.addColorStop(.48,'#c7a168');cork.addColorStop(.73,'#ab8952');cork.addColorStop(1,'#635239');ctx.fillStyle=cork;ctx.fillRect(-10,-69,20,69);for(const m of corkMarks){ctx.fillStyle=`rgba(60,43,27,${m.a})`;ctx.fillRect(m.x,m.y,m.l,.7);}
 ellipse(0,0,10,2,'#89724d');ctx.fillStyle='#b7ac8650';ctx.fillRect(-10,-68,20,3);ctx.fillStyle='#4c493c99';ctx.fillRect(-10,-66,20,.6);
 ctx.fillStyle=TYPES[cigaretteType].band;ctx.fillRect(-10,-61,20,2);ctx.fillStyle='#413d2c66';ctx.font='5px sans-serif';ctx.textAlign='center';ctx.fillText(cigaretteType+' mg',0,-49);
 const paper=ctx.createLinearGradient(-10,0,10,0);paper.addColorStop(0,'#788078');paper.addColorStop(.19,'#c2c6b3');paper.addColorStop(.42,'#e0deca');paper.addColorStop(.67,'#c5c7b6');paper.addColorStop(1,'#727e77');ctx.fillStyle=paper;ctx.fillRect(-10,top,20,-68-top);
 ctx.save();ctx.beginPath();ctx.rect(-10,top,20,-68-top);ctx.clip();for(const m of paperMarks){ctx.fillStyle=`rgba(49,61,54,${m.a})`;ctx.fillRect(m.x,m.y,m.l,.4);}ctx.strokeStyle='#6a72641c';ctx.lineWidth=.45;for(let y=-250;y<-69;y+=3){ctx.beginPath();ctx.moveTo(-10,y);ctx.quadraticCurveTo(0,y+1,10,y);ctx.stroke();}ctx.fillStyle='#fff1';ctx.fillRect(4,top,1,-68-top);ctx.restore();
 // Slightly uneven char ring and layered ash grow as the paper burns.
 if(state!=='unlit'&&state!=='lighting'||heat>.1){const al=Math.max(2,ashLength);const a=ctx.createLinearGradient(-10,0,10,0);a.addColorStop(0,'#303833');a.addColorStop(.3,'#85877a');a.addColorStop(.6,'#5d665d');a.addColorStop(1,'#28332e');ctx.fillStyle=a;ctx.fillRect(-10,top-al,20,al);for(const m of ashMarks){if(m.y*36>al)continue;ctx.fillStyle=m.a>.6?'#b4b6a07a':'#15221cb0';ctx.fillRect(m.x,top-m.y*36,m.r*2,m.r);}ctx.fillStyle='#332a1c';ctx.fillRect(-10,top,20,2.5);ctx.fillStyle=`rgba(226,83,20,${heat*.85})`;ctx.fillRect(-9,top-.5,18,2);ellipse(0,top-al,10,3,'#394139');
 if(heat>.02){ctx.save();ctx.globalCompositeOperation='screen';const exposed=Math.min(1,heat+emberFlash*.45);glow(0,top-al,21,`rgba(255,91,20,${exposed*.32})`);for(let i=0;i<32;i++){const x=Math.sin(i*15.7)*8,y=Math.cos(i*13.1)*2.1;const hot=clamp(exposed*(.5+Math.sin(i*2.8+time*5)*.4),0,1);ellipse(x,top-al+y,.5+(i%3)*.3,.6,`rgba(255,${Math.floor(75+hot*140)},37,${hot})`);}ctx.restore();}
 }else{ellipse(0,top,10,3,'#6a5436');for(let i=0;i<22;i++)ellipse(Math.sin(i*9)*8,top+Math.cos(i*13)*2,.7,.45,i%2?'#b49769':'#362d23');}
 if(crush>0){path('#394133',c=>{c.moveTo(-10,top);c.lineTo(-10-crush*5,top-2);c.lineTo(-3,top+crush*8);c.lineTo(2,top+crush*3);c.lineTo(10+crush*4,top-1);c.lineTo(10,top+crush*9);c.closePath();});ctx.strokeStyle='#151f17';ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(-6,top+4);ctx.lineTo(2,top+12*crush);ctx.lineTo(7,top+3);ctx.stroke();}
 ctx.restore();drawThumb();ctx.restore();
 if(state==='lighting')drawLighter(t.scale);
}
function drawLighter(scale){const progress=clamp(lightTime/.5,0,1),out=clamp((lightTime-1.6)/.55,0,1),x=tip.x+13*scale,y=tip.y+47*scale+(1-progress+out)*150*scale;ctx.save();ctx.translate(x,y);ctx.rotate(-.08);ctx.scale(scale,scale);
 const metal=ctx.createLinearGradient(-20,0,21,0);metal.addColorStop(0,'#263332');metal.addColorStop(.16,'#a7ada0');metal.addColorStop(.25,'#5d6e67');metal.addColorStop(.7,'#82918a');metal.addColorStop(1,'#263430');ctx.fillStyle=metal;ctx.beginPath();ctx.roundRect(-21,0,42,74,5);ctx.fill();ctx.fillStyle='#152421';ctx.fillRect(-19,21,38,2);ctx.fillStyle='#bdc1a578';ctx.fillRect(-18,28,1,40);ctx.fillStyle=metal;ctx.save();ctx.translate(-20,20);ctx.rotate(-1.9);ctx.beginPath();ctx.roundRect(-2,-24,40,24,4);ctx.fill();ctx.restore();ctx.fillStyle='#63716a';ctx.fillRect(-14,-14,24,14);ctx.fillStyle='#16201b';for(let i=0;i<3;i++){ellipse(-9+i*7,-9,1.6,2,'#18271f');}ellipse(11,-4,6,8,'#49554b');
 if(lightTime>.22&&lightTime<1.8){const flicker=Math.sin(time*49)*3+Math.cos(time*31)*2;ctx.globalCompositeOperation='screen';glow(-4,-28,65,'#ec9a1f24');path('#e09a29bb',c=>{c.moveTo(-11,-13);c.bezierCurveTo(-19,-27,-3,-43+flicker,-5,-61+flicker);c.bezierCurveTo(14,-37,9,-19,3,-13);c.closePath();});path('#ffe3a4',c=>{c.moveTo(-8,-13);c.bezierCurveTo(-10,-25,-1,-28+flicker,-3,-40+flicker);c.bezierCurveTo(7,-24,6,-17,0,-13);});ellipse(-4,-14,7,4,'#849dffae');ctx.globalCompositeOperation='source-over';}
 const skin=ctx.createLinearGradient(10,30,70,100);skin.addColorStop(0,'#a98b6d');skin.addColorStop(1,'#3d3b30');path(skin,c=>{c.moveTo(18,33);c.bezierCurveTo(42,32,60,68,92,130);c.lineTo(17,166);c.bezierCurveTo(-7,99,-32,71,-28,57);c.bezierCurveTo(-25,44,-8,49,4,57);c.lineTo(20,69);c.bezierCurveTo(27,52,9,39,18,33);});const sleeve=ctx.createLinearGradient(15,160,125,290);sleeve.addColorStop(0,'#27312a');sleeve.addColorStop(1,'#0d1818');path(sleeve,c=>{c.moveTo(14,157);c.lineTo(88,122);c.bezierCurveTo(126,219,145,355,153,520);c.lineTo(-40,520);c.bezierCurveTo(-18,294,12,198,14,157);});ctx.strokeStyle='#59615150';ctx.lineWidth=3;ctx.beginPath();ctx.moveTo(16,162);ctx.lineTo(90,128);ctx.stroke();ctx.restore();}
let emission=0,exhaleEmission=0;
function addSmoke(x,y,type,power=force){
 const mouthSmoke=type==='exhale',size=mouthSmoke?lerp(29,11,power):rand(6,11);
 smoke.push({x,y,vx:mouthSmoke?rand(-12,12)*(1-power)+wind*14:rand(-4,4),vy:mouthSmoke?-lerp(54,205,power):rand(-22,-33),size,life:0,max:mouthSmoke?rand(3.4,5.4):rand(3,4.5),phase:rand(0,TAU),spin:rand(-.4,.4),type,power,alpha:mouthSmoke?1:.58});
 if(smoke.length>420)smoke.shift();
}
function update(dt){
 time+=dt;look.x=lerp(look.x,mouse.x,dt*3);look.y=lerp(look.y,mouse.y,dt*3);handIn=Math.min(1,handIn+dt*2.5);emberFlash=Math.max(0,emberFlash-dt*2);
 if(state==='lighting'){
  const old=lightTime;lightTime+=dt;if(old<.23&&lightTime>=.23)sfx('spark');if(old<1.82&&lightTime>=1.82)sfx('close');
  heat=clamp((lightTime-.6)*.6,0,.5);if(lightTime>2.1){state='lit';heat=.5;updateButtons();$('hint').textContent='흡입 후 놓으면 머금기 · E를 누르면 내쉬기';$('hint').style.opacity='1';}
 }
 exhaleFlow=0;
 if(breathState==='inhaling'&&state==='lit'){
  inhaleTime+=dt;mouth=clamp(mouth+dt/4.5,0,1);updateInhaleAudio();
  if(inhaleTime>=4.5||mouth>=1){inhaleCapped=true;breathState='holding';stopInhaleAudio();toast('연기를 머금고 있습니다. E를 눌러 내쉴 수 있어요');}
 }else if(breathState==='purging'){
  const released=Math.min(mouth,purgeRate*dt);mouth=Math.max(0,mouth-released);exhaleFlow=released/dt;exhaleAge+=dt;
  if(mouth<=.0001){mouth=0;if(pendingInhale&&inhaleHeld&&state==='lit')beginDraw();else{breathState='idle';pendingInhale=false;}}
 }else if(breathState==='exhaling'){
  const released=Math.min(mouth,(.10+force*.37)*dt);mouth=Math.max(0,mouth-released);exhaleFlow=released/dt;exhaleAge+=dt;
  if(mouth<=.0001){mouth=0;breathState='idle';exhaleHeld=false;updateButtons();}
 }
 if(state==='lit'){
  const drawing=breathState==='inhaling',rate=drawing?2.7:.28;burn+=dt*rate;ashLength+=dt*rate;
  heat=lerp(heat,drawing?.97:.23,1-Math.exp(-dt*(drawing?2.7:1.8)));
  if(drawing&&rnd()<dt*2.2)sfx('ember');
  if(ashLength>29)dropAsh(.85,false);
  if(burn>=165){burn=165;snuff();toast('끝까지 타서 재떨이에 내려놓습니다');}
 }
 if(tapTime>=0){
  const old=tapTime;tapTime+=dt;ashPose=smoothstep(tapTime/.34)*(tapQueue>0?1:1-smoothstep((tapTime-1.05)/.28));
  for(const hit of [.52,.87])if(old<hit&&tapTime>=hit){updateTip();sfx('ash');dropAsh(hit===.52?.58:.7,true);}
  if(tapTime>=1.34){if(tapQueue>0){tapQueue--;tapTime=.34;ashPose=1;}else{tapTime=-1;ashPose=0;updateButtons();}}
 }
 if(state==='snuffing'){
  const old=snuffTime;snuffTime+=dt;crush=smoothstep((snuffTime-.73)/.67);
  if(old<.75&&snuffTime>=.75){updateTip();sfx('snuff');dropAsh(.95,true);}
  if(snuffTime>.75)heat*=Math.exp(-dt*6);
  if(old<1.48&&snuffTime>=1.48){depositButt();residualSmoke=2.5;}
  if(snuffTime>2.2){state='out';heat=0;updateButtons();}
 }else if(state==='out')heat*=Math.exp(-dt*3);
 const target=breathState==='inhaling'?1:0;pull=lerp(pull,target,1-Math.exp(-dt*(target?3.1:4.2)));updateTip();
 if(heat>.06&&!disposed){
  emission+=dt*(breathState==='inhaling'?9:23);while(emission>=1){addSmoke(tip.x+rand(-2,2),tip.y-2,'tip');emission--;}
  tipHistory.unshift({x:tip.x,y:tip.y,age:0});if(tipHistory.length>100)tipHistory.pop();
 }
 for(const p of tipHistory){p.age+=dt;p.x+=wind*15*dt;p.y-=27*dt;}
 tipHistory=tipHistory.filter(p=>p.age<3.5);
 if(exhaleFlow>0){
  const power=breathState==='purging'?1:force;exhaleEmission+=dt*(exhaleFlow*180);
  while(exhaleEmission>=1){addSmoke(W*.51+rand(-5,5),H*.87+rand(-4,4),'exhale',power);exhaleEmission--;}
 }
 if(residualSmoke>0&&lastButt){residualSmoke=Math.max(0,residualSmoke-dt);const tray=trayGeometry();if(rnd()<dt*12){addSmoke(tray.x+lastButt.u*tray.r+lastButt.length*.8,tray.y+lastButt.v*tray.r,'tip');}}
 for(let i=smoke.length-1;i>=0;i--){const p=smoke[i];p.life+=dt;if(p.life>p.max){smoke.splice(i,1);continue;}const turbulence=Math.sin(p.life*2.1+p.phase)+Math.sin(p.y*.012+time*.65);p.vx+=(wind*22+turbulence*(p.type==='exhale'?13:8)-p.vx*.45)*dt;p.x+=p.vx*dt;p.y+=p.vy*dt;if(p.type==='exhale')p.vy=lerp(p.vy,-32,dt*.38);else p.vy-=dt*2;p.size+=dt*(p.type==='exhale'?(p.life<.55?lerp(25,9,p.power):32):10);}
 for(let i=debris.length-1;i>=0;i--){const p=debris[i];p.life-=dt;p.vy+=310*dt;p.x+=p.vx*dt;p.y+=p.vy*dt;p.rot+=dt*3;
  if(p.y>=p.landingY||p.life<=0){const tray=trayGeometry();if(p.overTray){trayAsh.push({u:clamp((p.x-tray.x)/tray.r,-.78,.78),v:rand(-.12,.15),r:p.r*.62,rot:p.rot,color:rnd()>.45?'#858875':'#475344'});if(trayAsh.length>650)trayAsh.shift();}debris.splice(i,1);}
 }
 if(audio){const b=exhaleFlow>0?.18*clamp(exhaleFlow/.28,.25,1.35)*clamp(exhaleAge/.12,0,1)*clamp(mouth*3,.3,1):0;audio.breathGain.gain.setTargetAtTime(b,audio.ac.currentTime,.045);audio.breath.frequency.setTargetAtTime(600,audio.ac.currentTime,.2);}
 uiTimer+=dt;if(uiTimer>.07){updateUI();uiTimer=0;}
}
function drawSmoke(){
 ctx.save();ctx.globalCompositeOperation='screen';
 for(const p of smoke){const progress=p.life/p.max,fade=Math.sin(Math.min(1,progress*4)*Math.PI/2)*Math.pow(1-progress,1.6);ctx.save();ctx.translate(p.x,p.y);ctx.rotate(p.phase+p.life*p.spin);ctx.globalAlpha=fade*density*p.alpha;const size=p.size;ctx.drawImage(smokeTexture,-size,-size,size*2,size*2.1);ctx.restore();}
 // Each point keeps its original world position, so hand motion leaves a trail.
 if(tipHistory.length>3){for(let j=0;j<3;j++){ctx.beginPath();for(let i=0;i<tipHistory.length;i++){const p=tipHistory[i],x=p.x+Math.sin(p.age*4-time*1.4+j*.7)*p.age*5,y=p.y;if(i===0)ctx.moveTo(x,y);else ctx.lineTo(x,y);}ctx.strokeStyle=`rgba(138,174,183,${density*.045*(1-j*.18)})`;ctx.lineWidth=.7+j*.65;ctx.stroke();}}
 ctx.restore();
 for(const p of debris){ctx.save();ctx.translate(p.x,p.y);ctx.rotate(p.rot);ctx.globalAlpha=Math.min(1,p.life*2);ctx.fillStyle=p.hot?'#d39a5b':'#95988a';ctx.fillRect(-p.r,-p.r,p.r*1.4,p.r);ctx.restore();}
}
function frame(now){const dt=last?Math.min((now-last)/1000,.05):.016;last=now;if(!paused){update(dt);background();drawCigarette();drawSmoke();ctx.save();ctx.globalAlpha=.28;ctx.fillStyle=ctx.createPattern(grain,'repeat');ctx.fillRect(0,0,W,H);ctx.restore();}requestAnimationFrame(frame);}
$('light').addEventListener('click',light);$('reset').addEventListener('click',()=>{reset();toast('새 담배를 꺼냈습니다');});$('ash').addEventListener('click',ash);$('snuff').addEventListener('click',snuff);$('sound').addEventListener('click',setSound);
const pointers=new Map();
function bindHold(id,start,end){const button=$(id);button.addEventListener('pointerdown',e=>{if(e.button!==0||button.disabled||pointers.has(id))return;e.preventDefault();pointers.set(id,e.pointerId);button.setPointerCapture(e.pointerId);start();});const release=e=>{if(pointers.get(id)!==e.pointerId)return;pointers.delete(id);end();};for(const event of ['pointerup','pointercancel','lostpointercapture'])button.addEventListener(event,release);button.addEventListener('contextmenu',e=>e.preventDefault());button.addEventListener('keydown',e=>{if(e.code==='Enter'){e.preventDefault();if(!e.repeat)start();}});button.addEventListener('keyup',e=>{if(e.code==='Enter'){e.preventDefault();end();}});}
bindHold('inhale',startInhale,endInhale);bindHold('exhale',startExhale,endExhale);
for(const type of [1,3,5])$('type'+type).addEventListener('click',()=>selectType(type));
$('force').addEventListener('input',e=>{force=Number(e.target.value)/100;$('forceOut').value=force<.33?'천천히':force>.7?'강하게':'보통';});
addEventListener('pointermove',e=>{mouse.x=clamp((e.clientX/W-.5)*2,-1,1);mouse.y=clamp((e.clientY/H-.5)*2,-1,1);});
const typing=e=>e.target instanceof HTMLInputElement||e.target instanceof HTMLTextAreaElement||e.target.isContentEditable;
addEventListener('keydown',e=>{if(typing(e)||e.ctrlKey||e.altKey||e.metaKey)return;if(e.code==='Space'){e.preventDefault();if(!e.repeat)startInhale();return;}if(e.code==='KeyE'){e.preventDefault();if(!e.repeat)startExhale();return;}if(e.repeat)return;switch(e.code){case'KeyL':light();break;case'KeyA':ash();break;case'KeyX':snuff();break;case'KeyR':reset();break;case'KeyM':setSound();break;case'KeyH':hideUI();break;case'Escape':setPanel('settings',false);setPanel('help',false);document.body.classList.remove('hidden-ui');break;}});
addEventListener('keyup',e=>{if(e.code==='Space')endInhale();if(e.code==='KeyE')endExhale();});
function pause(){paused=true;endInhale();endExhale();if(breathState==='purging')breathState=mouth>.001?'holding':'idle';pointers.clear();stopInhaleAudio();if(audio)audio.ac.suspend().catch(()=>{});}
function resume(){if(document.hidden)return;paused=false;last=performance.now();if(audio&&audio.on)audio.ac.resume().catch(()=>{});}
addEventListener('blur',pause);addEventListener('focus',resume);document.addEventListener('visibilitychange',()=>document.hidden?pause():resume());
function hideUI(){document.body.classList.toggle('hidden-ui');setPanel('settings',false);setPanel('help',false);}
$('hideUI').addEventListener('click',hideUI);$('restore').addEventListener('click',hideUI);
function setPanel(id,open){$(id).hidden=!open;$(id==='help'?'helpButton':'settingsButton').setAttribute('aria-expanded',String(open));}
$('settingsButton').addEventListener('click',()=>{const open=$('settings').hidden;setPanel('help',false);setPanel('settings',open);});$('helpButton').addEventListener('click',()=>{const open=$('help').hidden;setPanel('settings',false);setPanel('help',open);});
$('rain').addEventListener('input',e=>{rainVolume=Number(e.target.value)/100;$('rainOut').value=e.target.value+'%';if(audio)audio.rainGain.gain.setTargetAtTime(rainVolume*.15,audio.ac.currentTime,.15);});
$('wind').addEventListener('input',e=>{wind=Number(e.target.value)/100;$('windOut').value=Math.abs(wind)<.12?'고요하게':(wind<0?'← 왼쪽':'오른쪽 →')+' '+Math.abs(Math.round(wind*100))+'%';});
$('density').addEventListener('input',e=>{density=Number(e.target.value)/100;$('densityOut').value=e.target.value+'%';});
updateButtons();updateUI();requestAnimationFrame(frame);
})();
