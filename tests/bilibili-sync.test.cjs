const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { test } = require('node:test');

const root = path.resolve(__dirname, '..');
const plugin = fs.readFileSync(path.join(root, 'Plugins/bilibili.lpx'), 'utf8');
const lines = plugin.split(/\r?\n/);
const active = lines.filter(line => line.trim() && !line.startsWith('#'));

function only(marker) {
  const matched = active.filter(line => line.includes(marker));
  assert.equal(matched.length, 1, `Expected exactly one rule: ${marker}`);
  return matched[0];
}

test('custom arguments are preserved without duplicate definitions', () => {
  const names = [
    'customizeDynamicPage', 'customizeHomeTabs', 'homeTopTabs',
    'hideHomeTopGameCenter', 'hideHomeBottomPublish', 'hideHomeBottomMall',
    'customizePgcPage', 'customizeMinePage', 'customizeHomeFeed',
    'filterVerticalVideo', 'filterHotSearch', 'filterSearchSuggest',
    'filterDefaultSearchWord',
  ];
  for (const name of names) {
    assert.equal(active.filter(line => line.startsWith(`${name}=`)).length, 1, name);
  }
});

test('custom scripts remain available with their switches and arguments', () => {
  const expected = {
    'home-tabs': 'argument=[{homeTopTabs},{customizeHomeTabs},{hideHomeTopGameCenter},{hideHomeBottomPublish},{hideHomeBottomMall}]',
    mine: 'enable={customizeMinePage}',
    'feed-index': 'argument=[{customizeHomeFeed},{filterVerticalVideo}]',
    'search-square': 'enable={filterSearchSuggest}',
    'default-search-word': 'enable={filterDefaultSearchWord}',
  };
  for (const [script, settings] of Object.entries(expected)) {
    assert.ok(only(`Scripts/bilibili/${script}.js`).includes(settings), script);
    assert.ok(fs.existsSync(path.join(root, 'Scripts/bilibili', `${script}.js`)));
  }
});

test('default search words are not unconditionally mocked', () => {
  const rule = only('Search\\/DefaultWords');
  assert.ok(rule.includes('default-search-word.js'));
  assert.ok(!rule.includes('response.body.mock'));
  assert.ok(!rule.includes('mock-response-body'));
});

test('PGC and dynamic cleanup honor their switches', () => {
  assert.ok(only('pgc\\/page\\/(?:bangumi|cinema\\/tab)').includes('enable={customizePgcPage}'));
  assert.ok(only('Dynamic\\/DynAll').includes('enable={customizeDynamicPage}'));
});

test('popular page retains upstream script arguments', () => {
  const rule = only('Popular\\/Index');
  assert.ok(rule.includes('enable={filterHotSearch}'));
  for (const argument of ['displayUpList', 'purifyComment', 'sponsorBlock', 'logLevel']) {
    assert.ok(rule.includes('${' + argument + '}'), argument);
  }
});

test('playback uses upstream scripts, not the reverted experiment', () => {
  assert.ok(!plugin.includes('response-playback.js'));
  assert.ok(only('DM\\/DmSegMobile').includes('enable=${sponsorBlock}'));
  const rule = only('View\\/(?:AIRelateAsync|RelatesFeed|View|ViewProgress)');
  assert.ok(rule.includes('https://rucu6.pages.dev/Scripts/bilibili/response.js'));
  assert.ok(rule.includes('${sponsorBlock}'));
});
