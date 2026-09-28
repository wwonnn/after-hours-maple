// Run against Tools/serve.py. Drives actual browser inputs; never teleports the player.
const { createRequire } = require('node:module');
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
let playwright;
try { playwright = require('playwright'); }
catch { playwright = createRequire(__filename)(path.join(process.env.USERPROFILE, '.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright')); }
const output = path.resolve(__dirname, '../Verification');
fs.mkdirSync(output, { recursive: true });
(async () => {
 const browser = await playwright.chromium.launch({headless:true, channel:'chrome', args:['--enable-unsafe-swiftshader']});
 const context = await browser.newContext({viewport:{width:1280,height:720}});
 const page = await context.newPage();
 const logs=[], errors=[], badResponses=[], checks=[];
 page.on('console', m=>logs.push(m.text()));
 page.on('pageerror', e=>errors.push(String(e)));
 page.on('response', r=>{if(r.status()>=400)badResponses.push({url:r.url(),status:r.status()});});
 const state=async()=>{const index=logs.length;await page.evaluate(()=>window.afterHoursUnity.SendMessage('AfterHours','ReportState',''));await page.waitForTimeout(120);const text=logs.slice(index).find(s=>s.startsWith('AH_STATE '));return text?JSON.parse(text.slice(9)):null;};
 const ready=async()=>{for(let i=0;i<120;i++){const s=await state();if(s&&!s.loading)return s;await page.waitForTimeout(200);}throw Error('Map loading timeout');};
 const hold=async(key,ms)=>{await page.keyboard.down(key);await page.waitForTimeout(ms);await page.keyboard.up(key);};
 const check=(name,condition)=>{assert.ok(condition,name);checks.push(name);console.log('PASS',name);};
 try {
  await page.goto(process.env.AFTER_HOURS_URL || 'http://127.0.0.1:8790/');
  await page.locator('#open').click();await page.waitForFunction(()=>window.afterHoursUnity,null,{timeout:60000});
  check('new game starts in Kerning City',(await ready()).mapId===103000000);
  await page.waitForTimeout(700);await page.keyboard.press('KeyH');
  await page.screenshot({path:path.join(output,'kerning-city.png')});
  await hold('ArrowRight',1370);await page.keyboard.press('ArrowUp');await page.waitForTimeout(250);
  check('walk to original shop doorway enters original interior',(await ready()).mapId===103000001);
  await hold('ArrowLeft',1270);for(let i=0;i<4;i++){await page.keyboard.press('Space');await page.waitForTimeout(750);}
  await hold('ArrowRight',470);await page.keyboard.press('KeyF');await page.waitForTimeout(200);
  check('NPC reached using original interior footholds',(await state()).npc===1051000);
  await page.screenshot({path:path.join(output,'npc-dialogue.png')});
  await page.mouse.click(575,614);await page.waitForTimeout(200);await page.mouse.click(575,614);
  await page.locator('#ah-smoke').waitFor({timeout:10000});
  const smoke=page.frameLocator('#ah-smoke');await smoke.locator('#npc-title').waitFor();
  check('original NPC present during encounter',(await state()).encounter);
  check('transparent overlay preserves the Unity map',await smoke.locator('html').evaluate(el=>getComputedStyle(el).colorScheme==='normal'));
  await smoke.locator('#light').click();await page.waitForTimeout(2200);
  await smoke.locator('#npc-choices button').nth(2).click();await page.waitForTimeout(180);
  await smoke.locator('#npc-choices button').first().click();await page.waitForTimeout(180);
  await smoke.locator('#npc-choices button').first().click();
  await smoke.locator('#inhale').hover();await page.mouse.down();await page.waitForTimeout(1500);await page.mouse.up();
  await smoke.locator('#exhale').hover();await page.mouse.down();await page.waitForTimeout(600);
  check('cigarette burns through real input',parseInt(await smoke.locator('#remaining').textContent(),10)<100);
  await page.screenshot({path:path.join(output,'smoking.png')});await page.mouse.up();
  await page.setViewportSize({width:1024,height:768});await page.waitForTimeout(250);
  check('smoke viewport tracks letterboxed Unity canvas',await page.evaluate(()=>{const a=document.querySelector('#unity-canvas').getBoundingClientRect(),b=document.querySelector('#ah-smoke').getBoundingClientRect();return ['x','y','width','height'].every(k=>Math.abs(a[k]-b[k])<1);}));
  await page.setViewportSize({width:1280,height:720});
  const before=await state();await smoke.locator('#leave').click();await page.waitForTimeout(200);const after=await state();
  check('encounter ends at exactly the same player coordinates',before.mapId===after.mapId&&before.x===after.x&&before.y===after.y&&!after.encounter);
  check('first encounter creates a contact',after.contacts===1);
  await page.keyboard.press('KeyP');await page.waitForTimeout(300);await page.screenshot({path:path.join(output,'messenger.png')});
  await page.waitForTimeout(37000);await page.mouse.click(677,560);await page.waitForTimeout(250);
  await page.screenshot({path:path.join(output,'invitation.png')});
  await page.reload();await page.locator('#open').click();await page.waitForFunction(()=>window.afterHoursUnity,null,{timeout:60000});
  const restored=await ready();check('contact and exact location survive reload',restored.contacts===1&&restored.mapId===after.mapId&&restored.x===after.x&&restored.y===after.y);
  await page.keyboard.press('KeyH');await page.keyboard.press('KeyF');await page.waitForTimeout(180);
  await page.mouse.click(575,614);await page.waitForTimeout(180);await page.mouse.click(575,614);await page.locator('#ah-smoke').waitFor();
  const returned=page.frameLocator('#ah-smoke');await returned.locator('#npc-text').waitFor();
  check('revisit remembers the quiet dialogue choice',(await returned.locator('#npc-text').textContent()).includes('조용한 시간'));
  check('no browser runtime exceptions',errors.length===0);
  check('no missing network resources',badResponses.length===0);
  const result={date:new Date().toISOString(),engine:'Unity 6000.0.74f1',checks,errors,badResponses};
  fs.writeFileSync(path.join(output,'web-smoke.json'),JSON.stringify(result,null,2));
 } catch(error) {await page.screenshot({path:path.join(output,'failure.png')});fs.writeFileSync(path.join(output,'failure.json'),JSON.stringify({error:String(error),checks,errors,badResponses,logs:logs.slice(-50)},null,2));throw error;}
 finally {await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
