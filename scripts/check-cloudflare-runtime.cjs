// Local validation only. Never uploads a Worker or changes account settings.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const {spawnSync} = require('node:child_process');
const {createHash} = require('node:crypto');
const ts = require('typescript');

const root = path.resolve(__dirname, '..');
const expected = {
  FRONTEND_URL:'https://relayforge.deepmuse.workers.dev',
  API_ORIGIN:'https://relayforge-staging-api.onrender.com',
};

function assertRuntimeValues(settings) {
  assert.equal(settings.name, 'relayforge', 'Do not rename the existing Worker');
  assert.deepEqual(settings.vars, expected, 'Required public runtime vars must be source-controlled in each Wrangler config');
  assert.equal(settings.assets.binding, 'ASSETS');
}

function assertGeneratedBindings(declaration) {
  const source = ts.createSourceFile('runtime.d.ts', declaration, ts.ScriptTarget.Latest, true);
  const bindings = {};
  function visit(node) {
    if (ts.isPropertySignature(node) && ts.isIdentifier(node.name)
      && Object.hasOwn(expected, node.name.text) && node.type
      && ts.isLiteralTypeNode(node.type) && ts.isStringLiteral(node.type.literal)) {
      bindings[node.name.text] = node.type.literal.text;
    }
    ts.forEachChild(node, visit);
  }
  visit(source);
  assert.deepEqual(bindings, expected, 'Wrangler effective runtime bindings are missing or incorrect');
  return bindings;
}

function assertNoGeneratedRedirect(start, exists = fs.existsSync) {
  for (let directory = start; ; directory = path.dirname(directory)) {
    const redirect = path.join(directory, '.wrangler', 'deploy', 'config.json');
    assert.ok(!exists(redirect), `Inspect unexpected generated deployment config before publishing: ${redirect}`);
    if (path.dirname(directory) === directory) break;
  }
}

function main() {
  assert.ok(process.env.npm_execpath, 'Run npm run check:cloudflare');
  const cache = path.join(root, '.cache', 'cloudflare-runtime');
  fs.mkdirSync(cache, {recursive:true});
  const manifest = [];
  function wrangler(args, logFile) {
    const result = spawnSync(process.execPath, [process.env.npm_execpath, 'exec', '--yes', '--package=wrangler@4.166.0', '--', 'wrangler', ...args], {
      cwd:root, encoding:'utf8', maxBuffer:10 * 1024 * 1024,
      env:{...process.env, WRANGLER_SEND_METRICS:'false', NO_COLOR:'1', FORCE_COLOR:'0'},
    });
    const log = (result.stdout || '') + (result.stderr || '');
    fs.writeFileSync(logFile, log);
    if (result.status !== 0) throw new Error(`Wrangler validation failed; see ${logFile}`);
    return log;
  }
  for (const relative of ['wrangler.jsonc', 'web/wrangler.jsonc']) {
    const config = path.join(root, relative);
    assertNoGeneratedRedirect(path.dirname(config));
    const parsed = ts.parseConfigFileTextToJson(config, fs.readFileSync(config, 'utf8'));
    assert.ok(!parsed.error, 'Invalid Wrangler JSONC');
    assertRuntimeValues(parsed.config);
    const out = fs.mkdtempSync(path.join(cache, relative.startsWith('web/') ? 'web-' : 'root-'));
    // Explicit --config avoids cwd/autodetection ambiguity. Generated redirect
    // files are rejected above rather than assuming which file Wrangler selects.
    // Vars are runtime deployment bindings, not strings embedded in Worker JS.
    const report = wrangler(['deploy', '--dry-run', '--config', config, '--outdir', out], path.join(out, 'bundle.log'));
    assert.ok(report.includes('--dry-run: exiting now.'), 'Expected a no-upload dry run');
    for (const name of ['ASSETS', ...Object.keys(expected)]) assert.ok(report.includes('env.' + name), `Missing deployment binding ${name}`);
    const types = path.join(out, 'runtime.d.ts');
    wrangler(['types', types, '--config', config, '--include-runtime=false', '--include-main-module=false', '--strict-vars=true'], path.join(out, 'types.log'));
    // The console binding table truncates long values. Validate full literals
    // using Wrangler's generated effective bindings instead of trusting prefixes.
    const vars = assertGeneratedBindings(fs.readFileSync(types, 'utf8'));
    const bundle = fs.readFileSync(path.join(out, path.basename(parsed.config.main)));
    assert.ok(bundle.length > 0);
    manifest.push({config:relative, name:parsed.config.name, vars, assetsBinding:'ASSETS', bundleSha256:createHash('sha256').update(bundle).digest('hex')});
    console.log(`PASS ${relative}: relayforge, ASSETS, and exact FRONTEND_URL/API_ORIGIN in effective deployment bindings; dry-run only`);
  }
  fs.writeFileSync(path.join(cache, 'validated-bindings.json'), JSON.stringify(manifest, null, 2));
}

module.exports = {assertRuntimeValues, assertGeneratedBindings, assertNoGeneratedRedirect};
if (require.main === module) {
  try { main(); } catch (error) { console.error(error.message); process.exitCode = 1; }
}
