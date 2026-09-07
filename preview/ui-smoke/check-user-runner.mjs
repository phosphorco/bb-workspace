import { chromium } from 'playwright-core';
const browser=await chromium.launch({executablePath:'/home/ubuntu/.local/share/mise/installs/http-chrome-for-testing/149.0.7827.54/chrome',args:['--no-sandbox']});
const page=await browser.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
await page.goto('https://rosetta.banjo-tint.ts.net:40888/identity-check/workflows.html');
await page.getByRole('button',{name:'Run checks',exact:true}).click();
await page.getByText('Run: blocked',{exact:false}).waitFor();
console.log(JSON.stringify({taggedHostDenied:true,message:await page.locator('#results').innerText(),browserErrors:errors}));
if(errors.length)process.exitCode=1;
await browser.close();
