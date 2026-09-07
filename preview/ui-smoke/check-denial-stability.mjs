import {chromium} from 'playwright-core';
import {writeFile} from 'node:fs/promises';
const base='https://rosetta.banjo-tint.ts.net:40888';
const browser=await chromium.launch({executablePath:'/home/ubuntu/.local/share/mise/installs/http-chrome-for-testing/149.0.7827.54/chrome',headless:true,args:['--no-sandbox']});
const report={scope:'Tagged-host denied identity GET; no forged headers or ready-person claim',requests:100,statusCounts:{},errors:[]};
try {
 const context=await browser.newContext();const page=await context.newPage();await page.goto(base+'/');
 for(let i=0;i<100;i++){
  const response=await context.request.get(base+'/api/v1/plugins/agentation/http/identity/self');
  const status=response.status();report.statusCounts[status]=(report.statusCounts[status]||0)+1;
  if(status!==401)report.errors.push({request:i,status,body:(await response.text()).slice(0,500)});
 }
}finally{await browser.close();}
await writeFile(new URL('./denial-stability.json',import.meta.url),JSON.stringify(report,null,2));
console.log(JSON.stringify(report));process.exitCode=report.errors.length?1:0;
