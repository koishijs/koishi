import { internal, config } from '@koishijs/plugin-eval/lib/worker'
import { createElement, Fragment } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { segment } from 'koishi'
import { inspect } from 'util'

function wrapFactory<F extends (...args: any) => any>(func: F) {
  return (...args: Parameters<F>) => {
    const node = Object.create(func.apply(null, args))
    node[inspect.custom] = function () {
      return segment('fragment', { content: renderToStaticMarkup(this) })
    }
    return node
  }
}

internal.setGlobal(config.loaderConfig.jsxFactory, wrapFactory(createElement))
internal.setGlobal(config.loaderConfig.jsxFragment, Fragment)
