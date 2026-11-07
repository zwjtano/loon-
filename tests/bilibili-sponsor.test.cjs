const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const zlib = require('node:zlib');
const { spawnSync } = require('node:child_process');
const { test } = require('node:test');

const root = path.resolve(__dirname, '..');

test('both variants connect ViewProgress to one sponsor-gated upstream request script', () => {
  for (const file of ['bilibili.lpx', 'bilibili-global.lpx']) {
    const lines = fs.readFileSync(path.join(root, 'Plugins', file), 'utf8').split(/\r?\n/);
    assert.match(lines.find(line => line.startsWith('sponsorBlock=')), /9\.17\.0/);
    const rules = lines.filter(line => line.startsWith('request if ') && line.includes(' then script(')).map(line => ({
      line, regex: new RegExp(line.match(/~= \/(.+)\/i? then/)[1], 'i'),
    }));
    for (const host of ['app.bilibili.com', 'grpc.biliapi.net']) {
      for (const endpoint of ['view', 'viewunite']) {
        const matched = rules.filter(rule => rule.regex.test(`https://${host}/bilibili.app.${endpoint}.v1.View/ViewProgress`));
        assert.equal(matched.length, 1, `${file}: ${host}/${endpoint}`);
        assert.ok(matched[0].line.includes('https://rucu6.pages.dev/Scripts/bilibili/request.js'));
        for (const setting of ['enable=${sponsorBlock}', '${logLevel}', 'timeout=10', 'requires_body=true', 'binary_body_mode=true']) {
          assert.ok(matched[0].line.includes(setting), setting);
        }
      }
    }
  }
});

test('sync refuses sponsor bundles that lack supported routes', () => {
  const command = `
    $tokens=$null; $errors=$null
    $ast=[System.Management.Automation.Language.Parser]::ParseFile((Join-Path (Get-Location) 'tools/update-bilibili.ps1'),[ref]$tokens,[ref]$errors)
    $function=$ast.Find({param($node) $node -is [System.Management.Automation.Language.FunctionDefinitionAst] -and $node.Name -eq 'Assert-SponsorRequestScript'},$true)
    Invoke-Expression $function.Extent.Text
    Assert-SponsorRequestScript -Source 'view.v1.View/ViewProgress viewunite.v1.View/ViewProgress v1.DM/DmSegMobile'
    $refused=0
    foreach ($source in @('<html>unexpected</html>', 'v1.DM/DmSegMobile')) {
      try { Assert-SponsorRequestScript -Source $source } catch { $refused++ }
    }
    if ($refused -ne 2) { exit 1 }
  `;
  const result = spawnSync('pwsh', ['-NoProfile', '-Command', command], { cwd: root, encoding: 'utf8' });
  assert.ifError(result.error);
  assert.equal(result.status, 0, result.stderr);
});

// Opt-in replay uses the unmodified bundle fetched by the sync job, not private data.
if (process.env.BILIBILI_REQUEST_SCRIPT_PATH) {
  const source = fs.readFileSync(process.env.BILIBILI_REQUEST_SCRIPT_PATH, 'utf8');
  const unknown = Buffer.concat([Buffer.from([0x9a, 6, 7]), Buffer.from('keep-me')]);
  function frame(bytes, compressed = false) {
    const payload = compressed ? zlib.gzipSync(bytes) : bytes;
    const header = Buffer.alloc(5);
    header[0] = Number(compressed);
    header.writeUInt32BE(payload.length, 1);
    return Buffer.concat([header, payload]);
  }

  async function run(endpoint, { version = 91700000, compressed = false, segments = true, failService = false } = {}) {
    const network = [];
    const logs = [];
    let complete;
    let count = 0;
    let timer;
    const done = new Promise(resolve => { complete = resolve; });
    const request = {
      method: 'POST', url: `https://grpc.biliapi.net/bilibili.${endpoint}`,
      headers: { 'user-agent': `bili-universal/${version}`, 'content-type': 'application/grpc', te: 'trailers' },
      body: frame(Buffer.from(endpoint.endsWith('DmSegMobile') ? [8, 1, 16, 2, 24, 1] : [8, 1, 16, 2]), compressed),
    };
    const sandbox = {
      URL, TextEncoder, TextDecoder, Uint8Array, ArrayBuffer, DataView,
      console: { log: (...args) => logs.push(args.join(' ')) },
      $loon: 'Loon', $request: request, $argument: { logLevel: 'error' },
      $utils: { ungzip: bytes => Uint8Array.from(zlib.gunzipSync(bytes)) },
      $persistentStore: { read() { return null; }, write() { return true; } },
      $httpClient: {
        post(value, callback) {
          network.push(value.url);
          callback(null, { status: 200, headers: { 'content-type': 'application/grpc' }, h2_trailers: { 'grpc-status': '0' } }, frame(unknown, compressed));
        },
        get(value, callback) {
          network.push(value.url);
          if (failService) return callback('fixture service unavailable', {}, '');
          callback(null, { status: 200, headers: {} }, JSON.stringify(segments ? [{ actionType: 'skip', segment: [10.25, 20.5], videoDuration: 60 }] : []));
        },
      },
      $done(value) { count++; complete(value); },
    };
    try {
      vm.runInNewContext(source, sandbox, { timeout: 3000 });
      const result = await Promise.race([done, new Promise((_, reject) => { timer = setTimeout(() => reject(new Error('Sponsor replay timed out')), 5000); })]);
      await new Promise(resolve => setImmediate(resolve));
      assert.equal(count, 1);
      assert.ok(!logs.some(line => line.includes('[ERROR]')), logs.join('\n'));
      return { result, network };
    } finally { clearTimeout(timer); }
  }

  for (const endpoint of ['app.view.v1.View/ViewProgress', 'app.viewunite.v1.View/ViewProgress']) {
    for (const compressed of [false, true]) {
      test(`modern client receives sponsor chapters: ${endpoint}, gzip=${compressed}`, async () => {
        const { result, network } = await run(endpoint, { compressed });
        const body = Buffer.from(result.response.body);
        assert.equal(body.readUInt32BE(1), body.length - 5);
        assert.ok(body.includes(unknown));
        assert.ok(body.includes(Buffer.from('\u5e7f\u544a')));
        assert.ok(network.some(url => url.startsWith('https://bsbsb.top/api/skipSegments?') && url.includes('cid=2')));
        assert.equal(network.length, 2);
      });
    }
  }

  for (const failService of [false, true]) {
    test(`missing sponsor data does not invent chapters: service failure=${failService}`, async () => {
      const { result } = await run('app.viewunite.v1.View/ViewProgress', { segments: false, failService });
      const body = Buffer.from(result.response.body);
      assert.ok(body.includes(unknown));
      assert.ok(!body.includes(Buffer.from('\u5e7f\u544a')));
    });
  }

  test('legacy clients still receive upstream airborne danmaku', async () => {
    const { result, network } = await run('community.service.dm.v1.DM/DmSegMobile', { version: 91600000 });
    assert.ok(Buffer.from(result.response.body).includes(Buffer.from('airborne:20500')));
    assert.equal(network.length, 2);
  });

  test('the previous danmaku-only route does nothing on modern clients', async () => {
    const { result, network } = await run('community.service.dm.v1.DM/DmSegMobile');
    assert.equal(result.response, undefined);
    assert.equal(network.length, 0);
  });
}
