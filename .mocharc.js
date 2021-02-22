const { readdirSync } = require('fs')

process.env.TS_NODE_PROJECT = 'tsconfig.test.json'

const prefixes = ['koishi-', 'adapter-', 'plugin-', '']
const packageMap = {}

for (const name of readdirSync(__dirname + '/packages')) {
  for (const prefix of prefixes) {
    if (name.startsWith(prefix)) {
      packageMap[name.slice(prefix.length)] = name
      break
    }
  }
}

function getSpecFromArgv() {
  if (!process.env.npm_config_argv) return
  const { original } = JSON.parse(process.env.npm_config_argv)
  process.argv.splice(1 - original.length, Infinity)
  return original.slice(1).map((path) => {
    const [name] = path.split('/')
    return `packages/${packageMap[name]}/tests/${path.slice(name.length) || '*'}.spec.ts`
  })
}

module.exports = {
  exit: true,
  extension: ['ts'],
  spec: getSpecFromArgv() || [
    // 'packages/koishi-core/tests/*.spec.ts',
    'packages/koishi-core/tests/context.spec.ts',
    'packages/koishi-utils/tests/*.spec.ts',
    // 'packages/koishi-test-utils/tests/*.spec.ts',
    // 'packages/plugin-common/tests/admin.spec.ts',
    // 'packages/plugin-common/tests/handler.spec.ts',
    // 'packages/plugin-common/tests/sender.spec.ts',
    // 'packages/plugin-eval/tests/*.spec.ts',
    // 'packages/plugin-github/tests/*.spec.ts',
    'packages/plugin-teach/tests/*.spec.ts',
  ],
  require: process.env.USE_TS_NODE ? [
    'ts-node/register/transpile-only',
    'tsconfig-paths/register',
    'build/setup-test',
  ] : [
    __dirname + '/build/register',
    'tsconfig-paths/register',
  ],
}
