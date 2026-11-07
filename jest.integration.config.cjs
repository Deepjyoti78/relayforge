module.exports = {
  ...require('./jest.config.cjs'),
  testMatch: ['<rootDir>/tests/**/*.integration-spec.ts'],
  setupFiles: ['<rootDir>/tests/load-integration-env.cjs'],
  testTimeout: 20000,
};
