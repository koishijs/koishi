const { install } = require('source-map-support')
const { transformSync } = require('esbuild')
const { readFileSync, readdirSync } = require('fs')
const { resolve } = require('path')
const { load } = require('js-yaml')

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

/** @type { Record<string, string> } */
const cache = {}

install({
  handleUncaughtExceptions: true,
  environment: 'node',
  retrieveFile(path) {
    return cache[path] || ''
  },
})

const prefix = '\u001B[35mwarning:\u001B[0m'

/** @param { import('esbuild').Message } param0 */
function reportWarnings({ location, text }) {
  if (ignored.includes(text)) return
  if (!location) return console.log(prefix, text)
  const { file, line, column } = location
  console.log(`\u001B[34m${file}:${line}:${column}:\u001B[0m`, prefix, text)
}

const globalInjections = {
  KOISHI_VERSION() {
    return require('../packages/core/package.json').version
  },
  BUILTIN_LOADERS() {
    const loaders = readdirSync(resolve(__dirname, '../plugins/eval/src/loaders'))
    return loaders.map(name => name.slice(0, -3))
  },
}

require.extensions['.yaml'] = require.extensions['.yml'] = (module, filename) => {
  const source = readFileSync(filename, 'utf8')
  const data = load(source)
  module.exports = data
}

require.extensions['.ts'] = (module, filename) => {
  const source = readFileSync(filename, 'utf8')
  /** @type { Record<string, string> } */
  const define = {}
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
