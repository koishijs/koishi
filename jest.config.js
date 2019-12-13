module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  moduleFileExtensions: ['ts', 'js', 'json'],
  coverageReporters: ['text'],
  coveragePathIgnorePatterns: [
    'test-utils/',
    'tests/',
    'dist/',
  ],
}
