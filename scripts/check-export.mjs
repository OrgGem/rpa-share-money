// Local recovery checks; no network or deployment steps.
import { createHash } from 'node:crypto';
import { readdir, readFile } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = fileURLToPath(new URL('../', import.meta.url));
const manifest = JSON.parse(await readFile(path.join(root, 'recovery-manifest.json'), 'utf8'));
async function walk(dir) {
  const result = [];
  for (const item of await readdir(path.join(root, dir), { withFileTypes: true })) {
    const name = path.posix.join(dir, item.name);
    if (['.git', '.build', 'node_modules', '__pycache__'].includes(item.name)) continue;
    if (item.isSymbolicLink()) throw new Error(`Unexpected symlink: ${name}`);
    if (item.isDirectory()) result.push(...await walk(name));
    else result.push(name);
  }
  return result;
}
const files = await walk('');
for (const item of manifest.artifacts) {
  const content = await readFile(path.join(root, item.path));
  if (content.length !== item.bytes || createHash('sha256').update(content).digest('hex') !== item.sha256) {
    throw new Error(`Artifact hash differs: ${item.path}`);
  }
}
const actual = files.filter(p => p.startsWith('recovered/')).sort();
if (JSON.stringify(actual) !== JSON.stringify(manifest.artifacts.map(a => a.path).sort())) {
  throw new Error('Recovered artifact inventory differs from manifest');
}
const forbidden = [
  /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/,
  /\b(?:gh[pousr]_[A-Za-z0-9]{20,}|github_pat_[A-Za-z0-9_]{30,}|AIza[A-Za-z0-9_-]{30,})\b/,
  /https:\/\/script\.google\.com\/macros\/s\/[^\s/"'`]+\/exec/,
  /["'](?:account_id|zone_id|namespace_id|bucket_name)["']\s*:\s*["'][^"']+["']/,
  /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/i,
  /["'](?:\d{8,})["']/
];
for (const file of files) {
  if (/\.(?:pem|key|log|tgz|zip)$/.test(file) || /(?:^|\/)\.env(?:\.|$)|(?:^|\/)\.dev\.vars/.test(file)) {
    throw new Error(`Private/generated file in export: ${file}`);
  }
  const content = await readFile(path.join(root, file), 'utf8');
  // Public upstream author attribution is retained in license notices.
  if (!file.startsWith('third-party-licenses/')) {
    for (const pattern of forbidden) if (pattern.test(content)) throw new Error(`Sensitive-value candidate in ${file}: ${pattern.source}`);
  }
  if (/\.(mjs|js)$/.test(file)) {
    const result = spawnSync(process.execPath, ['--check', path.join(root, file)], { encoding: 'utf8' });
    if (result.status !== 0) throw new Error(result.stderr);
  }
}
const extraction = spawnSync('python3', ['scripts/extract-embedded.py', '--check'], { cwd: root, encoding: 'utf8' });
if (extraction.status !== 0) throw new Error(extraction.stderr || extraction.stdout);
console.log(extraction.stdout.trim());
console.log(`${manifest.artifacts.length} artifact hashes, syntax and export candidate scan passed (${files.length} files).`);
