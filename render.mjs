import { createServer } from 'node:http';
import { createReadStream, existsSync, mkdirSync, rmSync } from 'node:fs';
import { extname, resolve, sep } from 'node:path';
import { spawnSync } from 'node:child_process';
import { chromium } from 'playwright';

const root = process.cwd();
const framesDir = resolve(root, '.render-frames');
const output = resolve(root, 'assets/ironman-hover.webp');
if (!existsSync(resolve(root, 'ironman.glb'))) throw new Error('ironman.glb is missing from the project root.');
if (!existsSync(resolve(root, 'node_modules/three'))) throw new Error('Install dependencies first with npm install.');
mkdirSync(framesDir, { recursive: true });
mkdirSync(resolve(root, 'assets'), { recursive: true });

const types = { '.html': 'text/html', '.js': 'text/javascript', '.glb': 'model/gltf-binary' };
const server = createServer((request, response) => {
  const pathname = decodeURIComponent(new URL(request.url, 'http://localhost').pathname);
  const file = resolve(root, `.${pathname}`);
  if (file !== root && !file.startsWith(root + sep)) { response.writeHead(403).end(); return; }
  if (!existsSync(file)) { response.writeHead(404).end('Not found'); return; }
  response.setHeader('Content-Type', types[extname(file)] ?? 'application/octet-stream');
  createReadStream(file).pipe(response);
});

let browser;
try {
  await new Promise((done) => server.listen(0, '127.0.0.1', done));
  const address = server.address();
  browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 800, height: 600 }, deviceScaleFactor: 1 });
  page.on('pageerror', (error) => console.error('Browser error:', error.message));
  await page.goto(`http://127.0.0.1:${address.port}/render.html`, { waitUntil: 'networkidle' });
  await page.waitForFunction(() => window.ready === true, { timeout: 60000 });
  const modelInfo = await page.evaluate(() => ({
    ...window.modelInfo,
    screenshotMaterialCount: window.modelInfo.materials.length,
    screenshotTextureCount: window.modelInfo.textures.length,
    layout: Object.fromEntries(['stage', 'quote', 'view'].map((id) => {
      const { x, y, width, height } = document.querySelector(`#${id}`).getBoundingClientRect();
      return [id, { x, y, width, height }];
    }))
  }));
  console.log('Loaded model:', JSON.stringify(modelInfo));
  if (!modelInfo.meshes || modelInfo.screenshotMaterialCount === 0) throw new Error('The GLB loaded without visible meshes or materials.');

  if (process.argv.includes('--inspect')) {
    console.log('Mesh bounds:', JSON.stringify(modelInfo.largestMeshes, null, 2));
  } else if (process.argv.includes('--check-loop')) {
    await page.evaluate(() => window.renderAtTime(0));
    const start = await page.screenshot();
    await page.evaluate(() => window.renderAtTime(6));
    const end = await page.screenshot();
    if (!start.equals(end)) throw new Error('The scene at 0 and 6 seconds did not render identically.');
    console.log('Loop boundary: t=0 and t=6 render pixel-identically.');
  } else {
    for (let i = 0; i < 180; i++) {
      await page.evaluate((seconds) => window.renderAtTime(seconds), i / 30);
      await page.screenshot({ path: resolve(framesDir, `frame-${String(i).padStart(3, '0')}.png`) });
    }
    await browser.close();
    browser = undefined;

    const encode = spawnSync('python', [resolve(root, 'encode_webp.py'), framesDir, output], { stdio: 'inherit' });
    if (encode.status !== 0) throw new Error('Animated WebP encoding failed.');
    console.log(`Wrote ${output}`);
  }
} finally {
  if (browser) await browser.close();
  server.close();
  rmSync(framesDir, { recursive: true, force: true });
}
