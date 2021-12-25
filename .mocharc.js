process.env.TS_NODE_PROJECT = 'tsconfig.test.json'

const specs = [
  'community/chai-shape/tests/*.spec.ts',
  'community/schemastery/tests/*.spec.ts',
  'packages/core/tests/*.spec.ts',
  'packages/utils/tests/*.spec.ts',
  'plugins/admin/tests/*.spec.ts',
  'plugins/common/tests/*.spec.ts',
  'plugins/database/level/tests/*.spec.ts',
  'plugins/database/memory/tests/*.spec.ts',
  'plugins/database/mongo/tests/*.spec.ts',
  'plugins/database/mysql/tests/*.spec.ts',
  'plugins/database/sqlite/tests/*.spec.ts',
  'plugins/eval/tests/*.spec.ts',
  'plugins/forward/tests/*.spec.ts',
  'plugins/github/tests/*.spec.ts',
  'plugins/repeater/tests/*.spec.ts',
  'plugins/schedule/tests/*.spec.ts',
  'plugins/teach/tests/*.spec.ts',
  'plugins/verifier/tests/*.spec.ts',
]

const libraries = {}

for (const path of specs) {
  const [seg1, seg2, seg3] = path.split('/')
  if (seg2 === 'database') {
    libraries[seg3] = seg1 + '/' + seg2
  } else {
    libraries[seg2] = seg1
  }
}

function getSpecFromArgv() {
  if (!process.env.npm_config_argv) return specs
  const args = JSON.parse(process.env.npm_config_argv).original.filter(arg => !arg.startsWith('-'))
  if (args.length === 1) return specs
  process.argv.splice(1 - args.length, Infinity)
  return args.slice(1).flatMap((path) => {
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
  require: [
    'build/register',
    'build/setup',
  ],
}
