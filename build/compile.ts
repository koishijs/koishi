import { build, BuildFailure, BuildOptions, Message } from 'esbuild'
import { readdir } from 'fs/promises'
import { resolve } from 'path'
import { cyan, yellow, red } from 'kleur'

const ignored = [
  'This call to "require" will not be bundled because the argument is not a string literal',
  'Indirect calls to "require" will not be bundled',
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

let code = 0

function bundle(options: BuildOptions) {
  for (const path of options.entryPoints as string[]) {
    if (process.env.CI) console.log('entry:', path)
  }
  return build(options).then(({ warnings }) => {
    warnings.forEach(displayWarning)
  }, ({ warnings, errors }: BuildFailure) => {
    errors.forEach(displayError)
    warnings.forEach(displayWarning)
    if (errors.length) code = 1
  })
}

const { version } = require('../packages/koishi-core/package.json')
const KOISHI_VERSION = JSON.stringify(version)

;(async () => {
  const root = resolve(__dirname, '../packages')
  const workspaces = await readdir(root)
  const tasks: Record<string, Promise<void>> = {}

  await Promise.all(workspaces.map(async (name) => {
    if (name.startsWith('.')) return

    const base = `${root}/${name}`
    const entryPoints = [base + '/src/index.ts']

    let filter = /^[@/\w-]+$/
    const options: BuildOptions = {
      entryPoints,
      bundle: true,
      platform: 'node',
      target: 'node12.19',
      charset: 'utf8',
      outdir: `${root}/${name}/lib`,
      logLevel: 'silent',
      sourcemap: true,
      define: {
        KOISHI_VERSION,
      },
      plugins: [{
        name: 'external library',
        setup(build) {
          build.onResolve({ filter }, () => ({ external: true }))
        },
      }],
    }

    if (name === 'koishi' || name === 'plugin-puppeteer') {
      entryPoints.push(base + '/src/worker.ts')
    } else if (name === 'plugin-eval') {
      const loaders = await readdir(base + '/src/loaders')
      entryPoints.push(base + '/src/worker/index.ts')
      entryPoints.push(base + '/src/transfer.ts')
      entryPoints.push(...loaders.map(name => `${base}/src/loaders/${name}`))
      options.define.BUILTIN_LOADERS = JSON.stringify(loaders.map(name => name.slice(0, -3)))
    }

    if (name !== 'plugin-eval') {
      return tasks[name] = bundle(options)
    }

    filter = /^([@/\w-]+|.+\/transfer)$/
    tasks[name] = Promise.all([options, {
      ...options,
      outdir: `${root}/${name}/lib/worker`,
      entryPoints: [base + '/src/worker/internal.ts'],
      banner: { js: '(function (host, exports, GLOBAL) {' },
      footer: { js: '})' },
    }].map(bundle)).then(() => {})
  }))

  process.exit(code)
})()
