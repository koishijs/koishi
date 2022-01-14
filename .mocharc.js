process.env.TS_NODE_PROJECT = 'tsconfig.test.json'

const specs = [
  'community/chai-shape/tests/*.spec.ts',
  'community/schemastery/tests/*.spec.ts',
  'packages/core/tests/*.spec.ts',
  'packages/utils/tests/*.spec.ts',
  'plugins/a11y/admin/tests/*.spec.ts',
  'plugins/a11y/rate-limit/tests/*.spec.ts',
  'plugins/a11y/switch/tests/*.spec.ts',
  'plugins/a11y/sudo/tests/*.spec.ts',
  // 'plugins/a11y/verifier/tests/*.spec.ts',
  'plugins/common/broadcast/tests/*.spec.ts',
  'plugins/common/echo/tests/*.spec.ts',
  'plugins/common/feedback/tests/*.spec.ts',
  'plugins/common/forward/tests/*.spec.ts',
  'plugins/common/recall/tests/*.spec.ts',
  'plugins/common/repeater/tests/*.spec.ts',
  'plugins/common/respondent/tests/*.spec.ts',
  'plugins/database/level/tests/*.spec.ts',
  'plugins/database/memory/tests/*.spec.ts',
  'plugins/database/mongo/tests/*.spec.ts',
  'plugins/database/mysql/tests/*.spec.ts',
  'plugins/database/sqlite/tests/*.spec.ts',
  // 'plugins/eval/tests/*.spec.ts',
  'plugins/frontend/commands/tests/*.spec.ts',
  // 'plugins/github/tests/*.spec.ts',
  // 'plugins/schedule/tests/*.spec.ts',
  'plugins/teach/tests/*.spec.ts',
]

const folders = ['common', 'database', 'frontend']

const libraries = {}

for (const path of specs) {
  const [seg1, seg2, seg3] = path.split('/')
  if (folders.includes(seg2)) {
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
