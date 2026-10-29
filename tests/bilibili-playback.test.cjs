const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const zlib = require('node:zlib');
const os = require('node:os');
const { spawnSync } = require('node:child_process');
const { pathToFileURL } = require('node:url');
const { test } = require('node:test');

const root = path.resolve(__dirname, '..');
const source = fs.readFileSync(path.join(root, 'Scripts/bilibili/response-playback.js'), 'utf8');
const plugin = fs.readFileSync(path.join(root, 'Plugins/bilibili.lpx'), 'utf8');
const supportedMd5 = '5bca6725b04c018358e69be749f0ee11';
const patchedMd5 = '106d21a147f49e9d4ef86e2e8523474f';
const unknownMd5 = '6faf11f0d7f7e5dd35ed4b2d282e1c00';

function varint(value) {
  const bytes = [];
  do {
    const byte = value & 127;
    value >>>= 7;
    bytes.push(byte | (value ? 128 : 0));
  } while (value);
  return Buffer.from(bytes);
}

function bytesField(number, value) {
  const bytes = Buffer.from(value);
  return Buffer.concat([varint(number * 8 + 2), varint(bytes.length), bytes]);
}

function messageFields(body) {
  const fields = new Map();
  let offset = 0;
  function readVarint() {
    let value = 0;
    let shift = 0;
    for (let count = 0; count < 10 && offset < body.length; count++) {
      const byte = body[offset++];
      value += (byte & 127) * 2 ** shift;
      if (!(byte & 128)) return value;
      shift += 7;
    }
    throw new Error('Invalid protobuf varint');
  }
  while (offset < body.length) {
    const key = readVarint();
    const wire = key % 8;
    let value;
    if (wire === 2) {
      const size = readVarint();
      value = body.subarray(offset, offset + size);
      offset += size;
    } else if (wire === 0) {
      value = readVarint();
    } else if (wire === 1 || wire === 5) {
      const size = wire === 1 ? 8 : 4;
      value = body.subarray(offset, offset + size);
      offset += size;
    } else {
      throw new Error(`Unexpected wire type ${wire}`);
    }
    assert.ok(offset <= body.length);
    fields.set(Math.floor(key / 8), value);
  }
  return fields;
}

function frame(body, compressed = false) {
  const payload = compressed ? zlib.gzipSync(body) : body;
  const header = Buffer.alloc(5);
  header[0] = compressed ? 1 : 0;
  header.writeUInt32BE(payload.length, 1);
  return Buffer.concat([header, payload]);
}

function unframe(body) {
  const bytes = Buffer.from(body);
  assert.equal(bytes.readUInt32BE(1), bytes.length - 5);
  return bytes[0] ? zlib.gunzipSync(bytes.subarray(5)) : bytes.subarray(5);
}

function fixture(md5, compressed) {
  const chronos = Buffer.concat([
    bytesField(1, md5),
    bytesField(2, 'https://example.invalid/official.zip'),
    bytesField(3, 'official-signature'),
  ]);
  return frame(Buffer.concat([
    bytesField(2, chronos),
    bytesField(4, bytesField(2, 'interactive-card')),
    bytesField(99, 'future-field'),
  ]), compressed);
}

async function run(body, sponsorBlock, view = 'viewunite', argumentMode = 'object') {
  let finish;
  const logs = [];
  const done = new Promise(resolve => { finish = resolve; });
  const sandbox = {
    URL, TextEncoder, TextDecoder, Uint8Array, ArrayBuffer, DataView,
    console: {
      log: (...args) => logs.push(args.join(' ')),
      warn: (...args) => logs.push(args.join(' ')),
      error: (...args) => logs.push(args.join(' ')),
    },
    $loon: {},
    $utils: { ungzip: bytes => Uint8Array.from(zlib.gunzipSync(bytes)) },
    $argument: argumentMode === 'json'
      ? JSON.stringify({ sponsorBlock, logLevel: 'off' })
      : { sponsorBlock, logLevel: 'off' },
    $request: {
      method: 'POST',
      url: `https://grpc.biliapi.net/bilibili.app.${view}.v1.View/ViewProgress`,
      headers: { 'user-agent': 'bili-universal/91700100' },
    },
    $response: {
      status: 200,
      headers: { 'content-type': 'application/grpc', 'grpc-encoding': 'gzip' },
      h2_trailers: { 'grpc-status': '0' },
      body: Uint8Array.from(body),
    },
    $persistentStore: { read: () => null, write: () => true },
    $done: finishResult => finish(finishResult),
  };
  vm.runInNewContext(source, sandbox, { timeout: 3000 });
  let timer;
  try {
    const result = await Promise.race([
      done,
      new Promise((_, reject) => { timer = setTimeout(() => reject(new Error('Script timed out')), 3000); }),
    ]);
    assert.ok(result.body, `Script should return a valid response body: ${logs.join('\n')}`);
    assert.equal((result.h2_trailers ?? sandbox.$response.h2_trailers)['grpc-status'], '0');
    return unframe(result.body);
  } finally {
    clearTimeout(timer);
  }
}

for (const compressed of [false, true]) {
  for (const view of ['view', 'viewunite']) {
    test(`${view}: unknown Chronos is preserved (gzip=${compressed})`, async () => {
      const input = fixture(unknownMd5, compressed);
      const before = messageFields(unframe(input));
      const after = messageFields(await run(input, true, view));
      assert.deepEqual(after.get(2), before.get(2));
      assert.deepEqual(after.get(99), before.get(99));
    });

    test(`${view}: disabling SponsorBlock preserves supported Chronos (gzip=${compressed})`, async () => {
      const input = fixture(supportedMd5, compressed);
      const after = messageFields(await run(input, false, view, 'json'));
      assert.deepEqual(after.get(2), messageFields(unframe(input)).get(2));
    });
  }
}

test('supported Chronos still receives the SponsorBlock patch', async () => {
  const after = messageFields(await run(fixture(supportedMd5, true), true));
  const chronos = messageFields(after.get(2));
  assert.equal(chronos.get(1).toString(), patchedMd5);
  assert.equal(chronos.get(2).toString(), `https://raw.githubusercontent.com/kokoryh/chronos/refs/heads/master/${patchedMd5}.zip`);
  assert.equal(chronos.has(3), false);
});

test('DmSegMobile interception can be disabled in the plugin', () => {
  const rules = plugin.split('\n').filter(line => line.includes('DM\\/DmSegMobile'));
  assert.equal(rules.length, 1);
  assert.match(rules[0], /enable=\{sponsorBlock\}/);
});

test('only the compatibility script handles ViewProgress and receives the switch', () => {
  const rules = plugin.split('\n').filter(line => line.includes('ViewProgress'));
  assert.equal(rules.length, 1);
  assert.ok(rules[0].includes('response-playback.js'));
  assert.ok(rules[0].includes('${sponsorBlock}'));
  assert.ok(rules[0].includes('(?:view|viewunite)'));
  const compiled = plugin.split('\n').filter(line => line.startsWith('response if ')).map(line => {
    const match = line.match(/~= \/(.+)\/i then/);
    return match && { line, regex: new RegExp(match[1], 'i') };
  }).filter(Boolean);
  for (const host of ['grpc.biliapi.net', 'app.bilibili.com']) {
    for (const view of ['view', 'viewunite']) {
      const url = `https://${host}/bilibili.app.${view}.v1.View/ViewProgress`;
      const matched = compiled.filter(rule => rule.regex.test(url));
      assert.equal(matched.length, 1);
      assert.ok(matched[0].line.includes('response-playback.js'));
    }
  }
});

test('sync refuses changed upstream code without overwriting published files', () => {
  const folder = fs.mkdtempSync(path.join(os.tmpdir(), 'bilibili-sync-'));
  try {
    const pluginFixture = path.join(folder, 'upstream.lpx');
    const scriptFixture = path.join(folder, 'upstream.js');
    const target = path.join(folder, 'plugin.lpx');
    const scriptTarget = path.join(folder, 'playback.js');
    fs.writeFileSync(pluginFixture, '#!name=Test\n[Script]\n');
    fs.writeFileSync(scriptFixture, '// Upstream changed its implementation.\n');
    fs.writeFileSync(target, 'existing-plugin');
    fs.writeFileSync(scriptTarget, 'existing-script');
    const result = spawnSync('pwsh', [
      '-NoProfile', '-File', path.join(root, 'tools/update-bilibili.ps1'),
      '-SourceUrl', pathToFileURL(pluginFixture).href,
      '-ResponseSourceUrl', pathToFileURL(scriptFixture).href,
      '-TargetPath', 'plugin.lpx', '-PlaybackScriptPath', 'playback.js',
    ], { cwd: folder, encoding: 'utf8' });
    assert.ifError(result.error);
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /Upstream Chronos implementation changed/);
    assert.equal(fs.readFileSync(target, 'utf8'), 'existing-plugin');
    assert.equal(fs.readFileSync(scriptTarget, 'utf8'), 'existing-script');
  } finally {
    assert.equal(path.dirname(folder), os.tmpdir());
    assert.ok(path.basename(folder).startsWith('bilibili-sync-'));
    fs.rmSync(folder, { recursive: true, force: true });
  }
});

// Private captures are opt-in and are never checked into the repository.
if (process.env.BILIBILI_HAR_PATH) {
  const har = JSON.parse(fs.readFileSync(process.env.BILIBILI_HAR_PATH, 'utf8'));
  for (const [index, entry] of har.log.entries.entries()) {
    if (!/bilibili\.app\.(?:view|viewunite)\.v1\.View\/ViewProgress$/.test(entry.request.url)) continue;
    test(`HAR entry ${index}: preserve official Chronos bytes`, async () => {
      const captured = entry.response._loonOriginal?.content;
      assert.equal(captured?.encoding, 'base64');
      const input = Buffer.from(captured.text, 'base64');
      const before = messageFields(unframe(input));
      const view = entry.request.url.includes('.viewunite.') ? 'viewunite' : 'view';
      const after = messageFields(await run(input, true, view));
      assert.deepEqual(after.get(2), before.get(2));
      for (const [number, value] of before) {
        if (view === 'viewunite' ? number === 4 : number === 1) continue;
        assert.deepEqual(after.get(number), value);
      }
    });
  }
}
