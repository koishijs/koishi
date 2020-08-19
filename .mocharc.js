module.exports = {
  extension: ['ts'],
  spec: [
    'packages/koishi-core/tests/command.spec.ts',
    'packages/koishi-core/tests/middleware.spec.ts',
    'packages/koishi-core/tests/parser.spec.ts',
    'packages/koishi-core/tests/plugin.spec.ts',
    'packages/koishi-utils/tests/*.spec.ts',
    'packages/koishi-test-utils/tests/*.spec.ts',
    'packages/plugin-teach/tests/*.spec.ts',
  ],
  require: 'ts-node/register/transpile-only',
}
