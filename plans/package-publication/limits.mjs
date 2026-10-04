// Verbatim acceptance-limit extraction, shared by archive.sh (producer) and archive-check.sh (oracle).
// Returns every complete line of an evidence item that states a limit, certification status or hold.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
const LIMIT = /hostCertified|certif|[Pp]roven|HOLD|[Ll]imit|cleanupComplete|capabilityPromotion|evidenceKind|source-test-not-host|UNKNOWN/;
export function limits(bytes) {
  const text = Buffer.from(bytes).toString('utf8');
  if (text.includes('\u0000')) return [];
  return text.split('\n').filter((l) => LIMIT.test(l));
}
// CLI only when executed directly (node limits.mjs FILE), never when imported.
if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) console.log(JSON.stringify(limits(readFileSync(process.argv[2]))));
