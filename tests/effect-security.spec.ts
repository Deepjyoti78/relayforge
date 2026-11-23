import { spawnSync } from 'node:child_process';

// Exercise the Effect copy resolved by Prisma config, not an unrelated direct copy.
describe('Prisma config Effect dependency security', () => {
  it('rejects adversarial template literals promptly while preserving valid decoding', () => {
    const effectEntry = require.resolve('effect', { paths: [require.resolve('@prisma/config')] });
    const script = `
      const { Schema } = require(${JSON.stringify(effectEntry)});
      const schema = Schema.TemplateLiteral(Schema.String, ':', Schema.String, ':', Schema.String, 'X');
      const valid = Schema.decodeUnknownSync(schema)('a:b:cX');
      const invalid = Schema.is(schema)(':'.repeat(5000));
      if (valid !== 'a:b:cX' || invalid !== false) process.exit(1);
      process.stdout.write('validated');
    `;
    // A child timeout bounds the known cubic-regex case without hanging Jest/CI.
    const child = spawnSync(process.execPath, ['-e', script], { encoding: 'utf8', timeout: 5000 });
    expect(child.error).toBeUndefined();
    expect(child.status).toBe(0);
    expect(child.stdout).toBe('validated');
  }, 10000);
});
