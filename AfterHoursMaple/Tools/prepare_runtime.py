from pathlib import Path
import json,base64,re,shutil
P=Path(__file__).resolve().parents[1];W=P.parent;S=P/'Assets/StreamingAssets/Smoke';S.mkdir(parents=True,exist_ok=True)
html=(W/'smoking-simulator.template.html').read_text(encoding='utf8')
js=(W/'smoking-simulator.js').read_text(encoding='utf8')
js=js.replace("getContext('2d',{alpha:false})","getContext('2d',{alpha:true})")
start=js.index('function background(){');end=js.index('\nfunction path(',start)
original=js[start:end];tray=original[original.index(' // Glass ashtray'):original.index(' // A soft falloff')]
js=js[:start]+'function background(){ctx.clearRect(0,0,W,H);\n'+tray+'}\n'+js[end:]
js=js.replace("rainVolume=.55","rainVolume=0")
html=html.replace('value="55"','value="0"').replace('id="rainOut">55%','id="rainOut">0%')
js=js.replace('__INHALE_AUDIO_BASE64__',base64.b64encode((W/'assets/smoking/cigarette-inhale-kczub.mp3').read_bytes()).decode())
# Keep the original high-detail smoke/hands/ash engine. All world art stays in Unity.
html=html.replace('<!-- SIMULATOR_SCRIPT -->','<script>'+js+'</script>')
extra='''<style>html,body{background:transparent!important;color-scheme:normal!important}.hero,.brand,.scene-label,.cigarette-select,.ui>footer,.intro-hint{display:none!important}.ui header{top:14px;right:22px;left:auto}.dock{bottom:24px}.readout{left:24px;bottom:110px}.breath{left:60%;bottom:130px}.exhale-force{bottom:102px}.help-toggle{bottom:95px}#encounter-dialog{position:absolute;left:22px;top:100px;width:min(470px,45vw);color:#243445;background:#f5f7f5f2;border:6px solid #b8d3df;border-radius:8px;box-shadow:0 5px 25px #0008;padding:20px;font:16px/1.7 system-ui,sans-serif}#npc-title{font-size:20px;font-weight:700;margin:0 0 10px;color:#196194}#npc-text{margin:0 0 16px}#npc-choices{display:grid;gap:8px}#npc-choices button,#leave{cursor:pointer;padding:10px 14px;border:1px solid #6998b2;background:#e7f4fb;color:#194867;border-radius:4px;font:inherit}#leave{position:absolute;right:25px;top:70px;background:#fff5d9}#map-label{position:absolute;left:24px;top:20px;color:white;font:18px system-ui;text-shadow:0 2px 4px #000}.hidden-ui #encounter-dialog{opacity:.15}.hidden-ui #encounter-dialog:hover{opacity:1}</style>
<div id="map-label"></div><section id="encounter-dialog"><h2 id="npc-title"></h2><p id="npc-text"></p><div id="npc-choices"></div></section><button id="leave">만남 마치기 · 같은 자리로</button>
<script>
function sendChoice(value){parent.postMessage({type:'after-hours-choice',value:String(value)},location.origin)}
addEventListener('message',e=>{if(e.source!==parent||e.origin!==location.origin||e.data.type!=='after-hours-dialogue')return;const p=e.data.payload;document.getElementById('npc-title').textContent=p.name;document.getElementById('map-label').textContent=p.location+' · 그 자리에서 함께';document.getElementById('npc-text').textContent=p.text;const list=document.getElementById('npc-choices');list.replaceChildren();p.choices.forEach((s,i)=>{const b=document.createElement('button');b.textContent=s;b.onclick=()=>sendChoice(i);list.append(b)})});
document.getElementById('leave').onclick=()=>sendChoice('end');addEventListener('keydown',e=>{if(e.code==='Escape'){e.preventDefault();sendChoice('end')}});parent.postMessage({type:'after-hours-ready'},location.origin);
</script>'''
html=html.replace('<head>','<head><link rel="icon" href="data:,">').replace('</body>',extra+'</body>');(S/'encounter.html').write_text(html,encoding='utf8')
# Use the original dialogue-frame artwork around the new smoke controls.
c=json.loads((P/'Assets/StreamingAssets/Maple/catalog.json').read_text(encoding='utf8'))
for u in c['ui']:
 if u['path']=='UI/UIWindow.img/UtilDlgEx/c':
  html=html.replace('background:#f5f7f5f2;',f"background:#f5f7f5 url('../Maple/images/{u['frame']['key']}.png') repeat-y;background-size:100% 20px;")
(S/'encounter.html').write_text(html,encoding='utf8')
audio=P/'Assets/StreamingAssets/Audio';audio.mkdir(exist_ok=True)
for name in ['henesys','ellinia','kerning-city']:shutil.copy2(W/f'assets/maplestory-samples/bgm/{name}.mp3',audio/(name+'.mp3'))
shutil.copy2(W/'assets/smoking/CREDITS.md',S/'CREDITS.md')
print('Prepared transparent encounter renderer and original BGM')
