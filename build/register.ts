import { install } from 'source-map-support'
import { transformSync } from 'esbuild'
import { readFileSync } from 'fs'

const ignored = [
  'Indirect calls to "require" will not be bundled (surround with a try/catch to silence this warning)',
]

const maps: Record<string, string> = {}

install({
  handleUncaughtExceptions: false,
  environment: 'node',
  retrieveSourceMap(file) {
    return maps[file] && {
      url: file,
      map: maps[file],
    }
  },
})

const prefix = '\u001B[35mwarning:\u001B[0m'

// eslint-disable-next-line node/no-deprecated-api
require.extensions['.ts'] = (module, filename) => {
  const source = readFileSync(filename, 'utf8')
  const { code, warnings, map } = transformSync(source, {
    sourcefile: filename,
    sourcemap: true,
    format: 'cjs',
    loader: 'ts',
    charset: 'utf8',
  })
  maps[filename] = map
  warnings.forEach(({ location, text }) => {
    if (ignored.includes(text)) return
    if (!location) return console.log(prefix, text)
    const { file, line, column } = location
    console.log(`\u001B[34m${file}:${line}:${column}:\u001B[0m`, prefix, text)
  })
  module['_compile'](code, filename)
}
