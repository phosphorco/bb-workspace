from pathlib import Path
import subprocess,os,tempfile,json,hashlib
root=Path('/home/ubuntu/bb-service'); core=root/'fork/build/bb'; out=root/'fork/plans/artifacts/bb-identity-kernel-960255b98'
base='064f32c8b630bad312c57eab1bdb4bc2f48f4153'
paths=['packages/shared-ui/package.json','packages/shared-ui/src/lib/pkl-highlight.ts','apps/app/src/components/ui/markdown-code-highlight.ts','apps/app/src/components/ui/markdown-code-highlight.test.ts','plugins/monaco-editor/lib/pkl-language.ts','plugins/monaco-editor/lib/languages.ts','plugins/monaco-editor/lib/languages.test.ts','plugins/monaco-editor/monaco-bundle/editor.js']
with tempfile.TemporaryDirectory(prefix='bb-pkl-index-') as tmp:
 env=dict(os.environ,GIT_INDEX_FILE=tmp+'/index')
 def git(*args,input=None):return subprocess.run(['git','-C',str(core),*args],env=env,input=input,stdout=subprocess.PIPE,stderr=subprocess.PIPE,check=True).stdout
 git('read-tree',base);git('add','--',*paths);tree=git('write-tree').decode().strip();patch=git('diff','--binary','--full-index',base,tree);git('diff','--check',base,tree)
 git('read-tree',base);git('apply','--cached','-',input=patch);assert git('write-tree').decode().strip()==tree
 name='15-pkl-highlighting.patch';(out/name).write_bytes(patch)
 receipt={'patch':name,'sha256':hashlib.sha256(patch).hexdigest(),'baseTree':base,'resultTree':tree}
 manifest=json.loads((out/'composition-replay.json').read_text());assert manifest['resultTree']==base;manifest['patches'].append(receipt);manifest['resultTree']=tree;(out/'composition-replay.json').write_text(json.dumps(manifest,indent=2)+'\n')
 details={**receipt,'paths':paths,'checks':{'markdownTests':17,'editorLanguageTests':3,'typecheck':'app and Monaco pass','build':'app/server and staged Monaco pass','browser':'6/6 Chromium mounted renderer and built editor cases: light/dark/custom, 390/1280 widths; escaped content, multiline token state, registration, source preservation'},'limits':['Syntax coloring only; no Pkl evaluator, diagnostics or language server','Chromium phone viewport, not iOS Safari'],'reference':'https://pkl-lang.org/main/current/language-reference/index.html'}
 (out/'pkl-highlighting.json').write_text(json.dumps(details,indent=2)+'\n')
 preview=json.loads((root/'PREVIEW.json').read_text());preview['coreTree']=tree;preview['localRepairs']['pklHighlighting']=details;(root/'PREVIEW.json').write_text(json.dumps(preview,indent=2)+'\n')
 print(json.dumps(receipt))
