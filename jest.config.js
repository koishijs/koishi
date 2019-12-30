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
    "koishi-(test-utils/src/[\\w-]+)": "<rootDir>/packages/$1",
    "koishi-(test-utils|database-[\\w-]+)": "<rootDir>/packages/$1/src",
    "koishi-[\\w-]+": "<rootDir>/packages/$0/src",
  },
  coverageReporters: ['text', 'lcov'],
  coveragePathIgnorePatterns: [
    'test-utils/',
    'tests/',
    'dist/',
  ],
}
