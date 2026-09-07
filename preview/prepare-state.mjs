import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
const root='/home/ubuntu/bb-service/fork/build/bb';
const data='/home/ubuntu/.local/share/bb-service-preview';
if (existsSync(join(data,'prepared.json'))) throw new Error('Already prepared; refuse reseeding');
const load=p=>import(pathToFileURL(join(root,p)).href);
const [{initDb},rows,{listBundledPluginRegistrations}]=await Promise.all([load('apps/server/src/db.ts'),load('packages/db/src/data/plugins.ts'),load('apps/server/src/services/plugins/builtin-registry.ts')]);
const db=initDb(join(data,'bb.db'),{dataDir:data});
const bundled=listBundledPluginRegistrations();
try {
 db.transaction(()=>{
  for(const p of bundled){
   const manifest=JSON.parse(readFileSync(join(p.rootDir,'package.json'),'utf8'));
   rows.upsertInstalledPlugin(db,{id:p.pluginId,source:`builtin:${p.name}`,provenance:{kind:'builtin'},sourceIntent:{kind:'builtin',name:p.name},exactResolution:{kind:'builtin'},updateState:{lastCheckAt:null,availableCompatibleVersion:null,newestIncompatibleVersion:null,statusDetail:null},activeArtifactId:null,rootDir:p.rootDir,version:manifest.version,enabled:false});
  }
 });
 writeFileSync(join(data,'prepared.json'),JSON.stringify({disabledBuiltinCount:bundled.length,source:root,createdAt:new Date().toISOString()},null,2),{flag:'wx',mode:0o600});
 console.log(JSON.stringify({prepared:true,disabledBuiltinCount:bundled.length}));
} finally {db.$client.close();}
