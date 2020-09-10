module.exports = {
  exit: true,
  extension: ['ts'],
  spec: [
    'packages/koishi-core/tests/*.spec.ts',
    'packages/koishi-utils/tests/*.spec.ts',
    'packages/koishi-test-utils/tests/*.spec.ts',
    'packages/plugin-common/tests/admin.spec.ts',
    'packages/plugin-common/tests/handler.spec.ts',
    'packages/plugin-common/tests/sender.spec.ts',
    'packages/plugin-eval/tests/*.spec.ts',
    'packages/plugin-github/tests/*.spec.ts',
    'packages/plugin-teach/tests/*.spec.ts',
  ],
  require: [
    'ts-node/register/transpile-only',
    'tsconfig-paths/register',
  ],
}
