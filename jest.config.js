module.exports = {
  globals: {
    'ts-jest': {
      diagnostics: {
        warnOnly: true,
      },
    },
  },
  preset: 'ts-jest',
  testEnvironment: 'node',
  moduleFileExtensions: ['ts', 'js', 'json'],
  moduleNameMapper: {
    "koishi-test-utils": "<rootDir>/packages/test-utils/src",
    "koishi-\\w+": "<rootDir>/packages/$0/src",
  },
  coverageReporters: ['text', 'json'],
  coveragePathIgnorePatterns: [
    'test-utils/',
    'tests/',
    'dist/',
  ],
}
