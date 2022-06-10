import { Dict } from 'koishi'
import { computed } from 'vue'
import { PackageJson } from '@koishijs/market'
import { MarketProvider } from '@koishijs/plugin-manager'
import { router, store } from '@koishijs/client'
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
  id: string
  alias: string
  label: string
  path: string
  config?: any
  target?: string
  disabled?: boolean
  children?: Tree[]
}

function getTree(prefix: string, plugins: any): Tree[] {
  const trees: Tree[] = []
  for (let key in plugins) {
    if (key.startsWith('$')) continue
    const config = plugins[key]
    const node = { config } as Tree
    if (key.startsWith('~')) {
      node.disabled = true
      key = key.slice(1)
    }
    node.label = key.split(':', 1)[0]
    node.alias = key.slice(node.label.length + 1)
    node.id = node.path = prefix + key
    if (key.startsWith('group:')) {
      node.children = getTree(node.path + '/', config)
    }
    trees.push(node)
  }
  return trees
}

export const plugins = computed(() => {
  const root: Tree = {
    label: '所有插件',
    id: '',
    path: '',
    alias: '',
    config: store.config.plugins,
    children: getTree('', store.config.plugins),
  }
  const paths: Dict<Tree> = {
    '$global': {
      label: '全局设置',
      path: '$global',
      id: '$global',
      alias: '',
      config: store.config,
    },
  }
  const expanded: string[] = []
  function traverse(tree: Tree) {
    if (!tree.config?.$collapsed && tree.children) {
      expanded.push(tree.id)
    }
    paths[tree.path] = tree
    tree.children?.forEach(traverse)
  }
  traverse(root)
  return { data: [root], paths, expanded }
})

export function setPath(oldPath: string, newPath: string) {
  if (oldPath === newPath) return
  for (const key of Object.keys(plugins.value.paths)) {
    if (key !== oldPath && !key.startsWith(oldPath + '/')) continue
    const tree = plugins.value.paths[key]
    tree.path = newPath + key.slice(oldPath.length)
    plugins.value.paths[tree.path] = tree
    delete plugins.value.paths[key]
  }
  router.replace('/plugins/' + newPath)
}
