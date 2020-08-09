import { config, context, setGlobal } from 'koishi-plugin-eval/dist/worker'
import { readdirSync } from 'fs'
import { readFile } from 'fs/promises'
import { resolve } from 'path'

const { SourceTextModule } = require('vm')

declare module 'koishi-plugin-eval/dist/worker' {
  export default interface Global {
    require (name: string): void
  }
}

const root = resolve(process.cwd(), config.moduleRoot)
const paths = readdirSync(root).filter(name => !name.includes('.'))

const modules: Record<string, any> = {}

setGlobal('require', function require (name) {
  const module = modules[name]
  if (!module) {
    throw new Error(`Cannot find module "${name}".`)
  }
  return module.namespace
})

export default Promise.all(paths.map(async (path) => {
  const content = await readFile(resolve(root, path, 'index.ts'), 'utf8')
  const module = modules[path] = new SourceTextModule(content, { context })

  await module.link(async (specifier, reference) => {
  })

  await module.evaluate()
}))
