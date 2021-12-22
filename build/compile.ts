import { build, BuildFailure, BuildOptions, Message, Plugin, Platform } from 'esbuild'
import { resolve } from 'path'
import { cyan, yellow, red } from 'kleur'
import { existsSync, readdir } from 'fs-extra'
import escapeRegExp from 'escape-string-regexp'
import { getPackages, PackageJson } from './utils'
import cac from 'cac'

const { args } = cac().help().parse()

const ignored = [
  'This call to "require" will not be bundled because the argument is not a string literal',
  'Indirect calls to "require" will not be bundled',
  'should be marked as external for use with "require.resolve"',
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
  const meta: PackageJson = require(`../${name}/package.json`)
  const base = root + name
  const entryPoints = [base + '/src/index.ts']

  // filter out private packages
  if (meta.private) return

  const filter = /^[@/\w-]+$/
  const externalPlugin: Plugin = {
    name: 'external library',
    setup(build) {
      build.onResolve({ filter }, () => ({ external: true }))
    },
  }

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
    plugins: [externalPlugin],
  }

  // bundle for both node and browser
  if (meta.module) {
    delete options.outdir

    const modules: string[] = []
    for (const name of await readdir(base + '/src')) {
      if (existsSync(base + '/src/' + name + '/package.json')) {
        modules.push(name)
      }
    }

    const filter = new RegExp(`^.+\\/(${modules.map(escapeRegExp).join('|')})$`)
    const usePlatformPlugin = (platform: Platform): Plugin => ({
      name: 'platform specific modules',
      setup(build) {
        build.onResolve({ filter }, ({ path, resolveDir }) => {
          for (const module of modules) {
            if (!path.includes(module)) continue
            return { path: resolve(resolveDir, `${module}/${platform}.ts`) }
          }
        })
      },
    })

    return Promise.all([
      bundle({
        ...options,
        outfile: base + '/' + meta.main,
        plugins: [
          usePlatformPlugin('node'),
          externalPlugin,
        ],
      }),
      bundle({
        ...options,
        format: 'esm',
        target: 'esnext',
        platform: 'browser',
        outfile: base + '/' + meta.module,
        plugins: [
          usePlatformPlugin('browser'),
          externalPlugin,
        ],
      }),
    ])
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
