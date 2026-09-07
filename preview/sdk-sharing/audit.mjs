import { createRequire } from 'node:module';
import { readFile, readdir, realpath, stat } from 'node:fs/promises';
import { resolve, dirname, join, relative } from 'node:path';
import { createHash } from 'node:crypto';
const root = resolve(import.meta.dirname, '../..');
const rows = [];
const errors = [];
for (const collection of ['plugins', 'community-plugins']) {
  const plugins = join(root, collection, 'plugins');
  for (const id of (await readdir(plugins)).sort()) {
    const leaf = join(plugins, id);
    let manifest;
    try { manifest = JSON.parse(await readFile(join(leaf, 'package.json'), 'utf8')); }
    catch { continue; }
    const row = { collection, id, pin: manifest.devDependencies?.['@get-bb/plugin-sdk'] ?? null };
    try {
      if (!row.pin) throw new Error('Missing direct SDK devDependency');
      const entry = createRequire(join(leaf, 'package.json')).resolve('@get-bb/plugin-sdk');
      let dir = dirname(await realpath(entry));
      let sdk;
      while (dir !== dirname(dir)) {
        try { const candidate = JSON.parse(await readFile(join(dir, 'package.json'), 'utf8')); if (candidate.name === '@get-bb/plugin-sdk') { sdk = candidate; break; } } catch {}
        dir = dirname(dir);
      }
      if (!sdk) throw new Error('Resolved entry has no SDK package');
      row.version = sdk.version;
      row.resolved = relative(root, dir);
      row.declarations = {};
      for (const name of ['.', ...(manifest.bb?.app ? ['./app'] : [])]) {
        const target = sdk.exports?.[name]?.types;
        if (typeof target !== 'string') throw new Error(`Missing public types export ${name}`);
        const bytes = await readFile(resolve(dir, target));
        row.declarations[name] = createHash('sha256').update(bytes).digest('hex');
      }
      if (row.pin.startsWith('file:')) {
        const archive = resolve(leaf, row.pin.slice(5));
        row.archive = relative(root, archive);
        row.archiveSha256 = createHash('sha256').update(await readFile(archive)).digest('hex');
        if (row.archiveSha256 !== '79ef00173ebb3ffa1c7f9bd9a4e20eeae3f00915aa0b645db8ea328e6b988599') throw new Error('Fork archive differs from reviewed bytes');
        const receipt = JSON.parse(await readFile(archive + '.provenance.json', 'utf8'));
        if (row.version !== receipt.package.version) throw new Error('Installed fork package version differs from archive receipt');
      } else if (row.version !== row.pin) throw new Error(`Installed ${row.version} differs from pin ${row.pin}`);
      for (const filename of ['bb-plugin-sdk.d.ts', 'bb-plugin-sdk-app.d.ts']) {
        try { await stat(join(leaf, 'types', filename)); errors.push(`${collection}/${id}: retains copied ${filename}`); }
        catch (error) { if (error.code !== 'ENOENT') throw error; }
      }
      const config = JSON.parse(await readFile(join(leaf, 'tsconfig.json'), 'utf8'));
      if (Object.keys(config.compilerOptions?.paths ?? {}).some(k => /^@(get-bb|bb)\/plugin-sdk/.test(k))) throw new Error('Retains SDK path map');
    } catch (error) { errors.push(`${collection}/${id}: ${error.message}`); }
    rows.push(row);
  }
}
console.log(JSON.stringify({ rows, errors }, null, 2));
process.exitCode = errors.length ? 1 : 0;
