import { build, BuildFailure, BuildOptions, Message } from 'esbuild'
import { resolve } from 'path'
import { cyan, yellow, red } from 'kleur'
import { getPackages } from './utils'
import cac from 'cac'

const { args } = cac().help().parse()

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
const root = resolve(__dirname, '..') + '/'

async function compile(name: string) {
  if (name.includes('.') || name.includes('ui-')) return

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
    keepNames: true,
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
  }

  try {
    const helper = require(base + '/build/compile')
    const result = await helper(base, options) as BuildOptions[]
    if (result) return Promise.all(result.map(bundle)).then(() => {})
  } catch {}

  return bundle(options)
}

;(async () => {
  const folders = await getPackages(args)
  await Promise.all(folders.map(compile))

  process.exit(code)
})()
