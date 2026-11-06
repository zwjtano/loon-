const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

const plugins = ['Plugins/bilibili.lpx', 'Plugins/bilibili-global.lpx'];
const normalize = value => value == null ? null : value.replace(/\r\n/g, '\n');
const withoutDate = value => normalize(value)?.replace(/^#!date=.*(?:\n|$)/m, '');

function releaseDate(now) {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Shanghai', year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
  }).formatToParts(now);
  const values = Object.fromEntries(parts.map(part => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day} ${values.hour}:${values.minute}`;
}

function prepareDates(current, previous, now = new Date(), force = false) {
  const files = new Set([...Object.keys(current), ...Object.keys(previous)]);
  const result = {};
  for (const plugin of plugins) {
    const content = normalize(current[plugin]);
    if (!content || (content.match(/^#!date=/gm) || []).length !== 1) {
      throw new Error(`Expected one publication date in ${plugin}`);
    }
    const changed = force || withoutDate(content) !== withoutDate(previous[plugin]) || [...files].some(file => {
      if (!file.startsWith('Scripts/bilibili/')) return false;
      if (plugin === plugins[0] && file.startsWith('Scripts/bilibili/global-integration.')) return false;
      return normalize(current[file]) !== normalize(previous[file]);
    });
    const oldDate = normalize(previous[plugin])?.match(/^#!date=(.*)$/m)?.[1];
    const date = changed || !oldDate ? releaseDate(now) : oldDate;
    result[plugin] = content.replace(/^#!date=.*$/m, `#!date=${date}`);
  }
  return result;
}

function prepareRelease(root, now = new Date(), force = false) {
  const gitOptions = { cwd: root, encoding: 'utf8', maxBuffer: 16 * 1024 * 1024 };
  const git = args => execFileSync('git', args, gitOptions).trimEnd();
  const previousFiles = new Set([...plugins, ...git(['ls-tree', '-r', '--name-only', 'HEAD', '--', 'Scripts/bilibili/']).split('\n').filter(Boolean)]);
  const currentFiles = new Set([...plugins, ...git(['ls-files', '--cached', '--others', '--exclude-standard', '--', 'Scripts/bilibili/']).split('\n').filter(Boolean)]);
  const current = {};
  const previous = {};
  for (const file of previousFiles) previous[file] = execFileSync('git', ['show', `HEAD:${file}`], gitOptions);
  for (const file of currentFiles) {
    if (fs.existsSync(path.join(root, file))) current[file] = fs.readFileSync(path.join(root, file), 'utf8');
  }
  const result = prepareDates(current, previous, now, force);
  for (const [file, content] of Object.entries(result)) {
    fs.writeFileSync(path.join(root, file), content);
  }
  return result;
}

if (require.main === module) {
  const result = prepareRelease(path.resolve(__dirname, '..'), new Date(), process.argv.includes('--force'));
  for (const [file, content] of Object.entries(result)) console.log(`${file}: ${content.match(/^#!date=(.*)$/m)[1]} (Asia/Shanghai)`);
}

module.exports = { prepareDates, releaseDate, prepareRelease };
