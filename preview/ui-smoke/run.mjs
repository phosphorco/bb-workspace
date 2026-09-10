import { chromium } from 'playwright-core';
import { mkdir, writeFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root=path.dirname(fileURLToPath(import.meta.url));
const base=process.env.BB_PREVIEW_URL || 'https://rosetta.banjo-tint.ts.net:40888';
if(new URL(base).origin !== 'https://rosetta.banjo-tint.ts.net:40888') throw new Error('This harness is scoped to the isolated preview.');
const output=path.join(root,'runs',new Date().toISOString().replaceAll(':','-'));
await mkdir(output,{recursive:true});
const plugins=JSON.parse(execFileSync('python3',[path.join(root,'../cli.py'),'plugin','list','--json'],{encoding:'utf8'})).plugins;
await writeFile(path.join(output,'plugin-status.json'),JSON.stringify(plugins.map(p=>({id:p.id,status:p.status,enabled:p.enabled,statusDetail:p.statusDetail,hasApp:p.app.hasApp})),null,2));
const report={startedAt:new Date().toISOString(),base,coverage:'Rendered navigation and settings smoke; no model submissions, external sends, or real-user identity assertion',limits:['Chromium mobile emulation is not iOS Safari','The runner is on a tagged Tailnet host; Cole supplied the real-user identity witness','Settings render and plugin running status do not prove all data/edit/queue workflows'],cases:[]};
const browser=await chromium.launch({executablePath:process.env.BB_SMOKE_CHROME || '/home/ubuntu/.local/share/mise/installs/http-chrome-for-testing/149.0.7827.54/chrome',headless:true,args:['--no-sandbox']});
try {
for (const profile of [{name:'desktop',viewport:{width:1440,height:1000},colorScheme:'light'},{name:'mobile',viewport:{width:390,height:844},isMobile:true,hasTouch:true,deviceScaleFactor:1,colorScheme:'dark'}]) {
 const {name,...options}=profile;
 const context=await browser.newContext(options);
 const page=await context.newPage();
 page.setDefaultTimeout(12000);
 let errors=[],responses=[],requests=[];
 page.on('pageerror',e=>errors.push(e.message));
 page.on('response',r=>{if(r.status()>=400)responses.push({status:r.status(),path:new URL(r.url()).pathname,local:new URL(r.url()).origin===base})});
 page.on('requestfailed',r=>{if(!r.failure()?.errorText.includes('ERR_ABORTED'))requests.push({path:new URL(r.url()).pathname,error:r.failure()?.errorText})});
 async function settle(){await page.waitForTimeout(900);}
 async function visit(url){await page.goto(base+url,{waitUntil:'domcontentloaded'});await page.locator('main').first().waitFor();await settle();}
 async function check(id,action,assertion){
  errors=[];responses=[];requests=[];
  const record={profile:name,id,status:'pass',url:null,errors:[],httpErrors:[],requestFailures:[]};
  try {
   await action();
   if(assertion)await assertion();
   const fatal=page.getByText(/^(Failed to load projects\.|Threads unavailable|Something went wrong\.?|Plugin failed to load)$/).filter({visible:true});
   if(await fatal.count())throw new Error('Visible failure state: '+await fatal.first().innerText());
   if(errors.length)throw new Error('Unhandled browser exception');
   if(responses.some(r=>r.local && r.status>=500))throw new Error('Server request failed');
  } catch(e){record.status='fail';record.reason=e.message.slice(0,1200);}
  if(record.status==='pass' && responses.some(r=>r.local&&r.status===401))record.status='auth-required';
  record.url=page.url();record.errors=[...errors];record.httpErrors=[...responses];record.requestFailures=[...requests];
  record.horizontalOverflow=await page.evaluate(()=>document.documentElement.scrollWidth>window.innerWidth+2).catch(()=>null);
  const safe=(name+'-'+id).replace(/[^a-z0-9_-]/gi,'-');
  record.screenshot=safe+'.png';
  await page.screenshot({path:path.join(output,record.screenshot),fullPage:false}).catch(()=>{});
  const text=await page.locator('body').innerText().catch(()=> '');
  await writeFile(path.join(output,safe+'.txt'),text);
  report.cases.push(record);console.log(JSON.stringify({profile:name,id,status:record.status,reason:record.reason,httpErrors:record.httpErrors}));
  await writeFile(path.join(output,'report.json'),JSON.stringify(report,null,2));
 }
 await check('home',()=>visit('/'),async()=>{await page.getByRole('button',{name:'New thread Start a new conversation'}).waitFor();});
 await check('composer-draft',async()=>{
  await page.getByRole('button',{name:'New thread Start a new conversation'}).click();await settle();
  const editor=page.locator('[contenteditable="true"]').filter({visible:true}).first();
  await editor.waitFor();await editor.fill('UI smoke draft — do not send');
  if(!(await editor.innerText()).includes('UI smoke draft'))throw new Error('Draft did not appear');
  await editor.fill('');
 });
 await check('extensions',()=>visit('/extensions/plugins'),async()=>{await page.getByText('Browse plugins',{exact:true}).first().waitFor();});
 await check('skills',()=>visit('/extensions/skills'));
 await check('settings',()=>visit('/settings'));
 await check('installed-plugins',()=>visit('/settings/plugins'));
 for(const p of plugins.filter(p=>p.enabled)) {
  await check('settings-'+p.id,()=>visit('/settings/plugins/'+encodeURIComponent(p.id)),async()=>{
   const rendered=await page.locator('body').innerText();
   if(!rendered.includes(p.name))throw new Error('Plugin title absent: '+p.name);
  });
 }
 await visit('/');
 const nav=page.getByRole('navigation',{name:'Sidebar navigation'});
 const candidates=await nav.getByRole('button').allTextContents();
 for(const title of [...new Set(candidates.map(t=>t.trim()))].filter(t=>t && !['New thread','Extensions','More'].includes(t))) {
  await check('panel-'+title,async()=>{
   await visit('/');
   const button=page.getByRole('navigation',{name:'Sidebar navigation'}).getByRole('button',{name:title,exact:true});
   if(name==='mobile') {
    const toggle=page.getByRole('button',{name:/^Toggle sidebar/}).first();
    if(await toggle.getAttribute('aria-expanded')!=='true')await toggle.click();
   }
   await button.click();await settle();
   if(!new URL(page.url()).pathname.startsWith('/plugins/'))throw new Error('Panel navigation did not select a plugin route');
  });
 }
 await check('existing-thread',async()=>{
  await visit('/');
  const threads=await (await context.request.get(base+'/api/v1/threads')).json();
  const thread=threads[0];if(!thread)throw new Error('No fixture/user-created thread available');
  await visit('/threads/'+encodeURIComponent(thread.id));
 },async()=>{await page.locator('[contenteditable="true"]').filter({visible:true}).first().waitFor();});
 await context.close();
}
} finally {await browser.close();}
report.finishedAt=new Date().toISOString();
report.summary={passed:report.cases.filter(c=>c.status==='pass').length,authRequired:report.cases.filter(c=>c.status==='auth-required').length,failed:report.cases.filter(c=>c.status==='fail').length};
await writeFile(path.join(output,'report.json'),JSON.stringify(report,null,2));
await writeFile(path.join(root,'latest.json'),JSON.stringify({output,...report.summary},null,2));
console.log(JSON.stringify({output,...report.summary}));
process.exitCode=report.summary.failed?1:0;
