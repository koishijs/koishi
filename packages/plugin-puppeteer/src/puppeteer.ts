import { launch, LaunchOptions, Browser, Page } from 'puppeteer-core'
import { onStart, appList, Context } from 'koishi-core'
import { Logger } from 'koishi-utils'

declare module 'koishi-core/dist/app' {
  interface AppOptions {
    puppeteer?: LaunchOptions
  }
}

declare module 'koishi-core/dist/context' {
  interface Context {
    getPage (): Promise<Page>
    freePage (page: Page): void
  }
}

const logger = Logger.create('puppeteer')
let browserPromise: Promise<Browser>
const idlePages: Page[] = []

export async function getPage () {
  if (idlePages.length) {
    return idlePages.pop()
  }

  const browser = await browserPromise
  logger.debug('create new page')
  return browser.newPage()
}

export function freePage (page: Page) {
  idlePages.push(page)
}

Context.prototype.getPage = getPage
Context.prototype.freePage = freePage

onStart(() => {
  browserPromise = launch(appList[0].options.puppeteer)
  browserPromise.then(
    () => logger.debug('browser launched'),
    (error) => logger.warn(error),
  )
})
