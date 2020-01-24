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
    "shiki-core": "<rootDir>/bots/shiki/core",
    "touhou-words": "<rootDir>/bots/shiki/lib/touhou-words",
    "shiki-universe": "<rootDir>/bots/shiki/lib/shiki-universe/src",
    "inference-puzzles": "<rootDir>/bots/shiki/lib/inference-puzzles/src",
  },
  coverageReporters: ['text', 'lcov'],
  coveragePathIgnorePatterns: [
    'tests/',
    'dist/',
  ],
}
