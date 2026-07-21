/** @type {import('jest').Config} */
const base = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  moduleNameMapper: {
    '^@domain/(.*)$': '<rootDir>/src/domain/$1',
    '^@application/(.*)$': '<rootDir>/src/application/$1',
    '^@infrastructure/(.*)$': '<rootDir>/src/infrastructure/$1',
    '^@shared/(.*)$': '<rootDir>/src/shared/$1',
  },
  transform: {
    '^.+\\.ts$': ['ts-jest', { tsconfig: 'tsconfig.json' }],
  },
};

module.exports = {
  projects: [
    {
      ...base,
      displayName: 'domain',
      testMatch: ['<rootDir>/src/domain/**/*.spec.ts'],
    },
    {
      ...base,
      displayName: 'application',
      testMatch: ['<rootDir>/src/application/**/*.spec.ts'],
    },
  ],
};
