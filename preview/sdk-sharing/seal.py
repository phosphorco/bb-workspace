"""Seal preview SDK migration relative to preserved pre-migration trees.
Only disposable alternate indexes are written; source and shared indexes are untouched.
"""
import hashlib, json, os, pathlib, subprocess, tempfile
here = pathlib.Path(__file__).resolve().parent
root = here.parent.parent
baselines = json.loads((here / 'baseline-trees.json').read_text())
results = {}
for name, base in baselines.items():
    repo = root / name
    with tempfile.TemporaryDirectory(prefix='sdk-sharing-seal-') as tmp:
        env = dict(os.environ, GIT_INDEX_FILE=str(pathlib.Path(tmp) / 'selected.index'))
        def git(*args, input=None):
            return subprocess.run(['git', '-C', str(repo), *args], env=env, input=input,
                                  stdout=subprocess.PIPE, stderr=subprocess.PIPE, check=True).stdout
        git('read-tree', 'HEAD')
        git('add', '-A')
        tree = git('write-tree').decode().strip()
        patch = git('diff', '--binary', '--full-index', base, tree)
        paths = git('diff', '--name-status', base, tree).decode().splitlines()
        git('diff', '--check', base, tree)
        git('read-tree', base)
        git('apply', '--cached', '--check', '-', input=patch)
        git('apply', '--cached', '-', input=patch)
        replay = git('write-tree').decode().strip()
        if replay != tree:
            raise RuntimeError(f'{name}: replay {replay} != {tree}')
        filename = f'{name}-sdk-sharing.patch'
        (here / filename).write_bytes(patch)
        (here / f'{name}-sdk-sharing.paths').write_text('\n'.join(paths) + '\n')
        results[name] = dict(baseTree=base, resultTree=tree, replayTree=replay,
                             patch=filename, sha256=hashlib.sha256(patch).hexdigest(),
                             pathCount=len(paths), sharedIndexChanged=False)
(here / 'sealed.json').write_text(json.dumps(results, indent=2) + '\n')
print(json.dumps(results, indent=2))
