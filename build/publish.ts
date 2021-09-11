import { cwd, PackageJson, getWorkspaces, spawnAsync, spawnSync } from './utils'
import { gt, maxSatisfying, prerelease } from 'semver'
import { Octokit } from '@octokit/rest'
import { draft } from './release'
import { writeJson } from 'fs-extra'
import latest from 'latest-version'
import ora from 'ora'

const { CI, GITHUB_EVENT_NAME, GITHUB_REF, GITHUB_TOKEN } = process.env

if (CI && (GITHUB_REF !== 'refs/heads/master' || GITHUB_EVENT_NAME !== 'push')) {
  console.log('publish skipped.')
  process.exit(0)
}

function getVersion(name: string, isLatest = true) {
  if (isLatest) {
    return latest(name).catch(() => '0.0.1')
  } else {
    return latest(name, { version: 'next' }).catch(() => getVersion(name))
  }
}

;(async () => {
  let folders = await getWorkspaces()
  if (process.argv[2]) {
    folders = folders.filter(path => path.startsWith(process.argv[2]))
  }

  const spinner = ora()
  const bumpMap: Record<string, PackageJson> = {}

  let progress = 0
  spinner.start(`Loading workspaces (0/${folders.length})`)
  await Promise.all(folders.map(async (name) => {
    let meta: PackageJson
    try {
      meta = require(`../${name}/package.json`)
      if (!meta.private) {
        const version = await getVersion(meta.name, !prerelease(meta.version))
        if (gt(meta.version, version)) {
          bumpMap[name] = meta
        }
      }
    } catch { /* pass */ }
    spinner.text = `Loading workspaces (${++progress}/${folders.length})`
  }))
  spinner.succeed()

  function publish(folder: string, name: string, version: string, tag: string) {
    console.log(`publishing ${name}@${version} ...`)
    return spawnAsync([
      'yarn', 'publish', folder,
      '--new-version', version,
      '--tag', tag,
      '--access', 'public',
    ])
  }

  if (Object.keys(bumpMap).length) {
    for (const folder in bumpMap) {
      const { name, version } = bumpMap[folder]
      await publish(folder, name, version, prerelease(version) ? 'next' : 'latest')
    }
  }

  const { version } = require('../packages/koishi/package') as PackageJson
  if (prerelease(version)) return

  const tags = spawnSync(['git', 'tag', '-l']).split(/\r?\n/)
  if (tags.includes(version)) {
    return console.log(`Tag ${version} already exists.`)
  }

  const body = draft(maxSatisfying(tags, '*'), bumpMap)
  console.log(body)

  if (!GITHUB_TOKEN) return
  const github = new Octokit({
    auth: GITHUB_TOKEN,
  })

  console.log(`Start to release a new version with tag ${version} ...`)
  await github.repos.createRelease({
    repo: 'koishi',
    owner: 'koishijs',
    tag_name: version,
    name: `Koishi ${version}`,
    prerelease: !!prerelease(version),
    body,
  })
  console.log('Release created successfully.')
})()
