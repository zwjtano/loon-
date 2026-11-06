const assert = require('node:assert/strict');
const { test } = require('node:test');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const { prepareDates, releaseDate, prepareRelease } = require('../tools/prepare-bilibili-release.cjs');

const core = 'Plugins/bilibili.lpx';
const global = 'Plugins/bilibili-global.lpx';
const shared = 'Scripts/bilibili/feed-index.js';
const engine = 'Scripts/bilibili/global-integration.js';
const now = new Date('2026-11-06T03:30:00Z');
const fixture = {
  [core]: '#!name=Core\n#!date=2026-11-06 07:10\n[Script]\n',
  [global]: '#!name=Global\n#!date=2026-11-06 10:30\n[Script]\n',
  [shared]: 'old feed', [engine]: 'old Global',
};
const date = content => content.match(/^#!date=(.*)$/m)[1];

test('publication dates use Beijing time even across UTC date boundaries', () => {
  assert.equal(releaseDate(now), '2026-11-06 11:30');
  assert.equal(releaseDate(new Date('2026-11-06T16:05:00Z')), '2026-11-07 00:05');
});

test('no-op sync restores each previous publication date instead of the upstream date', () => {
  const current = { ...fixture, [global]: fixture[global].replace('10:30', '07:10') };
  const result = prepareDates(current, fixture, now);
  assert.equal(result[core], fixture[core]);
  assert.equal(result[global], fixture[global]);
});

test('line-ending differences do not create a release', () => {
  const current = Object.fromEntries(Object.entries(fixture).map(([file, value]) => [file, value.replace(/\n/g, '\r\n')]));
  assert.deepEqual(prepareDates(current, fixture, now), { [core]: fixture[core], [global]: fixture[global] });
});

test('shared script changes update both plugin publication dates', () => {
  const result = prepareDates({ ...fixture, [shared]: 'new feed' }, fixture, now);
  assert.equal(date(result[core]), '2026-11-06 11:30');
  assert.equal(date(result[global]), '2026-11-06 11:30');
});

test('Global-only script changes do not redate the core plugin', () => {
  const result = prepareDates({ ...fixture, [engine]: 'new Global' }, fixture, now);
  assert.equal(result[core], fixture[core]);
  assert.equal(date(result[global]), '2026-11-06 11:30');
});

test('plugin changes update only the affected plugin', () => {
  const result = prepareDates({ ...fixture, [core]: fixture[core] + '# new rule\n' }, fixture, now);
  assert.equal(date(result[core]), '2026-11-06 11:30');
  assert.equal(result[global], fixture[global]);
});

test('script additions and removals update dependent plugin dates', () => {
  for (const current of [{ ...fixture, 'Scripts/bilibili/new.js': 'new' }, { ...fixture, [shared]: undefined }]) {
    assert.equal(date(prepareDates(current, fixture, now)[global]), '2026-11-06 11:30');
  }
});

test('manual metadata correction can force a fresh publication date', () => {
  const result = prepareDates(fixture, fixture, now, true);
  assert.equal(date(result[core]), '2026-11-06 11:30');
  assert.equal(date(result[global]), '2026-11-06 11:30');
});

test('invalid or duplicate dates stop publication', () => {
  for (const content of ['#!name=Core\n', fixture[core] + '#!date=duplicate\n']) {
    assert.throws(() => prepareDates({ ...fixture, [core]: content }, fixture, now), /Expected one publication date/);
  }
});

test('publication preparation handles real Git snapshots and bundles larger than 1 MB', t => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'bilibili-release-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const git = args => execFileSync('git', args, { cwd: root, stdio: 'pipe' });
  for (const [file, content] of Object.entries({ ...fixture, [engine]: 'x'.repeat(1300000) })) {
    fs.mkdirSync(path.dirname(path.join(root, file)), { recursive: true });
    fs.writeFileSync(path.join(root, file), content);
  }
  git(['init', '-q']);
  git(['add', '.']);
  git(['-c', 'user.name=Release Test', '-c', 'user.email=test@example.invalid', '-c', 'commit.gpgsign=false', 'commit', '-qm', 'fixture']);
  assert.equal(prepareRelease(root, now)[global], fixture[global]);
  fs.writeFileSync(path.join(root, shared), 'updated feed');
  const result = prepareRelease(root, now);
  assert.equal(date(result[core]), '2026-11-06 11:30');
  assert.equal(fs.readFileSync(path.join(root, global), 'utf8'), result[global]);
});
