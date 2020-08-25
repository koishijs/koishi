import { config, context, internal, WorkerAPI, contextFactory, response } from 'koishi-plugin-eval/dist/worker'
import { promises, readFileSync } from 'fs'
import { resolve } from 'path'
import { Logger } from 'koishi-utils'
import { Config } from '.'
import ts from 'typescript'

const logger = new Logger('addon')

const { SourceTextModule, SyntheticModule } = require('vm')

declare module 'koishi-plugin-eval/dist/worker' {
  interface WorkerConfig extends Config {}

  interface WorkerData {
    addonNames: string[]
  }

  interface WorkerAPI {
    addon(sid: string, user: {}, argv: WorkerArgv): string | void | Promise<string | void>
  }

  interface Response {
    commands: string[]
  }
}

interface WorkerArgv {
  name: string
  args: string[]
  options: Record<string, any>
  rest: string
}

type AddonAction = (argv: WorkerArgv) => string | void | Promise<string | void>
const commandMap: Record<string, AddonAction> = {}

WorkerAPI.prototype.addon = async function (sid, user, argv) {
  const callback = commandMap[argv.name]
  try {
    return await callback({ ...argv, ...contextFactory(sid, user) })
  } catch (error) {
    logger.warn(error)
  }
}

const koishi = new SyntheticModule(['registerCommand'], function () {
  this.setExport('registerCommand', function registerCommand(name: string, callback: AddonAction) {
    commandMap[name] = callback
  })
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
  internal.setGlobal(path, modules[path].namespace)
}, (error) => {
  logger.warn(`cannot load module %c\n` + error.stack, path)
  delete modules[path]
}))).then(() => {
  response.commands = Object.keys(commandMap)
})
