import { config, context, setGlobal, sandbox, value } from 'koishi-plugin-eval/dist/worker'
import { readdirSync, promises, readFileSync } from 'fs'
import { resolve } from 'path'
import { Logger } from 'koishi-utils'
import ts from 'typescript'

const logger = Logger.create('addons')

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
    throw new Error(`Cannot find module "${name}"`)
  }
  return value(module.namespace)
})

function linker (specifier: string, reference: any) {
  if (specifier in modules) {
    return modules[specifier]
  }
  throw new Error(`Unable to resolve dependency "${specifier}"`)
}

const json = JSON.parse(readFileSync(resolve(root, 'tsconfig.json'), 'utf8'))
const { options: compilerOptions } = ts.parseJsonConfigFileContent(json, ts.sys, root)

async function createModule (path: string) {
  if (!modules[path]) {
    const content = await promises.readFile(resolve(root, path, 'index.ts'), 'utf8')
    const { outputText } = ts.transpileModule(content, {
      compilerOptions,
    })
    modules[path] = new SourceTextModule(outputText, { context, identifier: path })
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
