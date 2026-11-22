import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import ts from 'typescript';

// Run the actual browser API module in a storage sandbox, including legacy data.
describe('Browser session storage', () => {
  it('ignores and removes legacy persisted tokens; manual tokens remain memory-only', () => {
    const store = new Map([['rf_session_token', 'stolen-or-old-session'], ['rf_oauth_token', 'old-popup-session']]);
    const storage = {
      getItem: (key: string) => store.get(key) ?? null,
      setItem: (key: string, value: string) => store.set(key, value),
      removeItem: (key: string) => store.delete(key),
    };
    const source = readFileSync('web/src/api.ts', 'utf8').replaceAll('import.meta', '({ env: {} })');
    const code = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText;
    const exports: { getSessionToken?: () => string | null; setSessionToken?: (token: string) => void } = {};
    runInNewContext(code, { exports, localStorage: storage });
    expect(exports.getSessionToken!()).toBeNull();
    expect(store.has('rf_session_token')).toBe(false);
    expect(store.has('rf_oauth_token')).toBe(false);
    exports.setSessionToken!('manual-session');
    expect(exports.getSessionToken!()).toBe('manual-session');
    expect([...store.values()]).not.toContain('manual-session');
  });
  it('removes legacy URL tokens without adopting them', () => {
    const source = readFileSync('web/src/api.ts', 'utf8').replaceAll('import.meta', '({ env: {} })');
    const code = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText;
    const exports: { getSessionToken?: () => string | null } = {};
    const replaceState = jest.fn();
    runInNewContext(code, {
      exports, URL,
      localStorage: { removeItem: jest.fn() },
      window: { location: { href: 'https://app.example.com/?token=leaked&tab=events#top' }, history: { replaceState } },
      fetch: () => Promise.resolve({}),
    });
    expect(exports.getSessionToken!()).toBeNull();
    expect(replaceState).toHaveBeenCalledWith({}, '', '/?tab=events#top');
  });

});
