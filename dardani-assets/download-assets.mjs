// Downloads every Dardani image and video listed in asset-map.json into ./files/
// Usage (Node 18+):   node download-assets.mjs            -> transparent stills + mp4 + transparent webm loops
//                     node download-assets.mjs --with-backgrounds   -> also the stills with their original background
import { readFile, mkdir, writeFile, access } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const map = JSON.parse(await readFile(join(here, 'asset-map.json'), 'utf8'));
const withBg = process.argv.includes('--with-backgrounds');

const jobs = [];
for (const a of map.assets) {
  if (a.src) jobs.push({ url: a.src, file: a.file, page: a.page });
  if (a.src_alpha) jobs.push({ url: a.src_alpha, file: a.file_alpha, page: a.page_alpha });
  if (withBg && a.src_original) jobs.push({ url: a.src_original, file: a.original_file, page: a.page_original });
}

const exists = async (p) => access(p).then(() => true, () => false);
const failed = [];
let done = 0;

async function run(job) {
  const out = join(here, job.file);
  if (await exists(out)) { done++; return; }
  try {
    const res = await fetch(job.url);
    if (!res.ok) throw new Error('HTTP ' + res.status);
    const buf = Buffer.from(await res.arrayBuffer());
    await mkdir(dirname(out), { recursive: true });
    await writeFile(out, buf);
    done++;
    console.log(`✓ ${job.file}  (${(buf.length / 1024 / 1024).toFixed(1)} MB)`);
  } catch (e) {
    failed.push(job);
    console.log(`✗ ${job.file}  ${e.message}`);
  }
}

const queue = [...jobs];
await Promise.all(Array.from({ length: 4 }, async () => { while (queue.length) await run(queue.shift()); }));

console.log(`\n${done}/${jobs.length} files ready in ./files`);
if (failed.length) {
  console.log(`\n${failed.length} failed. The download links expire on ${map.links_expire}.`);
  console.log('Open these pages to download them by hand (or ask Claude for a fresh asset-map.json):');
  for (const f of failed) console.log(`  ${f.file}  ->  ${f.page}`);
  process.exitCode = 1;
}
