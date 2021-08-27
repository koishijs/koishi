import { BuildOptions, Plugin } from 'esbuild'
import { resolve } from 'path'

interface InputBuildOptions extends BuildOptions {
  entryPoints: string[]
}

type DefineBuild = (base: string, options: InputBuildOptions) => void | Promise<void> | BuildOptions[] | Promise<BuildOptions[]>

export const defineBuild = (callback: DefineBuild) => callback

export const defineCrossBuild = (...modules: string[]) => defineBuild(async (base, options) => {
  delete options.outdir

  const filter = new RegExp(`^.+\\/(${modules.join('|')})$`)

  const createCrossPlugin = (platform: 'node' | 'browser'): Plugin => ({
    name: 'cross-platform',
    setup(build) {
      build.onResolve({ filter }, ({ path, resolveDir }) => {
        for (const module of modules) {
          if (!path.includes(module)) continue
          return { path: resolve(resolveDir, `${module}/${platform}.ts`) }
        }
      })
    },
  })

  return [{
    ...options,
    outfile: base + '/lib/node.js',
    plugins: [
      ...options.plugins,
      createCrossPlugin('node'),
    ],
  }, {
    ...options,
    format: 'esm',
    target: 'esnext',
    platform: 'browser',
    outfile: base + '/lib/browser.js',
    plugins: [
      ...options.plugins,
      createCrossPlugin('browser'),
    ],
  }]
})
