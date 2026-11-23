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
