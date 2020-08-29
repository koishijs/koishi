import { remote, config, context, internal, WorkerAPI, Context, response, mapDirectory, formatError } from 'koishi-plugin-eval/dist/worker'
import { promises as fs, readFileSync } from 'fs'
import { resolve, posix, dirname } from 'path'
import { Logger, Time, CQCode, Random } from 'koishi-utils'
import { serialize, deserialize } from 'v8'
import json5 from 'json5'
import ts from 'typescript'

const logger = new Logger('addon')

const { SourceTextModule, SyntheticModule } = require('vm')

export interface AddonWorkerConfig {
  storageFile?: string
  moduleRoot?: string
}

declare module 'koishi-plugin-eval/dist/worker' {
  interface WorkerConfig extends AddonWorkerConfig {}

  interface WorkerData {
    addonNames: string[]
  }

  interface WorkerAPI {
    callAddon(options: ContextOptions, argv: AddonArgv): Promise<string | void>
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

interface AddonContext extends AddonArgv, Context {}

type AddonAction = (ctx: AddonContext) => string | void | Promise<string | void>
const commandMap: Record<string, AddonAction> = {}

const addons: any = {
  registerCommand(name: string, callback: AddonAction) {
    commandMap[name] = callback
  },
}

WorkerAPI.prototype.callAddon = async function (this: WorkerAPI, options, argv) {
  const callback = commandMap[argv.name]
  try {
    const ctx = { ...argv, ...Context(options) }
    const result = await callback(ctx)
    await this.sync(ctx)
    return result
  } catch (error) {
    if (!argv.options.debug) return logger.warn(error)
    return formatError(error)
      .replace('WorkerAPI.worker_1.WorkerAPI.callAddon', 'WorkerAPI.callAddon')
  }
}

const sync = WorkerAPI.prototype.sync
WorkerAPI.prototype.sync = async function (this: WorkerAPI, ctx) {
  await sync.call(this, ctx)
  await remote.updateStorage(serialize(storage))
}

// TODO pending @types/node
interface Module {
  status: string
  identifier: string
  namespace: any
  link(linker: (specifier: string, referenceModule: Module) => Promise<Module>): Promise<void>
  evaluate(): Promise<void>
}

export const modules: Record<string, Module> = {}

export function synthetize(identifier: string, namespace: {}) {
  const module = new SyntheticModule(Object.keys(namespace), function () {
    for (const key in namespace) {
      this.setExport(key, internal.contextify(namespace[key]))
    }
  }, { context, identifier })
  modules[identifier] = module
  config.addonNames.unshift(identifier)
}

let storage = {}
if (config.storageFile) {
  const storageFile = resolve(process.cwd(), config.storageFile)
  try {
    storage = deserialize(readFileSync(storageFile))
  } catch {}
  addons.storage = storage
}

synthetize('koishi/addons.ts', addons)

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

const json = json5.parse(readFileSync(resolve(config.moduleRoot, 'tsconfig.json'), 'utf8'))
const { options: compilerOptions } = ts.parseJsonConfigFileContent(json, ts.sys, config.moduleRoot)

async function loadSource(path: string) {
  for (const postfix of suffixes) {
    try {
      const target = path + postfix
      return [await fs.readFile(resolve(config.moduleRoot, target), 'utf8'), target]
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

  const type = module instanceof SyntheticModule ? 'synthetic' : 'source text'
  logger.debug('creating %s module %c', type, module.identifier)
  await module.link(linker)
  await module.evaluate()

  if (!path.includes('/')) {
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
  if (config.storageFile) {
    internal.setGlobal('storage', storage, false, false)
  }
})
