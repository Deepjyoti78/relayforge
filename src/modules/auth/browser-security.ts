/** Browser trust is limited to the configured frontend, including scheme and port. */
export function isTrustedFrontendUrl(value: string, frontendUrl: string): boolean {
  try {
    const url = new URL(value);
    const frontend = new URL(frontendUrl);
    return ['http:', 'https:'].includes(url.protocol)
      && !url.username && !url.password && url.origin === frontend.origin;
  } catch {
    return false;
  }
}

export function isTrustedFrontendOrigin(value: string, frontendUrl: string): boolean {
  return isTrustedFrontendUrl(value, frontendUrl) && new URL(value).origin === value;
}

export function postOAuthDestination(redirectUri: string, frontendUrl: string, isNewUser: boolean): string {
  const destination = new URL(isTrustedFrontendUrl(redirectUri, frontendUrl) ? redirectUri : frontendUrl);
  if (isNewUser) {
    destination.pathname = '/onboarding';
    destination.search = '';
  } else if (destination.pathname === '/' || destination.pathname === '/onboarding') {
    destination.pathname = '/dashboard';
  }
  for (const parameter of ['view', 'landing', 'error', 'token', 'session_token', 'access_token', 'id_token', 'code', 'state']) destination.searchParams.delete(parameter);
  destination.hash = '';
  return destination.toString();
}
