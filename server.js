// Web2APK builder – local server. Run: node server.js  →  http://localhost:3000
const http = require('http');
const fs = require('fs');
const fsp = fs.promises;
const path = require('path');
const crypto = require('crypto');
const os = require('os');
const { spawn, execFileSync } = require('child_process');

const PORT = process.env.PORT || 3000;
const ROOT = __dirname;
const TEMPLATE = path.join(ROOT, 'template');
const BUILDS = path.join(ROOT, 'builds');
const CACHE = path.join(ROOT, 'cache');
const KEYDIR = path.join(ROOT, 'keystore');
const PUBLIC = path.join(ROOT, 'public');
const IS_WIN = process.platform === 'win32';
const BLOCKLIST_URL = 'https://raw.githubusercontent.com/StevenBlack/hosts/master/hosts';

for (const d of [BUILDS, CACHE, KEYDIR]) fs.mkdirSync(d, { recursive: true });

// ---------------------------------------------------------------- environment
function findAndroidSdk() {
  const c = [process.env.ANDROID_HOME, process.env.ANDROID_SDK_ROOT,
    path.join(os.homedir(), 'AppData', 'Local', 'Android', 'Sdk'),
    path.join(os.homedir(), 'Library', 'Android', 'sdk'),
    path.join(os.homedir(), 'Android', 'Sdk')].filter(Boolean);
  return c.find(p => fs.existsSync(path.join(p, 'platforms')));
}
function findKeytool() {
  const exe = IS_WIN ? 'keytool.exe' : 'keytool';
  if (process.env.JAVA_HOME) {
    const p = path.join(process.env.JAVA_HOME, 'bin', exe);
    if (fs.existsSync(p)) return p;
  }
  try { // ask java where it lives (java.exe on PATH is often only a shim)
    const r = require('child_process').spawnSync('java', ['-XshowSettings:properties', '-version'], { encoding: 'utf8' });
    const m = (r.stderr + r.stdout).match(/java\.home = (.+)/);
    if (m) { const p = path.join(m[1].trim(), 'bin', exe); if (fs.existsSync(p)) return p; }
  } catch {}
  return exe;
}
const SDK = findAndroidSdk();

function ensureKeystore() {
  const info = path.join(KEYDIR, 'keystore.json');
  if (fs.existsSync(info)) return JSON.parse(fs.readFileSync(info, 'utf8'));
  const pass = crypto.randomBytes(12).toString('hex');
  const file = path.join(KEYDIR, 'webapk.jks');
  execFileSync(findKeytool(), ['-genkeypair', '-v', '-keystore', file, '-storepass', pass, '-keypass', pass,
    '-alias', 'webapk', '-keyalg', 'RSA', '-keysize', '2048', '-validity', '10000',
    '-dname', 'CN=Web2APK, OU=Apps, O=Web2APK, C=US'], { stdio: 'ignore' });
  const data = { file, pass, alias: 'webapk' };
  fs.writeFileSync(info, JSON.stringify(data, null, 2));
  return data;
}

async function getStrongBlocklist(log) {
  const out = path.join(CACHE, 'adhosts.txt');
  try {
    const st = await fsp.stat(out);
    if (Date.now() - st.mtimeMs < 7 * 864e5) return out;
  } catch {}
  log('Downloading latest ad-block list...');
  try {
    const res = await fetch(BLOCKLIST_URL);
    if (!res.ok) throw new Error('HTTP ' + res.status);
    const text = await res.text();
    const hosts = new Set();
    for (const line of text.split('\n')) {
      const m = line.match(/^\s*0\.0\.0\.0\s+([^\s#]+)/);
      if (m && m[1] !== '0.0.0.0' && m[1].includes('.')) hosts.add(m[1].toLowerCase());
    }
    await fsp.writeFile(out, [...hosts].join('\n'));
    log(`Ad-block list ready: ${hosts.size} domains`);
    return out;
  } catch (e) {
    log('Could not download ad-block list (' + e.message + '), using built-in list.');
    return fs.existsSync(out) ? out : null;
  }
}

// ---------------------------------------------------------------- build queue
const jobs = new Map();

function publicJob(j) {
  const b = j.body || {};
  return {
    status: j.status, log: j.log || [], fileName: j.fileName, size: j.size,
    appName: b.appName || j.appName, packageName: b.packageName || j.packageName,
    versionName: b.versionName || j.versionName, created: j.created,
    hasIcon: fs.existsSync(path.join(BUILDS, j.id, 'icon.png')),
    position: queue.indexOf(j) + 1,
  };
}

async function saveJobMeta(job) {
  const meta = { id: job.id, status: job.status, fileName: job.fileName, size: job.size, created: job.created,
    appName: job.body.appName, packageName: job.body.packageName, versionName: job.body.versionName, log: [] };
  await fsp.writeFile(path.join(BUILDS, job.id, 'job.json'), JSON.stringify(meta, null, 2));
}

// finished builds survive a server restart (so old QR codes / links keep working)
function loadSavedJobs() {
  for (const id of fs.readdirSync(BUILDS)) {
    try {
      const meta = JSON.parse(fs.readFileSync(path.join(BUILDS, id, 'job.json'), 'utf8'));
      meta.apk = path.join(BUILDS, id, meta.fileName);
      if (meta.status === 'done' && fs.existsSync(meta.apk)) jobs.set(id, meta);
    } catch {}
  }
}
loadSavedJobs();
const queue = [];
let busy = false;

function xmlEscape(s) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '\\"').replace(/'/g, "\\'");
}

async function copyDir(src, dst) {
  await fsp.mkdir(dst, { recursive: true });
  for (const e of await fsp.readdir(src, { withFileTypes: true })) {
    if (['build', '.gradle', '.kotlin', 'local.properties'].includes(e.name)) continue;
    const s = path.join(src, e.name), d = path.join(dst, e.name);
    if (e.isDirectory()) await copyDir(s, d); else await fsp.copyFile(s, d);
  }
}

function validate(b) {
  const errors = [];
  let url;
  try { url = new URL(b.config.url); if (!/^https?:$/.test(url.protocol)) throw 0; } catch { errors.push('Enter a valid website URL (https://...)'); }
  const sites = b.config.sites;
  if (sites !== undefined && !Array.isArray(sites)) errors.push('Invalid site list');
  else if (sites && sites.length > 20) errors.push('Add at most 20 websites');
  else (sites || []).forEach((s, i) => {
    try { if (!/^https?:$/.test(new URL(s.url).protocol)) throw 0; } catch { errors.push(`Site ${i + 1}: enter a valid website URL (https://...)`); }
    if (typeof s.name !== 'string' || !s.name.trim() || s.name.length > 40) errors.push(`Site ${i + 1}: name must be 1-40 characters`);
  });
  if (!b.appName || b.appName.length > 50) errors.push('App name must be 1-50 characters');
  if (!/^[a-zA-Z][a-zA-Z0-9_]*(\.[a-zA-Z][a-zA-Z0-9_]*)+$/.test(b.packageName || '')) errors.push('Invalid package name (e.g. com.mysite.app)');
  if (!/^\d{1,9}$/.test(String(b.versionCode))) errors.push('Version code must be a whole number');
  if (!/^[\w.\-]{1,20}$/.test(b.versionName || '')) errors.push('Invalid version name (e.g. 1.0.0)');
  if (b.config.themeColor && !/^#[0-9a-fA-F]{6}$/.test(b.config.themeColor)) errors.push('Invalid theme color');
  if (b.iconBg && !/^#[0-9a-fA-F]{6}$/.test(b.iconBg)) errors.push('Invalid icon color');
  return errors;
}

async function runBuild(job) {
  const { body } = job;
  const log = (m) => { job.log.push(m); };
  const dir = path.join(BUILDS, job.id);
  const proj = path.join(dir, 'project');
  try {
    if (!SDK) throw new Error('Android SDK not found. Set the ANDROID_HOME environment variable.');
    job.status = 'building';
    log('Preparing Kotlin project...');
    await copyDir(TEMPLATE, proj);
    const main = path.join(proj, 'app', 'src', 'main');

    await fsp.writeFile(path.join(proj, 'local.properties'), 'sdk.dir=' + SDK.replace(/\\/g, '\\\\').replace(/:/g, '\\:') + '\n');
    await fsp.writeFile(path.join(main, 'assets', 'config.json'), JSON.stringify(body.config, null, 2));
    await fsp.writeFile(path.join(main, 'res', 'values', 'strings.xml'),
      `<?xml version="1.0" encoding="utf-8"?>\n<resources>\n    <string name="app_name">${xmlEscape(body.appName)}</string>\n</resources>\n`);
    await fsp.writeFile(path.join(main, 'res', 'values', 'colors.xml'),
      `<?xml version="1.0" encoding="utf-8"?>\n<resources>\n    <color name="ic_launcher_background">${body.iconBg || body.config.themeColor || '#2563EB'}</color>\n</resources>\n`);

    if (body.iconForeground && body.iconForeground.startsWith('data:image/png;base64,')) {
      const png = Buffer.from(body.iconForeground.split(',')[1], 'base64');
      await fsp.rm(path.join(main, 'res', 'drawable', 'ic_launcher_foreground.xml'), { force: true });
      await fsp.mkdir(path.join(main, 'res', 'drawable-nodpi'), { recursive: true });
      await fsp.writeFile(path.join(main, 'res', 'drawable-nodpi', 'ic_launcher_foreground.png'), png);
      log('Custom icon added');
    }

    if (body.config.adBlock && body.strongBlocklist) {
      const list = await getStrongBlocklist(log);
      if (list) await fsp.copyFile(list, path.join(main, 'assets', 'adhosts.txt'));
    }

    const ks = ensureKeystore();
    const gradlew = IS_WIN ? path.join(proj, 'gradlew.bat') : path.join(proj, 'gradlew');
    if (!IS_WIN) await fsp.chmod(gradlew, 0o755);
    const args = ['assembleRelease', '--console=plain',
      `-Pwebapk.appId=${body.packageName}`, `-Pwebapk.versionCode=${body.versionCode}`,
      `-Pwebapk.versionName=${body.versionName}`, `-Pwebapk.storeFile=${ks.file}`,
      `-Pwebapk.storePassword=${ks.pass}`, `-Pwebapk.keyAlias=${ks.alias}`, `-Pwebapk.keyPassword=${ks.pass}`];
    log('Compiling Kotlin & building APK (first build may take a few minutes)...');
    await new Promise((resolve, reject) => {
      const q = (a) => (IS_WIN && /\s/.test(a) ? `"${a}"` : a);
      const p = spawn(q(gradlew), args.map(q), { cwd: proj, shell: IS_WIN, env: { ...process.env, ANDROID_HOME: SDK } });
      const onData = (d) => d.toString().split(/\r?\n/).forEach(l => {
        if (/^> Task|BUILD|error|FAIL|e: /i.test(l)) log(l.trim());
      });
      p.stdout.on('data', onData);
      p.stderr.on('data', onData);
      p.on('error', reject);
      p.on('close', code => code === 0 ? resolve() : reject(new Error('Gradle build failed (code ' + code + ')')));
    });

    const apkSrc = path.join(proj, 'app', 'build', 'outputs', 'apk', 'release', 'app-release.apk');
    const safeName = body.appName.replace(/[^\w\-]+/g, '_').replace(/^_+|_+$/g, '') || 'app';
    job.fileName = `${safeName}-v${body.versionName}.apk`;
    job.apk = path.join(dir, job.fileName);
    await fsp.copyFile(apkSrc, job.apk);
    job.size = (await fsp.stat(job.apk)).size;
    await fsp.rm(proj, { recursive: true, force: true }).catch(() => {});
    job.status = 'done';
    await saveJobMeta(job);
    log(`APK ready: ${job.fileName} (${(job.size / 1024).toFixed(0)} KB)`);
  } catch (e) {
    job.status = 'error';
    log('ERROR: ' + e.message);
  }
}

async function pump() {
  if (busy) return;
  const job = queue.shift();
  if (!job) return;
  busy = true;
  await runBuild(job);
  busy = false;
  pump();
}

// ---------------------------------------------------------------- http
function lanUrls() {
  const out = [];
  for (const list of Object.values(os.networkInterfaces()))
    for (const a of list || []) if (a.family === 'IPv4' && !a.internal) out.push(a.address);
  // home Wi-Fi addresses first, virtual adapters (WSL / VirtualBox, usually 172.x) last
  const rank = (ip) => ip.startsWith('192.168.') ? 0 : ip.startsWith('10.') ? 1 : 2;
  return out.sort((x, y) => rank(x) - rank(y)).map(ip => `http://${ip}:${PORT}`);
}

const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.svg': 'image/svg+xml', '.json': 'application/json' };

function send(res, code, obj) {
  res.writeHead(code, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(obj));
}

function readBody(req, limit = 5e6) {
  return new Promise((resolve, reject) => {
    let size = 0; const chunks = [];
    req.on('data', c => { size += c.length; if (size > limit) { reject(new Error('Too large')); req.destroy(); } else chunks.push(c); });
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    req.on('error', reject);
  });
}

const server = http.createServer(async (req, res) => {
  const u = new URL(req.url, 'http://x');
  try {
    if (req.method === 'POST' && u.pathname === '/api/build') {
      const body = JSON.parse(await readBody(req));
      body.config = body.config || {};
      const errors = validate(body);
      if (errors.length) return send(res, 400, { errors });
      const id = Date.now().toString(36) + crypto.randomBytes(3).toString('hex');
      const job = { id, body, status: 'queued', log: ['Queued'], created: Date.now() };
      jobs.set(id, job);
      await fsp.mkdir(path.join(BUILDS, id), { recursive: true });
      if (typeof body.iconPreview === 'string' && body.iconPreview.startsWith('data:image/png;base64,')) {
        await fsp.writeFile(path.join(BUILDS, id, 'icon.png'), Buffer.from(body.iconPreview.split(',')[1], 'base64'));
      }
      delete body.iconPreview;
      queue.push(job);
      pump();
      return send(res, 200, { id });
    }
    let m;
    if (req.method === 'GET' && (m = u.pathname.match(/^\/api\/build\/(\w+)$/))) {
      const j = jobs.get(m[1]);
      if (!j) return send(res, 404, { error: 'not found' });
      return send(res, 200, publicJob(j));
    }
    if (req.method === 'GET' && (m = u.pathname.match(/^\/icon\/(\w+)$/))) {
      const file = path.join(BUILDS, m[1], 'icon.png');
      if (!fs.existsSync(file)) { res.writeHead(404); return res.end('Not found'); }
      res.writeHead(200, { 'Content-Type': 'image/png', 'Cache-Control': 'max-age=86400' });
      return fs.createReadStream(file).pipe(res);
    }
    if (req.method === 'GET' && /^\/install\/\w+$/.test(u.pathname)) {
      res.writeHead(200, { 'Content-Type': MIME['.html'] });
      return fs.createReadStream(path.join(PUBLIC, 'install', 'index.html')).pipe(res);
    }
    if (req.method === 'GET' && (m = u.pathname.match(/^\/download\/(\w+)$/))) {
      const j = jobs.get(m[1]);
      if (!j || j.status !== 'done') { res.writeHead(404); return res.end('Not found'); }
      res.writeHead(200, {
        'Content-Type': 'application/vnd.android.package-archive',
        'Content-Disposition': `attachment; filename="${j.fileName}"`,
        'Content-Length': j.size,
      });
      return fs.createReadStream(j.apk).pipe(res);
    }
    if (req.method === 'GET' && u.pathname === '/api/status') {
      return send(res, 200, { sdk: !!SDK, lan: lanUrls() });
    }
    if (req.method === 'GET') {
      const file = path.normalize(path.join(PUBLIC, u.pathname === '/' ? 'index.html' : u.pathname));
      if (!file.startsWith(PUBLIC) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) { res.writeHead(404); return res.end('Not found'); }
      res.writeHead(200, { 'Content-Type': MIME[path.extname(file)] || 'application/octet-stream' });
      return fs.createReadStream(file).pipe(res);
    }
    res.writeHead(405); res.end();
  } catch (e) {
    send(res, 500, { error: e.message });
  }
});

server.listen(PORT, () => {
  console.log(`\n  Web2APK running →  http://localhost:${PORT}\n`);
  for (const u of lanUrls()) console.log(`  On your network:  ${u}`);
  console.log('  Android SDK:', SDK || 'NOT FOUND (set ANDROID_HOME)');
  console.log('\n  Keep this window open while you use Web2APK. Press Ctrl+C to stop.\n');
});
