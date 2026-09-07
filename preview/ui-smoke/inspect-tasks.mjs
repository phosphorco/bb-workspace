import {chromium} from 'playwright-core';
const browser=await chromium.launch({executablePath:'/home/ubuntu/.local/share/mise/installs/http-chrome-for-testing/149.0.7827.54/chrome',args:['--no-sandbox']});
const page=await browser.newPage();
await page.goto('https://rosetta.banjo-tint.ts.net:40888/plugins/tasks/tasks');
await page.waitForTimeout(1300);
console.log((await page.locator('body').innerText()).slice(-5000));
console.log(await page.locator('main button, main input').evaluateAll(es=>es.map(e=>({tag:e.tagName,text:e.innerText,label:e.getAttribute('aria-label'),placeholder:e.getAttribute('placeholder')}))));
await browser.close();
