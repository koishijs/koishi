import { config, context, internal } from './worker'
import { resolve, posix, dirname } from 'path'
import { promises as fs } from 'fs'
import { deserialize, serialize, cachedDataVersionTag } from 'v8'
import { Logger, noop } from 'koishi-utils'
import json5 from 'json5'
import ts from 'typescript'

const logger = new Logger('eval:loader')

// TODO pending @types/node
const { SourceTextModule, SyntheticModule } = require('vm')

interface Module {
  status: string
  identifier: string
  namespace: any
  link(linker: (specifier: string, referenceModule: Module) => Promise<Module>): Promise<void>
  evaluate(): Promise<void>
  createCachedData(): Buffer
}

export const modules: Record<string, Module> = {}
export const synthetics: Record<string, Module> = {}

export function synthetize(identifier: string, namespace: {}, name?: string) {
  const module = new SyntheticModule(Object.keys(namespace), function () {
    for (const key in namespace) {
      this.setExport(key, internal.contextify(namespace[key]))
    }
  }, { context, identifier })
  modules[identifier] = module
  config.addonNames?.unshift(identifier)
  if (name) synthetics[name] = module
}

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

const compilerOptions: ts.CompilerOptions = {
  inlineSourceMap: true,
  module: ts.ModuleKind.ES2020,
  target: ts.ScriptTarget.ES2020,
}

interface FileCache {
  outputText: string
  cachedData: Buffer
}

const CACHE_TAG = 1
const V8_TAG = cachedDataVersionTag()
const files: Record<string, FileCache> = {}
const cachedFiles: Record<string, FileCache> = {}

export default async function prepare() {
  if (!config.addonRoot) return

  const tsconfigPath = resolve(config.addonRoot, 'tsconfig.json')
  const cachePath = resolve(config.addonRoot, config.cacheFile || '.koishi/cache')
  await Promise.all([
    fs.readFile(tsconfigPath, 'utf8').then((tsconfig) => {
      Object.assign(compilerOptions, json5.parse(tsconfig))
    }, () => {
      logger.info('auto generating tsconfig.json...')
      return fs.writeFile(tsconfigPath, json5.stringify({ compilerOptions }, null, 2))
    }),
    fs.readFile(cachePath).then((source) => {
      const data = deserialize(source)
      if (data.tag === CACHE_TAG && data.v8tag === V8_TAG) {
        Object.assign(cachedFiles, data.files)
      }
    }, noop),
  ])
  await Promise.all(config.addonNames.map(evaluate))
  saveCache(cachePath).catch(logger.warn)
  for (const key in synthetics) {
    exposeGlobal(key, synthetics[key].namespace)
  }
}

const MockModule = class Module {}

function exposeGlobal(name: string, namespace: {}) {
  const outer = new MockModule()
  for (const key in namespace) {
    outer[key] = internal.decontextify(namespace[key])
  }
  internal.connect(outer, namespace)
  internal.setGlobal(name, outer)
}

async function saveCache(filename: string) {
  await fs.mkdir(dirname(filename), { recursive: true })
  await fs.writeFile(filename, serialize({ tag: CACHE_TAG, v8tag: V8_TAG, files }))
}

async function loadSource(path: string): Promise<[source: string, identifier: string]> {
  for (const postfix of suffixes) {
    try {
      const target = path + postfix
      return [await fs.readFile(resolve(config.addonRoot, target), 'utf8'), target]
    } catch {}
  }
  throw new Error(`cannot load source file "${path}"`)
}

async function createModule(path: string) {
  let module = locateModule(path), type = 'synthetic'
  if (!module) {
    const [source, identifier] = await loadSource(path)
    const cache = cachedFiles[source]
    if (cache) {
      type = 'cached text'
      const { outputText, cachedData } = files[source] = cache
      module = new SourceTextModule(outputText, { context, identifier, cachedData })
    } else {
      type = 'source text'
      const { outputText } = ts.transpileModule(source, {
        compilerOptions,
      })
      module = new SourceTextModule(outputText, { context, identifier })
      const cachedData = module.createCachedData()
      files[source] = { outputText, cachedData }
    }
    modules[identifier] = module
  } else if (module.status !== 'unlinked') {
    return module
  }

  logger.debug('creating %s module %c', type, module.identifier)
  await module.link(linker)
  await module.evaluate()

  if (!path.includes('/') && Object.keys(module.namespace).length) {
    exposeGlobal(path, module.namespace)
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
