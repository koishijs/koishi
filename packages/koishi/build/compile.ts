import { resolve } from 'path'
import { defineBuild } from '../../../build'

export = defineBuild(async (base, options) => {
  return [options, {
    ...options,
    entryPoints: [base + '/src/browser.ts'],
    minify: true,
    platform: 'browser',
    target: 'esnext',
    format: 'iife',
    globalName: 'Koishi',
    plugins: [{
      name: 'browser support',
      setup(build) {
        build.onResolve({ filter: /^@koishijs\/core$/ }, () => ({ path: resolve(__dirname, '../../core/src/index.ts') }))
        build.onResolve({ filter: /^@koishijs\/utils$/ }, () => ({ path: resolve(__dirname, '../../utils/src/index.ts') }))
        build.onResolve({ filter: /^.+\/logger$/ }, ({ resolveDir }) => ({ path: resolve(resolveDir, 'logger/browser.ts') }))
      },
    }],
  }]
})
