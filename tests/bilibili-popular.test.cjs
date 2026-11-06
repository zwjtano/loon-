const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const zlib = require('node:zlib');
const { test } = require('node:test');
const { spawnSync } = require('node:child_process');

const root = path.resolve(__dirname, '..');
const source = fs.readFileSync(path.join(root, 'Scripts/bilibili/popular.js'), 'utf8');
const originalList = '["rcmdOneItem","smallCoverV5Ad","topicList"]';
const patchedList = '["rcmdOneItem","smallCoverV5Ad",...(__loonPopularFilterHotSearch()?[\'topicList\']:[])]';

function varint(value) {
  const bytes = [];
  do {
    const low = value & 127;
    value >>>= 7;
    bytes.push(low | (value ? 128 : 0));
  } while (value);
  return Buffer.from(bytes);
}

function field(number, value) {
  const bytes = Buffer.from(value);
  return Buffer.concat([varint(number * 8 + 2), varint(bytes.length), bytes]);
}

function frame(payload, compressed) {
  const body = compressed ? zlib.gzipSync(payload) : payload;
  const header = Buffer.alloc(5);
  header[0] = compressed ? 1 : 0;
  header.writeUInt32BE(body.length, 1);
  return Buffer.concat([header, body]);
}

function fixture(compressed) {
  const base = Buffer.concat([field(6, 'normal-video'), field(14, 'recommend')]);
  const adBase = Buffer.concat([base, field(12, 'ad-info')]);
  const card = (kind, body) => field(1, field(kind, body));
  return frame(Buffer.concat([
    card(1, field(1, base)),
    card(1, field(1, adBase)),
    card(10, 'recommendation-card'),
    card(11, 'advertisement-card'),
    card(12, 'topic-card'),
    field(99, 'future-field'),
  ]), compressed);
}

function unframe(body) {
  const bytes = Buffer.from(body);
  assert.equal(bytes.readUInt32BE(1), bytes.length - 5);
  return bytes[0] ? zlib.gunzipSync(bytes.subarray(5)) : bytes.subarray(5);
}

function messageFields(body) {
  const output = [];
  let offset = 0;
  function readVarint() {
    let value = 0n;
    for (let index = 0; index < 10 && offset < body.length; index++) {
      const byte = body[offset++];
      value |= BigInt(byte & 127) << BigInt(index * 7);
      if (byte < 128) return value;
    }
    throw new Error('Invalid varint');
  }
  while (offset < body.length) {
    const key = Number(readVarint());
    const wire = key & 7;
    let value;
    if (wire === 2) {
      const length = Number(readVarint());
      value = body.subarray(offset, offset + length);
      offset += length;
    } else if (wire === 0) {
      value = readVarint();
    } else if (wire === 1 || wire === 5) {
      const length = wire === 1 ? 8 : 4;
      value = body.subarray(offset, offset + length);
      offset += length;
    } else {
      throw new Error('Unsupported wire type');
    }
    assert.ok(offset <= body.length);
    output.push({ number: key >>> 3, value });
  }
  return output;
}

async function run(body, argument, code = source, requestUrl = 'https://grpc.biliapi.net/bilibili.app.show.v1.Popular/Index') {
  const logs = [];
  let finish;
  let timer;
  const done = new Promise(resolve => { finish = resolve; });
  const sandbox = {
    URL, TextEncoder, TextDecoder, Uint8Array, ArrayBuffer, DataView,
    console: { log: (...args) => logs.push(args.join(' ')) },
    $loon: {}, $argument: argument,
    $utils: { ungzip: bytes => Uint8Array.from(zlib.gunzipSync(bytes)) },
    $request: {
      method: 'POST',
      url: requestUrl,
      headers: {},
    },
    $response: { status: 200, headers: {}, body: Uint8Array.from(body) },
    $persistentStore: { read: () => null, write: () => true },
    $done: finish,
  };
  try {
    vm.runInNewContext(code, sandbox, { timeout: 3000 });
    const result = await Promise.race([
      done,
      new Promise((_, reject) => { timer = setTimeout(() => reject(new Error('Timed out')), 3000); }),
    ]);
    assert.ok(result.body, `Script must return a valid body: ${logs.join('\n')}`);
    return unframe(result.body);
  } finally {
    clearTimeout(timer);
  }
}

for (const compressed of [false, true]) {
  for (const enabled of [false, true, 'false', 'true']) {
    test(`popular cleanup: filterHotSearch=${JSON.stringify(enabled)}, gzip=${compressed}`, async () => {
      const output = await run(fixture(compressed), { filterHotSearch: enabled, logLevel: 'off' });
      assert.ok(output.includes(Buffer.from('normal-video')));
      assert.ok(output.includes(Buffer.from('future-field')));
      for (const marker of ['ad-info', 'recommendation-card', 'advertisement-card']) {
        assert.ok(!output.includes(Buffer.from(marker)), `Must remove ${marker}`);
      }
      assert.equal(output.includes(Buffer.from('topic-card')), enabled === false || enabled === 'false');
    });
  }
}

test('enabled option preserves upstream filtering output exactly', async () => {
  assert.equal(source.split(patchedList).length - 1, 1);
  const upstreamEquivalent = source.replace(patchedList, originalList);
  assert.deepEqual(await run(fixture(true), { filterHotSearch: true }),
    await run(fixture(true), {}, upstreamEquivalent));
});

test('JSON string arguments can keep topics while removing ads', async () => {
  const output = await run(fixture(false), JSON.stringify({ filterHotSearch: false }));
  assert.ok(output.includes(Buffer.from('topic-card')));
  assert.ok(!output.includes(Buffer.from('advertisement-card')));
});

test('missing arguments use the upstream default of filtering topics', async () => {
  const output = await run(fixture(false), null);
  assert.ok(!output.includes(Buffer.from('topic-card')));
});

test('sync rejects an upstream implementation it cannot patch safely', () => {
  const command = `
    $tokens=$null; $errors=$null
    $ast=[System.Management.Automation.Language.Parser]::ParseFile((Join-Path (Get-Location) 'tools/update-bilibili.ps1'),[ref]$tokens,[ref]$errors)
    $function=$ast.Find({param($node) $node -is [System.Management.Automation.Language.FunctionDefinitionAst] -and $node.Name -eq 'ConvertTo-PopularScript'},$true)
    Invoke-Expression $function.Extent.Text
    try { ConvertTo-PopularScript -Source '// Unexpected upstream change'; exit 1 }
    catch { if ($_.Exception.Message -notlike 'Upstream popular filter changed*') { throw }; exit 0 }
  `;
  const result = spawnSync('pwsh', ['-NoProfile', '-Command', command], { cwd: root, encoding: 'utf8' });
  assert.ifError(result.error);
  assert.equal(result.status, 0, result.stderr);
});

// Only read private captures when explicitly requested; never check them into Git.
if (process.env.BILIBILI_HAR_PATH) {
  const capture = JSON.parse(fs.readFileSync(process.env.BILIBILI_HAR_PATH, 'utf8'));
  for (const [index, entry] of capture.log.entries.entries()) {
    const url = new URL(entry.request.url);
    const isPopular = url.pathname.endsWith('.Popular/Index');
    const isView = url.pathname.endsWith('viewunite.v1.View/View');
    if (!isPopular && !isView) continue;
    test(`private HAR entry ${index}: ${isPopular ? 'popular ad/recommendation removal' : 'upstream view ad removal'}`, async () => {
      assert.equal(entry.response.content.encoding, 'base64');
      const input = Buffer.from(entry.response.content.text, 'base64');
      const output = await run(input, { filterHotSearch: false, logLevel: 'off' }, source, url.origin + url.pathname);
      const before = messageFields(unframe(input));
      const after = messageFields(output);
      if (isPopular) {
        const kinds = after.filter(field => field.number === 1).flatMap(field => messageFields(field.value).map(card => card.number));
        assert.ok(kinds.includes(1), 'Keep normal video cards');
        assert.ok(!kinds.includes(10), 'Remove upstream-identified UP recommendation cards');
        assert.ok(!kinds.includes(11), 'Remove advertising cards');
      } else {
        assert.ok(before.some(field => field.number === 7), 'Captured response must contain the ad module');
        assert.ok(!after.some(field => field.number === 7), 'The upstream view handler removes the ad module');
      }
    });
  }
}
