import { chromium } from '../ui-smoke/node_modules/playwright-core/index.mjs';
import { createRequire } from 'node:module';
import { readFile, writeFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import assert from 'node:assert/strict';
const root='/home/ubuntu/bb-service/fork/build/bb';
const out=import.meta.dirname;
const require=createRequire(root+'/apps/app/package.json');
const esbuild=require('esbuild');
await esbuild.build({stdin:{contents:`import {highlightMarkdownCode} from './src/components/ui/markdown-code-highlight.ts'; window.highlightPkl=code=>highlightMarkdownCode({code,language:'pkl'});`,resolveDir:root+'/apps/app',loader:'ts'},bundle:true,format:'esm',platform:'browser',outfile:out+'/entry.js'});
const css=await readFile(root+'/apps/app/src/components/ui/markdown-code-highlight.css','utf8');
const html=`<!doctype html><meta name="viewport" content="width=device-width,initial-scale=1"><style>body{margin:24px;font:16px system-ui;background:var(--bg);color:var(--foreground)}pre{overflow:auto;padding:16px;border:1px solid #888;border-radius:8px}#editor{height:340px;width:100%}${css}</style><h2>Pkl chat code block</h2><pre class="bb-code-highlight"><code id="code"></code></pre><h2>Pkl file editor</h2><div id="editor"></div><link rel="stylesheet" href="/editor.css"><script>self.MonacoEnvironment={getWorker:()=>new Worker('/editor.worker.js',{type:'module'})};</script><script type="module">import '/entry.js'; import {monaco} from '/editor.js'; window.monaco=monaco; window.ready=true;</script>`;
const server=createServer(async(req,res)=>{try{const name=req.url?.split('?')[0];if(name==='/'){res.setHeader('content-type','text/html');res.end(html);return;}const path=name==='/entry.js'?out+'/entry.js':['/editor.js','/editor.css','/editor.worker.js'].includes(name)?root+'/plugins/monaco-editor/dist/monaco'+name:null;if(!path){res.writeHead(404).end();return;}res.setHeader('content-type',name.endsWith('.css')?'text/css':'text/javascript');res.end(await readFile(path));}catch(e){res.writeHead(500).end();}});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const browser=await chromium.launch({executablePath:'/home/ubuntu/.local/share/mise/installs/http-chrome-for-testing/149.0.7827.54/chrome',headless:true,args:['--no-sandbox']});
const source=String.raw`amends "base.pkl"
/// Application configuration
local port: Int = 8080
fraction = .23
enabled = true
message = "Hello, \(if (enabled) "Pkl" else "world")!"
raw = #"""
// literal text, not a comment
"""#
/* outer /* nested */ still comment */`;
const results=[];
try{for(const width of [390,1280])for(const theme of ['light','dark','custom']){
 const page=await browser.newPage({viewport:{width,height:980}});const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto(`http://127.0.0.1:${server.address().port}/`);await page.waitForFunction(()=>window.ready);
 const result=await page.evaluate(({source,theme})=>{
  document.documentElement.className=theme==='light'?'':'dark';
  const colors=theme==='light'?['#fff','#222','#666','#777']:theme==='custom'?['#2e3440','#eceff4','#aab5c8','#93a1b8']:['#171717','#eee','#aaa','#999'];
  for(const [i,key]of ['--bg','--foreground','--muted-foreground','--subtle-foreground'].entries())document.documentElement.style.setProperty(key,colors[i]);
  const code=document.getElementById('code');code.innerHTML=window.highlightPkl(source);
  if(theme==='custom')monaco.editor.defineTheme('custom',{base:'vs-dark',inherit:true,rules:[{token:'keyword',foreground:'81a1c1'},{token:'string',foreground:'a3be8c'}],colors:{'editor.background':'#2e3440'}});
  window.editor=monaco.editor.create(document.getElementById('editor'),{value:source,language:'pkl',theme:theme==='custom'?'custom':theme==='light'?'vs':'vs-dark',automaticLayout:true,minimap:{enabled:false},scrollBeyondLastLine:false});
  const tokenized=monaco.editor.tokenize(source,'pkl');
  const before=editor.getModel().getLineTokens;
  editor.getModel().setValue('x = """\ncomment-looking // text\n"""\nlocal x = 1');
  const multiline=monaco.editor.tokenize(editor.getValue(),'pkl');
  editor.getModel().setValue(source);
  return {registered:monaco.languages.getLanguages().some(x=>x.id==='pkl'),preserved:code.textContent===source,keyword:!!code.querySelector('.sh__token--keyword'),fraction:[...code.querySelectorAll('.sh__token--class')].some(token=>token.textContent==='.23')&&tokenized[3].some(token=>token.type==='number'),stringColor:getComputedStyle(code.querySelector('.sh__token--string')).color,keywordColor:getComputedStyle(code.querySelector('.sh__token--keyword')).color,editorKeyword:tokenized[0][0].type,rawString:tokenized[7][0].type,multiline:multiline[1][0].type,afterMultiline:multiline[3][0].type,overflow:document.documentElement.scrollWidth>innerWidth};
 },{source,theme});
 assert.equal(result.registered,true);assert.equal(result.preserved,true);assert.equal(result.keyword,true);assert.equal(result.fraction,true);assert.notEqual(result.stringColor,result.keywordColor);assert.equal(result.editorKeyword,'keyword');assert.equal(result.rawString,'string');assert.equal(result.multiline,'string');assert.equal(result.afterMultiline,'keyword');assert.equal(result.overflow,false);assert.deepEqual(errors,[]);
 await page.screenshot({path:`${out}/${theme}-${width}.png`});results.push({width,theme,...result,errors});await page.close();
}await writeFile(out+'/browser-results.json',JSON.stringify(results,null,2));console.log('6 browser cases passed: chat + built Monaco; light/dark/custom; 390/1280 widths');}finally{await browser.close();server.close();}
