import { ConfigurationError, parseEnvironment } from '../src/modules/config/environment';

const apiEnvironment = {
  DATABASE_URL: 'postgresql://api:local@localhost:5432/relayforge_test',
};

describe('process configuration boundaries', () => {
  it('starts API configuration without Redis or worker credentials', () => {
    const config = parseEnvironment('api', apiEnvironment);
    expect(config.databaseUrl).toBe(apiEnvironment.DATABASE_URL);
    expect(config.redisUrl).toBeUndefined();
  });

  it('does not silently give the worker the API database identity', () => {
    expect(() => parseEnvironment('worker', apiEnvironment)).toThrow(ConfigurationError);
  });

  it.each([
    { PORT: 'not-a-port' },
    { PORT: '65536' },
    { DATABASE_POOL_SIZE: '0' },
    { DATABASE_TIMEOUT_MS: '0' },
    { QUEUE_PREFIX: 'unsafe:prefix' },
    { DATABASE_URL: 'https://user:credential@host/database' },
    { DATABASE_URL: 'not-a-url' },
  ])('rejects invalid settings %j', (settings) => {
    expect(() => parseEnvironment('api', { ...apiEnvironment, ...settings })).toThrow(ConfigurationError);
  });

  it('does not include supplied credentials in validation errors', () => {
    try {
      parseEnvironment('api', { DATABASE_URL: 'https://user:private-password@host/database' });
      throw new Error('Expected configuration rejection');
    } catch (error) {
      expect(error).toBeInstanceOf(ConfigurationError);
      expect((error as Error).message).toContain('DATABASE_URL');
      expect((error as Error).message).not.toContain('private-password');
    }
  });

  it('rejects a nonnumeric Redis database', () => {
    expect(() => parseEnvironment('worker', {
      WORKER_DATABASE_URL: apiEnvironment.DATABASE_URL,
      REDIS_URL: 'redis://localhost/not-a-database',
    })).toThrow(ConfigurationError);
  });

  it('enforces strict production checks when NODE_ENV is production', () => {
    // Fails with default placeholder keys in production
    expect(() => parseEnvironment('api', {
      ...apiEnvironment,
      NODE_ENV: 'production',
    })).toThrow(ConfigurationError);

    // Passes when production keys are supplied
    const prodConfig = parseEnvironment('api', {
      ...apiEnvironment,
      NODE_ENV: 'production',
      ENCRYPTION_KEY: '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef_prod',
      GITHUB_CLIENT_ID: 'gh_client_1234567890',
      GITHUB_CLIENT_SECRET: 'gh_secret_abcdef1234567890abcdef',
    });
    expect(prodConfig.environment).toBe('production');

    // Fails if ALLOW_PRIVATE_DESTINATIONS is set to true in production
    expect(() => parseEnvironment('api', {
      ...apiEnvironment,
      NODE_ENV: 'production',
      ENCRYPTION_KEY: '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef_prod',
      GITHUB_CLIENT_ID: 'gh_client_1234567890',
      GITHUB_CLIENT_SECRET: 'gh_secret_abcdef1234567890abcdef',
      ALLOW_PRIVATE_DESTINATIONS: 'true',
    })).toThrow(ConfigurationError);
  });
});
