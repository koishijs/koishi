module.exports = {
  exit: true,
  extension: ['ts'],
  spec: [
    'packages/koishi-core/tests/context.spec.ts',
    'packages/koishi-core/tests/help.spec.ts',
    'packages/koishi-core/tests/runtime.spec.ts',
    'packages/koishi-core/tests/command.spec.ts',
    'packages/koishi-core/tests/middleware.spec.ts',
    'packages/koishi-core/tests/parser.spec.ts',
    'packages/koishi-core/tests/session.spec.ts',
    'packages/koishi-utils/tests/*.spec.ts',
    'packages/koishi-test-utils/tests/*.spec.ts',
    'packages/plugin-teach/tests/*.spec.ts',
    'packages/plugin-eval/tests/*.spec.ts',
  ],
  require: 'ts-node/register/transpile-only',
}
