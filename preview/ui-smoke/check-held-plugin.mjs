import {chromium} from 'playwright-core';
import {writeFile} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const b=await chromium.launch({executablePath:'/home/ubuntu/.local/share/mise/installs/http-chrome-for-testing/149.0.7827.54/chrome',args:['--no-sandbox']});
const cases=[];
for(const viewport of [{width:1440,height:1000},{width:390,height:844}]){
 const p=await b.newPage({viewport});const bad=[];
 p.on('response',r=>{if(r.status()>=500)bad.push({status:r.status(),path:new URL(r.url()).pathname})});
 await p.goto('https://rosetta.banjo-tint.ts.net:40888/settings/plugins/prompt-stacks');
 await p.getByText('Prompt Stacks',{exact:true}).first().waitFor();
 await p.waitForTimeout(1000);
 const body=await p.locator('body').innerText();
 const record={viewport,bad,titleVisible:body.includes('Prompt Stacks'),disabled:body.includes('Disabled'),status:bad.length?'fail':'pass'};
 cases.push(record);await p.close();
}
await b.close();
const out=path.join(path.dirname(fileURLToPath(import.meta.url)),'held-plugin-verification.json');
await writeFile(out,JSON.stringify({cases,meaning:'Disabled plugin configuration is accessible; Prompt Stacks workflow remains unimplemented in selected host.'},null,2));
console.log(JSON.stringify(cases));process.exitCode=cases.some(c=>c.status==='fail')?1:0;
