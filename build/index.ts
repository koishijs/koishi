import * as esbuild from 'esbuild'

interface BuildOptions extends esbuild.BuildOptions {
  entryPoints: string[]
}

type DefineBuild = (base: string, options: BuildOptions) => void | Promise<void> | esbuild.BuildOptions[] | Promise<esbuild.BuildOptions[]>

export const defineBuild = (callback: DefineBuild) => callback
