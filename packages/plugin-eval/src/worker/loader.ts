import { config, context, internal, Loader } from '.'
import { resolve, posix, dirname, extname } from 'path'
import { promises as fs } from 'fs'
import { deserialize, serialize, cachedDataVersionTag } from 'v8'
import { Logger } from 'koishi-utils'

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

export function synthetize(identifier: string, namespace: {}, globalName?: string) {
  const module = new SyntheticModule(Object.keys(namespace), function () {
    for (const key in namespace) {
      this.setExport(key, internal.contextify(namespace[key]))
    }
  }, { context, identifier })
  modules[identifier] = module
  config.addonNames?.unshift(identifier)
  if (globalName) synthetics[globalName] = module
}

const suffixes = ['', '.js', '.ts', '/index.js', '/index.ts']

function locateModule(specifier: string) {
  for (const suffix of suffixes) {
    const target = specifier + suffix
    if (target in modules) return modules[target]
  }
}

async function loadSource(path: string): Promise<[source: string, identifier: string]> {
  for (const suffix of suffixes) {
    try {
      const target = path + suffix
      return [await fs.readFile(resolve(config.root, target), 'utf8'), target]
    } catch {}
  }
  throw new Error(`cannot load source file "${path}"`)
}

const relativeRE = /^\.\.?[\\/]/

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

interface FileCache {
  outputText: string
  cachedData: Buffer
}

const CACHE_TAG = 1
const V8_TAG = cachedDataVersionTag()
const files: Record<string, FileCache> = {}
const cachedFiles: Record<string, FileCache> = {}

export async function readSerialized(filename: string): Promise<[any?, Buffer?]> {
  try {
    const buffer = await fs.readFile(filename)
    return [deserialize(buffer), buffer]
  } catch {
    return []
  }
}

// errors should be catched because we should not expose file paths to users
export async function safeWriteFile(filename: string, data: any) {
  try {
    await fs.mkdir(dirname(filename), { recursive: true })
    await fs.writeFile(filename, data)
  } catch (error) {
    logger.warn(error)
  }
}

declare const BUILTIN_LOADERS: string[]

const loaders: Record<string, Loader> = {}

export default async function prepare() {
  if (!config.root) return
  const cachePath = resolve(config.root, config.cacheFile || '.koishi/cache')
  await readSerialized(cachePath).then(([data]) => {
    if (data && data.tag === CACHE_TAG && data.v8tag === V8_TAG) {
      Object.assign(cachedFiles, data.files)
    }
  })
  await Promise.all(config.addonNames.map(evaluate))
  safeWriteFile(cachePath, serialize({ tag: CACHE_TAG, v8tag: V8_TAG, files }))
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

function resolveLoader(extension: string) {
  const filename = config.moduleLoaders[extension]
  if (BUILTIN_LOADERS.includes(filename)) {
    return require('../loaders/' + filename)
  } else if (filename) {
    return require(resolve(process.cwd(), filename))
  } else if (extension === '.js') {
    return require('../loaders/default')
  } else if (extension === '.ts') {
    for (const filename of ['esbuild', 'typescript']) {
      try {
        return require('../loaders/' + filename)
      } catch {}
    }
    throw new Error('cannot resolve loader for ".ts", you should install either esbuild or typescript + json5 by yourself')
  } else {
    throw new Error(`cannot resolve loader for "${extension}", you should specify a custom loader through "config.moduleLoaders"`)
  }
}

async function createLoader(extension: string) {
  const loader: Loader = resolveLoader(extension)
  logger.debug('creating loader for %c', extension)
  await loader.prepare?.(config)
  return loader
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
      const extension = extname(identifier)
      const loader = loaders[extension] ||= await createLoader(extension)
      const outputText = await loader.transformModule(source)
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