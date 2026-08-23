import { execFileSync } from 'node:child_process';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const SOURCE_SUFFIX = '.html.js';

async function walk(dir) {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) files.push(...await walk(fullPath));
    else files.push(fullPath);
  }
  return files;
}

export function scanHtmlSource(text, file = '') {
  const urls = [...text.matchAll(/https?:\/\/[^\s"'`\\)<>]+/g)].map((match) => match[0]);
  const hosts = [...new Set(urls.flatMap((url) => {
    try { return [new URL(url).hostname]; } catch { return []; }
  }))].sort();
  const remoteAssets = urls.filter((url) => /\.(?:avif|gif|jpe?g|png|svg|webm|webp|woff2?)(?:[?#]|$)/i.test(url));

  return {
    id: path.basename(file, SOURCE_SUFFIX),
    file,
    sourceBytes: Buffer.byteLength(text),
    hosts,
    remoteAssetCount: remoteAssets.length,
    usesTailwindCdn: /cdn\.tailwindcss\.com/.test(text),
    usesGsap: /(?:cdnjs\.cloudflare\.com\/ajax\/libs\/gsap|\bgsap\.)/.test(text),
    usesIconify: /iconify/.test(text),
    usesThree: /(?:three(?:\.min)?\.js|\bTHREE\.)/.test(text),
    usesCanvas: /<canvas\b/i.test(text),
    hasReducedMotion: /prefers-reduced-motion/.test(text),
    hasVisibilityPause: /IntersectionObserver|visibilitychange/.test(text),
    selfContained: hosts.length === 0,
  };
}

export async function buildInventory(root) {
  const packageJson = JSON.parse(await fs.readFile(path.join(root, 'package.json'), 'utf8'));
  const sourceRoot = path.join(root, 'lib-dist', 'shaders');
  const sourceFiles = (await walk(sourceRoot)).filter((file) => file.endsWith(SOURCE_SUFFIX)).sort();
  const componentDir = path.join(root, 'src', 'package-components');
  const componentEntries = (await fs.readdir(componentDir)).filter((name) => name.endsWith('.ts')).sort();
  const sources = [];
  for (const file of sourceFiles) {
    sources.push(scanHtmlSource(await fs.readFile(file, 'utf8'), path.relative(root, file)));
  }

  let commit = 'unknown';
  try {
    commit = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim();
  } catch {}

  const counts = {
    packageComponentEntries: componentEntries.length,
    standaloneHtmlSources: sources.length,
    selfContained: sources.filter((item) => item.selfContained).length,
    usesTailwindCdn: sources.filter((item) => item.usesTailwindCdn).length,
    usesGsap: sources.filter((item) => item.usesGsap).length,
    usesIconify: sources.filter((item) => item.usesIconify).length,
    usesThree: sources.filter((item) => item.usesThree).length,
    usesCanvas: sources.filter((item) => item.usesCanvas).length,
    hasReducedMotion: sources.filter((item) => item.hasReducedMotion).length,
    hasVisibilityPause: sources.filter((item) => item.hasVisibilityPause).length,
  };

  return {
    source: 'https://github.com/MengTo/threeui',
    commit,
    package: `${packageJson.name}@${packageJson.version}`,
    counts,
    sources,
  };
}

async function main() {
  const root = path.resolve(process.argv[2] || '/home/paks11299958/threeui-community');
  const output = process.argv[3] ? path.resolve(process.argv[3]) : '';
  const inventory = await buildInventory(root);
  const json = `${JSON.stringify(inventory, null, 2)}\n`;
  if (output) {
    await fs.mkdir(path.dirname(output), { recursive: true });
    await fs.writeFile(output, json);
  } else {
    process.stdout.write(json);
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  await main();
}
