import { config, context, setGlobal, sandbox } from 'koishi-plugin-eval/dist/worker'
import { readdirSync } from 'fs'
import { readFile } from 'fs/promises'
import { resolve } from 'path'
import { transpileModule, ScriptTarget, CompilerOptions } from 'typescript'
import { Logger } from 'koishi-utils'

const logger = Logger.create('addon')

const { SourceTextModule, SyntheticModule } = require('vm')

declare module 'koishi-plugin-eval/dist/worker' {
  export default interface Global {
    require (name: string): void
  }
}

const koishi = new SyntheticModule(['command'], function () {
  this.setExport('command', function command () {
    sandbox.log('COMMAND CALLED')
  })
}, { context })

const root = resolve(process.cwd(), config.moduleRoot)
const paths = readdirSync(root).filter(name => !name.includes('.'))
const modules: Record<string, any> = { koishi }
paths.push(...Object.keys(modules))

setGlobal('require', function require (name) {
  const module = modules[name]
  if (!module) {
    throw new Error(`Cannot find module "${name}".`)
  }
  return module.namespace
})

function linker (specifier: string, reference: any) {
  if (specifier in modules) {
    return modules[specifier]
  }
  throw new Error(`Unable to resolve dependency "${specifier}"`)
}

const compilerOptions: CompilerOptions = {
  target: ScriptTarget.ES2020,
  noEmit: true,
}

async function createModule (path: string) {
  if (!modules[path]) {
    const content = await readFile(resolve(root, path, 'index.ts'), 'utf8')
    const { outputText } = transpileModule(content, {
      compilerOptions,
    })
    modules[path] = new SourceTextModule(outputText, { context })
  }
  const module = modules[path]
  await module.link(linker)
  await module.evaluate()
}

export default Promise.all(paths.map(async (path) => {
  return createModule(path).catch((error) => {
    logger.warn(`cannot load addon module %c\n` + error.stack, path)
    delete modules[path]
  })
}))
