import { cwd, exit, getPackages, PackageJson, spawnAsync } from './utils'
import { gt, prerelease } from 'semver'
import { copyFile, writeFile } from 'fs-extra'
import { CAC } from 'cac'
import which from 'which-pm-runs'
import latest from 'latest-version'
import ora from 'ora'
import prompts from 'prompts'

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

function publish(agent: string, path: string, name: string, version: string, tag: string) {
  console.log(`publishing ${name}@${version} ...`)
  return spawnAsync([
    agent, 'publish', path.slice(1),
    '--tag', tag,
    '--access', 'public',
  ])
}

export default function (cli: CAC) {
  cli.command('publish [...name]', 'publish packages')
    .alias('pub')
    .action(async (names: string[], options) => {
      const packages: Record<string, PackageJson> = {}
      const spinner = ora()
      if (names.length) {
        Object.assign(packages, await getPackages(names))
        const pending = Object.keys(packages).filter(path => packages[path].private)
        if (pending.length) {
          const paths = pending.map(path => packages[path].name).join(', ')
          const { value } = await prompts({
            name: 'value',
            type: 'confirm',
            message: `workspace ${paths} ${pending.length > 1 ? 'are' : 'is'} private, switch to public?`,
          })
          if (!value) exit('operation cancelled.')

          await Promise.all(pending.map(async (path) => {
            const meta = packages[path]
            delete meta.private
            await writeFile(`${cwd}${path}/package.json`, JSON.stringify(meta, null, 2))
          }))
        }
      } else {
        const entries = Object.entries(await getPackages([]))
        let progress = 0
        spinner.start(`Loading workspaces (0/${entries.length})`)
        await Promise.all(entries.map(async ([name, meta]) => {
          if (!meta.private) {
            const version = await getVersion(meta.name, isNext(meta.version))
            if (gt(meta.version, version)) {
              packages[name] = meta
            }
          }
          spinner.text = `Loading workspaces (${++progress}/${entries.length})`
        }))
        spinner.succeed()
      }

      const agent = which()?.name || 'npm'
      for (const path in packages) {
        const { name, version } = packages[path]
        if (name === 'koishi') {
          await copyFile(`${cwd}/README.md`, `${cwd}${path}/README.md`)
        }
        await publish(agent, path, name, version, isNext(version) ? 'next' : 'latest')
      }

      spinner.succeed('All workspaces are up to date.')
    })
}
