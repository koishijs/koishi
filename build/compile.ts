import { build, BuildFailure, BuildOptions, Message } from 'esbuild'
import { readdir } from 'fs/promises'
import { resolve } from 'path'
import { cyan, yellow, red } from 'kleur'
import { getPackages } from './utils'

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

const { version } = require('../packages/core/package.json')
const KOISHI_VERSION = JSON.stringify(version)

;(async () => {
  const root = resolve(__dirname, '..') + '/'
  const chai = 'packages/test-utils/chai'
  const tasks: Record<string, Promise<void>> = {}
  const workspaces = [chai, ...await getPackages()]

  await Promise.all(workspaces.map(async (name) => {
    if (name.includes('.')) return

    const base = root + name
    const entryPoints = [base + '/src/index.ts']

    let filter = /^[@/\w-]+$/
    const options: BuildOptions = {
      entryPoints,
      bundle: true,
      platform: 'node',
      target: 'node12.22',
      charset: 'utf8',
      outdir: base + '/lib',
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

    if (name === 'packages/cli' || name === 'plugins/puppeteer') {
      entryPoints.push(base + '/src/worker.ts')
    } else if (name === 'packages/test-utils') {
      await tasks[chai]
    }

    if (name === 'packages/koishi') {
      entryPoints[0] = base + '/src/node.ts'
      tasks[name] = Promise.all([options, {
        ...options,
        // minify: true,
        platform: 'browser',
        target: 'esnext',
        format: 'iife',
        entryPoints: [base + '/src/browser.ts'],
        plugins: [],
      }].map(bundle)).then(() => {})
    } else if (name === 'plugins/eval') {
      filter = /^([@/\w-]+|.+\/transfer)$/
      const loaders = await readdir(base + '/src/loaders')
      entryPoints.push(base + '/src/worker/index.ts')
      entryPoints.push(base + '/src/transfer.ts')
      entryPoints.push(...loaders.map(name => `${base}/src/loaders/${name}`))
      options.define.BUILTIN_LOADERS = JSON.stringify(loaders.map(name => name.slice(0, -3)))
      tasks[name] = Promise.all([options, {
        ...options,
        outdir: base + '/lib/worker',
        entryPoints: [base + '/src/worker/internal.ts'],
        banner: { js: '(function (host, exports, GLOBAL) {' },
        footer: { js: '})' },
      }].map(bundle)).then(() => {})
    } else {
      tasks[name] = bundle(options)
    }
  }))

  process.exit(code)
})()
