mergeInto(LibraryManager.library, {
 AH_Register: function() {
  if(window.ahRegistered)return;window.ahRegistered=true;
  window.ahFitSmoke=function(){var f=document.getElementById('ah-smoke');if(!f)return;var r=Module.canvas.getBoundingClientRect();Object.assign(f.style,{left:r.left+'px',top:r.top+'px',width:r.width+'px',height:r.height+'px'});};
  window.addEventListener('resize',window.ahFitSmoke);
  document.addEventListener('visibilitychange',function(){if(window.afterHoursUnity)window.afterHoursUnity.SendMessage('AfterHours','OnBrowserFocus',document.hidden?'hidden':'visible');});
  window.addEventListener('pagehide',function(){if(window.afterHoursUnity)window.afterHoursUnity.SendMessage('AfterHours','OnBrowserFocus','save');});
  window.addEventListener('message',function(e){
   var f=document.getElementById('ah-smoke');if(!f||e.source!==f.contentWindow||e.origin!==location.origin)return;
   if(!e.data)return;
   if(e.data.type==='after-hours-ready')f.contentWindow.postMessage({type:'after-hours-dialogue',payload:window.ahPayload},location.origin);
   if(e.data.type==='after-hours-choice'&&window.afterHoursUnity)window.afterHoursUnity.SendMessage('AfterHours','OnSmokeChoice',String(e.data.value));
  });
 },
 AH_OpenSmoke: function(url,payload) {
  window.ahPayload=JSON.parse(UTF8ToString(payload));var f=document.createElement('iframe');f.id='ah-smoke';f.src=UTF8ToString(url);f.title='NPC와 함께하는 시간';f.allow='autoplay';
  var rect=Module.canvas.getBoundingClientRect();f.style.cssText='position:fixed;z-index:10;border:0;background:transparent;left:'+rect.left+'px;top:'+rect.top+'px;width:'+rect.width+'px;height:'+rect.height+'px;';
  document.body.appendChild(f);f.onload=function(){f.contentWindow.postMessage({type:'after-hours-dialogue',payload:window.ahPayload},location.origin);f.contentWindow.focus();};
 },
 AH_UpdateSmoke: function(payload) {window.ahPayload=JSON.parse(UTF8ToString(payload));var f=document.getElementById('ah-smoke');if(f)f.contentWindow.postMessage({type:'after-hours-dialogue',payload:window.ahPayload},location.origin);},
 AH_CloseSmoke: function() {var f=document.getElementById('ah-smoke');if(f)f.remove();Module.canvas.focus();}
});
