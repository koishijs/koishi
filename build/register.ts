import { install } from 'source-map-support'
import { transformSync, Message } from 'esbuild'
import { readFileSync, readdirSync } from 'fs'
import { resolve } from 'path'

// hack for tests
if (process.env.TS_NODE_PROJECT) {
  if (!process.execArgv.some(arg => arg.includes('register'))) {
    process.execArgv.push('-r', __filename)
  }
  require('tsconfig-paths/register')
}

const ignored = [
  'Indirect calls to "require" will not be bundled (surround with a try/catch to silence this warning)',
]

const cache: Record<string, string> = {}

install({
  handleUncaughtExceptions: true,
  environment: 'node',
  retrieveFile(path) {
    return cache[path] || ''
  },
})

const prefix = '\u001B[35mwarning:\u001B[0m'

function reportWarnings({ location, text }: Message) {
  if (ignored.includes(text)) return
  if (!location) return console.log(prefix, text)
  const { file, line, column } = location
  console.log(`\u001B[34m${file}:${line}:${column}:\u001B[0m`, prefix, text)
}

const globalInjections = {
  KOISHI_VERSION() {
    return require('../packages/koishi-core/package.json').version
  },
  BUILTIN_LOADERS() {
    const loaders = readdirSync(resolve(__dirname, '../packages/plugin-eval/src/loaders'))
    return loaders.map(name => name.slice(0, -3))
  },
}

// eslint-disable-next-line node/no-deprecated-api
require.extensions['.ts'] = (module, filename) => {
  const source = readFileSync(filename, 'utf8')
  const define: Record<string, string> = {}
  for (const key in globalInjections) {
    if (source.includes(key)) {
      define[key] = JSON.stringify(globalInjections[key]())
    }
  }
  const { code, warnings } = transformSync(source, {
    sourcefile: filename,
    sourcemap: 'inline',
    format: 'cjs',
    loader: 'ts',
    charset: 'utf8',
    target: 'es2020',
    define,
  })
  cache[filename] = code
  warnings.forEach(reportWarnings)
  module['_compile'](code, filename)
}
