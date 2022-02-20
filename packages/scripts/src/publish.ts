import { cwd, getPackages, PackageJson, spawnAsync } from './utils'
import { gt, prerelease } from 'semver'
import { copyFile } from 'fs-extra'
import { CAC } from 'cac'
import latest from 'latest-version'
import ora from 'ora'

function getVersion(name: string, isNext = false) {
  if (isNext) {
    return latest(name, { version: 'next' }).catch(() => getVersion(name))
  } else {
    return latest(name).catch(() => '0.0.1')
  }
}

function isNext(version: string) {
  const parts = prerelease(version)
  if (!parts) return false
  return parts[0] !== 'rc'
}

function publish(folder: string, name: string, version: string, tag: string) {
  console.log(`publishing ${name}@${version} ...`)
  return spawnAsync([
    'yarn', 'publish', folder,
    '--new-version', version,
    '--tag', tag,
    '--access', 'public',
  ])
}

export default function (cli: CAC) {
  cli.command('publish [...name]', 'publish packages')
    .alias('pub')
    .action(async (names: string[], options) => {
      const entries = Object.entries(await getPackages(names, { ignorePrivate: true }))
      const spinner = ora()
      const bumpMap: Record<string, PackageJson> = {}

      let progress = 0
      spinner.start(`Loading workspaces (0/${entries.length})`)
      await Promise.all(entries.map(async ([name, meta]) => {
        if (!meta.private) {
          const version = await getVersion(meta.name, isNext(meta.version))
          if (gt(meta.version, version)) {
            bumpMap[name] = meta
          }
        }
        spinner.text = `Loading workspaces (${++progress}/${entries.length})`
      }))
      spinner.succeed()

      for (const path in bumpMap) {
        const { name, version } = bumpMap[path]
        if (name === 'koishi') {
          await copyFile(`${cwd}/README.md`, `${cwd}${path}/README.md`)
        }
        await publish(path, name, version, isNext(version) ? 'next' : 'latest')
      }

      spinner.succeed('All workspaces are up to date.')
    })
}
