import { build, BuildFailure, Message } from 'esbuild'
import { readdir } from 'fs/promises'
import { resolve } from 'path'
import { cyan, yellow, red } from 'kleur'
import { PackageJson } from './utils'

const ignored = [
  'This call to "require" will not be bundled because the argument is not a string literal',
]

function display(prefix: string) {
  return ({ location, text }: Message) => {
    if (ignored.includes(text)) return
    const { file, line, column } = location
    console.log(cyan(`${file}:${line}:${column}`), prefix, text)
  }
}

const displayError = display(red('error:'))
const displayWarning = display(yellow('warning:'))

;(async () => {
  const root = resolve(__dirname, '../packages')
  const workspaces = await readdir(root)

  return Promise.all(workspaces.map((name) => {
    const meta: PackageJson = require(`${root}/${name}/package.json`)
    return build({
      entryPoints: [`${root}/${name}/src/index.ts`],
      bundle: true,
      platform: 'node',
      target: 'node12.19',
      charset: 'utf8',
      outfile: `${root}/${name}/index.js`,
      external: Object.keys({
        ...meta.dependencies,
        ...meta.peerDependencies,
      }),
      logLevel: 'silent',
    }).then(({ warnings }) => {
      warnings.forEach(displayWarning)
    }, ({ warnings, errors }: BuildFailure) => {
      errors.forEach(displayError)
      warnings.forEach(displayWarning)
    })
  }))
})()
