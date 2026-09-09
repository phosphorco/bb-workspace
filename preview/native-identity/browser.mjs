import { chromium } from '../ui-smoke/node_modules/playwright-core/index.mjs';
import { writeFile } from 'node:fs/promises';
import assert from 'node:assert/strict';
const base='https://rosetta.banjo-tint.ts.net:40888';
const out=import.meta.dirname;
const browser=await chromium.launch({executablePath:'/home/ubuntu/.local/share/mise/installs/http-chrome-for-testing/149.0.7827.54/chrome',headless:true,args:['--no-sandbox']});
const results=[];
try {
 for (const width of [390,1280]) {
  const context=await browser.newContext({viewport:{width,height:900},isMobile:width===390,hasTouch:width===390});
  const page=await context.newPage();const errors=[];page.on('pageerror',error=>errors.push(error.message));
  const responsePromise=page.waitForResponse(r=>new URL(r.url()).pathname==='/api/v1/system/p6rIdentity');
  await page.goto(base+'/settings/p6rIdentity',{waitUntil:'domcontentloaded'});
  const response=await responsePromise;assert.equal(response.status(),200);
  const live=await response.json();assert.ok(['ready','unconfigured','unauthenticated','unavailable'].includes(live.status));
  await page.getByRole('button',{name:'Check again',exact:true}).waitFor();
  assert.equal(await page.getByRole('link',{name:'Open Appearance settings'}).getAttribute('href'),'/settings/appearance');
  await page.screenshot({path:out+`/live-${width}.png`});
  results.push({width,case:'live settings',status:live.status,pageErrors:[...errors]});
  await page.route('**/api/v1/system/p6rIdentity',route=>route.fulfill({json:{status:'ready',providerId:'UI fixture provider',actor:{evidence:'provider-verified',identity:{kind:'person',key:'fixture-person',issuer:'fixture:people',subject:'fixture-1'},presentation:{displayName:'Fixture Person',handle:'fixture-person',avatarUrl:null}}}}));
  await page.getByRole('button',{name:'Check again',exact:true}).click();
  await page.getByText('@fixture-person',{exact:true}).waitFor();
  assert.equal(await page.getByRole('textbox').count(),0);
  const overflow=await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+2);
  assert.equal(overflow,false);assert.deepEqual(errors,[]);
  await page.screenshot({path:out+`/fixture-${width}.png`});
  results.push({width,case:'controlled ready-state UI (not live admission)',overflow,pageErrors:[...errors]});
  await context.close();
 }
 await writeFile(out+'/browser-results.json',JSON.stringify(results,null,2)+'\n');
 console.log(JSON.stringify(results));
} finally {await browser.close();}
