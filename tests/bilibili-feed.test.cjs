const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { test } = require('node:test');

const root = path.resolve(__dirname, '..');
const source = fs.readFileSync(path.join(root, 'Scripts/bilibili/feed-index.js'), 'utf8');
const items = [
  { id: 'video', goto: 'av', card_goto: 'av', title: 'Live broadcast highlights', live_info: {} },
  { id: 'live-goto', goto: 'live', card_goto: 'av', card_type: 'small_cover_v9' },
  { id: 'live-card', goto: 'av', card_goto: 'live', card_type: 'small_cover_v9' },
  { id: 'live-upper', goto: 'LIVE', card_goto: 'LIVE' },
  { id: 'vertical', goto: 'vertical_av', card_goto: 'av' },
  { id: 'ad', goto: 'av', card_goto: 'ad_av', card_type: 'cm_v2' },
  { id: 'other', goto: 'bangumi', card_goto: 'bangumi' },
];

function run(argument, body = { data: { items, config: { untouched: true } }, code: 0 }) {
  let result;
  let calls = 0;
  const context = { $response: { body: JSON.stringify(body) }, $done(value) { result = value; calls++; } };
  if (argument !== undefined) context.$argument = argument;
  vm.runInNewContext(source, context, { timeout: 1000 });
  assert.equal(calls, 1);
  return JSON.parse(result.body);
}

for (const enabled of [true, 'true', false, 'false']) {
  test(`live filter honors ${JSON.stringify(enabled)} independently of ad/vertical filtering`, () => {
    const result = run({ customizeHomeFeed: false, filterVerticalVideo: false, filterLive: enabled });
    const ids = items.filter(item => enabled === false || enabled === 'false' || !item.id.startsWith('live-')).map(item => item.id);
    assert.deepEqual(result.data.items.map(item => item.id), ids);
    assert.deepEqual(result.data.config, { untouched: true });
    assert.equal(result.code, 0);
  });
}

for (const ads of [true, false]) {
  for (const vertical of [true, false]) {
    for (const live of [true, false]) {
      test(`feed filters compose: ads=${ads}, vertical=${vertical}, live=${live}`, () => {
        const result = run([ads, vertical, live]);
        const expected = items.filter(item => !(ads && item.id === 'ad') && !(vertical && item.id === 'vertical') && !(live && item.id.startsWith('live-')));
        assert.deepEqual(result.data.items, expected);
      });
    }
  }
}

test('live filter defaults on with absent or legacy two-element arguments', () => {
  for (const args of [undefined, [false, false], {}]) {
    assert.ok(run(args).data.items.every(item => !item.id.startsWith('live-')));
  }
});

test('JSON and query-string arguments can disable live filtering', () => {
  for (const args of ['{"customizeHomeFeed":false,"filterVerticalVideo":false,"filterLive":false}', 'customizeHomeFeed=false&filterVerticalVideo=false&filterLive=false']) {
    assert.deepEqual(run(args).data.items, items);
  }
});

test('missing and empty feed lists remain unchanged', () => {
  for (const body of [{ code: 0 }, { data: {} }, { data: { items: [] } }]) {
    assert.deepEqual(run([false, false, true], body), body);
  }
});

test('both plugin variants declare and pass the live filter exactly once', () => {
  for (const file of ['bilibili.lpx', 'bilibili-global.lpx']) {
    const lines = fs.readFileSync(path.join(root, 'Plugins', file), 'utf8').split(/\r?\n/);
    assert.equal(lines.filter(line => line.startsWith('filterLive=switch, true, false,')).length, 1, file);
    const rules = lines.filter(line => !line.startsWith('#') && line.includes('Scripts/bilibili/feed-index.js'));
    assert.equal(rules.length, 1, file);
    assert.ok(rules[0].includes('argument=[{customizeHomeFeed},{filterVerticalVideo},{filterLive}]'), file);
    assert.ok(!rules[0].includes('enable='), 'Each feed filter must work independently');
  }
});
