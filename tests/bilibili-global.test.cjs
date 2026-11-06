const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const zlib = require('node:zlib');
const { test } = require('node:test');

const root = path.resolve(__dirname, '..');
const source = fs.readFileSync(path.join(root, 'Scripts/bilibili/global-integration.js'), 'utf8');
const template = fs.readFileSync(path.join(root, 'tools/templates/bilibili-global.js'), 'utf8');
const plugin = fs.readFileSync(path.join(root, 'Plugins/bilibili-global.lpx'), 'utf8');
const lines = plugin.split(/\r?\n/);
const viewUrl = 'https://grpc.biliapi.net/bilibili.app.viewunite.v1.View/View';

function variable(value) {
  const out = [];
  do { const part = value & 127; value >>>= 7; out.push(part | (value ? 128 : 0)); } while (value);
  return Buffer.from(out);
}

function bytesField(number, value) {
  const bytes = Buffer.from(value);
  return Buffer.concat([variable(number * 8 + 2), variable(bytes.length), bytes]);
}

function grpc(payload, compressed = false) {
  const bytes = compressed ? zlib.gzipSync(payload) : payload;
  const header = Buffer.alloc(5);
  header[0] = compressed ? 1 : 0;
  header.writeUInt32BE(bytes.length, 1);
  return Buffer.concat([header, bytes]);
}

function unframe(bytes) {
  bytes = Buffer.from(bytes);
  assert.equal(bytes.readUInt32BE(1), bytes.length - 5);
  return bytes[0] ? zlib.gunzipSync(bytes.subarray(5)) : bytes.subarray(5);
}

function fields(bytes) {
  let offset = 0;
  const result = [];
  function read() {
    let value = 0n;
    for (let i = 0; i < 10 && offset < bytes.length; i++) {
      const byte = bytes[offset++];
      value |= BigInt(byte & 127) << BigInt(7 * i);
      if (byte < 128) return value;
    }
    throw new Error('Truncated protobuf');
  }
  while (offset < bytes.length) {
    const key = Number(read());
    const wire = key & 7;
    let value;
    if (wire === 0) value = read();
    else if (wire === 2) {
      const length = Number(read()); value = bytes.subarray(offset, offset + length); offset += length;
    } else if (wire === 1 || wire === 5) {
      const length = wire === 1 ? 8 : 4; value = bytes.subarray(offset, offset + length); offset += length;
    } else throw new Error('Unsupported wire type');
    assert.ok(offset <= bytes.length);
    result.push({ number: key >>> 3, value });
  }
  return result;
}

function viewFixture(compressed = false) {
  return grpc(Buffer.concat([
    bytesField(2, bytesField(10, 'ordinary-video')),
    bytesField(7, bytesField(1, bytesField(1, 'fixture-ad'))),
    bytesField(99, 'future-field'),
  ]), compressed);
}

async function run({ request, response, options = {}, storage = {}, code = source, http, allowStageFailure = false, noClearTimeout = false } = {}) {
  let finish;
  let timer;
  let completions = 0;
  const logs = [];
  const network = [];
  const stageTimers = new Set();
  function stageSetTimeout(callback, delay, ...args) {
    const timer = setTimeout(() => { stageTimers.delete(timer); callback(...args); }, delay);
    stageTimers.add(timer);
    return timer;
  }
  const done = new Promise(resolve => { finish = resolve; });
  const methods = {};
  for (const method of ['get', 'post', 'put', 'delete', 'patch', 'head']) {
    methods[method] = (value, callback) => {
      network.push({ method, url: value.url, node: value.node });
      if (http) http(value, callback);
      else callback('Unexpected network access', { status: 500, headers: {} }, '');
    };
  }
  const argument = { globalEnabled: true, globalStorage: 'Argument', globalLogLevel: 'ERROR', logLevel: 'error', ...options };
  const sandbox = {
    URL, TextEncoder, TextDecoder, Uint8Array, ArrayBuffer, DataView,
    setTimeout: stageSetTimeout,
    ...(noClearTimeout ? {} : { clearTimeout: timer => { stageTimers.delete(timer); clearTimeout(timer); } }),
    atob: value => Buffer.from(value, 'base64').toString('binary'),
    btoa: value => Buffer.from(value, 'binary').toString('base64'),
    console: { log: (...args) => logs.push(args.join(' ')) },
    $loon: 'Loon', $script: { startTime: Date.now(), type: response ? 'http-response' : 'http-request' },
    $argument: argument,
    $request: request || { method: 'POST', url: viewUrl, headers: { 'content-type': 'application/grpc' }, body: grpc(bytesField(7, Buffer.alloc(0))) },
    $response: response,
    $utils: { ungzip: bytes => Uint8Array.from(zlib.gunzipSync(bytes)), gzip: bytes => Uint8Array.from(zlib.gzipSync(bytes)) },
    $persistentStore: { read: key => storage[key] ?? null, write: (value, key) => { storage[key] = value; return true; } },
    $notification: { post() {} },
    $httpClient: methods,
    $done: result => { completions++; finish(result); },
  };
  try {
    vm.runInNewContext(code, sandbox, { timeout: 5000 });
    const result = await Promise.race([
      done,
      new Promise((_, reject) => { timer = setTimeout(() => reject(new Error('Integration timed out')), 7000); }),
    ]);
    await new Promise(resolve => setImmediate(resolve));
    assert.equal(completions, 1);
    if (!allowStageFailure) assert.ok(!logs.some(line => /\[Global integration\].*failed|(?:Type|Syntax|Range)?Error:/.test(line)), logs.join('\n'));
    assert.equal(sandbox.$argument, argument, 'Stages must not replace the native plugin argument object');
    return { result, network, logs, storage };
  } finally {
    clearTimeout(timer);
    // Loon releases native timer resources when $done finishes execution.
    for (const stageTimer of stageTimers) clearTimeout(stageTimer);
  }
}

for (const compressed of [false, true]) {
  for (const enabled of [false, true]) {
    test(`View: Global=${enabled}, gzip=${compressed}, ads removed`, async () => {
      const { result, network } = await run({
        options: { globalEnabled: enabled },
        response: { status: 200, headers: { 'content-type': 'application/grpc', 'grpc-encoding': 'gzip' }, h2_trailers: { 'grpc-status': '0' }, body: viewFixture(compressed) },
      });
      const output = fields(unframe(result.body));
      assert.ok(output.some(field => field.number === 2));
      assert.ok(output.some(field => field.number === 99));
      assert.ok(!output.some(field => field.number === 7));
      assert.equal(result.h2_trailers['grpc-status'], '0');
      assert.equal(network.length, 0);
    });
  }
}

test('Global request applies the selected ForceHost without leaking arguments', async () => {
  const { result, network } = await run({ options: { globalForceHost: '2' } });
  const playerArgs = fields(unframe(result.body)).find(field => field.number === 7);
  assert.ok(playerArgs, 'Keep player arguments');
  assert.equal(fields(playerArgs.value).find(field => field.number === 4)?.value, 2n);
  assert.equal(network.length, 0);
});

test('binary ArrayBuffer responses are normalized before ad cleanup', async () => {
  const bytes = viewFixture();
  const { result } = await run({
    options: { globalEnabled: false },
    response: { status: 200, headers: { 'content-type': 'application/grpc' }, body: bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) },
  });
  assert.ok(!fields(unframe(result.body)).some(field => field.number === 7));
});

test('Loon runtimes without clearTimeout still finish the response pipeline', async () => {
  const { result } = await run({
    noClearTimeout: true,
    response: { status: 200, headers: { 'content-type': 'application/grpc' }, body: viewFixture(true) },
  });
  assert.ok(!fields(unframe(result.body)).some(field => field.number === 7));
});

test('Global player request retains the playback request while changing ForceHost', async () => {
  const input = grpc(bytesField(1, Buffer.alloc(0)));
  const { result, network } = await run({
    request: { method: 'POST', url: 'https://grpc.biliapi.net/bilibili.app.playerunite.v1.Player/PlayViewUnite', headers: { 'content-type': 'application/grpc' }, body: input },
    options: { globalForceHost: '2' },
  });
  assert.ok(fields(unframe(result.body)).some(field => field.number === 1));
  assert.notDeepEqual(Buffer.from(result.body), input);
  assert.equal(network.length, 0);
});

test('Global search selects the configured Hong Kong policy and strips its keyword suffix', async () => {
  const { result } = await run({
    request: { method: 'GET', url: 'https://app.bilibili.com/x/v2/search?keyword=test%20HK', headers: {} },
    options: { globalProxyHKG: 'HK-Test' },
  });
  assert.equal(new URL(result.url).searchParams.get('keyword'), 'test');
  assert.equal(result.node, 'HK-Test');
});

test('Global PersistentStore mode can reuse BoxJS settings', async () => {
  const { result } = await run({
    request: { method: 'GET', url: 'https://app.bilibili.com/x/v2/search?keyword=test%20HK', headers: {} },
    options: { globalStorage: 'PersistentStore', globalProxyHKG: 'Plugin-HK' },
    storage: { Biliverse: JSON.stringify({ Global: { Settings: { Proxies: { HKG: 'BoxJS-HK' } } } }) },
  });
  assert.equal(result.node, 'BoxJS-HK');
});

test('Global disabled leaves requests untouched', async () => {
  const { result, network } = await run({ options: { globalEnabled: false } });
  assert.equal(Object.keys(result).length, 0);
  assert.equal(network.length, 0);
});

test('Global region probes select the available region for a synthetic response', async () => {
  const { result, network } = await run({
    request: { method: 'GET', url: 'https://api.bilibili.com/pgc/player/web/playurl?ep_id=456', headers: {} },
    options: { globalProxyCHN: 'CN-Test', globalProxyHKG: 'HK-Test', globalProxyTWN: 'TW-Test' },
    http: (request, callback) => callback(null, { status: 200, headers: { 'content-type': 'application/json' } },
      JSON.stringify({ code: request.node === 'HK-Test' ? 0 : -404, result: { region: request.node } })),
  });
  assert.deepEqual(network.map(request => request.node).sort(), ['CN-Test', 'HK-Test', 'TW-Test']);
  assert.equal(JSON.parse(result.response.body).result.region, 'HK-Test');
});

test('season response retains Global enhancements and removes payment', async () => {
  const { result, storage } = await run({
    request: { method: 'GET', url: 'https://api.bilibili.com/pgc/view/v2/app/season?season_id=123', headers: {} },
    response: { status: 200, headers: { 'content-type': 'application/json' }, body: JSON.stringify({ code: 0, data: { season_id: 123, season_title: 'test', evaluate: 'test', payment: { price: 10 }, rights: { area_limit: 1, allow_download: 0 }, modules: [] } }) },
  });
  const body = JSON.parse(result.body);
  assert.equal(body.data.rights.area_limit, 0);
  assert.equal(body.data.rights.allow_download, 1);
  assert.equal(Object.hasOwn(body.data, 'payment'), false);
  assert.ok(storage.Biliverse, 'Keep Global regional cache updates');
});

test('disabling Global still applies the original season payment cleanup', async () => {
  const { result } = await run({
    request: { method: 'GET', url: 'https://api.bilibili.com/pgc/view/v2/app/season?season_id=123', headers: {} },
    response: { status: 200, headers: { 'content-type': 'application/json' }, body: JSON.stringify({ code: 0, data: { payment: { price: 10 }, rights: { area_limit: 1 } } }) },
    options: { globalEnabled: false },
  });
  const value = JSON.parse(result.body);
  assert.equal(Object.hasOwn(value.data, 'payment'), false);
  assert.equal(value.data.rights.area_limit, 1);
});

test('request-stage synthetic responses also pass through ad cleanup', async () => {
  const code = template.replace('/*__GLOBAL_REQUEST__*/', '$done({response:$request.testResponse});')
    .replace('/*__GLOBAL_RESPONSE__*/', '$done({});')
    .replace('/*__AD_RESPONSE__*/', '$done({body:"cleaned"}); $done({body:"wrong"});');
  const { result } = await run({
    code,
    request: { method: 'POST', url: 'https://grpc.biliapi.net/bilibili.app.playerunite.v1.Player/PlayViewUnite', headers: {}, testResponse: { status: 200, headers: { 'content-type': 'application/grpc' }, body: 'original' } },
  });
  assert.equal(result.response.status, 200);
  assert.equal(result.response.body, 'cleaned');
});

test('request-stage synthetic protobuf responses run the real upstream ad handler', async () => {
  const start = source.indexOf('  function runGlobalRequest(');
  const end = source.indexOf('  function runGlobalResponse(', start);
  assert.ok(start >= 0 && end > start);
  const code = source.slice(0, start) + '  function runGlobalRequest($done, $argument, $request, $response) { $done({response:$request.testResponse}); }\n' + source.slice(end);
  const { result } = await run({
    code,
    request: { method: 'POST', url: viewUrl, headers: {}, testResponse: { status: 200, headers: { 'content-type': 'application/grpc' }, body: viewFixture(true) } },
  });
  assert.ok(!fields(unframe(result.response.body)).some(field => field.number === 7));
});

test('a failed stage preserves the incoming response and still finishes once', async () => {
  const code = template.replace('/*__GLOBAL_REQUEST__*/', '$done({});')
    .replace('/*__GLOBAL_RESPONSE__*/', 'throw new Error("fixture");')
    .replace('/*__AD_RESPONSE__*/', '$done({});');
  const { result } = await run({ code, response: { status: 200, headers: {}, body: 'original' }, allowStageFailure: true });
  assert.equal(result.body, 'original');
});

test('a non-finishing stage times out and retains its input', async () => {
  const code = template.replace('/*__GLOBAL_REQUEST__*/', '$done({});')
    .replace('/*__GLOBAL_RESPONSE__*/', '// Deliberately does not call $done.')
    .replace('/*__AD_RESPONSE__*/', '$done({});')
    .replace('}, 25000);', '}, 10);');
  const { result, logs } = await run({ code, response: { status: 200, headers: {}, body: 'original' } });
  assert.equal(result.body, 'original');
  assert.ok(logs.some(line => line.includes('Stage timed out')));
});

test('overlapping endpoints select only one response script in the integrated plugin', () => {
  const rules = lines.flatMap(line => {
    const match = line.match(/^response if \$\{url\} ~= \/(.+)\/i then script\("([^"]+)"/);
    return match ? [{ regex: new RegExp(match[1], 'i'), script: match[2] }] : [];
  });
  for (const url of [viewUrl, 'https://api.bilibili.com/pgc/view/v2/app/season?season_id=123']) {
    const candidates = rules.filter(rule => rule.regex.test(url));
    assert.equal(candidates.length, 1, url);
    assert.ok(candidates[0].script.endsWith('/global-integration.js'));
  }
  assert.ok(!lines.some(line => line.includes('pgc\\/view\\/v2\\/app\\/season') && line.includes('response.json.jq')));
  assert.ok(!lines.some(line => /^DOMAIN, (api|app)\.biliapi\.(com|net), REJECT$/.test(line)));
});

test('integrated plugin keeps its stable name and updated feature description', () => {
  assert.match(plugin, /^#!name=.+ \+ Global\r?$/m);
  assert.ok(!plugin.includes('\u6d4b\u8bd5\u7248'));
  const description = lines.find(line => line.startsWith('#!desc='));
  for (const feature of ['Global', 'CDN', 'BoxJS']) assert.ok(description.includes(feature));
});

test('all integrated plugin argument references are declared', () => {
  const names = new Set(lines.map(line => line.match(/^([A-Za-z]\w*)\s*=/)?.[1]).filter(Boolean));
  for (const match of plugin.matchAll(/\$\{([A-Za-z]\w*)\}/g)) {
    if (match[1] !== 'url') assert.ok(names.has(match[1]), match[1]);
  }
});

test('generated code retains source provenance, license and isolated arguments', () => {
  const manifest = JSON.parse(fs.readFileSync(path.join(root, 'Scripts/bilibili/global-integration.sources.json'), 'utf8'));
  assert.ok(manifest.global_version);
  assert.equal(Object.keys(manifest.global_assets).length, 3);
  for (const digest of Object.values(manifest.global_assets)) assert.match(digest, /^[0-9a-f]{64}$/);
  assert.match(manifest.core_response_sha256, /^[0-9a-f]{64}$/);
  assert.ok(fs.readFileSync(path.join(root, 'third_party/biliverse-global/LICENSE'), 'utf8').includes('Apache License'));
  assert.ok(!source.includes('globalThis.$argument'));
  assert.ok(!source.includes('/*__GLOBAL_'));
});

if (process.env.BILIBILI_HAR_PATH) {
  const har = JSON.parse(fs.readFileSync(process.env.BILIBILI_HAR_PATH, 'utf8'));
  for (const [index, entry] of har.log.entries.entries()) {
    if (!new URL(entry.request.url).pathname.endsWith('viewunite.v1.View/View')) continue;
    for (const enabled of [true, false]) {
      test(`private HAR ${index}: Global=${enabled} removes view ad module`, async () => {
        const captured = entry.response._loonOriginal?.content || entry.response.content;
        assert.equal(captured.encoding, 'base64');
        const original = Buffer.from(captured.text, 'base64');
        assert.ok(fields(unframe(original)).some(field => field.number === 7));
        const { result } = await run({
          request: { method: 'POST', url: viewUrl, headers: { 'content-type': 'application/grpc' } },
          response: { status: 200, headers: { 'content-type': 'application/grpc', 'grpc-encoding': 'gzip' }, h2_trailers: { 'grpc-status': '0' }, body: original },
          options: { globalEnabled: enabled },
        });
        const output = fields(unframe(result.body));
        assert.ok(!output.some(field => field.number === 7));
        assert.ok(output.some(field => field.number === 2));
      });
    }
  }
}
