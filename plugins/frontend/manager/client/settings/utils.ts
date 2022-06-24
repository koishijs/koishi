import { Dict } from 'koishi'
import { computed } from 'vue'
import { MarketProvider } from '@koishijs/plugin-manager'
import { router, send, store } from '@koishijs/client'
import {} from '@koishijs/cli'

interface DepInfo {
  required: boolean
  available: string[]
}

export interface EnvInfo {
  impl: string[]
  using: Dict<DepInfo>
  warning?: boolean
  console?: boolean
}

function isAvailable(name: string, remote: MarketProvider.Data) {
  return {
    ...remote.versions[0],
    ...store.packages[remote.name],
  }.manifest?.service.implements.includes(name)
}

function getEnvInfo(name: string) {
  function setService(name: string, required: boolean) {
    if (name === 'console') {
      result.console = true
      return
    }

    const available = Object.values(store.market || {})
      .filter(data => isAvailable(name, data))
      .map(data => data.name)
    result.using[name] = { required, available }
  }

  const local = store.packages[name]
  const result: EnvInfo = { impl: [], using: {} }

  // check implementations
  for (const name of local.manifest.service.implements) {
    if (name === 'adapter') continue
    result.impl.push(name)
  }

  // check services
  for (const name of local.manifest.service.required) {
    setService(name, true)
  }
  for (const name of local.manifest.service.optional) {
    setService(name, false)
  }

  // check reusability
  if (local.id && !local.forkable) {
    result.warning = true
  }

  // check schema
  if (!local.schema) {
    result.warning = true
  }

  return result
}

export const envMap = computed(() => {
  return Object.fromEntries(Object
    .keys(store.packages)
    .filter(x => x)
    .map(name => [name, getEnvInfo(name)]))
})

export interface Tree {
  id: string
  alias: string
  label: string
  path: string
  config?: any
  target?: string
  parent?: Tree
  disabled?: boolean
  children?: Tree[]
}

function getTree(parent: Tree, plugins: any): Tree[] {
  const trees: Tree[] = []
  for (let key in plugins) {
    if (key.startsWith('$')) continue
    const config = plugins[key]
    const node = { config, parent } as Tree
    if (key.startsWith('~')) {
      node.disabled = true
      key = key.slice(1)
    }
    node.label = key.split(':', 1)[0]
    node.alias = key.slice(node.label.length + 1)
    node.id = node.path = parent.path + (parent.path ? '/' : '') + key
    if (key.startsWith('group:')) {
      node.children = getTree(node, config)
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
  }
  root.children = getTree(root, store.config.plugins)
  const paths: Dict<Tree> = {
    '@global': {
      label: '全局设置',
      path: '@global',
      id: '@global',
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

export const separator = /(?<!@[\w-]+)\//g

export function addItem(path: string, action: 'group' | 'unload', name: string) {
  const id = Math.random().toString(36).slice(2, 8)
  if (path) path += '/'
  path += name + ':' + id
  send(`manager/${action}`, path)
  router.replace('/plugins/' + path)
}

export function removeItem(path: string) {
  send('manager/remove', path)
  const segments = path.split(separator)
  segments.pop()
  router.replace('/plugins/' + segments.join('/'))
}
