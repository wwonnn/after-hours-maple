const fs = require('node:fs');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const path = require('node:path');
const html = fs.readFileSync(path.join(__dirname, '..', 'smoking-simulator.html'), 'utf8');
const source = html.match(/<script>([\s\S]*?)<\/script>/)[1];
const nodes = new Map(), events = new Map();
let clock = 0, raf;
const gradient = () => ({ addColorStop() {} });
const context = new Proxy({
  createLinearGradient: gradient, createRadialGradient: gradient,
  createImageData: (w, h) => ({ data: new Uint8ClampedArray(w * h * 4) }),
}, { get: (o, p) => p in o ? o[p] : () => {} });
function element(id) {
  if (!nodes.has(id)) {
    const classes = new Set();
    nodes.set(id, {
      style: {}, attrs: {}, dataset: {}, hidden: id === 'settings' || id === 'help', value: '',
      classList: { add: k => classes.add(k), remove: k => classes.delete(k), toggle(k, v) { if (v ?? !classes.has(k)) classes.add(k); else classes.delete(k); }, contains: k => classes.has(k) },
      append() {}, setAttribute(k, v) { this.attrs[k] = v; },
      addEventListener(k, fn) { this[k] = fn; }, getContext: () => context, setPointerCapture() {},
    });
  }
  return nodes.get(id);
}
const audioStarts=[];
const param = () => ({ value: 0, setTargetAtTime(v,t) {assert.ok(Number.isFinite(v)&&Number.isFinite(t));this.value=v;},setValueAtTime(v){this.value=v;},linearRampToValueAtTime(v){this.value=v;},exponentialRampToValueAtTime(v){this.value=v;},cancelScheduledValues(){} });
const audioNode = () => ({connect(){},disconnect(){},start(...args){audioStarts.push({buffer:this.buffer,args});},stop(){},gain:param(),frequency:param(),Q:param(),playbackRate:param()});
class AudioContext {
 constructor(){this.sampleRate=800;}get currentTime(){return clock/1000;}
 createGain(){return audioNode();}createBiquadFilter(){return audioNode();}createOscillator(){return audioNode();}
 createBuffer(c,n){return {duration:n/this.sampleRate,getChannelData:()=>new Float32Array(n)};}
 decodeAudioData(bytes){assert.ok(bytes.byteLength>50000,'The selected recording is embedded');return Promise.resolve({duration:2.14,recorded:true});}
 createBufferSource(){return audioNode();}resume(){return Promise.resolve();}suspend(){return Promise.resolve();}
}
const document={getElementById:element,createElement:()=>element(Symbol()),body:element('body'),hidden:false,addEventListener:(k,fn)=>events.set(k,fn)};
const sandbox={console,Math,Uint8Array,Uint8ClampedArray,Float32Array,atob:s=>Buffer.from(s,'base64').toString('binary'),window:{AudioContext},document,innerWidth:1280,innerHeight:800,devicePixelRatio:1,matchMedia:()=>({matches:false}),addEventListener:(k,fn)=>events.set(k,fn),requestAnimationFrame:fn=>raf=fn,performance:{now:()=>clock},setTimeout:()=>1,clearTimeout(){},HTMLInputElement:class{},HTMLTextAreaElement:class{}};
const instrumented=source.replace('updateButtons();updateUI();requestAnimationFrame(frame);',`
window.test={update,updateUI,snapshot:()=>({state,breathState,burn,ashLength,heat,inhaleTime,inhaleHeld,inhaleCapped,mouth,exhaleFlow,pendingInhale,paused,tapTime,ashPose,crush,disposed,cigaretteType,smoke:smoke.length,debris:debris.length,trayAsh:trayAsh.length,butts:butts.length,inhaleVoices:audio?audio.voices.length:0,breathVolume:audio?audio.breathGain.gain.value:0,transform:cigaretteTransform()})};
updateButtons();updateUI();requestAnimationFrame(frame);`);
vm.runInNewContext(instrumented,sandbox);
const app=sandbox.window.test,snapshot=()=>app.snapshot();
const key=(code,type='keydown')=>events.get(type)({code,target:{},preventDefault(){},repeat:false});
const click=id=>element(id).click();
function advance(seconds){for(let i=0;i<Math.round(seconds*20);i++){clock+=50;app.update(.05);}app.updateUI();}
function frames(n){for(let i=0;i<n;i++){clock+=50;raf(clock);}}
async function run(){
 assert.equal(snapshot().state,'unlit');assert.equal(element('inhale').disabled,true);
 key('Space');advance(.2);assert.equal(snapshot().inhaleHeld,false);
 key('KeyL');await Promise.resolve();assert.equal(element('inhale').dataset.sampleStatus,'ready');
 assert.equal(snapshot().state,'lighting');frames(45);assert.equal(snapshot().state,'lit');
 assert.ok(audioStarts.length>=7,'Lid, flint and close sounds scheduled');
 const before=snapshot().burn;key('Space');advance(2);assert.ok(snapshot().burn-before>5);assert.ok(snapshot().heat>.9);
 assert.ok(audioStarts.some(v=>v.buffer?.recorded),'A recording plays during inhalation');
 key('Space','keyup');assert.equal(snapshot().breathState,'holding');const held=snapshot().mouth;assert.ok(held>.4);
 advance(3);assert.equal(snapshot().mouth,held,'Releasing inhale never auto-exhales');assert.equal(snapshot().inhaleVoices,0);assert.equal(snapshot().breathVolume,0);
 key('KeyE');advance(.5);assert.ok(snapshot().mouth<held);key('KeyE','keyup');const partial=snapshot().mouth;
 advance(1);assert.equal(snapshot().mouth,partial,'A partial exhale can be held');
 key('Space');assert.equal(snapshot().breathState,'purging');const purgeBurn=snapshot().burn;advance(.2);
 assert.ok(snapshot().mouth<partial);assert.ok(snapshot().burn-purgeBurn<.1,'New inhale waits for old smoke to leave');
 advance(.25);assert.equal(snapshot().breathState,'inhaling');advance(.8);key('Space','keyup');assert.equal(snapshot().breathState,'holding');
 key('Space');key('Space','keyup');advance(.5);assert.equal(snapshot().breathState,'idle','Releasing during purge cancels pending draw');assert.equal(snapshot().mouth,0);
 key('Space');advance(4.6);assert.equal(snapshot().inhaleCapped,true);assert.equal(snapshot().breathState,'holding');assert.equal(snapshot().mouth,1);
 const cappedBurn=snapshot().burn;advance(6);assert.ok(snapshot().burn-cappedBurn<2);assert.equal(snapshot().mouth,1);
 key('Space','keyup');key('KeyE');advance(6);key('KeyE','keyup');assert.equal(snapshot().mouth,0);
 const ashBefore=snapshot().ashLength,particlesBefore=snapshot().debris;key('KeyA');advance(.45);
 const beforeShake=snapshot().transform;
 assert.ok(snapshot().ashLength>=ashBefore,'Ash stays attached until finger contact');assert.equal(snapshot().debris,particlesBefore);
 advance(.1);assert.ok(snapshot().ashLength<ashBefore);assert.ok(snapshot().debris>0);assert.ok(snapshot().ashPose>.9);
 assert.ok(Math.abs(snapshot().transform.angle-beforeShake.angle)>.03,'Hand and cigarette tilt together on the first shake');
 frames(24);assert.ok(snapshot().trayAsh>0,'Fallen ash persists in tray');assert.equal(snapshot().tapTime,-1);
 key('Space');advance(.5);events.get('blur')();const pausedBurn=snapshot().burn,pausedMouth=snapshot().mouth;frames(20);
 assert.equal(snapshot().paused,true);assert.equal(snapshot().burn,pausedBurn);assert.equal(snapshot().mouth,pausedMouth);assert.equal(snapshot().inhaleHeld,false);
 events.get('focus')();frames(2);assert.equal(snapshot().paused,false);
 key('KeyE');advance(3);key('KeyE','keyup');
 element('inhale').pointerdown({button:0,pointerId:4,preventDefault(){}});advance(1);element('inhale').pointercancel({pointerId:4});
 assert.equal(snapshot().inhaleHeld,false);assert.equal(snapshot().breathState,'holding');
 const retainedMouth=snapshot().mouth;key('KeyX');assert.equal(snapshot().state,'snuffing');frames(18);assert.ok(snapshot().crush>0);frames(30);
 assert.equal(snapshot().state,'out');assert.equal(snapshot().disposed,true);assert.ok(snapshot().butts>0);assert.equal(snapshot().mouth,retainedMouth,'Can exhale after stubbing out');
 key('KeyE');advance(5);key('KeyE','keyup');assert.equal(snapshot().mouth,0);
 const ashCount=snapshot().trayAsh,buttCount=snapshot().butts;key('KeyR');assert.equal(snapshot().state,'unlit');assert.equal(snapshot().trayAsh,ashCount);assert.equal(snapshot().butts,buttCount);
 for(const type of [1,3,5]){click('type'+type);assert.equal(snapshot().cigaretteType,type);assert.equal(element('type'+type).attrs['aria-pressed'],'true');frames(2);}
 key('KeyL');advance(603);assert.equal(snapshot().state,'out');assert.equal(element('remaining').textContent,'0%');assert.ok(snapshot().smoke<=420);
 key('KeyR');assert.equal(element('remaining').textContent,'100%');
 key('KeyM');assert.equal(element('sound').attrs['aria-pressed'],'false');key('KeyM');assert.equal(element('sound').attrs['aria-pressed'],'true');
 click('settingsButton');assert.equal(element('settings').hidden,false);click('helpButton');assert.equal(element('settings').hidden,true);assert.equal(element('help').hidden,false);
 key('KeyH');assert.equal(document.body.classList.contains('hidden-ui'),true);key('Escape');assert.equal(document.body.classList.contains('hidden-ui'),false);
 sandbox.innerWidth=390;sandbox.innerHeight=844;events.get('resize')();frames(3);assert.equal(element('scene').width,390);
 console.log('PASS: embedded A recording, ignition layers, independent inhale/hold/exhale, partial exhale, purge-before-inhale, cancelled purge, draw cap, whole-hand ash shake and falling ash, persistent ash and butts, snuff deformation, pause/resume, touch cancellation, 3 presets, full burnout, audio and responsive rendering.');
}
run().catch(e=>{console.error(e);process.exitCode=1;});
