const { readdirSync } = require('fs')

process.env.TS_NODE_PROJECT = 'tsconfig.test.json'

const prefixes = ['koishi-', 'adapter-', 'plugin-', '']
const libraries = {}

for (const name of readdirSync(__dirname + '/packages')) {
  for (const prefix of prefixes) {
    if (name.startsWith(prefix)) {
      libraries[name.slice(prefix.length)] = name
      break
    }
  }
}

const specs = [
  // 'packages/koishi-core/tests/*.spec.ts',
  'packages/koishi-core/tests/command.spec.ts',
  'packages/koishi-core/tests/context.spec.ts',
  'packages/koishi-core/tests/help.spec.ts',
  'packages/koishi-core/tests/hook.spec.ts',
  'packages/koishi-core/tests/session.spec.ts',
  'packages/koishi-core/tests/parser.spec.ts',
  'packages/koishi-utils/tests/*.spec.ts',
  'packages/koishi-test-utils/tests/*.spec.ts',
  'packages/plugin-common/tests/*.spec.ts',
  'packages/plugin-eval/tests/*.spec.ts',
  'packages/plugin-github/tests/*.spec.ts',
  'packages/plugin-schedule/tests/*.spec.ts',
  'packages/plugin-teach/tests/*.spec.ts',
]

function getSpecFromArgv() {
  if (!process.env.npm_config_argv) return specs
  const { original } = JSON.parse(process.env.npm_config_argv)
  if (original.length === 1) return specs
  process.argv.splice(1 - original.length, Infinity)
  return original.slice(1).flatMap((path) => {
    const [lib] = path.split('/')
    const target = path.slice(lib.length)
    const prefix = `packages/${libraries[lib]}/tests/`
    if (target) return prefix + target + `.spec.ts`
    return specs.filter(name => name.startsWith(prefix))
  }, 1)
}

module.exports = {
  exit: true,
  spec: getSpecFromArgv(),
}
