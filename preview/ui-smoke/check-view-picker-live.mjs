import {chromium} from 'playwright-core';
import {writeFile} from 'node:fs/promises';
const browser=await chromium.launch({executablePath:'/home/ubuntu/.local/share/mise/installs/http-chrome-for-testing/149.0.7827.54/chrome',args:['--no-sandbox']});const cases=[];
try{for(const width of [390,1440]){
 const page=await browser.newPage({viewport:{width,height:850},isMobile:width===390,hasTouch:width===390});const errors=[];page.on('pageerror',e=>errors.push(e.message));await page.goto('https://rosetta.banjo-tint.ts.net:40888/');
 if(width===390){const toggle=page.getByRole('button',{name:/^Toggle sidebar/}).first();if(await toggle.getAttribute('aria-expanded')!=='true')await toggle.click();}
 const picker=page.getByRole('button',{name:'View as…',exact:true});await picker.waitFor();await page.waitForTimeout(500);
 const record={width,control:await picker.innerText(),box:await picker.boundingBox(),preparingLabels:await page.getByText('Preparing sections…',{exact:true}).count(),errors};cases.push(record);
 await page.screenshot({path:`/home/ubuntu/bb-service/preview/view-picker/live-${width}.png`});await page.close();
}}finally{await browser.close();}
await writeFile('/home/ubuntu/bb-service/preview/view-picker/live.json',JSON.stringify({scope:'Actual loaded preview; tagged-host identity remains denied. Positive picker is covered separately by controlled component tests.',cases},null,2));console.log(JSON.stringify(cases));process.exitCode=cases.some(x=>x.errors.length||x.preparingLabels)?1:0;
