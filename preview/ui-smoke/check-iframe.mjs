import {chromium} from 'playwright-core';
const b=await chromium.launch({executablePath:'/home/ubuntu/.local/share/mise/installs/http-chrome-for-testing/149.0.7827.54/chrome',args:['--no-sandbox']});
const p=await b.newPage();
await p.goto('https://rosetta.banjo-tint.ts.net:40888/identity-check/workflows.html');
await p.locator('#frame').evaluate(el=>el.src='/');
await p.frameLocator('#frame').getByRole('button',{name:'New thread Start a new conversation'}).waitFor();
console.log('Same-origin iframe renders real BB home; this is not a human-identity assertion');
await b.close();
