import { Dict } from 'koishi'
import { computed } from 'vue'
import { PackageJson } from '@koishijs/market'
import { MarketProvider } from '@koishijs/plugin-manager'
import { store } from '@koishijs/client'
import { getMixedMeta } from '../utils'
import {} from '@koishijs/cli'

interface DepInfo {
  name: string
  required: boolean
  fulfilled: boolean
}

interface ServiceDepInfo extends DepInfo {
  available?: string[]
}

interface PluginDepInfo extends DepInfo {
  local?: boolean
}

export interface EnvInfo {
  impl: string[]
  deps: Dict<PluginDepInfo>
  using: Dict<ServiceDepInfo>
  invalid?: boolean
  console?: boolean
}

function getKeywords(prefix: string, meta: Partial<PackageJson>) {
  prefix += ':'
  return (meta.keywords || [])
    .filter(name => name.startsWith(prefix))
    .map(name => name.slice(prefix.length))
}

function isAvailable(name: string, remote: MarketProvider.Data) {
  return getKeywords('impl', {
    ...remote.versions[0],
    ...store.packages[remote.name],
  }).includes(name)
}

function getEnvInfo(name: string) {
  function setService(name: string, required: boolean) {
    if (name === 'console') {
      result.console = true
      return
    }

    const fulfilled = name in store.services
    if (required && !fulfilled) result.invalid = true
    result.using[name] = { name, required, fulfilled }
    if (!fulfilled) {
      result.using[name].available = Object.values(store.market || {})
        .filter(data => isAvailable(name, data))
        .map(data => data.name)
    }
  }

  const data = getMixedMeta(name)
  const result: EnvInfo = { impl: [], using: {}, deps: {} }

  // check implementations
  for (const name of getKeywords('impl', data)) {
    if (name === 'adapter') continue
    result.impl.push(name)
  }

  // check services
  for (const name of getKeywords('required', data)) {
    setService(name, true)
  }
  for (const name of getKeywords('optional', data)) {
    setService(name, false)
  }

  // check dependencies
  for (const name in data.peerDependencies) {
    if (!name.startsWith('koishi-plugin-') || !name.startsWith('@koishijs/plugin-')) continue
    if (name === '@koishijs/plugin-console') continue
    const available = name in store.packages
    const fulfilled = !!store.packages[name]?.id
    if (!fulfilled) result.invalid = true
    result.deps[name] = { name, required: true, fulfilled, local: available }
    for (const impl of getKeywords('impl', getMixedMeta(name))) {
      delete result.using[impl]
    }
  }

  return result
}

export const envMap = computed(() => {
  return Object.fromEntries(Object.keys(store.packages).map(name => [name, getEnvInfo(name)]))
})

export interface Tree {
  label: string
  path: string
  config?: any
  disabled?: boolean
  children?: Tree[]
}

function getTree(prefix: string, plugins: any, map: Dict<Tree>): Tree[] {
  const trees: Tree[] = []
  for (const key in plugins) {
    if (key.startsWith('$')) continue
    const label = key.replace(/^~/, '')
    const path = prefix + label
    const config = plugins[key]
    const node: Tree = { label, path, config }
    if (key.startsWith('~')) {
      node.disabled = true
    }
    if (key.startsWith('+')) {
      node.label = '分组：' + label.slice(1)
      node.children = getTree(path + '/', config, map)
    }
    map[path] = node
    trees.push(node)
  }
  return trees
}

export const plugins = computed(() => {
  const map: Dict<Tree> = {
    '@global': {
      label: '全局设置',
      path: '@global',
      config: store.config,
    },
    '': {
      label: '所有插件',
      path: '',
      config: store.config.plugins,
    },
  }
  map[''].children = getTree('', store.config.plugins, map)
  return {
    map,
    data: [map['']],
  }
})
