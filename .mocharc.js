process.env.TS_NODE_PROJECT = 'tsconfig.json'

const specs = [
  'packages/core/tests/*.spec.ts',
  'packages/utils/tests/*.spec.ts',
  'plugins/a11y/admin/tests/*.spec.ts',
  'plugins/a11y/rate-limit/tests/*.spec.ts',
  'plugins/a11y/schedule/tests/*.spec.ts',
  'plugins/a11y/suggest/tests/*.spec.ts',
  'plugins/a11y/switch/tests/*.spec.ts',
  'plugins/a11y/sudo/tests/*.spec.ts',
  'plugins/a11y/verifier/tests/*.spec.ts',
  'plugins/common/broadcast/tests/*.spec.ts',
  'plugins/common/echo/tests/*.spec.ts',
  'plugins/common/feedback/tests/*.spec.ts',
  'plugins/common/forward/tests/*.spec.ts',
  'plugins/common/help/tests/*.spec.ts',
  'plugins/common/recall/tests/*.spec.ts',
  'plugins/common/repeater/tests/*.spec.ts',
  'plugins/common/respondent/tests/*.spec.ts',
]

const folders = ['a11y', 'common']

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
  const args = JSON.parse(process.env.npm_config_argv).original.slice(2).filter(arg => !arg.startsWith('-'))
  if (!args.length) return specs
  return args.flatMap((path) => {
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
