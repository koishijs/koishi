import { build, BuildFailure, BuildOptions, Message } from 'esbuild'
import { readdir } from 'fs/promises'
import { resolve } from 'path'
import { cyan, yellow, red } from 'kleur'

const ignored = [
  'This call to "require" will not be bundled because the argument is not a string literal',
]

function display(prefix: string) {
  return ({ location, text }: Message) => {
    if (ignored.some(message => text.includes(message))) return
    if (!location) return console.log(prefix, text)
    const { file, line, column } = location
    console.log(cyan(`${file}:${line}:${column}:`), prefix, text)
  }
}

const displayError = display(red('error:'))
const displayWarning = display(yellow('warning:'))

;(async () => {
  let code = 0
  const root = resolve(__dirname, '../packages')
  const workspaces = [
    'koishi-test-utils/chai',
    ...await readdir(root),
  ]

  await Promise.all(workspaces.flatMap<BuildOptions>((name) => {
    if (name.startsWith('.')) return []

    const base = `${root}/${name}`
    const entryPoints = [base + '/src/index.ts']

    if (name === 'koishi') {
      entryPoints.push(base + '/src/cli.ts')
      entryPoints.push(base + '/src/worker.ts')
    } else if (name === 'plugin-eval') {
      entryPoints.push(base + '/src/worker.ts')
      entryPoints.push(base + '/src/transfer.ts')
    } else if (name === 'plugin-eval-addons') {
      entryPoints.push(base + '/src/worker.ts')
    }

    let filter = /^[/\w-]+$/
    const options: BuildOptions = {
      entryPoints,
      bundle: true,
      platform: 'node',
      target: 'node12.19',
      charset: 'utf8',
      outdir: `${root}/${name}/dist`,
      logLevel: 'silent',
      sourcemap: true,
      plugins: [{
        name: 'external library',
        setup(build) {
          build.onResolve({ filter }, () => ({ external: true }))
        },
      }],
    }

    if (name !== 'plugin-eval') return options
    filter = /^([/\w-]+|\.\/transfer)$/
    return [options, {
      ...options,
      entryPoints: [base + '/src/internal.ts'],
      banner: '(function (host, exports, GLOBAL) {',
      footer: '})',
    }]
  }).map((options) => {
    return build(options).then(({ warnings }) => {
      warnings.forEach(displayWarning)
    }, ({ warnings, errors }: BuildFailure) => {
      errors.forEach(displayError)
      warnings.forEach(displayWarning)
      if (errors.length) code = 1
    })
  }))

  process.exit(code)
})()
