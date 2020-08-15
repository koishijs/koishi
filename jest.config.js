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
    'koishi-(plugin-[\\w-]+)(/dist)?': '<rootDir>/packages/$1/src',
    'koishi-[\\w-]+': '<rootDir>/packages/$0/src',
  },
  coverageProvider: 'v8',
  coverageReporters: ['text', 'lcov'],
  coveragePathIgnorePatterns: [
    'node_modules/',
    'tests/',
    'dist/',
  ],
}
