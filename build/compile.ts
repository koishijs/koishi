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
    if (!location) return console.log(prefix, text)
    const { file, line, column } = location
    console.log(cyan(`${file}:${line}:${column}:`), prefix, text)
  }
}

const displayError = display(red('error:'))
const displayWarning = display(yellow('warning:'))

;(async () => {
  const root = resolve(__dirname, '../packages')
  const workspaces = await readdir(root)

  return Promise.all(workspaces.map((name) => {
    const base = `${root}/${name}`
    const meta: PackageJson = require(base + `/package.json`)
    const entryPoints = [base + '/src/index.ts']
    const external = Object.keys({
      ...meta.dependencies,
      ...meta.peerDependencies,
    })
    if (name === 'koishi') {
      entryPoints.push(base + '/src/cli.ts')
      entryPoints.push(base + '/src/worker.ts')
    } else if (name === 'plugin-eval') {
      entryPoints.push(base + '/src/worker.ts')
      entryPoints.push(base + '/src/internal.ts')
    } else if (name === 'plugin-eval-addons') {
      entryPoints.push(base + '/src/worker.ts')
    }

    return build({
      external,
      entryPoints,
      bundle: true,
      platform: 'node',
      target: 'node12.19',
      charset: 'utf8',
      outdir: `${root}/${name}`,
      logLevel: 'silent',
    }).then(({ warnings }) => {
      warnings.forEach(displayWarning)
    }, ({ warnings, errors }: BuildFailure) => {
      errors.forEach(displayError)
      warnings.forEach(displayWarning)
    })
  }))
})()
