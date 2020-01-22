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
    "koishi-(test-utils|(database|plugin)-[\\w-]+)(/dist)?": "<rootDir>/packages/$1/src",
    "koishi-[\\w-]+": "<rootDir>/packages/$0/src",
  },
  coverageReporters: ['text', 'lcov'],
  coveragePathIgnorePatterns: [
    'tests/',
    'dist/',
  ],
}
