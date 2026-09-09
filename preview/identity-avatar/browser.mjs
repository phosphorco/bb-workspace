import { chromium } from '../ui-smoke/node_modules/playwright-core/index.mjs';
import { writeFile } from 'node:fs/promises';
import assert from 'node:assert/strict';
const out=process.argv[2] ?? import.meta.dirname;
const base='https://rosetta.banjo-tint.ts.net:40888';
const browser=await chromium.launch({executablePath:'/home/ubuntu/.local/share/mise/installs/http-chrome-for-testing/149.0.7827.54/chrome',headless:true,args:['--no-sandbox']});
const results=[];
try {
 for(const width of [390,1280]) for(const colorScheme of ['light','dark']) {
  const context=await browser.newContext({viewport:{width,height:900},colorScheme});
  const page=await context.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
  let result={status:'ready',providerId:'Fixture provider',actor:{evidence:'provider-verified',identity:{kind:'person',key:'fixture-person',issuer:'fixture:people',subject:'fixture-1'},presentation:{displayName:'Fixture Person',handle:'fixture-person',avatarUrl:base+'/avatar-fixture.svg'}}};
  await page.route('**/avatar-fixture.svg',r=>r.fulfill({contentType:'image/svg+xml',body:'<svg xmlns="http://www.w3.org/2000/svg" width="40" height="40"><rect width="40" height="40" fill="#246"/><circle cx="20" cy="20" r="12" fill="#ace"/></svg>'}));
  await page.route('**/avatar-missing.svg',r=>r.fulfill({status:404,body:''}));
  await page.route('**/api/v1/system/p6rIdentity',r=>r.fulfill({json:result}));
  await page.goto(base+'/settings/p6rIdentity');
  const image=page.locator('img[src$="/avatar-fixture.svg"]');
  await image.waitFor();assert.equal(await image.evaluate(el=>el.complete&&el.naturalWidth>0),true);
  assert.equal(await image.getAttribute('referrerpolicy'),'no-referrer');
  const avatar=image.locator('..');assert.equal(await avatar.getAttribute('aria-hidden'),'true');
  const initial=await avatar.boundingBox();assert.ok(initial.width>0);
  await page.screenshot({path:out+`/avatar-${width}-${colorScheme}.png`});
  for(const avatarUrl of [base+'/avatar-missing.svg',null]) {
   result.actor.presentation.avatarUrl=avatarUrl;
   await page.getByRole('button',{name:'Check again',exact:true}).click();
   await page.getByText('F',{exact:true}).waitFor();
   assert.equal(await page.locator('img[src*="avatar-"]').count(),0);
   const rect=await page.getByText('F',{exact:true}).locator('..').boundingBox();
   assert.equal(rect.width,initial.width);assert.equal(rect.height,initial.height);
  }
  result.actor={...result.actor,identity:{...result.actor.identity,key:'second-person'},presentation:{displayName:'Second Person',handle:'a-long-provider-handle-that-must-wrap@example.test',avatarUrl:null}};
  await page.getByRole('button',{name:'Check again',exact:true}).click();
  await page.locator('[aria-live="polite"] [aria-hidden="true"]').getByText('S',{exact:true}).waitFor();assert.equal(await page.getByText('F',{exact:true}).count(),0);
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+2),false);
  result={status:'unavailable',message:'Fixture provider unavailable'};
  await page.getByRole('button',{name:'Check again',exact:true}).click();await page.getByRole('alert').waitFor();
  assert.equal(await page.locator('[aria-live="polite"] [aria-hidden="true"]').getByText('S',{exact:true}).count(),0);
  assert.deepEqual(errors,[]);
  results.push({width,colorScheme,controlledFixture:true,providerAvatarLoaded:true,missingAndFailedFallback:true,stableAvatarSize:true,identitySwitchAndFailureClear:true,noOverflow:true,pageErrors:errors});
  await context.close();
 }
 await writeFile(out+'/browser-results.json',JSON.stringify(results,null,2)+'\n');console.log(JSON.stringify(results));
} finally {await browser.close();}
