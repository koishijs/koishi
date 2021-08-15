process.env.TS_NODE_PROJECT = 'tsconfig.test.json'

const specs = [
  'packages/core/tests/*.spec.ts',
  'packages/utils/tests/*.spec.ts',
  'packages/dev-utils/tests/*.spec.ts',
  'packages/test-utils/tests/*.spec.ts',
  'plugins/common/tests/*.spec.ts',
  'plugins/eval/tests/*.spec.ts',
  'plugins/github/tests/*.spec.ts',
  'plugins/mongo/tests/*.spec.ts',
  'plugins/mysql/tests/*.spec.ts',
  'plugins/schedule/tests/*.spec.ts',
  'plugins/teach/tests/*.spec.ts',
]

const libraries = {}

for (const path of specs) {
  const [type, lib] = path.split('/')
  libraries[lib] = type
}

function getSpecFromArgv() {
  if (!process.env.npm_config_argv) return specs
  const { original } = JSON.parse(process.env.npm_config_argv)
  if (original.length === 1) return specs
  process.argv.splice(1 - original.length, Infinity)
  return original.slice(1).flatMap((path) => {
    const [name] = path.split('/')
    const target = path.slice(name.length)
    const prefix = `${libraries[name]}/${name}/tests/`
    if (target) return prefix + target + `.spec.ts`
    return specs.filter(name => name.startsWith(prefix))
  }, 1)
}

module.exports = {
  exit: true,
  timeout: 5000,
  spec: getSpecFromArgv(),
}
