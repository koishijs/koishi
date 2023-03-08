import { App, Argv, Awaitable, Channel, Command, User } from 'koishi'
import zhCN from './locales/zh-CN.yml'
import enUS from './locales/en-US.yml'
import jaJP from './locales/ja-JP.yml'
import frFR from './locales/fr-FR.yml'
import zhTW from './locales/zh-TW.yml'

const refs = new WeakSet<App>()

function loadI18n(app: App) {
  if (refs.has(app)) return
  refs.add(app)
  app.i18n.define('zh', zhCN)
  app.i18n.define('en', enUS)
  app.i18n.define('ja', jaJP)
  app.i18n.define('fr', frFR)
  app.i18n.define('zh-TW', zhTW)
}

export function handleError<U extends User.Field, G extends Channel.Field, A extends any[], O extends {}>(
  cmd: Command<U, G, A, O>,
  handler?: (error: Error, argv: Argv<U, G, A, O>) => Awaitable<void | string>,
) {
  loadI18n(cmd.ctx.root)

  return cmd.action(async (argv, ...args) => {
    try {
      return await argv.next()
    } catch (error) {
      if (handler) return handler(error, argv)
      return argv.session.text('internal.error-encountered', [error.message])
    }
  }, true)
}
