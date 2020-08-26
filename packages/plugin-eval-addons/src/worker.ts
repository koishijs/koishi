import { config, context, internal, WorkerAPI, createContext, response, mapDirectory } from 'koishi-plugin-eval/dist/worker'
import { promises, readFileSync } from 'fs'
import { resolve, posix, dirname } from 'path'
import { User } from 'koishi-core'
import { Logger, Time, CQCode, Random } from 'koishi-utils'
import { Config } from '.'
import json5 from 'json5'
import ts from 'typescript'

const logger = new Logger('addon')

const { SourceTextModule, SyntheticModule } = require('vm')

declare module 'koishi-plugin-eval/dist/worker' {
  interface WorkerConfig extends Config {}

  interface WorkerData {
    addonNames: string[]
  }

  interface WorkerAPI {
    addon(sid: string, user: Partial<User>, argv: AddonArgv): Promise<string | void>
  }

  interface Response {
    commands: string[]
  }
}

interface AddonArgv {
  name: string
  args: string[]
  options: Record<string, any>
}

interface AddonContext extends AddonArgv {
  user: Partial<User>
}

type AddonAction = (ctx: AddonContext) => string | void | Promise<string | void>
const commandMap: Record<string, AddonAction> = {}

WorkerAPI.prototype.addon = async function (sid, user, argv) {
  const callback = commandMap[argv.name]
  try {
    return await callback({ user, ...argv, ...createContext(sid) })
  } catch (error) {
    logger.warn(error)
  }
}

// TODO pending @types/node
interface Module {
  status: string
  identifier: string
  namespace: any
  link(linker: (specifier: string, referenceModule: Module) => Promise<Module>): Promise<void>
  evaluate(): Promise<void>
}

const root = resolve(process.cwd(), config.moduleRoot)
export const modules: Record<string, Module> = {}

export function synthetize(identifier: string, namespace: {}) {
  const module = new SyntheticModule(Object.keys(namespace), function () {
    for (const key in namespace) {
      this.setExport(key, namespace[key])
    }
  }, { context, identifier })
  modules[identifier] = module
  config.addonNames.unshift(identifier)
}

synthetize('koishi/addons.ts', {
  registerCommand(name: string, callback: AddonAction) {
    commandMap[name] = callback
  },
})

synthetize('koishi/utils.ts', {
  Time, CQCode, Random,
})

const suffixes = ['', '.ts', '/index.ts']
const relativeRE = /^\.\.?[\\/]/

function locateModule(specifier: string) {
  for (const suffix of suffixes) {
    const target = specifier + suffix
    if (target in modules) return modules[target]
  }
}

async function linker(specifier: string, { identifier }: Module) {
  // resolve path based on reference module
  if (relativeRE.test(specifier)) {
    specifier = `${dirname(identifier)}/${specifier}`
  }
  specifier = posix.normalize(specifier)

  // load from cache
  const module = locateModule(specifier)
  if (module) return module

  // create new module
  const [dir] = specifier.split('/', 1)
  if (config.addonNames.includes(dir)) {
    return await createModule(specifier)
  }

  throw new Error(`Unable to resolve dependency "${specifier}" in "${identifier}"`)
}

const json = json5.parse(readFileSync(resolve(root, 'tsconfig.json'), 'utf8'))
const { options: compilerOptions } = ts.parseJsonConfigFileContent(json, ts.sys, root)

async function loadSource(path: string) {
  for (const postfix of suffixes) {
    try {
      const target = path + postfix
      return [await promises.readFile(resolve(root, target), 'utf8'), target]
    } catch {}
  }
  throw new Error(`cannot load source file "${path}"`)
}

async function createModule(path: string) {
  let module = locateModule(path)
  if (!module) {
    const [source, identifier] = await loadSource(path)
    const { outputText } = ts.transpileModule(source, {
      compilerOptions,
    })
    module = modules[identifier] = new SourceTextModule(outputText, { context, identifier })
  }

  logger.debug('creating module %c', module.identifier)
  await module.link(linker)
  await module.evaluate()

  if (module instanceof SourceTextModule) {
    internal.setGlobal(path, module.namespace)
  }
  return module
}

export async function evaluate(path: string) {
  try {
    await createModule(path)
  } catch (error) {
    logger.warn(`cannot load module %c\n` + error.stack, path)
  }
}

export default Promise.all(config.addonNames.map(evaluate)).then(() => {
  response.commands = Object.keys(commandMap)
  mapDirectory('koishi/utils/', require.resolve('koishi-utils'))
  internal.setGlobal('utils', modules['koishi/utils.ts'].namespace)
})
