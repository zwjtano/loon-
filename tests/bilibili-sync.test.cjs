const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { test } = require('node:test');
const { spawnSync } = require('node:child_process');

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
  assert.ok(only('pgc\\/page\\/(?:bangumi|cinema\\/tab)').includes('enable=${customizePgcPage}'));
  assert.ok(only('Dynamic\\/DynAll').includes('enable=${customizeDynamicPage}'));
});

test('popular page retains upstream script arguments', () => {
  const rule = only('Popular\\/Index');
  assert.ok(!rule.includes('enable='), 'Core ad cleanup must run even with hot search disabled');
  assert.ok(rule.includes('Scripts/bilibili/popular.js'));
  assert.ok(rule.includes('${filterHotSearch}'));
  for (const argument of ['displayUpList', 'purifyComment', 'sponsorBlock', 'logLevel']) {
    assert.ok(rule.includes('${' + argument + '}'), argument);
  }
});

test('new-syntax enable options use declared Boolean plugin parameters', () => {
  for (const line of active.filter(value => /^(request|response) if /.test(value))) {
    const match = line.match(/\benable=([^,\s]+)/);
    if (!match) continue;
    assert.match(match[1], /^(true|false|\$\{[A-Za-z]\w*\})$/, line);
    const parameter = match[1].match(/^\$\{(\w+)\}$/)?.[1];
    if (parameter) assert.ok(active.some(value => value.startsWith(`${parameter}=switch,`)), parameter);
  }
});

test('sync helper emits syntax-appropriate enable references without duplicates', () => {
  // Load just this function through PowerShell's AST; do not run a network sync.
  const command = `
    $tokens=$null; $errors=$null
    $ast=[System.Management.Automation.Language.Parser]::ParseFile((Join-Path (Get-Location) 'tools/update-bilibili.ps1'),[ref]$tokens,[ref]$errors)
    $function=$ast.Find({param($node) $node -is [System.Management.Automation.Language.FunctionDefinitionAst] -and $node.Name -eq 'Add-EnableFlag'},$true)
    Invoke-Expression $function.Extent.Text
    $cases=@(
      'response if example then script("a.js") with tag="test"',
      'response if example then script("a.js") with enable={oldFlag}, tag="test"',
      'response if example then script("a.js") with enable=\${oldFlag}, tag="test"',
      'request if example then script("a.js") with tag="test"',
      'http-response example script-path=a.js, enable={oldFlag}'
    )
    @($cases | ForEach-Object { Add-EnableFlag -Line $_ -Flag 'customizeDynamicPage' }) | ConvertTo-Json -Compress
  `;
  const result = spawnSync('pwsh', ['-NoProfile', '-Command', command], { cwd: root, encoding: 'utf8' });
  assert.ifError(result.error);
  assert.equal(result.status, 0, result.stderr);
  const results = JSON.parse(result.stdout.trim());
  for (const [index, rule] of results.entries()) {
    assert.equal((rule.match(/enable=/g) || []).length, 1, rule);
    assert.ok(!rule.includes('oldFlag'));
    assert.ok(rule.endsWith(index === 4 ? 'enable={customizeDynamicPage}' : 'enable=${customizeDynamicPage}'));
  }
});

test('playback uses upstream scripts, not the reverted experiment', () => {
  assert.ok(!plugin.includes('response-playback.js'));
  assert.ok(only('DM\\/DmSegMobile').includes('enable=${sponsorBlock}'));
  const rule = only('View\\/(?:AIRelateAsync|RelatesFeed|View|ViewProgress)');
  assert.ok(rule.includes('https://rucu6.pages.dev/Scripts/bilibili/response.js'));
  assert.ok(rule.includes('${sponsorBlock}'));
});
