import { config, context, internal } from 'koishi-plugin-eval/dist/worker'
import { promises, readFileSync } from 'fs'
import { resolve } from 'path'
import { Logger } from 'koishi-utils'
import * as addons from './koishi'
import ts from 'typescript'

const logger = Logger.create('addon')

const { SourceTextModule, SyntheticModule } = require('vm')

declare module 'koishi-plugin-eval/dist/worker' {
  interface WorkerData {
    addonNames: string[]
  }

  interface Require {
    (name: string): void
    modules: string[]
  }

  interface Global {
    require: Require
  }
}

const koishi = new SyntheticModule(['registerCommand', 'executeCommand'], function () {
  this.setExport('registerCommand', addons.registerCommand)
  this.setExport('executeCommand', addons.executeCommand)
}, { context })

const root = resolve(process.cwd(), config.moduleRoot)
const modules: Record<string, any> = { koishi }
config.addonNames.unshift(...Object.keys(modules))

function linker(specifier: string, reference: any) {
  if (specifier in modules) {
    return modules[specifier]
  }
  throw new Error(`Unable to resolve dependency "${specifier}"`)
}

const json = JSON.parse(readFileSync(resolve(root, 'tsconfig.json'), 'utf8'))
const { options: compilerOptions } = ts.parseJsonConfigFileContent(json, ts.sys, root)

async function createModule(path: string) {
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

export default Promise.all(config.addonNames.map(path => createModule(path).then(() => {
  logger.debug('load module %c', path)
}, (error) => {
  logger.warn(`cannot load module %c\n` + error.stack, path)
  delete modules[path]
}))).then(() => {
  function require(name: string) {
    const module = modules[name]
    if (!module) {
      throw new Error(`Cannot find module "${name}"`)
    }
    return internal.value(module.namespace)
  }

  require.modules = Object.keys(modules)
  internal.setGlobal('require', require)
})
