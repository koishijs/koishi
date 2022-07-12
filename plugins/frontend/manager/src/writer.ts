import { DataService } from '@koishijs/plugin-console'
import { Context, remove } from 'koishi'
import { Loader } from '@koishijs/cli'
import { LocalPackage } from './utils'
import { readFileSync } from 'fs'
import { conclude } from '@koishijs/registry'

declare module '@koishijs/plugin-console' {
  interface Events {
    'manager/app-reload'(config: any): void
    'manager/teleport'(source: string, target: string, index: number): void
    'manager/reload'(path: string, config: any, key?: string): void
    'manager/unload'(path: string, config: any, key?: string): void
    'manager/remove'(path: string): void
    'manager/group'(path: string): void
    'manager/alias'(path: string, alias: string): void
    'manager/meta'(path: string, config: any): void
  }
}

const separator = /(?<!@[\w-]+)\//g

function insertKey(object: {}, temp: {}, rest: string[]) {
  for (const key of rest) {
    temp[key] = object[key]
    delete object[key]
  }
  Object.assign(object, temp)
}

function rename(object: any, old: string, neo: string, value: any) {
  const keys = Object.keys(object)
  const index = keys.findIndex(key => key === old || key === '~' + old)
  const rest = index < 0 ? [] : keys.slice(index + 1)
  const temp = { [neo]: value }
  delete object[old]
  delete object['~' + old]
  insertKey(object, temp, rest)
}

function dropKey(plugins: {}, name: string) {
  if (!(name in plugins)) {
    name = '~' + name
  }
  const value = plugins[name]
  delete plugins[name]
  return { [name]: value }
}

class ConfigWriter extends DataService<Context.Config> {
  private loader: Loader
  private plugins: {}

  constructor(ctx: Context) {
    super(ctx, 'config', { authority: 4 })
    this.loader = ctx.loader
    this.plugins = ctx.loader.config.plugins

    ctx.console.addListener('manager/app-reload', (config) => {
      this.reloadApp(config)
    }, { authority: 4 })

    for (const key of ['teleport', 'reload', 'unload', 'remove', 'group', 'meta', 'alias'] as const) {
      ctx.console.addListener(`manager/${key}`, this[key].bind(this), { authority: 4 })
    }

    ctx.on('config', () => this.refresh())
  }

  getGroup(plugins: any, ctx: Context) {
    const result = { ...plugins }
    result.$deps = {}
    for (const key in plugins) {
      if (key.startsWith('$')) continue
      const value = plugins[key]
      const name = key.split(':', 1)[0].replace(/^~/, '')

      // handle plugin groups
      if (name === 'group') {
        const fork = ctx.state[Loader.kRecord][key]
        result[key] = this.getGroup(value, fork.ctx)
        for (const name in result[key].$deps) {
          if (result[key].$isolate?.includes(name)) continue
          result.$deps[name] ??= result[key].$deps[name]
        }
        continue
      }

      // handle ordinary plugins
      try {
        const filename = this.loader.scope.resolve(name + '/package.json')
        const meta: LocalPackage = JSON.parse(readFileSync(filename, 'utf8'))
        const { required, optional, implements: impl } = conclude(meta).service
        for (const name of [...required, ...optional, ...impl]) {
          result.$deps[name] ??= ctx[name]?.[Context.source]?.state.uid ?? 0
        }
      } catch (err) {}
    }
    return result
  }

  async get() {
    const result = { ...this.loader.config }
    result.plugins = this.getGroup(result.plugins, this.loader.entry)
    return result
  }

  reloadApp(config: any) {
    this.loader.config = config
    this.loader.config.plugins = this.plugins
    this.loader.writeConfig()
    this.loader.fullReload()
  }

  private resolve(path: string) {
    const segments = path.split(separator)
    let ctx = this.loader.entry
    let name = segments.shift()
    while (segments.length) {
      ctx = ctx.state[Loader.kRecord][name].ctx
      name = segments.shift()
    }
    return [ctx.state, name] as const
  }

  alias(path: string, alias: string) {
    const [parent, oldKey] = this.resolve(path)
    let config: any
    let newKey = oldKey.split(':', 1)[0] + (alias ? ':' : '') + alias
    const record = parent[Loader.kRecord]
    const fork = record[oldKey]
    if (fork) {
      delete record[oldKey]
      record[newKey] = fork
      fork.alias = alias
      fork.ctx.emit('internal/fork', fork)
      config = parent.config[oldKey]
    } else {
      newKey = '~' + newKey
      config = parent.config['~' + oldKey]
    }
    rename(parent.config, oldKey, newKey, config)
    this.loader.writeConfig()
  }

  meta(path: string, config: any) {
    const [parent, name] = this.resolve(path)
    const target = path ? parent.config[name] : parent.config
    for (const key of Object.keys(config)) {
      if (config[key] === null) {
        delete target[key]
      } else {
        target[key] = config[key]
      }
    }
    this.loader.writeConfig()
  }

  reload(path: string, config: any, newKey?: string) {
    const [parent, oldKey] = this.resolve(path)
    if (newKey) {
      this.loader.unloadPlugin(parent.ctx, oldKey)
    }
    this.loader.reloadPlugin(parent.ctx, newKey || oldKey, config)
    rename(parent.config, oldKey, newKey || oldKey, config)
    this.loader.writeConfig()
    this.refresh()
  }

  unload(path: string, config = {}, newKey?: string) {
    const [parent, oldKey] = this.resolve(path)
    this.loader.unloadPlugin(parent.ctx, oldKey)
    rename(parent.config, oldKey, '~' + (newKey || oldKey), config)
    this.loader.writeConfig()
    this.refresh()
  }

  remove(path: string) {
    const [parent, key] = this.resolve(path)
    this.loader.unloadPlugin(parent.ctx, key)
    delete parent.config[key]
    delete parent.config['~' + key]
    this.loader.writeConfig()
    this.refresh()
  }

  group(path: string) {
    const [parent, oldKey] = this.resolve(path)
    const config = parent.config[oldKey] = {}
    this.loader.reloadPlugin(parent.ctx, oldKey, config)
    this.loader.writeConfig()
    this.refresh()
  }

  teleport(source: string, target: string, index: number) {
    const [parentS, oldKey] = this.resolve(source)
    const [parentT] = this.resolve(target ? target + '/' : '')

    // teleport fork
    const fork = parentS[Loader.kRecord][oldKey]
    if (fork && parentS !== parentT) {
      delete parentS[Loader.kRecord][oldKey]
      parentT[Loader.kRecord][oldKey] = fork
      remove(parentS.disposables, fork.dispose)
      parentT.disposables.push(fork.dispose)
      fork.parent = parentT.ctx
      Object.setPrototypeOf(fork.ctx, parentT.ctx)
      fork.ctx.emit('internal/fork', fork)
      if (fork.runtime.using.some(name => parentS[name] !== parentT[name])) {
        fork.restart()
      }
    }

    // teleport config
    const temp = dropKey(parentS.config, oldKey)
    const rest = Object.keys(parentT.config).slice(index)
    insertKey(parentT.config, temp, rest)
    this.loader.writeConfig()
  }
}

export default ConfigWriter
