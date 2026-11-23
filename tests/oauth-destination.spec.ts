import { postOAuthDestination } from '../src/modules/auth/browser-security';

describe('post-OAuth routes stay on the exact configured frontend', () => {
  const frontend = 'https://frontend.example.test';
  it('new accounts get onboarding without inherited route parameters', () => {
    expect(postOAuthDestination(frontend + '/dashboard/deliveries?org=old&view=landing', frontend, true)).toBe(frontend + '/onboarding');
  });
  it('returning accounts keep their dashboard intent without landing-preview flags', () => {
    expect(postOAuthDestination(frontend + '/dashboard/deliveries?org=mine&view=landing&landing=1&token=opaque&access_token=opaque&code=old&state=old', frontend, false)).toBe(frontend + '/dashboard/deliveries?org=mine');
    expect(postOAuthDestination(frontend, frontend, false)).toBe(frontend + '/dashboard');
  });
  it('rejects foreign destinations independently of service-level validation', () => {
    expect(postOAuthDestination('https://attacker.example.test/capture', frontend, false)).toBe(frontend + '/dashboard');
  });
});
