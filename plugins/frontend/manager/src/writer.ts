import { DataService } from '@koishijs/plugin-console'
import { Adapter, Bot, Context, remove, State } from 'koishi'
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
    'manager/bot-update'(id: string, adapter: string, config: any): void
    'manager/bot-remove'(id: string): void
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

    ctx.console.addListener('manager/bot-update', (id, adapter, config) => {
      this.updateBot(id, adapter, config)
    }, { authority: 4 })

    ctx.console.addListener('manager/bot-remove', (id) => {
      this.removeBot(id)
    }, { authority: 4 })

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

  private locate(name: string, parent: State): State {
    for (const key in parent.config) {
      const value = parent.config[key]
      const fork = parent[Loader.kRecord][key]
      if (key === name) {
        return fork
      } else if (key === '~' + name) {
        this.loader.reloadPlugin(parent.ctx, name, value)
        rename(parent.config, name, name, value)
        return parent[Loader.kRecord][name]
      } else if (key.startsWith('group:')) {
        const result = this.locate(name, fork)
        if (result) return result
      }
    }
  }

  updateBot(id: string, platform: string, config: any) {
    let bot: Bot
    const name = 'adapter-' + platform
    if (id) {
      bot = this.ctx.bots.find(bot => bot.id === id)
      const index = bot.adapter.bots.filter(bot => !bot.hidden).indexOf(bot)
      bot.adapter.ctx.state.parent.state.config[name].bots[index] = config
    } else {
      let fork = this.locate(name, this.loader.entry.state)
      if (!fork) {
        const config = this.loader.entry.state.config[name] = { bots: [] }
        this.loader.reloadPlugin(this.loader.entry, name, config)
        fork = this.loader.entry.state[Loader.kRecord][name]
      }
      fork.parent.state.config[name].bots.push(config)
      // make sure adapter get correct caller context
      bot = fork.ctx.bots.create(platform, config)
    }
    this.loader.writeConfig()
    this.refresh()
    bot.config = Adapter.library[Adapter.join(platform, bot.protocol)].schema(config)
    if (config.disabled) {
      bot.stop()
    } else {
      bot.start()
    }
  }

  removeBot(id: string) {
    const bot = this.ctx.bots.find(bot => bot.id === id)
    const index = bot.adapter.bots.filter(bot => !bot.hidden).indexOf(bot)
    const name = 'adapter-' + bot.adapter.platform
    const config = bot.adapter.ctx.state.parent.state.config[name]
    config.bots.splice(index, 1)
    this.loader.writeConfig()
    this.refresh()
    this.ctx.bots.remove(id)
    return bot.stop()
  }
}

export default ConfigWriter
