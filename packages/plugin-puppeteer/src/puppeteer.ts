import { launch, LaunchOptions, Browser, Page } from 'puppeteer-core'
import { onStart, appList, Context } from 'koishi-core'

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

let browserPromise: Promise<Browser>
const idlePages: Page[] = []

export async function getPage () {
  if (idlePages.length) {
    return idlePages.pop()
  }

  const browser = await browserPromise
  return browser.newPage()
}

export function freePage (page: Page) {
  idlePages.push(page)
}

Context.prototype.getPage = getPage
Context.prototype.freePage = freePage

onStart(() => {
  const logger = appList[0].logger('puppeteer')
  browserPromise = launch(appList[0].options.puppeteer)
  browserPromise.then(
    () => logger.info('browser launched'),
    (error) => logger.warn(error),
  )
})
