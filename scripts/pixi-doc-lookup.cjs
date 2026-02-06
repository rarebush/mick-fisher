const fs = require('fs');
const path = require('path');

const args = process.argv.slice(2);
let limit = 20;
let outputJson = false;
const queryParts = [];

for (let i = 0; i < args.length; i += 1) {
  const arg = args[i];
  if (arg === '--json') {
    outputJson = true;
    continue;
  }
  if (arg === '--limit') {
    const next = args[i + 1];
    if (!next) {
      console.error('Missing value for --limit');
      process.exit(1);
    }
    limit = Number(next);
    if (Number.isNaN(limit) || limit < 1) {
      console.error('Invalid --limit value');
      process.exit(1);
    }
    i += 1;
    continue;
  }
  if (arg.startsWith('--limit=')) {
    const value = arg.split('=')[1];
    limit = Number(value);
    if (Number.isNaN(limit) || limit < 1) {
      console.error('Invalid --limit value');
      process.exit(1);
    }
    continue;
  }
  queryParts.push(arg);
}

const query = queryParts.join(' ').trim();
if (!query) {
  console.log('Usage: node scripts/pixi-doc-lookup.cjs <query> [--limit N] [--json]');
  console.log('Example: node scripts/pixi-doc-lookup.cjs Filter --limit 10');
  process.exit(0);
}

const indexPath = path.join(__dirname, '..', 'documentation', 'pixi-api-links.json');
if (!fs.existsSync(indexPath)) {
  console.error(`Index file not found: ${indexPath}`);
  process.exit(1);
}

const data = JSON.parse(fs.readFileSync(indexPath, 'utf8'));
const links = Array.isArray(data.links) ? data.links : [];
const needle = query.toLowerCase();

const exactMatches = links.filter((item) => {
  const name = String(item.name || '').toLowerCase();
  const url = String(item.url || '').toLowerCase();
  return name === needle || url === needle;
});

const containsMatches = links.filter((item) => {
  const name = String(item.name || '').toLowerCase();
  const url = String(item.url || '').toLowerCase();
  return name.includes(needle) || url.includes(needle);
});

const matches = exactMatches.length > 0 ? exactMatches : containsMatches;
matches.sort((a, b) => {
  const aName = String(a.name || '');
  const bName = String(b.name || '');
  return aName.length - bName.length || aName.localeCompare(bName);
});

const limited = matches.slice(0, limit);
if (outputJson) {
  process.stdout.write(`${JSON.stringify(limited, null, 2)}\n`);
  process.exit(0);
}

console.log(`Matches: ${matches.length} (showing ${limited.length})`);
for (const item of limited) {
  const name = item.name || 'Unknown';
  const url = item.url || '';
  console.log(`- ${name} - ${url}`);
}
